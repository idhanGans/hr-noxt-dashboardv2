import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// POST /api/notifications/[id]/read — mark a notification read (any logged-in user).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { id } = await params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId)) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const db = getDb();
  const updated = await db
    .update(notifications)
    .set({ read: true, updatedAt: new Date() })
    .where(eq(notifications.id, notificationId))
    .returning({ id: notifications.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ id: updated[0].id, read: true });
}
