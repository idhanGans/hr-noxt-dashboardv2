import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { titles } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/api/employees";

export const dynamic = "force-dynamic";

// PATCH /api/titles/[id] — umbenennen (Manager only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (auth.role !== "manager") return NextResponse.json({ error: "Nur fuer Manager" }, { status: 403 });

  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

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
    const [updated] = await db
      .update(titles)
      .set({ name })
      .where(eq(titles.id, n))
      .returning({ id: titles.id });
    if (!updated) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ id: updated.id, name });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: "Name bereits vergeben" }, { status: 409 });
    throw e;
  }
}

// DELETE /api/titles/[id] — Manager only. 409 wenn noch in Verwendung.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (auth.role !== "manager") return NextResponse.json({ error: "Nur fuer Manager" }, { status: 403 });

  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const db = getDb();
  try {
    const [deleted] = await db.delete(titles).where(eq(titles.id, n)).returning({ id: titles.id });
    if (!deleted) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ id: deleted.id });
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      return NextResponse.json({ error: "Titel wird noch von Mitarbeitenden genutzt" }, { status: 409 });
    }
    throw e;
  }
}
