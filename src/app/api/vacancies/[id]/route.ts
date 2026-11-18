import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { candidates, departments, vacancies } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type Funnel, type VacancyRow, shapeVacancy, vacancyWriteSchema } from "@/lib/api/recruitment";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/vacancies/[id] — manager/admin.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Recruiting nur fuer Manager/Admin" }, { status: 403 });
  }

  const { id } = await params;
  const vacancyId = parseId(id);
  if (vacancyId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: VacancyRow[] = await db
    .select({ v: vacancies, department: departments.name })
    .from(vacancies)
    .leftJoin(departments, eq(vacancies.departmentId, departments.id))
    .where(eq(vacancies.id, vacancyId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const cands = await db
    .select({ stage: candidates.stage, source: candidates.source })
    .from(candidates)
    .where(eq(candidates.vacancyId, vacancyId));

  const funnel: Funnel = { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0 };
  const sources = new Map<string, number>();
  for (const c of cands) {
    if (c.stage in funnel) funnel[c.stage as keyof Funnel] += 1;
    if (c.source) sources.set(c.source, (sources.get(c.source) ?? 0) + 1);
  }
  const sourceMix = Array.from(sources.entries()).map(([source, count]) => ({ source, count }));

  return NextResponse.json(shapeVacancy(rows[0], cands.length, funnel, sourceMix));
}

// PATCH /api/vacancies/[id] — update fields (manager only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const vacancyId = parseId(id);
  if (vacancyId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = vacancyWriteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const db = getDb();
  const set: Partial<typeof vacancies.$inferInsert> = { updatedAt: new Date() };
  if (d.title !== undefined) set.title = d.title;
  if (d.department !== undefined) {
    const [dep] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.name, d.department ?? ""))
      .limit(1);
    set.departmentId = dep?.id ?? null;
  }
  if (d.location !== undefined) set.location = d.location;
  if (d.type !== undefined) set.type = d.type;
  if (d.status !== undefined) set.status = d.status;
  if (d.openedAt !== undefined) set.openedAt = d.openedAt || null;
  if (d.hiringManager !== undefined) set.hiringManager = d.hiringManager;
  if (d.recruiter !== undefined) set.recruiter = d.recruiter;
  if (d.requiredStartDate !== undefined) set.requiredStartDate = d.requiredStartDate || null;
  if (d.costCenter !== undefined) set.costCenter = d.costCenter;
  if (d.priority !== undefined) set.priority = d.priority;
  if (d.workplaceModel !== undefined) set.workplaceModel = d.workplaceModel;
  if (d.salaryMin !== undefined) set.salaryMin = String(d.salaryMin);
  if (d.salaryMax !== undefined) set.salaryMax = String(d.salaryMax);

  const updated = await db
    .update(vacancies)
    .set(set)
    .where(eq(vacancies.id, vacancyId))
    .returning({ id: vacancies.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/vacancies/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const vacancyId = parseId(id);
  if (vacancyId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(vacancies)
    .where(eq(vacancies.id, vacancyId))
    .returning({ id: vacancies.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
