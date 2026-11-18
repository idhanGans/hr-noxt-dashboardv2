import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { departments, employees, titles } from "@/db/schema";
import { getAuthContext, stripSensitiveEmployee } from "@/lib/api/auth";
import {
  buildEmployeeColumns,
  employeeWriteSchema,
  isForeignKeyViolation,
  isUniqueViolation,
  resolveEmployeeRefs,
} from "@/lib/api/employees";

export const dynamic = "force-dynamic";

// Akzeptiert sowohl die numerische DB-ID als auch den Code (z. B. "EMP-OP",
// "EMP-0007") — das Frontend verwendet den Code als ID.
async function resolveEmployeeId(id: string): Promise<number | null> {
  const n = Number(id);
  if (Number.isInteger(n)) return n;
  const db = getDb();
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, id))
    .limit(1);
  return row?.id ?? null;
}

// GET /api/employees/[id] — one employee.
// Access: manager + admin see anyone; staff may see only their own record.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = await resolveEmployeeId(id);
  if (employeeId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  if (auth.role === "staff" && auth.employeeId !== employeeId) {
    return NextResponse.json({ error: "Nur der eigene Datensatz" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select({ emp: employees, department: departments.name, title: titles.name })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(titles, eq(employees.titleId, titles.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const row = rows[0];
  const employee = stripSensitiveEmployee(
    { ...row.emp, department: row.department, title: row.title },
    auth.role,
  );

  return NextResponse.json(employee);
}

// PATCH /api/employees/[id] — update fields.
// Manager: alles. Eigener Datensatz (Self-Service): nur unkritische Felder.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = await resolveEmployeeId(id);
  if (employeeId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const isSelf = auth.employeeId === employeeId;
  if (auth.role !== "manager" && !isSelf) {
    return NextResponse.json(
      { error: "Aendern nur fuer Manager oder den eigenen Datensatz" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = employeeWriteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // Nicht-Manager (Self-Service) duerfen sensible Felder NICHT aendern.
  if (auth.role !== "manager") {
    const d = parsed.data as Record<string, unknown>;
    for (const k of [
      "salary",
      "role",
      "performanceScore",
      "status",
      "department",
      "title",
      "managerId",
      "bonusTargetPct",
      "costCenter",
    ]) {
      delete d[k];
    }
  }

  const db = getDb();
  const refs = await resolveEmployeeRefs(parsed.data);
  try {
    const updated = await db
      .update(employees)
      .set({ ...buildEmployeeColumns(parsed.data, refs), updatedAt: new Date() })
      .where(eq(employees.id, employeeId))
      .returning({ id: employees.id });
    if (updated.length === 0) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ id: updated[0].id });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });
    }
    throw err;
  }
}

// DELETE /api/employees/[id]. Access: manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = await resolveEmployeeId(id);
  if (employeeId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  try {
    const deleted = await db
      .delete(employees)
      .where(eq(employees.id, employeeId))
      .returning({ id: employees.id });
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json(
        { error: "Mitarbeiter ist noch verknuepft (z. B. als Manager)" },
        { status: 409 },
      );
    }
    throw err;
  }
}
