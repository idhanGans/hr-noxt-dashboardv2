"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  description?: string;
  href?: string;
  onClick?: () => void;
}

export function QuickActions({
  actions,
  title,
  cols = 3,
  className,
}: {
  actions: QuickAction[];
  title?: string;
  /** Number of columns at the lg breakpoint (defaults to 3). */
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const t = useT();
  const colsClass =
    cols === 4 ? "lg:grid-cols-4" : cols === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title ?? t("quick.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", colsClass)}>
          {actions.map((a, idx) => (
            <QuickTile key={a.href ?? `tile-${idx}-${a.label}`} action={a} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickTile({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  const inner = (
    <>
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <span className="block text-sm font-medium leading-tight">
          {action.label}
        </span>
        {action.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {action.description}
          </p>
        )}
      </div>
    </>
  );

  const tileClass =
    "group flex w-full flex-col items-start gap-2 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer";

  if (action.onClick) {
    return (
      <button type="button" onClick={action.onClick} className={tileClass}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={action.href ?? "#"} className={tileClass}>
      {inner}
    </Link>
  );
}
