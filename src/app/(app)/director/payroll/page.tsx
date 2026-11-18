"use client";

import { useMemo, useState } from "react";
import { Plus, FileSpreadsheet } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { CreatePayslipDialog } from "@/components/payroll/create-payslip-dialog";
import { usePayslips } from "@/lib/queries";
import { bulkDelete } from "@/lib/use-bulk-delete";
import { formatCurrency, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Kpi, Payslip, TimeSeriesPoint } from "@/types";

// Director-created payslips use this id prefix (set in CreatePayslipDialog).
const DIRECTOR_PREFIX = "PS-NEW-";

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

export default function DirectorPayrollPage() {
  const t = useT();
  const { data, isLoading } = usePayslips();
  const [createOpen, setCreateOpen] = useState(false);

  const directorOnly = useMemo(
    () => (data ?? []).filter((p) => p.id.startsWith(DIRECTOR_PREFIX)),
    [data],
  );

  const kpis: Kpi[] = useMemo(() => {
    const count = directorOnly.length;
    const totalGross = directorOnly.reduce((s, p) => s + p.gross, 0);
    const totalNet = directorOnly.reduce((s, p) => s + p.net, 0);
    const avgGross = count ? Math.round(totalGross / count) : 0;
    const avgNet = count ? Math.round(totalNet / count) : 0;
    return [
      {
        id: "dpr-month",
        label: t("director.payroll.kpiThisMonth"),
        value: count,
        format: "number",
        delta: 0,
        trend: buildTrend(count, 2, 0.3),
      },
      {
        id: "dpr-total-gross",
        label: t("director.payroll.kpiTotalGross"),
        value: totalGross,
        format: "currency",
        delta: 0,
        trend: buildTrend(totalGross / 1000, 6, 1.1),
      },
      {
        id: "dpr-avg-gross",
        label: t("director.payroll.kpiAvgGross"),
        value: avgGross,
        format: "currency",
        delta: 0,
        trend: buildTrend(avgGross / 100, 3, 0.7),
      },
      {
        id: "dpr-avg-net",
        label: t("director.payroll.kpiAvgNet"),
        value: avgNet,
        format: "currency",
        delta: 0,
        trend: buildTrend(avgNet / 100, 3, 1.8),
      },
    ];
  }, [directorOnly, t]);

  const STATUS_OPTIONS = [
    { label: t("payroll.payslips.statusPaid"), value: "paid" },
    { label: t("payroll.payslips.statusProcessing"), value: "processing" },
    { label: t("payroll.payslips.statusScheduled"), value: "scheduled" },
  ];

  const columns: ColumnDef<Payslip>[] = [
    selectColumn<Payslip>(),
    {
      accessorKey: "employeeName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("director.payroll.colEmployee")}
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
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {row.original.id}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "period",
      header: t("director.payroll.colPeriod"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.period}</span>
      ),
    },
    {
      accessorKey: "gross",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("director.payroll.colGross")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {formatCurrency(row.original.gross)}
        </span>
      ),
    },
    {
      accessorKey: "tax",
      header: t("director.payroll.colTax"),
      cell: ({ row }) => (
        <span className="font-mono text-sm text-destructive">
          -{formatCurrency(row.original.tax)}
        </span>
      ),
    },
    {
      accessorKey: "net",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("director.payroll.colNet")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">
          {formatCurrency(row.original.net)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("director.payroll.colStatus"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("director.payroll.title")}
        description={t("director.payroll.desc")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t("director.payroll.createBtn")}
          </Button>
        }
      />

      <CreatePayslipDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Stagger>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <StaggerItem key={kpi.id}>
              <KpiCard kpi={kpi} accent={(i % 5) + 1} />
            </StaggerItem>
          ))}
        </div>
      </Stagger>

      <FadeIn>
        {directorOnly.length === 0 && !isLoading ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <DataTable
            columns={columns}
            data={directorOnly}
            loading={isLoading}
            searchKey="employeeName"
            searchPlaceholder={t("common.search")}
            facets={[
              {
                columnId: "status",
                title: t("common.status"),
                options: STATUS_OPTIONS,
              },
            ]}
            onBulkDelete={(rows) => bulkDelete("payslips", "payslips", rows)}
            pageSize={10}
          />
        )}
      </FadeIn>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileSpreadsheet className="size-6" />
      </div>
      <h3 className="font-medium">{t("director.payroll.emptyTitle")}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {t("director.payroll.emptyDesc")}
      </p>
      <Button onClick={onCreate} className="mt-6">
        <Plus className="mr-2 size-4" />
        {t("director.payroll.createBtn")}
      </Button>
    </div>
  );
}
