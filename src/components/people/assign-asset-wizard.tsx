"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Mail,
  Printer,
  Sparkles,
  Trash2,
  Upload,
  X,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { fullName } from "@/lib/mock/data";
import { useEmployees, useAssets, useMe } from "@/lib/queries";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Asset, Employee } from "@/types";

// ---------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------

const CONDITION = ["new", "like_new", "good", "used"] as const;
const LOCATION = [
  "office_berlin",
  "office_munich",
  "office_vienna",
  "shipping",
] as const;
const ACCESSORY = [
  "charger",
  "bag",
  "mouse",
  "keyboard",
  "headset",
  "dock",
  "adapter",
] as const;

type WizardValues = {
  asset: string;
  employee: string;
  handoverDate: string;
  expectedReturnDate?: string;
  isLoan: boolean;
  location: (typeof LOCATION)[number];
  trackingNumber?: string;
  condition: (typeof CONDITION)[number];
  accessories: string[];
  photos: string[];
  notes?: string;
  liabilityAmount: number;
  policyAccepted: boolean;
};

const STEP_FIELDS: Path<WizardValues>[][] = [
  [
    "asset",
    "employee",
    "handoverDate",
    "expectedReturnDate",
    "isLoan",
    "location",
    "trackingNumber",
  ],
  ["condition", "accessories", "photos", "notes"],
  ["liabilityAmount", "policyAccepted"],
];

const TODAY = "2026-05-30";

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export interface AssignAssetWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultAssetId?: string;
}

