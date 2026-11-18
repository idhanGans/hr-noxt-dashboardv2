import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { candidates, departments, vacancies } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import {
  type Funnel,
  type VacancyRow,
  shapeVacancy,
  vacancyWriteSchema,
} from "@/lib/api/recruitment";

export const dynamic = "force-dynamic";

function emptyFunnel(): Funnel {
  return { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0 };
}

// GET /api/vacancies — list with applicants/funnel/sourceMix computed from
// the linked candidates. Access: manager/admin.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Recruiting nur fuer Manager/Admin" }, { status: 403 });
  }

  const db = getDb();
  const rows: VacancyRow[] = await db
    .select({ v: vacancies, department: departments.name })
    .from(vacancies)
    .leftJoin(departments, eq(vacancies.departmentId, departments.id))
    .orderBy(vacancies.id);

  const cands = await db
    .select({
      vacancyId: candidates.vacancyId,
      stage: candidates.stage,
      source: candidates.source,
    })
    .from(candidates);

  // aggregate candidates per vacancy
  const agg = new Map<number, { applicants: number; funnel: Funnel; sources: Map<string, number> }>();
  for (const c of cands) {
    if (c.vacancyId == null) continue;
    let a = agg.get(c.vacancyId);
    if (!a) {
      a = { applicants: 0, funnel: emptyFunnel(), sources: new Map() };
      agg.set(c.vacancyId, a);
    }
    a.applicants += 1;
    if (c.stage in a.funnel) a.funnel[c.stage as keyof Funnel] += 1;
    if (c.source) a.sources.set(c.source, (a.sources.get(c.source) ?? 0) + 1);
  }

  const items = rows.map((r) => {
    const a = agg.get(r.v.id);
    const sourceMix = a
      ? Array.from(a.sources.entries()).map(([source, count]) => ({ source, count }))
      : [];
    return shapeVacancy(r, a?.applicants ?? 0, a?.funnel ?? emptyFunnel(), sourceMix);
  });

  return NextResponse.json({ items });
}

// POST /api/vacancies — create a vacancy (manager only).
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

  const parsed = vacancyWriteSchema.safeParse(body);
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
    .insert(vacancies)
    .values({
      title: d.title,
      departmentId,
      location: d.location ?? null,
      type: d.type,
      status: d.status ?? "open",
      openedAt: d.openedAt ?? null,
      hiringManager: d.hiringManager ?? null,
      recruiter: d.recruiter ?? null,
      requiredStartDate: d.requiredStartDate ?? null,
      costCenter: d.costCenter ?? null,
      priority: d.priority ?? null,
      workplaceModel: d.workplaceModel ?? null,
      salaryMin: d.salaryMin != null ? String(d.salaryMin) : null,
      salaryMax: d.salaryMax != null ? String(d.salaryMax) : null,
      currency: d.salaryMin != null || d.salaryMax != null ? "EUR" : null,
    })
    .returning({ id: vacancies.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
