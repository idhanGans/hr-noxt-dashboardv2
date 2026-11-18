# Database Blueprint (Phase 1)

> The plan for our database, drawn from the data the frontend already uses.
> **No code here** — this is the map we build from in Phase 2.
> Written in plain language for a beginner.

---

## How to read this document

- A **table** = one kind of thing (like one sheet in a spreadsheet).
- A **field** = one column in that sheet (e.g. `email`).
- **PK** = Primary Key = the unique ID of a row.
- **FK** = Foreign Key = a field that points to a row in another table
  (this is how tables "link" together).
- **enum** = the field may only hold one value from a fixed list.

We use `snake_case` names (all lowercase, words joined by `_`) because that's
the normal style for databases.

**Two rules we apply to every table** (so I won't repeat them below):
1. Every table has an `id` (PK).
2. Every table has `created_at` and `updated_at` (timestamps) so we know when
   a row was made or last changed.

---

## The map (how the tables link)

```
                         +---------------+
                         |  departments  |
                         +-------+-------+
                                 ^
                                 | (each employee belongs to one)
                                 |
   +------------+        +-------+--------+        +-----------+
   |   titles   |<-------+    employees   +------->| employees | (manager_id,
   +------------+        +-------+--------+        +-----------+  buddy_id =
                                 |                                self-link)
        +------------------------+------------------------+
        |          |          |          |        |       |
        v          v          v          v        v       v
   attendance   leave_     payslips   contracts  goals  assets
   _records     requests      |          |               (assigned_to)
                              v          ^
                        payslip_lines    |
                                    contract_templates
        |          |          |          |        |
        v          v          v          v        v
   overtime_   reimburse-  appraisals  skills   compliance_
   requests    ments                            trainings
                                                career_goals
                                                helpdesk_tickets

   recruitment side:   vacancies  <----  candidates
   system side:        notifications     activity_log
```

The big idea: **`employees` is the center.** Almost everything points back to
an employee with an `employee_id` foreign key.

---

## A. Lookup tables (small fixed lists)

These hold the company's fixed lists so other tables can point at them
instead of repeating text everywhere.

### `departments`
The 14 company departments (HR, Electro, Photovoltaik, Fenster, Marketing, …).
| field | notes |
|---|---|
| `id` (PK) | |
| `name` | e.g. "Photovoltaik" — unique |

### `titles`
The 3 levels: Manager, Coordinator, Staff.
| field | notes |
|---|---|
| `id` (PK) | |
| `name` | "Manager" / "Coordinator" / "Staff" |

> Beginner note: these could also be a fixed "enum" instead of tables. Tables
> are nicer here because the company list may grow over time.

---

## B. Core table

### `employees`  ⭐ (the center of everything)
All the people. The frontend's `Employee` type is big, so we flatten its
sub-objects (address, insurance, vacation balance) into plain columns.

**Basic identity**
| field | type / notes |
|---|---|
| `id` (PK) | |
| `code` | the human ID like "EMP-001" (optional, for display) |
| `first_name`, `last_name`, `email` | email is unique |
| `avatar_url` | optional |
| `title_id` (FK → titles) | |
| `job_title` | free text, e.g. "PV-Installateur" |
| `department_id` (FK → departments) | |
| `location` | |
| `employment_type` | enum: full_time / part_time / contractor / intern |
| `status` | enum: active / onboarding / on_leave / offboarding / terminated |
| `manager_id` (FK → employees) | self-link: who they report to |
| `hire_date` | |
| `salary` | sensitive — managers only |
| `performance_score` | |
| `role` | enum: manager / admin / staff — controls access (see "Access model") |

**Personal data (optional)**
| field | notes |
|---|---|
| `date_of_birth`, `gender` (m/f/d), `nationality`, `phone` | |
| `address_street`, `address_zip`, `address_city`, `address_country` | flattened address |

**Contract snapshot (optional)**
| field | notes |
|---|---|
| `contract_type` | enum: permanent / fixed_term / part_time / working_student / intern / mini_job / freelance |
| `contract_start`, `contract_end`, `probation_end` | |
| `weekly_hours`, `vacation_entitlement`, `notice_period` | |
| `workplace_model` | enum: office / hybrid / remote |

**Pay & tax (optional, sensitive)**
| field | notes |
|---|---|
| `tax_id`, `social_security_no` | sensitive |
| `tax_class` (1–6), `children`, `religion` | |
| `health_insurance_type` (statutory/private), `health_insurance_provider` | flattened |
| `iban`, `bic` | sensitive |
| `cost_center`, `bonus_target_pct` | |

**Onboarding & balances (optional)**
| field | notes |
|---|---|
| `buddy_id` (FK → employees) | self-link: onboarding buddy |
| `probation_status` | enum: active / passed / pending_review |
| `last_review_date` | |
| `vacation_used`, `vacation_total` | flattened vacation balance |
| `sick_days_ytd` | |

> The "required trainings" and "provisioned assets" from the wizard are NOT
> columns here — they become rows in `compliance_trainings` and links in
> `assets` (see below). That's cleaner than stuffing lists into one cell.

---

## C. People domain

### `assets` (laptops, phones, vehicles, …)
| field | notes |
|---|---|
| `id` (PK), `name`, `serial`, `asset_tag` | |
| `category` | enum: laptop / phone / monitor / access_card / vehicle |
| `status` | enum: assigned / available / maintenance / retired / lost / disposed |
| `assigned_to_employee_id` (FK → employees) | null = not assigned |
| `purchase_date`, `purchase_price`, `vendor`, `warranty_until` | |
| `location`, `condition` (new/good/damaged), `os`, `encryption_enabled` | |
| `assigned_since`, `insurance_covered`, `notes` | |

### `helpdesk_tickets`
| field | notes |
|---|---|
| `id` (PK), `subject`, `requester`, `assignee` | |
| `category` | enum: payroll / it / facilities / policy / benefits |
| `priority` | enum: low / medium / high / urgent |
| `status` | enum: open / in_progress / resolved |
| `created_at` | (already standard) |

### `skills` (per employee)
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `name` | |
| `category` | enum: language / certificate / technical |
| `expires_at` | optional |

### `compliance_trainings` (per employee)
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `name`, `due_date` | |
| `status` | enum: due / upcoming / completed |

### `career_goals` (per employee, ESS)
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `title`, `progress`, `last_update` | |

---

## D. Attendance domain

### `attendance_records`
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `date` | |
| `clock_in`, `clock_out`, `worked_hours`, `location` | |
| `status` | enum: present / remote / late / absent / on_leave |
| `method` | enum: office / gps / biometric |

### `leave_requests`
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `start_date`, `end_date`, `days`, `reason` | |
| `type` | enum: annual / sick / parental / unpaid / bereavement |
| `status` | enum: pending / approved / rejected / cancelled |
| `approver`, `submitted_at` | |

### `overtime_requests`  (NEW — implied by the timesheet "overtime" flow)
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `date`, `hours`, `reason` | |
| `status` | enum: pending / approved / rejected / cancelled |
| `submitted_at` | |

---

## E. Payroll domain

### `contract_templates`
| field | notes |
|---|---|
| `id` (PK), `name`, `description` | |
| `type` | enum: same as employee contract_type |
| `hours_per_week`, `notice_period_weeks` | |
| `clauses` | list of clause texts → store as a JSON/text array for now |

### `contracts`
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `job_title` | |
| `type` | enum: contract_type |
| `status` | enum: active / expiring_soon / expired / draft / terminated |
| `start_date`, `end_date` (nullable), `salary`, `hours_per_week`, `notice_period_weeks` | |
| `template_id` (FK → contract_templates) | |
| `signed_at` | optional |

### `payslips`
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `period` (e.g. "2026-05") | |
| `gross`, `net`, `tax` | |
| `status` | enum: paid / processing / scheduled |

### `payslip_lines`  (a payslip has many lines)
| field | notes |
|---|---|
| `id` (PK), `payslip_id` (FK → payslips), `label`, `amount` | |
| `type` | enum: earning / deduction |

### `reimbursements`
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `amount`, `date`, `description` | |
| `category` | enum: travel / meals / equipment / training / other |
| `status` | enum: pending / approved / rejected / cancelled |
| `vat` (0/7/19), `cost_center`, `receipt_url` | |
| `payment_method` | enum: payroll / bank / corporate_card |
| `currency` (EUR/USD), `approver`, `submitted_at`, `approved_at`, `processing_days` | |

---

## F. Recruitment domain

### `vacancies` (open jobs)
| field | notes |
|---|---|
| `id` (PK), `title`, `department_id` (FK → departments), `location` | |
| `type` | enum: full_time / part_time / contractor |
| `status` | enum: open / on_hold / closed |
| `applicants` | (or count from candidates — see "Not tables") |
| `opened_at`, `hiring_manager`, `recruiter`, `required_start_date`, `cost_center` | |
| `priority` (P0/P1/P2), `workplace_model`, `salary_min`, `salary_max`, `currency` | |

### `candidates`
| field | notes |
|---|---|
| `id` (PK), `name`, `email`, `role`, `department_id` (FK → departments), `location` | |
| `vacancy_id` (FK → vacancies) | which job they applied to (NEW link) |
| `stage` | enum: applied / screening / interview / offer / hired / rejected |
| `rating`, `source`, `applied_at`, `resume_url` | |

> The vacancy `funnel` (counts per stage) and `source_mix` in the frontend are
> **calculated** from candidates — see "Not tables".

---

## G. Performance domain

### `goals` (OKRs / KPIs)
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `title`, `quarter`, `weight`, `progress` | |
| `type` | enum: okr / kpi |
| `status` | enum: on_track / at_risk / behind / completed |

### `appraisals` (performance reviews)
| field | notes |
|---|---|
| `id` (PK), `employee_id` (FK → employees), `quarter` | |
| `overall_rating` | 1–5 |
| `comment` | |
| `status` | enum: completed / draft / in_progress |
| `score_fachkompetenz`, `score_zusammenarbeit`, `score_kommunikation`, `score_eigeninitiative` | each 1–5 |

---

## H. System domain

### `notifications`
| field | notes |
|---|---|
| `id` (PK), `title`, `description`, `timestamp`, `read` (true/false) | |
| `type` | enum: info / success / warning |

### `activity_log` (the "recent activity" feed)
| field | notes |
|---|---|
| `id` (PK), `actor`, `action`, `target`, `timestamp` | |
| `type` | enum: leave / payroll / recruitment / performance / attendance / system |

---

## NOT tables (these are calculated, not stored)

Important beginner lesson: **don't store numbers you can calculate.** These
things in the frontend are *derived* from the tables above, so the backend
computes them on request instead of saving them:

| Frontend thing | How it's really produced |
|---|---|
| KPIs (headcount, avg salary, etc.) | counted/summed from `employees` etc. |
| `headcountByDept` | group `employees` by department |
| attendance / payroll / recruitment trends | grouped over time from their tables |
| vacancy `funnel` + `source_mix` | counted from `candidates` |
| `approvals` queue | the pending rows from `leave_requests` + `reimbursements` + `overtime_requests` |
| `vacationBalance`, `sickDaysYtd` (could be) | derivable from `leave_requests` |

---

## Summary count

About **22 tables**, grouped into 8 areas:

| Area | Tables |
|---|---|
| Lookup | departments, titles |
| Core | employees |
| People | assets, helpdesk_tickets, skills, compliance_trainings, career_goals |
| Attendance | attendance_records, leave_requests, overtime_requests |
| Payroll | contract_templates, contracts, payslips, payslip_lines, reimbursements |
| Recruitment | vacancies, candidates |
| Performance | goals, appraisals |
| System | notifications, activity_log |

---

## Decisions (locked in 2026-06-08)

1. **IDs:** real auto-number/UUID as the actual PK, **plus** keep the pretty
   code (e.g. "EMP-001") as a separate `code` display column. ✅
2. **Sensitive fields** (`salary`, `iban`, `tax_id`, `social_security_no`):
   readable by **managers only**. ✅
3. **department / title:** lookup **tables** (not fixed enums). ✅
4. **Auth/users:** an employee **is** a login user. Each employee has a
   `role` (manager / admin / staff) that controls access. ✅

---

## Access model (who can see/do what)

Three roles, from most to least access. This shapes the **API** in Phase 3
(the backend checks the role on every request).

| Role | Can see | Can edit? | Sensitive fields (salary, iban, tax_id, social_security_no) |
|---|---|---|---|
| **manager** | everything | yes | **visible** |
| **admin** | most data | **no — read-only** | **hidden** |
| **staff** | attendance only | their own clock-in/out | **hidden** |

> ⚠️ **Naming note (don't get confused):** "role" (access level:
> manager/admin/staff) is a **different thing** from "title" (job level:
> Manager/Coordinator/Staff). One is about *permissions*, the other about
> *position*. A person could have title = Staff but role = admin. They live
> in two separate fields.

**Still to refine (Phase 3, not blocking the tables):**
- Does "staff sees attendance" mean *only their own*, or everyone's? (ESS
  pages suggest staff also see their *own* profile, payslips, leave.)
- Is `admin` truly edit-nothing, or edit-non-sensitive only?
