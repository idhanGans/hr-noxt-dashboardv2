// Echte Zeitreihen/Verteilungen aus den Live-Daten ableiten — ersetzt die
// frueheren (leeren) Platzhalter-Arrays aus @/lib/mock/data. Solange wenig
// Historie existiert, sind die Reihen entsprechend kurz/leer (ehrlich), und
// fuellen sich mit echten Daten.

import type {
  ApprovalItem,
  AttendanceRecord,
  Candidate,
  CandidateStage,
  Employee,
  LeaveRequest,
  Payslip,
  Reimbursement,
  TimeSeriesPoint,
} from "@/types";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const MONTHS_DE = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

// Lohnkosten je Periode (Brutto/Netto) aus echten Lohnabrechnungen.
export function payrollByPeriod(payslips: Payslip[]): TimeSeriesPoint[] {
  const map = new Map<string, { Brutto: number; Netto: number }>();
  for (const p of payslips) {
    const cur = map.get(p.period) ?? { Brutto: 0, Netto: 0 };
    cur.Brutto += p.gross;
    cur.Netto += p.net;
    map.set(p.period, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, v]) => ({
      label,
      Brutto: Math.round(v.Brutto),
      Netto: Math.round(v.Netto),
    }));
}

// Anwesenheit je Monat (present/remote/absent) aus echten Records.
// Schluessel YYYY-MM fuer korrekte Sortierung, Anzeige als Monatskuerzel.
export function attendanceByPeriod(records: AttendanceRecord[]): TimeSeriesPoint[] {
  const map = new Map<string, { Anwesend: number; Remote: number; Abwesend: number }>();
  for (const r of records) {
    const key = (r.date ?? "").slice(0, 7);
    if (!key) continue;
    const cur = map.get(key) ?? { Anwesend: 0, Remote: 0, Abwesend: 0 };
    if (r.status === "present" || r.status === "late") cur.Anwesend += 1;
    else if (r.status === "remote") cur.Remote += 1;
    else cur.Abwesend += 1; // absent, on_leave
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const month = Number(key.slice(5, 7));
      return { label: MONTHS_DE[month - 1] ?? key, ...v };
    });
}

// Recruiting-Funnel: Anzahl Kandidaten je Stage in Pipeline-Reihenfolge.
// "rejected" gehoert nicht in den Vorwaerts-Funnel.
const STAGE_ORDER: CandidateStage[] = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
];

export function candidateFunnel(
  candidates: Candidate[],
): { stage: CandidateStage; value: number }[] {
  const counts = new Map<string, number>();
  for (const c of candidates) counts.set(c.stage, (counts.get(c.stage) ?? 0) + 1);
  return STAGE_ORDER.map((stage) => ({ stage, value: counts.get(stage) ?? 0 }));
}

// Kopfzahl je Abteilung aus den echten Mitarbeitenden.
// Schluessel "count" passt zu den vorhandenen ChartCard-Konfigurationen.
export function headcountByDept(employees: Employee[]): TimeSeriesPoint[] {
  const map = new Map<string, number>();
  for (const e of employees) map.set(e.department, (map.get(e.department) ?? 0) + 1);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

const LEAVE_TYPE_KEY: Record<string, string> = {
  annual: "attendance.leave.typeAnnual",
  sick: "attendance.leave.typeSick",
  parental: "attendance.leave.typeParental",
  unpaid: "attendance.leave.typeUnpaid",
  bereavement: "attendance.leave.typeBereavement",
};

// Offene Genehmigungen aus echten, noch ausstehenden Urlaubs-/Erstattungsantraegen.
// Die id traegt das Ziel-Resource-Praefix ("leave-"/"reimb-"), damit die
// ApprovalCard den richtigen approve/reject-Endpoint aufrufen kann.
export function pendingApprovals(
  leave: LeaveRequest[],
  reimb: Reimbursement[],
  t: TFn,
): ApprovalItem[] {
  const out: ApprovalItem[] = [];
  for (const l of leave) {
    if (l.status !== "pending") continue;
    const typeLabel = LEAVE_TYPE_KEY[l.type] ? t(LEAVE_TYPE_KEY[l.type]) : l.type;
    out.push({
      id: `leave-${l.id}`,
      title: `${typeLabel} · ${l.days} ${t("ess.leave.days")}`,
      requester: l.employeeName,
      type: l.type,
      submittedAt: l.submittedAt,
    });
  }
  for (const r of reimb) {
    if (r.status !== "pending") continue;
    out.push({
      id: `reimb-${r.id}`,
      title: r.description || r.category,
      requester: r.employeeName,
      type: "reimbursement",
      amount: r.amount,
      submittedAt: (r.submittedAt || "").slice(0, 10),
    });
  }
  return out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
