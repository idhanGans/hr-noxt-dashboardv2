import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { helpdeskTickets } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { ticketWriteSchema, shapeTicket } from "@/lib/api/tickets";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

// GET /api/tickets/[id] — manager/admin.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Helpdesk nur fuer Manager/Admin" }, { status: 403 });
  }

  const { id } = await params;
  const ticketId = parseId(id);
  if (ticketId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(helpdeskTickets)
    .where(eq(helpdeskTickets.id, ticketId))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json(shapeTicket(row));
}

// PATCH /api/tickets/[id] — update status/assignee/etc. (manager only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Aendern nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const ticketId = parseId(id);
  if (ticketId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }

  const parsed = ticketWriteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const set: Partial<typeof helpdeskTickets.$inferInsert> = { updatedAt: new Date() };
  if (d.subject !== undefined) set.subject = d.subject;
  if (d.requester !== undefined) set.requester = d.requester;
  if (d.assignee !== undefined) set.assignee = d.assignee;
  if (d.category !== undefined) set.category = d.category;
  if (d.priority !== undefined) set.priority = d.priority;
  if (d.status !== undefined) set.status = d.status;

  const db = getDb();
  const updated = await db
    .update(helpdeskTickets)
    .set(set)
    .where(eq(helpdeskTickets.id, ticketId))
    .returning({ id: helpdeskTickets.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id });
}

// DELETE /api/tickets/[id] — manager only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role !== "manager") {
    return NextResponse.json({ error: "Loeschen nur fuer Manager" }, { status: 403 });
  }

  const { id } = await params;
  const ticketId = parseId(id);
  if (ticketId === null) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(helpdeskTickets)
    .where(eq(helpdeskTickets.id, ticketId))
    .returning({ id: helpdeskTickets.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
