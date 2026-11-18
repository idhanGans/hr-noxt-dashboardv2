export type ID = string;

export type EmploymentStatus = "active" | "onboarding" | "on_leave" | "offboarding" | "terminated";

export type { Department, Title } from "@/config/options";
import type { Department, Title } from "@/config/options";

export type Gender = "m" | "f" | "d";
export type ContractType =
  | "permanent"
  | "fixed_term"
  | "part_time"
  | "working_student"
  | "intern"
  | "mini_job"
  | "freelance";
export type WorkplaceModel = "office" | "hybrid" | "remote";
export type TaxClass = 1 | 2 | 3 | 4 | 5 | 6;
export type Religion = "rk" | "ev" | "keine" | "sonst";
export type HealthInsuranceType = "statutory" | "private";

export interface HealthInsurance {
  type: HealthInsuranceType;
  provider?: string;
}

export interface Employee {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  title: Title;
  jobTitle: string;
  department: Department;
  location: string;
  employmentType: "full_time" | "part_time" | "contractor" | "intern";
  status: EmploymentStatus;
  managerId?: ID;
  hireDate: string;
  salary: number;
  performanceScore: number;
  role?: "manager" | "admin" | "staff";

  // --- Stammdaten (optional, added with the multi-step wizard) ---
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  phone?: string;
  address?: {
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
  };

  // --- Vertrag ---
  contractType?: ContractType;
  contractStart?: string;
  contractEnd?: string;
  probationEnd?: string;
  weeklyHours?: number;
  vacationEntitlement?: number;
  noticePeriod?: string;
  workplaceModel?: WorkplaceModel;

  // --- Vergütung & Steuer ---
  taxId?: string;
  socialSecurityNo?: string;
  taxClass?: TaxClass;
  children?: number;
  religion?: Religion;
  healthInsurance?: HealthInsurance;
  iban?: string;
  bic?: string;
  costCenter?: string;
  bonusTargetPct?: number;

  // --- Onboarding-Setup ---
  buddyId?: ID;
  requiredTrainings?: string[];
  provisionedAssets?: string[];

  // --- List-page enrichment (probation, reviews, balances) ---
  probationStatus?: "active" | "passed" | "pending_review";
  lastReviewDate?: string;
  vacationBalance?: { used: number; total: number };
  sickDaysYtd?: number;
}

export type AttendanceStatus = "present" | "remote" | "late" | "absent" | "on_leave";

export interface AttendanceRecord {
  id: ID;
  employeeId: ID;
  employeeName: string;
  department: Department;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: AttendanceStatus;
  workedHours: number;
  location: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  locationOut?: string;
  gpsOutLat?: number | null;
  gpsOutLng?: number | null;
  method: "office" | "gps" | "biometric";
}

export type LeaveType = "annual" | "sick" | "parental" | "unpaid" | "bereavement";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: ID;
  employeeId: ID;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: RequestStatus;
  approver: string;
  submittedAt: string;
}

export interface PayslipLine {
  label: string;
  amount: number;
  type: "earning" | "deduction";
}

export interface Payslip {
  id: ID;
  employeeId: ID;
  employeeName: string;
  period: string;
  gross: number;
  net: number;
  tax: number;
  status: "paid" | "processing" | "scheduled";
  lines: PayslipLine[];
}

// --- Contracts (Direktor-Section) ---

export type ContractStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "draft"
  | "terminated";

export interface ContractTemplate {
  id: ID;
  name: string;
  type: ContractType;
  description: string;
  hoursPerWeek: number;
  noticePeriodWeeks: number;
  clauses: string[];
}

export interface Contract {
  id: ID;
  employeeId: ID;
  employeeName: string;
  jobTitle: string;
  type: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  salary: number;
  hoursPerWeek: number;
  noticePeriodWeeks: number;
  templateId: ID;
  templateName: string;
  signedAt?: string;
}

export type ReimbursementPaymentMethod = "payroll" | "bank" | "corporate_card";
export type ReimbursementCurrency = "EUR" | "USD";
export type ReimbursementVat = 0 | 7 | 19;

