# HR Noxt — Enterprise HRIS Frontend · Architektur

Frontend-only Enterprise-HRIS für Organisationen mit 1.000+ Mitarbeitenden.
Stil-Referenz: Workday, SAP SuccessFactors, BambooHR, Rippling, Linear, Stripe Dashboard.

> **Scope:** Reines Frontend. Kein Backend, keine echte DB/API. Daten kommen aus einem
> deterministischen Mock-Layer (`src/lib/mock/data.ts`), serviert über React-Query-Hooks,
> die einen Netzwerk-Roundtrip simulieren. Der Austausch gegen echte APIs erfolgt
> ausschließlich in `src/lib/queries.ts` — Komponenten bleiben unberührt.

## 1. Frontend-Architektur (Überblick)

```
Next.js 16 App Router (RSC)  ──>  Route-Groups (app) / (ess)
        │
        ├─ Providers (Client): React Query · next-themes · Tooltip · Toaster
        ├─ App-Shell: Sidebar + Topbar + Breadcrumbs (Desktop)   → (app)
        ├─ Mobile-Shell: Bottom-Nav (ESS)                        → (ess)
        │
        ├─ Feature-Pages (Dashboards + 5 Module)
        │     └─ nutzen: Widgets · DataTable · Forms · Charts
        │
        └─ Data-Layer: React Query Hooks ─> Mock-Daten (austauschbar gegen REST/GraphQL)
```

- **Rendering:** Server Components als Default; `"use client"` nur dort, wo Interaktivität/Hooks nötig sind (Pages mit State, Widgets mit Charts/Animation).
- **State-Trennung:** Server-/Remote-State über React Query; UI-State (Sidebar, Mobile-Nav, Notifications) über Zustand.
- **Styling:** Tailwind v4 (CSS-first `@theme`) + token-basiertes Design-System, Dark/Light über `class`-Strategie.

## 2. Folder-Struktur

```
src/
├─ app/
│  ├─ layout.tsx               # Root: Fonts (Lexend/Source Sans), <Providers>
│  ├─ page.tsx                 # redirect → /dashboard/executive
│  ├─ globals.css              # Design-Tokens (oklch), @theme, Utilities
│  ├─ (app)/                   # Desktop-Shell (Sidebar + Topbar)
│  │  ├─ layout.tsx
│  │  ├─ dashboard/{executive,hr,employee,finance,recruitment,analytics}/
│  │  ├─ attendance/{clock,timesheet,leave,tracking}/
│  │  ├─ payroll/{payslips,reimbursements,analytics}/
│  │  ├─ people/{employees,ess,assets,helpdesk,onboarding}/
│  │  ├─ recruitment/{vacancies,pipeline}/
│  │  └─ performance/{goals,appraisals}/
│  └─ (ess)/                   # Mobile-first ESS-Shell (Bottom-Nav)
│     ├─ layout.tsx
│     └─ ess/{.,attendance,leave,payslip,profile}/
├─ components/
│  ├─ ui/                      # Design-System-Primitives (shadcn-Stil auf Radix)
│  ├─ layout/                  # Sidebar, Topbar, Breadcrumbs, PageHeader, Mobile-Nav, ThemeToggle
│  ├─ widgets/                 # KpiCard, ChartCard, ActivityFeed, ApprovalCard, CalendarWidget, QuickActions
│  ├─ data-table/              # Generisches Tabellen-System (TanStack Table)
│  ├─ shared/                  # StatusBadge u.a.
│  └─ motion/                  # FadeIn, Stagger, StaggerItem (Framer Motion)
├─ config/navigation.ts        # Single source of truth: Nav-Gruppen + Mobile-Nav + Routen
├─ lib/{utils,queries}.ts      # cn/Formatter · React-Query-Hooks
├─ lib/mock/data.ts            # deterministischer Daten-Generator
├─ stores/                     # Zustand: ui-store, notification-store
└─ types/index.ts              # Domain-Modelle
```

## 3. Component-Architektur

Drei Schichten, klar getrennt:

