"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  ActivityItem,
  Asset,
  AttendanceRecord,
  Candidate,
  CareerGoal,
  ComplianceTraining,
  Contract,
  ContractTemplate,
  ContractType,
  Department,
  Employee,
  Gender,
  Goal,
  HealthInsuranceType,
  HelpdeskTicket,
  JobVacancy,
  Kpi,
  LeaveRequest,
  Payslip,
  Reimbursement,
  Religion,
  Skill,
  TaxClass,
  Title,
  WorkplaceModel,
} from "@/types";

// Every hook below reads from the live API.

// Shape returned by GET /api/employees. Sensitive fields (salary, iban, …)
// are absent for non-managers, so they are optional here.
export type ApiEmployee = {
  id: number;
  code: string | null;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  title: string | null; // joined department/title names
  jobTitle: string;
  department: string | null;
  location: string;
  employmentType: Employee["employmentType"];
  status: Employee["status"];
  managerId: number | null;
  buddyId: number | null;
  hireDate: string;
  performanceScore: number;
  role: "manager" | "admin" | "staff";
  salary?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  nationality?: string | null;
  phone?: string | null;
  addressStreet?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
  addressCountry?: string | null;
  contractType?: ContractType | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  probationEnd?: string | null;
  weeklyHours?: string | null;
  vacationEntitlement?: number | null;
  noticePeriod?: string | null;
  workplaceModel?: WorkplaceModel | null;
  taxId?: string | null;
  socialSecurityNo?: string | null;
  taxClass?: number | null;
  children?: number | null;
  religion?: Religion | null;
  healthInsuranceType?: HealthInsuranceType | null;
  healthInsuranceProvider?: string | null;
  iban?: string | null;
  bic?: string | null;
  costCenter?: string | null;
  bonusTargetPct?: string | null;
  probationStatus?: Employee["probationStatus"] | null;
  lastReviewDate?: string | null;
  vacationUsed?: number | null;
  vacationTotal?: number | null;
  sickDaysYtd?: number | null;
};

// Maps one API row to the frontend Employee type. Uses the human code as id
// and resolves manager/buddy numeric ids back to codes so existing manager
// lookups keep working.
export function mapEmployee(r: ApiEmployee, codeById: Map<number, string>): Employee {
  const codeOf = (n: number | null) =>
    n != null ? (codeById.get(n) ?? String(n)) : undefined;

  return {
    id: r.code ?? String(r.id),
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    avatar: r.avatarUrl ?? undefined,
    title: (r.title ?? "Staff") as Title,
    jobTitle: r.jobTitle,
    department: (r.department ?? "HR") as Department,
    location: r.location,
    employmentType: r.employmentType,
    status: r.status,
    role: r.role,
    managerId: codeOf(r.managerId),
    hireDate: r.hireDate,
    salary: r.salary != null ? Number(r.salary) : 0,
    performanceScore: r.performanceScore,
    dateOfBirth: r.dateOfBirth ?? undefined,
    gender: r.gender ?? undefined,
    nationality: r.nationality ?? undefined,
    phone: r.phone ?? undefined,
    address: {
      street: r.addressStreet ?? undefined,
      zip: r.addressZip ?? undefined,
      city: r.addressCity ?? undefined,
      country: r.addressCountry ?? undefined,
    },
    contractType: r.contractType ?? undefined,
    contractStart: r.contractStart ?? undefined,
    contractEnd: r.contractEnd ?? undefined,
    probationEnd: r.probationEnd ?? undefined,
    weeklyHours: r.weeklyHours != null ? Number(r.weeklyHours) : undefined,
    vacationEntitlement: r.vacationEntitlement ?? undefined,
    noticePeriod: r.noticePeriod ?? undefined,
    workplaceModel: r.workplaceModel ?? undefined,
    taxId: r.taxId ?? undefined,
    socialSecurityNo: r.socialSecurityNo ?? undefined,
    taxClass: (r.taxClass ?? undefined) as TaxClass | undefined,
    children: r.children ?? undefined,
    religion: r.religion ?? undefined,
    healthInsurance: r.healthInsuranceType
      ? { type: r.healthInsuranceType, provider: r.healthInsuranceProvider ?? undefined }
      : undefined,
    iban: r.iban ?? undefined,
    bic: r.bic ?? undefined,
    costCenter: r.costCenter ?? undefined,
    bonusTargetPct: r.bonusTargetPct != null ? Number(r.bonusTargetPct) : undefined,
    buddyId: codeOf(r.buddyId),
    probationStatus: r.probationStatus ?? undefined,
    lastReviewDate: r.lastReviewDate ?? undefined,
    vacationBalance:
      r.vacationUsed != null || r.vacationTotal != null
        ? { used: r.vacationUsed ?? 0, total: r.vacationTotal ?? 0 }
        : undefined,
    sickDaysYtd: r.sickDaysYtd ?? undefined,
  };
}

