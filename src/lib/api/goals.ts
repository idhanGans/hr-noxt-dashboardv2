import { z } from "zod";

import type { goals } from "@/db/schema";

export const goalWriteSchema = z.object({
  employeeId: z.string().min(1), // employee code, resolved server-side
  title: z.string().min(1),
  type: z.enum(["okr", "kpi"]),
  quarter: z.string().min(1),
  weight: z.number().int().min(1).max(100),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["on_track", "at_risk", "behind", "completed"]).optional(),
});

export type GoalWriteInput = z.infer<typeof goalWriteSchema>;

export type GoalRow = {
  g: typeof goals.$inferSelect;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function shapeGoal(row: GoalRow) {
  return {
    id: String(row.g.id),
    employeeId: row.employeeCode ?? String(row.g.employeeId),
    employeeName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    title: row.g.title,
    type: row.g.type,
    progress: row.g.progress,
    status: row.g.status,
    quarter: row.g.quarter ?? "",
    weight: row.g.weight ?? 0,
  };
}
