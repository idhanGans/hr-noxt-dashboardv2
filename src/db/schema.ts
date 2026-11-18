// Database schema for HR Noxt — translated 1:1 from docs/DATABASE_BLUEPRINT.md.
// Conventions (see blueprint):
//  - every table has a numeric primary key `id`
//  - business tables also keep the human-readable `code` (e.g. "EMP-001")
//  - every table has created_at / updated_at (the `timestamps` helper below)
//  - fixed value-lists are Postgres enums; department/title are lookup tables

import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  boolean,
  numeric,
  doublePrecision,
  date,
  timestamp,
  jsonb,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// --- reusable created_at / updated_at on every table ---
const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
};

// ====================================================================
// Enums (fixed value lists)
// ====================================================================

export const roleEnum = pgEnum("role", ["manager", "admin", "staff"]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contractor",
  "intern",
]);
export const employmentStatusEnum = pgEnum("employment_status", [
  "active",
  "onboarding",
  "on_leave",
  "offboarding",
  "terminated",
]);
export const genderEnum = pgEnum("gender", ["m", "f", "d"]);
export const contractTypeEnum = pgEnum("contract_type", [
  "permanent",
  "fixed_term",
  "part_time",
  "working_student",
  "intern",
  "mini_job",
  "freelance",
]);
export const workplaceModelEnum = pgEnum("workplace_model", ["office", "hybrid", "remote"]);
export const religionEnum = pgEnum("religion", ["rk", "ev", "keine", "sonst"]);
export const healthInsuranceTypeEnum = pgEnum("health_insurance_type", ["statutory", "private"]);
export const probationStatusEnum = pgEnum("probation_status", [
  "active",
  "passed",
  "pending_review",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "remote",
  "late",
  "absent",
  "on_leave",
]);
export const attendanceMethodEnum = pgEnum("attendance_method", ["office", "gps", "biometric"]);

export const leaveTypeEnum = pgEnum("leave_type", [
  "annual",
  "sick",
  "parental",
  "unpaid",
  "bereavement",
]);
// shared by leave / reimbursement / overtime
export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const payslipStatusEnum = pgEnum("payslip_status", ["paid", "processing", "scheduled"]);
export const payslipLineTypeEnum = pgEnum("payslip_line_type", ["earning", "deduction"]);

export const contractStatusEnum = pgEnum("contract_status", [
  "active",
  "expiring_soon",
  "expired",
  "draft",
  "terminated",
]);

export const reimbursementCategoryEnum = pgEnum("reimbursement_category", [
  "travel",
  "meals",
  "equipment",
  "training",
  "other",
]);
export const reimbursementPaymentMethodEnum = pgEnum("reimbursement_payment_method", [
  "payroll",
  "bank",
  "corporate_card",
]);
export const reimbursementCurrencyEnum = pgEnum("reimbursement_currency", ["EUR", "USD"]);

export const candidateStageEnum = pgEnum("candidate_stage", [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
]);

export const vacancyTypeEnum = pgEnum("vacancy_type", ["full_time", "part_time", "contractor"]);
export const vacancyStatusEnum = pgEnum("vacancy_status", ["open", "on_hold", "closed"]);
export const vacancyPriorityEnum = pgEnum("vacancy_priority", ["P0", "P1", "P2"]);
export const vacancyCurrencyEnum = pgEnum("vacancy_currency", ["EUR"]);

export const goalTypeEnum = pgEnum("goal_type", ["okr", "kpi"]);
export const goalStatusEnum = pgEnum("goal_status", ["on_track", "at_risk", "behind", "completed"]);

export const assetCategoryEnum = pgEnum("asset_category", [
  "laptop",
  "phone",
  "monitor",
  "access_card",
  "vehicle",
]);
export const assetStatusEnum = pgEnum("asset_status", [
  "assigned",
  "available",
  "maintenance",
  "retired",
  "lost",
  "disposed",
]);
export const assetConditionEnum = pgEnum("asset_condition", ["new", "good", "damaged"]);

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "payroll",
  "it",
  "facilities",
  "policy",
  "benefits",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "resolved"]);

export const skillCategoryEnum = pgEnum("skill_category", ["language", "certificate", "technical"]);
export const trainingStatusEnum = pgEnum("training_status", ["due", "upcoming", "completed"]);
export const appraisalStatusEnum = pgEnum("appraisal_status", [
  "completed",
  "draft",
  "in_progress",
]);

export const notificationTypeEnum = pgEnum("notification_type", ["info", "success", "warning"]);
export const activityTypeEnum = pgEnum("activity_type", [
  "leave",
  "payroll",
  "recruitment",
  "performance",
  "attendance",
  "system",
]);

