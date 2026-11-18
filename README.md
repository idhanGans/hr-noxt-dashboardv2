# HR Noxt — Enterprise HRIS Frontend

Premium, modulares **Frontend** für ein Enterprise-HRIS (Human Resource Information System)
für Organisationen mit 1.000+ Mitarbeitenden. Reines Frontend — keine Backend-/DB-/API-Implementierung.
Daten stammen aus einem deterministischen Mock-Layer hinter React-Query-Hooks (austauschbar gegen echte APIs).

Stil-Inspiration: Workday · SAP SuccessFactors · BambooHR · Rippling · Linear · Stripe Dashboard.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Radix UI (shadcn-Pattern) ·
TanStack Table & Query · Zustand · React Hook Form + Zod · Recharts · Framer Motion · Lucide · Sonner.

## Umfang
- **6 Dashboards:** Executive, HR, Employee, Finance, Recruitment, Analytics
- **Attendance:** Clock-In/Out (GPS + Liveness-UI), Timesheet, Leave, Live-Tracking
- **Payroll:** Payslips (Drawer-Aufschlüsselung), Reimbursements, Analytics
- **People:** Mitarbeiter-DB, Self-Service, Assets, Helpdesk, Onboarding
- **Recruitment (ATS):** Vacancies, Kandidaten-Kanban (Profil-Drawer, CV-Preview, Interview)
- **Performance:** Goals/OKRs, Appraisals
- **Mobile-ESS:** eigene Mobile-Shell mit Bottom-Nav (Home, Attendance, Leave, Payslip, Profile)
- Reusable **DataTable** (Suche, Filter, Sortierung, Spalten, Bulk-Actions, Export, Pagination)
- Token-basiertes **Design-System** mit Dark/Light-Mode

## Start
```bash
npm install
npm run dev      # http://localhost:3000  → /dashboard/executive
npm run build && npm start
```

## Architektur
Vollständige Doku unter [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
