import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, goals } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type GoalRow, goalWriteSchema, shapeGoal } from "@/lib/api/goals";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

const SELECT = {
  g: goals,
  employeeCode: employees.code,
  firstName: employees.firstName,
  lastName: employees.lastName,
};

// GET /api/goals/[id] — manager/admin any; staff only their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const goalId = parseId(id);
  if (goalId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: GoalRow[] = await db
    .select(SELECT)
    .from(goals)
    .leftJoin(employees, eq(goals.employeeId, employees.id))
    .where(eq(goals.id, goalId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (auth.role === "staff" && rows[0].g.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "Nur die eigenen Ziele" }, { status: 403 });
  }

  return NextResponse.json(shapeGoal(rows[0]));
}

// PATCH /api/goals/[id] — update fields (manager only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const goalId = parseId(id);
  if (goalId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = goalWriteSchema.omit({ employeeId: true }).partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const set: Partial<typeof goals.$inferInsert> = { updatedAt: new Date() };
  if (d.title !== undefined) set.title = d.title;
  if (d.type !== undefined) set.type = d.type;
  if (d.quarter !== undefined) set.quarter = d.quarter;
  if (d.weight !== undefined) set.weight = d.weight;
  if (d.progress !== undefined) set.progress = d.progress;
  if (d.status !== undefined) set.status = d.status;

  const db = getDb();
  const updated = await db
    .update(goals)
    .set(set)
    .where(eq(goals.id, goalId))
    .returning({ id: goals.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/goals/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const goalId = parseId(id);
  if (goalId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(goals)
    .where(eq(goals.id, goalId))
    .returning({ id: goals.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
