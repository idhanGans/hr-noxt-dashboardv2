import { z } from "zod";

import type { assets } from "@/db/schema";

export const assetWriteSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["laptop", "phone", "monitor", "access_card", "vehicle"]),
  serial: z.string().min(1),
  status: z
    .enum(["assigned", "available", "maintenance", "retired", "lost", "disposed"])
    .optional(),
  assignedToCode: z.string().nullable().optional(), // employee code, resolved server-side
  purchaseDate: z.string().optional(),
  assetTag: z.string().optional(),
  vendor: z.string().optional(),
  purchasePrice: z.number().optional(),
  warrantyUntil: z.string().optional(),
  location: z.string().optional(),
  condition: z.enum(["new", "good", "damaged"]).optional(),
  os: z.string().optional(),
  encryptionEnabled: z.boolean().optional(),
  assignedSince: z.string().optional(),
  insuranceCovered: z.boolean().optional(),
  notes: z.string().optional(),
});

export type AssetWriteInput = z.infer<typeof assetWriteSchema>;

export type AssetRow = {
  a: typeof assets.$inferSelect;
  holderFirst: string | null;
  holderLast: string | null;
};

export function shapeAsset(row: AssetRow) {
  const holder =
    row.holderFirst || row.holderLast
      ? `${row.holderFirst ?? ""} ${row.holderLast ?? ""}`.trim()
      : undefined;
  return {
    id: String(row.a.id),
    name: row.a.name,
    category: row.a.category,
    serial: row.a.serial,
    assignedTo: holder,
    status: row.a.status,
    purchaseDate: row.a.purchaseDate ?? "",
    assetTag: row.a.assetTag ?? undefined,
    vendor: row.a.vendor ?? undefined,
    purchasePrice: row.a.purchasePrice != null ? Number(row.a.purchasePrice) : undefined,
    warrantyUntil: row.a.warrantyUntil ?? undefined,
    location: row.a.location ?? undefined,
    condition: row.a.condition ?? undefined,
    os: row.a.os ?? undefined,
    encryptionEnabled: row.a.encryptionEnabled ?? undefined,
    assignedSince: row.a.assignedSince ?? undefined,
    insuranceCovered: row.a.insuranceCovered ?? undefined,
    notes: row.a.notes ?? undefined,
  };
}
