import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, payslipLines, payslips } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { isForeignKeyViolation } from "@/lib/api/employees";
import {
  canSeeAmounts,
  type PayslipRow,
  payslipWriteSchema,
  shapePayslip,
} from "@/lib/api/payslips";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/payslips/[id] — manager/admin any (admin without amounts);
// staff only their own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const payslipId = parseId(id);
  if (payslipId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const rows: PayslipRow[] = await db
    .select({
      ps: payslips,
      employeeCode: employees.code,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(payslips)
    .leftJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.id, payslipId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  const row = rows[0];

  if (auth.role === "staff" && row.ps.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "Nur die eigenen Abrechnungen" }, { status: 403 });
  }

  const lines = await db
    .select()
    .from(payslipLines)
    .where(eq(payslipLines.payslipId, payslipId));

  return NextResponse.json(shapePayslip(row, lines, canSeeAmounts(auth.role)));
}

// PATCH /api/payslips/[id] — update scalar fields. Access: manager only.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const payslipId = parseId(id);
  if (payslipId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  // lines + employee are set at creation; PATCH updates scalar fields only.
  const parsed = payslipWriteSchema
    .omit({ lines: true, employeeId: true })
    .partial()
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const data = parsed.data;

  const setValues: Partial<typeof payslips.$inferInsert> = { updatedAt: new Date() };
  if (data.period !== undefined) setValues.period = data.period;
  if (data.gross !== undefined) setValues.gross = String(data.gross);
  if (data.net !== undefined) setValues.net = String(data.net);
  if (data.tax !== undefined) setValues.tax = String(data.tax);
  if (data.status !== undefined) setValues.status = data.status;

  const db = getDb();
  try {
    const updated = await db
      .update(payslips)
      .set(setValues)
      .where(eq(payslips.id, payslipId))
      .returning({ id: payslips.id });
    if (updated.length === 0) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ id: updated[0].id });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json({ error: "Unbekannter Mitarbeiter (employeeId)" }, { status: 409 });
    }
    throw err;
  }
}

// DELETE /api/payslips/[id]. Access: manager only. Lines cascade.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const payslipId = parseId(id);
  if (payslipId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(payslips)
    .where(eq(payslips.id, payslipId))
    .returning({ id: payslips.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
