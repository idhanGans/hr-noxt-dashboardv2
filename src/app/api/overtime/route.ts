import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { employees, overtimeRequests } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const overtimeCreateSchema = z.object({
  date: z.string().min(1),
  hours: z.number().positive(),
  reason: z.string().optional(),
});

// GET /api/overtime — manager/admin all; staff only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(overtimeRequests.employeeId, auth.employeeId) : undefined;

  const rows = await db
    .select({
      ot: overtimeRequests,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(overtimeRequests)
    .leftJoin(employees, eq(overtimeRequests.employeeId, employees.id))
    .where(onlyOwn)
    .orderBy(overtimeRequests.id);

  const items = rows.map((r) => ({
    id: String(r.ot.id),
    employeeName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
    date: r.ot.date,
    hours: r.ot.hours != null ? Number(r.ot.hours) : 0,
    reason: r.ot.reason ?? "",
    status: r.ot.status,
  }));
  return NextResponse.json({ items });
}

// POST /api/overtime — log an overtime request for the logged-in employee.
export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = overtimeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const db = getDb();
  const [created] = await db
    .insert(overtimeRequests)
    .values({
      employeeId: auth.employeeId,
      date: parsed.data.date,
      hours: String(parsed.data.hours),
      reason: parsed.data.reason ?? null,
      status: "pending",
      submittedAt: new Date(),
    })
    .returning({ id: overtimeRequests.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
