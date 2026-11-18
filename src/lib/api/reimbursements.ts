import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { employees, reimbursements } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const reimbursementCreateSchema = z.object({
  category: z.enum(["travel", "meals", "equipment", "training", "other"]),
  amount: z.number().nonnegative(),
  date: z.string().min(1),
  description: z.string().optional(),
  vat: z.union([z.literal(0), z.literal(7), z.literal(19)]).optional(),
  costCenter: z.string().optional(),
  paymentMethod: z.enum(["payroll", "bank", "corporate_card"]).optional(),
  currency: z.enum(["EUR", "USD"]).optional(),
  receiptUrl: z.string().optional(),
});

export type ReimbursementCreateInput = z.infer<typeof reimbursementCreateSchema>;

export type ReimbursementRow = {
  rb: typeof reimbursements.$inferSelect;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function shapeReimbursement(row: ReimbursementRow) {
  return {
    id: String(row.rb.id),
    employeeId: row.employeeCode ?? String(row.rb.employeeId),
    employeeName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    category: row.rb.category,
    amount: Number(row.rb.amount),
    date: row.rb.date,
    status: row.rb.status,
    description: row.rb.description ?? "",
    vat: row.rb.vat,
    costCenter: row.rb.costCenter ?? "",
    receiptUrl: row.rb.receiptUrl ?? undefined,
    approver: row.rb.approver ?? undefined,
    paymentMethod: row.rb.paymentMethod ?? "bank",
    currency: row.rb.currency ?? "EUR",
    submittedAt: row.rb.submittedAt ? row.rb.submittedAt.toISOString() : "",
    approvedAt: row.rb.approvedAt ? row.rb.approvedAt.toISOString() : undefined,
    processingDays: row.rb.processingDays ?? undefined,
  };
}

// Shared approve/reject handler (manager only). Sets status, approver (the
// deciding manager), approvedAt, and the processing window in days.
export async function decideReimbursement(
  req: Request,
  idStr: string,
  status: "approved" | "rejected",
  now: Date,
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
  const [row] = await db
    .select({ submittedAt: reimbursements.submittedAt })
    .from(reimbursements)
    .where(eq(reimbursements.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const [mgr] = await db
    .select({ firstName: employees.firstName, lastName: employees.lastName })
    .from(employees)
    .where(eq(employees.id, auth.employeeId))
    .limit(1);
  const approver = mgr ? `${mgr.firstName} ${mgr.lastName}` : auth.authUser;

  const processingDays = row.submittedAt
    ? Math.max(0, Math.round((now.getTime() - row.submittedAt.getTime()) / 86_400_000))
    : null;

  const updated = await db
    .update(reimbursements)
    .set({ status, approver, approvedAt: now, processingDays, updatedAt: now })
    .where(eq(reimbursements.id, id))
    .returning({ id: reimbursements.id });

  return NextResponse.json({ id: updated[0].id, status });
}
