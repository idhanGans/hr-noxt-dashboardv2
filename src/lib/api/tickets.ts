import { z } from "zod";

import type { helpdeskTickets } from "@/db/schema";

export const ticketWriteSchema = z.object({
  subject: z.string().min(1),
  requester: z.string().min(1),
  category: z.enum(["payroll", "it", "facilities", "policy", "benefits"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  assignee: z.string().optional(),
});

export type TicketWriteInput = z.infer<typeof ticketWriteSchema>;

export function shapeTicket(t: typeof helpdeskTickets.$inferSelect) {
  return {
    id: String(t.id),
    subject: t.subject,
    requester: t.requester,
    category: t.category,
    priority: t.priority,
    status: t.status,
    createdAt: t.createdAt ? t.createdAt.toISOString().slice(0, 10) : "",
    assignee: t.assignee ?? "",
  };
}
