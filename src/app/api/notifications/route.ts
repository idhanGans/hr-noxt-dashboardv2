import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications — notification list (any logged-in user).
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db.select().from(notifications).orderBy(notifications.id);
  const items = rows.map((n) => ({
    id: String(n.id),
    title: n.title,
    description: n.description ?? "",
    timestamp: n.eventAt ? n.eventAt.toISOString() : "",
    read: n.read,
    type: n.type,
  }));
  return NextResponse.json({ items });
}
