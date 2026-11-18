import { eq } from "drizzle-orm";

import { DEPARTMENTS, TITLES } from "@/config/options";
import {
  activity as mockActivity,
  contractTemplates as mockContractTemplates,
  contracts as mockContracts,
  employees as mockEmployees,
  assets as mockAssets,
  attendance as mockAttendance,
  candidates as mockCandidates,
  goals as mockGoals,
  leaveRequests as mockLeaveRequests,
  notifications as mockNotifications,
  payslips as mockPayslips,
  reimbursements as mockReimbursements,
  tickets as mockTickets,
  vacancies as mockVacancies,
} from "@/lib/mock/data";

import { getDb } from "./client";
import {
  activityLog,
  appraisals,
  assets,
  attendanceRecords,
  candidates,
  careerGoals,
  complianceTrainings,
  contractTemplates,
  contracts,
  departments,
  employees,
  goals,
  helpdeskTickets,
  leaveRequests,
  notifications,
  overtimeRequests,
  payslipLines,
  payslips,
  reimbursements,
  skills,
  titles,
  vacancies,
} from "./schema";

// Numeric DB columns take strings in Drizzle.
const num = (v: number | undefined | null): string | null =>
  v === undefined || v === null ? null : String(v);

// Each table seeds independently (own empty-check) so new seed steps still run
// on a database that was already partly seeded by an earlier deploy.
export async function seedIfEmpty(): Promise<void> {
  // Auto-seed is OFF by default — the app starts empty. Set SEED_ON_START=true
  // (e.g. via msh_config modes.<mode>.env) to repopulate sample data.
  if (process.env.SEED_ON_START !== "true") {
    console.log("[db] seeding disabled (SEED_ON_START != true)");
    return;
  }
  await seedEmployees();
  await seedPayslips();
  await seedLeaveRequests();
  await seedContractTemplates();
  await seedContracts();
  await seedGoals();
  await seedReimbursements();
  await seedVacancies();
  await seedCandidates();
  await seedAssets();
  await seedTickets();
  await seedAttendance();
  await seedAppraisals();
  await seedActivity();
  await seedNotifications();
  await seedEssData();
  await seedOvertime();
}

// Selbstheilung: stellt sicher, dass der Operator-Account (fuer die
// Authentifizierung zwingend noetig) existiert. Laeuft bei jedem Boot, ist
// idempotent (No-Op, wenn der Operator schon da ist) und legt KEINE Demo-
// Geschaeftsdaten an — nur Abteilungen/Titel (falls leer) + den Operator.
// Hintergrund: Die user-mode Sandbox-DB kann zuruckgesetzt werden; ohne diesen
// Schritt waere die App danach komplett mit 403 gesperrt.
export async function ensureOperator(): Promise<void> {
  const db = getDb();
  const op = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.authUser, "demo_admin"))
    .limit(1);
  if (op.length > 0) return; // Operator vorhanden -> nichts zu tun

  // Lookups nur anlegen, wenn komplett leer (keine vom Nutzer geloeschten
  // Eintraege wieder hereinbringen).
  const deptExisting = await db.select({ id: departments.id }).from(departments).limit(1);
  if (deptExisting.length === 0) {
    await db.insert(departments).values(DEPARTMENTS.map((name) => ({ name }))).onConflictDoNothing();
  }
  const titleExisting = await db.select({ id: titles.id }).from(titles).limit(1);
  if (titleExisting.length === 0) {
    await db.insert(titles).values(TITLES.map((name) => ({ name }))).onConflictDoNothing();
  }

  const deptId = await deptIdMap();
  const titleRows = await db.select({ id: titles.id, name: titles.name }).from(titles);
  const titleId = new Map(titleRows.map((t) => [t.name, t.id]));

  await db.insert(employees).values({
    code: "EMP-OP",
    firstName: "Alex",
    lastName: "Taylor",
    email: "alex.taylor@noxt.io",
    titleId: titleId.get("Manager") ?? null,
    jobTitle: "People Lead",
    departmentId: deptId.get("HR Noxt") ?? null,
    location: "Remote — DE",
    employmentType: "full_time",
    status: "active",
    hireDate: "2024-01-01",
    salary: "0",
    performanceScore: 95,
    role: "manager",
    authUser: "demo_admin",
  });
  console.log("[db] operator account ensured — Authentifizierung wiederhergestellt");
}