| Schicht | Beispiele | Eigenschaft |
|---|---|---|
| **Primitives** (`ui/`) | Button, Card, Dialog, Sheet, Select, Tabs, Table … | zustandslos, token-gestylt, wiederverwendbar |
| **Composites** (`widgets/`, `data-table/`, `forms`) | KpiCard, ChartCard, DataTable, FormField | kombinieren Primitives zu Domänen-Bausteinen |
| **Features** (`app/**/page.tsx`) | Dashboards, Modul-Seiten | orchestrieren Composites + Daten |

Prinzip: Feature-Pages enthalten **keine** Low-Level-Styles — nur Komposition. Wiederholte Muster (Status-Darstellung, Tabellen, KPIs) sind zentralisiert.

## 4. Dashboard-Wireframe (Muster)

```
┌────────────────────────────────────────────────────────────┐
│ PageHeader: Titel + Beschreibung            [Aktionen ▸]     │
├──────────┬──────────┬──────────┬──────────┤  (Stagger-In)   │
│ KPI 1    │ KPI 2    │ KPI 3    │ KPI 4    │  + Sparkline     │
├──────────┴──────────┴──────────┼──────────────────────────┤
│ Haupt-Chart (2/3)              │ Approval-Card (1/3)        │
├──────────┬─────────────────────┼──────────────────────────┤
│ Sekundär-Chart │ Activity-Feed │ Calendar / QuickActions    │
└──────────┴─────────────────────┴──────────────────────────┘
```

## 5. UI/UX-Workflow-Diagramme

**Leave-Request:**
```
Dashboard ─▶ /attendance/leave ─▶ "Urlaub beantragen" (Dialog, RHF+Zod)
   └─ Validierung ─▶ Submit ─▶ Toast ✓ ─▶ Liste/Status aktualisiert ─▶ Kalender markiert
```
**Attendance:**
```
/attendance/clock ─▶ GPS erfassen ✓ ─▶ Liveness/Kamera ✓ ─▶ Einstempeln ─▶ Erfolgs-State + Timeline
```
**Recruitment (ATS):**
```
Pipeline (Kanban) ─▶ Card klicken ─▶ Drawer (Profil + CV + Interview planen)
   └─ "Nächste Phase" ─▶ Kandidat wechselt Spalte (State) + Toast
```
**Performance-Review:**
```
/performance/appraisals ─▶ Kompetenzen bewerten (1–5) ─▶ Kommentar ─▶ Gesamtscore ─▶ Speichern (Toast)
```

## 6. Route-Struktur
Siehe `src/config/navigation.ts` (Single Source of Truth für Sidebar, Breadcrumbs, Mobile-Nav).
Route-Group `(app)` = Desktop-Shell, `(ess)` = Mobile-Shell — beide ohne URL-Segment, daher saubere Pfade.

## 7. State-Management
- **React Query** (`@tanstack/react-query`): Remote-/Server-State, Caching (`staleTime` 60s), Loading-States → Skeletons.
- **Zustand**: `ui-store` (Sidebar-Collapse persistiert via `persist`, Mobile-Nav, Command), `notification-store` (Badge-Count, mark-read).
- **React Hook Form + Zod**: lokaler Formular-State + Validierung.

## 8. Reusable-Component-Strategie
- **DataTable** (`components/data-table/`): generisch `<TData>`, konfiguriert per `ColumnDef[]`. Features: Suche, Facetten-Filter, Sortierung, Spalten-Sichtbarkeit, Bulk-Actions, CSV-Export, Pagination, Sticky-Header, Skeleton-Loading, Row-Click.
- **Forms**: `FormField/FormItem/FormLabel/FormControl/FormMessage` über RHF-Context, Zod-Resolver.
- **Widgets**: datengetriebene Props, kein Hardcoding.
- **StatusBadge**: zentrale Status→Variante-Map für alle Domänen-Status.

## 9. Enterprise-Best-Practices
TypeScript strict · token-basiertes Theming (keine Magic-Hex) · Single-Source-Navigation · Trennung Server/UI-State · A11y (Radix-Primitives, `aria-label`, Focus-Rings, Tastatur-Navigation) · `prefers-reduced-motion` respektiert · konsistente Formatierung (Intl).

## 10. Responsive-Design-Strategie
Mobile-first Tailwind-Breakpoints. Grids `grid-cols-1 → sm:2 → lg/xl:3–4`. Sidebar erst ab `lg` sichtbar; darunter Sheet-Drawer. Tabellen scrollen horizontal. Eigene ESS-Shell für echte Mobile-UX statt nur „schmaler Desktop".

