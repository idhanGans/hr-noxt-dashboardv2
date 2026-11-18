import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { skills } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/skills — manager/admin all; staff only their own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(skills.employeeId, auth.employeeId) : undefined;

  const rows = await db.select().from(skills).where(onlyOwn).orderBy(skills.id);
  const items = rows.map((s) => ({
    id: String(s.id),
    employeeId: String(s.employeeId),
    name: s.name,
    category: s.category,
    expiresAt: s.expiresAt ?? undefined,
  }));
  return NextResponse.json({ items });
}