// ====================================================================
// A. Lookup tables
// ====================================================================

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const titles = pgTable("titles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// ====================================================================
// B. Core: employees (the center of everything)
// ====================================================================

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  code: text("code").unique(), // display id, e.g. "EMP-001"

  // identity
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  titleId: integer("title_id").references(() => titles.id),
  jobTitle: text("job_title").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  location: text("location").notNull(),
  employmentType: employmentTypeEnum("employment_type").notNull(),
  status: employmentStatusEnum("status").notNull(),
  managerId: integer("manager_id").references((): AnyPgColumn => employees.id),
  hireDate: date("hire_date").notNull(),
  salary: numeric("salary", { precision: 12, scale: 2 }).notNull(), // sensitive
  performanceScore: integer("performance_score").notNull(),
  role: roleEnum("role").notNull().default("staff"),
  // platform login name (X-Auth-User) — links an SSO login to this employee
  authUser: text("auth_user").unique(),

  // personal (optional)
  dateOfBirth: date("date_of_birth"),
  gender: genderEnum("gender"),
  nationality: text("nationality"),
  phone: text("phone"),
  addressStreet: text("address_street"),
  addressZip: text("address_zip"),
  addressCity: text("address_city"),
  addressCountry: text("address_country"),

  // contract snapshot (optional)
  contractType: contractTypeEnum("contract_type"),
  contractStart: date("contract_start"),
  contractEnd: date("contract_end"),
  probationEnd: date("probation_end"),
  weeklyHours: numeric("weekly_hours", { precision: 5, scale: 2 }),
  vacationEntitlement: integer("vacation_entitlement"),
  noticePeriod: text("notice_period"),
  workplaceModel: workplaceModelEnum("workplace_model"),

  // pay & tax (optional, sensitive)
  taxId: text("tax_id"),
  socialSecurityNo: text("social_security_no"),
  taxClass: integer("tax_class"),
  children: integer("children"),
  religion: religionEnum("religion"),
  healthInsuranceType: healthInsuranceTypeEnum("health_insurance_type"),
  healthInsuranceProvider: text("health_insurance_provider"),
  iban: text("iban"),
  bic: text("bic"),
  costCenter: text("cost_center"),
  bonusTargetPct: numeric("bonus_target_pct", { precision: 5, scale: 2 }),

  // onboarding & balances (optional)
  buddyId: integer("buddy_id").references((): AnyPgColumn => employees.id),
  probationStatus: probationStatusEnum("probation_status"),
  lastReviewDate: date("last_review_date"),
  vacationUsed: integer("vacation_used"),
  vacationTotal: integer("vacation_total"),
  sickDaysYtd: integer("sick_days_ytd"),

  ...timestamps,
});

// ====================================================================
// C. People domain
// ====================================================================

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  name: text("name").notNull(),
  serial: text("serial").notNull(),
  assetTag: text("asset_tag"),
  category: assetCategoryEnum("category").notNull(),
  status: assetStatusEnum("status").notNull(),
  assignedToEmployeeId: integer("assigned_to_employee_id").references(() => employees.id),
  purchaseDate: date("purchase_date"),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
  vendor: text("vendor"),
  warrantyUntil: date("warranty_until"),
  location: text("location"),
  condition: assetConditionEnum("condition"),
  os: text("os"),
  encryptionEnabled: boolean("encryption_enabled"),
  assignedSince: date("assigned_since"),
  insuranceCovered: boolean("insurance_covered"),
  notes: text("notes"),
  ...timestamps,
});

export const helpdeskTickets = pgTable("helpdesk_tickets", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  subject: text("subject").notNull(),
  requester: text("requester").notNull(),
  assignee: text("assignee"),
  category: ticketCategoryEnum("category").notNull(),
  priority: ticketPriorityEnum("priority").notNull(),
  status: ticketStatusEnum("status").notNull(),
  ...timestamps,
});

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: skillCategoryEnum("category").notNull(),
  expiresAt: date("expires_at"),
  ...timestamps,
});

export const complianceTrainings = pgTable("compliance_trainings", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dueDate: date("due_date"),
  status: trainingStatusEnum("status").notNull(),
  ...timestamps,
});

export const careerGoals = pgTable("career_goals", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  progress: integer("progress").notNull().default(0),
  lastUpdate: date("last_update"),
  ...timestamps,
});

// ====================================================================
// D. Attendance domain
// ====================================================================

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  clockIn: text("clock_in"), // "HH:MM"
  clockOut: text("clock_out"),
  workedHours: numeric("worked_hours", { precision: 5, scale: 2 }),
  location: text("location"),
  gpsLat: doublePrecision("gps_lat"),
  gpsLng: doublePrecision("gps_lng"),
  // Standort beim Ausstempeln (separat vom Einstempel-Standort).
  locationOut: text("location_out"),
  gpsOutLat: doublePrecision("gps_out_lat"),
  gpsOutLng: doublePrecision("gps_out_lng"),
  status: attendanceStatusEnum("status").notNull(),
  method: attendanceMethodEnum("method"),
  ...timestamps,
});

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  type: leaveTypeEnum("type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: integer("days").notNull(),
  reason: text("reason"),
  status: requestStatusEnum("status").notNull(),
  approver: text("approver"),
  submittedAt: timestamp("submitted_at"),
  ...timestamps,
});

export const overtimeRequests = pgTable("overtime_requests", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
  reason: text("reason"),
  status: requestStatusEnum("status").notNull(),
  submittedAt: timestamp("submitted_at"),
  ...timestamps,
});

