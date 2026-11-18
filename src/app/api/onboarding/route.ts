import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees, onboardingTasks } from "@/db/schema";
import { getAuthContext } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// Loest Mitarbeiter-Code ("EMP-0007") ODER numerische ID zur numerischen ID auf.
async function resolveEmployeeId(idOrCode: string | number): Promise<number | null> {
  const s = String(idOrCode).trim();
  const n = Number(s);
  if (s !== "" && Number.isInteger(n)) return n;
  const db = getDb();
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, s))
    .limit(1);
  return row?.id ?? null;
}

// GET /api/onboarding — Abhak-Zustand aller Onboarding-Aufgaben.
// Manager/Admin sehen alle, Staff nur die eigenen.
export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  const db = getDb();
  const rows = await db
    .select({
      empId: onboardingTasks.employeeId,
      code: employees.code,
      taskIndex: onboardingTasks.taskIndex,
      done: onboardingTasks.done,
    })
    .from(onboardingTasks)
    .leftJoin(employees, eq(onboardingTasks.employeeId, employees.id));

  const visible = auth.role === "staff" ? rows.filter((r) => r.empId === auth.employeeId) : rows;
  return NextResponse.json({
    items: visible.map((r) => ({
      employeeId: r.code ?? String(r.empId),
      taskIndex: r.taskIndex,
      done: r.done,
    })),
  });
}

// POST /api/onboarding — eine Aufgabe abhaken/zuruecksetzen (Manager only).
// Upsert je (Mitarbeiter, Aufgaben-Index).
export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  if (auth.role !== "manager") return NextResponse.json({ error: "Nur fuer Manager" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiges JSON" }, { status: 400 });
  }
  const { employeeId, taskIndex, done } = (body ?? {}) as {
    employeeId?: unknown;
    taskIndex?: unknown;
    done?: unknown;
  };
  if (typeof taskIndex !== "number" || !Number.isInteger(taskIndex) || taskIndex < 0) {
    return NextResponse.json({ error: "Ungueltiger taskIndex" }, { status: 422 });
  }
  if (typeof done !== "boolean") {
    return NextResponse.json({ error: "done muss boolean sein" }, { status: 422 });
  }
  if (employeeId == null || (typeof employeeId !== "string" && typeof employeeId !== "number")) {
    return NextResponse.json({ error: "employeeId fehlt" }, { status: 422 });
  }

  const empId = await resolveEmployeeId(employeeId);
  if (empId == null) {
    return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
  }

  const db = getDb();
  await db
    .insert(onboardingTasks)
    .values({ employeeId: empId, taskIndex, done })
    .onConflictDoUpdate({
      target: [onboardingTasks.employeeId, onboardingTasks.taskIndex],
      set: { done, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
