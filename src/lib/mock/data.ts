import type {
  ActivityItem,
  ApprovalItem,
  Asset,
  AttendanceRecord,
  AttendanceStatus,
  Candidate,
  CandidateStage,
  Contract,
  ContractStatus,
  ContractTemplate,
  ContractType,
  Employee,
  EmploymentStatus,
  Gender,
  Goal,
  HealthInsuranceType,
  HelpdeskTicket,
  JobVacancy,
  Kpi,
  LeaveRequest,
  LeaveType,
  NotificationItem,
  Payslip,
  Reimbursement,
  Religion,
  RequestStatus,
  TaxClass,
  Title,
  TimeSeriesPoint,
  WorkplaceModel,
} from "@/types";
import { DEPARTMENTS, JOB_TITLES, SEED_EMPLOYEES } from "@/config/options";
import { buildDeIban, deriveBicFromIban } from "@/lib/iban";

// Deterministic PRNG so server and client render identical data.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;

const FIRST = [
  "Anna", "Lukas", "Mia", "Jonas", "Emma", "Felix", "Lea", "Paul", "Sophie",
  "Noah", "Marie", "Elias", "Hannah", "Ben", "Lara", "David", "Clara", "Tim",
  "Sara", "Max", "Nora", "Jan", "Lena", "Tom", "Julia", "Niklas", "Eva", "Finn",
];
const LAST = [
  "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner",
  "Becker", "Hoffmann", "Schäfer", "Koch", "Bauer", "Richter", "Klein",
  "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger",
];
const LOCATIONS = ["Berlin", "München", "Hamburg", "Köln", "Remote — DE", "Wien", "Zürich"];

function pickTitle(): Title {
  const r = rand();
  if (r < 0.05) return "Manager";
  if (r < 0.17) return "Coordinator";
  return "Staff";
}
const STATUSES: EmploymentStatus[] = ["active", "active", "active", "active", "onboarding", "on_leave", "offboarding"];

const EMPLOYEE_COUNT = 128;

// --- Backfill helpers for the extended wizard fields ---------------------
const GENDERS: Gender[] = ["m", "f", "d"];
const NATIONALITIES = ["DE", "AT", "CH", "NL", "FR", "ES", "IT", "PL", "TR", "ID"];
const CONTRACT_TYPES: ContractType[] = [
  "permanent",
  "permanent",
  "permanent",
  "fixed_term",
  "part_time",
  "working_student",
  "intern",
  "mini_job",
];
const WORKPLACE_MODELS: WorkplaceModel[] = ["office", "office", "hybrid", "remote"];
const NOTICE_PERIODS = [
  "4w_eom",
  "1m_eom",
  "2m_eom",
  "3m_eom",
  "6m_eoq",
];
const RELIGIONS: Religion[] = ["rk", "ev", "keine", "keine", "sonst"];
const INSURANCE_TYPES: HealthInsuranceType[] = ["statutory", "statutory", "statutory", "private"];
const INSURERS_STATUTORY = ["TK", "AOK", "Barmer", "DAK", "IKK classic"];
const INSURERS_PRIVATE = ["Allianz PKV", "DKV", "AXA", "Signal Iduna"];
const STREETS = [
  "Hauptstraße",
  "Bahnhofstraße",
  "Schulstraße",
  "Goethestraße",
  "Schillerstraße",
  "Lindenweg",
  "Birkenallee",
  "Rosenweg",
  "Marktplatz",
  "Mühlenweg",
];
const CITIES_ZIP: Array<[string, string]> = [
  ["Berlin", "10115"],
  ["München", "80331"],
  ["Hamburg", "20095"],
  ["Köln", "50667"],
  ["Frankfurt", "60311"],
  ["Stuttgart", "70173"],
  ["Düsseldorf", "40213"],
  ["Leipzig", "04109"],
];
const TRAINING_POOL = [
  "Datenschutz",
  "Arbeitssicherheit",
  "Compliance Code of Conduct",
  "Brandschutz",
  "Erste Hilfe",
  "Phishing-Awareness",
];
const ASSET_POOL = ["Laptop", "Phone", "Access card", "Monitor", "Headset", "Docking station"];

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Some deterministic German BLZ samples so the resulting IBANs look realistic.
const BLZ_POOL = [
  "37040044", // Commerzbank Köln
  "10010010", // Postbank Berlin
  "70150000", // Stadtsparkasse München
  "20030000", // DB Privat- und Firmenkundenbank
  "50010060", // ING-DiBa
];