async function deptIdMap() {
  const db = getDb();
  const rows = await db.select({ id: departments.id, name: departments.name }).from(departments);
  return new Map(rows.map((d) => [d.name, d.id]));
}

// --- departments + titles + employees -------------------------------------
async function seedEmployees(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: employees.id }).from(employees).limit(1);
  if (existing.length > 0) return;

  // Our DB enforces unique emails; the mock data does not, so dedupe.
  const usedEmails = new Set<string>();
  const uniqueEmail = (base: string, code: string): string => {
    if (!usedEmails.has(base)) {
      usedEmails.add(base);
      return base;
    }
    const [local, domain] = base.split("@");
    const alt = `${local}.${code.toLowerCase()}@${domain}`;
    usedEmails.add(alt);
    return alt;
  };

  await db.transaction(async (tx) => {
    const deptRows = await tx
      .insert(departments)
      .values(DEPARTMENTS.map((name) => ({ name })))
      .returning({ id: departments.id, name: departments.name });
    const titleRows = await tx
      .insert(titles)
      .values(TITLES.map((name) => ({ name })))
      .returning({ id: titles.id, name: titles.name });
    const deptId = new Map(deptRows.map((d) => [d.name, d.id]));
    const titleId = new Map(titleRows.map((t) => [t.name, t.id]));

    const rows: (typeof employees.$inferInsert)[] = [
      {
        code: "EMP-OP",
        firstName: "Alex",
        lastName: "Taylor",
        email: uniqueEmail("alex.taylor@noxt.io", "EMP-OP"),
        titleId: titleId.get("Manager") ?? null,
        jobTitle: "People Lead",
        departmentId: deptId.get("HR Noxt") ?? null,
        location: "Remote — DE",
        employmentType: "full_time",
        status: "active",
        hireDate: "2024-01-01",
        salary: "120000",
        performanceScore: 95,
        role: "manager",
        authUser: "demo_admin",
      },
      ...mockEmployees.map((e) => ({
        code: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: uniqueEmail(e.email, e.id),
        titleId: titleId.get(e.title) ?? null,
        jobTitle: e.jobTitle,
        departmentId: deptId.get(e.department) ?? null,
        location: e.location,
        employmentType: e.employmentType,
        status: e.status,
        hireDate: e.hireDate,
        salary: String(e.salary),
        performanceScore: e.performanceScore,
        role: "staff" as const,
        dateOfBirth: e.dateOfBirth ?? null,
        gender: e.gender ?? null,
        nationality: e.nationality ?? null,
        phone: e.phone ?? null,
        addressStreet: e.address?.street ?? null,
        addressZip: e.address?.zip ?? null,
        addressCity: e.address?.city ?? null,
        addressCountry: e.address?.country ?? null,
        contractType: e.contractType ?? null,
        contractStart: e.contractStart ?? null,
        contractEnd: e.contractEnd ?? null,
        probationEnd: e.probationEnd ?? null,
        weeklyHours: num(e.weeklyHours),
        vacationEntitlement: e.vacationEntitlement ?? null,
        noticePeriod: e.noticePeriod ?? null,
        workplaceModel: e.workplaceModel ?? null,
        taxId: e.taxId ?? null,
        socialSecurityNo: e.socialSecurityNo ?? null,
        taxClass: e.taxClass ?? null,
        children: e.children ?? null,
        religion: e.religion ?? null,
        healthInsuranceType: e.healthInsurance?.type ?? null,
        healthInsuranceProvider: e.healthInsurance?.provider ?? null,
        iban: e.iban ?? null,
        bic: e.bic ?? null,
        costCenter: e.costCenter ?? null,
        bonusTargetPct: num(e.bonusTargetPct),
        probationStatus: e.probationStatus ?? null,
        lastReviewDate: e.lastReviewDate ?? null,
        vacationUsed: e.vacationBalance?.used ?? null,
        vacationTotal: e.vacationBalance?.total ?? null,
        sickDaysYtd: e.sickDaysYtd ?? null,
      })),
    ];

    const inserted = await tx
      .insert(employees)
      .values(rows)
      .returning({ id: employees.id, code: employees.code });
    const idByCode = new Map(inserted.map((r) => [r.code, r.id]));

    for (const e of mockEmployees) {
      const managerId = e.managerId ? (idByCode.get(e.managerId) ?? null) : null;
      const buddyId = e.buddyId ? (idByCode.get(e.buddyId) ?? null) : null;
      if (managerId || buddyId) {
        await tx.update(employees).set({ managerId, buddyId }).where(eq(employees.code, e.id));
      }
    }

    console.log(
      `[db] seeded ${inserted.length} employees, ${deptRows.length} departments, ${titleRows.length} titles`,
    );
  });
}

