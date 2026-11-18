import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { accessUpdateSchema } from "@/lib/api/access";
import { isUniqueViolation } from "@/lib/api/employees";

export const dynamic = "force-dynamic";

function canManageAccess(role: string): boolean {
  return role === "manager";
}

// PATCH /api/access/[id] — Rolle aendern und/oder Login setzen/entziehen.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (!canManageAccess(auth.role)) {
    return NextResponse.json({ error: "Nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId)) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = accessUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // Selbst-Aussperrung verhindern: eigene Rolle nicht herabstufen, eigenen Login nicht entziehen.
  if (employeeId === auth.employeeId) {
    if (parsed.data.role && parsed.data.role !== "manager") {
      return NextResponse.json(
        { error: "Eigene Manager-Rolle kann nicht herabgestuft werden" },
        { status: 409 },
      );
    }
    if (parsed.data.authUser === null) {
      return NextResponse.json(
        { error: "Eigener Zugang kann nicht entzogen werden" },
        { status: 409 },
      );
    }
  }

  const patch: { role?: "manager" | "admin" | "staff"; authUser?: string | null } = {};
  if (parsed.data.role !== undefined) patch.role = parsed.data.role;
  if (parsed.data.authUser !== undefined) patch.authUser = parsed.data.authUser;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nichts zu aendern" }, { status: 400 });
  }

  const db = getDb();
  try {
    const [updated] = await db
      .update(employees)
      .set(patch)
      .where(eq(employees.id, employeeId))
      .returning({ id: employees.id });
    if (!updated) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ id: updated.id });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "Plattform-Login bereits vergeben" }, { status: 409 });
    }
    throw err;
  }
}

// DELETE /api/access/[id] — Login entziehen (Person bleibt als Mitarbeiter erhalten).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (!canManageAccess(auth.role)) {
    return NextResponse.json({ error: "Nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId)) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }
  if (employeeId === auth.employeeId) {
    return NextResponse.json(
      { error: "Eigener Zugang kann nicht entzogen werden" },
      { status: 409 },
    );
  }

  const db = getDb();
  const [updated] = await db
    .update(employees)
    .set({ authUser: null })
    .where(eq(employees.id, employeeId))
    .returning({ id: employees.id });
  if (!updated) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json({ id: updated.id, revoked: true });
}
