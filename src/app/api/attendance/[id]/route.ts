import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { attendanceRecords, departments, employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type AttendanceRow, attendanceWriteSchema, shapeAttendance } from "@/lib/api/attendance";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/attendance/[id] — manager/admin any; staff only their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const recordId = parseId(id);
  if (recordId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: AttendanceRow[] = await db
    .select({
      a: attendanceRecords,
      employeeCode: employees.code,
      firstName: employees.firstName,
      lastName: employees.lastName,
      department: departments.name,
    })
    .from(attendanceRecords)
    .leftJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(attendanceRecords.id, recordId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (auth.role === "staff" && rows[0].a.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "Nur die eigenen Eintraege" }, { status: 403 });
  }
  return NextResponse.json(shapeAttendance(rows[0]));
}

// PATCH /api/attendance/[id] — update an entry (manager only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const recordId = parseId(id);
  if (recordId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = attendanceWriteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const set: Partial<typeof attendanceRecords.$inferInsert> = { updatedAt: new Date() };
  if (d.date !== undefined) set.date = d.date;
  if (d.clockIn !== undefined) set.clockIn = d.clockIn;
  if (d.clockOut !== undefined) set.clockOut = d.clockOut;
  if (d.status !== undefined) set.status = d.status;
  if (d.workedHours !== undefined) set.workedHours = String(d.workedHours);
  if (d.location !== undefined) set.location = d.location;
  if (d.gpsLat !== undefined) set.gpsLat = d.gpsLat;
  if (d.gpsLng !== undefined) set.gpsLng = d.gpsLng;
  if (d.locationOut !== undefined) set.locationOut = d.locationOut;
  if (d.gpsOutLat !== undefined) set.gpsOutLat = d.gpsOutLat;
  if (d.gpsOutLng !== undefined) set.gpsOutLng = d.gpsOutLng;
  if (d.method !== undefined) set.method = d.method;

  const db = getDb();
  const updated = await db
    .update(attendanceRecords)
    .set(set)
    .where(eq(attendanceRecords.id, recordId))
    .returning({ id: attendanceRecords.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/attendance/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const recordId = parseId(id);
  if (recordId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(attendanceRecords)
    .where(eq(attendanceRecords.id, recordId))
    .returning({ id: attendanceRecords.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
