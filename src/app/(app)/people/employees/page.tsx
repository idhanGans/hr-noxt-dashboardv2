"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  MoreHorizontal,
  FileText,
  Pencil,
  Trash2,
  Download,
  File,
  AlertTriangle,
  Cake,
  PartyPopper,
  CalendarClock,
  CalendarMinus2,
  CheckCircle2,
  Circle,
  LayoutGrid,
  UploadCloud,
} from "lucide-react";
import type { ColumnDef, Table as TanstackTable } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/motion";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { AddEmployeeWizard } from "@/components/people/add-employee-wizard";
import { EditEmployeeDialog } from "@/components/people/edit-employee-dialog";
import { ImportEmployeesDialog } from "@/components/people/import-employees-dialog";
import { useEmployees, useVacancies, useMe } from "@/lib/queries";
import { bulkDelete } from "@/lib/use-bulk-delete";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import {
  DEPARTMENT_OPTIONS,
  TITLE_OPTIONS,
} from "@/config/options";
import type { Employee } from "@/types";

// Fixed "today" — keeps tenure / probation arithmetic deterministic
// across SSR and CSR.
const TODAY = new Date(Date.UTC(2026, 4, 30));
const MS_PER_DAY = 86_400_000;

const DEPT_OPTIONS = DEPARTMENT_OPTIONS;

// Kein Dokumenten-Backend -> leer (keine erfundenen Dateien).
const DOCS: { name: string; date: string }[] = [];

function monthsBetween(fromIso: string, to: Date): number {
  const d = new Date(fromIso + "T00:00:00Z");
  return (to.getUTCFullYear() - d.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - d.getUTCMonth()) -
    (to.getUTCDate() < d.getUTCDate() ? 1 : 0);
}

function tenureString(hireDate: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const totalMonths = Math.max(0, monthsBetween(hireDate, TODAY));
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return t("people.list.tenureFormat", { y, m });
}

function avgTenureYears(employees: Employee[]): number {
  if (employees.length === 0) return 0;
  const sum = employees.reduce((s, e) => s + Math.max(0, monthsBetween(e.hireDate, TODAY)), 0);
  return Math.round((sum / employees.length / 12) * 10) / 10;
}

// Mitarbeiter, deren Geburtstag in den naechsten 7 Tagen liegt — aus dem
// echten dateOfBirth-Feld abgeleitet (keine erfundene Auswahl).
function birthdaysThisWeek(employees: Employee[]): Employee[] {
  const start = TODAY;
  const end = new Date(TODAY.getTime() + 7 * MS_PER_DAY);
  return employees.filter((e) => {
    if (!e.dateOfBirth) return false;
    const dob = new Date(e.dateOfBirth + "T00:00:00Z");
    if (Number.isNaN(dob.getTime())) return false;
    const m = dob.getUTCMonth();
    const d = dob.getUTCDate();
    // Geburtstag dieses und naechsten Jahres pruefen (Jahreswechsel-Fenster).
    for (const yr of [start.getUTCFullYear(), start.getUTCFullYear() + 1]) {
      const next = new Date(Date.UTC(yr, m, d));
      if (next >= start && next <= end) return true;
    }
    return false;
  });
}

// Anniversaries in current month with 5/10/25-year milestones.
function anniversariesThisMonth(employees: Employee[]): Employee[] {
  const month = TODAY.getUTCMonth();
  const year = TODAY.getUTCFullYear();
  return employees.filter((e) => {
    const d = new Date(e.hireDate + "T00:00:00Z");
    if (d.getUTCMonth() !== month) return false;
    const years = year - d.getUTCFullYear();
    return years === 5 || years === 10 || years === 25;
  });
}

const TREND_MONTHS = [
  "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
  "Dec", "Jan", "Feb", "Mar", "Apr", "May",
];

function sparkline(now: number, amplitude: number, phase: number) {
  return TREND_MONTHS.map((label, i) => ({
    label,
    value: Math.max(0, Math.round(now + Math.sin((i + phase) * 0.85) * amplitude)),
  }));
}

// ---------------------------------------------------------------------
// Profile drawer
// ---------------------------------------------------------------------

