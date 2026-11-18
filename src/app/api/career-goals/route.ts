import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { careerGoals } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/career-goals — manager/admin all; staff only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(careerGoals.employeeId, auth.employeeId) : undefined;

  const rows = await db.select().from(careerGoals).where(onlyOwn).orderBy(careerGoals.id);
  const items = rows.map((g) => ({
    id: String(g.id),
    employeeId: String(g.employeeId),
    title: g.title,
    progress: g.progress,
    lastUpdate: g.lastUpdate ?? "",
  }));
  return NextResponse.json({ items });
}
