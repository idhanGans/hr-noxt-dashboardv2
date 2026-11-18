import { z } from "zod";

import type { payslipLines, payslips } from "@/db/schema";
import type { Role } from "@/lib/api/auth";

export const payslipLineSchema = z.object({
  label: z.string().min(1),
  amount: z.number(), // deductions are negative
  type: z.enum(["earning", "deduction"]),
});

export const payslipWriteSchema = z.object({
  employeeId: z.string().min(1), // employee code, e.g. "EMP-0001" (resolved server-side)
  period: z.string().min(1), // e.g. "2026-05"
  gross: z.number().nonnegative(),
  net: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  status: z.enum(["paid", "processing", "scheduled"]),
  lines: z.array(payslipLineSchema).optional(),
});

export type PayslipWriteInput = z.infer<typeof payslipWriteSchema>;

export type PayslipRow = {
  ps: typeof payslips.$inferSelect;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
};
export type LineRow = typeof payslipLines.$inferSelect;

// Amounts (gross/net/tax + line amounts) are sensitive: managers and the
// owning staff member see them; admins see the list without amounts.
export function canSeeAmounts(role: Role): boolean {
  return role !== "admin";
}

export function shapePayslip(row: PayslipRow, lines: LineRow[], showAmounts: boolean) {
  return {
    id: row.ps.code ?? String(row.ps.id),
    employeeId: row.employeeCode ?? String(row.ps.employeeId),
    employeeName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    period: row.ps.period,
    status: row.ps.status,
    gross: showAmounts ? Number(row.ps.gross) : null,
    net: showAmounts ? Number(row.ps.net) : null,
    tax: showAmounts ? Number(row.ps.tax) : null,
    lines: showAmounts
      ? lines.map((l) => ({ label: l.label, amount: Number(l.amount), type: l.type }))
      : [],
  };
}
