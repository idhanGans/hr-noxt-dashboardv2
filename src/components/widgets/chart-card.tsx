"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TimeSeriesPoint } from "@/types";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ChartType = "area" | "bar" | "line" | "pie";

interface ChartCardProps {
  title: string;
  description?: string;
  type: ChartType;
  data: TimeSeriesPoint[];
  series: string[];
  height?: number;
  action?: React.ReactNode;
  stacked?: boolean;
  valueKey?: string;
  seriesLabels?: Record<string, string>;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">
            {Number(p.value).toLocaleString("de-DE")}
          </span>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function ChartCard({
  title,
  description,
  type,
  data,
  series,
  height = 280,
  action,
  stacked,
  valueKey = "value",
  seriesLabels,
}: ChartCardProps) {
  const label = (s: string) => seriesLabels?.[s] ?? s;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {type === "area" ? (
            <AreaChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s} id={`g-${s}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[i % 5]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS[i % 5]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={48} />
              <Tooltip content={<ChartTooltip />} />
              {series.map((s, i) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={label(s)}
                  stackId={stacked ? "1" : undefined}
                  stroke={CHART_COLORS[i % 5]}
                  strokeWidth={2}
                  fill={`url(#g-${s})`}
                />
              ))}
            </AreaChart>
          ) : type === "bar" ? (
            <BarChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={48} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              {series.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  name={label(s)}
                  stackId={stacked ? "1" : undefined}
                  fill={CHART_COLORS[i % 5]}
                  radius={stacked ? 0 : [6, 6, 0, 0]}
                  maxBarSize={42}
                />
              ))}
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={48} />
              <Tooltip content={<ChartTooltip />} />
              {series.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={label(s)}
                  stroke={CHART_COLORS[i % 5]}
                  strokeWidth={2.5}
                  dot={false}
                />
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="middle"
                align="right"
                layout="vertical"
                iconType="circle"
                wrapperStyle={{ fontSize: 12 }}
              />
              <Pie
                data={data}
                dataKey={valueKey}
                nameKey="label"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % 5]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
