import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { activityLog } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/activity — recent activity feed (manager/admin).
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  if (auth.role === "staff") {
    return NextResponse.json({ error: "Aktivitaet nur fuer Manager/Admin" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db.select().from(activityLog).orderBy(activityLog.id);
  const items = rows.map((a) => ({
    id: String(a.id),
    actor: a.actor,
    action: a.action,
    target: a.target ?? "",
    timestamp: a.eventAt ? a.eventAt.toISOString() : "",
    type: a.type,
  }));
  return NextResponse.json({ items });
}
