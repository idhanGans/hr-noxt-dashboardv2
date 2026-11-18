import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { departments, employees, titles } from "@/db/schema";

// Create/update payload. References (department, title, manager, buddy) are
// given by NAME/CODE — the stable identifiers the frontend carries — and
// resolved to numeric ids server-side (see resolveEmployeeRefs).
export const employeeWriteSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  jobTitle: z.string().min(1),
  location: z.string().min(1),
  employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]),
  status: z
    .enum(["active", "onboarding", "on_leave", "offboarding", "terminated"])
    .optional(),
  hireDate: z.string().min(1),
  salary: z.number().nonnegative(),
  performanceScore: z.number().int().min(0).max(100).optional(),
  role: z.enum(["manager", "admin", "staff"]).optional(),

  // resolved server-side
  department: z.string().optional(),
  title: z.string().optional(),
  managerId: z.string().optional(), // employee code
  buddyId: z.string().optional(), // employee code

  // optional detail fields
  dateOfBirth: z.string().optional(),
  gender: z.enum(["m", "f", "d"]).optional(),
  nationality: z.string().optional(),
  phone: z.string().optional(),
  addressStreet: z.string().optional(),
  addressZip: z.string().optional(),
  addressCity: z.string().optional(),
  addressCountry: z.string().optional(),
  contractType: z
    .enum([
      "permanent",
      "fixed_term",
      "part_time",
      "working_student",
      "intern",
      "mini_job",
      "freelance",
    ])
    .optional(),
  contractStart: z.string().optional(),
  contractEnd: z.string().optional(),
  probationEnd: z.string().optional(),
  weeklyHours: z.number().optional(),
  vacationEntitlement: z.number().int().optional(),
  noticePeriod: z.string().optional(),
  workplaceModel: z.enum(["office", "hybrid", "remote"]).optional(),
  taxId: z.string().optional(),
  socialSecurityNo: z.string().optional(),
  taxClass: z.number().int().min(1).max(6).optional(),
  children: z.number().int().min(0).optional(),
  religion: z.enum(["rk", "ev", "keine", "sonst"]).optional(),
  healthInsuranceType: z.enum(["statutory", "private"]).optional(),
  healthInsuranceProvider: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  costCenter: z.string().optional(),
  bonusTargetPct: z.number().optional(),
});

export type EmployeeWriteInput = z.infer<typeof employeeWriteSchema>;

export type ResolvedRefs = {
  departmentId?: number | null;
  titleId?: number | null;
  managerId?: number | null;
  buddyId?: number | null;
};

// Resolve department/title names + manager/buddy employee-codes to numeric ids.
// Only keys present in `data` are resolved (so PATCH leaves the rest untouched).
export async function resolveEmployeeRefs(
  data: Pick<EmployeeWriteInput, "department" | "title" | "managerId" | "buddyId">,
): Promise<ResolvedRefs> {
  const db = getDb();
  const refs: ResolvedRefs = {};

  if (data.department !== undefined) {
    const [r] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.name, data.department))
      .limit(1);
    refs.departmentId = r?.id ?? null;
  }
  if (data.title !== undefined) {
    const [r] = await db
      .select({ id: titles.id })
      .from(titles)
      .where(eq(titles.name, data.title))
      .limit(1);
    refs.titleId = r?.id ?? null;
  }
  if (data.managerId) {
    const [r] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.code, data.managerId))
      .limit(1);
    refs.managerId = r?.id ?? null;
  }
  if (data.buddyId) {
    const [r] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.code, data.buddyId))
      .limit(1);
    refs.buddyId = r?.id ?? null;
  }
  return refs;
}

// Builds a partial column set from (partial) input — used by PATCH.
// Numeric columns become strings; empty date strings become null.
export function buildEmployeeColumns(
  d: Partial<EmployeeWriteInput>,
  refs: ResolvedRefs,
): Partial<typeof employees.$inferInsert> {
  const v: Partial<typeof employees.$inferInsert> = { ...refs };
  if (d.firstName !== undefined) v.firstName = d.firstName;
  if (d.lastName !== undefined) v.lastName = d.lastName;
  if (d.email !== undefined) v.email = d.email;
  if (d.jobTitle !== undefined) v.jobTitle = d.jobTitle;
  if (d.location !== undefined) v.location = d.location;
  if (d.employmentType !== undefined) v.employmentType = d.employmentType;
  if (d.status !== undefined) v.status = d.status;
  if (d.hireDate !== undefined) v.hireDate = d.hireDate;
  if (d.salary !== undefined) v.salary = String(d.salary);
  if (d.performanceScore !== undefined) v.performanceScore = d.performanceScore;
  if (d.role !== undefined) v.role = d.role;
  if (d.dateOfBirth !== undefined) v.dateOfBirth = d.dateOfBirth || null;
  if (d.gender !== undefined) v.gender = d.gender;
  if (d.nationality !== undefined) v.nationality = d.nationality;
  if (d.phone !== undefined) v.phone = d.phone;
  if (d.addressStreet !== undefined) v.addressStreet = d.addressStreet;
  if (d.addressZip !== undefined) v.addressZip = d.addressZip;
  if (d.addressCity !== undefined) v.addressCity = d.addressCity;
  if (d.addressCountry !== undefined) v.addressCountry = d.addressCountry;
  if (d.contractType !== undefined) v.contractType = d.contractType;
  if (d.contractStart !== undefined) v.contractStart = d.contractStart || null;
  if (d.contractEnd !== undefined) v.contractEnd = d.contractEnd || null;
  if (d.probationEnd !== undefined) v.probationEnd = d.probationEnd || null;
  if (d.weeklyHours !== undefined) v.weeklyHours = String(d.weeklyHours);
  if (d.vacationEntitlement !== undefined) v.vacationEntitlement = d.vacationEntitlement;
  if (d.noticePeriod !== undefined) v.noticePeriod = d.noticePeriod;
  if (d.workplaceModel !== undefined) v.workplaceModel = d.workplaceModel;
  if (d.taxId !== undefined) v.taxId = d.taxId;
  if (d.socialSecurityNo !== undefined) v.socialSecurityNo = d.socialSecurityNo;
  if (d.taxClass !== undefined) v.taxClass = d.taxClass;
  if (d.children !== undefined) v.children = d.children;
  if (d.religion !== undefined) v.religion = d.religion;
  if (d.healthInsuranceType !== undefined) v.healthInsuranceType = d.healthInsuranceType;
  if (d.healthInsuranceProvider !== undefined)
    v.healthInsuranceProvider = d.healthInsuranceProvider;
  if (d.iban !== undefined) v.iban = d.iban;
  if (d.bic !== undefined) v.bic = d.bic;
  if (d.costCenter !== undefined) v.costCenter = d.costCenter;
  if (d.bonusTargetPct !== undefined) v.bonusTargetPct = String(d.bonusTargetPct);
  return v;
}

export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e?.code ?? e?.cause?.code) === "23505";
}

export function isForeignKeyViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e?.code ?? e?.cause?.code) === "23503";
}
