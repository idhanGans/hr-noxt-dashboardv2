import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { candidates, departments } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type CandidateRow, candidateWriteSchema, shapeCandidate } from "@/lib/api/recruitment";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/candidates/[id] — manager/admin.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Recruiting nur fuer Manager/Admin" }, { status: 403 });
  }

  const { id } = await params;
  const candidateId = parseId(id);
  if (candidateId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: CandidateRow[] = await db
    .select({ c: candidates, department: departments.name })
    .from(candidates)
    .leftJoin(departments, eq(candidates.departmentId, departments.id))
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json(shapeCandidate(rows[0]));
}

// PATCH /api/candidates/[id] — update (e.g. move pipeline stage). Manager only.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const candidateId = parseId(id);
  if (candidateId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = candidateWriteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const db = getDb();
  const set: Partial<typeof candidates.$inferInsert> = { updatedAt: new Date() };
  if (d.name !== undefined) set.name = d.name;
  if (d.email !== undefined) set.email = d.email;
  if (d.role !== undefined) set.role = d.role;
  if (d.location !== undefined) set.location = d.location;
  if (d.vacancyId !== undefined) set.vacancyId = d.vacancyId;
  if (d.stage !== undefined) set.stage = d.stage;
  if (d.rating !== undefined) set.rating = d.rating;
  if (d.source !== undefined) set.source = d.source;
  if (d.appliedAt !== undefined) set.appliedAt = d.appliedAt || null;
  if (d.resumeUrl !== undefined) set.resumeUrl = d.resumeUrl;
  if (d.department !== undefined) {
    const [dep] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.name, d.department ?? ""))
      .limit(1);
    set.departmentId = dep?.id ?? null;
  }

  const updated = await db
    .update(candidates)
    .set(set)
    .where(eq(candidates.id, candidateId))
    .returning({ id: candidates.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/candidates/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const candidateId = parseId(id);
  if (candidateId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(candidates)
    .where(eq(candidates.id, candidateId))
    .returning({ id: candidates.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