## 11. Mobile-UX-Struktur
`(ess)`-Route-Group: zentrierter `max-w-md`-Container, Mini-Header, **Bottom-Tab-Nav** (Home/Attendance/Leave/Payslip/Profile), große Tap-Targets, Sheet-Formulare von unten, runder Clock-In-Button.

## 12. Enterprise-Navigation
Kollabierbare Desktop-Sidebar (persistierter Zustand) mit gruppierter Navigation + Tooltips im Collapsed-Modus, animiertem Active-Indicator (`layoutId`). Topbar mit globaler Suche (⌘K-Hint), Notifications-Popover, Theme-Toggle, User-Menu. Breadcrumbs aus dem Pfad.

## 13. Skalierbarkeits-Strategie
Modulare Folder-Struktur pro Domäne · generische Bausteine statt Copy-Paste · Navigation/Routen datengetrieben (neues Modul = Eintrag + Page) · Daten-Layer hinter Hooks isoliert (API-Tausch ohne Komponenten-Änderung) · klare Schichtung verhindert Coupling.

## 14. Animationen & Transitions
Framer Motion: `FadeIn` (Eingangs-Reveal), `Stagger`/`StaggerItem` (KPI-Grids), `layoutId` (Active-Indicator, Tab-Underline), `whileHover` (Kanban-Cards). Radix-Overlays mit Enter/Exit via `tw-animate-css`. Dauer 150–350ms, `ease-out`. Reduced-Motion global respektiert.

## 15. Design-System-Doku
- **Palette** „Trust & Authority": Navy/Slate-Basis, Blau als Primär, Grün für positive Zustände — Tokens in `globals.css` (oklch, light+dark).
- **Typografie:** Lexend (Display/Headings) + Source Sans 3 (Body) + Geist Mono.
- **Tokens:** `--background/foreground/card/primary/secondary/muted/accent/destructive/success/warning/info/border/ring`, `--chart-1..5`, `--sidebar-*`, `--radius`.
- **Status-Farben:** success/warning/destructive/info + muted, konsistent über Badges/Charts.

## 16. Dashboard-Architektur-System
Widget-Komposition: jedes Dashboard = `PageHeader` + KPI-Grid (`KpiCard`) + Charts (`ChartCard`) + Listen-/Approval-/Activity-Widgets. 6 Dashboards (Executive, HR, Employee, Finance, Recruitment, Analytics) teilen dieselben Bausteine → konsistente UX, minimaler Code.

## 17. Enterprise-Layout-System
Sticky Topbar + Sidebar, zentrierter Content (`max-w-[1600px]`), konsistente Spacing-Skala, `space-y-6` als Seiten-Rhythmus, Card-basierte Sektionen mit einheitlichem Radius/Shadow.

## 18. Analytics-Widget-Struktur
`ChartCard` kapselt Recharts (`area|bar|line|pie`) inkl. Theming, custom Tooltip, Gradients, responsive Container. Datenform: `TimeSeriesPoint[]`. `KpiCard` mit Trend-Sparkline + Delta-Indikator. Analytics-Dashboard bündelt via Tabs (People/Attendance/Payroll/Recruitment).

## 19. Frontend-Optimierung
RSC als Default (weniger Client-JS) · Code-Splitting pro Route · React-Query-Caching + `staleTime` · Skeleton-Loading statt Spinner · `disableTransitionOnChange` beim Theme-Switch · token-CSS statt Runtime-Styling · `next/font` (selbst-gehostete Fonts, kein Layout-Shift).

## 20. Mobile-first-Architektur
Eigene `(ess)`-Shell, Bottom-Nav, Sheet-Flows, Touch-Targets ≥ 44px, dedizierte mobile Screens (Clock-In, Leave, Payslip, Profile) — kein bloßes Desktop-Reflow.

---

## Tech-Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Radix UI (shadcn-Pattern) ·
TanStack Table & Query · Zustand · React Hook Form + Zod · Recharts · Framer Motion · Lucide · Sonner.

## Lokal starten
```bash
npm install
npm run dev      # http://localhost:3000  (→ /dashboard/executive)
npm run build && npm start
```
