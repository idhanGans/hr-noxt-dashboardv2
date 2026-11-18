import { NextResponse } from "next/server";
import { eq, type SQL } from "drizzle-orm";

import { getDb } from "@/db/client";
import { complianceTrainings } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/trainings — compliance trainings. Manager/admin all; staff own.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const onlyOwn: SQL | undefined =
    auth.role === "staff" ? eq(complianceTrainings.employeeId, auth.employeeId) : undefined;

  const rows = await db
    .select()
    .from(complianceTrainings)
    .where(onlyOwn)
    .orderBy(complianceTrainings.id);
  const items = rows.map((tr) => ({
    id: String(tr.id),
    employeeId: String(tr.employeeId),
    name: tr.name,
    dueDate: tr.dueDate ?? "",
    status: tr.status,
  }));
  return NextResponse.json({ items });
}
