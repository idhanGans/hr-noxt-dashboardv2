import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { departments, employees, titles } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { isUniqueViolation } from "@/lib/api/employees";

export const dynamic = "force-dynamic";

// Eine Import-Zeile: nur Name + E-Mail sind Pflicht, der Rest hat Defaults.
const rowSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  department: z.string().trim().optional(),
  title: z.string().trim().optional(),
  jobTitle: z.string().trim().optional(),
  location: z.string().trim().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).optional(),
  status: z.enum(["active", "onboarding", "on_leave", "offboarding", "terminated"]).optional(),
  hireDate: z.string().trim().optional(),
  salary: z.union([z.string(), z.number()]).optional(),
  authUser: z.string().trim().optional(), // Plattform-Login (optional), damit der/die MA sich anmelden kann
});

type ImportError = { index: number; email: string; error: string };

// POST /api/employees/import — Massen-Import (Manager only).
// Body: { rows: [...] }. Fehlende Abteilungen/Titel werden automatisch angelegt.
// Antwort: { created, failed, errors[] } — pro Zeile ehrlich.
export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Import nur fuer Manager" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }
  const rowsRaw = (body as { rows?: unknown })?.rows;
  if (!Array.isArray(rowsRaw)) {
    return NextResponse.json({ error: "rows[] fehlt" }, { status: 422 });
  }
  if (rowsRaw.length > 2000) {
    return NextResponse.json({ error: "Maximal 2000 Zeilen pro Import" }, { status: 422 });
  }

  const db = getDb();
  const errors: ImportError[] = [];
  const valid: { index: number; data: z.infer<typeof rowSchema> }[] = [];

  rowsRaw.forEach((r, i) => {
    const parsed = rowSchema.safeParse(r);
    if (!parsed.success) {
      const email = typeof (r as { email?: unknown })?.email === "string" ? (r as { email: string }).email : "";
      errors.push({ index: i, email, error: parsed.error.issues[0]?.message ?? "ungueltige Zeile" });
    } else {
      valid.push({ index: i, data: parsed.data });
    }
  });

  // Fehlende Abteilungen/Titel automatisch anlegen (idempotent ueber unique name).
  const deptNames = [...new Set(valid.map((v) => v.data.department).filter(Boolean) as string[])];
  const titleNames = [...new Set(valid.map((v) => v.data.title).filter(Boolean) as string[])];
  if (deptNames.length > 0) {
    await db.insert(departments).values(deptNames.map((name) => ({ name }))).onConflictDoNothing();
  }
  if (titleNames.length > 0) {
    await db.insert(titles).values(titleNames.map((name) => ({ name }))).onConflictDoNothing();
  }

  // Name->ID-Maps einmalig aufbauen (statt pro Zeile zu queryen).
  const deptRows = await db.select({ id: departments.id, name: departments.name }).from(departments);
  const titleRows = await db.select({ id: titles.id, name: titles.name }).from(titles);
  const deptMap = new Map(deptRows.map((d) => [d.name, d.id]));
  const titleMap = new Map(titleRows.map((t) => [t.name, t.id]));

  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const v of valid) {
    const d = v.data;
    try {
      await db.insert(employees).values({
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        jobTitle: d.jobTitle || "—",
        location: d.location || "—",
        employmentType: d.employmentType ?? "full_time",
        status: d.status ?? "onboarding",
        hireDate: d.hireDate || today,
        salary: d.salary != null && d.salary !== "" ? String(d.salary) : "0",
        performanceScore: 75,
        role: "staff",
        departmentId: d.department ? deptMap.get(d.department) ?? null : null,
        titleId: d.title ? titleMap.get(d.title) ?? null : null,
        authUser: d.authUser || null,
      });
      created++;
    } catch (err) {
      errors.push({
        index: v.index,
        email: d.email,
        error: isUniqueViolation(err) ? "E-Mail/Login bereits vergeben" : "Fehler beim Anlegen",
      });
    }
  }

  return NextResponse.json({ created, failed: errors.length, errors: errors.slice(0, 100) });
}
