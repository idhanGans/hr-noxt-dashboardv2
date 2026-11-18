import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, leaveRequests } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type LeaveRow, leaveCreateSchema, shapeLeave } from "@/lib/api/leave";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/leave/[id] — manager/admin any; staff only their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const leaveId = parseId(id);
  if (leaveId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: LeaveRow[] = await db
    .select({
      lr: leaveRequests,
      employeeCode: employees.code,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(leaveRequests)
    .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .where(eq(leaveRequests.id, leaveId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (auth.role === "staff" && rows[0].lr.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "Nur die eigenen Antraege" }, { status: 403 });
  }

  return NextResponse.json(shapeLeave(rows[0]));
}

// PATCH /api/leave/[id] — einen NOCH ausstehenden Antrag bearbeiten.
// Erlaubt fuer den Antragsteller selbst oder einen Manager. Genehmigte/
// abgelehnte Antraege sind gesperrt (dafuer gibt es approve/reject).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const leaveId = parseId(id);
  if (leaveId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select({ employeeId: leaveRequests.employeeId, status: leaveRequests.status })
    .from(leaveRequests)
    .where(eq(leaveRequests.id, leaveId))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const isOwner = existing.employeeId === auth.employeeId;
  if (auth.role !== "manager" && !isOwner) {
    return NextResponse.json({ error: "Nur eigene Antraege bearbeiten" }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: "Nur ausstehende Antraege koennen bearbeitet werden" },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = leaveCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const updated = await db
    .update(leaveRequests)
    .set({
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.startDate !== undefined ? { startDate: d.startDate } : {}),
      ...(d.endDate !== undefined ? { endDate: d.endDate } : {}),
      ...(d.days !== undefined ? { days: d.days } : {}),
      ...(d.reason !== undefined ? { reason: d.reason } : {}),
      updatedAt: new Date(),
    })
    .where(eq(leaveRequests.id, leaveId))
    .returning({ id: leaveRequests.id });

  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/leave/[id]. Access: manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const leaveId = parseId(id);
  if (leaveId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(leaveRequests)
    .where(eq(leaveRequests.id, leaveId))
    .returning({ id: leaveRequests.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
