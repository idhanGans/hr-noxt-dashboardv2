import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { assets, employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type AssetRow, assetWriteSchema, shapeAsset } from "@/lib/api/assets";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/assets/[id] — manager/admin.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Inventar nur fuer Manager/Admin" }, { status: 403 });
  }

  const { id } = await params;
  const assetId = parseId(id);
  if (assetId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: AssetRow[] = await db
    .select({ a: assets, holderFirst: employees.firstName, holderLast: employees.lastName })
    .from(assets)
    .leftJoin(employees, eq(assets.assignedToEmployeeId, employees.id))
    .where(eq(assets.id, assetId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json(shapeAsset(rows[0]));
}

// PATCH /api/assets/[id] — update / (re)assign / change status (manager only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const assetId = parseId(id);
  if (assetId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = assetWriteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const db = getDb();
  const set: Partial<typeof assets.$inferInsert> = { updatedAt: new Date() };
  if (d.name !== undefined) set.name = d.name;
  if (d.category !== undefined) set.category = d.category;
  if (d.serial !== undefined) set.serial = d.serial;
  if (d.status !== undefined) set.status = d.status;
  if (d.purchaseDate !== undefined) set.purchaseDate = d.purchaseDate || null;
  if (d.assetTag !== undefined) set.assetTag = d.assetTag;
  if (d.vendor !== undefined) set.vendor = d.vendor;
  if (d.purchasePrice !== undefined) set.purchasePrice = String(d.purchasePrice);
  if (d.warrantyUntil !== undefined) set.warrantyUntil = d.warrantyUntil || null;
  if (d.location !== undefined) set.location = d.location;
  if (d.condition !== undefined) set.condition = d.condition;
  if (d.os !== undefined) set.os = d.os;
  if (d.encryptionEnabled !== undefined) set.encryptionEnabled = d.encryptionEnabled;
  if (d.assignedSince !== undefined) set.assignedSince = d.assignedSince || null;
  if (d.insuranceCovered !== undefined) set.insuranceCovered = d.insuranceCovered;
  if (d.notes !== undefined) set.notes = d.notes;
  if (d.assignedToCode !== undefined) {
    if (!d.assignedToCode) {
      set.assignedToEmployeeId = null;
    } else {
      const [e] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.code, d.assignedToCode))
        .limit(1);
      set.assignedToEmployeeId = e?.id ?? null;
    }
  }

  const updated = await db
    .update(assets)
    .set(set)
    .where(eq(assets.id, assetId))
    .returning({ id: assets.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/assets/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const assetId = parseId(id);
  if (assetId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(assets)
    .where(eq(assets.id, assetId))
    .returning({ id: assets.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
