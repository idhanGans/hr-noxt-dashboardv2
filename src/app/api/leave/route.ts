import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, leaveRequests } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type LeaveRow, leaveCreateSchema, shapeLeave } from "@/lib/api/leave";

export const dynamic = "force-dynamic";

// GET /api/leave — manager/admin see all; staff see only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(leaveRequests.employeeId, auth.employeeId) : undefined;

  const rows: LeaveRow[] = await db
    .select({
      lr: leaveRequests,
      employeeCode: employees.code,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(leaveRequests)
    .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .where(onlyOwn)
    .orderBy(leaveRequests.id);

  return NextResponse.json({ items: rows.map(shapeLeave) });
}

// POST /api/leave — any logged-in employee creates their own request (pending).
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

  const parsed = leaveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const db = getDb();
  const [created] = await db
    .insert(leaveRequests)
    .values({
      employeeId: auth.employeeId,
      type: parsed.data.type,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      days: parsed.data.days,
      reason: parsed.data.reason ?? null,
      status: "pending",
      submittedAt: new Date(),
    })
    .returning({ id: leaveRequests.id });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