// --- payslips + payslip_lines ----------------------------------------------
async function seedPayslips(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: payslips.id }).from(payslips).limit(1);
  if (existing.length > 0) return;

  // employee code -> id (employees were seeded in a previous step/deploy)
  const emps = await db.select({ id: employees.id, code: employees.code }).from(employees);
  const empIdByCode = new Map<string, number>();
  for (const e of emps) if (e.code) empIdByCode.set(e.code, e.id);

  await db.transaction(async (tx) => {
    const payslipRows = mockPayslips
      .map((p) => {
        const employeeId = empIdByCode.get(p.employeeId);
        if (employeeId === undefined) return null;
        return {
          code: p.id,
          employeeId,
          period: p.period,
          gross: String(p.gross),
          net: String(p.net),
          tax: String(p.tax),
          status: p.status,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (payslipRows.length === 0) return;

    const inserted = await tx
      .insert(payslips)
      .values(payslipRows)
      .returning({ id: payslips.id, code: payslips.code });
    const payslipIdByCode = new Map(inserted.map((r) => [r.code, r.id]));

    const lineRows = mockPayslips.flatMap((p) => {
      const payslipId = payslipIdByCode.get(p.id);
      if (payslipId === undefined) return [];
      return p.lines.map((l) => ({
        payslipId,
        label: l.label,
        amount: String(l.amount),
        type: l.type,
      }));
    });
    if (lineRows.length > 0) await tx.insert(payslipLines).values(lineRows);

    console.log(`[db] seeded ${inserted.length} payslips, ${lineRows.length} payslip lines`);
  });
}

// --- leave requests --------------------------------------------------------
async function seedLeaveRequests(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: leaveRequests.id }).from(leaveRequests).limit(1);
  if (existing.length > 0) return;

  const emps = await db.select({ id: employees.id, code: employees.code }).from(employees);
  const empIdByCode = new Map<string, number>();
  for (const e of emps) if (e.code) empIdByCode.set(e.code, e.id);

  const rows = mockLeaveRequests
    .map((l) => {
      const employeeId = empIdByCode.get(l.employeeId);
      if (employeeId === undefined) return null;
      return {
        code: l.id,
        employeeId,
        type: l.type,
        startDate: l.startDate,
        endDate: l.endDate,
        days: l.days,
        reason: l.reason,
        status: l.status,
        approver: l.approver,
        submittedAt: new Date(l.submittedAt),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;
  await db.insert(leaveRequests).values(rows);
  console.log(`[db] seeded ${rows.length} leave requests`);
}

// --- contract templates ----------------------------------------------------
async function seedContractTemplates(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: contractTemplates.id }).from(contractTemplates).limit(1);
  if (existing.length > 0) return;

  const rows = mockContractTemplates.map((tpl) => ({
    name: tpl.name,
    description: tpl.description,
    type: tpl.type,
    hoursPerWeek: String(tpl.hoursPerWeek),
    noticePeriodWeeks: tpl.noticePeriodWeeks,
    clauses: tpl.clauses,
  }));
  await db.insert(contractTemplates).values(rows);
  console.log(`[db] seeded ${rows.length} contract templates`);
}

// --- contracts -------------------------------------------------------------
async function seedContracts(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: contracts.id }).from(contracts).limit(1);
  if (existing.length > 0) return;

  const emps = await db.select({ id: employees.id, code: employees.code }).from(employees);
  const empIdByCode = new Map<string, number>();
  for (const e of emps) if (e.code) empIdByCode.set(e.code, e.id);

  // templates have no code column — map by (unique) name
  const tpls = await db
    .select({ id: contractTemplates.id, name: contractTemplates.name })
    .from(contractTemplates);
  const tplIdByName = new Map(tpls.map((t) => [t.name, t.id]));

  const rows = mockContracts
    .map((c) => {
      const employeeId = empIdByCode.get(c.employeeId);
      if (employeeId === undefined) return null;
      return {
        code: c.id,
        employeeId,
        jobTitle: c.jobTitle,
        type: c.type,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        salary: String(c.salary),
        hoursPerWeek: String(c.hoursPerWeek),
        noticePeriodWeeks: c.noticePeriodWeeks,
        templateId: tplIdByName.get(c.templateName) ?? null,
        signedAt: c.signedAt ? new Date(c.signedAt) : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;
  await db.insert(contracts).values(rows);
  console.log(`[db] seeded ${rows.length} contracts`);
}

// --- goals -----------------------------------------------------------------
async function seedGoals(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: goals.id }).from(goals).limit(1);
  if (existing.length > 0) return;

  const emps = await db.select({ id: employees.id, code: employees.code }).from(employees);
  const empIdByCode = new Map<string, number>();
  for (const e of emps) if (e.code) empIdByCode.set(e.code, e.id);

  const rows = mockGoals
    .map((g) => {
      const employeeId = empIdByCode.get(g.employeeId);
      if (employeeId === undefined) return null;
      return {
        code: g.id,
        employeeId,
        title: g.title,
        type: g.type,
        progress: g.progress,
        status: g.status,
        quarter: g.quarter,
        weight: g.weight,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;
  await db.insert(goals).values(rows);
  console.log(`[db] seeded ${rows.length} goals`);
}

// --- reimbursements --------------------------------------------------------
async function seedReimbursements(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: reimbursements.id }).from(reimbursements).limit(1);
  if (existing.length > 0) return;

  const emps = await db.select({ id: employees.id, code: employees.code }).from(employees);
  const empIdByCode = new Map<string, number>();
  for (const e of emps) if (e.code) empIdByCode.set(e.code, e.id);

  const rows = mockReimbursements
    .map((rb) => {
      const employeeId = empIdByCode.get(rb.employeeId);
      if (employeeId === undefined) return null;
      return {
        code: rb.id,
        employeeId,
        category: rb.category,
        amount: String(rb.amount),
        date: rb.date,
        description: rb.description,
        status: rb.status,
        vat: rb.vat,
        costCenter: rb.costCenter,
        receiptUrl: rb.receiptUrl ?? null,
        approver: rb.approver ?? null,
        paymentMethod: rb.paymentMethod,
        currency: rb.currency,
        submittedAt: rb.submittedAt ? new Date(rb.submittedAt) : null,
        approvedAt: rb.approvedAt ? new Date(rb.approvedAt) : null,
        processingDays: rb.processingDays ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;
  await db.insert(reimbursements).values(rows);
  console.log(`[db] seeded ${rows.length} reimbursements`);
}

// --- vacancies -------------------------------------------------------------
async function seedVacancies(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: vacancies.id }).from(vacancies).limit(1);
  if (existing.length > 0) return;

  const deptId = await deptIdMap();
  const rows = mockVacancies.map((v) => ({
    code: v.id,
    title: v.title,
    departmentId: deptId.get(v.department) ?? null,
    location: v.location,
    type: v.type,
    status: v.status,
    openedAt: v.openedAt,
    hiringManager: v.hiringManager,
    recruiter: v.recruiter ?? null,
    requiredStartDate: v.requiredStartDate ?? null,
    costCenter: v.costCenter ?? null,
    priority: v.priority ?? null,
    workplaceModel: v.workplaceModel ?? null,
    salaryMin: v.salaryMin != null ? String(v.salaryMin) : null,
    salaryMax: v.salaryMax != null ? String(v.salaryMax) : null,
    currency: v.currency ?? null,
  }));
  await db.insert(vacancies).values(rows);
  console.log(`[db] seeded ${rows.length} vacancies`);
}

// --- candidates (linked to vacancies via role == vacancy title) ------------
async function seedCandidates(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: candidates.id }).from(candidates).limit(1);
  if (existing.length > 0) return;

  const deptId = await deptIdMap();
  const vacs = await db.select({ id: vacancies.id, title: vacancies.title }).from(vacancies);
  const vacancyIdByTitle = new Map(vacs.map((v) => [v.title, v.id]));

  const rows = mockCandidates.map((c) => ({
    code: c.id,
    name: c.name,
    email: c.email,
    role: c.role,
    departmentId: deptId.get(c.department) ?? null,
    location: c.location,
    vacancyId: vacancyIdByTitle.get(c.role) ?? null,
    stage: c.stage,
    rating: c.rating,
    source: c.source,
    appliedAt: c.appliedAt,
    resumeUrl: c.resumeUrl,
  }));
  await db.insert(candidates).values(rows);
  console.log(`[db] seeded ${rows.length} candidates`);
}