export function AssignAssetWizard({
  open,
  onOpenChange,
  defaultAssetId,
}: AssignAssetWizardProps) {
  const t = useT();
  const { data: employees = [] } = useEmployees();
  const { data: assets = [] } = useAssets();
  const { data: me } = useMe();
  const self = me?.employee;
  const queryClient = useQueryClient();

  const availableAssets = useMemo(
    () => assets.filter((a) => a.status === "available"),
    [assets],
  );
  const eligibleEmployees = useMemo(
    () => employees.filter((e) => e.status === "active" || e.status === "onboarding"),
    [employees],
  );

  // ----- Form schema (uses i18n labels) -----
  const required = t("common.required");
  const schema = z
    .object({
      asset: z.string().min(1, required),
      employee: z.string().min(1, required),
      handoverDate: z.string().min(1, required),
      expectedReturnDate: z.string().optional(),
      isLoan: z.boolean(),
      location: z.enum(LOCATION, { message: required }),
      trackingNumber: z.string().optional(),
      condition: z.enum(CONDITION, { message: required }),
      accessories: z.array(z.string()),
      photos: z.array(z.string()).max(5),
      notes: z.string().optional(),
      liabilityAmount: z.number().min(0, required),
      policyAccepted: z.literal(true, { message: required }),
    })
    .superRefine((d, ctx) => {
      if (d.isLoan && !d.expectedReturnDate) {
        ctx.addIssue({
          code: "custom",
          path: ["expectedReturnDate"],
          message: required,
        });
      }
      if (d.location === "shipping" && !d.trackingNumber) {
        ctx.addIssue({
          code: "custom",
          path: ["trackingNumber"],
          message: required,
        });
      }
    });

  const defaults: WizardValues = useMemo(
    () => ({
      asset: defaultAssetId ?? "",
      employee: "",
      handoverDate: TODAY,
      expectedReturnDate: "",
      isLoan: false,
      location: "office_berlin",
      trackingNumber: "",
      condition: "new",
      accessories: [],
      photos: [],
      notes: "",
      liabilityAmount: 8_500_000,
      policyAccepted: false,
    }),
    [defaultAssetId],
  );

  const form = useForm<WizardValues>({
    // RHF's resolver type is invariant here; the schema is correct and runs at runtime.
    resolver: zodResolver(schema) as never,
    defaultValues: defaults,
    mode: "onChange",
  });

  // ----- Wizard state -----
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function handleOpenChange(o: boolean) {
    onOpenChange(o);
    if (!o) {
      form.reset(defaults);
      setStep(0);
      setDirection(1);
      setShowPreview(false);
      setSigned(false);
      setSignaturePng(null);
      clearCanvas();
    }
  }

  // ----- Step nav -----
  async function handleNext() {
    const fields = STEP_FIELDS[step];
    const valid = await form.trigger(fields, { shouldFocus: false });
    if (!valid) {
      const errors = form.formState.errors as Record<string, unknown>;
      const firstBad = fields.find((f) => errors[f as string]);
      if (firstBad) {
        form.setFocus(firstBad);
        // Scroll the field into view inside the dialog scroll container.
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-wizard-field="${firstBad}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
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

  // ----- Signature canvas -----
  function strokeColor(): string {
    if (typeof window === "undefined") return "#0f172a";
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--foreground")
      .trim();
    return v ? `oklch(${v.startsWith("oklch") ? v.slice(6, -1) : v})` : "#0f172a";
  }

  function ensureCtx(): CanvasRenderingContext2D | null {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor();
    return ctx;
  }

  function pointerStart(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const c = e.currentTarget;
    c.setPointerCapture(e.pointerId);
    const ctx = ensureCtx();
    if (!ctx) return;
    const r = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(
      ((e.clientX - r.left) * c.width) / r.width,
      ((e.clientY - r.top) * c.height) / r.height,
    );
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons === 0) return;
    const c = e.currentTarget;
    const ctx = ensureCtx();
    if (!ctx) return;
    const r = c.getBoundingClientRect();
    ctx.lineTo(
      ((e.clientX - r.left) * c.width) / r.width,
      ((e.clientY - r.top) * c.height) / r.height,
    );
    ctx.stroke();
    if (!signed) setSigned(true);
  }
  function pointerEnd(e: React.PointerEvent<HTMLCanvasElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }
  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setSigned(false);
    setSignaturePng(null);
  }

  // Reset canvas dimensions when the canvas is mounted so it's pixel-clean.
  useEffect(() => {
    const c = canvasRef.current;
    if (c) {
      // Reset stroke color when the theme might change between renders.
      ensureCtx();
    }
    // No deps: we only need this once per mount; the actual painting uses fresh ctx each draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ----- Photo upload -----
  function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const current = form.getValues("photos");
    const room = Math.max(0, 5 - current.length);
    if (room <= 0) {
      toast.warning(t("people.assign.photosLimit"));
      e.target.value = "";
      return;
    }
    const files = Array.from(e.target.files ?? []).slice(0, room);
    Promise.all(
      files.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(f);
          }),
      ),
    ).then((urls) => {
      const next = [...current, ...urls].slice(0, 5);
      form.setValue("photos", next, { shouldDirty: true, shouldValidate: true });
    });
    e.target.value = "";
  }
  function removePhoto(index: number) {
    const next = form.getValues("photos").filter((_, i) => i !== index);
    form.setValue("photos", next, { shouldDirty: true, shouldValidate: true });
  }

  // ----- Generate preview -----
  const canGenerate = form.formState.isValid && signed;

  function generate() {
    const c = canvasRef.current;
    if (!c) return;
    const png = c.toDataURL("image/png");
    setSignaturePng(png);
    setShowPreview(true);
    // Scroll preview into view inside the scroll container.
    requestAnimationFrame(() => {
      document
        .getElementById("handover-preview")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function finish() {
    // Re-run full validation in case the user mutated a field after
    // 'Generate' enabled the button (e.g. went Back and cleared `employee`).
    const valid = await form.trigger();
    if (!valid || !signed) {
      toast.error(t("common.required"));
      return;
    }
    // Bestehendes Asset dem Mitarbeiter zuweisen (Status + Halter aktualisieren).
    const v = form.getValues();
    try {
      const res = await fetch(`/api/assets/${v.asset}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "assigned",
          assignedToCode: v.employee,
          assignedSince: v.handoverDate,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    toast.success(t("people.assign.toastDone"));
    handleOpenChange(false);
  }

  // ----- Render -----
  const stepTitle = [
    t("people.assign.step1Title"),
    t("people.assign.step2Title"),
    t("people.assign.step3Title"),
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("people.assign.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("people.assign.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <Stepper step={step} labels={stepTitle} />

        <Form {...form}>
          <form className="space-y-4">
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({ x: 60 * d, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (d: number) => ({ x: -60 * d, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22 }}
                  className="space-y-4"
                >
                  {step === 0 && (
                    <Step1
                      form={form}
                      t={t}
                      availableAssets={availableAssets}
                      eligibleEmployees={eligibleEmployees}
                    />
                  )}
                  {step === 1 && (
                    <Step2
                      form={form}
                      t={t}
                      onPhotosChange={handlePhotos}
                      onRemovePhoto={removePhoto}
                    />
                  )}
                  {step === 2 && (
                    <Step3
                      form={form}
                      t={t}
                      self={self}
                      canvasRef={canvasRef}
                      signed={signed}
                      signaturePng={signaturePng}
                      onPointerStart={pointerStart}
                      onPointerMove={pointerMove}
                      onPointerEnd={pointerEnd}
                      onClear={clearCanvas}
                      showPreview={showPreview}
                      previewData={form.getValues()}
                      availableAssets={availableAssets}
                      eligibleEmployees={eligibleEmployees}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                {t("people.assign.cancelBtn")}
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {step > 0 && (
                  <Button type="button" variant="outline" onClick={handleBack}>
                    <ChevronLeft className="size-4" />
                    {t("people.assign.backBtn")}
                  </Button>
                )}
                {step < STEP_FIELDS.length - 1 && (
                  <Button type="button" onClick={handleNext}>
                    {t("people.assign.nextBtn")}
                    <ChevronRight className="size-4" />
                  </Button>
                )}
                {step === STEP_FIELDS.length - 1 && !showPreview && (
                  <Button
                    type="button"
                    onClick={generate}
                    disabled={!canGenerate}
                  >
                    <Sparkles className="size-4" />
                    {t("people.assign.generatePdf")}
                  </Button>
                )}
                {showPreview && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        toast.success(t("people.assign.toastEmail"));
                      }}
                    >
                      <Mail className="size-4" />
                      {t("people.assign.emailBtn")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.print()}
                    >
                      <Printer className="size-4" />
                      {t("people.assign.printBtn")}
                    </Button>
                    <Button type="button" onClick={finish}>
                      <Check className="size-4" />
                      {t("people.assign.finishBtn")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Scoped print stylesheet — hides everything except the preview. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #handover-preview, #handover-preview * { visibility: visible !important; }
          #handover-preview {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
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
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------
// Step 1
// ---------------------------------------------------------------------

type T = (k: string, v?: Record<string, string | number>) => string;
type WizardForm = ReturnType<typeof useForm<WizardValues>>;

const CATEGORY_PREFIX: Record<Asset["category"], string> = {
  laptop: "[Laptop]",
  phone: "[Telefon]",
  monitor: "[Monitor]",
  access_card: "[Karte]",
  vehicle: "[Fahrzeug]",
};

function assetOptionLabel(a: Asset): string {
  return `${CATEGORY_PREFIX[a.category]} ${a.name} · ${a.serial}`;
}

function Step1({
  form,
  t,
  availableAssets,
  eligibleEmployees,
}: {
  form: WizardForm;
  t: T;
  availableAssets: Asset[];
  eligibleEmployees: Employee[];
}) {
  const isLoan = form.watch("isLoan");
  const location = form.watch("location");

  const LOCATION_LABELS: Record<(typeof LOCATION)[number], string> = {
    office_berlin: t("people.assign.locOfficeBerlin"),
    office_munich: t("people.assign.locOfficeMunich"),
    office_vienna: t("people.assign.locOfficeVienna"),
    shipping: t("people.assign.locShipping"),
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="asset"
        render={({ field }) => (
          <FormItem data-wizard-field="asset">
            <FormLabel>{t("people.assign.fieldAsset")}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t("people.assign.assetPlaceholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-72">
                {availableAssets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {assetOptionLabel(a)}
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
        name="employee"
        render={({ field }) => (
          <FormItem data-wizard-field="employee">
            <FormLabel>{t("people.assign.fieldEmployee")}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t("people.assign.employeePlaceholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-72">
                {eligibleEmployees.slice(0, 60).map((e) => (
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
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="handoverDate"
          render={({ field }) => (
            <FormItem data-wizard-field="handoverDate">
              <FormLabel>{t("people.assign.fieldHandover")}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="expectedReturnDate"
          render={({ field }) => (
            <FormItem data-wizard-field="expectedReturnDate">
              <FormLabel>{t("people.assign.fieldReturn")}</FormLabel>
              <FormControl>
                <Input type="date" disabled={!isLoan} {...field} />
              </FormControl>
              {!isLoan && (
                <p className="text-xs text-muted-foreground">
                  {t("people.assign.fieldReturnHint")}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="isLoan"
        render={({ field }) => (
          <FormItem
            data-wizard-field="isLoan"
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div className="space-y-0.5">
              <FormLabel>{t("people.assign.fieldLoan")}</FormLabel>
              <p className="text-xs text-muted-foreground">
                {t("people.assign.fieldLoanDesc")}
              </p>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="location"
        render={({ field }) => (
          <FormItem data-wizard-field="location">
            <FormLabel>{t("people.assign.fieldLocation")}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {LOCATION.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LOCATION_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {location === "shipping" && (
        <FormField
          control={form.control}
          name="trackingNumber"
          render={({ field }) => (
            <FormItem data-wizard-field="trackingNumber">
              <FormLabel>{t("people.assign.fieldTracking")}</FormLabel>
              <FormControl>
                <Input placeholder="DHL-1234-5678" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Step 2
// ---------------------------------------------------------------------

function Step2({
  form,
  t,
  onPhotosChange,
  onRemovePhoto,
}: {
  form: WizardForm;
  t: T;
  onPhotosChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (i: number) => void;
}) {
  const condition = form.watch("condition");
  const accessories = form.watch("accessories");
  const photos = form.watch("photos");

  const CONDITION_LABELS: Record<(typeof CONDITION)[number], string> = {
    new: t("people.assign.condNew"),
    like_new: t("people.assign.condLikeNew"),
    good: t("people.assign.condGood"),
    used: t("people.assign.condUsed"),
  };
  const ACCESSORY_LABELS: Record<(typeof ACCESSORY)[number], string> = {
    charger: t("people.assign.accCharger"),
    bag: t("people.assign.accBag"),
    mouse: t("people.assign.accMouse"),
    keyboard: t("people.assign.accKeyboard"),
    headset: t("people.assign.accHeadset"),
    dock: t("people.assign.accDock"),
    adapter: t("people.assign.accAdapter"),
  };

  return (
    <div className="space-y-5">
      {/* Condition — custom RadioGroup (no extra dep) */}
      <FormField
        control={form.control}
        name="condition"
        render={() => (
          <FormItem data-wizard-field="condition">
            <FormLabel>{t("people.assign.fieldCondition")}</FormLabel>
            <div
              role="radiogroup"
              aria-label={t("people.assign.fieldCondition")}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {CONDITION.map((c) => {
                const active = c === condition;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      form.setValue("condition", c, { shouldDirty: true, shouldValidate: true })
                    }
                    className={cn(
                      "rounded-lg border p-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer text-left",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {CONDITION_LABELS[c]}
                  </button>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Accessories — checkboxes */}
      <FormField
        control={form.control}
        name="accessories"
        render={() => (
          <FormItem data-wizard-field="accessories">
            <FormLabel>{t("people.assign.fieldAccessories")}</FormLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACCESSORY.map((a) => {
                const checked = accessories.includes(a);
                return (
                  <label
                    key={a}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted",
                      checked && "border-primary bg-primary/[0.04]",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...accessories, a]
                          : accessories.filter((x) => x !== a);
                        form.setValue("accessories", next, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                    />
                    <span className="text-sm">{ACCESSORY_LABELS[a]}</span>
                  </label>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Photos */}
      <FormField
        control={form.control}
        name="photos"
        render={() => (
          <FormItem data-wizard-field="photos">
            <FormLabel className="flex items-center justify-between">
              <span>{t("people.assign.fieldPhotos")}</span>
              <Badge variant="muted">{photos.length} / 5</Badge>
            </FormLabel>
            <div className="space-y-2">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-3 text-sm transition-colors hover:bg-muted/50",
                  photos.length >= 5 && "cursor-not-allowed opacity-60",
                )}
              >
                <Upload className="size-4 text-muted-foreground" />
                <span className="flex-1">{t("people.assign.photosHint")}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  disabled={photos.length >= 5}
                  onChange={onPhotosChange}
                />
              </label>
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {photos.map((src, i) => (
                    <div
                      key={i}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`photo-${i + 1}`}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onRemovePhoto(i)}
                        aria-label={t("people.assign.photoRemove")}
                        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Notes */}
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem data-wizard-field="notes">
            <FormLabel>{t("people.assign.fieldNotes")}</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Step 3
// ---------------------------------------------------------------------

// Standard-Nutzungsvereinbarung (Asset-Überlassung), die der/die
// Mitarbeiter/in bei der Zuweisung digital unterzeichnet.
const POLICY_PARAGRAPHS: string[] = [
  "§ 1 Gegenstand der Vereinbarung. Diese Vereinbarung regelt die Bedingungen, unter denen der/die Arbeitnehmer/in das zugewiesene Asset zur dienstlichen Nutzung erhält.",
  "§ 2 Eigentum. Das Asset bleibt während der gesamten Überlassungsdauer Eigentum des Arbeitgebers. Eine Veräußerung, Verpfändung oder Weitergabe an Dritte ist ausdrücklich untersagt.",
  "§ 3 Nutzung. Die Nutzung erfolgt vorrangig zu dienstlichen Zwecken. Eine private Mitbenutzung ist im üblichen Rahmen zulässig, sofern dadurch keine Beeinträchtigungen entstehen.",
  "§ 4 Sorgfalts- und Aufbewahrungspflicht. Der/die Arbeitnehmer/in verpflichtet sich, das Asset sorgfältig zu behandeln, vor Diebstahl, Verlust oder Beschädigung zu schützen und ausschließlich in sicheren Umgebungen aufzubewahren.",
  "§ 5 Software & Konfiguration. Auf dem Asset darf ausschließlich vom IT-Team freigegebene Software installiert werden. Eine eigenmächtige Änderung von Sicherheitskonfigurationen ist nicht zulässig.",
  "§ 6 Datenschutz. Personenbezogene Daten sind nach den geltenden Vorschriften der DSGVO zu verarbeiten. Eine Verschlüsselung der Datenträger ist verpflichtend.",
  "§ 7 Verlust und Diebstahl. Bei Verlust, Diebstahl oder Beschädigung ist unverzüglich der Vorgesetzte und die IT-Abteilung zu informieren.",
  "§ 8 Reparaturen. Reparaturen dürfen ausschließlich durch autorisierte Werkstätten oder durch das IT-Team erfolgen. Eigenständige Reparaturversuche führen zum Erlöschen jeglicher Gewährleistungsansprüche.",
  "§ 9 Versicherung. Das Asset ist im Rahmen der allgemeinen Inventarversicherung des Arbeitgebers gegen Verlust und Beschädigung versichert. Eine Selbstbeteiligung kann je nach Schadensfall geltend gemacht werden.",
  "§ 10 Haftung. Der/die Arbeitnehmer/in haftet für Schäden, die durch grob fahrlässiges oder vorsätzliches Verhalten verursacht werden, bis zur vereinbarten Haftungssumme.",
  "§ 11 Rückgabe. Bei Beendigung des Arbeitsverhältnisses, Wechsel der Position oder auf Verlangen des Arbeitgebers ist das Asset unverzüglich und vollständig zurückzugeben.",
  "§ 12 Rückgabezustand. Das Asset ist im selben Zustand zurückzugeben, in dem es übergeben wurde — unter Berücksichtigung üblicher Gebrauchsspuren.",
  "§ 13 Datenlöschung. Vor der Rückgabe sind personenbezogene Daten zu sichern; das IT-Team führt eine vollständige sichere Löschung durch.",
  "§ 14 Verschwiegenheitspflicht. Im Zusammenhang mit dem Asset erhaltene oder gespeicherte vertrauliche Informationen unterliegen der Verschwiegenheitspflicht über die Dauer des Arbeitsverhältnisses hinaus.",
  "§ 15 Compliance. Die Nutzung des Assets erfolgt unter strikter Beachtung der Compliance-Richtlinien des Unternehmens, insbesondere der IT-Sicherheits-, Anti-Korruptions- und Exportkontrollvorschriften.",
  "§ 16 Mobile Verwendung. Bei mobiler Verwendung außerhalb der Büros sind ergänzende Sicherheitsmaßnahmen zu treffen (Sichtschutz, sichere Netzwerke, automatische Bildschirmsperre).",
  "§ 17 Drittnutzung. Eine Nutzung des Assets durch Dritte — einschließlich Familienangehöriger — ist untersagt.",
  "§ 18 Versicherte Bereiche. Bei beruflichen Reisen ist das Asset während des Transports stets als Handgepäck mitzuführen und nicht im aufgegebenen Gepäck zu transportieren.",
  "§ 19 Aufbewahrung im Fahrzeug. Eine Aufbewahrung im KFZ ist nur in geschlossenen, nicht einsehbaren Behältnissen für kurze Zeiträume zulässig.",
  "§ 20 Identifikation. Das Asset trägt eine eindeutige Asset-Tag-Nummer; diese darf nicht entfernt oder unkenntlich gemacht werden.",
  "§ 21 Inventur. Der/die Arbeitnehmer/in unterstützt die regelmäßige Inventurprüfung und meldet Änderungen am Asset-Status zeitnah.",
  "§ 22 Erweiterungen. Eigene Erweiterungen (z. B. Aufkleber, Hardware-Modifikationen) bedürfen der vorherigen schriftlichen Zustimmung.",
  "§ 23 Backup. Lokale Datenbestände sind regelmäßig in die freigegebenen Cloud-Speicher zu synchronisieren.",
  "§ 24 Lizenzkonformität. Die installierte Software muss zu jedem Zeitpunkt lizenzkonform sein; Volumenlizenzen werden vom IT-Team verwaltet.",
  "§ 25 Vertretungsfall. Im Falle längerer Abwesenheit (z. B. Elternzeit, Krankheit) entscheidet die Personalabteilung, ob das Asset verbleibt oder zur Wiederverwendung eingezogen wird.",
  "§ 26 Versicherungsfälle. Im Versicherungsfall sind Polizeiprotokolle, Fotos und ggf. weitere Beweismittel innerhalb von 48 Stunden bei der HR-Abteilung einzureichen.",
  "§ 27 Salvatorische Klausel. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.",
  "§ 28 Schriftform. Änderungen und Ergänzungen dieser Vereinbarung bedürfen der Schriftform.",
  "§ 29 Gerichtsstand. Gerichtsstand ist Berlin, sofern keine zwingenden gesetzlichen Vorschriften entgegenstehen.",
  "§ 30 Anwendbares Recht. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.",
  "§ 31 Inkrafttreten. Diese Vereinbarung tritt mit der Unterzeichnung in Kraft und gilt für die Dauer der Überlassung des Assets.",
  "§ 32 Schlussbestimmung. Mit seiner/ihrer Unterschrift bestätigt der/die Arbeitnehmer/in den Erhalt des Assets im beschriebenen Zustand sowie die Kenntnisnahme dieser Bedingungen.",
];

function Step3({
  form,
  t,
  self,
  canvasRef,
  signed,
  signaturePng,
  onPointerStart,
  onPointerMove,
  onPointerEnd,
  onClear,
  showPreview,
  previewData,
  availableAssets,
  eligibleEmployees,
}: {
  form: WizardForm;
  t: T;
  self: Employee | undefined;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  signed: boolean;
  signaturePng: string | null;
  onPointerStart: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerEnd: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onClear: () => void;
  showPreview: boolean;
  previewData: WizardValues;
  availableAssets: Asset[];
  eligibleEmployees: Employee[];
}) {
  const [policyOpen, setPolicyOpen] = useState(false);

  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="liabilityAmount"
        render={({ field }) => (
          <FormItem data-wizard-field="liabilityAmount">
            <FormLabel>{t("people.assign.fieldLiability")}</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                step={500_000}
                {...field}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Policy acceptance + inline ScrollArea */}
      <FormField
        control={form.control}
        name="policyAccepted"
        render={({ field }) => (
          <FormItem data-wizard-field="policyAccepted">
            <FormLabel>{t("people.assign.fieldPolicy")}</FormLabel>
            <p className="text-xs text-muted-foreground">
              {t("people.assign.fieldPolicyDesc")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPolicyOpen((v) => !v)}
            >
              <FileText className="size-3.5" />
              {policyOpen
                ? t("people.assign.fieldPolicyClose")
                : t("people.assign.fieldPolicyOpen")}
            </Button>
            {policyOpen && (
              <div className="mt-2 rounded-lg border border-border bg-muted/30">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("people.assign.policyTitle")}
                  </p>
                </div>
                <ScrollArea className="h-48 px-3 py-2">
                  <div className="space-y-2 text-xs leading-relaxed">
                    {POLICY_PARAGRAPHS.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5">
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                aria-label={t("people.assign.fieldPolicyAccept")}
              />
              <span className="text-sm">
                {t("people.assign.fieldPolicyAccept")}
              </span>
            </label>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Signature canvas */}
      <FormItem data-wizard-field="signature">
        <FormLabel className="flex items-center justify-between">
          <span>{t("people.assign.fieldSignature")}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="size-3.5" />
            {t("people.assign.sigClear")}
          </Button>
        </FormLabel>
        <div className="rounded-lg border border-border bg-card">
          <canvas
            ref={canvasRef}
            width={640}
            height={160}
            role="img"
            aria-label={t("people.assign.fieldSignature")}
            className="block h-40 w-full cursor-crosshair touch-none rounded-lg"
            onPointerDown={onPointerStart}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          />
        </div>
        {!signed && (
          <p className="text-xs text-muted-foreground">
            {t("people.assign.signatureHint")}
          </p>
        )}
        {!signed && form.formState.isSubmitted && (
          <p className="text-xs font-medium text-destructive">
            {t("people.assign.errSignatureRequired")}
          </p>
        )}
      </FormItem>

      {/* Issued by — nur wenn der eigene Datensatz geladen ist */}
      {self && (
        <div data-wizard-field="issuedBy" className="flex items-center gap-3 rounded-lg border border-border p-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(`${self.firstName} ${self.lastName}`)}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {t("people.assign.fieldIssuedBy")}
            </p>
            <p className="truncate text-sm font-medium">
              {self.firstName} {self.lastName} · {self.jobTitle}
            </p>
          </div>
        </div>
      )}

      {showPreview && (
        <HandoverPreview
          data={previewData}
          signaturePng={signaturePng}
          self={self}
          availableAssets={availableAssets}
          eligibleEmployees={eligibleEmployees}
          t={t}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Print-friendly preview
// ---------------------------------------------------------------------

function HandoverPreview({
  data,
  signaturePng,
  self,
  availableAssets,
  eligibleEmployees,
  t,
}: {
  data: WizardValues;
  signaturePng: string | null;
  self: Employee | undefined;
  availableAssets: Asset[];
  eligibleEmployees: Employee[];
  t: T;
}) {
  const asset = availableAssets.find((a) => a.id === data.asset);
  const employee = eligibleEmployees.find((e) => e.id === data.employee);

  const LOCATION_LABELS: Record<(typeof LOCATION)[number], string> = {
    office_berlin: t("people.assign.locOfficeBerlin"),
    office_munich: t("people.assign.locOfficeMunich"),
    office_vienna: t("people.assign.locOfficeVienna"),
    shipping: t("people.assign.locShipping"),
  };
  const CONDITION_LABELS: Record<(typeof CONDITION)[number], string> = {
    new: t("people.assign.condNew"),
    like_new: t("people.assign.condLikeNew"),
    good: t("people.assign.condGood"),
    used: t("people.assign.condUsed"),
  };
  const ACCESSORY_LABELS: Record<string, string> = {
    charger: t("people.assign.accCharger"),
    bag: t("people.assign.accBag"),
    mouse: t("people.assign.accMouse"),
    keyboard: t("people.assign.accKeyboard"),
    headset: t("people.assign.accHeadset"),
    dock: t("people.assign.accDock"),
    adapter: t("people.assign.accAdapter"),
  };

  return (
    <div
      id="handover-preview"
      className="space-y-4 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold">
            {t("people.assign.previewTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("people.assign.previewIssuedAt", { date: data.handoverDate })}
          </p>
        </div>
        <Badge variant="info">{asset?.assetTag ?? asset?.id ?? "—"}</Badge>
      </div>

      <Separator />

      <PreviewSection title={t("people.assign.previewSection.parties")}>
        <PreviewRow label={t("people.assign.fieldEmployee")}>
          {employee ? `${employee.firstName} ${employee.lastName}` : "—"}
          {employee && (
            <span className="ml-2 text-muted-foreground">· {employee.department}</span>
          )}
        </PreviewRow>
        <PreviewRow label={t("people.assign.fieldIssuedBy")}>
          {self ? `${self.firstName} ${self.lastName} · ${self.jobTitle}` : "—"}
        </PreviewRow>
      </PreviewSection>

      <PreviewSection title={t("people.assign.previewSection.terms")}>
        <PreviewRow label={t("people.assign.fieldAsset")}>
          {asset ? `${asset.name} · ${asset.serial}` : "—"}
        </PreviewRow>
        <PreviewRow label={t("people.assign.fieldHandover")}>
          {data.handoverDate}
        </PreviewRow>
        {data.isLoan && data.expectedReturnDate && (
          <PreviewRow label={t("people.assign.fieldReturn")}>
            {data.expectedReturnDate}
          </PreviewRow>
        )}
        <PreviewRow label={t("people.assign.fieldLocation")}>
          {LOCATION_LABELS[data.location]}
          {data.location === "shipping" && data.trackingNumber && (
            <span className="ml-2 font-mono text-xs">{data.trackingNumber}</span>
          )}
        </PreviewRow>
        <PreviewRow label={t("people.assign.fieldCondition")}>
          {CONDITION_LABELS[data.condition]}
        </PreviewRow>
      </PreviewSection>

      {data.accessories.length > 0 && (
        <PreviewSection title={t("people.assign.previewSection.accessories")}>
          <ul className="ml-4 list-disc text-sm">
            {data.accessories.map((a) => (
              <li key={a}>{ACCESSORY_LABELS[a] ?? a}</li>
            ))}
          </ul>
        </PreviewSection>
      )}

      <PreviewSection title={t("people.assign.previewSection.liability")}>
        <PreviewRow label={t("people.assign.fieldLiability")}>
          {formatCurrency(data.liabilityAmount)}
        </PreviewRow>
      </PreviewSection>

      <PreviewSection title={t("people.assign.previewSection.signature")}>
        {signaturePng ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signaturePng}
            alt="signature"
            className="h-20 w-auto rounded-md border border-border bg-background"
          />
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}
      </PreviewSection>

      {data.photos.length > 0 && (
        <PreviewSection title={t("people.assign.fieldPhotos")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`photo-${i + 1}`}
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
            ))}
          </div>
        </PreviewSection>
      )}

      {data.notes && (
        <PreviewSection title={t("people.assign.fieldNotes")}>
          <p className="text-sm">{data.notes}</p>
        </PreviewSection>
      )}
    </div>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ImageIcon className="mr-1 inline size-3 print:hidden" />
        {title}
      </h3>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

function PreviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
