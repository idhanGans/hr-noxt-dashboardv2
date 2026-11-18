import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { helpdeskTickets } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { ticketWriteSchema, shapeTicket } from "@/lib/api/tickets";

export const dynamic = "force-dynamic";

// GET /api/tickets — helpdesk queue (manager/admin).
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Helpdesk nur fuer Manager/Admin" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db.select().from(helpdeskTickets).orderBy(helpdeskTickets.id);
  return NextResponse.json({ items: rows.map(shapeTicket) });
}

// POST /api/tickets — open a ticket (manager only).
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

  const parsed = ticketWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const db = getDb();
  const [created] = await db
    .insert(helpdeskTickets)
    .values({
      subject: d.subject,
      requester: d.requester,
      assignee: d.assignee ?? null,
      category: d.category,
      priority: d.priority ?? "medium",
      status: d.status ?? "open",
    })
    .returning({ id: helpdeskTickets.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
