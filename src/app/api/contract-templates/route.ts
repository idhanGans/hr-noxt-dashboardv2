import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { contractTemplates } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/contract-templates — the contract template catalogue (any logged-in user).
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db.select().from(contractTemplates).orderBy(contractTemplates.id);

  const items = rows.map((t) => ({
    id: String(t.id),
    name: t.name,
    type: t.type,
    description: t.description ?? "",
    hoursPerWeek: t.hoursPerWeek != null ? Number(t.hoursPerWeek) : 0,
    noticePeriodWeeks: t.noticePeriodWeeks ?? 0,
    clauses: t.clauses ?? [],
  }));
  return NextResponse.json({ items });
}
