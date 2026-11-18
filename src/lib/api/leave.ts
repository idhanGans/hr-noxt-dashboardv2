import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { employees, leaveRequests } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const leaveCreateSchema = z.object({
  type: z.enum(["annual", "sick", "parental", "unpaid", "bereavement"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  days: z.number().int().positive(),
  reason: z.string().optional(),
});

export type LeaveRow = {
  lr: typeof leaveRequests.$inferSelect;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function shapeLeave(row: LeaveRow) {
  return {
    // numeric id (as string) so item endpoints like /approve resolve it
    id: String(row.lr.id),
    employeeId: row.employeeCode ?? String(row.lr.employeeId),
    employeeName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    type: row.lr.type,
    startDate: row.lr.startDate,
    endDate: row.lr.endDate,
    days: row.lr.days,
    reason: row.lr.reason ?? "",
    status: row.lr.status,
    approver: row.lr.approver ?? "",
    submittedAt: row.lr.submittedAt ? row.lr.submittedAt.toISOString().slice(0, 10) : "",
  };
}

// Shared approve/reject handler (manager only). Sets the new status and records
// the deciding manager's name as the approver.
export async function decideLeave(
  req: Request,
  idStr: string,
  status: "approved" | "rejected",
) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Entscheidung nur fuer Manager" }, { status: 403 });
  }

  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const [mgr] = await db
    .select({ firstName: employees.firstName, lastName: employees.lastName })
    .from(employees)
    .where(eq(employees.id, auth.employeeId))
    .limit(1);
  const approver = mgr ? `${mgr.firstName} ${mgr.lastName}` : auth.authUser;

  const updated = await db
    .update(leaveRequests)
    .set({ status, approver, updatedAt: new Date() })
    .where(eq(leaveRequests.id, id))
    .returning({ id: leaveRequests.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id, status });
}
