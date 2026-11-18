import { z } from "zod";

import type { candidates, vacancies } from "@/db/schema";

// ---- vacancies ----
export const vacancyWriteSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(), // name, resolved server-side
  location: z.string().optional(),
  type: z.enum(["full_time", "part_time", "contractor"]),
  status: z.enum(["open", "on_hold", "closed"]).optional(),
  openedAt: z.string().optional(),
  hiringManager: z.string().optional(),
  recruiter: z.string().optional(),
  requiredStartDate: z.string().optional(),
  costCenter: z.string().optional(),
  priority: z.enum(["P0", "P1", "P2"]).optional(),
  workplaceModel: z.enum(["office", "hybrid", "remote"]).optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
});
export type VacancyWriteInput = z.infer<typeof vacancyWriteSchema>;

export type VacancyRow = { v: typeof vacancies.$inferSelect; department: string | null };

export type Funnel = {
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  hired: number;
};

export function shapeVacancy(
  row: VacancyRow,
  applicants: number,
  funnel: Funnel,
  sourceMix: { source: string; count: number }[],
) {
  return {
    id: String(row.v.id),
    title: row.v.title,
    department: row.department ?? "",
    location: row.v.location ?? "",
    type: row.v.type,
    applicants,
    status: row.v.status,
    openedAt: row.v.openedAt ?? "",
    hiringManager: row.v.hiringManager ?? "",
    priority: row.v.priority ?? undefined,
    workplaceModel: row.v.workplaceModel ?? undefined,
    salaryMin: row.v.salaryMin != null ? Number(row.v.salaryMin) : undefined,
    salaryMax: row.v.salaryMax != null ? Number(row.v.salaryMax) : undefined,
    currency: row.v.currency ?? undefined,
    recruiter: row.v.recruiter ?? undefined,
    requiredStartDate: row.v.requiredStartDate ?? undefined,
    costCenter: row.v.costCenter ?? undefined,
    funnel,
    sourceMix,
  };
}

// ---- candidates ----
export const candidateWriteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional(),
  department: z.string().optional(), // name
  location: z.string().optional(),
  vacancyId: z.number().int().nullable().optional(),
  stage: z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"]).optional(),
  rating: z.number().int().min(0).max(5).optional(),
  source: z.string().optional(),
  appliedAt: z.string().optional(),
  resumeUrl: z.string().optional(),
});
export type CandidateWriteInput = z.infer<typeof candidateWriteSchema>;

export type CandidateRow = { c: typeof candidates.$inferSelect; department: string | null };

export function shapeCandidate(row: CandidateRow) {
  return {
    id: String(row.c.id),
    name: row.c.name,
    email: row.c.email ?? "",
    role: row.c.role ?? "",
    department: row.department ?? "",
    stage: row.c.stage,
    rating: row.c.rating ?? 0,
    source: row.c.source ?? "",
    appliedAt: row.c.appliedAt ?? "",
    resumeUrl: row.c.resumeUrl ?? "#",
    location: row.c.location ?? "",
  };
}
