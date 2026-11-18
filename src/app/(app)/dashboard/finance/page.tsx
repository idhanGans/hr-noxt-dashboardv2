"use client";

import { useMemo } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/widgets/kpi-card";
import { ChartCard } from "@/components/widgets/chart-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency } from "@/lib/utils";
import { useEmployees, useKpis, usePayslips, useReimbursements } from "@/lib/queries";
import { useT } from "@/lib/i18n";
import { payrollByPeriod } from "@/lib/trends";
import type { Reimbursement, TimeSeriesPoint } from "@/types";

export default function FinanceDashboardPage() {
  const t = useT();
  const { data: kpis, isLoading } = useKpis();
  const { data: reimbData, isLoading: reimbLoading } = useReimbursements();
  const queryClient = useQueryClient();

  // Echtes Neuladen der Live-Daten dieses Dashboards.
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["kpis"] });
    void queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    void queryClient.invalidateQueries({ queryKey: ["employees"] });
    toast.success(t("dashboards.finance.refreshToast"));
  }
  const { data: emp = [] } = useEmployees();
  const { data: payslips = [] } = usePayslips();
  const payrollTrend = useMemo(() => payrollByPeriod(payslips), [payslips]);

  const payrollKpi = kpis?.find((k) => k.id === "payroll");

  const avgSalary = useMemo(() => {
    if (emp.length === 0) return 0;
    const total = emp.reduce((s, e) => s + e.salary, 0);
    return Math.round(total / emp.length / 12);
  }, [emp]);

  const taxShare = useMemo(() => {
    const totalGross = emp.reduce((s, e) => s + e.salary / 12, 0);
    if (totalGross === 0) return 0;
    const taxEst = totalGross * 0.32;
    return Math.round((taxEst / totalGross) * 100);
  }, [emp]);

  const costByDept: TimeSeriesPoint[] = useMemo(() => {
    const map: Record<string, number> = {};
    emp.forEach((e) => {
      map[e.department] = (map[e.department] ?? 0) + e.salary / 12;
    });
    return Object.entries(map).map(([label, value]) => ({
      label,
      value: Math.round(value),
    }));
  }, [emp]);

  const reimbByStatus: TimeSeriesPoint[] = useMemo(() => {
    const map: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    (reimbData ?? []).forEach((r) => {
      if (r.status in map) map[r.status]++;
    });
    return [
      { label: t("status.pending"), value: map.pending },
      { label: t("status.approved"), value: map.approved },
      { label: t("status.rejected"), value: map.rejected },
    ];
  }, [reimbData, t]);

  const financeKpis = useMemo(() => {
    return [
      {
        id: "payroll_month",
        label: t("dashboards.finance.kpiPayrollLabel"),
        value: payrollKpi?.value ?? 0,
        format: "currency" as const,
        delta: payrollKpi?.delta ?? 0,
        trend: payrollKpi?.trend ?? [],
      },
      {
        id: "avg_salary",
        label: t("dashboards.finance.kpiAvgSalaryLabel"),
        value: avgSalary,
        format: "currency" as const,
        delta: 0,
        trend: [],
      },
      {
        id: "tax_share",
        label: t("dashboards.finance.kpiTaxShareLabel"),
        value: taxShare,
        format: "percent" as const,
        delta: 0,
        trend: [],
      },
    ];
  }, [t, payrollKpi, avgSalary, taxShare]);

  const CAT_LABELS: Record<string, string> = useMemo(
    () => ({
      travel: t("dashboards.finance.catTravel"),
      meals: t("dashboards.finance.catMeals"),
      equipment: t("dashboards.finance.catEquipment"),
      training: t("dashboards.finance.catTraining"),
      other: t("dashboards.finance.catOther"),
    }),
    [t],
  );

  const REIMBURSEMENT_COLUMNS: ColumnDef<Reimbursement>[] = useMemo(
    () => [
      selectColumn<Reimbursement>(),
      {
        accessorKey: "employeeName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("dashboards.finance.colEmployee")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.employeeName}</span>
        ),
      },
      {
        accessorKey: "category",
        header: t("dashboards.finance.colCategory"),
        cell: ({ row }) => (
          <span className="text-sm">
            {CAT_LABELS[row.original.category] ?? row.original.category}
          </span>
        ),
        filterFn: (row, id, value) => row.getValue(id) === value,
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("common.amount")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        filterFn: (row, id, value) => row.getValue(id) === value,
      },
    ],
    [t, CAT_LABELS],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboards.finance.title")}
        description={t("dashboards.finance.desc")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => toast.info(t("dashboards.finance.exportToast"))}
            >
              <Download className="mr-2 size-4" />
              {t("common.export")}
            </Button>
            <Button onClick={refresh}>
              <RefreshCw className="mr-2 size-4" />
              {t("dashboards.finance.refresh")}
            </Button>
          </>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {financeKpis.map((kpi, i) =>
          !isLoading ? (
            <StaggerItem key={kpi.id}>
              <KpiCard kpi={kpi} accent={(i % 5) + 1} />
            </StaggerItem>
          ) : (
            <StaggerItem key={i}>
              <div className="h-[132px] animate-pulse rounded-xl border border-border bg-muted/40" />
            </StaggerItem>
          ),
        )}
      </Stagger>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FadeIn>
          <ChartCard
            title={t("dashboards.finance.payrollTrendTitle")}
            description={t("dashboards.finance.payrollTrendDesc")}
            type="line"
            data={payrollTrend}
            series={["Brutto", "Netto"]}
            seriesLabels={{
              Brutto: t("series.Brutto"),
              Netto: t("series.Netto"),
            }}
          />
        </FadeIn>
        <FadeIn delay={0.1}>
          <ChartCard
            title={t("dashboards.finance.costByDeptTitle")}
            description={t("dashboards.finance.costByDeptDesc")}
            type="bar"
            data={costByDept}
            series={["value"]}
            seriesLabels={{ value: t("series.value") }}
            height={280}
          />
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn>
          <ChartCard
            title={t("dashboards.finance.reimbStatusTitle")}
            description={t("dashboards.finance.reimbStatusDesc")}
            type="pie"
            data={reimbByStatus}
            series={[]}
            valueKey="value"
            height={260}
          />
        </FadeIn>
        <FadeIn delay={0.05} className="lg:col-span-2">
          <DataTable
            columns={REIMBURSEMENT_COLUMNS}
            data={reimbData ?? []}
            loading={reimbLoading}
            searchKey="employeeName"
            searchPlaceholder={t("dashboards.finance.searchPlaceholder")}
            facets={[
              {
                columnId: "status",
                title: t("dashboards.finance.facetStatus"),
                options: [
                  { label: t("dashboards.finance.reimbStatusOpen"), value: "pending" },
                  { label: t("dashboards.finance.reimbStatusApproved"), value: "approved" },
                  { label: t("dashboards.finance.reimbStatusRejected"), value: "rejected" },
                ],
              },
            ]}
            pageSize={6}
          />
        </FadeIn>
      </div>
    </div>
  );
}