export interface Reimbursement {
  id: ID;
  employeeId: ID;
  employeeName: string;
  category: "travel" | "meals" | "equipment" | "training" | "other";
  amount: number;
  date: string;
  status: RequestStatus;
  description: string;
  // Extended audit / fiscal metadata
  vat: ReimbursementVat;
  costCenter: string;
  receiptUrl?: string;
  approver?: string;
  paymentMethod: ReimbursementPaymentMethod;
  currency: ReimbursementCurrency;
  submittedAt: string;
  approvedAt?: string;
  processingDays?: number;
}

export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export interface Candidate {
  id: ID;
  name: string;
  email: string;
  role: string;
  department: Department;
  stage: CandidateStage;
  rating: number;
  source: string;
  appliedAt: string;
  resumeUrl: string;
  location: string;
}

export type VacancyPriority = "P0" | "P1" | "P2";
export type VacancyWorkplaceModel = "office" | "hybrid" | "remote";
export type VacancyCurrency = "EUR";

export interface VacancyFunnel {
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  hired: number;
}

export interface JobVacancy {
  id: ID;
  title: string;
  department: Department;
  location: string;
  type: "full_time" | "part_time" | "contractor";
  applicants: number;
  status: "open" | "on_hold" | "closed";
  openedAt: string;
  hiringManager: string;
  // ---- extended recruiting metadata ----
  priority?: VacancyPriority;
  workplaceModel?: VacancyWorkplaceModel;
  salaryMin?: number;
  salaryMax?: number;
  currency?: VacancyCurrency;
  recruiter?: string;
  requiredStartDate?: string;
  costCenter?: string;
  funnel?: VacancyFunnel;
  sourceMix?: { source: string; count: number }[];
}

export type GoalStatus = "on_track" | "at_risk" | "behind" | "completed";

export interface Goal {
  id: ID;
  employeeId: ID;
  employeeName: string;
  title: string;
  type: "okr" | "kpi";
  progress: number;
  status: GoalStatus;
  quarter: string;
  weight: number;
}

export type AssetCategory =
  | "laptop"
  | "phone"
  | "monitor"
  | "access_card"
  | "vehicle";

export type AssetStatus =
  | "assigned"
  | "available"
  | "maintenance"
  | "retired"
  | "lost"
  | "disposed";

export type AssetCondition = "new" | "good" | "damaged";

export interface Asset {
  id: ID;
  name: string;
  category: AssetCategory;
  serial: string;
  assignedTo?: string;
  status: AssetStatus;
  purchaseDate: string;
  // ----- extended inventory metadata -----
  assetTag?: string;
  vendor?: string;
  purchasePrice?: number;
  warrantyUntil?: string;
  location?: string;
  condition?: AssetCondition;
  os?: string;
  encryptionEnabled?: boolean;
  assignedSince?: string;
  insuranceCovered?: boolean;
  notes?: string;
}

export interface HelpdeskTicket {
  id: ID;
  subject: string;
  requester: string;
  category: "payroll" | "it" | "facilities" | "policy" | "benefits";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  assignee: string;
}

export interface ActivityItem {
  id: ID;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  type: "leave" | "payroll" | "recruitment" | "performance" | "attendance" | "system";
}

export interface ApprovalItem {
  id: ID;
  title: string;
  requester: string;
  type: LeaveType | "reimbursement" | "overtime";
  amount?: number;
  submittedAt: string;
}

export interface NotificationItem {
  id: ID;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  type: "info" | "success" | "warning";
}

export interface TimeSeriesPoint {
  label: string;
  [key: string]: string | number;
}

export interface Kpi {
  id: string;
  label: string;
  value: number;
  format: "number" | "currency" | "percent";
  delta: number;
  trend: TimeSeriesPoint[];
}

// ---------- ESS / Self-service domain types ----------

export interface Skill {
  id: ID;
  name: string;
  expiresAt?: string;
  category: "language" | "certificate" | "technical";
}

export interface ComplianceTraining {
  id: ID;
  name: string;
  dueDate: string;
  status: "due" | "upcoming" | "completed";
}

export interface CareerGoal {
  id: ID;
  title: string;
  progress: number;
  lastUpdate: string;
}
