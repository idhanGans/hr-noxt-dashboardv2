"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Plus,
  ShieldCheck,
  Trash2,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import { DEPARTMENTS } from "@/config/options";
import { useQueryClient } from "@tanstack/react-query";
import { fullName } from "@/lib/mock/data";
import { useEmployees } from "@/lib/queries";
import { cn, formatNumber, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Employee } from "@/types";

// ---------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------

const LOCATION_POOL = ["Berlin", "München", "Hamburg", "Köln", "Wien", "Zürich", "Remote — DE"] as const;
const VIS_OPTIONS = ["public", "internal", "confidential"] as const;
const WORKPLACES = ["office", "hybrid", "remote"] as const;
const EMPLOYMENT_TYPES = ["full_time", "part_time", "contractor", "intern"] as const;
const SENIORITIES = ["junior", "mid", "senior", "lead", "head"] as const;
const LANGUAGES = ["de", "en", "fr", "es", "it", "other"] as const;
const LANG_LEVELS = ["A2", "B1", "B2", "C1", "C2"] as const;
const CHANNELS = ["karriere", "linkedin", "stepstone", "indeed", "internal"] as const;

const BIAS_WORDS = [
  "jung",
  "dynamisch",
  "rockstar",
  "guru",
  "ninja",
  "native speaker",
  "muttersprachler",
  "young",
  "energetic",
];

const AGG_BIAS_REGEX = /(rockstar|guru|jung|dynamisch|ninja|young|energetic)/i;
const AGG_SUFFIX_REGEX = /\(m\/w\/d\)\s*$/i;

const TODAY = "2026-05-30";

type StepKey = "step1" | "step2" | "step3" | "step4" | "step5";

interface WizardValues {
  // Step 1
  title: string;
  department: string;
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  seniority: (typeof SENIORITIES)[number];
  headcount: number;
  requiredStartDate: string;
  visibility: (typeof VIS_OPTIONS)[number];
  // Step 2
  workplaceModel: (typeof WORKPLACES)[number];
  locations: string[];
  travelPct: number;
  languages: { language: string; level: string }[];
  // Step 3
  salaryFrom: number;
  salaryTo: number;
  bonusTargetPct?: number;
  costCenter: string;
  budgetApprover: string;
  // Step 4
  description: string;
  mustHave: { value: string }[];
  niceToHave: { value: string }[];
  diversityStatement: string;
  // Step 5
  hiringManager: string;
  recruiter: string;
  interviewTeam: string[];
  interviewRounds: number;
  applicationDeadline: string;
  channels: string[];
}

