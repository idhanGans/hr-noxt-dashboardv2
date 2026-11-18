import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/kpis — organisation KPIs computed live from the database.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM employees) AS headcount,
      (SELECT coalesce(sum(salary), 0)::float FROM employees) AS salary_sum,
      (SELECT coalesce(round(avg(performance_score)), 0)::int FROM employees) AS avg_perf,
      (SELECT count(*)::int FROM vacancies WHERE status = 'open') AS open_roles,
      (SELECT count(*)::int FROM attendance_records) AS att_total,
      (SELECT count(*)::int FROM attendance_records WHERE status IN ('present', 'remote')) AS att_present
  `);
  const row = (result as unknown as Array<Record<string, number>>)[0] ?? {};

  const headcount = row.headcount ?? 0;
  const payrollMonthly = Math.round((row.salary_sum ?? 0) / 12);
  const openRoles = row.open_roles ?? 0;
  const engagement = row.avg_perf ?? 0;
  const attendancePct = row.att_total ? Math.round(((row.att_present ?? 0) / row.att_total) * 100) : 0;
  // Noch keine Zeitreihe vorhanden -> leerer Trend (KpiCard zeichnet dann keine
  // Sparkline; ein einzelner Punkt wuerde sonst als Kreis erscheinen).
  const trend: { label: string; value: number }[] = [];

  const items = [
    { id: "headcount", label: "Mitarbeitende", value: headcount, format: "number", delta: 0, trend },
    { id: "attendance", label: "Anwesenheit heute", value: attendancePct, format: "percent", delta: 0, trend },
    { id: "openroles", label: "Offene Stellen", value: openRoles, format: "number", delta: 0, trend },
    { id: "payroll", label: "Lohnkosten / Monat", value: payrollMonthly, format: "currency", delta: 0, trend },
    { id: "turnover", label: "Fluktuation (YTD)", value: 0, format: "percent", delta: 0, trend },
    { id: "engagement", label: "Engagement-Score", value: engagement, format: "number", delta: 0, trend },
  ];

  return NextResponse.json({ items });
}
