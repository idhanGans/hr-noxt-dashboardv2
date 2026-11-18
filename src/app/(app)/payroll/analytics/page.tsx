"use client";

import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartCard } from "@/components/widgets/chart-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useMemo } from "react";
import { payrollByPeriod } from "@/lib/trends";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useEmployees, usePayslips, useReimbursements } from "@/lib/queries";
import type { TimeSeriesPoint } from "@/types";

export default function PayrollAnalyticsPage() {
  const t = useT();
  const { data: emp = [] } = useEmployees();
  const { data: pay = [] } = usePayslips();
  const { data: reimb = [] } = useReimbursements();

  // Lohnkosten-Verlauf aus echten Lohnabrechnungen.
  const payrollTrend = useMemo(() => payrollByPeriod(pay), [pay]);

  // Aggregiere Lohnkosten je Abteilung (Jahresgehalt / 12)
  const costByDept: TimeSeriesPoint[] = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of emp) {
      map[e.department] = (map[e.department] ?? 0) + e.salary / 12;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([label, value]) => ({ label, value: Math.round(value) }));
  }, [emp]);

  // KPI-Werte aus payslips
  const totalGross = useMemo(() => pay.reduce((s, p) => s + p.gross, 0), [pay]);
  const avgGross = useMemo(
    () => (pay.length ? Math.round(totalGross / pay.length) : 0),
    [pay, totalGross],
  );
  const totalTax = useMemo(() => pay.reduce((s, p) => s + p.tax, 0), [pay]);

  // Erstattungen je Kategorie (labels übersetzt)
  const CATEGORY_LABELS: Record<string, string> = {
    travel: t("payroll.reimbursements.catTravel"),
    meals: t("payroll.reimbursements.catMeals"),
    equipment: t("payroll.reimbursements.catEquipment"),
    training: t("payroll.reimbursements.catTraining"),
    other: t("payroll.reimbursements.catOther"),
  };

  const reimbByCategory: TimeSeriesPoint[] = (() => {
    const map: Record<string, number> = {};
    for (const r of reimb) {
      map[r.category] = (map[r.category] ?? 0) + r.amount;
    }
    return Object.entries(map).map(([k, v]) => ({
      label: CATEGORY_LABELS[k] ?? k,
      value: Math.round(v),
    }));
  })();

  const kpis = [
    {
      label: t("payroll.analytics.kpiMonthlyCost"),
      value: formatCurrency(totalGross),
    },
    {
      label: t("payroll.analytics.kpiAvgGross"),
      value: formatCurrency(avgGross),
    },
    {
      label: t("payroll.analytics.kpiTaxTotal"),
      value: formatCurrency(totalTax),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("payroll.analytics.title")}
        description={t("payroll.analytics.desc")}
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <StaggerItem key={k.label}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {k.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-semibold tracking-tight">
                  {k.value}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FadeIn>
          <ChartCard
            title={t("payroll.analytics.chartSalaryTrendTitle")}
            description={t("payroll.analytics.chartSalaryTrendDesc")}
            type="line"
            data={payrollTrend}
            series={["Brutto", "Netto"]}
            seriesLabels={{
              Brutto: t("series.Brutto"),
              Netto: t("series.Netto"),
            }}
          />
        </FadeIn>
        <FadeIn delay={0.05}>
          <ChartCard
            title={t("payroll.analytics.chartGrossNetTitle")}
            description={t("payroll.analytics.chartGrossNetDesc")}
            type="area"
            data={payrollTrend}
            series={["Brutto", "Netto"]}
            seriesLabels={{
              Brutto: t("series.Brutto"),
              Netto: t("series.Netto"),
            }}
            stacked
          />
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FadeIn>
          <ChartCard
            title={t("payroll.analytics.chartCostByDeptTitle")}
            description={t("payroll.analytics.chartCostByDeptDesc")}
            type="bar"
            data={costByDept}
            series={["value"]}
            height={320}
          />
        </FadeIn>
        <FadeIn delay={0.05}>
          <ChartCard
            title={t("payroll.analytics.chartReimbByCatTitle")}
            description={t("payroll.analytics.chartReimbByCatDesc")}
            type="pie"
            data={reimbByCategory}
            series={["value"]}
            height={320}
          />
        </FadeIn>
      </div>
    </div>
  );
}
