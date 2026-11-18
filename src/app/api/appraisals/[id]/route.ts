import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { appraisals, employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type AppraisalRow, appraisalWriteSchema, shapeAppraisal } from "@/lib/api/appraisals";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/appraisals/[id] — manager/admin any; staff only their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const appraisalId = parseId(id);
  if (appraisalId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: AppraisalRow[] = await db
    .select({
      ap: appraisals,
      employeeCode: employees.code,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(appraisals)
    .leftJoin(employees, eq(appraisals.employeeId, employees.id))
    .where(eq(appraisals.id, appraisalId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (auth.role === "staff" && rows[0].ap.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "Nur die eigenen Beurteilungen" }, { status: 403 });
  }
  return NextResponse.json(shapeAppraisal(rows[0]));
}

// PATCH /api/appraisals/[id] — update (manager only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const appraisalId = parseId(id);
  if (appraisalId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = appraisalWriteSchema.omit({ employeeId: true }).partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const set: Partial<typeof appraisals.$inferInsert> = { updatedAt: new Date() };
  if (d.quarter !== undefined) set.quarter = d.quarter;
  if (d.overallRating !== undefined) set.overallRating = d.overallRating;
  if (d.comment !== undefined) set.comment = d.comment;
  if (d.status !== undefined) set.status = d.status;
  if (d.scoreFachkompetenz !== undefined) set.scoreFachkompetenz = d.scoreFachkompetenz;
  if (d.scoreZusammenarbeit !== undefined) set.scoreZusammenarbeit = d.scoreZusammenarbeit;
  if (d.scoreKommunikation !== undefined) set.scoreKommunikation = d.scoreKommunikation;
  if (d.scoreEigeninitiative !== undefined) set.scoreEigeninitiative = d.scoreEigeninitiative;

  const db = getDb();
  const updated = await db
    .update(appraisals)
    .set(set)
    .where(eq(appraisals.id, appraisalId))
    .returning({ id: appraisals.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/appraisals/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const appraisalId = parseId(id);
  if (appraisalId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(appraisals)
    .where(eq(appraisals.id, appraisalId))
    .returning({ id: appraisals.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
