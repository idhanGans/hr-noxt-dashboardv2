"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Plus, Trash2, Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import { fullName } from "@/lib/mock/data";
import { cn, formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useEmployees } from "@/lib/queries";
import type { PayslipLine } from "@/types";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type FormValues = {
  employeeId: string;
  period: string;
  status: "scheduled" | "processing" | "paid";
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreatePayslipDialog({ open, onOpenChange }: DialogProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: employees = [] } = useEmployees();

  const schema = useMemo(
    () =>
      z
        .object({
          employeeId: z.string().min(1, t("payroll.payslips.create.errEmployee")),
          period: z
            .string()
            .regex(PERIOD_RE, t("payroll.payslips.create.errPeriod")),
          status: z.enum(["scheduled", "processing", "paid"]),
          earnings: z
            .array(
              z.object({
                label: z
                  .string()
                  .min(1, t("payroll.payslips.create.errLineLabel")),
                amount: z
                  .number()
                  .positive(t("payroll.payslips.create.errLineAmount")),
              }),
            )
            .min(1, t("payroll.payslips.create.errEarningsMin")),
          deductions: z.array(
            z.object({
              label: z
                .string()
                .min(1, t("payroll.payslips.create.errLineLabel")),
              amount: z
                .number()
                .positive(t("payroll.payslips.create.errLineAmount")),
            }),
          ),
        })
        .refine(
          (d) => {
            const g = d.earnings.reduce((s, l) => s + l.amount, 0);
            const dx = d.deductions.reduce((s, l) => s + l.amount, 0);
            return g - dx >= 0;
          },
          {
            message: t("payroll.payslips.create.errNetNegative"),
            path: ["deductions"],
          },
        ),
    [t],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: "",
      period: "2026-05",
      status: "scheduled",
      earnings: [{ label: t("payroll.payslips.create.defaultBase"), amount: 0 }],
      deductions: [
        { label: t("payroll.payslips.create.defaultTax"), amount: 0 },
        { label: t("payroll.payslips.create.defaultSocial"), amount: 0 },
      ],
    },
    mode: "onChange",
  });

  const earningsFA = useFieldArray({ control: form.control, name: "earnings" });
  const deductionsFA = useFieldArray({
    control: form.control,
    name: "deductions",
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  const createPayslip = useMutation({
    mutationFn: async (values: FormValues) => {
      const gross = values.earnings.reduce((s, l) => s + l.amount, 0);
      const tax = values.deductions.reduce((s, l) => s + l.amount, 0);
      const net = gross - tax;

      const lines: PayslipLine[] = [
        ...values.earnings.map((l) => ({
          label: l.label,
          amount: Math.round(l.amount),
          type: "earning" as const,
        })),
        ...values.deductions.map((l) => ({
          label: l.label,
          amount: -Math.round(l.amount),
          type: "deduction" as const,
        })),
      ];

      const res = await fetch("/api/payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: values.employeeId, // employee code, resolved server-side
          period: values.period,
          gross: Math.round(gross),
          net: Math.round(net),
          tax: Math.round(tax),
          status: values.status,
          lines,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, values) => {
      void queryClient.invalidateQueries({ queryKey: ["payslips"] });
      const employee = employees.find((e) => e.id === values.employeeId);
      toast.success(
        t("payroll.payslips.create.toastCreated", {
          name: employee ? fullName(employee) : "",
          period: values.period,
        }),
      );
      handleOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: FormValues) {
    createPayslip.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("payroll.payslips.create.title")}</DialogTitle>
          <DialogDescription>
            {t("payroll.payslips.create.desc")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      {t("payroll.payslips.create.employee")}
                    </FormLabel>
                    <EmployeePicker value={field.value} onChange={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("payroll.payslips.create.period")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          "payroll.payslips.create.periodPlaceholder",
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("payroll.payslips.create.status")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="scheduled">
                        {t("payroll.payslips.statusScheduled")}
                      </SelectItem>
                      <SelectItem value="processing">
                        {t("payroll.payslips.statusProcessing")}
                      </SelectItem>
                      <SelectItem value="paid">
                        {t("payroll.payslips.statusPaid")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <LineArray
              control={form.control}
              name="earnings"
              fa={earningsFA}
              title={t("payroll.payslips.create.earnings")}
              addLabel={t("payroll.payslips.create.addLine")}
              labelHeader={t("payroll.payslips.create.lineLabel")}
              amountHeader={t("payroll.payslips.create.lineAmount")}
              removeAria={t("payroll.payslips.create.removeLine")}
              tone="positive"
              minOne
            />

            <LineArray
              control={form.control}
              name="deductions"
              fa={deductionsFA}
              title={t("payroll.payslips.create.deductions")}
              addLabel={t("payroll.payslips.create.addLine")}
              labelHeader={t("payroll.payslips.create.lineLabel")}
              amountHeader={t("payroll.payslips.create.lineAmount")}
              removeAria={t("payroll.payslips.create.removeLine")}
              tone="negative"
            />

            <Summary control={form.control} />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t("payroll.payslips.create.cancel")}
              </Button>
              <Button type="submit">
                {t("payroll.payslips.create.submit")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useT();
  const { data: employees = [] } = useEmployees();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => employees.find((e) => e.id === value),
    [value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${fullName(e)} ${e.email}`.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          {selected
            ? fullName(selected)
            : t("payroll.payslips.create.employeePlaceholder")}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b border-border p-2">
          <Input
            placeholder={t("payroll.payslips.create.employeeSearch")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <ScrollArea className="h-64">
          <ul className="p-1">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(e.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <span className="flex flex-col items-start">
                    <span>{fullName(e)}</span>
                    <span className="text-xs text-muted-foreground">
                      {e.department} · {e.title}
                    </span>
                  </span>
                  {e.id === value && <Check className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

type LineName = "earnings" | "deductions";

function LineArray({
  control,
  name,
  fa,
  title,
  addLabel,
  labelHeader,
  amountHeader,
  removeAria,
  tone,
  minOne,
}: {
  control: Control<FormValues>;
  name: LineName;
  fa: ReturnType<typeof useFieldArray<FormValues, LineName, "id">>;
  title: string;
  addLabel: string;
  labelHeader: string;
  amountHeader: string;
  removeAria: string;
  tone: "positive" | "negative";
  minOne?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fa.append({ label: "", amount: 0 })}
        >
          <Plus className="mr-1 size-4" />
          {addLabel}
        </Button>
      </div>
      <div className="space-y-2">
        {fa.fields.map((row, i) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr,140px,40px] items-start gap-2"
          >
            <FormField
              control={control}
              name={`${name}.${i}.label` as const}
              render={({ field }) => (
                <FormItem>
                  {i === 0 && (
                    <FormLabel className="text-xs">{labelHeader}</FormLabel>
                  )}
                  <FormControl>
                    <Input placeholder={labelHeader} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${name}.${i}.amount` as const}
              render={({ field }) => (
                <FormItem>
                  {i === 0 && (
                    <FormLabel className="text-xs">{amountHeader}</FormLabel>
                  )}
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      className={cn(
                        "font-mono text-right",
                        tone === "positive" && "text-success",
                        tone === "negative" && "text-destructive",
                      )}
                      placeholder="0.00"
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(e) => {
                        const v = e.target.valueAsNumber;
                        field.onChange(Number.isNaN(v) ? 0 : v);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={removeAria}
              className={cn("text-muted-foreground", i === 0 && "mt-6")}
              onClick={() => fa.remove(i)}
              disabled={fa.fields.length === 1 && Boolean(minOne)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Summary({ control }: { control: Control<FormValues> }) {
  const t = useT();
  const earnings = useWatch({ control, name: "earnings" });
  const deductions = useWatch({ control, name: "deductions" });

  const gross = (earnings ?? []).reduce(
    (s, l) => s + (Number.isFinite(l?.amount) ? l.amount : 0),
    0,
  );
  const tax = (deductions ?? []).reduce(
    (s, l) => s + (Number.isFinite(l?.amount) ? l.amount : 0),
    0,
  );
  const net = gross - tax;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {t("payroll.payslips.create.summaryGross")}
        </span>
        <span className="font-mono font-medium">{formatCurrency(gross)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {t("payroll.payslips.create.summaryTax")}
        </span>
        <span className="font-mono font-medium text-destructive">
          -{formatCurrency(tax)}
        </span>
      </div>
      <Separator />
      <div className="flex justify-between text-base font-semibold">
        <span>{t("payroll.payslips.create.summaryNet")}</span>
        <span
          className={cn(
            "font-mono",
            net < 0 ? "text-destructive" : "text-success",
          )}
        >
          {formatCurrency(net)}
        </span>
      </div>
    </div>
  );
}
