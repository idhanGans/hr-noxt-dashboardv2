"use client";

import * as React from "react";
import {
  useForm,
  useWatch,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Search,
  Sparkles,
  AlertCircle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { cn, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useEmployees } from "@/lib/queries";
import { DEPARTMENTS, JOB_TITLES, TITLES } from "@/config/options";
import { isValidIban, deriveBicFromIban, normalizeIban } from "@/lib/iban";
import type { Employee } from "@/types";

// --- options ---------------------------------------------------------------

const GENDER = ["m", "f", "d"] as const;
const CONTRACT_TYPES = [
  "permanent",
  "fixed_term",
  "part_time",
  "working_student",
  "intern",
  "mini_job",
] as const;
const WORKPLACE = ["office", "hybrid", "remote"] as const;
const NOTICE_KEYS = [
  "4w_eom",
  "1m_eom",
  "2m_eom",
  "3m_eom",
  "4m_eom",
  "5m_eom",
  "6m_eoq",
] as const;
const RELIGION = ["rk", "ev", "keine", "sonst"] as const;
const INSURANCE = ["statutory", "private"] as const;
const TAX_CLASSES = [1, 2, 3, 4, 5, 6] as const;
const COUNTRIES = [
  "DE", "AT", "CH", "NL", "BE", "LU", "FR", "ES", "IT", "PT",
  "PL", "CZ", "SK", "HU", "RO", "BG", "HR", "SI", "GR", "SE",
  "NO", "DK", "FI", "IE", "GB", "TR", "ID", "UA", "US", "OTHER",
] as const;
const TRAININGS = [
  { id: "Datenschutz", labelKey: "people.add.trainingDatenschutz" },
  { id: "Arbeitssicherheit", labelKey: "people.add.trainingArbeitssicherheit" },
  { id: "Compliance Code of Conduct", labelKey: "people.add.trainingCompliance" },
  { id: "Brandschutz", labelKey: "people.add.trainingBrandschutz" },
  { id: "Erste Hilfe", labelKey: "people.add.trainingErsteHilfe" },
  { id: "Phishing-Awareness", labelKey: "people.add.trainingPhishing" },
];
const ASSETS = [
  { id: "Laptop", labelKey: "people.add.assetLaptop" },
  { id: "Phone", labelKey: "people.add.assetPhone" },
  { id: "Access card", labelKey: "people.add.assetAccessCard" },
  { id: "Monitor", labelKey: "people.add.assetMonitor" },
  { id: "Headset", labelKey: "people.add.assetHeadset" },
  { id: "Docking station", labelKey: "people.add.assetDocking" },
];

// --- schema ----------------------------------------------------------------

function addMonths(iso: string, months: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function makeSchema(t: (k: string, v?: Record<string, string | number>) => string) {
  const required = t("common.required");
  return z
    .object({
      // step 1
      firstName: z.string().min(2, required),
      lastName: z.string().min(2, required),
      dateOfBirth: z.string().min(1, required),
      gender: z.enum(GENDER, { message: required }),
      nationality: z.enum(COUNTRIES, { message: required }),
      email: z.string().email(t("people.employees.form.emailInvalid")),
      phone: z
        .string()
        .regex(/^\+[1-9]\d{6,14}$/, t("people.employees.form.emailInvalid")),
      street: z.string().min(2, required),
      zip: z.string().min(3, required),
      city: z.string().min(2, required),
      country: z.enum(COUNTRIES, { message: required }),
      emergencyContactName: z.string().min(2, required),
      emergencyContactPhone: z
        .string()
        .regex(/^\+[1-9]\d{6,14}$/, t("people.employees.form.emailInvalid")),
      emergencyContactRelation: z.string().min(2, required),

      // step 2
      contractType: z.enum(CONTRACT_TYPES, { message: required }),
      contractStart: z.string().min(1, required),
      contractEnd: z.string().optional().or(z.literal("")),
      probationEnd: z.string().min(1, required),
      weeklyHours: z.coerce.number().min(0).max(48),
      vacationEntitlement: z.coerce.number().min(0).max(60),
      noticePeriod: z.enum(NOTICE_KEYS, { message: required }),
      workplaceModel: z.enum(WORKPLACE, { message: required }),
      location: z.string().min(2, required),
      title: z.enum(TITLES, { message: required }),
      department: z.enum(DEPARTMENTS, { message: required }),
      jobTitle: z.string().min(2, required),
      managerId: z.string().optional().or(z.literal("")),

      // step 3
      salary: z.coerce.number().min(0).max(10_000_000),
      bonusTargetPct: z.coerce.number().min(0).max(100),
      taxId: z
        .string()
        .regex(/^\d{2}\s\d{3}\s\d{3}\s\d{3}$/, required),
      socialSecurityNo: z.string().min(12, required).max(12, required),
      taxClass: z.coerce
        .number()
        .refine((n) => TAX_CLASSES.includes(n as 1 | 2 | 3 | 4 | 5 | 6), {
          message: required,
        }),
      children: z.coerce.number().min(0).max(10),
      religion: z.enum(RELIGION, { message: required }),
      healthInsuranceType: z.enum(INSURANCE, { message: required }),
      healthInsuranceProvider: z.string().min(2, required),
      iban: z
        .string()
        .min(1, required)
        .refine((v) => isValidIban(v), { message: "errIbanInvalid" }),
      bic: z.string().min(6, required),
      costCenter: z.string().min(2, required),

      // step 4
      buddyId: z.string().optional().or(z.literal("")),
      requiredTrainings: z.array(z.string()).min(1, required),
      provisionedAssets: z.array(z.string()).min(1, required),
    })
    .superRefine((data, ctx) => {
      if (data.contractType === "fixed_term" && !data.contractEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contractEnd"],
          message: required,
        });
      }
    });
}

