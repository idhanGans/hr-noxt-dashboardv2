"use client";

import { useMemo, useState } from "react";
import { Download, SlidersHorizontal, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/widgets/kpi-card";
import { ChartCard } from "@/components/widgets/chart-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import {
  useAttendance,
  useCandidates,
  useEmployees,
  useKpis,
  usePayslips,
} from "@/lib/queries";
import { useT } from "@/lib/i18n";
import { attendanceByPeriod, payrollByPeriod, candidateFunnel } from "@/lib/trends";
import type { TimeSeriesPoint } from "@/types";

export default function AnalyticsDashboardPage() {
  const t = useT();
  const { data: kpis, isLoading } = useKpis();
  const { data: emp = [] } = useEmployees();
  const { data: candData = [] } = useCandidates();
  const { data: attendance = [] } = useAttendance();
  const { data: payslips = [] } = usePayslips();

  // Echte Zeitreihen aus den Live-Daten (frueher leere Mock-Arrays).
  const attendanceTrend = useMemo(() => attendanceByPeriod(attendance), [attendance]);
  const payrollTrend = useMemo(() => payrollByPeriod(payslips), [payslips]);

  // Abteilungs-Filter: leere Auswahl = alle. Wirkt auf die abteilungs-
  // basierten Diagramme (Kopfzahl & Kosten je Abteilung).
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const allDepts = useMemo(
    () => Array.from(new Set(emp.map((e) => e.department))).sort(),
    [emp],
  );
  const empScoped = useMemo(
    () => (deptFilter.length ? emp.filter((e) => deptFilter.includes(e.department)) : emp),
    [emp, deptFilter],
  );
  function toggleDept(d: string) {
    setDeptFilter((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  const headcountPieData: TimeSeriesPoint[] = useMemo(() => {
    const map: Record<string, number> = {};
    empScoped.forEach((e) => {
      map[e.department] = (map[e.department] ?? 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [empScoped]);

  const attendanceBarData: TimeSeriesPoint[] = useMemo(
    () =>
      attendanceTrend.map((d) => ({
        label: d.label,
        Anwesend: d.Anwesend,
        Remote: d.Remote,
      })),
    [attendanceTrend],
  );

  const costByDept: TimeSeriesPoint[] = useMemo(() => {
    const map: Record<string, number> = {};
    empScoped.forEach((e) => {
      map[e.department] = (map[e.department] ?? 0) + e.salary / 12;
    });
    return Object.entries(map).map(([label, value]) => ({
      label,
      value: Math.round(value),
    }));
  }, [empScoped]);

  const candidatesByStage: TimeSeriesPoint[] = useMemo(() => {
    const map: Record<string, number> = {};
    candData.forEach((c) => {
      map[c.stage] = (map[c.stage] ?? 0) + 1;
    });
    return Object.entries(map).map(([stage, count]) => ({
      label: t("status." + stage),
      value: count,
    }));
  }, [candData, t]);

  const funnelData = useMemo(
    () =>
      candidateFunnel(candData).map((d) => ({
        label: t("status." + d.stage),
        value: d.value,
      })),
    [candData, t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboards.analytics.title")}
        description={t("dashboards.analytics.desc")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => toast.info(t("dashboards.analytics.exportToast"))}
            >
              <Download className="mr-2 size-4" />
              {t("common.export")}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={deptFilter.length ? "default" : "outline"}>
                  <SlidersHorizontal className="mr-2 size-4" />
                  {t("dashboards.analytics.filter")}
                  {deptFilter.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-background/20 px-1.5 text-xs">
                      {deptFilter.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dashboards.analytics.filterByDept")}
                </p>
                <div className="max-h-64 overflow-y-auto">
                  {allDepts.length === 0 && (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      {t("dashboards.analytics.filterEmpty")}
                    </p>
                  )}
                  {allDepts.map((d) => {
                    const on = deptFilter.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDept(d)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span className="truncate">{d}</span>
                        {on && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
                {deptFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 w-full"
                    onClick={() => setDeptFilter([])}
                  >
                    {t("dashboards.analytics.filterClear")}
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(kpis ?? Array.from({ length: 6 })).slice(0, 6).map((kpi, i) =>
          kpi && !isLoading ? (
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

      <FadeIn>
        <Tabs defaultValue="people">
          <TabsList className="mb-6">
            <TabsTrigger value="people">{t("dashboards.analytics.tabPeople")}</TabsTrigger>
            <TabsTrigger value="attendance">{t("dashboards.analytics.tabAttendance")}</TabsTrigger>
            <TabsTrigger value="payroll">{t("dashboards.analytics.tabPayroll")}</TabsTrigger>
            <TabsTrigger value="recruitment">{t("dashboards.analytics.tabRecruitment")}</TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title={t("dashboards.analytics.headcountByDeptTitle")}
                description={t("dashboards.analytics.headcountByDeptDesc")}
                type="bar"
                data={headcountPieData}
                series={["count"]}
                seriesLabels={{ count: t("series.count") }}
              />
              <ChartCard
                title={t("dashboards.analytics.workforcePieTitle")}
                description={t("dashboards.analytics.workforcePieDesc")}
                type="pie"
                data={headcountPieData}
                series={[]}
                valueKey="value"
              />
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title={t("dashboards.analytics.attendanceTrendTitle")}
                description={t("dashboards.analytics.attendanceTrendDesc")}
                type="area"
                data={attendanceTrend}
                series={["Anwesend", "Remote", "Abwesend"]}
                seriesLabels={{
                  Anwesend: t("series.Anwesend"),
                  Remote: t("series.Remote"),
                  Abwesend: t("series.Abwesend"),
                }}
                stacked
              />
              <ChartCard
                title={t("dashboards.analytics.attendanceBarTitle")}
                description={t("dashboards.analytics.attendanceBarDesc")}
                type="bar"
                data={attendanceBarData}
                series={["Anwesend", "Remote"]}
                seriesLabels={{
                  Anwesend: t("series.Anwesend"),
                  Remote: t("series.Remote"),
                }}
                stacked
              />
            </div>
          </TabsContent>

          <TabsContent value="payroll" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title={t("dashboards.analytics.payrollTrendTitle")}
                description={t("dashboards.analytics.payrollTrendDesc")}
                type="line"
                data={payrollTrend}
                series={["Brutto", "Netto"]}
                seriesLabels={{
                  Brutto: t("series.Brutto"),
                  Netto: t("series.Netto"),
                }}
              />
              <ChartCard
                title={t("dashboards.analytics.costByDeptTitle")}
                description={t("dashboards.analytics.costByDeptDesc")}
                type="area"
                data={costByDept}
                series={["value"]}
                seriesLabels={{ value: t("series.value") }}
                stacked={false}
              />
            </div>
          </TabsContent>

          <TabsContent value="recruitment" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title={t("dashboards.analytics.funnelTitle")}
                description={t("dashboards.analytics.funnelDesc")}
                type="bar"
                data={funnelData}
                series={["value"]}
                seriesLabels={{ value: t("series.value") }}
              />
              <ChartCard
                title={t("dashboards.analytics.stagesPieTitle")}
                description={t("dashboards.analytics.stagesPieDesc")}
                type="pie"
                data={candidatesByStage}
                series={[]}
                valueKey="value"
              />
            </div>
          </TabsContent>
        </Tabs>
      </FadeIn>
    </div>
  );
}
