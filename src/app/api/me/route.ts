import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  careerGoals,
  complianceTrainings,
  departments,
  employees,
  skills,
  titles,
} from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

type EmpJoin = {
  emp: typeof employees.$inferSelect;
  department: string | null;
  title: string | null;
};

const flat = (r: EmpJoin) => ({ ...r.emp, department: r.department, title: r.title });

// GET /api/me — the logged-in employee plus their org context (manager,
// skip-level, reports, peers) and self-service data (skills, trainings, goals).
// Employee rows are returned in the same shape as /api/employees items, so the
// client maps them with the shared mapEmployee().
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const db = getDb();
  const empQuery = () =>
    db
      .select({ emp: employees, department: departments.name, title: titles.name })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(titles, eq(employees.titleId, titles.id));

  const meRows: EmpJoin[] = await empQuery().where(eq(employees.id, auth.employeeId)).limit(1);
  if (meRows.length === 0) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }
  const me = meRows[0];

  let manager: EmpJoin | null = null;
  let skipLevel: EmpJoin | null = null;
  if (me.emp.managerId != null) {
    const m: EmpJoin[] = await empQuery().where(eq(employees.id, me.emp.managerId)).limit(1);
    manager = m[0] ?? null;
    if (manager?.emp.managerId != null) {
      const s: EmpJoin[] = await empQuery().where(eq(employees.id, manager.emp.managerId)).limit(1);
      skipLevel = s[0] ?? null;
    }
  }

  const reports: EmpJoin[] = await empQuery()
    .where(eq(employees.managerId, auth.employeeId))
    .orderBy(employees.id)
    .limit(8);

  let peers: EmpJoin[] = [];
  if (me.emp.managerId != null) {
    peers = await empQuery()
      .where(and(eq(employees.managerId, me.emp.managerId), ne(employees.id, auth.employeeId)))
      .orderBy(employees.id)
      .limit(8);
  }

  const mySkills = await db.select().from(skills).where(eq(skills.employeeId, auth.employeeId));
  const myTrainings = await db
    .select()
    .from(complianceTrainings)
    .where(eq(complianceTrainings.employeeId, auth.employeeId));
  const myGoals = await db
    .select()
    .from(careerGoals)
    .where(eq(careerGoals.employeeId, auth.employeeId));

  return NextResponse.json({
    employee: flat(me),
    manager: manager ? flat(manager) : null,
    skipLevel: skipLevel ? flat(skipLevel) : null,
    reports: reports.map(flat),
    peers: peers.map(flat),
    skills: mySkills.map((s) => ({
      id: String(s.id),
      name: s.name,
      category: s.category,
      expiresAt: s.expiresAt ?? undefined,
    })),
    trainings: myTrainings.map((tr) => ({
      id: String(tr.id),
      name: tr.name,
      dueDate: tr.dueDate ?? "",
      status: tr.status,
    })),
    careerGoals: myGoals.map((g) => ({
      id: String(g.id),
      title: g.title,
      progress: g.progress,
      lastUpdate: g.lastUpdate ?? "",
    })),
  });
}
