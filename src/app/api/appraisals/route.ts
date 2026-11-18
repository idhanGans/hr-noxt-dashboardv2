import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { appraisals, employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { type AppraisalRow, appraisalWriteSchema, shapeAppraisal } from "@/lib/api/appraisals";

export const dynamic = "force-dynamic";

const SELECT = {
  ap: appraisals,
  employeeCode: employees.code,
  firstName: employees.firstName,
  lastName: employees.lastName,
};

// GET /api/appraisals — manager/admin all; staff only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(appraisals.employeeId, auth.employeeId) : undefined;

  const rows: AppraisalRow[] = await db
    .select(SELECT)
    .from(appraisals)
    .leftJoin(employees, eq(appraisals.employeeId, employees.id))
    .where(onlyOwn)
    .orderBy(appraisals.id);

  return NextResponse.json({ items: rows.map(shapeAppraisal) });
}

// POST /api/appraisals — create an appraisal (manager only). employeeId is a code.
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

  const parsed = appraisalWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const db = getDb();
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, d.employeeId))
    .limit(1);
  if (!emp) {
    return NextResponse.json({ error: "Unbekannter Mitarbeiter (employeeId)" }, { status: 409 });
  }

  const [created] = await db
    .insert(appraisals)
    .values({
      employeeId: emp.id,
      quarter: d.quarter,
      overallRating: d.overallRating,
      comment: d.comment ?? null,
      status: d.status ?? "completed",
      scoreFachkompetenz: d.scoreFachkompetenz ?? null,
      scoreZusammenarbeit: d.scoreZusammenarbeit ?? null,
      scoreKommunikation: d.scoreKommunikation ?? null,
      scoreEigeninitiative: d.scoreEigeninitiative ?? null,
    })
    .returning({ id: appraisals.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
