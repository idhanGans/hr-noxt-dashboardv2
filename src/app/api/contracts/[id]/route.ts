import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { contractTemplates, contracts, employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { canSeeSalary, type ContractRow, contractWriteSchema, shapeContract } from "@/lib/api/contracts";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

const SELECT = {
  c: contracts,
  employeeCode: employees.code,
  firstName: employees.firstName,
  lastName: employees.lastName,
  templateName: contractTemplates.name,
};

// GET /api/contracts/[id] — manager/admin any; staff only their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const contractId = parseId(id);
  if (contractId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: ContractRow[] = await db
    .select(SELECT)
    .from(contracts)
    .leftJoin(employees, eq(contracts.employeeId, employees.id))
    .leftJoin(contractTemplates, eq(contracts.templateId, contractTemplates.id))
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (auth.role === "staff" && rows[0].c.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "Nur die eigenen Vertraege" }, { status: 403 });
  }

  return NextResponse.json(shapeContract(rows[0], canSeeSalary(auth.role)));
}

// PATCH /api/contracts/[id] — update scalar fields (manager only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const contractId = parseId(id);
  if (contractId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = contractWriteSchema.omit({ employeeId: true }).partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const set: Partial<typeof contracts.$inferInsert> = { updatedAt: new Date() };
  if (d.jobTitle !== undefined) set.jobTitle = d.jobTitle;
  if (d.type !== undefined) set.type = d.type;
  if (d.status !== undefined) set.status = d.status;
  if (d.startDate !== undefined) set.startDate = d.startDate;
  if (d.endDate !== undefined) set.endDate = d.endDate ?? null;
  if (d.salary !== undefined) set.salary = String(d.salary);
  if (d.hoursPerWeek !== undefined) set.hoursPerWeek = String(d.hoursPerWeek);
  if (d.noticePeriodWeeks !== undefined) set.noticePeriodWeeks = d.noticePeriodWeeks;
  if (d.templateId !== undefined) set.templateId = d.templateId ?? null;
  if (d.signedAt !== undefined) set.signedAt = d.signedAt ? new Date(d.signedAt) : null;

  const db = getDb();
  const updated = await db
    .update(contracts)
    .set(set)
    .where(eq(contracts.id, contractId))
    .returning({ id: contracts.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/contracts/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const contractId = parseId(id);
  if (contractId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(contracts)
    .where(eq(contracts.id, contractId))
    .returning({ id: contracts.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