const STEP_FIELDS: Record<number, Path<WizardValues>[]> = {
  0: [
    "title",
    "department",
    "employmentType",
    "seniority",
    "headcount",
    "requiredStartDate",
    "visibility",
  ],
  1: ["workplaceModel", "locations", "travelPct", "languages"],
  2: [
    "salaryFrom",
    "salaryTo",
    "bonusTargetPct",
    "costCenter",
    "budgetApprover",
  ],
  3: ["description", "mustHave", "niceToHave", "diversityStatement"],
  4: [
    "hiringManager",
    "recruiter",
    "interviewTeam",
    "interviewRounds",
    "applicationDeadline",
    "channels",
  ],
};

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export interface PostJobWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PostJobWizard({ open, onOpenChange }: PostJobWizardProps) {
  const t = useT();
  const { data: employees = [] } = useEmployees();
  const queryClient = useQueryClient();

  // Berechtigte Personen aus den Live-Daten.
  const managers = useMemo(
    () => employees.filter((e) => e.title === "Manager"),
    [employees],
  );
  const recruiters = useMemo(
    () => employees.filter((e) => e.department.startsWith("HR")),
    [employees],
  );

  // ----- Schema -----
  const req = t("common.required");
  const schema = z
    .object({
      title: z.string().min(2, req),
      department: z.string().min(1, req),
      employmentType: z.enum(EMPLOYMENT_TYPES, { message: req }),
      seniority: z.enum(SENIORITIES, { message: req }),
      headcount: z.number().min(1, req),
      requiredStartDate: z.string().min(1, req),
      visibility: z.enum(VIS_OPTIONS, { message: req }),

      workplaceModel: z.enum(WORKPLACES, { message: req }),
      locations: z.array(z.string()).min(1, req),
      travelPct: z.number().min(0).max(100),
      languages: z.array(
        z.object({
          language: z.string().min(1, req),
          level: z.string().min(1, req),
        }),
      ),

      salaryFrom: z.number().min(0, req),
      salaryTo: z.number().min(0, req),
      bonusTargetPct: z.number().min(0).max(100).optional(),
      costCenter: z.string().min(1, req),
      budgetApprover: z.string().min(1, req),

      description: z.string().superRefine((v, ctx) => {
        if (v.length < 80) {
          ctx.addIssue({
            code: "custom",
            // Live counter — message reflects the actual length at validation time.
            message: t("recruitment.post.descMinChars", { min: 80, current: v.length }),
          });
        }
      }),
      mustHave: z.array(z.object({ value: z.string().min(1, req) })),
      niceToHave: z.array(z.object({ value: z.string().min(1, req) })),
      diversityStatement: z.string().min(1, req),

      hiringManager: z.string().min(1, req),
      recruiter: z.string().min(1, req),
      interviewTeam: z.array(z.string()),
      interviewRounds: z.number().min(1).max(5),
      applicationDeadline: z.string().min(1, req),
      channels: z.array(z.string()).min(1, req),
    })
    .superRefine((d, ctx) => {
      if (d.salaryTo < d.salaryFrom) {
        ctx.addIssue({
          code: "custom",
          path: ["salaryTo"],
          message: t("recruitment.post.salaryRangeError"),
        });
      }
    });

  const defaults: WizardValues = useMemo(
    () => ({
      title: "",
      department: "",
      employmentType: "full_time",
      seniority: "senior",
      headcount: 1,
      requiredStartDate: "",
      visibility: "public",
      workplaceModel: "hybrid",
      locations: [],
      travelPct: 0,
      languages: [{ language: "de", level: "C2" }],
      salaryFrom: 0,
      salaryTo: 0,
      bonusTargetPct: undefined,
      costCenter: "",
      budgetApprover: "",
      description: "",
      mustHave: [{ value: "" }],
      niceToHave: [{ value: "" }],
      diversityStatement: t("recruitment.post.diversityDefault"),
      hiringManager: "",
      recruiter: "",
      interviewTeam: [],
      interviewRounds: 3,
      applicationDeadline: "",
      channels: ["karriere"],
    }),
    [t],
  );

  const form = useForm<WizardValues>({
    // RHF's resolver type is invariant; runtime behavior is correct.
    resolver: zodResolver(schema) as never,
    defaultValues: defaults,
    mode: "onChange",
  });

  const languagesFA = useFieldArray({ control: form.control, name: "languages" });
  const mustHaveFA = useFieldArray({ control: form.control, name: "mustHave" });
  const niceToHaveFA = useFieldArray({ control: form.control, name: "niceToHave" });

  const [step, setStep] = useState(0);

  function handleOpenChange(o: boolean) {
    onOpenChange(o);
    if (!o) {
      form.reset(defaults);
      setStep(0);
    }
  }

  async function handleNext() {
    const fields = STEP_FIELDS[step];
    const valid = await form.trigger(fields, { shouldFocus: false });
    if (!valid) {
      const errors = form.formState.errors as Record<string, unknown>;
      const firstBad = fields.find((f) => errors[f as string]);
      if (firstBad) {
        form.setFocus(firstBad);
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-wizard-field="${firstBad}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      return;
    }
    if (step < 4) setStep(step + 1);
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  function saveDraft() {
    toast.success(t("recruitment.post.toastDraft"));
    handleOpenChange(false);
  }

  // Publish gate — independent of step navigation.
  const watched = form.watch();
  const publishReady =
    watched.title.length >= 2 &&
    watched.department.length > 0 &&
    !!watched.employmentType &&
    watched.salaryFrom > 0 &&
    watched.salaryTo >= watched.salaryFrom &&
    watched.description.length >= 80 &&
    watched.hiringManager.length > 0;

  async function publish() {
    const values = form.getValues();
    const channelLabels: Record<string, string> = {
      karriere: t("recruitment.post.channelKarriere"),
      linkedin: t("recruitment.post.channelLinkedin"),
      stepstone: t("recruitment.post.channelStepStone"),
      indeed: t("recruitment.post.channelIndeed"),
      internal: t("recruitment.post.channelInternal"),
    };
    const body = values.channels
      .map((c) => `${channelLabels[c] ?? c} ✓`)
      .join(", ");

    // Stellentyp auf das Vacancy-Enum mappen (intern -> contractor).
    const typeMap: Record<string, "full_time" | "part_time" | "contractor"> = {
      full_time: "full_time",
      part_time: "part_time",
      contractor: "contractor",
      intern: "contractor",
    };
    try {
      const res = await fetch("/api/vacancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          department: values.department || undefined,
          location: values.locations[0] || undefined,
          type: typeMap[values.employmentType] ?? "full_time",
          workplaceModel: values.workplaceModel,
          salaryMin: values.salaryFrom || undefined,
          salaryMax: values.salaryTo || undefined,
          requiredStartDate: values.requiredStartDate || undefined,
          costCenter: values.costCenter || undefined,
          status: "open",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void queryClient.invalidateQueries({ queryKey: ["vacancies"] });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }

    toast.success(t("recruitment.post.toastPublishedTitle"), {
      description: t("recruitment.post.toastPublishedBody", { channels: body }),
    });
    handleOpenChange(false);
  }

  const stepTitles: Record<StepKey, string> = {
    step1: t("recruitment.post.step1"),
    step2: t("recruitment.post.step2"),
    step3: t("recruitment.post.step3"),
    step4: t("recruitment.post.step4"),
    step5: t("recruitment.post.step5"),
  };
  const stepLabels = [stepTitles.step1, stepTitles.step2, stepTitles.step3, stepTitles.step4, stepTitles.step5];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{t("recruitment.post.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("recruitment.post.dialogDesc")}</DialogDescription>
          <div className="pt-2">
            <Stepper step={step} labels={stepLabels} />
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form className="space-y-4 px-6 py-4">
              <div hidden={step !== 0}>
                <Step1 form={form} t={t} />
              </div>
              <div hidden={step !== 1}>
                <Step2 form={form} t={t} fa={languagesFA} />
              </div>
              <div hidden={step !== 2}>
                <Step3 form={form} t={t} managers={managers} />
              </div>
              <div hidden={step !== 3}>
                <Step4
                  form={form}
                  t={t}
                  mustHaveFA={mustHaveFA}
                  niceToHaveFA={niceToHaveFA}
                />
              </div>
              <div hidden={step !== 4}>
                <Step5
                  form={form}
                  t={t}
                  recruiters={recruiters}
                  employees={employees}
                />
              </div>
            </form>
          </Form>
        </ScrollArea>

        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
          <Button type="button" variant="outline" onClick={saveDraft}>
            {t("recruitment.post.draftBtn")}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              {t("recruitment.post.cancelBtn")}
            </Button>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                <ChevronLeft className="size-4" />
                {t("recruitment.post.backBtn")}
              </Button>
            )}
            {step < 4 && (
              <Button type="button" onClick={handleNext}>
                {t("recruitment.post.nextBtn")}
                <ChevronRight className="size-4" />
              </Button>
            )}
            {step === 4 && (
              <Button type="button" onClick={publish} disabled={!publishReady}>
                <ShieldCheck className="size-4" />
                {t("recruitment.post.publishBtn")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {labels.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full border px-2.5 py-1",
              active && "border-primary bg-primary/10 text-primary font-medium",
              done && "border-success bg-success/10 text-success",
              !active && !done && "border-border text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                active && "bg-primary text-primary-foreground",
                done && "bg-success text-success-foreground",
                !active && !done && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------
// Step 1 — Basis
// ---------------------------------------------------------------------

type T = (k: string, v?: Record<string, string | number>) => string;
type WizardForm = ReturnType<typeof useForm<WizardValues>>;

function Step1({ form, t }: { form: WizardForm; t: T }) {
  const title = form.watch("title");
  const missingSuffix = title.length > 0 && !AGG_SUFFIX_REGEX.test(title.trim());
  const biasMatch = title.match(AGG_BIAS_REGEX);

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem data-wizard-field="title">
            <FormLabel>{t("recruitment.post.fieldTitle")}</FormLabel>
            <FormControl>
              <Input
                placeholder={t("recruitment.post.titlePlaceholder")}
                {...field}
              />
            </FormControl>
            <FormMessage />
            {(missingSuffix || biasMatch) && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/[0.08] p-2.5 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <div className="space-y-1">
                  {biasMatch && (
                    <p>{t("recruitment.post.aggWarnTerm", { term: biasMatch[0] })}</p>
                  )}
                  {missingSuffix && <p>{t("recruitment.post.aggWarnSuffix")}</p>}
                </div>
              </div>
            )}
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem data-wizard-field="department">
              <FormLabel>{t("recruitment.post.fieldDept")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="employmentType"
          render={({ field }) => (
            <FormItem data-wizard-field="employmentType">
              <FormLabel>{t("recruitment.post.fieldType")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="full_time">{t("recruitment.post.typeFulltime")}</SelectItem>
                  <SelectItem value="part_time">{t("recruitment.post.typePartTime")}</SelectItem>
                  <SelectItem value="contractor">{t("recruitment.post.typeContractor")}</SelectItem>
                  <SelectItem value="intern">{t("recruitment.post.typeIntern")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FormField
          control={form.control}
          name="seniority"
          render={({ field }) => (
            <FormItem data-wizard-field="seniority" className="col-span-2">
              <FormLabel>{t("recruitment.post.fieldSeniority")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SENIORITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`recruitment.post.seniority${s.charAt(0).toUpperCase() + s.slice(1)}`)}
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
          name="headcount"
          render={({ field }) => (
            <FormItem data-wizard-field="headcount">
              <FormLabel>{t("recruitment.post.fieldHeadcount")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="requiredStartDate"
          render={({ field }) => (
            <FormItem data-wizard-field="requiredStartDate">
              <FormLabel>{t("recruitment.post.fieldStart")}</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="visibility"
        render={({ field }) => (
          <FormItem data-wizard-field="visibility">
            <FormLabel>{t("recruitment.post.fieldVisibility")}</FormLabel>
            <RadioGrid
              value={field.value}
              onChange={field.onChange}
              ariaLabel={t("recruitment.post.fieldVisibility")}
              options={VIS_OPTIONS.map((v) => ({
                value: v,
                label: t(`recruitment.post.vis${v.charAt(0).toUpperCase() + v.slice(1)}`),
              }))}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Step 2 — Standort & Setup
// ---------------------------------------------------------------------

function Step2({
  form,
  t,
  fa,
}: {
  form: WizardForm;
  t: T;
  fa: ReturnType<typeof useFieldArray<WizardValues, "languages">>;
}) {
  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="workplaceModel"
        render={({ field }) => (
          <FormItem data-wizard-field="workplaceModel">
            <FormLabel>{t("recruitment.post.fieldWorkplace")}</FormLabel>
            <RadioGrid
              value={field.value}
              onChange={field.onChange}
              ariaLabel={t("recruitment.post.fieldWorkplace")}
              options={WORKPLACES.map((w) => ({
                value: w,
                label: t(`recruitment.post.workplace${w.charAt(0).toUpperCase() + w.slice(1)}`),
              }))}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="locations"
        render={({ field }) => (
          <FormItem data-wizard-field="locations">
            <FormLabel>{t("recruitment.post.fieldLocations")}</FormLabel>
            <MultiCheckboxPopover
              values={field.value}
              onChange={field.onChange}
              options={LOCATION_POOL.map((l) => ({ value: l, label: l }))}
              placeholder={t("recruitment.post.locationsPlaceholder")}
              selectedTemplate={(n) => t("recruitment.post.locationsSelected", { n })}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="travelPct"
        render={({ field }) => (
          <FormItem data-wizard-field="travelPct">
            <FormLabel className="flex items-center justify-between">
              <span>{t("recruitment.post.fieldTravel")}</span>
              <Badge variant="muted">{field.value} %</Badge>
            </FormLabel>
            <FormControl>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                aria-label={t("recruitment.post.fieldTravel")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div data-wizard-field="languages" className="space-y-2">
        <FormLabel className="flex items-center justify-between">
          <span>{t("recruitment.post.fieldLanguages")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fa.append({ language: "en", level: "B2" })}
          >
            <Plus className="size-3.5" />
            {t("recruitment.post.addLanguage")}
          </Button>
        </FormLabel>
        {fa.fields.map((field, i) => (
          <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <FormField
              control={form.control}
              name={`languages.${i}.language`}
              render={({ field: f }) => (
                <FormItem>
                  <Select onValueChange={f.onChange} value={f.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {t(`recruitment.post.lang${l.charAt(0).toUpperCase() + l.slice(1)}`)}
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
              name={`languages.${i}.level`}
              render={({ field: f }) => (
                <FormItem>
                  <Select onValueChange={f.onChange} value={f.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder={t("recruitment.post.langLevel")} /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LANG_LEVELS.map((lv) => (
                        <SelectItem key={lv} value={lv}>{lv}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => fa.remove(i)}
              disabled={fa.fields.length <= 1}
              aria-label={t("recruitment.post.removeLanguage")}
              className="mt-1.5"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Step 3 — Vergütung & Budget
// ---------------------------------------------------------------------

function Step3({
  form,
  t,
  managers,
}: {
  form: WizardForm;
  t: T;
  managers: Employee[];
}) {
  const salaryTo = form.watch("salaryTo");
  const headcount = form.watch("headcount");
  const volume = (salaryTo ?? 0) * (headcount ?? 0);
  const cfoRequired = volume > 1_700_000_000;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="salaryFrom"
          render={({ field }) => (
            <FormItem data-wizard-field="salaryFrom">
              <FormLabel>{t("recruitment.post.fieldSalaryFrom")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={1_000_000}
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="salaryTo"
          render={({ field }) => (
            <FormItem data-wizard-field="salaryTo">
              <FormLabel>{t("recruitment.post.fieldSalaryTo")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={1_000_000}
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-info/40 bg-info/[0.06] p-2.5 text-xs">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-info" />
        <p>{t("recruitment.post.salaryHelper")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="bonusTargetPct"
          render={({ field }) => (
            <FormItem data-wizard-field="bonusTargetPct">
              <FormLabel>{t("recruitment.post.fieldBonus")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="costCenter"
          render={({ field }) => (
            <FormItem data-wizard-field="costCenter">
              <FormLabel>{t("recruitment.post.fieldCostCenter")}</FormLabel>
              <FormControl>
                <Input placeholder="CC-4200" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="budgetApprover"
        render={({ field }) => (
          <FormItem data-wizard-field="budgetApprover">
            <FormLabel>{t("recruitment.post.fieldApprover")}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-72">
                {managers.length === 0 ? (
                  <SelectItem value="—" disabled>—</SelectItem>
                ) : (
                  managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {fullName(m)} · {m.department}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Approval chain preview */}
      <Card className="bg-muted/30">
        <CardContent className="space-y-1.5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("recruitment.post.approvalChainTitle")}
          </p>
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            <ChainPill index={1} label={t("recruitment.post.approvalChainHiringMgr")} />
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <ChainPill index={2} label={t("recruitment.post.approvalChainDeptHead")} />
            {cfoRequired && (
              <>
                <ChevronRight className="size-3.5 text-muted-foreground" />
                <ChainPill
                  index={3}
                  label={t("recruitment.post.approvalChainCfo")}
                  hint={t("recruitment.post.approvalChainCfoHint")}
                  tone="warning"
                />
              </>
            )}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function ChainPill({
  index,
  label,
  hint,
  tone = "default",
}: {
  index: number;
  label: string;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        tone === "default" && "border-border bg-card",
        tone === "warning" && "border-warning/40 bg-warning/[0.08] text-warning",
      )}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
          tone === "default" && "bg-muted text-muted-foreground",
          tone === "warning" && "bg-warning text-warning-foreground",
        )}
      >
        {index}
      </span>
      <span className="font-medium">{label}</span>
      {hint && <span className="text-[10px] text-muted-foreground">· {hint}</span>}
    </li>
  );
}

// ---------------------------------------------------------------------
// Step 4 — Inhalt (description, lists, bias check)
// ---------------------------------------------------------------------

function Step4({
  form,
  t,
  mustHaveFA,
  niceToHaveFA,
}: {
  form: WizardForm;
  t: T;
  mustHaveFA: ReturnType<typeof useFieldArray<WizardValues, "mustHave">>;
  niceToHaveFA: ReturnType<typeof useFieldArray<WizardValues, "niceToHave">>;
}) {
  const desc = form.watch("description");
  const title = form.watch("title");
  const mustHaves = form.watch("mustHave");
  const niceToHaves = form.watch("niceToHave");

  // Live bias scan across title + description + lists.
  const haystack = [
    title,
    desc,
    ...mustHaves.map((m) => m.value),
    ...niceToHaves.map((n) => n.value),
  ]
    .join(" ")
    .toLowerCase();
  const biasHits = BIAS_WORDS.filter((w) => haystack.includes(w.toLowerCase()));

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem data-wizard-field="description">
            <FormLabel className="flex items-center justify-between">
              <span>{t("recruitment.post.fieldDescription")}</span>
              <Badge
                variant={desc.length >= 80 ? "success" : "muted"}
                className="font-mono"
              >
                {desc.length} / 80
              </Badge>
            </FormLabel>
            <FormControl>
              <Textarea
                rows={8}
                placeholder={t("recruitment.post.descPlaceholder")}
                {...field}
              />
            </FormControl>
            <FormMessage />
            {/* TODO: swap to TipTap rich-text editor */}
          </FormItem>
        )}
      />

      <ArrayFieldList
        t={t}
        fa={mustHaveFA}
        form={form}
        name="mustHave"
        label={t("recruitment.post.fieldMustHave")}
      />
      <ArrayFieldList
        t={t}
        fa={niceToHaveFA}
        form={form}
        name="niceToHave"
        label={t("recruitment.post.fieldNiceToHave")}
      />

      <FormField
        control={form.control}
        name="diversityStatement"
        render={({ field }) => (
          <FormItem data-wizard-field="diversityStatement">
            <FormLabel>{t("recruitment.post.fieldDiversity")}</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Live bias check */}
      <Card
        className={cn(
          biasHits.length > 0
            ? "border-warning/40 bg-warning/[0.06]"
            : "border-success/30 bg-success/[0.04]",
        )}
      >
        <CardContent className="space-y-1.5 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            <AlertTriangle
              className={cn(
                "size-3.5",
                biasHits.length > 0 ? "text-warning" : "text-success",
              )}
            />
            {t("recruitment.post.biasCheckTitle")}
          </p>
          {biasHits.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("recruitment.post.biasCheckClean")}
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {biasHits.map((w) => (
                <li key={w} className="flex flex-wrap items-baseline gap-2">
                  <Badge variant="warning">{w}</Badge>
                  <span className="text-muted-foreground">
                    {t("recruitment.post.biasCheckSuggestion")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ArrayFieldList({
  t,
  fa,
  form,
  name,
  label,
}: {
  t: T;
  fa: ReturnType<typeof useFieldArray<WizardValues, "mustHave" | "niceToHave">>;
  form: WizardForm;
  name: "mustHave" | "niceToHave";
  label: string;
}) {
  return (
    <div data-wizard-field={name} className="space-y-2">
      <FormLabel className="flex items-center justify-between">
        <span>{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fa.append({ value: "" })}
        >
          <Plus className="size-3.5" />
          {t("recruitment.post.addItem")}
        </Button>
      </FormLabel>
      {fa.fields.map((field, i) => (
        <div key={field.id} className="flex items-start gap-2">
          <FormField
            control={form.control}
            name={`${name}.${i}.value`}
            render={({ field: f }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input {...f} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => fa.remove(i)}
            disabled={fa.fields.length <= 1}
            aria-label={t("recruitment.post.removeItem")}
            className="mt-1"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Step 5 — Prozess & Veröffentlichung
// ---------------------------------------------------------------------

function Step5({
  form,
  t,
  recruiters,
  employees,
}: {
  form: WizardForm;
  t: T;
  recruiters: Employee[];
  employees: Employee[];
}) {
  const values = form.watch();
  const interviewTeam = values.interviewTeam ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="hiringManager"
          render={({ field }) => (
            <FormItem data-wizard-field="hiringManager">
              <FormLabel>{t("recruitment.post.fieldHiringMgr")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-72">
                  {employees.slice(0, 60).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {fullName(e)} · {e.department}
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
          name="recruiter"
          render={({ field }) => (
            <FormItem data-wizard-field="recruiter">
              <FormLabel>{t("recruitment.post.fieldRecruiter")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-72">
                  {recruiters.length === 0 ? (
                    <SelectItem value="—" disabled>—</SelectItem>
                  ) : (
                    recruiters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {fullName(r)} · {r.department}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="interviewTeam"
        render={({ field }) => (
          <FormItem data-wizard-field="interviewTeam">
            <FormLabel>{t("recruitment.post.fieldInterviewTeam")}</FormLabel>
            <MultiCheckboxPopover
              values={field.value}
              onChange={field.onChange}
              placeholder={t("recruitment.post.interviewTeamPlaceholder")}
              selectedTemplate={(n) => t("recruitment.post.locationsSelected", { n })}
              options={employees.slice(0, 60).map((e) => ({
                value: e.id,
                label: `${fullName(e)} · ${e.department}`,
              }))}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="interviewRounds"
          render={({ field }) => (
            <FormItem data-wizard-field="interviewRounds">
              <FormLabel>{t("recruitment.post.fieldRounds")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="applicationDeadline"
          render={({ field }) => (
            <FormItem data-wizard-field="applicationDeadline">
              <FormLabel>{t("recruitment.post.fieldDeadline")}</FormLabel>
              <FormControl>
                <Input type="date" min={TODAY} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="channels"
        render={({ field }) => (
          <FormItem data-wizard-field="channels">
            <FormLabel>{t("recruitment.post.fieldChannels")}</FormLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CHANNELS.map((c) => {
                const checked = field.value.includes(c);
                return (
                  <label
                    key={c}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted",
                      checked && "border-primary bg-primary/[0.04]",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...field.value, c]
                          : field.value.filter((x: string) => x !== c);
                        field.onChange(next);
                      }}
                    />
                    <span className="text-sm">
                      {t(`recruitment.post.channel${c.charAt(0).toUpperCase() + c.slice(1)}`)}
                    </span>
                  </label>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator />

      <PreviewCard
        values={values}
        interviewTeamCount={interviewTeam.length}
        t={t}
        employees={employees}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------

function PreviewCard({
  values,
  interviewTeamCount,
  t,
  employees,
}: {
  values: WizardValues;
  interviewTeamCount: number;
  t: T;
  employees: Employee[];
}) {
  const hm = employees.find((e) => e.id === values.hiringManager);
  const recruiter = employees.find((e) => e.id === values.recruiter);
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("recruitment.post.previewTitle")}
            </p>
            <p className="font-display text-lg font-semibold">
              {values.title || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("recruitment.post.previewDept")}: {values.department || "—"}
              {" · "}
              {t("recruitment.post.previewLocation")}: {values.locations.join(", ") || "—"}
              {" · "}
              {t("recruitment.post.previewWorkplace")}:{" "}
              {values.workplaceModel
                ? t(`recruitment.post.workplace${values.workplaceModel.charAt(0).toUpperCase() + values.workplaceModel.slice(1)}`)
                : "—"}
            </p>
          </div>
          {values.salaryFrom > 0 && values.salaryTo > 0 && (
            <Badge variant="success" className="shrink-0 font-mono">
              {t("recruitment.post.previewSalary", {
                min: formatNumber(values.salaryFrom),
                max: formatNumber(values.salaryTo),
              })}
            </Badge>
          )}
        </div>
        {values.description && (
          <p className="text-sm whitespace-pre-line">{values.description}</p>
        )}
        {values.mustHave.some((m) => m.value) && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("recruitment.post.previewMustHave")}
            </p>
            <ul className="ml-4 list-disc text-sm">
              {values.mustHave.filter((m) => m.value).map((m, i) => (
                <li key={i}>{m.value}</li>
              ))}
            </ul>
          </div>
        )}
        {values.niceToHave.some((n) => n.value) && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("recruitment.post.previewNiceToHave")}
            </p>
            <ul className="ml-4 list-disc text-sm">
              {values.niceToHave.filter((n) => n.value).map((n, i) => (
                <li key={i}>{n.value}</li>
              ))}
            </ul>
          </div>
        )}
        {values.diversityStatement && (
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs italic">
            {values.diversityStatement}
          </p>
        )}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("recruitment.post.previewProcess")}
          </p>
          <p className="text-sm">
            {t("recruitment.post.previewProcessText", {
              rounds: values.interviewRounds,
              deadline: values.applicationDeadline || "—",
            })}
            {" · "}
            {interviewTeamCount}× {t("recruitment.post.fieldInterviewTeam")}
          </p>
          {(hm || recruiter) && (
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              {hm && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials(`${hm.firstName} ${hm.lastName}`)}
                  </span>
                  {t("recruitment.post.fieldHiringMgr")}: {hm.firstName} {hm.lastName}
                </span>
              )}
              {recruiter && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials(`${recruiter.firstName} ${recruiter.lastName}`)}
                  </span>
                  {t("recruitment.post.fieldRecruiter")}: {recruiter.firstName} {recruiter.lastName}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Generic helpers: RadioGrid + MultiCheckboxPopover
// ---------------------------------------------------------------------

function RadioGrid({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-3 gap-2"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg border p-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer text-left",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiCheckboxPopover({
  values,
  onChange,
  options,
  placeholder,
  selectedTemplate,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  selectedTemplate: (n: number) => string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-between"
        >
          <span className="truncate">
            {values.length === 0
              ? placeholder
              : selectedTemplate(values.length)}
          </span>
          {values.length > 0 && (
            <Badge variant="muted" className="ml-2">
              {values.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <ScrollArea className="max-h-72">
          <div className="space-y-1 p-2">
            {options.map((o) => {
              const checked = values.includes(o.value);
              return (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm transition-colors hover:bg-muted",
                    checked && "bg-muted/60",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const next = v
                        ? [...values, o.value]
                        : values.filter((x) => x !== o.value);
                      onChange(next);
                    }}
                  />
                  <span className="truncate">{o.label}</span>
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