// --- assets (assignedTo name -> employee id) -------------------------------
async function seedAssets(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: assets.id }).from(assets).limit(1);
  if (existing.length > 0) return;

  const emps = await db
    .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
    .from(employees);
  const idByName = new Map<string, number>();
  for (const e of emps) {
    const name = `${e.firstName} ${e.lastName}`;
    if (!idByName.has(name)) idByName.set(name, e.id); // first match wins
  }

  const rows = mockAssets.map((a) => ({
    code: a.id,
    name: a.name,
    serial: a.serial,
    assetTag: a.assetTag ?? null,
    category: a.category,
    status: a.status,
    assignedToEmployeeId: a.assignedTo ? (idByName.get(a.assignedTo) ?? null) : null,
    purchaseDate: a.purchaseDate ?? null,
    purchasePrice: a.purchasePrice != null ? String(a.purchasePrice) : null,
    vendor: a.vendor ?? null,
    warrantyUntil: a.warrantyUntil ?? null,
    location: a.location ?? null,
    condition: a.condition ?? null,
    os: a.os ?? null,
    encryptionEnabled: a.encryptionEnabled ?? null,
    assignedSince: a.assignedSince ?? null,
    insuranceCovered: a.insuranceCovered ?? null,
    notes: a.notes ?? null,
  }));
  await db.insert(assets).values(rows);
  console.log(`[db] seeded ${rows.length} assets`);
}

