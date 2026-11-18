import { z } from "zod";

import type { contracts } from "@/db/schema";
import type { Role } from "@/lib/api/auth";

const CONTRACT_TYPES = [
  "permanent",
  "fixed_term",
  "part_time",
  "working_student",
  "intern",
  "mini_job",
  "freelance",
] as const;

export const contractWriteSchema = z.object({
  employeeId: z.string().min(1), // employee code, resolved server-side
  jobTitle: z.string().min(1),
  type: z.enum(CONTRACT_TYPES),
  status: z.enum(["active", "expiring_soon", "expired", "draft", "terminated"]).optional(),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  salary: z.number().nonnegative(),
  hoursPerWeek: z.number().optional(),
  noticePeriodWeeks: z.number().int().optional(),
  templateId: z.number().int().nullable().optional(), // template db id
  templateName: z.string().optional(), // alternative: resolved to id server-side
  signedAt: z.string().optional(),
});

export type ContractWriteInput = z.infer<typeof contractWriteSchema>;

export type ContractRow = {
  c: typeof contracts.$inferSelect;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
  templateName: string | null;
};

// Salary is sensitive: managers and the owning staff member see it; admins don't.
export function canSeeSalary(role: Role): boolean {
  return role !== "admin";
}

export function shapeContract(row: ContractRow, showSalary: boolean) {
  return {
    id: String(row.c.id),
    code: row.c.code,
    employeeId: row.employeeCode ?? String(row.c.employeeId),
    employeeName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    jobTitle: row.c.jobTitle,
    type: row.c.type,
    status: row.c.status,
    startDate: row.c.startDate,
    endDate: row.c.endDate,
    salary: showSalary && row.c.salary != null ? Number(row.c.salary) : 0,
    hoursPerWeek: row.c.hoursPerWeek != null ? Number(row.c.hoursPerWeek) : 0,
    noticePeriodWeeks: row.c.noticePeriodWeeks ?? 0,
    templateId: row.c.templateId != null ? String(row.c.templateId) : "",
    templateName: row.templateName ?? "",
    signedAt: row.c.signedAt ? row.c.signedAt.toISOString().slice(0, 10) : undefined,
  };
}
