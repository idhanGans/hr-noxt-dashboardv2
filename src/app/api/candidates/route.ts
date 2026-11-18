import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { candidates, departments } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type CandidateRow, candidateWriteSchema, shapeCandidate } from "@/lib/api/recruitment";

export const dynamic = "force-dynamic";

const SELECT = { c: candidates, department: departments.name };

// GET /api/candidates — manager/admin (applicant PII).
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Recruiting nur fuer Manager/Admin" }, { status: 403 });
  }

  const db = getDb();
  const rows: CandidateRow[] = await db
    .select(SELECT)
    .from(candidates)
    .leftJoin(departments, eq(candidates.departmentId, departments.id))
    .orderBy(candidates.id);

  return NextResponse.json({ items: rows.map(shapeCandidate) });
}

// POST /api/candidates — add a candidate (manager only).
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

  const parsed = candidateWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const db = getDb();
  let departmentId: number | null = null;
  if (d.department) {
    const [dep] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.name, d.department))
      .limit(1);
    departmentId = dep?.id ?? null;
  }

  const [created] = await db
    .insert(candidates)
    .values({
      name: d.name,
      email: d.email ?? null,
      role: d.role ?? null,
      departmentId,
      location: d.location ?? null,
      vacancyId: d.vacancyId ?? null,
      stage: d.stage ?? "applied",
      rating: d.rating ?? null,
      source: d.source ?? null,
      appliedAt: d.appliedAt ?? null,
      resumeUrl: d.resumeUrl ?? null,
    })
    .returning({ id: candidates.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
