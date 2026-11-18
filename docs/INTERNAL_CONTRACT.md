# Internes Build-Contract (für Page-Implementierung)

Diese Datei beschreibt die **bereits existierende** Foundation. Pages NUR mit diesen Bausteinen bauen.
**Niemals** Dateien unter `src/components/ui`, `src/components/widgets`, `src/components/data-table`,
`src/components/layout`, `src/lib`, `src/stores`, `src/types`, `src/config` ändern — nur importieren.

## Sprache & Konventionen
- UI-Texte, Labels, Spaltennamen: **Deutsch**. Code (Variablen, Routen): Englisch.
- Jede Page-Datei, die Hooks/State/Events nutzt, beginnt mit `"use client";`.
- Routen liegen in der Route-Group `src/app/(app)/...` (Desktop-Shell ist via Layout schon da).
- Seitenstart immer mit `<PageHeader title=… description=… actions={…} />`, dann Inhalt in `space-y-6`.
- Animationen: Inhalte mit `<FadeIn>` / `<Stagger><StaggerItem>` umhüllen (siehe HR-Dashboard).

## Referenz-Dateien (vor dem Bauen lesen!)
- `src/app/(app)/dashboard/hr/page.tsx` — Stil-Referenz für Dashboards
- `src/components/data-table/data-table.tsx` — DataTable-API
- `src/components/widgets/chart-card.tsx` — Chart-API
- `src/lib/mock/data.ts` — alle Mock-Daten + Exporte
- `src/types/index.ts` — alle Domain-Typen

## Verfügbare Bausteine

### Layout / Motion
- `@/components/layout/page-header` → `PageHeader`
- `@/components/motion` → `FadeIn` (props: delay, y), `Stagger` (props: stagger), `StaggerItem`, `motion`

### UI-Primitives (`@/components/ui/...`)
button (Button; variants: default|destructive|outline|secondary|ghost|link|success; sizes: default|sm|lg|icon|icon-sm),
card (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter),
badge (Badge; variants: default|secondary|outline|success|warning|destructive|info|muted),
input (Input), textarea (Textarea), label (Label), checkbox (Checkbox), switch (Switch),
select (Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel),
dialog (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose),
sheet (Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter) — side="right|left|top|bottom",
tabs (Tabs, TabsList, TabsTrigger, TabsContent),
dropdown-menu (DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem),
popover (Popover, PopoverTrigger, PopoverContent),
tooltip (Tooltip, TooltipTrigger, TooltipContent),
avatar (Avatar, AvatarImage, AvatarFallback),
progress (Progress; props: value, indicatorClassName),
separator (Separator), skeleton (Skeleton), scroll-area (ScrollArea),
table (Table, TableHeader, TableBody, TableRow, TableHead, TableCell),
sonner → `import { toast } from "sonner"`.

### Shared
- `@/components/shared/status-badge` → `<StatusBadge status="active" />` (kennt alle Status-Strings aus den Typen)

### Widgets (`@/components/widgets/...`)
- `kpi-card` → `<KpiCard kpi={Kpi} accent={1..5} />`
- `chart-card` → `<ChartCard title type="area|bar|line|pie" data={TimeSeriesPoint[]} series={string[]} stacked? height? description? action? valueKey? />`, export `CHART_COLORS`
- `activity-feed` → `<ActivityFeed items={ActivityItem[]} />`
- `approval-card` → `<ApprovalCard items={ApprovalItem[]} />`
- `calendar-widget` → `<CalendarWidget title? events? />`
- `quick-actions` → `<QuickActions actions={{label,href,icon}[]} title? />`

### DataTable (`@/components/data-table/...`)
```tsx
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Employee>[] = [
  selectColumn<Employee>(),
  { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.firstName}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} />,
    filterFn: (r, id, v) => r.getValue(id) === v },
  { id: "actions", cell: ({ row }) => <RowActions .../>, enableHiding: false },
];

<DataTable
  columns={columns}
  data={data}
  loading={isLoading}
  searchKey="name"            // accessorKey der durchsuchbaren Spalte
  searchPlaceholder="Suchen…"
  facets={[{ columnId: "status", title: "Status", options: [{label, value}] }]}
  onRowClick={(row) => ...}   // optional, öffnet z.B. Drawer
  onBulkDelete={(rows) => ...}// optional
  pageSize={10}
/>
```
- Für Facet-Filter braucht die Spalte einen `filterFn` der gegen den exakten Wert matched.
- `searchKey` braucht eine Spalte mit `accessorKey` gleichen Namens (Standard-`includesString`).

### Daten-Hooks (`@/lib/queries`)
useEmployees, useAttendance, useLeaveRequests, usePayslips, useReimbursements, useCandidates, useVacancies, useGoals, useAssets, useTickets, useKpis — alle return `{ data, isLoading }` (React Query).

### Mock-Daten direkt (`@/lib/mock/data`) — für Server-Pages/Charts
employees, attendance, leaveRequests, payslips, reimbursements, candidates, vacancies, goals, assets, tickets,
activity, approvals, notifications, kpis, headcountByDept, attendanceTrend, payrollTrend, recruitmentFunnel, fullName().

### Utils (`@/lib/utils`)
cn, formatCurrency(v), formatNumber(v), formatPercent(v), initials(name).

### Forms (`@/components/ui/form` + react-hook-form + zod + @hookform/resolvers/zod)
Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage. Muster:
```tsx
const schema = z.object({ type: z.string().min(1, "Pflichtfeld") });
const form = useForm({ resolver: zodResolver(schema), defaultValues: {...} });
<Form {...form}><form onSubmit={form.handleSubmit(onSubmit)}>
  <FormField control={form.control} name="type" render={({ field }) => (
    <FormItem><FormLabel>Typ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
  )} />
</form></Form>
```

## Qualität
- Keine Platzhalter, kein `TODO`, keine leeren `onClick`. Buttons machen etwas (Drawer öffnen, toast, State).
- Keine `any` nötig, aber erlaubt. Keine ungenutzten Imports (sonst Lint-Warnung).
- Responsive: Grids mit `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4`, Tabellen scrollen horizontal automatisch.
- Build wird zentral am Ende ausgeführt — Agenten führen KEIN `npm run build` aus.
