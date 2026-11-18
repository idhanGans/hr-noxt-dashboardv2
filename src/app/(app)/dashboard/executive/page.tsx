"use client";

import { BarChart3, Download, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/widgets/kpi-card";
import { ChartCard } from "@/components/widgets/chart-card";
import { ActivityFeed } from "@/components/widgets/activity-feed";
import { ApprovalCard } from "@/components/widgets/approval-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import {
  useActivity,
  useCandidates,
  useEmployees,
  useKpis,
  useLeaveRequests,
  usePayslips,
  useReimbursements,
} from "@/lib/queries";
import { useT } from "@/lib/i18n";
import {
  candidateFunnel,
  headcountByDept,
  payrollByPeriod,
  pendingApprovals,
} from "@/lib/trends";

const KPI_IDS = ["headcount", "payroll", "turnover", "engagement"];

export default function ExecutiveDashboardPage() {
  const t = useT();
  const { data: kpis, isLoading } = useKpis();
  const { data: activity = [] } = useActivity();
  const { data: emp = [] } = useEmployees();
  const { data: payslips = [] } = usePayslips();
  const { data: candData = [] } = useCandidates();
  const { data: leave = [] } = useLeaveRequests();
  const { data: reimb = [] } = useReimbursements();
  const execKpis = kpis?.filter((k) => KPI_IDS.includes(k.id)) ?? [];

  const payrollTrend = payrollByPeriod(payslips);
  const approvals = pendingApprovals(leave, reimb, t);

  const headcountPieData = headcountByDept(emp).map((d) => ({
    label: d.label as string,
    value: d.count as number,
  }));

  const funnelData = candidateFunnel(candData).map((d) => ({
    label: t("status." + d.stage),
    value: d.value,
  }));

  // Aus echten KPIs ableiten (0 wenn keine Daten); Wachstum/Abweichung gibt es
  // ohne Verlaufsdaten nicht -> 0 %.
  const kVal = (id: string) => kpis?.find((k) => k.id === id)?.value ?? 0;
  const summaryRows = [
    { labelKey: "dashboards.executive.summaryGrowth", value: "0 %", positive: true },
    { labelKey: "dashboards.executive.summaryTurnover", value: `${kVal("turnover")} %`, positive: true },
    {
      labelKey: "dashboards.executive.summaryEngagement",
      value: `${kVal("engagement")} / 100`,
      positive: true,
    },
    {
      labelKey: "dashboards.executive.summaryOpenRoles",
      value: String(kVal("openroles")),
      positive: false,
    },
    { labelKey: "dashboards.executive.summaryPayrollDeviation", value: "0 %", positive: false },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboards.executive.title")}
        description={t("dashboards.executive.desc")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => toast.info(t("dashboards.executive.boardReportToast"))}
            >
              <Download className="mr-2 size-4" />
              {t("dashboards.executive.boardReport")}
            </Button>
            <Button onClick={() => toast.success(t("dashboards.executive.startAnalysisToast"))}>
              <TrendingUp className="mr-2 size-4" />
              {t("dashboards.executive.startAnalysis")}
            </Button>
          </>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <StaggerItem key={i}>
                <div className="h-[132px] animate-pulse rounded-xl border border-border bg-muted/40" />
              </StaggerItem>
            ))
          : execKpis.map((kpi, i) => (
              <StaggerItem key={kpi.id}>
                <KpiCard kpi={kpi} accent={(i % 5) + 1} />
              </StaggerItem>
            ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2">
          <ChartCard
            title={t("dashboards.executive.payrollTrendTitle")}
            description={t("dashboards.executive.payrollTrendDesc")}
            type="area"
            data={payrollTrend}
            series={["Brutto", "Netto"]}
            seriesLabels={{
              Brutto: t("series.Brutto"),
              Netto: t("series.Netto"),
            }}
            stacked={false}
          />
        </FadeIn>
        <FadeIn delay={0.1}>
          <ChartCard
            title={t("dashboards.executive.headcountByDeptTitle")}
            description={t("dashboards.executive.headcountByDeptDesc")}
            type="bar"
            data={headcountByDept(emp)}
            series={["count"]}
            seriesLabels={{ count: t("series.count") }}
            height={280}
          />
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn>
          <ChartCard
            title={t("dashboards.executive.funnelTitle")}
            description={t("dashboards.executive.funnelDesc")}
            type="bar"
            data={funnelData}
            series={["value"]}
            seriesLabels={{ value: t("series.value") }}
            height={260}
          />
        </FadeIn>
        <FadeIn delay={0.05}>
          <ChartCard
            title={t("dashboards.executive.workforcePieTitle")}
            description={t("dashboards.executive.workforcePieDesc")}
            type="pie"
            data={headcountPieData}
            series={[]}
            valueKey="value"
            height={260}
          />
        </FadeIn>
        <FadeIn delay={0.1}>
          <ApprovalCard items={approvals} />
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FadeIn>
          <ActivityFeed items={activity.slice(0, 8)} />
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BarChart3 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t("dashboards.executive.summaryTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboards.executive.summaryPeriod")}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {summaryRows.map((row) => (
                  <div
                    key={row.labelKey}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                  >
                    <span className="text-sm text-muted-foreground">{t(row.labelKey)}</span>
                    <span
                      className={
                        row.positive
                          ? "text-sm font-semibold text-success"
                          : "text-sm font-semibold text-warning"
                      }
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
