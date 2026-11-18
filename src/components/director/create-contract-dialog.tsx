"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  FileSignature,
} from "lucide-react";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

import { fullName } from "@/lib/mock/data";
import { useContractTemplates, useEmployees } from "@/lib/queries";
import { cn, formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { ContractStatus, ContractTemplate } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type FormValues = {
  templateId: string;
  employeeId: string;
  jobTitle: string;
  startDate: string;
  permanent: boolean;
  endDate: string;
  hoursPerWeek: number;
  salary: number;
  noticePeriodWeeks: number;
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional vorgewähltes Template (z. B. wenn aus QuickAction gestartet). */
  defaultTemplateId?: string;
};

const CONTRACT_TODAY = new Date(Date.UTC(2026, 5, 5));

function deriveStatus(endDate: string | null): ContractStatus {
  if (!endDate) return "active";
  const end = new Date(endDate);
  const diff = Math.round(
    (end.getTime() - CONTRACT_TODAY.getTime()) / 86_400_000,
  );
  if (diff < 0) return "expired";
  if (diff <= 60) return "expiring_soon";
  return "active";
}

export function CreateContractDialog({
  open,
  onOpenChange,
  defaultTemplateId,
}: DialogProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: employees = [] } = useEmployees();
  const { data: contractTemplates = [] } = useContractTemplates();
  const [step, setStep] = useState(0);

  const schema = useMemo(
    () =>
      z
        .object({
          templateId: z
            .string()
            .min(1, t("director.contracts.create.errTemplate")),
          employeeId: z
            .string()
            .min(1, t("director.contracts.create.errEmployee")),
          jobTitle: z.string().min(1, t("common.required")),
          startDate: z
            .string()
            .regex(DATE_RE, t("director.contracts.create.errStart")),
          permanent: z.boolean(),
          endDate: z.string(),
          hoursPerWeek: z
            .number()
            .min(0, t("director.contracts.create.errHours")),
          salary: z
            .number()
            .positive(t("director.contracts.create.errSalary")),
          noticePeriodWeeks: z
            .number()
            .min(0, t("director.contracts.create.errNotice")),
        })
        .refine(
          (d) => d.permanent || DATE_RE.test(d.endDate),
          {
            message: t("director.contracts.create.errEnd"),
            path: ["endDate"],
          },
        )
        .refine(
          (d) => {
            if (d.permanent || !DATE_RE.test(d.endDate)) return true;
            return Date.parse(d.endDate) > Date.parse(d.startDate);
          },
          {
            message: t("director.contracts.create.errEndBeforeStart"),
            path: ["endDate"],
          },
        ),
    [t],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      templateId: defaultTemplateId ?? "",
      employeeId: "",
      jobTitle: "",
      startDate: "2026-06-15",
      permanent: true,
      endDate: "",
      hoursPerWeek: 40,
      salary: 60000,
      noticePeriodWeeks: 4,
    },
    mode: "onChange",
  });

  const templateId = form.watch("templateId");
  const employeeId = form.watch("employeeId");
  const permanent = form.watch("permanent");

  const selectedTemplate = useMemo(
    () => contractTemplates.find((t) => t.id === templateId),
    [templateId],
  );
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employeeId],
  );

  // Apply template defaults when a template is selected.
  React.useEffect(() => {
    if (!selectedTemplate) return;
    form.setValue("hoursPerWeek", selectedTemplate.hoursPerWeek, {
      shouldDirty: false,
    });
    form.setValue("noticePeriodWeeks", selectedTemplate.noticePeriodWeeks, {
      shouldDirty: false,
    });
    form.setValue("permanent", selectedTemplate.type === "permanent", {
      shouldDirty: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?.id]);

  // Prefill jobTitle from employee.
  React.useEffect(() => {
    if (!selectedEmployee) return;
    form.setValue("jobTitle", selectedEmployee.jobTitle, { shouldDirty: false });
    form.setValue("salary", selectedEmployee.salary, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee?.id]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
      setStep(0);
    }
    onOpenChange(next);
  }

  async function handleNext() {
    let fieldsToValidate: (keyof FormValues)[] = [];
    if (step === 0) fieldsToValidate = ["templateId", "employeeId"];
    if (step === 1)
      fieldsToValidate = [
        "jobTitle",
        "startDate",
        "endDate",
        "permanent",
        "hoursPerWeek",
        "salary",
        "noticePeriodWeeks",
      ];
    const ok = await form.trigger(fieldsToValidate);
    if (ok) setStep((s) => s + 1);
  }

  const createContract = useMutation({
    mutationFn: async (payload: {
      body: Record<string, unknown>;
      employeeName: string;
      templateName: string;
    }) => {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, payload) => {
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(
        t("director.contracts.create.toastCreated", {
          name: payload.employeeName,
          template: payload.templateName,
        }),
      );
      handleOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: FormValues) {
    if (!selectedEmployee || !selectedTemplate) return;
    const end = values.permanent ? null : values.endDate;
    createContract.mutate({
      employeeName: fullName(selectedEmployee),
      templateName: selectedTemplate.name,
      body: {
        employeeId: values.employeeId, // employee code — resolved server-side
        jobTitle: values.jobTitle,
        type: selectedTemplate.type,
        status: deriveStatus(end),
        startDate: values.startDate,
        endDate: end,
        salary: values.salary,
        hoursPerWeek: values.hoursPerWeek,
        noticePeriodWeeks: values.noticePeriodWeeks,
        templateName: selectedTemplate.name, // resolved to id server-side
        signedAt: values.startDate,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("director.contracts.create.title")}</DialogTitle>
          <DialogDescription>
            {t("director.contracts.create.desc")}
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} t={t} />

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-2 space-y-5"
          >
            {step === 0 && (
              <StepTemplate
                form={form}
                selectedTemplate={selectedTemplate}
                selectedEmployeeName={selectedEmployee && fullName(selectedEmployee)}
              />
            )}

            {step === 1 && <StepConditions form={form} permanent={permanent} />}

            {step === 2 && (
              <StepReview
                form={form}
                selectedTemplate={selectedTemplate}
                selectedEmployeeName={
                  selectedEmployee ? fullName(selectedEmployee) : "—"
                }
              />
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => (step === 0 ? handleOpenChange(false) : setStep((s) => s - 1))}
              >
                {step === 0 ? (
                  t("director.contracts.create.cancel")
                ) : (
                  <>
                    <ChevronLeft className="mr-1 size-4" />
                    {t("director.contracts.create.back")}
                  </>
                )}
              </Button>
              {step < 2 ? (
                <Button type="button" onClick={handleNext}>
                  {t("director.contracts.create.next")}
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button type="submit">
                  <FileSignature className="mr-2 size-4" />
                  {t("director.contracts.create.submit")}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step, t }: { step: number; t: (k: string) => string }) {
  const labels = [
    t("director.contracts.create.step1"),
    t("director.contracts.create.step2"),
    t("director.contracts.create.step3"),
  ];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                i < step && "bg-success/15 text-success",
                i === step && "bg-primary text-primary-foreground",
                i > step && "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                i === step ? "font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <Separator className="flex-1" orientation="horizontal" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function StepTemplate({
  form,
  selectedTemplate,
  selectedEmployeeName,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  selectedTemplate?: ContractTemplate;
  selectedEmployeeName?: string;
}) {
  const t = useT();
  const { data: contractTemplates = [] } = useContractTemplates();
  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="employeeId"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>{t("director.contracts.create.employee")}</FormLabel>
            <EmployeePicker
              value={field.value}
              onChange={field.onChange}
              displayName={selectedEmployeeName}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="templateId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("director.contracts.create.template")}</FormLabel>
            <FormMessage />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {contractTemplates.map((tpl) => {
                const selected = field.value === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => field.onChange(tpl.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/8"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-medium">{tpl.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {tpl.hoursPerWeek > 0
                          ? `${tpl.hoursPerWeek} h/Wo.`
                          : "flexibel"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {tpl.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </FormItem>
        )}
      />

      {selectedTemplate && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("director.contracts.create.templateClauses")}
          </p>
          <ul className="space-y-1 text-sm">
            {selectedTemplate.clauses.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepConditions({
  form,
  permanent,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  permanent: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="jobTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("director.contracts.create.jobTitle")}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("director.contracts.create.startDate")}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("director.contracts.create.endDate")}</FormLabel>
              <FormControl>
                <Input type="date" disabled={permanent} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="permanent"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
            <FormLabel className="!mt-0">
              {t("director.contracts.create.permanentToggle")}
            </FormLabel>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="hoursPerWeek"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("director.contracts.create.hours")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  className="font-mono text-right"
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
        <FormField
          control={form.control}
          name="salary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("director.contracts.create.salary")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={500}
                  className="font-mono text-right"
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
        <FormField
          control={form.control}
          name="noticePeriodWeeks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("director.contracts.create.notice")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={52}
                  step={1}
                  className="font-mono text-right"
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
      </div>
    </div>
  );
}

function StepReview({
  form,
  selectedTemplate,
  selectedEmployeeName,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  selectedTemplate?: ContractTemplate;
  selectedEmployeeName: string;
}) {
  const t = useT();
  const values = form.watch();
  const rows: Array<[string, React.ReactNode]> = [
    [t("director.contracts.create.employee"), selectedEmployeeName],
    [t("director.contracts.create.template"), selectedTemplate?.name ?? "—"],
    [t("director.contracts.create.jobTitle"), values.jobTitle],
    [t("director.contracts.create.startDate"), values.startDate],
    [
      t("director.contracts.create.endDate"),
      values.permanent ? "—" : values.endDate,
    ],
    [
      t("director.contracts.create.hours"),
      `${values.hoursPerWeek} h`,
    ],
    [
      t("director.contracts.create.salary"),
      formatCurrency(values.salary),
    ],
    [
      t("director.contracts.create.notice"),
      `${values.noticePeriodWeeks} Wo.`,
    ],
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border">
        <div className="border-b border-border bg-muted/40 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide">
            {t("director.contracts.create.review")}
          </p>
        </div>
        <div className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedTemplate && (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("director.contracts.create.templateClauses")}
          </p>
          <ul className="space-y-1 text-sm">
            {selectedTemplate.clauses.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EmployeePicker({
  value,
  onChange,
  displayName,
}: {
  value: string;
  onChange: (id: string) => void;
  displayName?: string;
}) {
  const t = useT();
  const { data: employees = [] } = useEmployees();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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
            !value && "text-muted-foreground",
          )}
        >
          {displayName ?? t("director.contracts.create.employeePh")}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <div className="border-b border-border p-2">
          <Input
            placeholder={t("director.contracts.create.searchPh")}
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