// ====================================================================
// E. Payroll domain
// ====================================================================

export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: contractTypeEnum("type").notNull(),
  hoursPerWeek: numeric("hours_per_week", { precision: 5, scale: 2 }),
  noticePeriodWeeks: integer("notice_period_weeks"),
  clauses: jsonb("clauses").$type<string[]>().notNull().default([]),
  ...timestamps,
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  jobTitle: text("job_title").notNull(),
  type: contractTypeEnum("type").notNull(),
  status: contractStatusEnum("status").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // nullable = open-ended
  salary: numeric("salary", { precision: 12, scale: 2 }).notNull(),
  hoursPerWeek: numeric("hours_per_week", { precision: 5, scale: 2 }),
  noticePeriodWeeks: integer("notice_period_weeks"),
  templateId: integer("template_id").references(() => contractTemplates.id),
  signedAt: timestamp("signed_at"),
  ...timestamps,
});

export const payslips = pgTable("payslips", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // "2026-05"
  gross: numeric("gross", { precision: 12, scale: 2 }).notNull(),
  net: numeric("net", { precision: 12, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull(),
  status: payslipStatusEnum("status").notNull(),
  ...timestamps,
});

export const payslipLines = pgTable("payslip_lines", {
  id: serial("id").primaryKey(),
  payslipId: integer("payslip_id")
    .notNull()
    .references(() => payslips.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: payslipLineTypeEnum("type").notNull(),
  ...timestamps,
});

export const reimbursements = pgTable("reimbursements", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  category: reimbursementCategoryEnum("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  description: text("description"),
  status: requestStatusEnum("status").notNull(),
  vat: integer("vat").notNull().default(0), // 0 / 7 / 19
  costCenter: text("cost_center"),
  receiptUrl: text("receipt_url"),
  paymentMethod: reimbursementPaymentMethodEnum("payment_method"),
  currency: reimbursementCurrencyEnum("currency").notNull().default("EUR"),
  approver: text("approver"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  processingDays: integer("processing_days"),
  ...timestamps,
});

// ====================================================================
// F. Recruitment domain
// ====================================================================

export const vacancies = pgTable("vacancies", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  title: text("title").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  location: text("location"),
  type: vacancyTypeEnum("type").notNull(),
  status: vacancyStatusEnum("status").notNull(),
  openedAt: date("opened_at"),
  hiringManager: text("hiring_manager"),
  recruiter: text("recruiter"),
  requiredStartDate: date("required_start_date"),
  costCenter: text("cost_center"),
  priority: vacancyPriorityEnum("priority"),
  workplaceModel: workplaceModelEnum("workplace_model"),
  salaryMin: numeric("salary_min", { precision: 12, scale: 2 }),
  salaryMax: numeric("salary_max", { precision: 12, scale: 2 }),
  currency: vacancyCurrencyEnum("currency").default("EUR"),
  ...timestamps,
  // note: `applicants` and the funnel are NOT stored — computed from candidates
});

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"),
  departmentId: integer("department_id").references(() => departments.id),
  location: text("location"),
  vacancyId: integer("vacancy_id").references(() => vacancies.id),
  stage: candidateStageEnum("stage").notNull(),
  rating: integer("rating"),
  source: text("source"),
  appliedAt: date("applied_at"),
  resumeUrl: text("resume_url"),
  ...timestamps,
});

// ====================================================================
// G. Performance domain
// ====================================================================

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: goalTypeEnum("type").notNull(),
  progress: integer("progress").notNull().default(0),
  status: goalStatusEnum("status").notNull(),
  quarter: text("quarter"),
  weight: integer("weight"),
  ...timestamps,
});

export const appraisals = pgTable("appraisals", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  quarter: text("quarter"),
  overallRating: integer("overall_rating"), // 1..5
  comment: text("comment"),
  status: appraisalStatusEnum("status").notNull(),
  scoreFachkompetenz: integer("score_fachkompetenz"),
  scoreZusammenarbeit: integer("score_zusammenarbeit"),
  scoreKommunikation: integer("score_kommunikation"),
  scoreEigeninitiative: integer("score_eigeninitiative"),
  ...timestamps,
});

// ====================================================================
// H. System domain
// ====================================================================

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  eventAt: timestamp("event_at").notNull().defaultNow(),
  read: boolean("read").notNull().default(false),
  type: notificationTypeEnum("type").notNull(),
  ...timestamps,
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  eventAt: timestamp("event_at").notNull().defaultNow(),
  type: activityTypeEnum("type").notNull(),
  ...timestamps,
});

// Onboarding-Checkliste: ein Eintrag je (Mitarbeiter, Aufgaben-Index).
// Persistiert das Abhaken der Aufgaben pro neuem Mitarbeiter.
export const onboardingTasks = pgTable(
  "onboarding_tasks",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    taskIndex: integer("task_index").notNull(),
    done: boolean("done").notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    employeeTaskUnique: unique("onboarding_emp_task_unique").on(t.employeeId, t.taskIndex),
  }),
);