// --- helpdesk tickets ------------------------------------------------------
async function seedTickets(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: helpdeskTickets.id }).from(helpdeskTickets).limit(1);
  if (existing.length > 0) return;

  const rows = mockTickets.map((t) => ({
    code: t.id,
    subject: t.subject,
    requester: t.requester,
    assignee: t.assignee ?? null,
    category: t.category,
    priority: t.priority,
    status: t.status,
    createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
  }));
  await db.insert(helpdeskTickets).values(rows);
  console.log(`[db] seeded ${rows.length} helpdesk tickets`);
}

// --- attendance records ----------------------------------------------------
async function seedAttendance(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: attendanceRecords.id }).from(attendanceRecords).limit(1);
  if (existing.length > 0) return;

  const emps = await db.select({ id: employees.id, code: employees.code }).from(employees);
  const empIdByCode = new Map<string, number>();
  for (const e of emps) if (e.code) empIdByCode.set(e.code, e.id);

  const rows = mockAttendance
    .map((a) => {
      const employeeId = empIdByCode.get(a.employeeId);
      if (employeeId === undefined) return null;
      return {
        code: a.id,
        employeeId,
        date: a.date,
        clockIn: a.clockIn ?? null,
        clockOut: a.clockOut ?? null,
        workedHours: a.workedHours != null ? String(a.workedHours) : null,
        location: a.location ?? null,
        status: a.status,
        method: a.method ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;
  await db.insert(attendanceRecords).values(rows);
  console.log(`[db] seeded ${rows.length} attendance records`);
}

// --- appraisals (generated from employees — no mock source) ----------------
async function seedAppraisals(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: appraisals.id }).from(appraisals).limit(1);
  if (existing.length > 0) return;

  const emps = await db
    .select({ id: employees.id, perf: employees.performanceScore })
    .from(employees)
    .orderBy(employees.id)
    .limit(40);

  const quarters = ["Q1 2026", "Q4 2025", "Q3 2025"];
  const clamp = (n: number) => Math.min(5, Math.max(1, n));

  const rows = emps.map((e, i) => {
    const overall = clamp(Math.round(e.perf / 20));
    const vary = clamp(overall + ((i % 3) - 1)); // -1 / 0 / +1
    return {
      code: `APR-${String(i + 1).padStart(4, "0")}`,
      employeeId: e.id,
      quarter: quarters[i % quarters.length],
      overallRating: overall,
      comment: "Solide Leistung im Berichtszeitraum.",
      status: "completed" as const,
      scoreFachkompetenz: vary,
      scoreZusammenarbeit: clamp(overall - (i % 2)),
      scoreKommunikation: overall,
      scoreEigeninitiative: vary,
    };
  });
  await db.insert(appraisals).values(rows);
  console.log(`[db] seeded ${rows.length} appraisals`);
}

