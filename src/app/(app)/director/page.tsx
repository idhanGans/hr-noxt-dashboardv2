"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  FileSignature,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { CreateContractDialog } from "@/components/director/create-contract-dialog";
import { CreatePayslipDialog } from "@/components/payroll/create-payslip-dialog";
import { useContracts, usePayslips } from "@/lib/queries";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Contract, Kpi, TimeSeriesPoint } from "@/types";

const TREND_MONTHS = [
  "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
  "Dec", "Jan", "Feb", "Mar", "Apr", "May",
];
function buildTrend(now: number, amplitude: number, phase: number): TimeSeriesPoint[] {
  return TREND_MONTHS.map((label, i) => {
    const v = Math.round(now + Math.sin((i + phase) * 0.9) * amplitude);
    return { label, value: Math.max(0, v) };
  });
}

const CONTRACT_TODAY = new Date(Date.UTC(2026, 5, 5));
function daysToEnd(endDate: string | null): number | null {
  if (!endDate) return null;
  return Math.round(
    (new Date(endDate).getTime() - CONTRACT_TODAY.getTime()) / 86_400_000,
  );
}

// Critical first: expired (most negative days) -> expiring soon (smallest positive days).
function criticalContractsSort(a: Contract, b: Contract): number {
  const da = daysToEnd(a.endDate);
  const db = daysToEnd(b.endDate);
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

export default function DirectorOverviewPage() {
  const t = useT();
  const { data: contractData } = useContracts();
  const { data: payslipData } = usePayslips();
  const [contractOpen, setContractOpen] = useState(false);
  const [payslipOpen, setPayslipOpen] = useState(false);

  const contracts = contractData ?? [];
  const payslips = payslipData ?? [];

  const critical = useMemo(
    () =>
      contracts
        .filter((c) => c.status === "expiring_soon" || c.status === "expired")
        .sort(criticalContractsSort)
        .slice(0, 5),
    [contracts],
  );

  const period = payslips[0]?.period ?? "—";
  const monthGross = payslips.reduce((s, p) => s + p.gross, 0);
  const monthNet = payslips.reduce((s, p) => s + p.net, 0);
  const monthHead = payslips.length;
  const avgNet = monthHead ? Math.round(monthNet / monthHead) : 0;

  const statusCounts = useMemo(() => {
    const c = { paid: 0, processing: 0, scheduled: 0 };
    for (const p of payslips) c[p.status] += 1;
    return c;
  }, [payslips]);

  const kpis: Kpi[] = useMemo(() => {
    const active = contracts.filter((c) => c.status === "active").length;
    const expiring = contracts.filter(
      (c) => c.status === "expiring_soon",
    ).length;
    const expired = contracts.filter((c) => c.status === "expired").length;
    return [
      {
        id: "do-active",
        label: t("director.overview.kpiActiveContracts"),
        value: active,
        format: "number",
        delta: 0,
        trend: buildTrend(active, 6, 1.1),
      },
      {
        id: "do-expiring",
        label: t("director.overview.kpiExpiringSoon"),
        value: expiring,
        format: "number",
        delta: 0,
        trend: buildTrend(expiring, 2, 2.0),
      },
      {
        id: "do-expired",
        label: t("director.overview.kpiExpired"),
        value: expired,
        format: "number",
        delta: 0,
        trend: buildTrend(expired, 1.5, 1.7),
      },
      {
        id: "do-payroll-month",
        label: t("director.overview.kpiPayrollMonth", { period }),
        value: monthGross,
        format: "currency",
        delta: 0,
        trend: buildTrend(monthGross / 1000, 18, 0.3),
      },
      {
        id: "do-avg-net",
        label: t("director.overview.kpiAvgNet"),
        value: avgNet,
        format: "currency",
        delta: 0,
        trend: buildTrend(avgNet / 100, 3, 0.7),
      },
    ];
  }, [contracts, monthGross, avgNet, period, t]);

  const statusTotal = statusCounts.paid + statusCounts.processing + statusCounts.scheduled;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("director.overview.title")}
        description={t("director.overview.desc")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setPayslipOpen(true)}>
              <Wallet className="mr-2 size-4" />
              {t("director.overview.qaNewPayslip")}
            </Button>
            <Button onClick={() => setContractOpen(true)}>
              <FileSignature className="mr-2 size-4" />
              {t("director.overview.qaNewContract")}
            </Button>
          </div>
        }
      />

      <CreateContractDialog open={contractOpen} onOpenChange={setContractOpen} />
      <CreatePayslipDialog open={payslipOpen} onOpenChange={setPayslipOpen} />

      <Stagger>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, i) => (
            <StaggerItem key={kpi.id}>
              <KpiCard kpi={kpi} accent={(i % 5) + 1} />
            </StaggerItem>
          ))}
        </div>
      </Stagger>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-warning" />
                  {t("director.overview.cardContractsTitle")}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("director.overview.cardContractsDesc")}
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/director/contracts">
                  {t("director.overview.cardContractsCta")}
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {critical.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <ShieldCheck className="size-4 text-success" />
                  {t("director.overview.cardContractsEmpty")}
                </div>
              )}
              {critical.map((c) => {
                const days = daysToEnd(c.endDate);
                return (
                  <Link
                    key={c.id}
                    href="/director/contracts"
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="text-xs">
                        {initials(c.employeeName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.employeeName}</p>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        <span className="font-mono">{c.endDate}</span>
                        {days !== null && (
                          <span
                            className={cn(
                              days < 0
                                ? "text-destructive"
                                : "text-warning",
                            )}
                          >
                            {days < 0
                              ? t("director.overview.daysOverdue", {
                                days: String(Math.abs(days)),
                              })
                              : t("director.overview.daysLeft", {
                                days: String(days),
                              })}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-4 text-primary" />
                  {t("director.overview.cardPayrollTitle")}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("director.overview.cardPayrollDesc")}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPayslipOpen(true)}>
                <Plus className="mr-1 size-4" />
                {t("director.overview.cardPayrollCta")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3">
                <SummaryTile
                  label={t("director.overview.kpiPayrollHeadcount", { period })}
                  value={String(monthHead)}
                />
                <SummaryTile
                  label={t("director.overview.kpiPayrollMonth", { period })}
                  value={formatCurrency(monthGross)}
                />
                <SummaryTile
                  label={t("director.overview.kpiAvgNet")}
                  value={formatCurrency(avgNet)}
                />
              </div>

              {/* Status distribution bar */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-success" />
                    {t("director.overview.cardPayrollStatusPaid")} ({statusCounts.paid})
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-info" />
                    {t("director.overview.cardPayrollStatusProcessing")} ({statusCounts.processing})
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-muted-foreground/60" />
                    {t("director.overview.cardPayrollStatusScheduled")} ({statusCounts.scheduled})
                  </span>
                </div>
                {statusTotal > 0 && (
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-success"
                      style={{ width: `${(statusCounts.paid / statusTotal) * 100}%` }}
                    />
                    <div
                      className="bg-info"
                      style={{ width: `${(statusCounts.processing / statusTotal) * 100}%` }}
                    />
                    <div
                      className="bg-muted-foreground/60"
                      style={{ width: `${(statusCounts.scheduled / statusTotal) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Recent payslips */}
              <div className="space-y-2">
                {payslips.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">
                          {initials(p.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">
                          {p.employeeName}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {p.period}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatCurrency(p.net)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle>{t("director.overview.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setContractOpen(true)}>
              <FileSignature className="mr-2 size-4" />
              {t("director.overview.qaNewContract")}
            </Button>
            <Button variant="outline" onClick={() => setPayslipOpen(true)}>
              <Wallet className="mr-2 size-4" />
              {t("director.overview.qaNewPayslip")}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/director/contracts">
                <CalendarClock className="mr-2 size-4" />
                {t("director.overview.qaReviewExpired")}
                <Badge variant="destructive" className="ml-2">
                  {contracts.filter((c) => c.status === "expired").length}
                </Badge>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
