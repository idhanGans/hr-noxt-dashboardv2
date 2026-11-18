import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, goals } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { isForeignKeyViolation } from "@/lib/api/employees";
import { type GoalRow, goalWriteSchema, shapeGoal } from "@/lib/api/goals";

export const dynamic = "force-dynamic";

const SELECT = {
  g: goals,
  employeeCode: employees.code,
  firstName: employees.firstName,
  lastName: employees.lastName,
};

// GET /api/goals — manager/admin all; staff only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(goals.employeeId, auth.employeeId) : undefined;

  const rows: GoalRow[] = await db
    .select(SELECT)
    .from(goals)
    .leftJoin(employees, eq(goals.employeeId, employees.id))
    .where(onlyOwn)
    .orderBy(goals.id);

  return NextResponse.json({ items: rows.map(shapeGoal) });
}

// POST /api/goals — create a goal (manager only). employeeId is an employee code.
export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Anlegen nur fuer Manager" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = goalWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const d = parsed.data;
  const db = getDb();
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, d.employeeId))
    .limit(1);
  if (!emp) {
    return NextResponse.json({ error: "Unbekannter Mitarbeiter (employeeId)" }, { status: 409 });
  }

  try {
    const [created] = await db
      .insert(goals)
      .values({
        employeeId: emp.id,
        title: d.title,
        type: d.type,
        quarter: d.quarter,
        weight: d.weight,
        progress: d.progress ?? 0,
        status: d.status ?? "on_track",
      })
      .returning({ id: goals.id });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: "Unbekannter Mitarbeiter (employeeId)" }, { status: 409 });
    }
    throw err;
  }
}