// --- activity log (from mock) ----------------------------------------------
async function seedActivity(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: activityLog.id }).from(activityLog).limit(1);
  if (existing.length > 0) return;

  // mock timestamp is a relative string ("vor 12 Min") — not a real date,
  // so we let eventAt default to now().
  const rows = mockActivity.map((a) => ({
    actor: a.actor,
    action: a.action,
    target: a.target,
    type: a.type,
  }));
  await db.insert(activityLog).values(rows);
  console.log(`[db] seeded ${rows.length} activity entries`);
}

// --- notifications (from mock) ---------------------------------------------
async function seedNotifications(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: notifications.id }).from(notifications).limit(1);
  if (existing.length > 0) return;

  // mock timestamp is a relative string ("vor 12 Min") — let eventAt default to now().
  const rows = mockNotifications.map((n) => ({
    title: n.title,
    description: n.description,
    read: n.read,
    type: n.type,
  }));
  await db.insert(notifications).values(rows);
  console.log(`[db] seeded ${rows.length} notifications`);
}

// --- ESS per-employee data: skills, trainings, career goals (generated) ----
async function seedEssData(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: skills.id }).from(skills).limit(1);
  if (existing.length > 0) return;

  const emps = await db
    .select({ id: employees.id })
    .from(employees)
    .orderBy(employees.id)
    .limit(25);

  const SKILLS = [
    { name: "TypeScript", category: "technical" as const },
    { name: "Englisch C1", category: "language" as const },
    { name: "AWS Certified", category: "certificate" as const },
    { name: "Projektmanagement", category: "technical" as const },
  ];
  const TRAININGS = ["Datenschutz", "Arbeitssicherheit", "Compliance Code of Conduct", "Brandschutz"];
  const TRAINING_STATUS = ["completed", "due", "upcoming"] as const;

  const skillRows = emps.flatMap((e, i) => [
    { employeeId: e.id, name: SKILLS[i % SKILLS.length].name, category: SKILLS[i % SKILLS.length].category, expiresAt: null },
    { employeeId: e.id, name: SKILLS[(i + 2) % SKILLS.length].name, category: SKILLS[(i + 2) % SKILLS.length].category, expiresAt: null },
  ]);
  await db.insert(skills).values(skillRows);

  const trainingRows = emps.map((e, i) => ({
    employeeId: e.id,
    name: TRAININGS[i % TRAININGS.length],
    dueDate: `2026-${String((i % 12) + 1).padStart(2, "0")}-15`,
    status: TRAINING_STATUS[i % TRAINING_STATUS.length],
  }));
  await db.insert(complianceTrainings).values(trainingRows);

  const goalRows = emps.slice(0, 20).map((e, i) => ({
    employeeId: e.id,
    title: ["Führungskräfte-Training", "Zertifizierung abschließen", "Mentoring-Programm"][i % 3],
    progress: (i * 7 + 20) % 100,
    lastUpdate: "2026-05-20",
  }));
  await db.insert(careerGoals).values(goalRows);

  console.log(
    `[db] seeded ${skillRows.length} skills, ${trainingRows.length} trainings, ${goalRows.length} career goals`,
  );
}

// --- overtime requests (generated) -----------------------------------------
async function seedOvertime(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: overtimeRequests.id }).from(overtimeRequests).limit(1);
  if (existing.length > 0) return;

  const emps = await db
    .select({ id: employees.id })
    .from(employees)
    .orderBy(employees.id)
    .limit(14);

  const STATUS = ["pending", "approved", "rejected"] as const;
  const rows = emps.map((e, i) => ({
    code: `OT-${String(i + 1).padStart(4, "0")}`,
    employeeId: e.id,
    date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
    hours: String(((i % 4) + 1) + 0.5),
    reason: ["Projekt-Deadline", "Support-Einsatz", "Inventur", "Release"][i % 4],
    status: STATUS[i % STATUS.length],
    submittedAt: new Date("2026-05-25"),
  }));
  await db.insert(overtimeRequests).values(rows);
  console.log(`[db] seeded ${rows.length} overtime requests`);
}
