import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { attendanceRecords, departments, employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type AttendanceRow, attendanceWriteSchema, shapeAttendance } from "@/lib/api/attendance";

export const dynamic = "force-dynamic";

const SELECT = {
  a: attendanceRecords,
  employeeCode: employees.code,
  firstName: employees.firstName,
  lastName: employees.lastName,
  department: departments.name,
};

// GET /api/attendance — manager/admin all; staff only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(attendanceRecords.employeeId, auth.employeeId) : undefined;

  const rows: AttendanceRow[] = await db
    .select(SELECT)
    .from(attendanceRecords)
    .leftJoin(employees, eq(attendanceRecords.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(onlyOwn)
    .orderBy(attendanceRecords.id);

  return NextResponse.json({ items: rows.map(shapeAttendance) });
}

// POST /api/attendance — record an entry for the logged-in employee.
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

  const parsed = attendanceWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const db = getDb();
  const [created] = await db
    .insert(attendanceRecords)
    .values({
      employeeId: auth.employeeId,
      date: d.date,
      clockIn: d.clockIn ?? null,
      clockOut: d.clockOut ?? null,
      status: d.status,
      workedHours: d.workedHours != null ? String(d.workedHours) : null,
      location: d.location ?? null,
      gpsLat: d.gpsLat ?? null,
      gpsLng: d.gpsLng ?? null,
      method: d.method ?? null,
    })
    .returning({ id: attendanceRecords.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
