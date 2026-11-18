import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { contractTemplates, contracts, employees } from "@/db/schema";
// (contractTemplates used below to resolve templateName -> id)
import { getAuthContext } from "@/lib/api/auth";
import {
  canSeeSalary,
  type ContractRow,
  contractWriteSchema,
  shapeContract,
} from "@/lib/api/contracts";
import { isForeignKeyViolation } from "@/lib/api/employees";

export const dynamic = "force-dynamic";

const SELECT = {
  c: contracts,
  employeeCode: employees.code,
  firstName: employees.firstName,
  lastName: employees.lastName,
  templateName: contractTemplates.name,
};

// GET /api/contracts — manager/admin all; staff only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(contracts.employeeId, auth.employeeId) : undefined;

  const rows: ContractRow[] = await db
    .select(SELECT)
    .from(contracts)
    .leftJoin(employees, eq(contracts.employeeId, employees.id))
    .leftJoin(contractTemplates, eq(contracts.templateId, contractTemplates.id))
    .where(onlyOwn)
    .orderBy(contracts.id);

  const showSalary = canSeeSalary(auth.role);
  return NextResponse.json({ items: rows.map((r) => shapeContract(r, showSalary)) });
}

// POST /api/contracts — create a contract (manager only). employeeId is a code.
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

  const parsed = contractWriteSchema.safeParse(body);
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

  // resolve template by id or (fallback) by name
  let templateId = d.templateId ?? null;
  if (templateId == null && d.templateName) {
    const [tpl] = await db
      .select({ id: contractTemplates.id })
      .from(contractTemplates)
      .where(eq(contractTemplates.name, d.templateName))
      .limit(1);
    templateId = tpl?.id ?? null;
  }

  try {
    const [created] = await db
      .insert(contracts)
      .values({
        employeeId: emp.id,
        jobTitle: d.jobTitle,
        type: d.type,
        status: d.status ?? "active",
        startDate: d.startDate,
        endDate: d.endDate ?? null,
        salary: String(d.salary),
        hoursPerWeek: d.hoursPerWeek != null ? String(d.hoursPerWeek) : null,
        noticePeriodWeeks: d.noticePeriodWeeks ?? null,
        templateId,
        signedAt: d.signedAt ? new Date(d.signedAt) : null,
      })
      .returning({ id: contracts.id });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: "Unbekanntes Template (templateId)" }, { status: 409 });
    }
    throw err;
  }
}
