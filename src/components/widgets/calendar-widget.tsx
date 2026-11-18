"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const WEEKDAY_KEYS = [
  "calendar.wd.mo",
  "calendar.wd.di",
  "calendar.wd.mi",
  "calendar.wd.do",
  "calendar.wd.fr",
  "calendar.wd.sa",
  "calendar.wd.so",
];

interface CalendarWidgetProps {
  title?: string;
  events?: Record<number, "leave" | "holiday" | "review">;
  month?: string;
}

const TONE = {
  leave: "bg-warning/20 text-warning-foreground dark:text-warning",
  holiday: "bg-info/20 text-info",
  review: "bg-primary/15 text-primary",
} as const;

export function CalendarWidget({
  title,
  events = {},
}: CalendarWidgetProps) {
  const t = useT();
  // Echter aktueller Monat (keine erfundenen Termine mehr).
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Mo-basierter Offset des Monatsersten (getDay: 0=So..6=Sa).
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const monthLabel = now.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title ?? monthLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_KEYS.map((k) => (
            <div key={k} className="py-1 text-[11px] font-medium text-muted-foreground">
              {t(k)}
            </div>
          ))}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const event = events[day];
            const isToday = day === today;
            return (
              <div
                key={day}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-xs transition-colors hover:bg-muted",
                  event && TONE[event],
                  isToday &&
                    "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
              >
                {day}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" /> {t("calendar.legend.leave")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-info" /> {t("calendar.legend.holiday")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> {t("calendar.legend.review")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
