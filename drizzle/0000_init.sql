CREATE TYPE "public"."activity_type" AS ENUM('leave', 'payroll', 'recruitment', 'performance', 'attendance', 'system');--> statement-breakpoint
CREATE TYPE "public"."appraisal_status" AS ENUM('completed', 'draft', 'in_progress');--> statement-breakpoint
CREATE TYPE "public"."asset_category" AS ENUM('laptop', 'phone', 'monitor', 'access_card', 'vehicle');--> statement-breakpoint
CREATE TYPE "public"."asset_condition" AS ENUM('new', 'good', 'damaged');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('assigned', 'available', 'maintenance', 'retired', 'lost', 'disposed');--> statement-breakpoint
CREATE TYPE "public"."attendance_method" AS ENUM('office', 'gps', 'biometric');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'remote', 'late', 'absent', 'on_leave');--> statement-breakpoint
CREATE TYPE "public"."candidate_stage" AS ENUM('applied', 'screening', 'interview', 'offer', 'hired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('active', 'expiring_soon', 'expired', 'draft', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('permanent', 'fixed_term', 'part_time', 'working_student', 'intern', 'mini_job', 'freelance');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('active', 'onboarding', 'on_leave', 'offboarding', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contractor', 'intern');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('m', 'f', 'd');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('on_track', 'at_risk', 'behind', 'completed');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('okr', 'kpi');--> statement-breakpoint
CREATE TYPE "public"."health_insurance_type" AS ENUM('statutory', 'private');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('annual', 'sick', 'parental', 'unpaid', 'bereavement');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('info', 'success', 'warning');--> statement-breakpoint
CREATE TYPE "public"."payslip_line_type" AS ENUM('earning', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."payslip_status" AS ENUM('paid', 'processing', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."probation_status" AS ENUM('active', 'passed', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."reimbursement_category" AS ENUM('travel', 'meals', 'equipment', 'training', 'other');--> statement-breakpoint
CREATE TYPE "public"."reimbursement_currency" AS ENUM('EUR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."reimbursement_payment_method" AS ENUM('payroll', 'bank', 'corporate_card');--> statement-breakpoint
CREATE TYPE "public"."religion" AS ENUM('rk', 'ev', 'keine', 'sonst');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('manager', 'admin', 'staff');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('language', 'certificate', 'technical');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('payroll', 'it', 'facilities', 'policy', 'benefits');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."training_status" AS ENUM('due', 'upcoming', 'completed');--> statement-breakpoint
CREATE TYPE "public"."vacancy_currency" AS ENUM('EUR');--> statement-breakpoint
CREATE TYPE "public"."vacancy_priority" AS ENUM('P0', 'P1', 'P2');--> statement-breakpoint
CREATE TYPE "public"."vacancy_status" AS ENUM('open', 'on_hold', 'closed');--> statement-breakpoint
CREATE TYPE "public"."vacancy_type" AS ENUM('full_time', 'part_time', 'contractor');--> statement-breakpoint
CREATE TYPE "public"."workplace_model" AS ENUM('office', 'hybrid', 'remote');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"event_at" timestamp DEFAULT now() NOT NULL,
	"type" "activity_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appraisals" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"employee_id" integer NOT NULL,
	"quarter" text,
	"overall_rating" integer,
	"comment" text,
	"status" "appraisal_status" NOT NULL,
	"score_fachkompetenz" integer,
	"score_zusammenarbeit" integer,
	"score_kommunikation" integer,
	"score_eigeninitiative" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appraisals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"serial" text NOT NULL,
	"asset_tag" text,
	"category" "asset_category" NOT NULL,
	"status" "asset_status" NOT NULL,
	"assigned_to_employee_id" integer,
	"purchase_date" date,
	"purchase_price" numeric(12, 2),
	"vendor" text,
	"warranty_until" date,
	"location" text,
	"condition" "asset_condition",
	"os" text,
	"encryption_enabled" boolean,
	"assigned_since" date,
	"insurance_covered" boolean,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"date" date NOT NULL,
	"clock_in" text,
	"clock_out" text,
	"worked_hours" numeric(5, 2),
	"location" text,
	"status" "attendance_status" NOT NULL,
	"method" "attendance_method",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"email" text,
	"role" text,
	"department_id" integer,
	"location" text,
	"vacancy_id" integer,
	"stage" "candidate_stage" NOT NULL,
	"rating" integer,
	"source" text,
	"applied_at" date,
	"resume_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "career_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"title" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"last_update" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_trainings" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"name" text NOT NULL,
	"due_date" date,
	"status" "training_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "contract_type" NOT NULL,
	"hours_per_week" numeric(5, 2),
	"notice_period_weeks" integer,
	"clauses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"employee_id" integer NOT NULL,
	"job_title" text NOT NULL,
	"type" "contract_type" NOT NULL,
	"status" "contract_status" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"salary" numeric(12, 2) NOT NULL,
	"hours_per_week" numeric(5, 2),
	"notice_period_weeks" integer,
	"template_id" integer,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"title_id" integer,
	"job_title" text NOT NULL,
	"department_id" integer,
	"location" text NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"status" "employment_status" NOT NULL,
	"manager_id" integer,
	"hire_date" date NOT NULL,
	"salary" numeric(12, 2) NOT NULL,
	"performance_score" integer NOT NULL,
	"role" "role" DEFAULT 'staff' NOT NULL,
	"date_of_birth" date,
	"gender" "gender",
	"nationality" text,
	"phone" text,
	"address_street" text,
	"address_zip" text,
	"address_city" text,
	"address_country" text,
	"contract_type" "contract_type",
	"contract_start" date,
	"contract_end" date,
	"probation_end" date,
	"weekly_hours" numeric(5, 2),
	"vacation_entitlement" integer,
	"notice_period" text,
	"workplace_model" "workplace_model",
	"tax_id" text,
	"social_security_no" text,
	"tax_class" integer,
	"children" integer,
	"religion" "religion",
	"health_insurance_type" "health_insurance_type",
	"health_insurance_provider" text,
	"iban" text,
	"bic" text,
	"cost_center" text,
	"bonus_target_pct" numeric(5, 2),
	"buddy_id" integer,
	"probation_status" "probation_status",
	"last_review_date" date,
	"vacation_used" integer,
	"vacation_total" integer,
	"sick_days_ytd" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_code_unique" UNIQUE("code"),
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"employee_id" integer NOT NULL,
	"title" text NOT NULL,
	"type" "goal_type" NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" "goal_status" NOT NULL,
	"quarter" text,
	"weight" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"subject" text NOT NULL,
	"requester" text NOT NULL,
	"assignee" text,
	"category" "ticket_category" NOT NULL,
	"priority" "ticket_priority" NOT NULL,
	"status" "ticket_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "helpdesk_tickets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"employee_id" integer NOT NULL,
	"type" "leave_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer NOT NULL,
	"reason" text,
	"status" "request_status" NOT NULL,
	"approver" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_requests_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_at" timestamp DEFAULT now() NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"type" "notification_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overtime_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"employee_id" integer NOT NULL,
	"date" date NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"reason" text,
	"status" "request_status" NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "overtime_requests_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payslip_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"payslip_id" integer NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" "payslip_line_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"employee_id" integer NOT NULL,
	"period" text NOT NULL,
	"gross" numeric(12, 2) NOT NULL,
	"net" numeric(12, 2) NOT NULL,
	"tax" numeric(12, 2) NOT NULL,
	"status" "payslip_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payslips_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "reimbursements" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"employee_id" integer NOT NULL,
	"category" "reimbursement_category" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"status" "request_status" NOT NULL,
	"vat" integer DEFAULT 0 NOT NULL,
	"cost_center" text,
	"receipt_url" text,
	"payment_method" "reimbursement_payment_method",
	"currency" "reimbursement_currency" DEFAULT 'EUR' NOT NULL,
	"approver" text,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"processing_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reimbursements_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" "skill_category" NOT NULL,
	"expires_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "titles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "vacancies" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"title" text NOT NULL,
	"department_id" integer,
	"location" text,
	"type" "vacancy_type" NOT NULL,
	"status" "vacancy_status" NOT NULL,
	"opened_at" date,
	"hiring_manager" text,
	"recruiter" text,
	"required_start_date" date,
	"cost_center" text,
	"priority" "vacancy_priority",
	"workplace_model" "workplace_model",
	"salary_min" numeric(12, 2),
	"salary_max" numeric(12, 2),
	"currency" "vacancy_currency" DEFAULT 'EUR',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vacancies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_vacancy_id_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_goals" ADD CONSTRAINT "career_goals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_trainings" ADD CONSTRAINT "compliance_trainings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_employees_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_buddy_id_employees_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;