"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Download,
  MoreHorizontal,
  Paperclip,
  Plus,
  Send,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useQueryClient } from "@tanstack/react-query";
import { useReimbursements } from "@/lib/queries";
import { bulkDelete } from "@/lib/use-bulk-delete";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Kpi, Reimbursement, TimeSeriesPoint } from "@/types";

const TREND_MONTHS = [
  "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
  "Dec", "Jan", "Feb", "Mar", "Apr", "May",
];

// Deterministic, SSR-safe sparkline data based on the KPI's "now" value.
function buildTrend(now: number, amplitude: number, phase: number): TimeSeriesPoint[] {
  return TREND_MONTHS.map((label, i) => {
    const v = Math.round(now + Math.sin((i + phase) * 0.9) * amplitude);
    return { label, value: Math.max(0, v) };
  });
}

// Kein Kommentar-/Audit-Backend vorhanden -> keine erfundene Historie.
function mockCommentsFor(
  _status: Reimbursement["status"],
): { author: string; at: string; text: string }[] {
  return [];
}

export default function ReimbursementsPage() {
  const t = useT();
  const { data, isLoading } = useReimbursements();
  const queryClient = useQueryClient();

  // Genehmigen/Ablehnen wirklich speichern (POST /api/reimbursements/[id]/approve|reject).
  async function decideReimbursement(id: string, decision: "approve" | "reject") {
    try {
      const res = await fetch(`/api/reimbursements/${id}/${decision}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
      if (decision === "approve") {
        toast.success(t("payroll.reimbursements.toastApproved", { id }));
      } else {
        toast.error(t("payroll.reimbursements.toastRejected", { id }));
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reimbursement | null>(null);
  const [selected, setSelected] = useState<Reimbursement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<Reimbursement | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  const CATEGORY_LABELS: Record<string, string> = {
    travel: t("payroll.reimbursements.catTravel"),
    meals: t("payroll.reimbursements.catMeals"),
    equipment: t("payroll.reimbursements.catEquipment"),
    training: t("payroll.reimbursements.catTraining"),
    other: t("payroll.reimbursements.catOther"),
  };
  const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  const STATUS_OPTIONS = [
    { label: t("status.pending"), value: "pending" },
    { label: t("status.approved"), value: "approved" },
    { label: t("status.rejected"), value: "rejected" },
    { label: t("status.cancelled"), value: "cancelled" },
  ];

  const PAYMENT_LABELS: Record<string, string> = {
    payroll: t("payroll.reimbursements.payPayroll"),
    bank: t("payroll.reimbursements.payBank"),
    corporate_card: t("payroll.reimbursements.payCard"),
  };
  const PAYMENT_OPTIONS = Object.entries(PAYMENT_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  // Top-8 cost centers by frequency in current data.
  const COST_CENTER_OPTIONS = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data ?? []) {
      counts.set(r.costCenter, (counts.get(r.costCenter) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cc]) => ({ value: cc, label: cc }));
  }, [data]);

  // Apply date-range filter client-side before handing to DataTable.
  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (!dateFrom && !dateTo) return rows;
    const fromTs = dateFrom ? Date.parse(dateFrom) : -Infinity;
    const toTs = dateTo ? Date.parse(dateTo) + 24 * 3600 * 1000 - 1 : Infinity;
    return rows.filter((r) => {
      const ts = Date.parse(r.date);
      return ts >= fromTs && ts <= toTs;
    });
  }, [data, dateFrom, dateTo]);

  // KPI math is based on the full (unfiltered) live set.
  const all = data ?? [];
  const pendingCount = all.filter((r) => r.status === "pending").length;
  const approvedCount = all.filter((r) => r.status === "approved").length;
  const rejectedCount = all.filter((r) => r.status === "rejected").length;
  const reviewedTotal = approvedCount + rejectedCount;
  const rejectionRate = reviewedTotal > 0
    ? Math.round((rejectedCount / reviewedTotal) * 1000) / 10
    : 0;
  const totalYtd = all
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + r.amount, 0);
  const processingSamples = all
    .filter((r) => (r.status === "approved" || r.status === "rejected") && typeof r.processingDays === "number")
    .map((r) => r.processingDays as number);
  const avgDays = processingSamples.length > 0
    ? Math.round(
      (processingSamples.reduce((s, n) => s + n, 0) / processingSamples.length) * 10,
    ) / 10
    : 0;
  const agingCount = all.filter(
    (r) => r.status === "pending" && (r.processingDays ?? 0) > 14,
  ).length;

  const kpis: Kpi[] = [
    {
      id: "reimb-pending",
      label: t("payroll.reimbursements.kpiPending"),
      value: pendingCount,
      format: "number",
      delta: 0,
      trend: buildTrend(pendingCount, 4, 0.3),
    },
    {
      id: "reimb-approved",
      label: t("payroll.reimbursements.kpiApproved"),
      value: approvedCount,
      format: "number",
      delta: 0,
      trend: buildTrend(approvedCount, 5, 1.1),
    },
    {
      id: "reimb-rejected",
      label: t("payroll.reimbursements.kpiRejected"),
      value: rejectedCount,
      format: "number",
      delta: rejectionRate,
      trend: buildTrend(rejectedCount, 2, 2.0),
    },
    {
      id: "reimb-total-ytd",
      label: t("payroll.reimbursements.kpiTotalYtd"),
      value: totalYtd,
      format: "currency",
      delta: 0,
      trend: buildTrend(totalYtd / 1000, 8, 0.6),
    },
    {
      id: "reimb-avg-days",
      label: t("payroll.reimbursements.kpiAvgDays"),
      value: avgDays,
      format: "number",
      delta: 0,
      trend: buildTrend(avgDays, 1.5, 1.7),
    },
    {
      id: "reimb-aging",
      label: t("payroll.reimbursements.kpiAging"),
      value: agingCount,
      format: "number",
      delta: 0,
      trend: buildTrend(agingCount, 1.2, 2.4),
    },
  ];

  const reimbSchema = z.object({
    category: z.string().min(1, t("payroll.reimbursements.errCategoryRequired")),
    amount: z
      .string()
      .min(1, t("payroll.reimbursements.errAmountRequired"))
      .refine((v) => Number(v) > 0, t("payroll.reimbursements.errAmountMin")),
    description: z.string().min(3, t("payroll.reimbursements.errDescMin")),
    date: z.string().min(1, t("common.required")),
  });
  type ReimbForm = z.infer<typeof reimbSchema>;

  const form = useForm<ReimbForm>({
    resolver: zodResolver(reimbSchema),
    defaultValues: { category: "", amount: "", description: "", date: "" },
  });

  // Erstellt (POST) oder bearbeitet (PATCH) eine Erstattung und speichert wirklich.
  async function onSubmitReimb(values: ReimbForm) {
    const payload = {
      category: values.category,
      amount: Number(values.amount),
      date: values.date,
      description: values.description,
    };
    try {
      const res = await fetch(
        editing ? `/api/reimbursements/${editing.id}` : "/api/reimbursements",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      void queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
      if (editing) {
        toast.success(t("payroll.reimbursements.toastUpdated"));
      } else {
        toast.success(t("payroll.reimbursements.toastSubmittedTitle"), {
          description: `${CATEGORY_LABELS[values.category]} · ${formatCurrency(Number(values.amount))}`,
        });
      }
      form.reset();
      setEditing(null);
      setDialogOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function openCreate() {
    setEditing(null);
    form.reset({ category: "", amount: "", description: "", date: "" });
    setDialogOpen(true);
  }

  function openEdit(r: Reimbursement) {
    setEditing(r);
    form.reset({
      category: r.category,
      amount: String(r.amount),
      description: r.description,
      date: r.date,
    });
    setDialogOpen(true);
  }

  const columns: ColumnDef<Reimbursement>[] = [
    selectColumn<Reimbursement>(),
    {
      accessorKey: "employeeName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("payroll.reimbursements.colEmployee")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.employeeName}</span>
      ),
    },
    {
      accessorKey: "category",
      header: t("common.category"),
      cell: ({ row }) => (
        <Badge variant="secondary">
          {CATEGORY_LABELS[row.original.category] ?? row.original.category}
        </Badge>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "description",
      header: t("payroll.reimbursements.colDescription"),
      cell: ({ row }) => (
        <span className="max-w-[180px] truncate text-sm text-muted-foreground">
          {row.original.description}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("common.amount")} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-semibold">
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: "vat",
      header: t("payroll.reimbursements.colVat"),
      cell: ({ row }) => (
        <Badge variant="muted" className="font-mono text-[10px]">
          {row.original.vat}%
        </Badge>
      ),
    },
    {
      accessorKey: "costCenter",
      header: t("payroll.reimbursements.colCostCenter"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.costCenter}
        </span>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      id: "receipt",
      header: t("payroll.reimbursements.colReceipt"),
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original;
        if (!r.receiptUrl) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("payroll.reimbursements.colReceipt")}
            onClick={(e) => {
              e.stopPropagation();
              setReceiptPreview(r);
            }}
          >
            <Paperclip className="size-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "approver",
      header: t("payroll.reimbursements.colApprover"),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.approver ?? "—"}</span>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: t("payroll.reimbursements.colPayment"),
      cell: ({ row }) => (
        <Badge variant="outline">
          {PAYMENT_LABELS[row.original.paymentMethod] ?? row.original.paymentMethod}
        </Badge>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("common.date")} />
      ),
      cell: ({ row }) => <span className="text-sm">{row.original.date}</span>,
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">{t("common.actions")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.original.status === "pending" && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(row.original);
                  }}
                >
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                void decideReimbursement(row.original.id, "approve");
              }}
            >
              {t("payroll.reimbursements.actionApprove")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                void decideReimbursement(row.original.id, "reject");
              }}
            >
              {t("payroll.reimbursements.actionReject")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  function openDrawer(r: Reimbursement) {
    setSelected(r);
    setCommentDraft("");
    setSheetOpen(true);
  }

  const dateRangeActive = Boolean(dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("payroll.reimbursements.title")}
        description={t("payroll.reimbursements.desc")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            {t("payroll.reimbursements.newRequest")}
          </Button>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi, i) => {
          const isAging = kpi.id === "reimb-aging";
          const aged = isAging && kpi.value > 0;
          return (
            <StaggerItem key={kpi.id}>
              <div
                className={cn(
                  isAging && "rounded-xl",
                  aged &&
                    "ring-1 ring-destructive/40 shadow-[0_0_0_4px_color-mix(in_oklch,var(--destructive)_12%,transparent)]",
                )}
              >
                <KpiCard kpi={kpi} accent={isAging ? 4 : (i % 5) + 1} />
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      <FadeIn>
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          searchKey="employeeName"
          searchPlaceholder={t("common.search")}
          facets={[
            {
              columnId: "category",
              title: t("common.category"),
              options: CATEGORY_OPTIONS,
            },
            {
              columnId: "status",
              title: t("common.status"),
              options: STATUS_OPTIONS,
            },
            {
              columnId: "paymentMethod",
              title: t("payroll.reimbursements.facetPayment"),
              options: PAYMENT_OPTIONS,
            },
            {
              columnId: "costCenter",
              title: t("payroll.reimbursements.facetCostCenter"),
              options: COST_CENTER_OPTIONS,
            },
          ]}
          onRowClick={openDrawer}
          onBulkDelete={(picked) => bulkDelete("reimbursements", "reimbursements", picked)}
          onBulkApprove={(picked) =>
            toast.success(
              t("payroll.reimbursements.toastBulkApproved", {
                count: String(picked.length),
              }),
            )
          }
          onBulkReject={(picked) =>
            toast.error(
              t("payroll.reimbursements.toastBulkRejected", {
                count: String(picked.length),
              }),
            )
          }
          extraToolbar={
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={dateRangeActive ? "default" : "outline"}
                  size="sm"
                >
                  <CalendarIcon className="size-3.5" />
                  {t("payroll.reimbursements.dateFilter")}
                  {dateRangeActive && (
                    <Badge variant="muted" className="ml-1">
                      {[dateFrom, dateTo].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="date-from">
                      {t("payroll.reimbursements.dateFrom")}
                    </Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="date-to">
                      {t("payroll.reimbursements.dateTo")}
                    </Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  {dateRangeActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                    >
                      {t("payroll.reimbursements.dateClear")}
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          }
          pageSize={10}
        />
      </FadeIn>

      {/* Erstattung anlegen/bearbeiten */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("payroll.reimbursements.dialogEditTitle")
                : t("payroll.reimbursements.dialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmitReimb)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("payroll.reimbursements.fieldCategory")}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "payroll.reimbursements.fieldCategoryPlaceholder",
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("payroll.reimbursements.fieldAmount")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder={t(
                          "payroll.reimbursements.fieldAmountPlaceholder",
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("payroll.reimbursements.fieldDescription")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "payroll.reimbursements.fieldDescPlaceholder",
                        )}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.date")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {t("common.cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit">
                  {editing ? t("common.save") : t("payroll.reimbursements.submitBtn")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Receipt preview Dialog */}
      <Dialog
        open={Boolean(receiptPreview)}
        onOpenChange={(open) => !open && setReceiptPreview(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("payroll.reimbursements.colReceipt")} ·{" "}
              {receiptPreview?.id}
            </DialogTitle>
          </DialogHeader>
          {receiptPreview?.receiptUrl ? (
            <div className="space-y-3">
              <div className="flex aspect-[4/5] w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Paperclip className="size-8" />
                  <p className="font-mono text-xs">
                    {receiptPreview.receiptUrl}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  toast.success(
                    t("payroll.reimbursements.receiptToast", {
                      id: receiptPreview.id,
                    }),
                  );
                  setReceiptPreview(null);
                }}
              >
                <Download className="size-4" />
                {t("payroll.reimbursements.receiptDownload")}
              </Button>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("payroll.reimbursements.receiptMissing")}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3 pt-2">
                  <Avatar className="size-12">
                    <AvatarFallback className="text-base font-semibold">
                      {initials(selected.employeeName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <SheetTitle>{selected.employeeName}</SheetTitle>
                    <SheetDescription className="flex items-center gap-2">
                      <span className="font-mono">{selected.id}</span>
                      <span>·</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(selected.amount)}
                      </span>
                      <StatusBadge status={selected.status} />
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <Tabs defaultValue="receipt" className="px-6 pb-6">
                <TabsList>
                  <TabsTrigger value="receipt">
                    {t("payroll.reimbursements.drawerTabReceipt")}
                  </TabsTrigger>
                  <TabsTrigger value="audit">
                    {t("payroll.reimbursements.drawerTabAudit")}
                  </TabsTrigger>
                  <TabsTrigger value="comments">
                    {t("payroll.reimbursements.drawerTabComments")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="receipt" className="space-y-3">
                  {selected.receiptUrl ? (
                    <>
                      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Paperclip className="size-8" />
                          <p className="font-mono text-xs">
                            {selected.receiptUrl}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          toast.success(
                            t("payroll.reimbursements.receiptToast", {
                              id: selected.id,
                            }),
                          )
                        }
                      >
                        <Download className="size-4" />
                        {t("payroll.reimbursements.receiptDownload")}
                      </Button>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("payroll.reimbursements.receiptMissing")}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="audit">
                  <ol className="relative space-y-4 border-l border-border pl-5">
                    <AuditEntry
                      tone="info"
                      label={t("payroll.reimbursements.audit.submitted")}
                      at={selected.submittedAt.slice(0, 16).replace("T", " ")}
                    />
                    <AuditEntry
                      tone="muted"
                      label={t("payroll.reimbursements.audit.reviewed")}
                      at={
                        selected.approvedAt
                          ? selected.approvedAt.slice(0, 16).replace("T", " ")
                          : "—"
                      }
                    />
                    {selected.status === "approved" && (
                      <AuditEntry
                        tone="success"
                        label={t("payroll.reimbursements.audit.approved")}
                        at={
                          selected.approvedAt
                            ? selected.approvedAt.slice(0, 16).replace("T", " ")
                            : "—"
                        }
                      />
                    )}
                    {selected.status === "rejected" && (
                      <AuditEntry
                        tone="destructive"
                        label={t("payroll.reimbursements.audit.rejected")}
                        at={
                          selected.approvedAt
                            ? selected.approvedAt.slice(0, 16).replace("T", " ")
                            : "—"
                        }
                      />
                    )}
                  </ol>
                </TabsContent>

                <TabsContent value="comments" className="space-y-4">
                  <div className="space-y-3">
                    {mockCommentsFor(selected.status).map((c, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {c.author}
                          </span>
                          <span>{c.at}</span>
                        </div>
                        <p className="mt-1.5 text-sm">{c.text}</p>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Textarea
                      placeholder={t(
                        "payroll.reimbursements.commentsPlaceholder",
                      )}
                      rows={3}
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                    />
                    <Button
                      className="w-full"
                      disabled={commentDraft.trim().length === 0}
                      onClick={() => {
                        toast.success(
                          t("payroll.reimbursements.commentsSendToast"),
                        );
                        setCommentDraft("");
                      }}
                    >
                      <Send className="size-4" />
                      {t("common.send")}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AuditEntry({
  tone,
  label,
  at,
}: {
  tone: "info" | "muted" | "success" | "destructive";
  label: string;
  at: string;
}) {
  const dotClass =
    tone === "success"
      ? "bg-success"
      : tone === "destructive"
        ? "bg-destructive"
        : tone === "info"
          ? "bg-info"
          : "bg-muted-foreground";
  return (
    <li className="relative">
      <span
        className={cn(
          "absolute -left-[26px] top-1.5 inline-block size-2.5 rounded-full ring-2 ring-background",
          dotClass,
        )}
      />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{at}</p>
    </li>
  );
}
