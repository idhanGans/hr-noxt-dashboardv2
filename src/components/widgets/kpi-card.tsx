"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Kpi } from "@/types";

function formatValue(kpi: Kpi) {
  if (kpi.format === "currency") return formatCurrency(kpi.value);
  if (kpi.format === "percent") return `${kpi.value.toLocaleString("de-DE")}%`;
  return formatNumber(kpi.value);
}

export function KpiCard({
  kpi,
  accent = 1,
  meta,
  hideDelta,
}: {
  kpi: Kpi;
  accent?: number;
  /** Optional small line rendered below the big value (e.g. currency context). */
  meta?: React.ReactNode;
  /** Suppress the delta-percentage badge in the top-right. */
  hideDelta?: boolean;
}) {
  const t = useT();
  const positive = kpi.delta >= 0;
  const color = `var(--chart-${accent})`;
  const label = t(`kpi.${kpi.id}`) === `kpi.${kpi.id}` ? kpi.label : t(`kpi.${kpi.id}`);

  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {formatValue(kpi)}
          </p>
          {meta && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {meta}
            </p>
          )}
        </div>
        {!hideDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              positive
                ? "bg-success/12 text-success"
                : "bg-destructive/12 text-destructive",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(kpi.delta)}%
          </span>
        )}
      </div>
      {/* Sparkline nur zeichnen, wenn es eine echte Reihe gibt (>= 2 Punkte).
          Ein einzelner Punkt rendert sonst als einsamer Kreis in der Karte. */}
      {(kpi.trend?.length ?? 0) >= 2 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={kpi.trend} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`spark-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#spark-${kpi.id})`}
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
