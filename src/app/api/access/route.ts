import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { accessGrantSchema } from "@/lib/api/access";
import { isUniqueViolation } from "@/lib/api/employees";

export const dynamic = "force-dynamic";

// Zugriffsverwaltung ist Manager-only (hoechste Rolle).
function canManageAccess(role: string): boolean {
  return role === "manager";
}

// GET /api/access — Liste aller Personen mit Rolle + Login-Status.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (!canManageAccess(auth.role)) {
    return NextResponse.json({ error: "Nur fuer Manager" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: employees.id,
      code: employees.code,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
      role: employees.role,
      authUser: employees.authUser,
    })
    .from(employees)
    .orderBy(employees.id);

  const items = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: `${r.firstName} ${r.lastName}`,
    email: r.email,
    role: r.role,
    authUser: r.authUser,
    canLogin: Boolean(r.authUser),
    isSelf: r.id === auth.employeeId,
  }));

  return NextResponse.json({ items });
}

// POST /api/access — neuen Zugang anlegen (Mitarbeiter + Plattform-Login).
export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (!canManageAccess(auth.role)) {
    return NextResponse.json({ error: "Nur fuer Manager" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = accessGrantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const d = parsed.data;
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Minimaler, gueltiger Mitarbeiter-Datensatz + Login. Restliche Felder
    // (Abteilung, Gehalt, …) kann der Manager spaeter unter People ergaenzen.
    const [created] = await db
      .insert(employees)
      .values({
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        jobTitle: "—",
        location: "—",
        employmentType: "full_time",
        status: "active",
        hireDate: today,
        salary: "0",
        performanceScore: 0,
        role: d.role,
        authUser: d.authUser,
      })
      .returning({ id: employees.id });

    // Lesbaren Code nachtragen (EMP-0007 …).
    const code = `EMP-${String(created.id).padStart(4, "0")}`;
    await db.update(employees).set({ code }).where(eq(employees.id, created.id));

    return NextResponse.json({ id: created.id, code }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "E-Mail oder Plattform-Login bereits vergeben" },
        { status: 409 },
      );
    }
    throw err;
  }
}
