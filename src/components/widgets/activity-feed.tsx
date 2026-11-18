"use client";

import {
  CalendarDays,
  Receipt,
  Briefcase,
  Target,
  Fingerprint,
  Settings,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT, localizeRelTime } from "@/lib/i18n";
import type { ActivityItem } from "@/types";

const ICONS = {
  leave: CalendarDays,
  payroll: Receipt,
  recruitment: Briefcase,
  performance: Target,
  attendance: Fingerprint,
  system: Settings,
} as const;

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const t = useT();
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("activity.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
          {items.map((item) => {
            const Icon = ICONS[item.type];
            return (
              <div key={item.id} className="relative flex gap-3">
                <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{item.actor}</span>{" "}
                    <span className="text-muted-foreground">
                      {t(`activity.action.${item.action}`)}
                    </span>{" "}
                    <span className="font-medium">
                      {t(`activity.target.${item.target}`)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {localizeRelTime(item.timestamp, t)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
