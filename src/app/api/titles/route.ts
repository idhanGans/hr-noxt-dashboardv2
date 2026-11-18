import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { titles } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { isUniqueViolation } from "@/lib/api/employees";

export const dynamic = "force-dynamic";

// GET /api/titles — Liste (alle eingeloggten Nutzer).
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  const db = getDb();
  const rows = await db.select().from(titles).orderBy(titles.name);
  return NextResponse.json({ items: rows });
}

// POST /api/titles — neuer Titel (Manager only).
export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (auth.role !== "manager") return NextResponse.json({ error: "Nur fuer Manager" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }
  const name = typeof (body as { name?: unknown })?.name === "string" ? (body as { name: string }).name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name fehlt" }, { status: 422 });

  const db = getDb();
  try {
    const [created] = await db.insert(titles).values({ name }).returning({ id: titles.id });
    return NextResponse.json({ id: created.id, name }, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: "Name bereits vergeben" }, { status: 409 });
    throw e;
  }
}
