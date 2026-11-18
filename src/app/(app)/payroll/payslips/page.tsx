"use client";

import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { CreatePayslipDialog } from "@/components/payroll/create-payslip-dialog";
import { usePayslips, useEmployees } from "@/lib/queries";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { DEPARTMENT_OPTIONS } from "@/config/options";
import type { Kpi, Payslip, TimeSeriesPoint } from "@/types";

const TREND_MONTHS = [
  "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
  "Dec", "Jan", "Feb", "Mar", "Apr", "May",
];

// Deterministic, SSR-safe sparkline (cosine wave around the KPI's "now" value).
function buildTrend(now: number, amplitude: number, phase: number): TimeSeriesPoint[] {
  return TREND_MONTHS.map((label, i) => {
    const v = Math.round(now + Math.sin((i + phase) * 0.9) * amplitude);
    return { label, value: Math.max(0, v) };
  });
}

function earningLabels(p: Payslip): string {
  return p.lines.filter((l) => l.type === "earning").map((l) => l.label).join(" + ");
}
function deductionLabels(p: Payslip): string {
  return p.lines.filter((l) => l.type === "deduction").map((l) => l.label).join(" + ");
}

export default function PayslipsPage() {
  const t = useT();
  const { data, isLoading } = usePayslips();
  const { data: employees = [] } = useEmployees();
  const queryClient = useQueryClient();
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const all = data ?? [];

  // Lookup-Index: employeeId → Mitarbeiter — vermeidet O(n²) find() in jeder Zelle.
  const empIndex = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  // --- KPIs ---
  const kpis: Kpi[] = useMemo(() => {
    const count = all.length;
    const totalGross = all.reduce((s, p) => s + p.gross, 0);
    const totalNet = all.reduce((s, p) => s + p.net, 0);
    const totalTax = all.reduce((s, p) => s + p.tax, 0);
    const avgGross = count ? Math.round(totalGross / count) : 0;
    const avgNet = count ? Math.round(totalNet / count) : 0;
    const takeHomePct = totalGross
      ? Math.round((totalNet / totalGross) * 1000) / 10
      : 0;
    return [
      {
        id: "pay-total-cost",
        label: t("payroll.payslips.kpiTotalCost"),
        value: totalGross,
        format: "currency",
        delta: 0,
        trend: buildTrend(totalGross / 1000, 18, 0.3),
      },
      {
        id: "pay-avg-gross",
        label: t("payroll.payslips.kpiAvgGross"),
        value: avgGross,
        format: "currency",
        delta: 0,
        trend: buildTrend(avgGross / 100, 4, 1.1),
      },
      {
        id: "pay-avg-net",
        label: t("payroll.payslips.kpiAvgNet"),
        value: avgNet,
        format: "currency",
        delta: 0,
        trend: buildTrend(avgNet / 100, 3, 0.7),
      },
      {
        id: "pay-total-tax",
        label: t("payroll.payslips.kpiTotalTax"),
        value: totalTax,
        format: "currency",
        delta: 0,
        trend: buildTrend(totalTax / 1000, 6, 1.8),
      },
      {
        id: "pay-take-home",
        label: t("payroll.payslips.kpiTakeHome"),
        value: takeHomePct,
        format: "percent",
        delta: 0,
        trend: buildTrend(takeHomePct, 2, 2.2),
      },
    ];
  }, [all, t]);

  const STATUS_OPTIONS = [
    { label: t("payroll.payslips.statusPaid"), value: "paid" },
    { label: t("payroll.payslips.statusProcessing"), value: "processing" },
    { label: t("payroll.payslips.statusScheduled"), value: "scheduled" },
  ];

  const columns: ColumnDef<Payslip>[] = [
    selectColumn<Payslip>(),
    {
      accessorKey: "employeeName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("payroll.payslips.colEmployee")}
        />
      ),
      cell: ({ row }) => {
        const emp = empIndex.get(row.original.employeeId);
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs">
                {initials(row.original.employeeName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">
                {row.original.employeeName}
              </p>
              {emp && (
                <p className="truncate text-xs text-muted-foreground">
                  {emp.department} · {emp.title}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "department",
      accessorFn: (row) => empIndex.get(row.employeeId)?.department ?? "",
      header: t("payroll.payslips.colDepartment"),
      cell: ({ row }) => {
        const dept = empIndex.get(row.original.employeeId)?.department;
        return dept ? <Badge variant="secondary">{dept}</Badge> : null;
      },
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "period",
      header: t("payroll.payslips.colPeriod"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.period}</span>
      ),
    },
    {
      accessorKey: "gross",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("payroll.payslips.colGross")}
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm">
            {formatCurrency(row.original.gross)}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {earningLabels(row.original)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "tax",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("payroll.payslips.colTax")}
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm text-destructive">
            -{formatCurrency(row.original.tax)}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {deductionLabels(row.original)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "net",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("payroll.payslips.colNet")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">
          {formatCurrency(row.original.net)}
        </span>
      ),
    },
    {
      id: "takeHome",
      accessorFn: (row) => (row.gross ? row.net / row.gross : 0),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("payroll.payslips.colTakeHome")}
        />
      ),
      cell: ({ row }) => {
        const pct = row.original.gross
          ? Math.round((row.original.net / row.original.gross) * 1000) / 10
          : 0;
        return (
          <span
            className={cn(
              "font-mono text-sm",
              pct >= 60 ? "text-success" : pct < 50 ? "text-destructive" : "",
            )}
          >
            {pct.toLocaleString("de-DE")} %
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
  ];

  function handleRowClick(row: Payslip) {
    setSelectedPayslip(row);
    setSheetOpen(true);
  }

  // Echtes Loeschen: ruft DELETE pro ausgewaehlter Abrechnung und laedt die Liste neu.
  async function handleBulkDelete(rows: Payslip[]) {
    const results = await Promise.allSettled(
      rows.map((r) =>
        fetch(`/api/payslips/${r.id}`, { method: "DELETE" }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ["payslips"] });
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (ok > 0) {
      toast.success(t("payroll.payslips.toastDeletedDesc", { count: String(ok) }));
    }
    if (failed > 0) {
      toast.error(`${failed}× konnte nicht geloescht werden`);
    }
  }

  const [printTarget, setPrintTarget] = useState<Payslip | null>(null);
  useEffect(() => {
    if (!printTarget) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 60);
    return () => window.clearTimeout(id);
  }, [printTarget]);

  function handleDownload() {
    if (!selectedPayslip) return;
    setPrintTarget(selectedPayslip);
    toast.success(t("payroll.payslips.toastDownloadTitle"), {
      description: t("payroll.payslips.toastDownloadDesc", {
        period: selectedPayslip.period,
        name: selectedPayslip.employeeName,
      }),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("payroll.payslips.title")}
        description={t("payroll.payslips.desc")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t("payroll.payslips.createBtn")}
          </Button>
        }
      />

      <CreatePayslipDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Stagger>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, i) => (
            <StaggerItem key={kpi.id}>
              <KpiCard
                kpi={kpi}
                accent={(i % 5) + 1}
                meta={
                  i === 0
                    ? t("payroll.payslips.kpiMeta", {
                      count: String(all.length),
                      period: all[0]?.period ?? "—",
                    })
                    : undefined
                }
              />
            </StaggerItem>
          ))}
        </div>
      </Stagger>

      <FadeIn>
        <DataTable
          columns={columns}
          data={all}
          loading={isLoading}
          searchKey="employeeName"
          searchPlaceholder={t("common.search")}
          facets={[
            {
              columnId: "status",
              title: t("common.status"),
              options: STATUS_OPTIONS,
            },
            {
              columnId: "department",
              title: t("payroll.payslips.facetDept"),
              options: DEPARTMENT_OPTIONS,
            },
          ]}
          initialColumnVisibility={{ department: false }}
          onBulkDelete={handleBulkDelete}
          onRowClick={handleRowClick}
          pageSize={10}
        />
      </FadeIn>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          {selectedPayslip && (
            <PayslipSheet
              payslip={selectedPayslip}
              onDownload={handleDownload}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Druck-/PDF-Layout: am Bildschirm versteckt, nur beim Drucken sichtbar. */}
      <div id="payslip-print" className="hidden print:block">
        {printTarget && (
          <div className="p-8 text-black">
            <h1 className="text-2xl font-bold">{t("payroll.payslips.title")}</h1>
            <p className="mt-1 text-sm">
              {printTarget.employeeName} · {printTarget.period}
            </p>
            <table className="mt-6 w-full border-collapse text-sm">
              <tbody>
                {printTarget.lines.map((line, i) => (
                  <tr key={i} className="border-b border-gray-300">
                    <td className="py-1.5">{line.label}</td>
                    <td className="py-1.5 text-right font-mono">
                      {line.type === "earning" ? "+" : "−"}
                      {formatCurrency(line.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-gray-400">
                  <td className="py-1.5 font-medium">{t("payroll.payslips.colGross")}</td>
                  <td className="py-1.5 text-right font-mono">{formatCurrency(printTarget.gross)}</td>
                </tr>
                <tr className="border-b border-gray-400">
                  <td className="py-1.5 font-medium">{t("payroll.payslips.colTax")}</td>
                  <td className="py-1.5 text-right font-mono">−{formatCurrency(printTarget.tax)}</td>
                </tr>
                <tr className="border-t-2 border-black">
                  <td className="py-2 text-base font-bold">{t("payroll.payslips.colNet")}</td>
                  <td className="py-2 text-right font-mono text-base font-bold">
                    {formatCurrency(printTarget.net)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #payslip-print, #payslip-print * { visibility: visible !important; }
          #payslip-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}

function PayslipSheet({
  payslip,
  onDownload,
}: {
  payslip: Payslip;
  onDownload: () => void;
}) {
  const t = useT();
  const { data: employees = [] } = useEmployees();
  const emp = employees.find((e) => e.id === payslip.employeeId);
  const takeHomePct = payslip.gross
    ? Math.round((payslip.net / payslip.gross) * 1000) / 10
    : 0;
  const effectiveTaxPct = payslip.gross
    ? Math.round((payslip.tax / payslip.gross) * 1000) / 10
    : 0;
  const totalDeductions = payslip.lines
    .filter((l) => l.type === "deduction")
    .reduce((s, l) => s + Math.abs(l.amount), 0);

  function pctOfGross(amount: number): number {
    return payslip.gross
      ? Math.round((Math.abs(amount) / payslip.gross) * 1000) / 10
      : 0;
  }
  function pctOfDeductions(amount: number): number {
    return totalDeductions
      ? Math.round((Math.abs(amount) / totalDeductions) * 1000) / 10
      : 0;
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("payroll.payslips.sheetTitle")}</SheetTitle>
        <SheetDescription>
          {payslip.employeeName} · {payslip.period}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Employee header */}
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Avatar className="size-12">
            <AvatarFallback>{initials(payslip.employeeName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{payslip.employeeName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {emp && (
                <>
                  <span>
                    {t("payroll.payslips.sheetDept")}: {emp.department}
                  </span>
                  <span>
                    {t("payroll.payslips.sheetPosition")}: {emp.title}
                  </span>
                </>
              )}
              <span className="font-mono">
                {t("payroll.payslips.sheetPaymentId")}: {payslip.id}
              </span>
            </div>
          </div>
          <StatusBadge status={payslip.status} />
        </div>

        {/* Take-home rate prominent */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-success/8 p-3">
            <p className="text-xs text-muted-foreground">
              {t("payroll.payslips.sheetTakeHomeRate")}
            </p>
            <p className="mt-1 font-display text-xl font-semibold text-success">
              {takeHomePct.toLocaleString("de-DE")} %
            </p>
          </div>
          <div className="rounded-lg border border-border bg-destructive/8 p-3">
            <p className="text-xs text-muted-foreground">
              {t("payroll.payslips.sheetEffectiveTax")}
            </p>
            <p className="mt-1 font-display text-xl font-semibold text-destructive">
              {effectiveTaxPct.toLocaleString("de-DE")} %
            </p>
          </div>
        </div>

        {/* Earnings */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("payroll.payslips.sectionEarnings")}
          </p>
          <ul className="space-y-2">
            {payslip.lines
              .filter((l) => l.type === "earning")
              .map((line) => (
                <li
                  key={line.label}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p>{line.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("payroll.payslips.sheetPctOfGross", {
                        pct: pctOfGross(line.amount).toLocaleString("de-DE"),
                      })}
                    </p>
                  </div>
                  <span className="font-mono font-medium text-success shrink-0">
                    +{formatCurrency(line.amount)}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        <Separator />

        {/* Deductions */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("payroll.payslips.sectionDeductions")}
          </p>
          <ul className="space-y-2">
            {payslip.lines
              .filter((l) => l.type === "deduction")
              .map((line) => (
                <li
                  key={line.label}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p>{line.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("payroll.payslips.sheetPctOfGross", {
                        pct: pctOfGross(line.amount).toLocaleString("de-DE"),
                      })}{" "}
                      ·{" "}
                      {t("payroll.payslips.sheetPctOfDeductions", {
                        pct: pctOfDeductions(line.amount).toLocaleString(
                          "de-DE",
                        ),
                      })}
                    </p>
                  </div>
                  <span className="font-mono font-medium text-destructive shrink-0">
                    {formatCurrency(line.amount)}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t("payroll.payslips.rowGross")}
            </span>
            <span className="font-mono font-medium">
              {formatCurrency(payslip.gross)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t("payroll.payslips.rowTax")}
            </span>
            <span className="font-mono font-medium text-destructive">
              -{formatCurrency(payslip.tax)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <span>{t("payroll.payslips.rowNet")}</span>
            <span className="font-mono text-success">
              {formatCurrency(payslip.net)}
            </span>
          </div>
        </div>
      </div>

      <SheetFooter>
        <Button onClick={onDownload} className="w-full">
          <Download className="mr-2 size-4" />
          {t("payroll.payslips.downloadPdf")}
        </Button>
      </SheetFooter>
    </>
  );
}