type WizardValues = z.infer<ReturnType<typeof makeSchema>>;

// Field-grouping used by per-step validation and focus-first-invalid.
const STEP_FIELDS: Array<Array<Path<WizardValues>>> = [
  // step 1
  [
    "firstName",
    "lastName",
    "dateOfBirth",
    "gender",
    "nationality",
    "email",
    "phone",
    "street",
    "zip",
    "city",
    "country",
    "emergencyContactName",
    "emergencyContactPhone",
    "emergencyContactRelation",
  ],
  // step 2
  [
    "contractType",
    "contractStart",
    "contractEnd",
    "probationEnd",
    "weeklyHours",
    "vacationEntitlement",
    "noticePeriod",
    "workplaceModel",
    "location",
    "title",
    "department",
    "jobTitle",
    "managerId",
  ],
  // step 3
  [
    "salary",
    "bonusTargetPct",
    "taxId",
    "socialSecurityNo",
    "taxClass",
    "children",
    "religion",
    "healthInsuranceType",
    "healthInsuranceProvider",
    "iban",
    "bic",
    "costCenter",
  ],
  // step 4
  ["buddyId", "requiredTrainings", "provisionedAssets"],
];

// --- helpers ---------------------------------------------------------------

function StepDots({
  current,
  labels,
}: {
  current: number;
  labels: string[];
}) {
  return (
    <ol
      className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto"
      aria-label="Wizard steps"
    >
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-2 shrink-0"
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-[11px] font-semibold transition-colors",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary/15 text-primary ring-2 ring-primary/40",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden sm:inline text-xs font-medium whitespace-nowrap",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "hidden sm:block h-px w-6 lg:w-12",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface ManagerSelectProps {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  employees: Employee[];
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
}

function ManagerCombobox({
  value,
  onChange,
  employees,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
}: ManagerSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = React.useMemo(
    () => employees.find((e) => e.id === value),
    [employees, value],
  );

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? employees.filter((e) =>
          `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(q),
        )
      : employees;
    return pool.slice(0, 50);
  }, [employees, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              <Avatar className="size-5">
                <AvatarFallback className="text-[9px]">
                  {initials(`${selected.firstName} ${selected.lastName}`)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {selected.firstName} {selected.lastName}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronRight className="size-3.5 rotate-90 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Search className="size-3.5 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label={searchPlaceholder}
          />
        </div>
        <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {noResultsLabel}
            </li>
          ) : (
            matches.map((emp) => (
              <li key={emp.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={emp.id === value}
                  onClick={() => {
                    onChange(emp.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                    emp.id === value && "bg-muted",
                  )}
                >
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">
                      {initials(`${emp.firstName} ${emp.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {emp.jobTitle} · {emp.department}
                    </p>
                  </div>
                  {emp.id === value && <Check className="size-3.5 text-primary" />}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// Tax-ID auto-formatter: keep only digits, insert spaces at 2/5/8 positions.
function formatTaxId(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 11),
  ].filter(Boolean);
  return parts.join(" ");
}

// --- main component --------------------------------------------------------

export interface AddEmployeeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEmployeeWizard({ open, onOpenChange }: AddEmployeeWizardProps) {
  const t = useT();
  const { data: employeesData } = useEmployees();
  const employeesList = employeesData ?? [];

  const schema = React.useMemo(() => makeSchema(t), [t]);

  const defaults = React.useMemo<WizardValues>(
    () => ({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "d",
      nationality: "DE",
      email: "",
      phone: "",
      street: "",
      zip: "",
      city: "",
      country: "DE",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",

      contractType: "permanent",
      contractStart: "",
      contractEnd: "",
      probationEnd: "",
      weeklyHours: 40,
      vacationEntitlement: 28,
      noticePeriod: "1m_eom",
      workplaceModel: "office",
      location: "",
      title: "Staff",
      department: "HR",
      jobTitle: "",
      managerId: "",

      salary: 0,
      bonusTargetPct: 0,
      taxId: "",
      socialSecurityNo: "",
      taxClass: 1,
      children: 0,
      religion: "keine",
      healthInsuranceType: "statutory",
      healthInsuranceProvider: "",
      iban: "",
      bic: "",
      costCenter: "",

      buddyId: "",
      requiredTrainings: [],
      provisionedAssets: [],
    }),
    [],
  );

  const form = useForm<WizardValues>({
    // zod v4 + @hookform/resolvers v5 disagree on the Resolver generic
    // (two structurally-identical types from different module copies); cast
    // to the local Resolver shape so the inferred form type is correct.
    resolver: zodResolver(schema) as unknown as Resolver<WizardValues>,
    defaultValues: defaults,
    mode: "onChange",
  });

  const queryClient = useQueryClient();

  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState<1 | -1>(1);

  // Reset wizard whenever the dialog closes — done in the close handler
  // instead of an effect so we don't violate react-hooks/set-state-in-effect.
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) {
        setStep(0);
        setDirection(1);
        form.reset(defaults);
      }
      onOpenChange(next);
    },
    [onOpenChange, form, defaults],
  );

  // Auto-derive probationEnd from contractStart (only if user hasn't edited it manually past start)
  const contractStart = useWatch({ control: form.control, name: "contractStart" });
  const probationEnd = useWatch({ control: form.control, name: "probationEnd" });
  React.useEffect(() => {
    if (contractStart && !probationEnd) {
      form.setValue("probationEnd", addMonths(contractStart, 6), {
        shouldValidate: false,
      });
    }
  }, [contractStart, probationEnd, form]);

  // Auto-derive BIC from IBAN if BIC field is empty
  const ibanWatch = useWatch({ control: form.control, name: "iban" });
  const bicWatch = useWatch({ control: form.control, name: "bic" });
  React.useEffect(() => {
    if (!bicWatch && ibanWatch) {
      const auto = deriveBicFromIban(ibanWatch);
      if (auto) form.setValue("bic", auto, { shouldValidate: false });
    }
  }, [ibanWatch, bicWatch, form]);

  // Cascading: when department changes and current jobTitle isn't in the new
  // department's pool, reset it to the first option.
  const department = useWatch({ control: form.control, name: "department" });
  React.useEffect(() => {
    const jt = form.getValues("jobTitle");
    const pool = JOB_TITLES[department] ?? [];
    if (jt && !pool.includes(jt)) {
      form.setValue("jobTitle", pool[0] ?? "", { shouldValidate: false });
    }
  }, [department, form]);

  const stepLabels = [
    t("people.add.step1Title"),
    t("people.add.step2Title"),
    t("people.add.step3Title"),
    t("people.add.step4Title"),
  ];

  async function handleNext() {
    const fields = STEP_FIELDS[step];
    const valid = await form.trigger(fields, { shouldFocus: false });
    if (!valid) {
      // Focus first invalid field for a11y
      const errors = form.formState.errors as Record<string, unknown>;
      const firstBad = fields.find((f) => errors[f]);
      if (firstBad) form.setFocus(firstBad as Path<WizardValues>);
      return;
    }
    if (step < STEP_FIELDS.length - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  }

  // Create the employee via the API. department/title go by name, manager/buddy
  // by code (resolved server-side). employmentType is derived from contractType;
  // hireDate uses the contract start.
  const createEmployee = useMutation({
    mutationFn: async (values: WizardValues) => {
      const ct = values.contractType;
      const employmentType =
        ct === "intern"
          ? "intern"
          : ct === "part_time" || ct === "mini_job" || ct === "working_student"
            ? "part_time"
            : "full_time";

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          jobTitle: values.jobTitle,
          location: values.location,
          employmentType,
          hireDate: values.contractStart,
          salary: values.salary,
          department: values.department,
          title: values.title,
          managerId: values.managerId || undefined,
          buddyId: values.buddyId || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender,
          nationality: values.nationality,
          phone: values.phone,
          addressStreet: values.street,
          addressZip: values.zip,
          addressCity: values.city,
          addressCountry: values.country,
          contractType: values.contractType,
          contractStart: values.contractStart,
          contractEnd: values.contractEnd || undefined,
          probationEnd: values.probationEnd,
          weeklyHours: values.weeklyHours,
          vacationEntitlement: values.vacationEntitlement,
          noticePeriod: values.noticePeriod,
          workplaceModel: values.workplaceModel,
          taxId: values.taxId,
          socialSecurityNo: values.socialSecurityNo,
          taxClass: values.taxClass,
          children: values.children,
          religion: values.religion,
          healthInsuranceType: values.healthInsuranceType,
          healthInsuranceProvider: values.healthInsuranceProvider,
          iban: values.iban,
          bic: values.bic,
          costCenter: values.costCenter,
          bonusTargetPct: values.bonusTargetPct,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, values) => {
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(
        t("people.add.toastCreated", { name: `${values.firstName} ${values.lastName}` }),
      );
      handleOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: WizardValues) {
    createEmployee.mutate(values);
  }

  const slideVariants = {
    enter: (dir: 1 | -1) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 1 | -1) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  } as const;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
          <DialogTitle>{t("people.add.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("people.add.dialogDesc")}</DialogDescription>
          <div className="pt-3">
            <StepDots current={step} labels={stepLabels} />
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="relative min-h-[420px] max-h-[60vh] overflow-y-auto px-6 py-5">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-5"
                >
                  {step === 0 && <Step1 form={form} t={t} />}
                  {step === 1 && (
                    <Step2
                      form={form}
                      t={t}
                      employees={employeesList}
                    />
                  )}
                  {step === 2 && <Step3 form={form} t={t} />}
                  {step === 3 && <Step4 form={form} t={t} employees={employeesList} />}
                </motion.div>
              </AnimatePresence>
            </div>

            <DialogFooter className="flex-row items-center justify-between border-t border-border bg-muted/40 px-6 py-3 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                {t("people.add.cancelBtn")}
              </Button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <Button type="button" variant="outline" onClick={handleBack}>
                    <ChevronLeft className="size-4" />
                    {t("people.add.backBtn")}
                  </Button>
                )}
                {step < STEP_FIELDS.length - 1 ? (
                  <Button type="button" onClick={handleNext}>
                    {t("people.add.nextBtn")}
                    <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button type="submit">
                    <Sparkles className="size-4" />
                    {t("people.add.createBtn")}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// === Step bodies ===========================================================

type StepProps = {
  form: UseFormReturn<WizardValues>;
  t: ReturnType<typeof useT>;
};
type StepWithEmployeesProps = StepProps & { employees: Employee[] };

function Step1({ form, t }: StepProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldFirstName")}</FormLabel>
              <FormControl><Input autoComplete="given-name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldLastName")}</FormLabel>
              <FormControl><Input autoComplete="family-name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="dateOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldDob")}</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldGender")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="m">{t("people.add.genderM")}</SelectItem>
                  <SelectItem value="f">{t("people.add.genderF")}</SelectItem>
                  <SelectItem value="d">{t("people.add.genderD")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nationality"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldNationality")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-64">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`country.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldEmail")}</FormLabel>
              <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldPhone")}</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder={t("people.add.phonePlaceholder")}
                  autoComplete="tel"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("people.add.fieldAddress")}
      </p>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_2fr_1fr]">
        <FormField
          control={form.control}
          name="street"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldStreet")}</FormLabel>
              <FormControl><Input autoComplete="street-address" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="zip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldZip")}</FormLabel>
              <FormControl><Input autoComplete="postal-code" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldCity")}</FormLabel>
              <FormControl><Input autoComplete="address-level2" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldCountry")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-64">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`country.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("people.add.fieldEmergency")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="emergencyContactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldEmergencyName")}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emergencyContactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldEmergencyPhone")}</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder={t("people.add.phonePlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emergencyContactRelation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldEmergencyRelation")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("people.add.emergencyRelationPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}

function Step2({ form, t, employees }: StepWithEmployeesProps) {
  const contractType = useWatch({ control: form.control, name: "contractType" });
  const department = useWatch({ control: form.control, name: "department" });
  const jobTitlePool = JOB_TITLES[department] ?? [];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="contractType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldContractType")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="permanent">{t("people.add.contractTypePermanent")}</SelectItem>
                  <SelectItem value="fixed_term">{t("people.add.contractTypeFixedTerm")}</SelectItem>
                  <SelectItem value="part_time">{t("people.add.contractTypePartTime")}</SelectItem>
                  <SelectItem value="working_student">{t("people.add.contractTypeWorkingStudent")}</SelectItem>
                  <SelectItem value="intern">{t("people.add.contractTypeIntern")}</SelectItem>
                  <SelectItem value="mini_job">{t("people.add.contractTypeMiniJob")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contractStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldContractStart")}</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {contractType === "fixed_term" && (
          <FormField
            control={form.control}
            name="contractEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("people.add.fieldContractEnd")}</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <FormField
          control={form.control}
          name="probationEnd"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldProbationEnd")}</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="weeklyHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldWeeklyHours")}</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={48} step={0.5} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="vacationEntitlement"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldVacation")}</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={60} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="workplaceModel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldWorkplace")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WORKPLACE.map((w) => (
                    <SelectItem key={w} value={w}>
                      {t(`people.add.workplace${w[0].toUpperCase() + w.slice(1)}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="noticePeriod"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("people.add.fieldNotice")}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="4w_eom">{t("people.add.notice4wEom")}</SelectItem>
                <SelectItem value="1m_eom">{t("people.add.notice1mEom")}</SelectItem>
                <SelectItem value="2m_eom">{t("people.add.notice2mEom")}</SelectItem>
                <SelectItem value="3m_eom">{t("people.add.notice3mEom")}</SelectItem>
                <SelectItem value="4m_eom">{t("people.add.notice4mEom")}</SelectItem>
                <SelectItem value="5m_eom">{t("people.add.notice5mEom")}</SelectItem>
                <SelectItem value="6m_eoq">{t("people.add.notice6mEoq")}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldLocation")}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldTitle")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TITLES.map((tl) => (
                    <SelectItem key={tl} value={tl}>{tl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldDepartment")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-64">
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
          name="jobTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldJobTitle")}</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("people.helpdesk.selectPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-64">
                  {jobTitlePool.map((j) => (
                    <SelectItem key={j} value={j}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="managerId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("people.add.fieldManager")}</FormLabel>
            <FormControl>
              <ManagerCombobox
                value={field.value || undefined}
                onChange={(id) => field.onChange(id ?? "")}
                employees={employees}
                placeholder={t("people.helpdesk.selectPlaceholder")}
                searchPlaceholder={t("people.add.managerSearchPlaceholder")}
                noResultsLabel={t("people.add.managerNoResults")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

function Step3({ form, t }: StepProps) {
  const ibanRaw = useWatch({ control: form.control, name: "iban" });
  const ibanValid = isValidIban(ibanRaw);
  const ibanError = form.formState.errors.iban;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="salary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldSalary")}</FormLabel>
              <FormControl>
                <Input type="number" inputMode="numeric" min={0} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bonusTargetPct"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldBonus")}</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={100} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="taxId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldTaxId")}</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  placeholder={t("people.add.taxIdPlaceholder")}
                  value={field.value}
                  onChange={(e) => field.onChange(formatTaxId(e.target.value))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  name={field.name}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="socialSecurityNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldSsn")}</FormLabel>
              <FormControl>
                <Input maxLength={12} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="taxClass"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldTaxClass")}</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(Number(v))}
                value={String(field.value)}
              >
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TAX_CLASSES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
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
          name="children"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldChildren")}</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={10} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="religion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldReligion")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="rk">{t("people.add.religionRk")}</SelectItem>
                  <SelectItem value="ev">{t("people.add.religionEv")}</SelectItem>
                  <SelectItem value="keine">{t("people.add.religionKeine")}</SelectItem>
                  <SelectItem value="sonst">{t("people.add.religionSonst")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="healthInsuranceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldInsuranceType")}</FormLabel>
              <div
                role="radiogroup"
                aria-label={t("people.add.fieldInsuranceType")}
                className="grid grid-cols-2 gap-2"
              >
                {INSURANCE.map((opt) => {
                  const checked = field.value === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => field.onChange(opt)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {opt === "statutory"
                        ? t("people.add.insuranceStatutory")
                        : t("people.add.insurancePrivate")}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="healthInsuranceProvider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldInsuranceProvider")}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <FormField
          control={form.control}
          name="iban"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldIban")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="DE89 3704 0044 0532 0130 00"
                    value={field.value}
                    onChange={(e) => field.onChange(normalizeIban(e.target.value))}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    name={field.name}
                    className={cn(ibanValid && "pr-9")}
                    aria-invalid={!!ibanError}
                  />
                  {ibanValid && (
                    <span
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-success"
                      title={t("people.add.ibanValid")}
                    >
                      <Check className="size-4 text-emerald-600" aria-hidden />
                      <span className="sr-only">{t("people.add.ibanValid")}</span>
                    </span>
                  )}
                </div>
              </FormControl>
              {ibanError ? (
                <p className="text-xs font-medium text-destructive">
                  {String(ibanError.message) === "errIbanInvalid"
                    ? t("people.add.errIbanInvalid")
                    : String(ibanError.message)}
                </p>
              ) : (
                <FormMessage />
              )}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldBic")}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="costCenter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("people.add.fieldCostCenter")}</FormLabel>
              <FormControl><Input placeholder="CC-0001" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}

