"use client";

import {
  CalendarPlus,
  UserPlus,
  FileText,
  Receipt,
  Boxes,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/widgets/kpi-card";
import { ChartCard } from "@/components/widgets/chart-card";
import { ActivityFeed } from "@/components/widgets/activity-feed";
import { ApprovalCard } from "@/components/widgets/approval-card";
import { CalendarWidget } from "@/components/widgets/calendar-widget";
import { QuickActions } from "@/components/widgets/quick-actions";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useMemo } from "react";
import {
  useActivity,
  useAttendance,
  useEmployees,
  useKpis,
  useLeaveRequests,
  useReimbursements,
} from "@/lib/queries";
import { useT } from "@/lib/i18n";
import {
  attendanceByPeriod,
  headcountByDept,
  pendingApprovals,
} from "@/lib/trends";

export default function HrDashboardPage() {
  const t = useT();
  const { data: kpis, isLoading } = useKpis();
  const { data: activity = [] } = useActivity();
  const { data: attendance = [] } = useAttendance();
  const { data: emp = [] } = useEmployees();
  const { data: leave = [] } = useLeaveRequests();
  const { data: reimb = [] } = useReimbursements();

  const attendanceTrend = useMemo(() => attendanceByPeriod(attendance), [attendance]);
  const headcountData = useMemo(() => headcountByDept(emp), [emp]);
  const approvals = useMemo(() => pendingApprovals(leave, reimb, t), [leave, reimb, t]);

  const QUICK = [
    { label: t("dashboards.hr.quickAddEmployee"), href: "/people/employees", icon: UserPlus },
    // TEMP: Attendance ausgeblendet — { label: t("dashboards.hr.quickLeave"), href: "/attendance/leave", icon: CalendarPlus },
    { label: t("dashboards.hr.quickPayroll"), href: "/payroll/payslips", icon: Receipt },
    { label: t("dashboards.hr.quickVacancy"), href: "/recruitment/vacancies", icon: FileText },
    { label: t("dashboards.hr.quickAsset"), href: "/people/assets", icon: Boxes },
    { label: t("dashboards.hr.quickGoal"), href: "/performance/goals", icon: Target },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboards.hr.title")}
        description={t("dashboards.hr.desc")}
        actions={
          <>
            <Button variant="outline">{t("dashboards.hr.exportReport")}</Button>
            <Button>
              <UserPlus /> {t("dashboards.hr.addEmployee")}
            </Button>
          </>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(kpis ?? Array.from({ length: 4 })).slice(0, 4).map((kpi, i) =>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2">
          <ChartCard
            title={t("dashboards.hr.attendanceTrendTitle")}
            description={t("dashboards.hr.attendanceTrendDesc")}
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
        </FadeIn>
        <FadeIn delay={0.1}>
          <ApprovalCard items={approvals} />
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn>
          <ChartCard
            title={t("dashboards.hr.headcountByDeptTitle")}
            type="bar"
            data={headcountData}
            series={["count"]}
            seriesLabels={{ count: t("series.count") }}
            height={260}
          />
        </FadeIn>
        <FadeIn delay={0.05}>
          <ActivityFeed items={activity.slice(0, 6)} />
        </FadeIn>
        <FadeIn delay={0.1}>
          <CalendarWidget />
        </FadeIn>
      </div>

      <FadeIn>
        <QuickActions actions={QUICK} />
      </FadeIn>
    </div>
  );
}
