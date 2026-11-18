import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { assets, employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type AssetRow, assetWriteSchema, shapeAsset } from "@/lib/api/assets";

export const dynamic = "force-dynamic";

const SELECT = {
  a: assets,
  holderFirst: employees.firstName,
  holderLast: employees.lastName,
};

async function resolveAssignee(code: string | null | undefined): Promise<number | null> {
  if (!code) return null;
  const db = getDb();
  const [e] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, code))
    .limit(1);
  return e?.id ?? null;
}

// GET /api/assets — inventory list with current holder (manager/admin).
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Inventar nur fuer Manager/Admin" }, { status: 403 });
  }

  const db = getDb();
  const rows: AssetRow[] = await db
    .select(SELECT)
    .from(assets)
    .leftJoin(employees, eq(assets.assignedToEmployeeId, employees.id))
    .orderBy(assets.id);

  return NextResponse.json({ items: rows.map(shapeAsset) });
}

// POST /api/assets — add an asset (manager only). assignedToCode is an employee code.
export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Anlegen nur fuer Manager" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = assetWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;
  const assignedToEmployeeId = await resolveAssignee(d.assignedToCode);

  const db = getDb();
  const [created] = await db
    .insert(assets)
    .values({
      name: d.name,
      category: d.category,
      serial: d.serial,
      status: d.status ?? (assignedToEmployeeId ? "assigned" : "available"),
      assignedToEmployeeId,
      purchaseDate: d.purchaseDate ?? null,
      assetTag: d.assetTag ?? null,
      vendor: d.vendor ?? null,
      purchasePrice: d.purchasePrice != null ? String(d.purchasePrice) : null,
      warrantyUntil: d.warrantyUntil ?? null,
      location: d.location ?? null,
      condition: d.condition ?? null,
      os: d.os ?? null,
      encryptionEnabled: d.encryptionEnabled ?? null,
      assignedSince: d.assignedSince ?? null,
      insuranceCovered: d.insuranceCovered ?? null,
      notes: d.notes ?? null,
    })
    .returning({ id: assets.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
