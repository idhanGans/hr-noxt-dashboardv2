import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, reimbursements } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import {
  type ReimbursementRow,
  reimbursementCreateSchema,
  shapeReimbursement,
} from "@/lib/api/reimbursements";

export const dynamic = "force-dynamic";

const SELECT = {
  rb: reimbursements,
  employeeCode: employees.code,
  firstName: employees.firstName,
  lastName: employees.lastName,
};

// GET /api/reimbursements — manager/admin all; staff only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(reimbursements.employeeId, auth.employeeId) : undefined;

  const rows: ReimbursementRow[] = await db
    .select(SELECT)
    .from(reimbursements)
    .leftJoin(employees, eq(reimbursements.employeeId, employees.id))
    .where(onlyOwn)
    .orderBy(reimbursements.id);

  return NextResponse.json({ items: rows.map(shapeReimbursement) });
}

// POST /api/reimbursements — any logged-in employee files their own claim (pending).
export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = reimbursementCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const db = getDb();
  const [created] = await db
    .insert(reimbursements)
    .values({
      employeeId: auth.employeeId,
      category: d.category,
      amount: String(d.amount),
      date: d.date,
      description: d.description ?? null,
      status: "pending",
      vat: d.vat ?? 0,
      costCenter: d.costCenter ?? null,
      receiptUrl: d.receiptUrl ?? null,
      paymentMethod: d.paymentMethod ?? "bank",
      currency: d.currency ?? "EUR",
      submittedAt: new Date(),
    })
    .returning({ id: reimbursements.id });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
