import { z } from "zod";

import type { appraisals } from "@/db/schema";

export const appraisalWriteSchema = z.object({
  employeeId: z.string().min(1), // employee code, resolved server-side
  quarter: z.string().min(1),
  overallRating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  status: z.enum(["completed", "draft", "in_progress"]).optional(),
  scoreFachkompetenz: z.number().int().min(1).max(5).optional(),
  scoreZusammenarbeit: z.number().int().min(1).max(5).optional(),
  scoreKommunikation: z.number().int().min(1).max(5).optional(),
  scoreEigeninitiative: z.number().int().min(1).max(5).optional(),
});

export type AppraisalWriteInput = z.infer<typeof appraisalWriteSchema>;

export type AppraisalRow = {
  ap: typeof appraisals.$inferSelect;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function shapeAppraisal(row: AppraisalRow) {
  return {
    id: String(row.ap.id),
    employeeId: row.employeeCode ?? String(row.ap.employeeId),
    employeeName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    quarter: row.ap.quarter ?? "",
    overallRating: row.ap.overallRating ?? 0,
    comment: row.ap.comment ?? "",
    status: row.ap.status,
    scoreFachkompetenz: row.ap.scoreFachkompetenz ?? 0,
    scoreZusammenarbeit: row.ap.scoreZusammenarbeit ?? 0,
    scoreKommunikation: row.ap.scoreKommunikation ?? 0,
    scoreEigeninitiative: row.ap.scoreEigeninitiative ?? 0,
  };
}