async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch("/api/employees");
  if (!res.ok) {
    throw new Error(`Mitarbeiter konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: ApiEmployee[] };
  const codeById = new Map<number, string>();
  for (const r of json.items) if (r.code) codeById.set(r.id, r.code);
  return json.items.map((r) => mapEmployee(r, codeById));
}

export const useEmployees = () =>
  useQuery({ queryKey: ["employees"], queryFn: fetchEmployees });

// --- Org-Chart: Berichts-Baum aus der managerId-Linie -----------------------

export interface OrgTreeNode {
  employee: Employee;
  children: OrgTreeNode[];
  /** Tiefe ab der Wurzel (0 = Wurzel). */
  depth: number;
  /** Anzahl aller (auch indirekt) unterstellten Mitarbeitenden. */
  descendants: number;
}

// Baut aus der flachen Mitarbeiterliste den Berichts-Baum. Wurzeln sind
// Mitarbeitende ohne (bekannten) Manager; Kinder werden ueber managerId
// gruppiert. Ein visited-Set schuetzt vor Zyklen in fehlerhaften Daten.
export function buildOrgTree(employees: Employee[]): OrgTreeNode[] {
  const byId = new Map<string, Employee>();
  for (const e of employees) byId.set(String(e.id), e);

  const childrenOf = new Map<string, Employee[]>();
  const roots: Employee[] = [];
  for (const e of employees) {
    const mgr = e.managerId ? String(e.managerId) : "";
    if (mgr && mgr !== String(e.id) && byId.has(mgr)) {
      const arr = childrenOf.get(mgr) ?? [];
      arr.push(e);
      childrenOf.set(mgr, arr);
    } else {
      roots.push(e);
    }
  }

  const byName = (a: Employee, b: Employee) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);

  const visited = new Set<string>();
  const toNode = (e: Employee, depth: number): OrgTreeNode => {
    visited.add(String(e.id));
    const kids = (childrenOf.get(String(e.id)) ?? [])
      .filter((c) => !visited.has(String(c.id)))
      .sort(byName)
      .map((c) => toNode(c, depth + 1));
    const descendants = kids.reduce((sum, k) => sum + 1 + k.descendants, 0);
    return { employee: e, children: kids, depth, descendants };
  };

  return roots.sort(byName).map((e) => toNode(e, 0));
}

// Liefert den fertig aufgebauten Org-Baum plus die flache Mitarbeiterliste
// (fuer Suche/Abteilungsfilter). Reine Client-Transformation ueber useEmployees.
export function useOrgTree() {
  const { data: employees = [], isLoading } = useEmployees();
  const roots = React.useMemo(() => buildOrgTree(employees), [employees]);
  return { roots, employees, isLoading };
}

async function fetchAttendance(): Promise<AttendanceRecord[]> {
  const res = await fetch("/api/attendance");
  if (!res.ok) {
    throw new Error(`Anwesenheit konnte nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: AttendanceRecord[] };
  return json.items;
}

export const useAttendance = () =>
  useQuery({ queryKey: ["attendance"], queryFn: fetchAttendance });

