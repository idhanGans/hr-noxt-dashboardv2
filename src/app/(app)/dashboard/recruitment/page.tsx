"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { ChartCard } from "@/components/widgets/chart-card";
import { ActivityFeed } from "@/components/widgets/activity-feed";
import { StatusBadge } from "@/components/shared/status-badge";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useActivity, useCandidates, useKpis, useVacancies } from "@/lib/queries";
import { useT } from "@/lib/i18n";
import { candidateFunnel } from "@/lib/trends";
import type { TimeSeriesPoint } from "@/types";

export default function RecruitmentDashboardPage() {
  const t = useT();
  const { data: kpis, isLoading } = useKpis();
  const { data: activity = [] } = useActivity();
  const { data: candData = [] } = useCandidates();
  const { data: vacData = [] } = useVacancies();

  const openVacancies = useMemo(
    () => vacData.filter((v) => v.status === "open"),
    [vacData],
  );

  const avgRating = useMemo(() => {
    if (candData.length === 0) return "0.0";
    const sum = candData.reduce((s, c) => s + c.rating, 0);
    return (sum / candData.length).toFixed(1);
  }, [candData]);

  const hiredCount = useMemo(
    () => candData.filter((c) => c.stage === "hired").length,
    [candData],
  );

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

  const recruitmentKpis = useMemo(() => {
    const openRoles = kpis?.find((k) => k.id === "openroles");
    return [
      {
        id: "open_roles",
        label: t("dashboards.recruitment.kpiOpenRolesLabel"),
        value: openVacancies.length,
        format: "number" as const,
        delta: openRoles?.delta ?? 0,
        trend: openRoles?.trend ?? [],
      },
      {
        id: "total_candidates",
        label: t("dashboards.recruitment.kpiCandidatesLabel"),
        value: candData.length,
        format: "number" as const,
        delta: 0,
        trend: [],
      },
      {
        id: "avg_rating",
        label: t("dashboards.recruitment.kpiAvgRatingLabel"),
        value: parseFloat(avgRating),
        format: "number" as const,
        delta: 0,
        trend: [],
      },
      {
        id: "hired",
        label: t("dashboards.recruitment.kpiHiredLabel"),
        value: hiredCount,
        format: "number" as const,
        delta: 0,
        trend: [],
      },
    ];
  }, [t, kpis, openVacancies, avgRating, hiredCount]);

  const TYPE_LABELS: Record<string, string> = useMemo(
    () => ({
      full_time: t("dashboards.recruitment.typeFullTime"),
      part_time: t("dashboards.recruitment.typePartTime"),
      contractor: t("dashboards.recruitment.typeContractor"),
    }),
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboards.recruitment.title")}
        description={t("dashboards.recruitment.desc")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => toast.info(t("dashboards.recruitment.exportToast"))}
            >
              <Download className="mr-2 size-4" />
              {t("common.export")}
            </Button>
            <Button asChild>
              <Link href="/recruitment/vacancies">
                <Plus className="mr-2 size-4" />
                {t("dashboards.recruitment.postVacancy")}
              </Link>
            </Button>
          </>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {recruitmentKpis.map((kpi, i) =>
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
            title={t("dashboards.recruitment.funnelTitle")}
            description={t("dashboards.recruitment.funnelDesc")}
            type="bar"
            data={funnelData}
            series={["value"]}
            seriesLabels={{ value: t("series.value") }}
          />
        </FadeIn>
        <FadeIn delay={0.1}>
          <ChartCard
            title={t("dashboards.recruitment.stagesPieTitle")}
            description={t("dashboards.recruitment.stagesPieDesc")}
            type="pie"
            data={candidatesByStage}
            series={[]}
            valueKey="value"
          />
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t("dashboards.recruitment.openVacanciesTitle")}</CardTitle>
              <Badge variant="info">{openVacancies.length}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {openVacancies.map((vacancy) => (
                  <div
                    key={vacancy.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {vacancy.title}
                        </p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {TYPE_LABELS[vacancy.type] ?? vacancy.type}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {vacancy.department} · {vacancy.location}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {t("dashboards.recruitment.applicantsCount", { count: String(vacancy.applicants) })}
                      </span>
                      <StatusBadge status={vacancy.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.1}>
          <ActivityFeed
            items={[
              ...activity.filter((a) => a.type === "recruitment"),
              ...activity.filter((a) => a.type !== "recruitment"),
            ].slice(0, 6)}
          />
        </FadeIn>
      </div>
    </div>
  );
}
