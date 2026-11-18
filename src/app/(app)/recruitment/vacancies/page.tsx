"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  Plus,
  Users,
  X,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { ChartCard, CHART_COLORS } from "@/components/widgets/chart-card";
import { PostJobWizard } from "@/components/recruitment/post-job-wizard";
import { useT } from "@/lib/i18n";
import { useVacancies } from "@/lib/queries";
import { cn, formatNumber, initials } from "@/lib/utils";
import type {
  JobVacancy,
  Kpi,
  TimeSeriesPoint,
  VacancyPriority,
  VacancyWorkplaceModel,
} from "@/types";

// Fixed "today" — deterministic across SSR/CSR for age math.
const TODAY = new Date(Date.UTC(2026, 4, 30));
const MS_PER_DAY = 86_400_000;
const AGING_DAYS = 60;

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((TODAY.getTime() - Date.parse(iso)) / MS_PER_DAY));
}

const TREND_MONTHS = [
  "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
  "Dec", "Jan", "Feb", "Mar", "Apr", "May",
];
function sparkline(now: number, amp: number, phase: number): TimeSeriesPoint[] {
  return TREND_MONTHS.map((label, i) => ({
    label,
    value: Math.max(0, Math.round(now + Math.sin((i + phase) * 0.9) * amp)),
  }));
}

// ---------------------------------------------------------------------
// "Post job" trigger — opens the 5-step wizard
// ---------------------------------------------------------------------

function PostJobTrigger() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> {t("recruitment.vacancies.postJob")}
      </Button>
      <PostJobWizard open={open} onOpenChange={setOpen} />
    </>
  );
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

const PRIORITY_VARIANTS: Record<VacancyPriority, "destructive" | "warning" | "secondary"> = {
  P0: "destructive",
  P1: "warning",
  P2: "secondary",
};
const WORKPLACE_KEY: Record<VacancyWorkplaceModel, string> = {
  office: "recruitment.vacancies.workplaceOffice",
  hybrid: "recruitment.vacancies.workplaceHybrid",
  remote: "recruitment.vacancies.workplaceRemote",
};
const PRIORITY_KEY: Record<VacancyPriority, string> = {
  P0: "recruitment.vacancies.priorityP0",
  P1: "recruitment.vacancies.priorityP1",
  P2: "recruitment.vacancies.priorityP2",
};

// Keine erfundenen Kennzahlen — ohne Verlaufs-/Planungsdaten 0.
const HEADCOUNT_PLAN = 0;
const HEADCOUNT_HIRED = 0;
const TIME_TO_HIRE_DAYS = 0;
const OFFER_ACCEPTANCE_PCT = 0;

