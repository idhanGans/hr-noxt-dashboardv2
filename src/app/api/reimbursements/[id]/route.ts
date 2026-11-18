import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, reimbursements } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import {
  type ReimbursementRow,
  reimbursementCreateSchema,
  shapeReimbursement,
} from "@/lib/api/reimbursements";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/reimbursements/[id] — manager/admin any; staff only their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const reimbId = parseId(id);
  if (reimbId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: ReimbursementRow[] = await db
    .select({
      rb: reimbursements,
      employeeCode: employees.code,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(reimbursements)
    .leftJoin(employees, eq(reimbursements.employeeId, employees.id))
    .where(eq(reimbursements.id, reimbId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (auth.role === "staff" && rows[0].rb.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "Nur die eigenen Erstattungen" }, { status: 403 });
  }

  return NextResponse.json(shapeReimbursement(rows[0]));
}

// PATCH /api/reimbursements/[id] — eine NOCH ausstehende Erstattung bearbeiten.
// Erlaubt fuer den Einreicher selbst oder einen Manager. Bereits entschiedene
// Erstattungen sind gesperrt (dafuer gibt es approve/reject).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const reimbId = parseId(id);
  if (reimbId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select({ employeeId: reimbursements.employeeId, status: reimbursements.status })
    .from(reimbursements)
    .where(eq(reimbursements.id, reimbId))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const isOwner = existing.employeeId === auth.employeeId;
  if (auth.role !== "manager" && !isOwner) {
    return NextResponse.json({ error: "Nur eigene Erstattungen bearbeiten" }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: "Nur ausstehende Erstattungen koennen bearbeitet werden" },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = reimbursementCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const updated = await db
    .update(reimbursements)
    .set({
      ...(d.category !== undefined ? { category: d.category } : {}),
      ...(d.amount !== undefined ? { amount: String(d.amount) } : {}),
      ...(d.date !== undefined ? { date: d.date } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.vat !== undefined ? { vat: d.vat } : {}),
      ...(d.costCenter !== undefined ? { costCenter: d.costCenter } : {}),
      ...(d.paymentMethod !== undefined ? { paymentMethod: d.paymentMethod } : {}),
      ...(d.currency !== undefined ? { currency: d.currency } : {}),
      updatedAt: new Date(),
    })
    .where(eq(reimbursements.id, reimbId))
    .returning({ id: reimbursements.id });

  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/reimbursements/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const reimbId = parseId(id);
  if (reimbId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(reimbursements)
    .where(eq(reimbursements.id, reimbId))
    .returning({ id: reimbursements.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