function Step4({ form, t, employees }: StepWithEmployeesProps) {
  const checklistItems = [
    { key: "checklistBuddy", icon: "👋" },
    { key: "checklistWelcomeMail", icon: "✉" },
    { key: "checklistIdp", icon: "🔑" },
    { key: "checklistAssets", icon: "💻" },
    { key: "checklistTrainings", icon: "📚" },
  ];

  return (
    <>
      <FormField
        control={form.control}
        name="buddyId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("people.add.fieldBuddy")}</FormLabel>
            <FormControl>
              <ManagerCombobox
                value={field.value || undefined}
                onChange={(id) => field.onChange(id ?? "")}
                employees={employees}
                placeholder={t("people.helpdesk.selectPlaceholder")}
                searchPlaceholder={t("people.add.managerSearchPlaceholder")}
                noResultsLabel={t("people.add.managerNoResults")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="requiredTrainings"
        render={({ field }) => {
          const selected: string[] = field.value ?? [];
          const toggle = (id: string) => {
            field.onChange(
              selected.includes(id)
                ? selected.filter((x) => x !== id)
                : [...selected, id],
            );
          };
          return (
            <FormItem>
              <FormLabel>{t("people.add.fieldTrainings")}</FormLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {TRAININGS.map((tr) => {
                  const checked = selected.includes(tr.id);
                  const id = `train-${tr.id}`;
                  return (
                    <label
                      key={tr.id}
                      htmlFor={id}
                      className={cn(
                        "flex items-center gap-3 rounded-md border border-border p-2.5 text-sm cursor-pointer transition-colors",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={() => toggle(tr.id)}
                      />
                      <span>{t(tr.labelKey)}</span>
                    </label>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <FormField
        control={form.control}
        name="provisionedAssets"
        render={({ field }) => {
          const selected: string[] = field.value ?? [];
          const toggle = (id: string) => {
            field.onChange(
              selected.includes(id)
                ? selected.filter((x) => x !== id)
                : [...selected, id],
            );
          };
          return (
            <FormItem>
              <FormLabel>{t("people.add.fieldAssets")}</FormLabel>
              <div className="grid gap-2 sm:grid-cols-3">
                {ASSETS.map((a) => {
                  const checked = selected.includes(a.id);
                  const id = `asset-${a.id}`;
                  return (
                    <label
                      key={a.id}
                      htmlFor={id}
                      className={cn(
                        "flex items-center gap-3 rounded-md border border-border p-2.5 text-sm cursor-pointer transition-colors",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={() => toggle(a.id)}
                      />
                      <span>{t(a.labelKey)}</span>
                    </label>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <Separator />

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("people.add.checklistPreviewTitle")}
        </Label>
        <ul
          className="mt-2 grid gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm"
          aria-label={t("people.add.checklistPreviewTitle")}
        >
          {checklistItems.map((it) => (
            <li key={it.key} className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-background text-base">
                {it.icon}
              </span>
              <span>{t(`people.add.${it.key}`)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="size-3.5" />
          Frontend-Mock — wird beim Anlegen geloggt, nicht persistiert.
        </p>
      </div>
    </>
  );
}
