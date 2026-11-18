"use client";

import Link from "next/link";
import {
  CalendarPlus,
  FileText,
  User,
  CheckSquare,
  Banknote,
  Umbrella,
  Timer,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CalendarWidget } from "@/components/widgets/calendar-widget";
import { QuickActions } from "@/components/widgets/quick-actions";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useGoals, useAttendance, useMe } from "@/lib/queries";
import { useT } from "@/lib/i18n";
import { initials } from "@/lib/utils";

const GOAL_STATUS_COLORS: Record<string, string> = {
  on_track: "bg-success",
  at_risk: "bg-warning",
  behind: "bg-destructive",
  completed: "bg-info",
};

export default function EmployeeDashboardPage() {
  const t = useT();
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const { data: att, isLoading: attLoading } = useAttendance();
  const { data: me } = useMe();

  const myGoals = (goals ?? []).slice(0, 4);
  const teamToday = (att ?? []).slice(0, 10);

  // Live-Kennzahlen (0/neutral wenn keine Daten).
  const fullName = me ? `${me.employee.firstName} ${me.employee.lastName}` : "";
  const vac = me?.employee?.vacationBalance;
  const vacationDays = vac ? Math.max(0, vac.total - vac.used) : 0;
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const hoursWeek = (att ?? [])
    .filter((r) => r.employeeName === fullName && new Date(r.date) >= weekStart)
    .reduce((s, r) => s + r.workedHours, 0);
  const openTasks = (goals ?? []).filter((g) => g.status !== "completed").length;
  const nextPayoutStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short" },
  );

  const QUICK = [
    // TEMP: Attendance ausgeblendet — { label: t("dashboards.employee.quickLeave"), href: "/attendance/leave", icon: CalendarPlus },
    { label: t("dashboards.employee.quickPayslips"), href: "/payroll/payslips", icon: FileText },
    { label: t("dashboards.employee.quickESS"), href: "/people/ess", icon: User },
  ];

  const PERSONAL_KPIS = [
    {
      id: "vacation",
      label: t("dashboards.employee.kpiVacationLabel"),
      value: `${vacationDays} ${t("ess.leave.days")}`,
      icon: Umbrella,
      accent: "text-info",
      bg: "bg-info/10",
    },
    {
      id: "hours",
      label: t("dashboards.employee.kpiHoursLabel"),
      value: `${hoursWeek.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`,
      icon: Timer,
      accent: "text-success",
      bg: "bg-success/10",
    },
    {
      id: "tasks",
      label: t("dashboards.employee.kpiTasksLabel"),
      value: String(openTasks),
      icon: CheckSquare,
      accent: "text-warning",
      bg: "bg-warning/10",
    },
    {
      id: "salary",
      label: t("dashboards.employee.kpiSalaryLabel"),
      value: nextPayoutStr,
      icon: Banknote,
      accent: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboards.employee.title")}
        description={t("dashboards.employee.desc")}
        actions={
          <>
            {/* TEMP: Attendance-Links ausgeblendet — Buttons bleiben im Code.
            <Button asChild>
              <Link href="/attendance/leave">
                <CalendarPlus className="mr-2 size-4" />
                {t("dashboards.employee.requestLeave")}
              </Link>
            </Button>
            */}
          </>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PERSONAL_KPIS.map((kpi) => (
          <StaggerItem key={kpi.id}>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-10 items-center justify-center rounded-lg ${kpi.bg} ${kpi.accent}`}
                >
                  <kpi.icon className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="font-display text-xl font-semibold">{kpi.value}</p>
                </div>
              </div>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dashboards.employee.goalsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {myGoals.length === 0 && goalsLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg border border-border bg-muted/40"
                  />
                ))}
              {myGoals.length === 0 && !goalsLoading && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("common.noResults")}
                </p>
              )}
              {myGoals.map((goal) => (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="truncate pr-2 text-sm font-medium">
                      {goal.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {goal.progress}%
                      </span>
                      <StatusBadge status={goal.status} />
                    </div>
                  </div>
                  <Progress
                    value={goal.progress}
                    indicatorClassName={GOAL_STATUS_COLORS[goal.status]}
                  />
                </div>
              ))}
              {myGoals.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link href="/performance/goals">
                    {t("dashboards.employee.showAllGoals")}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.1}>
          <CalendarWidget />
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dashboards.employee.teamTodayTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teamToday.length === 0 && attLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg bg-muted/40"
                    />
                  ))}
                {teamToday.length === 0 && !attLoading && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t("common.noResults")}
                  </p>
                )}
                {teamToday.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">
                          {initials(rec.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{rec.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {rec.department}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rec.workedHours > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {rec.workedHours} h
                        </Badge>
                      )}
                      <StatusBadge status={rec.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.1}>
          <QuickActions actions={QUICK} title={t("dashboards.employee.quickActionsTitle")} />
        </FadeIn>
      </div>
    </div>
  );
}