function pickN<T>(pool: readonly T[], n: number): T[] {
  const out: T[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < pool.length) {
    const idx = Math.floor(rand() * pool.length);
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(pool[idx]);
  }
  return out;
}

export const employees: Employee[] = Array.from({ length: EMPLOYEE_COUNT }, (_, i) => {
  const seed = SEED_EMPLOYEES[i];
  const first = seed ? seed.firstName : pick(FIRST);
  const last = seed ? seed.lastName : pick(LAST);
  const department = seed ? seed.department : pick(DEPARTMENTS);
  const title = seed ? seed.title : pickTitle();
  const status = STATUSES[i % STATUSES.length];
  const hireYear = between(2015, 2025);
  const hireDate = `${hireYear}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`;
  const contractType = CONTRACT_TYPES[i % CONTRACT_TYPES.length];
  const employmentType = pick(["full_time", "full_time", "full_time", "part_time", "contractor", "intern"] as const);

  // Address
  const [city, zip] = CITIES_ZIP[i % CITIES_ZIP.length];
  const street = `${pick(STREETS)} ${between(1, 199)}`;

  // Bank
  const blz = BLZ_POOL[i % BLZ_POOL.length];
  const acct = String(1_000_000_000 + between(0, 999_999_999)).slice(-10);
  const iban = buildDeIban(blz, acct);
  const bic = deriveBicFromIban(iban);

  // Insurance
  const insType = INSURANCE_TYPES[i % INSURANCE_TYPES.length];
  const provider = insType === "statutory" ? pick(INSURERS_STATUTORY) : pick(INSURERS_PRIVATE);

  // Tax ID — 11 digits formatted "00 000 000 000"
  const taxIdRaw = String(10_000_000_000 + between(0, 89_999_999_999)).slice(-11);
  const taxId = `${taxIdRaw.slice(0, 2)} ${taxIdRaw.slice(2, 5)} ${taxIdRaw.slice(5, 8)} ${taxIdRaw.slice(8, 11)}`;
  // Social-security number — 12-char mix of digits + 2 letters as in DE
  const ssn = `${String(between(10, 99))}${String(between(100000, 999999))}${"ABCDEFGHJKLMNPQRSTVWX".charAt(
    Math.floor(rand() * 21),
  )}${String(between(10, 99))}`;

  const requiredTrainings = pickN(TRAINING_POOL, between(2, 4));
  const provisionedAssets = pickN(ASSET_POOL, between(2, 4));

  // Mehrstufige Berichtslinie, damit das Organigramm mehrere Ebenen tief ist
  // (statt flach zweistufig): Index 0 = CEO (Wurzel) -> 1..8 Abteilungsleitung
  // -> 9..24 Teamleitung -> ab 25 Team. Manager-Index ist stets kleiner als der
  // eigene Index, also garantiert zyklenfrei.
  const managerId =
    i === 0
      ? undefined
      : i <= 8
        ? "EMP-0001"
        : i <= 24
          ? `EMP-${String(2 + (i % 8)).padStart(4, "0")}`
          : `EMP-${String(10 + (i % 16)).padStart(4, "0")}`;

  return {
    id: `EMP-${String(i + 1).padStart(4, "0")}`,
    firstName: first,
    lastName: last,
    email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, "")}@noxt.io`,
    title,
    jobTitle: pick(JOB_TITLES[department]),
    department,
    location: pick(LOCATIONS),
    employmentType,
    status,
    managerId,
    hireDate,
    salary: between(42, 145) * 1000,
    performanceScore: between(58, 98),

    // Wizard-backfilled optional fields ----------------------------------
    dateOfBirth: `${between(1965, 2000)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`,
    gender: GENDERS[i % GENDERS.length],
    nationality: NATIONALITIES[i % NATIONALITIES.length],
    phone: `+4915${between(10_000_000, 99_999_999)}`,
    address: { street, zip, city, country: "DE" },

    contractType,
    contractStart: hireDate,
    contractEnd: contractType === "fixed_term" ? addMonths(hireDate, 24) : undefined,
    probationEnd: addMonths(hireDate, 6),
    weeklyHours: employmentType === "part_time" ? 20 : employmentType === "intern" ? 30 : 40,
    vacationEntitlement: 28,
    noticePeriod: NOTICE_PERIODS[i % NOTICE_PERIODS.length],
    workplaceModel: WORKPLACE_MODELS[i % WORKPLACE_MODELS.length],

    taxId,
    socialSecurityNo: ssn,
    taxClass: (((i % 6) + 1) as TaxClass),
    children: between(0, 3),
    religion: RELIGIONS[i % RELIGIONS.length],
    healthInsurance: { type: insType, provider },
    iban,
    bic,
    costCenter: `CC-${String(1000 + (i % 30)).padStart(4, "0")}`,
    bonusTargetPct: title === "Manager" ? between(15, 25) : title === "Coordinator" ? between(8, 14) : between(0, 8),

    buddyId: i > 0 ? `EMP-${String(((i + 7) % EMPLOYEE_COUNT) + 1).padStart(4, "0")}` : undefined,
    requiredTrainings,
    provisionedAssets,

    // List-page enrichment (deterministic — does not consume rand state) ---
    probationStatus: (() => {
      const m = i % 5;
      if (m < 3) return "passed";
      if (m === 3) return "active";
      return "pending_review";
    })(),
    lastReviewDate: addMonths("2026-05-30", -(((i * 3) % 9) + 1)),
    vacationBalance: {
      used: (i * 3 + 7) % 28,
      total: 28,
    },
    sickDaysYtd: (i * 2 + 1) % 36,
  } satisfies Employee;
});

const ATT_STATUS: AttendanceStatus[] = ["present", "present", "present", "remote", "remote", "late", "absent", "on_leave"];

export const attendance: AttendanceRecord[] = employees.slice(0, 80).map((e, i) => {
  const status = ATT_STATUS[i % ATT_STATUS.length];
  const worked = status === "absent" || status === "on_leave" ? 0 : between(6, 9);
  return {
    id: `ATT-${String(i + 1).padStart(4, "0")}`,
    employeeId: e.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    department: e.department,
    date: "2026-05-24",
    clockIn: worked ? `0${between(7, 9)}:${String(between(0, 59)).padStart(2, "0")}` : undefined,
    clockOut: worked ? `1${between(6, 8)}:${String(between(0, 59)).padStart(2, "0")}` : undefined,
    status,
    workedHours: worked,
    location: e.location,
    method: pick(["office", "gps", "biometric"]),
  };
});

const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "parental", "unpaid", "bereavement"];
const REQ_STATUS: RequestStatus[] = ["pending", "pending", "approved", "approved", "rejected"];

export const leaveRequests: LeaveRequest[] = employees.slice(0, 46).map((e, i) => {
  const days = between(1, 14);
  const startDay = between(1, 20);
  return {
    id: `LV-${String(i + 1).padStart(4, "0")}`,
    employeeId: e.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    type: LEAVE_TYPES[i % LEAVE_TYPES.length],
    startDate: `2026-06-${String(startDay).padStart(2, "0")}`,
    endDate: `2026-06-${String(Math.min(startDay + days, 30)).padStart(2, "0")}`,
    days,
    reason: pick(["Familienurlaub", "Erholung", "Arzttermin", "Persönliche Gründe", "Umzug", "Hochzeit"]),
    status: REQ_STATUS[i % REQ_STATUS.length],
    approver: `${pick(FIRST)} ${pick(LAST)}`,
    submittedAt: `2026-05-${String(between(1, 24)).padStart(2, "0")}`,
  };
});

export const payslips: Payslip[] = employees.slice(0, 60).map((e, i) => {
  const gross = e.salary / 12;
  const tax = Math.round(gross * 0.32);
  const social = Math.round(gross * 0.11);
  const net = Math.round(gross - tax - social);
  return {
    id: `PS-${String(i + 1).padStart(4, "0")}`,
    employeeId: e.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    period: "2026-05",
    gross: Math.round(gross),
    net,
    tax,
    status: pick(["paid", "paid", "processing", "scheduled"]),
    lines: [
      { label: "Grundgehalt", amount: Math.round(gross * 0.85), type: "earning" },
      { label: "Bonus", amount: Math.round(gross * 0.1), type: "earning" },
      { label: "Sachbezug", amount: Math.round(gross * 0.05), type: "earning" },
      { label: "Lohnsteuer", amount: -tax, type: "deduction" },
      { label: "Sozialabgaben", amount: -social, type: "deduction" },
    ],
  };
});

// Fixed "today" for deterministic date arithmetic across SSR/CSR.
const REIMB_TODAY = new Date(Date.UTC(2026, 4, 25));
function reimbDate(daysAgo: number): { date: string; iso: string } {
  const d = new Date(REIMB_TODAY);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return { date: d.toISOString().slice(0, 10), iso: d.toISOString() };
}

// ~40% pending, ~40% approved, 10% rejected, 10% cancelled
const REIMB_STATUS_DIST: RequestStatus[] = [
  "pending", "pending", "pending", "pending",
  "approved", "approved", "approved", "approved",
  "rejected", "cancelled",
];

const COST_CENTERS = [
  "CC-4100", "CC-4200", "CC-4300", "CC-4400",
  "CC-5100", "CC-5200", "CC-6100", "CC-6200",
  "CC-7100", "CC-7200",
];

const REIMB_PAYMENT_METHODS = ["payroll", "bank", "corporate_card"] as const;

export const reimbursements: Reimbursement[] = Array.from({ length: 59 }, (_, i) => {
  const e = employees[between(0, EMPLOYEE_COUNT - 1)];
  const status = REIMB_STATUS_DIST[i % REIMB_STATUS_DIST.length];
  const submittedDaysAgo = between(0, 59);
  const submitted = reimbDate(submittedDaysAgo);

  // approved/rejected get a processing window 1–10 days after submission,
  // capped at "today" so approvedAt never lies in the future.
  let approvedAt: string | undefined;
  let processingDays: number | undefined;
  if (status === "approved" || status === "rejected") {
    const proc = Math.min(between(1, 10), submittedDaysAgo);
    approvedAt = reimbDate(submittedDaysAgo - proc).iso;
    processingDays = proc;
  } else if (status === "pending") {
    processingDays = submittedDaysAgo;
  }

  const vat = pick([0, 7, 19] as const);
  const paymentMethod = pick(REIMB_PAYMENT_METHODS);
  const approver = employees[between(0, 9)];

  return {
    id: `RB-${String(i + 1).padStart(4, "0")}`,
    employeeId: e.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    category: pick(["travel", "meals", "equipment", "training", "other"]),
    amount: between(30, 2500),
    date: submitted.date,
    status,
    description: pick([
      "Bahnticket Kundentermin",
      "Team-Lunch",
      "Externer Monitor",
      "Konferenz-Ticket",
      "Taxi Flughafen",
      "Software-Lizenz",
      "Hotel Berlin",
      "Mietwagen München",
      "Schulung AWS",
      "Büromaterial",
    ]),
    vat,
    costCenter: pick(COST_CENTERS),
    receiptUrl: rand() > 0.3 ? `/mock/receipts/${`RB-${String(i + 1).padStart(4, "0")}`}.pdf` : undefined,
    approver: `${approver.firstName} ${approver.lastName}`,
    paymentMethod,
    currency: rand() > 0.95 ? "USD" : "EUR",
    submittedAt: submitted.iso,
    approvedAt,
    processingDays,
  };
});

const STAGES: CandidateStage[] = ["applied", "screening", "interview", "offer", "hired", "rejected"];
const ROLES = ["Senior Engineer", "Product Designer", "Account Executive", "Data Analyst", "Recruiter", "Finance Manager", "Customer Success Manager"];

export const candidates: Candidate[] = Array.from({ length: 52 }, (_, i) => {
  const first = pick(FIRST);
  const last = pick(LAST);
  return {
    id: `CND-${String(i + 1).padStart(4, "0")}`,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, "")}@mail.com`,
    role: pick(ROLES),
    department: pick(DEPARTMENTS),
    stage: STAGES[i % STAGES.length],
    rating: between(2, 5),
    source: pick(["LinkedIn", "Referral", "Karriereseite", "Agentur", "Job-Board"]),
    appliedAt: `2026-05-${String(between(1, 24)).padStart(2, "0")}`,
    resumeUrl: "#",
    location: pick(LOCATIONS),
  };
});

