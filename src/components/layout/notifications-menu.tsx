"use client";

import { useEffect } from "react";
import { Bell, Check, CircleAlert, CircleCheck, Info } from "lucide-react";
import { useNotificationStore } from "@/stores/notification-store";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useT, localizeRelTime } from "@/lib/i18n";

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: CircleAlert,
} as const;

const TONE = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
} as const;

export function NotificationsMenu() {
  const t = useT();
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);
  const load = useNotificationStore((s) => s.load);
  const unread = items.filter((i) => !i.read).length;

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Benachrichtigungen">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">{t("common.notifications")}</p>
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Check className="size-3" /> {t("common.markAllRead")}
          </button>
        </div>
        <div className="max-h-80 divide-y divide-border overflow-y-auto scrollbar-thin">
          {items.map((n) => {
            const Icon = ICONS[n.type];
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={cn(
                  "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  !n.read && "bg-primary/[0.03]",
                )}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[n.type])} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {t(`notif.${n.id}.title`) === `notif.${n.id}.title` ? n.title : t(`notif.${n.id}.title`)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(`notif.${n.id}.desc`) === `notif.${n.id}.desc` ? n.description : t(`notif.${n.id}.desc`)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {localizeRelTime(n.timestamp, t)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
