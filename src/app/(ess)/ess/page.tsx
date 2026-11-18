"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Receipt,
  UserCog,
  Bell,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useNotificationStore } from "@/stores/notification-store";
import { useMe, useLeaveRequests } from "@/lib/queries";
import { useT } from "@/lib/i18n";

const TODAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

const NOTIFICATION_ICONS: Record<string, string> = {
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

export default function EssHomePage() {
  const t = useT();
  const { data: me } = useMe();
  const { data: leaveReqs = [] } = useLeaveRequests();
  const notifications = useNotificationStore((s) => s.items);
  const loadNotifications = useNotificationStore((s) => s.load);
  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Live-Werte (0/neutral wenn keine Daten) — kein Mock mehr.
  const firstName = me?.employee?.firstName ?? "";
  const vacation = me?.employee?.vacationBalance;
  const leaveRemaining = vacation ? Math.max(0, vacation.total - vacation.used) : 0;
  const openRequests = leaveReqs.filter((r) => r.status === "pending").length;

  const QUICK_ACTIONS = [
    // TEMP: Attendance ausgeblendet — { label: t("ess.home.quickActionLeave"), href: "/ess/leave", icon: CalendarDays, color: "bg-info/10 text-info" },
    { label: t("ess.home.quickActionPayslip"), href: "/ess/payslip", icon: Receipt, color: "bg-success/10 text-success" },
    { label: t("ess.home.quickActionProfile"), href: "/ess/profile", icon: UserCog, color: "bg-warning/10 text-warning" },
  ];

  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <p className="text-xs text-muted-foreground">{TODAY}</p>
          <h1 className="mt-0.5 font-display text-xl font-semibold">
            {t("common.greetingMorning")}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="font-display text-2xl font-bold text-primary">{leaveRemaining}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                {t("ess.home.statLeaveRemaining")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="font-display text-2xl font-bold text-foreground">0:00</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                {t("ess.home.statHoursToday")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="font-display text-2xl font-bold text-warning">{openRequests}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                {t("ess.home.statOpenRequests")}
              </p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("ess.home.quickAccess")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href}>
                <Card className="transition-colors hover:bg-accent/50 active:bg-accent">
                  <CardContent className="flex flex-col items-center gap-2 p-4">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${action.color}`}>
                      <action.icon className="size-5" />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("ess.home.notificationsSection")}
            </h2>
            <Bell className="size-4 text-muted-foreground" />
          </div>
          <Stagger className="space-y-2">
            {notifications.slice(0, 3).map((n) => (
              <StaggerItem key={n.id}>
                <Card className={n.read ? "opacity-60" : ""}>
                  <CardContent className="flex items-start gap-3 p-3">
                    <div
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${NOTIFICATION_ICONS[n.type] ?? "bg-muted text-muted-foreground"}`}
                    >
                      <Bell className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{n.title}</p>
                        {!n.read && (
                          <Badge variant="default" className="shrink-0 text-[10px] px-1.5 py-0">
                            {t("ess.home.badgeNew")}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {n.description}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {n.timestamp}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </FadeIn>
    </div>
  );
}
