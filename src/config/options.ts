// Single source of truth for employee titles + departments.
// Mirrors the company's actual hierarchy (Manager > Coordinator > Staff)
// and operational areas (HR, Electro, Photovoltaik, Fenster, …).

export const TITLES = ["Manager", "Coordinator", "Staff"] as const;
export type Title = (typeof TITLES)[number];

export const DEPARTMENTS = [
  "HR",
  "HR Noxt",
  "HR Planvilla",
  "Electro",
  "Photovoltaik",
  "Fenster",
  "Marketing",
  "Verkäufer",
  "Setter",
  "Netzantrag",
  "Wärmepumpe",
  "Buchhaltung",
  "Einkäufer",
  "Telefonierer",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const TITLE_OPTIONS = TITLES.map((t) => ({ label: t, value: t }));
export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ label: d, value: d }));

// Typical job descriptions per department (free-text examples) — used by the
// mock-data generator to populate the `jobTitle` field with realistic values.
export const JOB_TITLES: Record<Department, string[]> = {
  "HR": ["HR Generalist", "Recruiter", "People Ops", "HR Specialist"],
  "HR Noxt": ["HR Coordinator", "HR Operations", "HR Business Partner"],
  "HR Planvilla": ["HR Planvilla Lead", "HR Planvilla Specialist"],
  "Electro": [
    "Elektro Bad Neuenahr",
    "Elektro Herten/Rührpott",
    "Elektro Erkelenz",
    "Elektro Berlin",
    "Meterstrom",
    "Greenfit & Sigenergy",
  ],
  "Photovoltaik": [
    "PV-Assistent Karlsruhe",
    "PV-Assistent Bad Neuenahr",
    "PV-Assistent Berlin",
    "PV-Installateur",
  ],
  "Fenster": ["Fenster-Monteur", "Fenster Erkelenz", "Fenster-Verkauf"],
  "Marketing": [
    "Data Analyst",
    "Graphic Designer",
    "Video Editor",
    "Web Designer",
    "Content Strategist",
  ],
  "Verkäufer": ["Assistent Verkäufer", "Außendienst", "Verkauf Innendienst"],
  "Setter": ["Setter", "Lead Setter"],
  "Netzantrag": ["Netzantrag-Bearbeitung", "Netzantrag-Spezialist"],
  "Wärmepumpe": ["Wärmepumpe-Installation", "Wärmepumpe-Service"],
  "Buchhaltung": [
    "Inkasso und Vertrag",
    "Bürocheckin",
    "Provisionsabrechnungen Renewables",
    "Rechnungskontrolle",
  ],
  "Einkäufer": ["Einkauf Hardware", "Einkauf Material", "Einkauf Service"],
  "Telefonierer": ["Telefonierer Outbound", "Telefonierer Inbound"],
};

// Sample names taken from the company org chart — used as deterministic seeds
// for the first few mock employees so the data feels real.
export const SEED_EMPLOYEES: Array<{
  firstName: string;
  lastName: string;
  title: Title;
  department: Department;
}> = [
  { firstName: "Ardi", lastName: "Saputra", title: "Manager", department: "HR Noxt" },
  { firstName: "Ishan", lastName: "Pratama", title: "Coordinator", department: "HR Noxt" },
  { firstName: "Yola", lastName: "Permata", title: "Staff", department: "HR Noxt" },
  { firstName: "Quail", lastName: "Wirawan", title: "Staff", department: "HR Noxt" },
  { firstName: "Christian", lastName: "Stahly", title: "Coordinator", department: "Electro" },
  { firstName: "Arga", lastName: "Nugraha", title: "Coordinator", department: "Marketing" },
  { firstName: "Grace", lastName: "Nina", title: "Coordinator", department: "Netzantrag" },
  { firstName: "Rendy", lastName: "Hartono", title: "Coordinator", department: "Wärmepumpe" },
  { firstName: "Endo", lastName: "Wijaya", title: "Coordinator", department: "Buchhaltung" },
  { firstName: "Gabriel", lastName: "Tan", title: "Coordinator", department: "Photovoltaik" },
  { firstName: "Fathin", lastName: "Rahman", title: "Staff", department: "Electro" },
  { firstName: "Rizal", lastName: "Mansyur", title: "Staff", department: "Electro" },
  { firstName: "Jeremy", lastName: "Halim", title: "Staff", department: "Electro" },
  { firstName: "Andre", lastName: "Lubis", title: "Staff", department: "Electro" },
  { firstName: "Perdania", lastName: "Sari", title: "Staff", department: "Electro" },
  { firstName: "Radian", lastName: "Pratama", title: "Staff", department: "Electro" },
  { firstName: "Arfian", lastName: "Yusuf", title: "Staff", department: "Marketing" },
  { firstName: "Viana", lastName: "Indah", title: "Staff", department: "Marketing" },
  { firstName: "Doni", lastName: "Setiawan", title: "Staff", department: "Marketing" },
  { firstName: "Alisha", lastName: "Putri", title: "Staff", department: "Marketing" },
  { firstName: "Hadi", lastName: "Susanto", title: "Staff", department: "Netzantrag" },
  { firstName: "Hasan", lastName: "Mardiansyah", title: "Staff", department: "Netzantrag" },
  { firstName: "Dara", lastName: "Maharani", title: "Staff", department: "Netzantrag" },
  { firstName: "Yellya", lastName: "Anggraini", title: "Staff", department: "Netzantrag" },
  { firstName: "Arum", lastName: "Lestari", title: "Staff", department: "Netzantrag" },
  { firstName: "ATF", lastName: "Pratama", title: "Staff", department: "Wärmepumpe" },
  { firstName: "Irsyad", lastName: "Maulana", title: "Staff", department: "Wärmepumpe" },
  { firstName: "Putera", lastName: "Wibowo", title: "Staff", department: "Buchhaltung" },
  { firstName: "April", lastName: "Ramadhani", title: "Staff", department: "Buchhaltung" },
  { firstName: "Novlita", lastName: "Sari", title: "Staff", department: "Buchhaltung" },
  { firstName: "Tika", lastName: "Andini", title: "Staff", department: "Buchhaltung" },
  { firstName: "Lois", lastName: "Kurniawan", title: "Staff", department: "Photovoltaik" },
  { firstName: "Erjang", lastName: "Wijaya", title: "Staff", department: "Photovoltaik" },
  { firstName: "Fikri", lastName: "Hidayat", title: "Staff", department: "Photovoltaik" },
  { firstName: "Titis", lastName: "Anggraeni", title: "Staff", department: "Verkäufer" },
  { firstName: "Vivie", lastName: "Marpaung", title: "Staff", department: "Setter" },
  { firstName: "Jantra", lastName: "Aditya", title: "Staff", department: "Setter" },
  { firstName: "Cherrine", lastName: "Halim", title: "Staff", department: "Einkäufer" },
  { firstName: "Bona", lastName: "Manurung", title: "Staff", department: "Telefonierer" },
  { firstName: "Eki", lastName: "Pranata", title: "Staff", department: "Telefonierer" },
  { firstName: "Abin", lastName: "Saputra", title: "Staff", department: "Fenster" },
  { firstName: "Gilang", lastName: "Suryadi", title: "Staff", department: "Fenster" },
  { firstName: "Merry", lastName: "Christina", title: "Staff", department: "HR Planvilla" },
];
