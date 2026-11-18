import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { departments, employees, titles } from "@/db/schema";
import { getAuthContext, stripSensitiveEmployee } from "@/lib/api/auth";
import { employeeWriteSchema, isUniqueViolation, resolveEmployeeRefs } from "@/lib/api/employees";

export const dynamic = "force-dynamic";

// GET /api/employees — list all employees (with department + title names).
// Access: manager + admin. Staff may only see their own record (use /[id]).
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Mitarbeiterliste nur fuer Manager/Admin" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select({ emp: employees, department: departments.name, title: titles.name })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(titles, eq(employees.titleId, titles.id))
    .orderBy(employees.id);

  const items = rows.map((r) =>
    stripSensitiveEmployee({ ...r.emp, department: r.department, title: r.title }, auth.role),
  );

  return NextResponse.json({ items });
}

// POST /api/employees — create a new employee. Access: manager only.
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

  const parsed = employeeWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const d = parsed.data;
  const db = getDb();
  const refs = await resolveEmployeeRefs(d);

  try {
    const [created] = await db
      .insert(employees)
      .values({
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        jobTitle: d.jobTitle,
        location: d.location,
        employmentType: d.employmentType,
        status: d.status ?? "onboarding",
        hireDate: d.hireDate,
        salary: String(d.salary),
        performanceScore: d.performanceScore ?? 75,
        role: d.role ?? "staff",
        ...refs,
        dateOfBirth: d.dateOfBirth || null,
        gender: d.gender ?? null,
        nationality: d.nationality ?? null,
        phone: d.phone ?? null,
        addressStreet: d.addressStreet ?? null,
        addressZip: d.addressZip ?? null,
        addressCity: d.addressCity ?? null,
        addressCountry: d.addressCountry ?? null,
        contractType: d.contractType ?? null,
        contractStart: d.contractStart || null,
        contractEnd: d.contractEnd || null,
        probationEnd: d.probationEnd || null,
        weeklyHours: d.weeklyHours != null ? String(d.weeklyHours) : null,
        vacationEntitlement: d.vacationEntitlement ?? null,
        noticePeriod: d.noticePeriod ?? null,
        workplaceModel: d.workplaceModel ?? null,
        taxId: d.taxId ?? null,
        socialSecurityNo: d.socialSecurityNo ?? null,
        taxClass: d.taxClass ?? null,
        children: d.children ?? null,
        religion: d.religion ?? null,
        healthInsuranceType: d.healthInsuranceType ?? null,
        healthInsuranceProvider: d.healthInsuranceProvider ?? null,
        iban: d.iban ?? null,
        bic: d.bic ?? null,
        costCenter: d.costCenter ?? null,
        bonusTargetPct: d.bonusTargetPct != null ? String(d.bonusTargetPct) : null,
      })
      .returning({ id: employees.id });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });
    }
    throw err;
  }
}