const VACANCY_SOURCES = [
  "LinkedIn",
  "StepStone",
  "Indeed",
  "Empfehlung",
  "Karriereseite",
  "Sonstige",
] as const;

const VACANCY_PRIORITIES = ["P0", "P1", "P2", "P2"] as const; // skew toward P2
const VACANCY_WORKPLACES = ["office", "hybrid", "hybrid", "remote"] as const;

// Realistic gross-annual EUR salary bands per role family.
const VACANCY_SALARY_BANDS: Record<string, [number, number]> = {
  "Senior Engineer": [75_000, 110_000],
  "Product Designer": [62_000, 88_000],
  "Account Executive": [55_000, 95_000],
  "Data Analyst": [55_000, 80_000],
  "Recruiter": [48_000, 68_000],
  "Finance Manager": [78_000, 105_000],
  "Customer Success Manager": [55_000, 80_000],
};

const VACANCY_TODAY = new Date(Date.UTC(2026, 4, 30));
function vacancyDate(daysOffset: number): string {
  const d = new Date(VACANCY_TODAY);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

export const vacancies: JobVacancy[] = ROLES.map((title, i) => {
  const applicants = between(8, 64);
  // funnel — each stage decreases; applied equals the public applicant count.
  const screening = Math.max(2, Math.round(applicants * 0.55));
  const interview = Math.max(1, Math.round(screening * 0.45));
  const offer = Math.max(0, Math.round(interview * 0.4));
  const hired = Math.max(0, Math.round(offer * 0.5));

  // source-mix — distributes applicants across 6 sources deterministically.
  const split = [0.35, 0.2, 0.15, 0.12, 0.1, 0.08];
  let remaining = applicants;
  const sourceMix = VACANCY_SOURCES.map((source, idx) => {
    const count = idx === split.length - 1 ? remaining : Math.round(applicants * split[idx]);
    remaining -= count;
    return { source, count: Math.max(0, count) };
  });

  // Days-since-opened: spread some past 60 (older) to populate the "aging" KPI.
  const openedDaysAgo = between(3, 95);

  const band = VACANCY_SALARY_BANDS[title];
  // Two of seven vacancies intentionally have no salary range → triggers the
  // "Gehalt fehlt — Pflicht (EU-Pay-Transparenz-RL)" warning badge.
  const includeSalary = i % 7 !== 2 && i % 7 !== 5;

  return {
    id: `JOB-${String(i + 1).padStart(4, "0")}`,
    title,
    department: pick(DEPARTMENTS),
    location: pick(LOCATIONS),
    type: pick(["full_time", "full_time", "part_time", "contractor"]),
    applicants,
    status: pick(["open", "open", "open", "on_hold", "closed"]),
    openedAt: vacancyDate(-openedDaysAgo),
    hiringManager: `${pick(FIRST)} ${pick(LAST)}`,
    priority: VACANCY_PRIORITIES[i % VACANCY_PRIORITIES.length],
    workplaceModel: VACANCY_WORKPLACES[i % VACANCY_WORKPLACES.length],
    salaryMin: includeSalary && band ? band[0] : undefined,
    salaryMax: includeSalary && band ? band[1] : undefined,
    currency: includeSalary && band ? "EUR" : undefined,
    recruiter: `${pick(FIRST)} ${pick(LAST)}`,
    requiredStartDate: vacancyDate(between(30, 120)),
    costCenter: `CC-${String(4100 + (i % 6) * 100).padStart(4, "0")}`,
    funnel: { applied: applicants, screening, interview, offer, hired },
    sourceMix,
  };
});

export const goals: Goal[] = employees.slice(0, 48).map((e, i) => {
  const progress = between(10, 100);
  const status: Goal["status"] =
    progress >= 100 ? "completed" : progress >= 70 ? "on_track" : progress >= 40 ? "at_risk" : "behind";
  return {
    id: `GOAL-${String(i + 1).padStart(4, "0")}`,
    employeeId: e.id,
    employeeName: `${e.firstName} ${e.lastName}`,
    title: pick([
      "Time-to-hire um 20% senken",
      "NPS auf 60 steigern",
      "Onboarding-Zufriedenheit > 90%",
      "ARR-Pipeline +1.2M",
      "Deployment-Frequenz verdoppeln",
      "Mitarbeiterbindung +5pp",
    ]),
    type: pick(["okr", "kpi"]),
    progress,
    status,
    quarter: "Q2 2026",
    weight: between(1, 5) * 10,
  };
});

const ASSET_TODAY = new Date(Date.UTC(2026, 4, 30));
function assetDate(daysOffset: number): string {
  const d = new Date(ASSET_TODAY);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

const ASSET_CATALOG: Record<
  Asset["category"],
  { names: readonly string[]; vendors: readonly string[]; price: [number, number] }
> = {
  laptop: {
    names: [
      "MacBook Pro 14",
      "MacBook Pro 16",
      "MacBook Air M3",
      "Dell XPS 15",
      "ThinkPad T14",
      "ThinkPad X1 Carbon",
      "Surface Laptop 6",
    ],
    vendors: ["Apple", "Dell", "Lenovo", "Microsoft"],
    price: [1400, 3500],
  },
  phone: {
    names: ["iPhone 15", "iPhone 15 Pro", "Pixel 8", "Pixel 8 Pro", "Samsung Galaxy S24"],
    vendors: ["Apple", "Google", "Samsung"],
    price: [650, 1400],
  },
  monitor: {
    names: ["LG UltraFine 27", "Dell U2723QE", "BenQ PD2700U", "Samsung S27R650"],
    vendors: ["LG", "Dell", "BenQ", "Samsung"],
    price: [380, 900],
  },
  access_card: {
    names: ["Zugangskarte HID", "Zugangskarte Mifare"],
    vendors: ["HID Global", "Mifare"],
    price: [10, 60],
  },
  vehicle: {
    names: ["VW ID.4", "VW Golf", "BMW i4", "Tesla Model 3", "Audi Q4 e-tron"],
    vendors: ["Volkswagen", "BMW", "Tesla", "Audi"],
    price: [28_000, 65_000],
  },
};

const LAPTOP_OS = [
  "macOS Sonoma 14.5",
  "macOS Sequoia 15.1",
  "Windows 11 Pro 23H2",
  "Windows 11 Pro 24H2",
];
const ASSET_LOCATIONS_PHYS = [
  "HQ Berlin",
  "Office München",
  "Office Hamburg",
  "Warehouse Köln",
  "Home Office",
  "Office Wien",
];
const ASSET_CONDITIONS: Asset["condition"][] = ["good", "good", "good", "new", "damaged"];
const ASSET_CATEGORIES: Asset["category"][] = [
  "laptop",
  "phone",
  "monitor",
  "access_card",
  "vehicle",
];

export const assets: Asset[] = Array.from({ length: 40 }, (_, i) => {
  const category = ASSET_CATEGORIES[i % ASSET_CATEGORIES.length];
  const catData = ASSET_CATALOG[category];
  const name = catData.names[i % catData.names.length];
  const vendor = catData.vendors[i % catData.vendors.length];
  const purchasePrice = between(catData.price[0], catData.price[1]);

  // Status mix incl. lost/disposed.
  const r = rand();
  let status: Asset["status"];
  if (r < 0.55) status = "assigned";
  else if (r < 0.75) status = "available";
  else if (r < 0.85) status = "maintenance";
  else if (r < 0.92) status = "retired";
  else if (r < 0.97) status = "lost";
  else status = "disposed";
  const assigned = status === "assigned";
  const holder = employees[between(0, EMPLOYEE_COUNT - 1)];

  // Warranty distribution: ~14% expired, ~14% expires <30d, rest active.
  const warrantyBucket = i % 7;
  let warrantyOffset: number;
  if (warrantyBucket === 0) warrantyOffset = -between(20, 400);
  else if (warrantyBucket === 1) warrantyOffset = between(2, 29);
  else warrantyOffset = between(60, 730);

  // Purchase date 0.5-5 years ago.
  const purchaseDate = assetDate(-between(180, 1825));

  return {
    id: `AST-${String(i + 1).padStart(4, "0")}`,
    name,
    category,
    serial: `SN-${between(100000, 999999)}`,
    assignedTo: assigned ? `${holder.firstName} ${holder.lastName}` : undefined,
    status,
    purchaseDate,
    // Extended fields
    assetTag: `AT-${String(i + 1).padStart(4, "0")}`,
    vendor,
    purchasePrice,
    warrantyUntil: assetDate(warrantyOffset),
    location: assigned
      ? "Home Office"
      : ASSET_LOCATIONS_PHYS[i % ASSET_LOCATIONS_PHYS.length],
    condition: ASSET_CONDITIONS[i % ASSET_CONDITIONS.length],
    os: category === "laptop" ? LAPTOP_OS[i % LAPTOP_OS.length] : undefined,
    encryptionEnabled: category === "laptop" ? i % 7 !== 6 : undefined,
    assignedSince: assigned ? assetDate(-between(6, 180)) : undefined,
    insuranceCovered: i % 4 !== 0,
    notes: i % 8 === 0 ? "Defekter Lüfter — Service-Termin gebucht." : undefined,
  };
});

export const tickets: HelpdeskTicket[] = Array.from({ length: 28 }, (_, i) => ({
  id: `TCK-${String(i + 1).padStart(4, "0")}`,
  subject: pick([
    "Lohnabrechnung Mai fehlerhaft",
    "Laptop-Tausch benötigt",
    "Zugang zu Confluence",
    "Frage zur Elternzeit",
    "Reisekosten nicht erstattet",
    "VPN funktioniert nicht",
  ]),
  requester: `${pick(FIRST)} ${pick(LAST)}`,
  category: pick(["payroll", "it", "facilities", "policy", "benefits"]),
  priority: pick(["low", "medium", "high", "urgent"]),
  status: pick(["open", "open", "in_progress", "resolved"]),
  createdAt: `2026-05-${String(between(1, 24)).padStart(2, "0")}`,
  assignee: `${pick(FIRST)} ${pick(LAST)}`,
}));

export const activity: ActivityItem[] = Array.from({ length: 16 }, (_, i) => ({
  id: `ACT-${i}`,
  actor: `${pick(FIRST)} ${pick(LAST)}`,
  action: pick(["genehmigte", "beantragte", "aktualisierte", "kommentierte", "lehnte ab"]),
  target: pick(["Urlaubsantrag", "Reisekostenabrechnung", "Bewerber Lukas M.", "Q2-Ziel", "Schichtplan KW22"]),
  timestamp: `vor ${between(2, 58)} Min`,
  type: pick(["leave", "payroll", "recruitment", "performance", "attendance", "system"]),
}));

// Dashboard analytics are derived/illustrative — empty until real analytics
// (with history) are built, so an empty app shows empty dashboards.
export const approvals: ApprovalItem[] = [];

export const notifications: NotificationItem[] = [
  { id: "N1", title: "Gehaltslauf bereit", description: "Mai-Abrechnung wartet auf Freigabe.", timestamp: "vor 12 Min", read: false, type: "warning" },
  { id: "N2", title: "Neue Bewerbung", description: "Senior Engineer — via Referral.", timestamp: "vor 40 Min", read: false, type: "info" },
  { id: "N3", title: "Onboarding abgeschlossen", description: "3 neue Mitarbeitende sind startklar.", timestamp: "vor 2 Std", read: true, type: "success" },
  { id: "N4", title: "Compliance-Hinweis", description: "5 Arbeitsverträge laufen aus.", timestamp: "vor 5 Std", read: true, type: "warning" },
];

const MONTHS = ["Dez", "Jan", "Feb", "Mär", "Apr", "Mai"];
const series = (base: number, variance: number, keys: string[]): TimeSeriesPoint[] =>
  MONTHS.map((label) => {
    const point: TimeSeriesPoint = { label };
    keys.forEach((k) => (point[k] = base + between(-variance, variance)));
    return point;
  });

export const kpis: Kpi[] = [
  { id: "headcount", label: "Mitarbeitende", value: EMPLOYEE_COUNT, format: "number", delta: 4.2, trend: series(120, 6, ["value"]) },
  { id: "attendance", label: "Anwesenheit heute", value: 94.5, format: "percent", delta: 1.1, trend: series(92, 4, ["value"]) },
  { id: "openroles", label: "Offene Stellen", value: 7, format: "number", delta: -12.5, trend: series(9, 3, ["value"]) },
  { id: "payroll", label: "Lohnkosten / Monat", value: 1284000, format: "currency", delta: 3.4, trend: series(1200000, 60000, ["value"]) },
  { id: "turnover", label: "Fluktuation (YTD)", value: 6.8, format: "percent", delta: -0.6, trend: series(8, 1, ["value"]) },
  { id: "engagement", label: "Engagement-Score", value: 78, format: "number", delta: 2.3, trend: series(74, 4, ["value"]) },
];

export const headcountByDept: TimeSeriesPoint[] = [];

export const attendanceTrend: TimeSeriesPoint[] = [];

export const payrollTrend: TimeSeriesPoint[] = [];

export const recruitmentFunnel: TimeSeriesPoint[] = [];

export const fullName = (e: Pick<Employee, "firstName" | "lastName">) =>
  `${e.firstName} ${e.lastName}`;

// --- Direktor-Section: Contract templates + contracts ----------------------

export const contractTemplates: ContractTemplate[] = [
  {
    id: "TPL-PERM-DE",
    name: "Standard-Vollzeit (DE)",
    type: "permanent",
    description:
      "Unbefristeter Arbeitsvertrag, 40 h/Woche, deutsche Rechtsgrundlage.",
    hoursPerWeek: 40,
    noticePeriodWeeks: 4,
    clauses: [
      "Verschwiegenheitspflicht (NDA)",
      "Geistige Eigentumsrechte an Arbeitsergebnissen",
      "Wettbewerbsverbot (12 Monate post-Vertragsende)",
      "Homeoffice bis 60 % erlaubt",
      "30 Tage Jahresurlaub",
    ],
  },
  {
    id: "TPL-PART-DE",
    name: "Teilzeit (DE)",
    type: "part_time",
    description: "Unbefristete Teilzeitstelle, 20 h/Woche, anteilige Vergütung.",
    hoursPerWeek: 20,
    noticePeriodWeeks: 4,
    clauses: [
      "Verschwiegenheitspflicht (NDA)",
      "Geistige Eigentumsrechte an Arbeitsergebnissen",
      "Wettbewerbsverbot (6 Monate post-Vertragsende)",
      "Anteiliger Urlaub (15 Tage)",
    ],
  },
  {
    id: "TPL-FIXED-DE",
    name: "Befristet 24 Monate",
    type: "fixed_term",
    description:
      "Befristeter Arbeitsvertrag mit fester Laufzeit, automatische Beendigung.",
    hoursPerWeek: 40,
    noticePeriodWeeks: 2,
    clauses: [
      "Verschwiegenheitspflicht (NDA)",
      "Befristung sachlich begründet (§ 14 TzBfG)",
      "Probezeit 6 Monate",
      "30 Tage Jahresurlaub anteilig",
    ],
  },
  {
    id: "TPL-FREELANCE",
    name: "Freelance-Werkvertrag",
    type: "freelance",
    description:
      "Selbstständige Tätigkeit, projektbasiert, kein Sozialversicherungsabzug.",
    hoursPerWeek: 0,
    noticePeriodWeeks: 2,
    clauses: [
      "Übertragung sämtlicher Nutzungsrechte (IP-Transfer)",
      "Werkvertragliche Erfolgsschuld",
      "Eigene Sozialversicherung",
      "Monatliche Rechnungslegung",
      "Haftpflicht-Mindestversicherung 1 Mio. EUR",
    ],
  },
  {
    id: "TPL-WERK",
    name: "Werkstudent",
    type: "working_student",
    description:
      "Studierende mit Immatrikulation, max. 20 h/Woche während Vorlesungszeit.",
    hoursPerWeek: 20,
    noticePeriodWeeks: 1,
    clauses: [
      "Immatrikulationsnachweis (jedes Semester)",
      "Max. 20 h/Woche während Vorlesungszeit",
      "Kein Anspruch auf Weiterbeschäftigung nach Studienende",
      "Studentensozialversicherung",
    ],
  },
  {
    id: "TPL-INTERN",
    name: "Praktikum",
    type: "intern",
    description: "Pflicht- oder freiwilliges Praktikum, max. 6 Monate.",
    hoursPerWeek: 40,
    noticePeriodWeeks: 1,
    clauses: [
      "Praktikumszeugnis zum Ende",
      "Zuweisung eines Mentors",
      "Bei Pflichtpraktikum: kein Mindestlohn-Anspruch",
      "Lernziele schriftlich vereinbart",
    ],
  },
];

// Fixed "today" for deterministic status calculation across SSR/CSR.
const CONTRACT_TODAY = new Date(Date.UTC(2026, 5, 5)); // 2026-06-05

function contractDateFromHire(hireDate: string, monthsAfter: number): string {
  const d = new Date(hireDate);
  d.setUTCMonth(d.getUTCMonth() + monthsAfter);
  return d.toISOString().slice(0, 10);
}

function deriveContractStatus(endDate: string | null): ContractStatus {
  if (!endDate) return "active";
  const end = new Date(endDate);
  const diffDays = Math.round(
    (end.getTime() - CONTRACT_TODAY.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return "expired";
  if (diffDays <= 60) return "expiring_soon";
  return "active";
}

const CONTRACT_TYPE_TO_TEMPLATE: Record<ContractType, ContractTemplate> = {
  permanent: contractTemplates[0],
  part_time: contractTemplates[1],
  fixed_term: contractTemplates[2],
  freelance: contractTemplates[3],
  working_student: contractTemplates[4],
  intern: contractTemplates[5],
  mini_job: contractTemplates[1],
};

export const contracts: Contract[] = employees.map((e, i) => {
  const type: ContractType = e.contractType ?? "permanent";
  const tpl = CONTRACT_TYPE_TO_TEMPLATE[type];
  const start = e.contractStart ?? e.hireDate;
  let end: string | null = null;
  if (type === "fixed_term") {
    end = e.contractEnd ?? contractDateFromHire(start, 24);
  } else if (type === "intern") {
    end = e.contractEnd ?? contractDateFromHire(start, 6);
  } else if (type === "working_student") {
    end = e.contractEnd ?? contractDateFromHire(start, 12);
  } else if (type === "freelance") {
    end = contractDateFromHire(start, 12);
  }
  // Inject a handful of expired ones for testing the monitoring view.
  if (i % 17 === 5 && end === null) {
    end = "2025-12-31";
  }
  const status = deriveContractStatus(end);
  return {
    id: `CTR-${String(i + 1).padStart(4, "0")}`,
    employeeId: e.id,
    employeeName: fullName(e),
    jobTitle: e.jobTitle,
    type,
    status,
    startDate: start,
    endDate: end,
    salary: e.salary,
    hoursPerWeek: e.weeklyHours ?? tpl.hoursPerWeek,
    noticePeriodWeeks: tpl.noticePeriodWeeks,
    templateId: tpl.id,
    templateName: tpl.name,
    signedAt: start,
  };
});