export default function VacanciesPage() {
  const t = useT();
  const { data: vacancies = [], isLoading } = useVacancies();

  // ----- Filter state -----
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string>("all");
  const [location, setLocation] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [recruiter, setRecruiter] = useState<string>("all");
  const [hiringManager, setHiringManager] = useState<string>("all");
  const [workplace, setWorkplace] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [agingOnly, setAgingOnly] = useState(false);

  // ----- Derived filter options from the data -----
  const departmentOptions = useMemo(
    () => Array.from(new Set(vacancies.map((v) => v.department))).sort(),
    [vacancies],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(vacancies.map((v) => v.location))).sort(),
    [vacancies],
  );
  const recruiterOptions = useMemo(
    () =>
      Array.from(
        new Set(vacancies.map((v) => v.recruiter ?? "—").filter((v) => v !== "—")),
      ).sort(),
    [vacancies],
  );
  const hiringManagerOptions = useMemo(
    () => Array.from(new Set(vacancies.map((v) => v.hiringManager))).sort(),
    [vacancies],
  );

  // ----- Filtered list (drives both views) -----
  const filtered = useMemo(() => {
    const fromTs = dateFrom ? Date.parse(dateFrom) : -Infinity;
    const toTs = dateTo ? Date.parse(dateTo) + MS_PER_DAY - 1 : Infinity;
    return vacancies.filter((v) => {
      if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (department !== "all" && v.department !== department) return false;
      if (location !== "all" && v.location !== location) return false;
      if (status !== "all" && v.status !== status) return false;
      if (priority !== "all" && v.priority !== priority) return false;
      if (recruiter !== "all" && v.recruiter !== recruiter) return false;
      if (hiringManager !== "all" && v.hiringManager !== hiringManager) return false;
      if (workplace !== "all" && v.workplaceModel !== workplace) return false;
      const ts = Date.parse(v.openedAt);
      if (ts < fromTs || ts > toTs) return false;
      if (agingOnly && daysSince(v.openedAt) <= AGING_DAYS) return false;
      return true;
    });
  }, [
    vacancies,
    search,
    department,
    location,
    status,
    priority,
    recruiter,
    hiringManager,
    workplace,
    dateFrom,
    dateTo,
    agingOnly,
  ]);

  // ----- KPI math -----
  const openCount = vacancies.filter((v) => v.status === "open").length;
  const totalApplicants = vacancies.reduce((s, v) => s + v.applicants, 0);
  const avgPerRole = vacancies.length > 0
    ? Math.round(totalApplicants / vacancies.length)
    : 0;
  const agingCount = vacancies.filter(
    (v) => v.status === "open" && daysSince(v.openedAt) > AGING_DAYS,
  ).length;

  const kpis: Kpi[] = [
    {
      id: "vac-open",
      label: t("recruitment.vacancies.kpiOpen"),
      value: openCount,
      format: "number",
      delta: 0,
      trend: sparkline(openCount, 2, 0.3),
    },
    {
      id: "vac-applicants",
      label: t("recruitment.vacancies.kpiApplicants"),
      value: totalApplicants,
      format: "number",
      delta: 0,
      trend: sparkline(totalApplicants / 10, 6, 1.1),
    },
    {
      id: "vac-avg-per-role",
      label: t("recruitment.vacancies.kpiAvgPerRole"),
      value: avgPerRole,
      format: "number",
      delta: 0,
      trend: sparkline(avgPerRole, 3, 1.7),
    },
    {
      id: "vac-time-to-hire",
      label: t("recruitment.vacancies.kpiTimeToHire"),
      value: TIME_TO_HIRE_DAYS,
      format: "number",
      delta: 0,
      trend: sparkline(TIME_TO_HIRE_DAYS, 3, 0.6),
    },
    {
      id: "vac-acceptance",
      label: t("recruitment.vacancies.kpiAcceptance"),
      value: OFFER_ACCEPTANCE_PCT,
      format: "percent",
      delta: 0,
      trend: sparkline(OFFER_ACCEPTANCE_PCT, 4, 2.3),
    },
    {
      id: "vac-aging",
      label: t("recruitment.vacancies.kpiAging"),
      value: agingCount,
      format: "number",
      delta: 0,
      trend: sparkline(agingCount, 1.5, 2.8),
    },
  ];

  // ----- Chart data -----
  const funnelData: TimeSeriesPoint[] = useMemo(() => {
    const acc = { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0 };
    for (const v of vacancies) {
      if (!v.funnel) continue;
      acc.applied += v.funnel.applied;
      acc.screening += v.funnel.screening;
      acc.interview += v.funnel.interview;
      acc.offer += v.funnel.offer;
      acc.hired += v.funnel.hired;
    }
    return [
      { label: t("recruitment.vacancies.funnelApplied"), value: acc.applied },
      { label: t("recruitment.vacancies.funnelScreening"), value: acc.screening },
      { label: t("recruitment.vacancies.funnelInterview"), value: acc.interview },
      { label: t("recruitment.vacancies.funnelOffer"), value: acc.offer },
      { label: t("recruitment.vacancies.funnelHired"), value: acc.hired },
    ];
  }, [vacancies, t]);

  const sourceData: TimeSeriesPoint[] = useMemo(() => {
    const acc = new Map<string, number>();
    for (const v of vacancies) {
      if (!v.sourceMix) continue;
      for (const s of v.sourceMix) {
        acc.set(s.source, (acc.get(s.source) ?? 0) + s.count);
      }
    }
    return Array.from(acc.entries()).map(([label, value]) => ({ label, value }));
  }, [vacancies]);

  // ----- Table columns -----
  const TYPE_LABELS: Record<string, string> = {
    full_time: t("recruitment.vacancies.type.full_time"),
    part_time: t("recruitment.vacancies.type.part_time"),
    contractor: t("recruitment.vacancies.type.contractor"),
  };

  const columns: ColumnDef<JobVacancy>[] = [
    selectColumn<JobVacancy>(),
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("recruitment.vacancies.table.jobTitle")} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: "priority",
      header: t("recruitment.vacancies.filterPriority"),
      cell: ({ row }) => {
        const p = row.original.priority;
        if (!p) return <span className="text-xs text-muted-foreground">—</span>;
        return <Badge variant={PRIORITY_VARIANTS[p]}>{p}</Badge>;
      },
    },
    {
      accessorKey: "department",
      header: t("common.department"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.department}</span>
      ),
    },
    {
      accessorKey: "location",
      header: t("common.location"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.location}</span>
      ),
    },
    {
      accessorKey: "workplaceModel",
      header: t("recruitment.vacancies.filterWorkplace"),
      cell: ({ row }) => {
        const w = row.original.workplaceModel;
        if (!w) return <span className="text-xs text-muted-foreground">—</span>;
        return <Badge variant="outline">{t(WORKPLACE_KEY[w])}</Badge>;
      },
    },
    {
      accessorKey: "applicants",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("recruitment.vacancies.table.applicants")} />
      ),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 font-medium">
          <Users className="size-3.5 text-muted-foreground" />
          {row.original.applicants}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "hiringManager",
      header: t("recruitment.vacancies.table.hiringManager"),
      cell: ({ row }) => <span className="text-sm">{row.original.hiringManager}</span>,
    },
    {
      accessorKey: "recruiter",
      header: t("recruitment.vacancies.recruiter"),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.recruiter ?? "—"}</span>
      ),
    },
    {
      accessorKey: "openedAt",
      header: t("recruitment.vacancies.filterDateRange"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.openedAt}
        </span>
      ),
    },
    {
      id: "type",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {TYPE_LABELS[row.original.type] ?? row.original.type}
        </Badge>
      ),
      header: t("common.type"),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/recruitment/pipeline?vacancy=${row.original.id}`}>
            <Button variant="ghost" size="sm">
              {t("recruitment.vacancies.card.openPipeline")}
            </Button>
          </Link>
          <VacancyActionsMenu vacancy={row.original} />
        </div>
      ),
    },
  ];

  function resetFilters() {
    setSearch("");
    setDepartment("all");
    setLocation("all");
    setStatus("all");
    setPriority("all");
    setRecruiter("all");
    setHiringManager("all");
    setWorkplace("all");
    setDateFrom("");
    setDateTo("");
    setAgingOnly(false);
  }

  const dateActive = Boolean(dateFrom || dateTo);
  const anyFilterActive =
    search.length > 0 ||
    department !== "all" ||
    location !== "all" ||
    status !== "all" ||
    priority !== "all" ||
    recruiter !== "all" ||
    hiringManager !== "all" ||
    workplace !== "all" ||
    agingOnly ||
    dateActive;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title={t("recruitment.vacancies.title")}
          description={t("recruitment.vacancies.desc")}
          className="flex-1"
        />
        <div className="flex flex-wrap items-stretch gap-2">
          <HeadcountWidget hired={HEADCOUNT_HIRED} planned={HEADCOUNT_PLAN} />
          <PostJobTrigger />
        </div>
      </div>

      {/* KPI row */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StaggerItem><KpiCard kpi={kpis[0]} accent={1} hideDelta /></StaggerItem>
        <StaggerItem><KpiCard kpi={kpis[1]} accent={2} hideDelta /></StaggerItem>
        <StaggerItem><KpiCard kpi={kpis[2]} accent={3} hideDelta /></StaggerItem>
        <StaggerItem><KpiCard kpi={kpis[3]} accent={5} hideDelta /></StaggerItem>
        <StaggerItem><KpiCard kpi={kpis[4]} accent={2} hideDelta /></StaggerItem>
        <StaggerItem>
          <div
            className={cn(
              "rounded-xl",
              agingCount > 0 &&
                "ring-1 ring-destructive/40 shadow-[0_0_0_4px_color-mix(in_oklch,var(--destructive)_12%,transparent)]",
            )}
          >
            <KpiCard kpi={kpis[5]} accent={4} hideDelta />
          </div>
        </StaggerItem>
      </Stagger>

      {/* Charts strip */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FadeIn>
          <ChartCard
            title={t("recruitment.vacancies.chartFunnelTitle")}
            description={t("recruitment.vacancies.chartFunnelDesc")}
            type="bar"
            data={funnelData}
            series={["value"]}
            seriesLabels={{ value: t("recruitment.vacancies.kpiApplicants") }}
            height={260}
          />
        </FadeIn>
        <FadeIn delay={0.05}>
          <ChartCard
            title={t("recruitment.vacancies.chartSourcesTitle")}
            description={t("recruitment.vacancies.chartSourcesDesc")}
            type="pie"
            data={sourceData}
            series={[]}
            valueKey="value"
            height={260}
          />
        </FadeIn>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Input
                placeholder={t("recruitment.vacancies.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <FilterSelect
              value={department}
              onChange={setDepartment}
              placeholder={t("common.department")}
              options={departmentOptions}
            />
            <FilterSelect
              value={location}
              onChange={setLocation}
              placeholder={t("common.location")}
              options={locationOptions}
            />
            <FilterSelect
              value={status}
              onChange={setStatus}
              placeholder={t("common.status")}
              options={["open", "on_hold", "closed"]}
              labelFor={(v) => t(`status.${v}`)}
            />
            <FilterSelect
              value={priority}
              onChange={setPriority}
              placeholder={t("recruitment.vacancies.filterPriority")}
              options={["P0", "P1", "P2"]}
              labelFor={(v) => t(PRIORITY_KEY[v as VacancyPriority])}
            />
            <FilterSelect
              value={workplace}
              onChange={setWorkplace}
              placeholder={t("recruitment.vacancies.filterWorkplace")}
              options={["office", "hybrid", "remote"]}
              labelFor={(v) => t(WORKPLACE_KEY[v as VacancyWorkplaceModel])}
            />
            <FilterSelect
              value={recruiter}
              onChange={setRecruiter}
              placeholder={t("recruitment.vacancies.filterRecruiter")}
              options={recruiterOptions}
            />
            <FilterSelect
              value={hiringManager}
              onChange={setHiringManager}
              placeholder={t("recruitment.vacancies.filterHiringManager")}
              options={hiringManagerOptions}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={dateActive ? "default" : "outline"}
                  size="sm"
                >
                  <CalendarIcon className="size-3.5" />
                  {t("recruitment.vacancies.filterDateRange")}
                  {dateActive && (
                    <Badge variant="muted" className="ml-1">
                      {[dateFrom, dateTo].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="vac-from">
                      {t("recruitment.vacancies.filterDateFrom")}
                    </Label>
                    <Input
                      id="vac-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vac-to">
                      {t("recruitment.vacancies.filterDateTo")}
                    </Label>
                    <Input
                      id="vac-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  {dateActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                    >
                      {t("payroll.reimbursements.dateClear")}
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              variant={agingOnly ? "default" : "outline"}
              aria-pressed={agingOnly}
              onClick={() => setAgingOnly((v) => !v)}
            >
              <AlertTriangle className="size-3.5" />
              {t("recruitment.vacancies.filterAgingOnly")}
            </Button>
            {anyFilterActive && (
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                <X className="size-3.5" />
                {t("recruitment.vacancies.filtersReset")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <FadeIn>
        <Tabs defaultValue="cards">
          <TabsList>
            <TabsTrigger value="cards">
              <LayoutGrid className="mr-1.5 size-4" />
              {t("recruitment.vacancies.tabs.cards")}
            </TabsTrigger>
            <TabsTrigger value="table">
              <List className="mr-1.5 size-4" />
              {t("recruitment.vacancies.tabs.table")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cards">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[320px] animate-pulse rounded-xl border border-border bg-muted/40"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                {t("recruitment.vacancies.empty")}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((v) => (
                  <VacancyCard key={v.id} vacancy={v} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="table">
            <DataTable
              columns={columns}
              data={filtered}
              loading={isLoading}
              pageSize={10}
            />
          </TabsContent>
        </Tabs>
      </FadeIn>
    </div>
  );
}

// ---------------------------------------------------------------------
// Filter select helper
// ---------------------------------------------------------------------

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  labelFor,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  labelFor?: (v: string) => string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[140px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Alle · {placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labelFor ? labelFor(o) : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------
// Headcount widget — small Card next to PageHeader actions
// ---------------------------------------------------------------------

function HeadcountWidget({ hired, planned }: { hired: number; planned: number }) {
  const t = useT();
  const pct = Math.min(100, Math.round((hired / Math.max(1, planned)) * 100));
  return (
    <Card className="flex-1 min-w-[220px] lg:min-w-[260px]">
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t("recruitment.vacancies.headcountWidgetTitle")}
          </p>
          <p className="font-display text-sm font-semibold tabular-nums">
            {t("recruitment.vacancies.headcountWidgetValue", { hired, planned })}
          </p>
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="text-[11px] text-muted-foreground">
          {t("recruitment.vacancies.headcountWidgetSubtitle", { hired, planned })}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Vacancy card
// ---------------------------------------------------------------------

function VacancyCard({ vacancy }: { vacancy: JobVacancy }) {
  const t = useT();
  const age = daysSince(vacancy.openedAt);
  const isAging = age > AGING_DAYS;
  const hasSalary = vacancy.salaryMin != null && vacancy.salaryMax != null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-snug">{vacancy.title}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {vacancy.priority && (
                <Badge variant={PRIORITY_VARIANTS[vacancy.priority]}>
                  {vacancy.priority}
                </Badge>
              )}
              {vacancy.workplaceModel && (
                <Badge variant="outline">
                  {t(WORKPLACE_KEY[vacancy.workplaceModel])}
                </Badge>
              )}
              <StatusBadge status={vacancy.status} />
            </div>
          </div>
          <VacancyActionsMenu vacancy={vacancy} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5" /> {vacancy.department}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {vacancy.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {vacancy.applicants}
          </span>
        </div>

        {/* Salary or warning */}
        {hasSalary ? (
          <p className="text-sm font-medium">
            {t("recruitment.vacancies.salaryRange", {
              min: formatNumber(vacancy.salaryMin as number),
              max: formatNumber(vacancy.salaryMax as number),
            })}
          </p>
        ) : (
          <Badge variant="destructive" className="text-[11px]">
            <AlertTriangle className="size-3" />
            {t("recruitment.vacancies.salaryMissing")}
          </Badge>
        )}

        {/* Aging */}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              isAging ? "bg-destructive" : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          <span className={cn(isAging && "font-semibold text-destructive")}>
            {t("recruitment.vacancies.postedDaysAgo", { days: age })}
          </span>
        </div>

        {/* Mini funnel bar */}
        {vacancy.funnel && <MiniFunnel funnel={vacancy.funnel} />}

        {/* Required start + cost center */}
        <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          {vacancy.requiredStartDate && (
            <span>
              {t("recruitment.vacancies.requiredStart", {
                date: vacancy.requiredStartDate,
              })}
            </span>
          )}
          {vacancy.costCenter && (
            <span>
              {t("recruitment.vacancies.costCenter", { cc: vacancy.costCenter })}
            </span>
          )}
        </div>

        {/* People — HM + recruiter */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
          <p className="text-xs text-muted-foreground">
            {t("recruitment.vacancies.card.hiringManager")} ·{" "}
            {t("recruitment.vacancies.recruiter")}
          </p>
          <div className="flex items-center -space-x-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="size-7 ring-2 ring-card">
                  <AvatarFallback className="text-[10px]">
                    {initials(vacancy.hiringManager)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                {t("recruitment.vacancies.hiringManagerTooltip", {
                  name: vacancy.hiringManager,
                })}
              </TooltipContent>
            </Tooltip>
            {vacancy.recruiter && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="size-7 ring-2 ring-card">
                    <AvatarFallback className="text-[10px]">
                      {initials(vacancy.recruiter)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  {t("recruitment.vacancies.recruiterTooltip", {
                    name: vacancy.recruiter,
                  })}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Link href={`/recruitment/pipeline?vacancy=${vacancy.id}`} className="w-full">
          <Button variant="outline" size="sm" className="w-full">
            {t("recruitment.vacancies.card.openPipeline")}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Mini funnel bar
// ---------------------------------------------------------------------

function MiniFunnel({ funnel }: { funnel: NonNullable<JobVacancy["funnel"]> }) {
  const t = useT();
  const segments: { key: string; label: string; value: number }[] = [
    { key: "applied", label: t("recruitment.vacancies.funnelApplied"), value: funnel.applied },
    { key: "screening", label: t("recruitment.vacancies.funnelScreening"), value: funnel.screening },
    { key: "interview", label: t("recruitment.vacancies.funnelInterview"), value: funnel.interview },
    { key: "offer", label: t("recruitment.vacancies.funnelOffer"), value: funnel.offer },
  ];
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  return (
    <div className="space-y-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s, i) => (
          <Tooltip key={s.key}>
            <TooltipTrigger asChild>
              <div
                style={{
                  width: `${(s.value / total) * 100}%`,
                  background: CHART_COLORS[i % CHART_COLORS.length],
                }}
                className="h-full first:rounded-l-full last:rounded-r-full transition-opacity hover:opacity-80"
                aria-label={`${s.label}: ${s.value}`}
              />
            </TooltipTrigger>
            <TooltipContent>
              {s.label}: {s.value}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        {segments.map((s, i) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span
              className="size-1.5 rounded-full"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            {s.label} {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 3-dot menu
// ---------------------------------------------------------------------

function VacancyActionsMenu({ vacancy }: { vacancy: JobVacancy }) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            toast.success(
              t("recruitment.vacancies.toastDuplicated", { title: vacancy.title }),
            );
          }}
        >
          {t("recruitment.vacancies.menuDuplicate")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            toast.warning(
              t("recruitment.vacancies.toastHeld", { title: vacancy.title }),
            );
          }}
        >
          {t("recruitment.vacancies.menuHold")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            toast.error(
              t("recruitment.vacancies.toastClosed", { title: vacancy.title }),
            );
          }}
        >
          {t("recruitment.vacancies.menuClose")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            toast.message(
              t("recruitment.vacancies.toastEdit", { title: vacancy.title }),
            );
          }}
        >
          {t("recruitment.vacancies.menuEdit")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