function EmployeeProfileSheet({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  if (!employee) return null;
  const name = `${employee.firstName} ${employee.lastName}`;

  const ALL_TRAININGS = [
    "Datenschutz",
    "Arbeitssicherheit",
    "Compliance Code of Conduct",
    "Brandschutz",
    "Erste Hilfe",
    "Phishing-Awareness",
  ];
  const assigned = employee.requiredTrainings ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3 pt-2">
            <Avatar className="size-12">
              <AvatarFallback className="text-base font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle>{name}</SheetTitle>
              <SheetDescription>{employee.jobTitle} · {employee.department}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="px-6 pb-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">{t("people.employees.sheet.tabOverview")}</TabsTrigger>
            <TabsTrigger value="contract">{t("people.list.contractTab")}</TabsTrigger>
            <TabsTrigger value="compensation">{t("people.employees.sheet.tabCompensation")}</TabsTrigger>
            <TabsTrigger value="compliance">{t("people.list.complianceTab")}</TabsTrigger>
            <TabsTrigger value="documents">{t("people.employees.sheet.tabDocuments")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <SheetField label={t("people.employees.sheet.fieldId")} value={employee.id} />
                <SheetField label={t("people.employees.sheet.fieldEmail")} value={employee.email} />
                <SheetField label={t("people.employees.sheet.fieldLocation")} value={employee.location} />
                <SheetField label={t("people.employees.sheet.fieldHireDate")} value={employee.hireDate} />
                <SheetField
                  label={t("people.employees.sheet.fieldEmploymentType")}
                  value={t(`people.employees.type.${employee.employmentType}`)}
                />
                <div>
                  <p className="text-xs text-muted-foreground">{t("people.employees.sheet.fieldStatus")}</p>
                  <StatusBadge status={employee.status} />
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2">{t("people.employees.sheet.fieldPerformance")}</p>
                <div className="flex items-center gap-3">
                  <Progress value={employee.performanceScore} className="flex-1" />
                  <span className="text-sm font-semibold w-10 text-right">{employee.performanceScore}%</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contract">
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <SheetField
                  label={t("people.list.fieldContractType")}
                  value={
                    employee.contractType
                      ? t(`people.list.contractType.${employee.contractType}`)
                      : "—"
                  }
                />
                <SheetField label={t("people.list.fieldContractStart")} value={employee.contractStart ?? "—"} />
                <SheetField label={t("people.list.fieldProbationEnd")} value={employee.probationEnd ?? "—"} />
                <SheetField
                  label={t("people.list.fieldWeeklyHours")}
                  value={employee.weeklyHours ? `${employee.weeklyHours} h` : "—"}
                />
                <SheetField
                  label={t("people.list.fieldVacation")}
                  value={employee.vacationEntitlement ? `${employee.vacationEntitlement} d` : "—"}
                />
                <SheetField
                  label={t("people.list.fieldNotice")}
                  value={employee.noticePeriod ?? "—"}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compensation">
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("people.employees.sheet.annualSalary")}</span>
                  <span className="font-semibold">{formatCurrency(employee.salary)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("people.employees.sheet.monthlySalary")}</span>
                  <span className="font-medium">{formatCurrency(Math.round(employee.salary / 12))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("people.employees.sheet.fieldEmploymentType")}</span>
                  <Badge variant="outline">{t(`people.employees.type.${employee.employmentType}`)}</Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compliance">
            <div className="space-y-2 text-sm">
              {assigned.length === 0 ? (
                <p className="rounded-lg border border-border p-4 text-center text-muted-foreground">
                  {t("people.list.trainingsNone")}
                </p>
              ) : (
                ALL_TRAININGS.map((trn, idx) => {
                  const isAssigned = assigned.includes(trn);
                  if (!isAssigned) return null;
                  // Deterministic completion: 70% by hash-ish parity.
                  const code = (trn.charCodeAt(0) + employee.id.charCodeAt(employee.id.length - 1)) % 10;
                  const completed = code < 7;
                  const completedDate = `2025-${String(((idx + 3) % 12) + 1).padStart(2, "0")}-${String(
                    ((idx * 7) % 27) + 1,
                  ).padStart(2, "0")}`;
                  return (
                    <div
                      key={trn}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-2">
                        {completed ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{trn}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {completed
                          ? t("people.list.trainingStatusCompleted", { date: completedDate })
                          : t("people.list.trainingStatusOpen")}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <div className="space-y-2">
              {DOCS.map((doc) => (
                <div
                  key={doc.name}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <File className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.date}</p>
                    </div>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => toast.success(t("people.employees.toastDownload", { name: doc.name }))}
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function SheetField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

export default function EmployeesPage() {
  const t = useT();
  const { data, isLoading } = useEmployees();
  const { data: vacancyData = [] } = useVacancies();
  const { data: me } = useMe();
  const allEmp = useMemo(() => data ?? [], [data]);

  const [selected, setSelected] = useState<Employee | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [probationFilter, setProbationFilter] = useState(false);
  const queryClient = useQueryClient();

  function openEditEmployee(emp: Employee) {
    setEditEmp(emp);
    setEditOpen(true);
  }

  // Echtes Loeschen (DELETE) nach Bestaetigung; danach Liste + KPIs neu laden.
  async function confirmDeleteEmployee() {
    if (!deleteEmp) return;
    try {
      const res = await fetch(`/api/employees/${deleteEmp.id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
        queryClient.invalidateQueries({ queryKey: ["kpis"] }),
      ]);
      toast.success(
        t("people.employees.toastDelete", {
          name: `${deleteEmp.firstName} ${deleteEmp.lastName}`,
        }),
      );
      setDeleteOpen(false);
      setDeleteEmp(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // The TanStack Table instance becomes available once DataTable mounts.
  const tableRef = useRef<TanstackTable<Employee> | null>(null);

  function openProfile(emp: Employee) {
    setSelected(emp);
    setSheetOpen(true);
  }

  // O(1) employee lookup by id — used by the manager cell and saved views.
  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const e of allEmp) map.set(e.id, e);
    return map;
  }, [allEmp]);

  // ----- KPIs -----
  const headcount = allEmp.length;
  const openRoles = useMemo(
    () => vacancyData.filter((v) => v.status === "open").length,
    [vacancyData],
  );
  const turnoverYtd = 0; // kein historischer Fluktuations-Datensatz -> 0
  const avgTenure = useMemo(() => avgTenureYears(allEmp), [allEmp]);

  const kpis = [
    {
      id: "list-headcount",
      label: t("people.list.kpiHeadcount"),
      value: headcount,
      format: "number" as const,
      delta: 0,
      trend: sparkline(headcount, 6, 0.3),
    },
    {
      id: "list-openroles",
      label: t("people.list.kpiOpenRoles"),
      value: openRoles,
      format: "number" as const,
      delta: 0,
      trend: sparkline(openRoles, 3, 1.4),
    },
    {
      id: "list-turnover",
      label: t("people.list.kpiTurnover"),
      value: turnoverYtd,
      format: "percent" as const,
      delta: 0,
      trend: sparkline(turnoverYtd, 1, 2.1),
    },
    {
      id: "list-tenure",
      label: t("people.list.kpiTenure"),
      value: avgTenure,
      format: "number" as const,
      delta: 0,
      trend: sparkline(avgTenure, 0.5, 0.8),
    },
  ];

  // ----- Secondary strip -----
  const onboardingCount = useMemo(
    () => allEmp.filter((e) => e.status === "onboarding").length,
    [allEmp],
  );
  const offboardingCount = useMemo(
    () => allEmp.filter((e) => e.status === "offboarding").length,
    [allEmp],
  );
  const birthdays = useMemo(() => birthdaysThisWeek(allEmp), [allEmp]);
  const anniversaries = useMemo(() => anniversariesThisMonth(allEmp), [allEmp]);

  // ----- Top managers (for facet) -----
  const managerOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of allEmp) {
      if (e.managerId) counts.set(e.managerId, (counts.get(e.managerId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => {
        const mgr = employeeById.get(id);
        return {
          value: id,
          label: mgr ? `${mgr.firstName} ${mgr.lastName}` : id,
        };
      });
  }, [employeeById, allEmp]);

  const contractOptions = useMemo(() => {
    const types = new Set<string>();
    for (const e of allEmp) if (e.employmentType) types.add(e.employmentType);
    return Array.from(types).map((ct) => ({
      value: ct,
      label: t(`people.list.contractType.${ct}`),
    }));
  }, [t, allEmp]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEmp) set.add(e.location);
    return Array.from(set).map((l) => ({ value: l, label: l }));
  }, [allEmp]);

  const STATUS_OPTIONS = [
    { label: t("status.active"), value: "active" },
    { label: t("status.onboarding"), value: "onboarding" },
    { label: t("status.on_leave"), value: "on_leave" },
    { label: t("status.offboarding"), value: "offboarding" },
    { label: t("status.terminated"), value: "terminated" },
  ];

  // ----- Probation filter (client-side) -----
  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (!probationFilter) return rows;
    const cutoff = TODAY.getTime() + 30 * MS_PER_DAY;
    return rows.filter((e) => {
      if (!e.probationEnd) return false;
      const ts = Date.parse(e.probationEnd);
      return ts >= TODAY.getTime() && ts <= cutoff;
    });
  }, [data, probationFilter]);

  // ----- Columns -----
  const columns: ColumnDef<Employee>[] = [
    selectColumn<Employee>(),
    {
      id: "name",
      accessorFn: (row) => `${row.lastName} ${row.firstName}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("common.name")} />,
      cell: ({ row }) => {
        const emp = row.original;
        const name = `${emp.firstName} ${emp.lastName}`;
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
            </div>
          </div>
        );
      },
      meta: { label: t("common.name") },
    },
    {
      accessorKey: "title",
      header: t("people.list.colTitle"),
      cell: ({ row }) => {
        const title = row.original.title;
        const variant =
          title === "Manager" ? "default" : title === "Coordinator" ? "info" : "muted";
        return <Badge variant={variant}>{title}</Badge>;
      },
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.list.colTitle") },
    },
    {
      accessorKey: "jobTitle",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.list.colPosition")} />,
      cell: ({ row }) => <span className="text-sm">{row.original.jobTitle}</span>,
      meta: { label: t("people.list.colPosition") },
    },
    {
      accessorKey: "department",
      header: t("people.list.colDepartment"),
      cell: ({ row }) => <Badge variant="outline">{row.original.department}</Badge>,
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.list.colDepartment") },
    },
    {
      accessorKey: "employmentType",
      header: t("people.list.filterContract"),
      cell: ({ row }) => (
        <Badge variant="secondary">{t(`people.list.contractType.${row.original.employmentType}`)}</Badge>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.list.filterContract") },
    },
    {
      accessorKey: "location",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.list.colLocation")} />,
      cell: ({ row }) => <span className="text-sm">{row.original.location}</span>,
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.list.colLocation") },
    },
    {
      id: "managerId",
      accessorFn: (row) => row.managerId ?? "",
      header: t("people.list.colManager"),
      cell: ({ row }) => {
        const mgrId = row.original.managerId;
        const mgr = mgrId ? employeeById.get(mgrId) : undefined;
        if (!mgr) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <button
            type="button"
            className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
            onClick={(e) => {
              e.stopPropagation();
              openProfile(mgr);
            }}
          >
            {mgr.firstName} {mgr.lastName}
          </button>
        );
      },
      filterFn: (row, _id, value) => row.original.managerId === value,
      meta: { label: t("people.list.colManager") },
    },
    {
      accessorKey: "hireDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.list.colHireDate")} />,
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="text-sm">
            <p>{emp.hireDate}</p>
            <p className="text-xs text-muted-foreground">{tenureString(emp.hireDate, t)}</p>
          </div>
        );
      },
      meta: { label: t("people.list.colHireDate") },
    },
    {
      accessorKey: "probationStatus",
      header: t("people.list.colProbation"),
      cell: ({ row }) => {
        const s = row.original.probationStatus;
        if (!s) return <span className="text-xs text-muted-foreground">—</span>;
        const variant =
          s === "passed" ? "success" : s === "active" ? "warning" : "destructive";
        const label =
          s === "passed"
            ? t("people.list.probationPassed")
            : s === "active"
              ? t("people.list.probationActive")
              : t("people.list.probationPendingReview");
        return <Badge variant={variant}>{label}</Badge>;
      },
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.list.colProbation") },
    },
    {
      id: "vacationBalance",
      accessorFn: (row) => row.vacationBalance?.used ?? 0,
      header: t("people.list.colVacationBalance"),
      cell: ({ row }) => {
        const v = row.original.vacationBalance;
        if (!v) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <span className="text-sm tabular-nums">
            {t("people.list.vacationDays", { used: v.used, total: v.total })}
          </span>
        );
      },
      meta: { label: t("people.list.colVacationBalance") },
    },
    {
      accessorKey: "sickDaysYtd",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.list.colSickDays")} />,
      cell: ({ row }) => {
        const d = row.original.sickDaysYtd;
        if (d == null) return <span className="text-xs text-muted-foreground">—</span>;
        const isHigh = d > 30;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm tabular-nums",
              isHigh && "text-destructive font-semibold",
            )}
          >
            {isHigh && <AlertTriangle className="size-3.5" />}
            {d}
          </span>
        );
      },
      meta: { label: t("people.list.colSickDays") },
    },
    {
      accessorKey: "lastReviewDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.list.colLastReview")} />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.lastReviewDate ?? "—"}</span>
      ),
      meta: { label: t("people.list.colLastReview") },
    },
    {
      accessorKey: "status",
      header: t("people.list.colStatus"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.list.colStatus") },
    },
    {
      accessorKey: "performanceScore",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.list.colPerformance")} />,
      cell: ({ row }) => {
        const score = row.original.performanceScore;
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <Progress value={score} className="flex-1 h-1.5" />
            <span className="text-xs font-medium w-8 text-right">{score}%</span>
          </div>
        );
      },
      meta: { label: t("people.list.colPerformance") },
    },
    {
      accessorKey: "salary",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.list.colSalary")} />,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{formatCurrency(row.original.salary)}</span>
      ),
      meta: {
        label: t("people.list.colSalary"),
        tooltip: t("people.list.salaryHiddenTooltip"),
      },
    },
    {
      accessorKey: "email",
      header: t("people.list.colEmail"),
      // Renders nothing — column exists purely so the toolbar's email search works.
      cell: () => null,
      meta: { label: t("people.list.colEmail") },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openProfile(emp);
                }}
              >
                <FileText className="size-4" /> {t("people.employees.openProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openEditEmployee(emp);
                }}
              >
                <Pencil className="size-4" /> {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteEmp(emp);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-4" /> {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // ----- Saved views -----
  function applyView(view: "myReports" | "onboarding" | "probation" | "onLeave") {
    const table = tableRef.current;
    if (!table) return;
    // Clear any unrelated filters first to keep behaviour predictable.
    table.resetColumnFilters();
    setProbationFilter(false);
    switch (view) {
      case "myReports":
        // Direkte Unterstellte des aktuell angemeldeten Nutzers (keine fixe ID).
        table.getColumn("managerId")?.setFilterValue(me?.employee?.id);
        break;
      case "onboarding":
        table.getColumn("status")?.setFilterValue("onboarding");
        break;
      case "probation":
        setProbationFilter(true);
        break;
      case "onLeave":
        table.getColumn("status")?.setFilterValue("on_leave");
        break;
    }
  }

  function applyStatus(value: string) {
    const table = tableRef.current;
    if (!table) return;
    table.resetColumnFilters();
    setProbationFilter(false);
    table.getColumn("status")?.setFilterValue(value);
  }

  // ----- Render -----

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("people.employees.title")}
        description={t("people.employees.desc")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <LayoutGrid className="size-4" />
                  {t("people.list.savedViews")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("people.list.savedViews")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => applyView("myReports")}>
                  {t("people.list.viewMyReports")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyView("onboarding")}>
                  {t("people.list.viewOnboarding")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyView("probation")}>
                  {t("people.list.viewProbation")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyView("onLeave")}>
                  {t("people.list.viewOnLeave")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    tableRef.current?.resetColumnFilters();
                    setProbationFilter(false);
                    toast.success(t("people.list.viewsReset"));
                  }}
                >
                  {t("common.reset")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <UploadCloud className="size-4" /> {t("people.import.button")}
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus /> {t("people.employees.addBtn")}
            </Button>
          </div>
        }
      />

      {/* KPI row — Open positions wraps in a Link to /recruitment/vacancies */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard kpi={kpis[0]} accent={1} />
        <Link
          href="/recruitment/vacancies"
          className="block rounded-xl outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring hover:shadow-md"
          aria-label={t("people.list.kpiOpenRoles")}
        >
          <KpiCard kpi={kpis[1]} accent={2} />
        </Link>
        <KpiCard kpi={kpis[2]} accent={3} />
        <KpiCard kpi={kpis[3]} accent={4} />
      </div>

      {/* Secondary strip */}
      <div className="flex flex-wrap gap-3">
        <StripBadge
          icon={<CalendarClock className="size-3.5" />}
          label={t("people.list.secOnboarding")}
          count={onboardingCount}
          onClick={() => applyStatus("onboarding")}
        />
        <StripBadge
          icon={<CalendarMinus2 className="size-3.5" />}
          label={t("people.list.secOffboarding")}
          count={offboardingCount}
          onClick={() => applyStatus("offboarding")}
        />
        {birthdays.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                <Cake className="size-3.5 text-warning" />
                <span>{t("people.list.secBirthdays")}</span>
                <Badge variant="warning">{birthdays.length}</Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("people.list.birthdaysTitle")}
              </p>
              <div className="space-y-1.5">
                {birthdays.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openProfile(e)}
                    className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px] font-semibold">
                        {initials(`${e.firstName} ${e.lastName}`)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{e.firstName} {e.lastName}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {anniversaries.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                <PartyPopper className="size-3.5 text-info" />
                <span>{t("people.list.secAnniversaries")}</span>
                <Badge variant="info">{anniversaries.length}</Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("people.list.anniversariesTitle")}
              </p>
              <div className="space-y-1.5">
                {anniversaries.map((e) => {
                  const years = TODAY.getUTCFullYear() - new Date(e.hireDate + "T00:00:00Z").getUTCFullYear();
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => openProfile(e)}
                      className="flex w-full items-center justify-between gap-2 rounded-md p-1.5 text-left text-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                    >
                      <span className="truncate">{e.firstName} {e.lastName}</span>
                      <Badge variant="info">{years}J</Badge>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <AddEmployeeWizard open={addOpen} onOpenChange={setAddOpen} />

      <ImportEmployeesDialog open={importOpen} onOpenChange={setImportOpen} />

      <EditEmployeeDialog employee={editEmp} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteEmp(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("people.editEmployee.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("people.editEmployee.deleteDesc", {
              name: deleteEmp ? `${deleteEmp.firstName} ${deleteEmp.lastName}` : "",
            })}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("common.cancel")}</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void confirmDeleteEmployee()}>
              <Trash2 className="size-4" /> {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FadeIn>
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          searchKey="email"
          searchPlaceholder={t("people.employees.searchPlaceholder")}
          facets={[
            { columnId: "title", title: t("people.list.colTitle"), options: TITLE_OPTIONS },
            { columnId: "department", title: t("people.list.colDepartment"), options: DEPT_OPTIONS },
            { columnId: "status", title: t("people.list.colStatus"), options: STATUS_OPTIONS },
            { columnId: "managerId", title: t("people.list.filterManager"), options: managerOptions },
            { columnId: "employmentType", title: t("people.list.filterContract"), options: contractOptions },
            { columnId: "location", title: t("people.list.filterLocation"), options: locationOptions },
          ]}
          extraToolbar={
            <Button
              variant={probationFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setProbationFilter((v) => !v)}
              aria-pressed={probationFilter}
            >
              <CalendarClock className="size-3.5" />
              {t("people.list.probationFilterToggle")}
            </Button>
          }
          initialColumnVisibility={{
            salary: false,
            email: false,
            lastReviewDate: false,
          }}
          onTableReady={(tbl) => {
            tableRef.current = tbl as unknown as TanstackTable<Employee>;
          }}
          onRowClick={openProfile}
          onBulkDelete={(rows) => bulkDelete("employees", "employees", rows)}
          pageSize={10}
        />
      </FadeIn>

      <EmployeeProfileSheet
        employee={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

function StripBadge({
  icon,
  label,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
    >
      {icon}
      <span>{label}</span>
      <Badge variant="muted">{count}</Badge>
    </button>
  );
}

