"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { usePayslips } from "@/lib/queries";
import type { Payslip } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const MONTH_LABELS: Record<string, string> = {
  "2026-05": "Mai 2026",
  "2026-04": "April 2026",
  "2026-03": "März 2026",
  "2026-02": "Februar 2026",
  "2026-01": "Januar 2026",
};

function periodLabel(period: string) {
  return MONTH_LABELS[period] ?? period;
}

const LINE_LABEL_KEYS: Record<string, string> = {
  "Grundgehalt": "ess.payslip.lineGrundgehalt",
  "Bonus": "ess.payslip.lineBonus",
  "Sachbezug": "ess.payslip.lineSachbezug",
  "Lohnsteuer": "ess.payslip.lineLohnsteuer",
  "Sozialabgaben": "ess.payslip.lineSozialabgaben",
};

export default function PayslipPage() {
  const t = useT();
  const { data, isLoading } = usePayslips();
  const all = data ?? [];
  const current = all[0];
  const past = all.slice(1, 6);
  const [printTarget, setPrintTarget] = React.useState<Payslip | null>(null);

  // Druck-Layout rendern, dann Browser-Druckdialog ("Als PDF speichern") oeffnen.
  React.useEffect(() => {
    if (!printTarget) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 60);
    return () => window.clearTimeout(id);
  }, [printTarget]);

  function handleDownload(ps: Payslip) {
    setPrintTarget(ps);
    toast.success(t("ess.payslip.toastDownload", { period: periodLabel(ps.period) }));
  }

  // Kein Datensatz vorhanden -> Titel + leerer Zustand (verhindert Crash bei current === undefined).
  if (!current) {
    return (
      <div className="space-y-5">
        <FadeIn>
          <div>
            <h1 className="font-display text-xl font-semibold">{t("ess.payslip.title")}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("ess.payslip.subtitle")}
            </p>
          </div>
        </FadeIn>
        <div className="py-16 text-center text-sm text-muted-foreground">
          {isLoading ? "…" : t("common.noResults")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="font-display text-xl font-semibold">{t("ess.payslip.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("ess.payslip.subtitle")}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="border-primary/20">
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("ess.payslip.currentLabel")}</p>
                <CardTitle className="mt-0.5 text-base">
                  {periodLabel(current.period)}
                </CardTitle>
              </div>
              <StatusBadge status={current.status} />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="mb-4 text-center">
              <p className="font-display text-4xl font-bold text-primary">
                {formatCurrency(current.net)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("ess.payslip.netLabel")}</p>
            </div>

            <div className="space-y-1.5 rounded-lg bg-muted/40 p-3">
              {current.lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {LINE_LABEL_KEYS[line.label] ? t(LINE_LABEL_KEYS[line.label]) : line.label}
                  </span>
                  <span
                    className={`text-xs font-medium tabular-nums ${
                      line.type === "earning" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {line.type === "earning" ? "+" : ""}
                    {formatCurrency(line.amount)}
                  </span>
                </div>
              ))}
              <div className="my-1.5 border-t border-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("ess.payslip.gross")}</span>
                <span className="text-xs font-medium tabular-nums">
                  {formatCurrency(current.gross)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("ess.payslip.tax")}</span>
                <span className="text-xs font-medium tabular-nums text-destructive">
                  -{formatCurrency(current.tax)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1.5">
                <span className="text-xs font-semibold">{t("ess.payslip.net")}</span>
                <span className="text-xs font-bold tabular-nums text-primary">
                  {formatCurrency(current.net)}
                </span>
              </div>
            </div>

            <Button
              className="mt-4 w-full min-h-12"
              onClick={() => handleDownload(current)}
            >
              <Download className="mr-2 size-4" />
              {t("ess.payslip.btnDownload")}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("ess.payslip.pastSection")}
          </h2>
          <Stagger className="space-y-2">
            {past.map((ps) => (
              <StaggerItem key={ps.id}>
                <Card>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <FileText className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{periodLabel(ps.period)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("ess.payslip.netShort", { amount: formatCurrency(ps.net) })}
                      </p>
                    </div>
                    <StatusBadge status={ps.status} />
                    <button
                      onClick={() => handleDownload(ps)}
                      className="ml-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={t("ess.payslip.ariaDownload")}
                    >
                      <Download className="size-4" />
                    </button>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </FadeIn>

      {/* Druck-/PDF-Layout: am Bildschirm versteckt, nur beim Drucken sichtbar. */}
      <div id="payslip-print" className="hidden print:block">
        {printTarget && (
          <div className="p-8 text-black">
            <h1 className="text-2xl font-bold">{t("ess.payslip.title")}</h1>
            <p className="mt-1 text-sm">
              {printTarget.employeeName} · {periodLabel(printTarget.period)}
            </p>
            <table className="mt-6 w-full border-collapse text-sm">
              <tbody>
                {printTarget.lines.map((line, i) => (
                  <tr key={i} className="border-b border-gray-300">
                    <td className="py-1.5">
                      {LINE_LABEL_KEYS[line.label] ? t(LINE_LABEL_KEYS[line.label]) : line.label}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {line.type === "earning" ? "+" : "−"}
                      {formatCurrency(line.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-gray-400">
                  <td className="py-1.5 font-medium">{t("ess.payslip.gross")}</td>
                  <td className="py-1.5 text-right font-mono">{formatCurrency(printTarget.gross)}</td>
                </tr>
                <tr className="border-b border-gray-400">
                  <td className="py-1.5 font-medium">{t("ess.payslip.tax")}</td>
                  <td className="py-1.5 text-right font-mono">−{formatCurrency(printTarget.tax)}</td>
                </tr>
                <tr className="border-t-2 border-black">
                  <td className="py-2 text-base font-bold">{t("ess.payslip.net")}</td>
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
