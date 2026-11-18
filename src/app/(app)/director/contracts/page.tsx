"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { CreateContractDialog } from "@/components/director/create-contract-dialog";
import { useContracts, useContractTemplates } from "@/lib/queries";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Contract, ContractStatus, ContractType, Kpi, TimeSeriesPoint } from "@/types";

const TREND_MONTHS = [
  "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
  "Dec", "Jan", "Feb", "Mar", "Apr", "May",
];
function buildTrend(now: number, amplitude: number, phase: number): TimeSeriesPoint[] {
  return TREND_MONTHS.map((label, i) => {
    const v = Math.round(now + Math.sin((i + phase) * 0.9) * amplitude);
    return { label, value: Math.max(0, v) };
  });
}

const CONTRACT_TODAY = new Date(Date.UTC(2026, 5, 5));
function daysToEnd(endDate: string | null): number | null {
  if (!endDate) return null;
  return Math.round(
    (new Date(endDate).getTime() - CONTRACT_TODAY.getTime()) / 86_400_000,
  );
}

export default function ContractsPage() {
  const t = useT();
  const { data, isLoading } = useContracts();
  const { data: contractTemplates = [] } = useContractTemplates();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const all = data ?? [];

  const TYPE_LABELS: Record<ContractType, string> = useMemo(
    () => ({
      permanent: t("director.contracts.typePermanent"),
      fixed_term: t("director.contracts.typeFixedTerm"),
      part_time: t("director.contracts.typePartTime"),
      freelance: t("director.contracts.typeFreelance"),
      working_student: t("director.contracts.typeWorkingStudent"),
      intern: t("director.contracts.typeIntern"),
      mini_job: t("director.contracts.typeMiniJob"),
    }),
    [t],
  );

  const kpis: Kpi[] = useMemo(() => {
    const total = all.length;
    const active = all.filter((c) => c.status === "active").length;
    const expiring = all.filter((c) => c.status === "expiring_soon").length;
    const expired = all.filter((c) => c.status === "expired").length;
    const annualCost = all
      .filter((c) => c.status === "active" || c.status === "expiring_soon")
      .reduce((s, c) => s + c.salary, 0);
    return [
      {
        id: "ctr-total",
        label: t("director.contracts.kpiTotal"),
        value: total,
        format: "number",
        delta: 0,
        trend: buildTrend(total, 4, 0.3),
      },
      {
        id: "ctr-active",
        label: t("director.contracts.kpiActive"),
        value: active,
        format: "number",
        delta: 0,
        trend: buildTrend(active, 5, 1.1),
      },
      {
        id: "ctr-expiring",
        label: t("director.contracts.kpiExpiring"),
        value: expiring,
        format: "number",
        delta: 0,
        trend: buildTrend(expiring, 2, 2.0),
      },
      {
        id: "ctr-expired",
        label: t("director.contracts.kpiExpired"),
        value: expired,
        format: "number",
        delta: 0,
        trend: buildTrend(expired, 1.5, 1.7),
      },
      {
        id: "ctr-annual-cost",
        label: t("director.contracts.kpiAnnualCost"),
        value: annualCost,
        format: "currency",
        delta: 0,
        trend: buildTrend(annualCost / 1000, 18, 0.3),
      },
    ];
  }, [all, t]);

  const STATUS_OPTIONS: Array<{ label: string; value: ContractStatus }> = [
    { label: t("status.active"), value: "active" },
    { label: t("status.expiring_soon"), value: "expiring_soon" },
    { label: t("status.expired"), value: "expired" },
    { label: t("status.draft"), value: "draft" },
    { label: t("status.terminated"), value: "terminated" },
  ];
  const TYPE_OPTIONS: Array<{ label: string; value: ContractType }> = (
    Object.keys(TYPE_LABELS) as ContractType[]
  ).map((k) => ({ label: TYPE_LABELS[k], value: k }));
  const TEMPLATE_OPTIONS = contractTemplates.map((tpl) => ({
    label: tpl.name,
    value: tpl.id,
  }));

  const columns: ColumnDef<Contract>[] = [
    selectColumn<Contract>(),
    {
      accessorKey: "employeeName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("director.contracts.colEmployee")}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="text-xs">
              {initials(row.original.employeeName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium leading-tight">
              {row.original.employeeName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.jobTitle}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: t("director.contracts.colType"),
      cell: ({ row }) => (
        <Badge variant="secondary">{TYPE_LABELS[row.original.type]}</Badge>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "templateId",
      header: t("director.contracts.colTemplate"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.templateName}
        </span>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "startDate",
      header: t("director.contracts.colStart"),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.startDate}</span>
      ),
    },
    {
      accessorKey: "endDate",
      header: t("director.contracts.colEnd"),
      cell: ({ row }) => {
        const end = row.original.endDate;
        if (!end) {
          return (
            <span className="text-xs text-muted-foreground">
              {t("director.overview.permanent")}
            </span>
          );
        }
        const days = daysToEnd(end);
        return (
          <div className="flex flex-col">
            <span className="font-mono text-xs">{end}</span>
            {days !== null && (
              <span
                className={cn(
                  "text-[11px]",
                  days < 0
                    ? "text-destructive"
                    : days <= 60
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                {days < 0
                  ? t("director.overview.daysOverdue", {
                    days: String(Math.abs(days)),
                  })
                  : t("director.overview.daysLeft", { days: String(days) })}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "hoursPerWeek",
      header: t("director.contracts.colHours"),
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.hoursPerWeek > 0 ? `${row.original.hoursPerWeek} h` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "salary",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("director.contracts.colSalary")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatCurrency(row.original.salary)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("director.contracts.colStatus"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
  ];

  function handleRowClick(row: Contract) {
    setSelected(row);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("director.contracts.title")}
        description={t("director.contracts.desc")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t("director.contracts.createBtn")}
          </Button>
        }
      />

      <CreateContractDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Stagger>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, i) => (
            <StaggerItem key={kpi.id}>
              <KpiCard kpi={kpi} accent={(i % 5) + 1} />
            </StaggerItem>
          ))}
        </div>
      </Stagger>

      <FadeIn>
        <DataTable
          columns={columns}
          data={all}
          loading={isLoading}
          searchKey="employeeName"
          searchPlaceholder={t("common.search")}
          facets={[
            {
              columnId: "status",
              title: t("director.contracts.facetStatus"),
              options: STATUS_OPTIONS,
            },
            {
              columnId: "type",
              title: t("director.contracts.facetType"),
              options: TYPE_OPTIONS,
            },
            {
              columnId: "templateId",
              title: t("director.contracts.facetTemplate"),
              options: TEMPLATE_OPTIONS,
            },
          ]}
          onRowClick={handleRowClick}
          pageSize={10}
        />
      </FadeIn>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          {selected && (
            <ContractSheet contract={selected} typeLabel={TYPE_LABELS[selected.type]} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ContractSheet({
  contract,
  typeLabel,
}: {
  contract: Contract;
  typeLabel: string;
}) {
  const t = useT();
  const { data: contractTemplates = [] } = useContractTemplates();
  const tpl = contractTemplates.find((x) => x.id === contract.templateId);
  const days = daysToEnd(contract.endDate);

  const rows: Array<[string, React.ReactNode]> = [
    [t("director.contracts.create.template"), contract.templateName],
    [t("director.contracts.create.jobTitle"), contract.jobTitle],
    [t("director.contracts.colType"), typeLabel],
    [t("director.contracts.create.startDate"), contract.startDate],
    [
      t("director.contracts.create.endDate"),
      contract.endDate ?? t("director.overview.permanent"),
    ],
    [
      t("director.contracts.colHours"),
      contract.hoursPerWeek > 0 ? `${contract.hoursPerWeek} h` : "—",
    ],
    [
      t("director.contracts.create.salary"),
      formatCurrency(contract.salary),
    ],
    [
      t("director.contracts.create.notice"),
      `${contract.noticePeriodWeeks} Wo.`,
    ],
  ];

  return (
    <>
      <SheetHeader>
        <SheetTitle>{contract.employeeName}</SheetTitle>
        <SheetDescription>
          {contract.id} · {contract.jobTitle}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Avatar className="size-12">
            <AvatarFallback>{initials(contract.employeeName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{contract.employeeName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>{typeLabel}</span>
              {days !== null && (
                <span
                  className={cn(
                    days < 0
                      ? "text-destructive"
                      : days <= 60
                        ? "text-warning"
                        : "",
                  )}
                >
                  {days < 0
                    ? t("director.overview.daysOverdue", {
                      days: String(Math.abs(days)),
                    })
                    : t("director.overview.daysLeft", { days: String(days) })}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={contract.status} />
        </div>

        <div className="rounded-lg border border-border">
          <div className="divide-y divide-border">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {tpl && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("director.contracts.create.templateClauses")}
            </p>
            <ul className="space-y-1 text-sm">
              {tpl.clauses.map((c) => (
                <li
                  key={c}
                  className="before:mr-2 before:text-success before:content-['✓']"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.print()}
        >
          PDF-Export
        </Button>
      </div>

      {/* Druck-/PDF-Layout: am Bildschirm versteckt, nur beim Drucken ("Als PDF speichern"). */}
      <div id="contract-print" className="hidden print:block">
        <div className="p-8 text-black">
          <h1 className="text-2xl font-bold">{contract.employeeName}</h1>
          <p className="mt-1 text-sm">
            {typeLabel} · {contract.id}
          </p>
          <table className="mt-6 w-full border-collapse text-sm">
            <tbody>
              {rows.map(([label, value], i) => (
                <tr key={i} className="border-b border-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{label}</td>
                  <td className="py-1.5 text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #contract-print, #contract-print * { visibility: visible !important; }
          #contract-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            background: white !important;
          }
        }
      `}</style>
    </>
  );
}
