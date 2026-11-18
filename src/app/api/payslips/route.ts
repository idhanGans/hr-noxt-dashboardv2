import { NextResponse } from "next/server";
import { eq, inArray, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, payslipLines, payslips } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { isForeignKeyViolation } from "@/lib/api/employees";
import {
  canSeeAmounts,
  type LineRow,
  type PayslipRow,
  payslipWriteSchema,
  shapePayslip,
} from "@/lib/api/payslips";

export const dynamic = "force-dynamic";

// GET /api/payslips — manager/admin see all; staff see only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(payslips.employeeId, auth.employeeId) : undefined;

  const rows: PayslipRow[] = await db
    .select({
      ps: payslips,
      employeeCode: employees.code,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(payslips)
    .leftJoin(employees, eq(payslips.employeeId, employees.id))
    .where(onlyOwn)
    .orderBy(payslips.id);

  const ids = rows.map((r) => r.ps.id);
  const lineRows = ids.length
    ? await db.select().from(payslipLines).where(inArray(payslipLines.payslipId, ids))
    : [];
  const linesByPayslip = new Map<number, LineRow[]>();
  for (const l of lineRows) {
    const arr = linesByPayslip.get(l.payslipId);
    if (arr) arr.push(l);
    else linesByPayslip.set(l.payslipId, [l]);
  }

  const showAmounts = canSeeAmounts(auth.role);
  const items = rows.map((r) =>
    shapePayslip(r, linesByPayslip.get(r.ps.id) ?? [], showAmounts),
  );
  return NextResponse.json({ items });
}

// POST /api/payslips — create a payslip with its lines. Access: manager only.
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

  const parsed = payslipWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { lines, gross, net, tax, employeeId: employeeCode, ...rest } = parsed.data;
  const db = getDb();

  // resolve the employee code (e.g. "EMP-0001") to the numeric FK
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, employeeCode))
    .limit(1);
  if (!emp) {
    return NextResponse.json({ error: "Unbekannter Mitarbeiter (employeeId)" }, { status: 409 });
  }

  try {
    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(payslips)
        .values({
          ...rest,
          employeeId: emp.id,
          gross: String(gross),
          net: String(net),
          tax: String(tax),
        })
        .returning({ id: payslips.id });
      if (lines && lines.length > 0) {
        await tx.insert(payslipLines).values(
          lines.map((l) => ({
            payslipId: created.id,
            label: l.label,
            amount: String(l.amount),
            type: l.type,
          })),
        );
      }
      return created.id;
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: "Unbekannter Mitarbeiter (employeeId)" }, { status: 409 });
    }
    throw err;
  }
}