async function fetchLeave(): Promise<LeaveRequest[]> {
  const res = await fetch("/api/leave");
  if (!res.ok) {
    throw new Error(`Abwesenheiten konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: LeaveRequest[] };
  return json.items;
}

export const useLeaveRequests = () =>
  useQuery({ queryKey: ["leave"], queryFn: fetchLeave });

// Shape returned by GET /api/payslips. Amounts are null for admins.
type ApiPayslip = {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  status: Payslip["status"];
  gross: number | null;
  net: number | null;
  tax: number | null;
  lines: { label: string; amount: number; type: "earning" | "deduction" }[];
};

async function fetchPayslips(): Promise<Payslip[]> {
  const res = await fetch("/api/payslips");
  if (!res.ok) {
    throw new Error(`Abrechnungen konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: ApiPayslip[] };
  return json.items.map((p) => ({
    id: p.id,
    employeeId: p.employeeId,
    employeeName: p.employeeName,
    period: p.period,
    gross: p.gross ?? 0,
    net: p.net ?? 0,
    tax: p.tax ?? 0,
    status: p.status,
    lines: p.lines ?? [],
  }));
}

export const usePayslips = () =>
  useQuery({ queryKey: ["payslips"], queryFn: fetchPayslips });

async function fetchReimbursements(): Promise<Reimbursement[]> {
  const res = await fetch("/api/reimbursements");
  if (!res.ok) {
    throw new Error(`Erstattungen konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: Reimbursement[] };
  return json.items;
}

export const useReimbursements = () =>
  useQuery({ queryKey: ["reimbursements"], queryFn: fetchReimbursements });

async function fetchCandidates(): Promise<Candidate[]> {
  const res = await fetch("/api/candidates");
  if (!res.ok) {
    throw new Error(`Kandidaten konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: Candidate[] };
  return json.items;
}

export const useCandidates = () =>
  useQuery({ queryKey: ["candidates"], queryFn: fetchCandidates });

async function fetchVacancies(): Promise<JobVacancy[]> {
  const res = await fetch("/api/vacancies");
  if (!res.ok) {
    throw new Error(`Stellen konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: JobVacancy[] };
  return json.items;
}

export const useVacancies = () =>
  useQuery({ queryKey: ["vacancies"], queryFn: fetchVacancies });

async function fetchGoals(): Promise<Goal[]> {
  const res = await fetch("/api/goals");
  if (!res.ok) {
    throw new Error(`Ziele konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: Goal[] };
  return json.items;
}

export const useGoals = () =>
  useQuery({ queryKey: ["goals"], queryFn: fetchGoals });

async function fetchAssets(): Promise<Asset[]> {
  const res = await fetch("/api/assets");
  if (!res.ok) {
    throw new Error(`Assets konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: Asset[] };
  return json.items;
}

export const useAssets = () =>
  useQuery({ queryKey: ["assets"], queryFn: fetchAssets });

async function fetchTickets(): Promise<HelpdeskTicket[]> {
  const res = await fetch("/api/tickets");
  if (!res.ok) {
    throw new Error(`Tickets konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: HelpdeskTicket[] };
  return json.items;
}

export const useTickets = () =>
  useQuery({ queryKey: ["tickets"], queryFn: fetchTickets });

async function fetchActivity(): Promise<ActivityItem[]> {
  const res = await fetch("/api/activity");
  if (!res.ok) {
    throw new Error(`Aktivitaet konnte nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: ActivityItem[] };
  return json.items;
}

export const useActivity = () =>
  useQuery({ queryKey: ["activity"], queryFn: fetchActivity });

// --- the logged-in user (self-service) ---
export type MeData = {
  employee: Employee;
  manager: Employee | null;
  skipLevel: Employee | null;
  reports: Employee[];
  peers: Employee[];
  skills: Skill[];
  trainings: ComplianceTraining[];
  careerGoals: CareerGoal[];
};

async function fetchMe(): Promise<MeData> {
  const res = await fetch("/api/me");
  if (!res.ok) {
    throw new Error(`Profil konnte nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    employee: ApiEmployee;
    manager: ApiEmployee | null;
    skipLevel: ApiEmployee | null;
    reports: ApiEmployee[];
    peers: ApiEmployee[];
    skills: Skill[];
    trainings: ComplianceTraining[];
    careerGoals: CareerGoal[];
  };

  // build code lookup across everyone in the payload (for manager/buddy refs)
  const everyone = [json.employee, json.manager, json.skipLevel, ...json.reports, ...json.peers].filter(
    (r): r is ApiEmployee => Boolean(r),
  );
  const codeById = new Map<number, string>();
  for (const r of everyone) if (r.code) codeById.set(r.id, r.code);
  const map = (r: ApiEmployee | null) => (r ? mapEmployee(r, codeById) : null);

  return {
    employee: mapEmployee(json.employee, codeById),
    manager: map(json.manager),
    skipLevel: map(json.skipLevel),
    reports: json.reports.map((r) => mapEmployee(r, codeById)),
    peers: json.peers.map((r) => mapEmployee(r, codeById)),
    skills: json.skills,
    trainings: json.trainings,
    careerGoals: json.careerGoals,
  };
}

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: fetchMe });

async function fetchKpis(): Promise<Kpi[]> {
  const res = await fetch("/api/kpis");
  if (!res.ok) {
    throw new Error(`KPIs konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: Kpi[] };
  return json.items;
}

export const useKpis = () =>
  useQuery({ queryKey: ["kpis"], queryFn: fetchKpis });

async function fetchContracts(): Promise<Contract[]> {
  const res = await fetch("/api/contracts");
  if (!res.ok) {
    throw new Error(`Vertraege konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: Contract[] };
  return json.items;
}

export const useContracts = () =>
  useQuery({ queryKey: ["contracts"], queryFn: fetchContracts });

async function fetchContractTemplates(): Promise<ContractTemplate[]> {
  const res = await fetch("/api/contract-templates");
  if (!res.ok) {
    throw new Error(`Vertragsvorlagen konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: ContractTemplate[] };
  return json.items;
}

export const useContractTemplates = () =>
  useQuery({ queryKey: ["contract-templates"], queryFn: fetchContractTemplates });

// Appraisals have no @/types entry — shape it locally.
export type Appraisal = {
  id: string;
  employeeId: string;
  employeeName: string;
  quarter: string;
  overallRating: number;
  comment: string;
  status: "completed" | "draft" | "in_progress";
  scoreFachkompetenz: number;
  scoreZusammenarbeit: number;
  scoreKommunikation: number;
  scoreEigeninitiative: number;
};

async function fetchAppraisals(): Promise<Appraisal[]> {
  const res = await fetch("/api/appraisals");
  if (!res.ok) {
    throw new Error(`Beurteilungen konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: Appraisal[] };
  return json.items;
}

export const useAppraisals = () =>
  useQuery({ queryKey: ["appraisals"], queryFn: fetchAppraisals });

// --- Zugriffsverwaltung (Access Management) ---
export type AccessUser = {
  id: number;
  code: string | null;
  name: string;
  email: string;
  role: "manager" | "admin" | "staff";
  authUser: string | null;
  canLogin: boolean;
  isSelf: boolean;
};

async function fetchAccessUsers(): Promise<AccessUser[]> {
  const res = await fetch("/api/access");
  if (!res.ok) {
    throw new Error(`Zugriffe konnten nicht geladen werden (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { items: AccessUser[] };
  return json.items;
}

export const useAccessUsers = () =>
  useQuery({ queryKey: ["access"], queryFn: fetchAccessUsers });

// --- Organisations-Einheiten (Abteilungen / Titel) ---
export type OrgUnit = { id: number; name: string };

async function fetchOrg(resource: "departments" | "titles"): Promise<OrgUnit[]> {
  const res = await fetch(`/api/${resource}`);
  if (!res.ok) throw new Error(`Laden fehlgeschlagen (HTTP ${res.status})`);
  const json = (await res.json()) as { items: OrgUnit[] };
  return json.items;
}

export const useDepartments = () =>
  useQuery({ queryKey: ["departments"], queryFn: () => fetchOrg("departments") });

export const useTitles = () =>
  useQuery({ queryKey: ["titles"], queryFn: () => fetchOrg("titles") });

export type OnboardingTaskState = { employeeId: string; taskIndex: number; done: boolean };

async function fetchOnboarding(): Promise<OnboardingTaskState[]> {
  const res = await fetch("/api/onboarding");
  if (!res.ok) throw new Error(`Laden fehlgeschlagen (HTTP ${res.status})`);
  const json = (await res.json()) as { items: OnboardingTaskState[] };
  return json.items;
}

export const useOnboardingTasks = () =>
  useQuery({ queryKey: ["onboarding"], queryFn: fetchOnboarding });
