"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
import {
  UserCog,
  Building2,
  ChevronRight,
  CalendarPlus,
  Stethoscope,
  Clock,
  Receipt,
  Home,
  FileDown,
  FileText,
  GraduationCap,
  CalendarCheck,
  HeartHandshake,
  CreditCard,
  Shield,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { QuickActions, type QuickAction } from "@/components/widgets/quick-actions";
import { ActivityFeed } from "@/components/widgets/activity-feed";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deriveBicFromIban, isValidIban } from "@/lib/iban";
import { cn, initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, useActivity, type MeData } from "@/lib/queries";
import type { ActivityItem, Skill } from "@/types";

// "Self" = the logged-in employee, provided by the page wrapper from /api/me.
const SelfContext = React.createContext<MeData | null>(null);
function useSelf(): MeData {
  const value = React.useContext(SelfContext);
  if (!value) throw new Error("SelfContext is required");
  return value;
}

// Fixed "today" for skill-expiry math.
const TODAY = new Date(Date.UTC(2026, 4, 30));
const MS_PER_DAY = 86_400_000;
const EXPIRY_WARN_DAYS = 30;

function isSkillExpiringSoon(skill: Skill): boolean {
  if (!skill.expiresAt) return false;
  const diff = (Date.parse(skill.expiresAt) - TODAY.getTime()) / MS_PER_DAY;
  return diff >= 0 && diff <= EXPIRY_WARN_DAYS;
}

// ---------------------------------------------------------------------
// Profile edit-dialog v2 — tabbed structure
// ---------------------------------------------------------------------

type EditTab = "contact" | "address" | "bank" | "emergency";

interface EditFormValues {
  contact: { firstName: string; lastName: string; email: string; phone: string };
  address: { street: string; zip: string; city: string; country: string };
  bank: { iban: string; bic: string; bankName: string };
  emergency: Array<{ name: string; relation: string; phone: string; email?: string }>;
}

const RELATION_OPTIONS = [
  "partner",
  "parent",
  "sibling",
  "friend",
  "other",
] as const;
const COUNTRY_OPTIONS = ["DE", "AT", "CH", "FR", "IT", "ES", "NL", "PL"] as const;

/**
 * Returns only the keys whose value changed between `orig` and `next`.
 * Deep walk; arrays compared as a whole via JSON.stringify so additions /
 * removals show up too.
 */
function diffObjects(
  orig: unknown,
  next: unknown,
  prefix = "",
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const origR = (orig ?? {}) as Record<string, unknown>;
  const nextR = (next ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(nextR)) {
    const a = origR[key];
    const b = nextR[key];
    if (
      b !== null &&
      typeof b === "object" &&
      !Array.isArray(b) &&
      a !== null &&
      typeof a === "object" &&
      !Array.isArray(a)
    ) {
      Object.assign(out, diffObjects(a, b, prefix + key + "."));
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[prefix + key] = { from: a, to: b };
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

function EssContent() {
  const t = useT();
  const self = useSelf();
  const queryClient = useQueryClient();
  const managerName = self.manager
    ? `${self.manager.firstName} ${self.manager.lastName}`
    : "—";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>("contact");
  const [sickDialogOpen, setSickDialogOpen] = useState(false);
  const [whistleOpen, setWhistleOpen] = useState(false);
  const [sickFile, setSickFile] = useState<string | null>(null);
  const sickFileRef = React.useRef<HTMLInputElement | null>(null);

  // ----- Profile edit form (tabbed: contact / address / bank / emergency) ---
  const phoneRegex = /^\+?[0-9 ]{6,}$/;

  const editDefaults: EditFormValues = useMemo(
    () => ({
      contact: {
        firstName: self.employee.firstName,
        lastName: self.employee.lastName,
        email: self.employee.email,
        phone: self.employee.phone ?? "",
      },
      address: {
        street: self.employee.address?.street ?? "",
        zip: self.employee.address?.zip ?? "",
        city: self.employee.address?.city ?? "",
        country: self.employee.address?.country ?? "DE",
      },
      bank: {
        iban: self.employee.iban ?? "",
        bic: self.employee.bic ?? "",
        bankName: "",
      },
      emergency: [{ name: "", relation: "", phone: "", email: "" }],
    }),
    [self.employee],
  );

  const editSchema = z.object({
    contact: z.object({
      firstName: z.string().min(1, t("common.required")),
      lastName: z.string().min(1, t("common.required")),
      email: z.string().email(t("people.ess.validEmail")),
      phone: z
        .string()
        .regex(phoneRegex, t("people.ess.editV2.errPhoneInvalid")),
    }),
    address: z.object({
      street: z.string().min(1, t("common.required")),
      zip: z.string().min(1, t("common.required")),
      city: z.string().min(1, t("common.required")),
      country: z.string().min(1, t("common.required")),
    }),
    bank: z.object({
      iban: z
        .string()
        .refine((v) => v === "" || isValidIban(v), {
          message: t("people.ess.editV2.errIbanInvalid"),
        }),
      bic: z.string(),
      bankName: z.string(),
    }),
    emergency: z
      .array(
        z.object({
          name: z.string().min(1, t("common.required")),
          relation: z.string().min(1, t("common.required")),
          phone: z
            .string()
            .regex(phoneRegex, t("people.ess.editV2.errPhoneInvalid")),
          email: z
            .string()
            .email(t("people.ess.validEmail"))
            .optional()
            .or(z.literal("")),
        }),
      )
      .max(2),
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: editDefaults,
    mode: "onChange",
  });

  const {
    fields: emergencyFields,
    append: appendEmergency,
    remove: removeEmergency,
  } = useFieldArray({ control: editForm.control, name: "emergency" });

  // Derive BIC from IBAN as the user types (editable; only fires on valid IBAN).
  const ibanValue = editForm.watch("bank.iban");
  const ibanValid = ibanValue.length > 0 && isValidIban(ibanValue);
  React.useEffect(() => {
    if (!ibanValid) return;
    const next = deriveBicFromIban(ibanValue);
    if (next && editForm.getValues("bank.bic") !== next) {
      editForm.setValue("bank.bic", next, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [ibanValid, ibanValue, editForm]);

  function openEdit(tab: EditTab = "contact") {
    setEditTab(tab);
    setDialogOpen(true);
  }

  function handleEditOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      editForm.reset(editDefaults);
      setEditTab("contact");
    }
  }

  async function onSubmitEdit(values: EditFormValues) {
    try {
      const res = await fetch(`/api/employees/${self.employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.contact.firstName,
          lastName: values.contact.lastName,
          email: values.contact.email,
          phone: values.contact.phone,
          addressStreet: values.address.street,
          addressZip: values.address.zip,
          addressCity: values.address.city,
          addressCountry: values.address.country,
          iban: values.bank.iban,
          bic: values.bank.bic,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("people.ess.editV2.toastSubmitted"));
      handleEditOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // ----- Sick-report form -----
  const sickSchema = z
    .object({
      start: z.string().min(1, t("common.required")),
      end: z.string().min(1, t("common.required")),
      note: z.string().optional(),
    })
    .refine(
      (d) => {
        // Skip cross-field check while either field is empty —
        // per-field `min(1)` already reports those.
        if (!d.start || !d.end) return true;
        const start = Date.parse(d.start);
        const end = Date.parse(d.end);
        if (Number.isNaN(start) || Number.isNaN(end)) return true;
        return end >= start;
      },
      {
        message: t("people.ess.sick.errEndBeforeStart"),
        path: ["end"],
      },
    );
  type SickFormValues = z.infer<typeof sickSchema>;
  const sickForm = useForm<SickFormValues>({
    resolver: zodResolver(sickSchema),
    defaultValues: { start: "", end: "", note: "" },
  });
  async function onSubmitSick(values: SickFormValues) {
    const days =
      Math.round((Date.parse(values.end) - Date.parse(values.start)) / MS_PER_DAY) + 1;
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sick",
          startDate: values.start,
          endDate: values.end,
          days,
          reason: values.note,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      void queryClient.invalidateQueries({ queryKey: ["leave"] });
      toast.success(t("people.ess.sick.toastSubmitted", { days }));
      sickForm.reset();
      setSickFile(null);
      if (sickFileRef.current) sickFileRef.current.value = "";
      setSickDialogOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // ----- Self-service tiles -----
  const TILES: QuickAction[] = [
    {
      label: t("people.ess.actions.requestLeave.label"),
      description: t("people.ess.actions.requestLeave.desc"),
      href: "/attendance/leave",
      icon: CalendarPlus,
    },
    {
      label: t("people.ess.actions.reportSick.label"),
      description: t("people.ess.actions.reportSick.desc"),
      onClick: () => setSickDialogOpen(true),
      icon: Stethoscope,
    },
    {
      label: t("people.ess.actions.trackTime.label"),
      description: t("people.ess.actions.trackTime.desc"),
      href: "/attendance/timesheet",
      icon: Clock,
    },
    {
      label: t("people.ess.actions.submitReimb.label"),
      description: t("people.ess.actions.submitReimb.desc"),
      href: "/payroll/reimbursements",
      icon: Receipt,
    },
    {
      label: t("people.ess.actions.requestHo.label"),
      description: t("people.ess.actions.requestHo.desc"),
      onClick: () => toast.success(t("people.ess.actions.toastHo")),
      icon: Home,
    },
    {
      label: t("people.ess.actions.downloadPayslip.label"),
      description: t("people.ess.actions.downloadPayslip.desc"),
      href: "/payroll/payslips",
      icon: FileDown,
    },
    {
      label: t("people.ess.actions.downloadTaxCert.label"),
      description: t("people.ess.actions.downloadTaxCert.desc"),
      onClick: () => toast.success(t("people.ess.actions.toastTaxCert")),
      icon: FileText,
    },
    {
      label: t("people.ess.actions.requestTraining.label"),
      description: t("people.ess.actions.requestTraining.desc"),
      onClick: () => toast.success(t("people.ess.actions.toastTraining")),
      icon: GraduationCap,
    },
    {
      label: t("people.ess.actions.book1on1.label"),
      description: t("people.ess.actions.book1on1.desc"),
      onClick: () =>
        toast.success(
          t("people.ess.actions.toast1on1", {
            manager: managerName,
          }),
        ),
      icon: CalendarCheck,
    },
    {
      label: t("people.ess.actions.updateEmergency.label"),
      description: t("people.ess.actions.updateEmergency.desc"),
      onClick: () => openEdit("emergency"),
      icon: HeartHandshake,
    },
    {
      label: t("people.ess.actions.updateBank.label"),
      description: t("people.ess.actions.updateBank.desc"),
      onClick: () => openEdit("bank"),
      icon: CreditCard,
    },
    {
      label: t("people.ess.actions.whistleblower.label"),
      description: t("people.ess.actions.whistleblower.desc"),
      onClick: () => setWhistleOpen(true),
      icon: Shield,
    },
  ];

  // ----- Activity-Feed (eigene Events aus der API) -----
  const { data: activityData = [] } = useActivity();
  const selfName = `${self.employee.firstName} ${self.employee.lastName}`;
  const myActivity: ActivityItem[] = useMemo(
    () => activityData.slice(0, 5).map((a) => ({ ...a, actor: selfName })),
    [activityData, selfName],
  );

  // ----- Vacation donut -----
  const vacation = self.employee.vacationBalance ?? { used: 0, total: 28 };
  const remaining = Math.max(0, vacation.total - vacation.used);
  const donutData = [
    { name: t("people.ess.vacationUsed"), value: vacation.used, color: "var(--chart-3)" },
    { name: t("people.ess.vacationRemaining"), value: remaining, color: "var(--chart-2)" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("people.ess.title")}
        description={t("people.ess.desc")}
        actions={
          <Button onClick={() => openEdit("contact")}>
            <UserCog /> {t("people.ess.editBtn")}
          </Button>
        }
      />

      {/* Top row: Profile (left) + Organisation (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn>
          <ProfileCard
            t={t}
            donutData={donutData}
            vacation={vacation}
            remaining={remaining}
          />
        </FadeIn>

        <div className="lg:col-span-2">
          <FadeIn delay={0.05}>
            <OrganisationCard t={t} />
          </FadeIn>
        </div>
      </div>

      {/* Self-Service tiles (12) */}
      <FadeIn delay={0.1}>
        <QuickActions
          title={t("people.ess.actions.tilesTitle")}
          actions={TILES}
          cols={4}
        />
      </FadeIn>

      {/* Lower row: Skills + Trainings + Goals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn>
          <SkillsCard t={t} />
        </FadeIn>
        <FadeIn delay={0.05}>
          <TrainingsCard t={t} />
        </FadeIn>
        <FadeIn delay={0.1}>
          <GoalsCard t={t} />
        </FadeIn>
      </div>

      {/* Activity feed */}
      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("people.ess.secActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={myActivity} />
          </CardContent>
        </Card>
      </FadeIn>

      {/* Profile-edit dialog v2 (tabbed) */}
      <Dialog open={dialogOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("people.ess.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("people.ess.editV2.subtitle")}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="space-y-4"
            >
              <Tabs
                value={editTab}
                onValueChange={(v) => setEditTab(v as EditTab)}
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="contact">
                    {t("people.ess.editV2.tabContact")}
                  </TabsTrigger>
                  <TabsTrigger value="address">
                    {t("people.ess.editV2.tabAddress")}
                  </TabsTrigger>
                  <TabsTrigger value="bank">
                    {t("people.ess.editV2.tabBank")}
                  </TabsTrigger>
                  <TabsTrigger value="emergency">
                    {t("people.ess.editV2.tabEmergency")}
                  </TabsTrigger>
                </TabsList>

                {/* --- Kontakt --- */}
                <TabsContent value="contact" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={editForm.control}
                      name="contact.firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("people.ess.labelFirstName")}</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="contact.lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("people.ess.labelLastName")}</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={editForm.control}
                    name="contact.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("people.ess.labelEmail")}</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="contact.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("people.ess.labelPhone")}</FormLabel>
                        <FormControl><Input type="tel" inputMode="tel" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* --- Adresse --- */}
                <TabsContent value="address" className="space-y-4 mt-4">
                  <FormField
                    control={editForm.control}
                    name="address.street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("people.ess.editV2.fieldStreet")}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-[1fr_2fr] gap-3">
                    <FormField
                      control={editForm.control}
                      name="address.zip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("people.ess.editV2.fieldZip")}</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="address.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("people.ess.editV2.fieldCity")}</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={editForm.control}
                    name="address.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("people.ess.editV2.fieldCountry")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRY_OPTIONS.map((c) => (
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

                  {/* Warning banner */}
                  <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/[0.08] p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    <p>{t("people.ess.editV2.addressWarning")}</p>
                  </div>
                </TabsContent>

                {/* --- Bankdaten --- */}
                <TabsContent value="bank" className="space-y-4 mt-4">
                  {/* Persistent red banner */}
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/[0.06] p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p>{t("people.ess.editV2.bankWarning")}</p>
                  </div>

                  {/* Bankdaten — direkt bearbeitbar (keine Fake-Verifizierung). */}
                  <fieldset className="space-y-4 rounded-lg border border-border p-3">
                    <FormField
                      control={editForm.control}
                      name="bank.iban"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("people.ess.editV2.bankFieldIban")}
                          </FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                {...field}
                                className={cn(ibanValid && "pr-9")}
                              />
                            </FormControl>
                            {ibanValid && (
                              <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-success" />
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={editForm.control}
                        name="bank.bic"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("people.ess.editV2.bankFieldBic")}
                            </FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="bank.bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("people.ess.editV2.bankFieldBankName")}
                            </FormLabel>
                            <FormControl><Input readOnly {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </fieldset>
                </TabsContent>

                {/* --- Notfallkontakt --- */}
                <TabsContent value="emergency" className="space-y-4 mt-4">
                  {emergencyFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="space-y-3 rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {index === 0
                            ? "1. " + t("people.ess.editV2.tabEmergency")
                            : "2. " + t("people.ess.editV2.tabEmergency")}
                        </p>
                        {emergencyFields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeEmergency(index)}
                          >
                            <Trash2 className="size-3.5" />
                            {t("people.ess.editV2.emergencyRemove")}
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={editForm.control}
                          name={`emergency.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("people.ess.editV2.fieldEmergencyName")}
                              </FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name={`emergency.${index}.relation`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("people.ess.editV2.fieldEmergencyRelation")}
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {RELATION_OPTIONS.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {t(`people.ess.editV2.relation.${r}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={editForm.control}
                          name={`emergency.${index}.phone`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("people.ess.editV2.fieldEmergencyPhone")}
                              </FormLabel>
                              <FormControl>
                                <Input type="tel" inputMode="tel" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name={`emergency.${index}.email`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("people.ess.editV2.fieldEmergencyEmail")}
                              </FormLabel>
                              <FormControl>
                                <Input type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                  {emergencyFields.length < 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendEmergency({
                          name: "",
                          relation: "",
                          phone: "",
                          email: "",
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                      {t("people.ess.editV2.emergencyAdd")}
                    </Button>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    {t("common.cancel")}
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={
                    !editForm.formState.isDirty || !editForm.formState.isValid
                  }
                >
                  {t("people.ess.editV2.submitBtn")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Krankmeldung dialog */}
      <Dialog open={sickDialogOpen} onOpenChange={setSickDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("people.ess.sick.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("people.ess.sick.dialogDesc")}</DialogDescription>
          </DialogHeader>
          <Form {...sickForm}>
            <form onSubmit={sickForm.handleSubmit(onSubmitSick)} className="space-y-4">
              <div>
                <p className="mb-1.5 text-sm font-medium">
                  {t("people.ess.sick.fieldType")}
                </p>
                <Badge variant="info">{t("people.ess.sick.typeAu")}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={sickForm.control}
                  name="start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("people.ess.sick.fieldStart")}</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={sickForm.control}
                  name="end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("people.ess.sick.fieldEnd")}</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={sickForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("people.ess.sick.fieldNote")}</FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <p className="mb-1.5 text-sm font-medium">{t("people.ess.sick.fieldFile")}</p>
                <Input
                  ref={sickFileRef}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setSickFile(e.target.files?.[0]?.name ?? null)}
                />
                {sickFile && (
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">
                    {sickFile}
                  </p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">{t("common.cancel")}</Button>
                </DialogClose>
                <Button type="submit">{t("people.ess.sick.submitBtn")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Hinweisgeber-Verfahren — echte Erklaerung statt Toast. */}
      <Dialog open={whistleOpen} onOpenChange={setWhistleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("people.ess.whistle.title")}</DialogTitle>
            <DialogDescription>{t("people.ess.whistle.intro")}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{t("people.ess.whistle.point1")}</li>
            <li>{t("people.ess.whistle.point2")}</li>
            <li>{t("people.ess.whistle.point3")}</li>
          </ul>
          <DialogFooter>
            <DialogClose asChild>
              <Button>{t("common.close")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------

type T = (k: string, v?: Record<string, string | number>) => string;

export default function EssPage() {
  const { data: me } = useMe();
  if (!me) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
      </div>
    );
  }
  return (
    <SelfContext.Provider value={me}>
      <EssContent />
    </SelfContext.Provider>
  );
}

function ProfileCard({
  t,
  donutData,
  vacation,
  remaining,
}: {
  t: T;
  donutData: { name: string; value: number; color: string }[];
  vacation: { used: number; total: number };
  remaining: number;
}) {
  const self = useSelf();
  const selfName = `${self.employee.firstName} ${self.employee.lastName}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("people.ess.profileCard")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Avatar — Foto-Upload folgt mit dem Datei-Upload (kein Fake-Toast). */}
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar className="size-20">
            <AvatarFallback className="text-xl font-semibold">
              {initials(selfName)}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-base font-semibold">{selfName}</p>
            <p className="text-sm text-muted-foreground">{self.employee.jobTitle}</p>
            <Badge variant="outline" className="mt-1">
              {self.employee.department}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Vacation donut */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("people.ess.vacationDonutTitle")}
          </p>
          <div className="flex items-center gap-3">
            <div className="relative size-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    innerRadius={42}
                    outerRadius={60}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {donutData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-xl font-semibold tabular-nums">
                  {remaining}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  / {vacation.total}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: "var(--chart-3)" }}
                  />
                  {t("people.ess.vacationUsed")}
                </span>
                <span className="font-mono tabular-nums">{vacation.used}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: "var(--chart-2)" }}
                  />
                  {t("people.ess.vacationRemaining")}
                </span>
                <span className="font-mono tabular-nums">{remaining}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">{t("people.ess.vacationDays", { n: vacation.total })}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Contract readonly */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("people.ess.contractReadonlyTitle")}
          </p>
          <dl className="space-y-2 text-sm">
            <ReadonlyRow
              label={t("people.list.fieldContractType")}
              value={
                self.employee.contractType
                  ? t(`people.list.contractType.${self.employee.contractType}`)
                  : "—"
              }
            />
            <ReadonlyRow
              label={t("people.employees.sheet.fieldHireDate")}
              value={self.employee.hireDate}
            />
            <ReadonlyRow
              label={t("people.list.fieldWeeklyHours")}
              value={self.employee.weeklyHours ? `${self.employee.weeklyHours} h` : "—"}
            />
            <ReadonlyRow
              label={t("people.list.fieldVacation")}
              value={
                self.employee.vacationEntitlement
                  ? t("people.ess.vacationDays", { n: self.employee.vacationEntitlement })
                  : "—"
              }
            />
            <ReadonlyRow
              label={t("people.ess.vacationRemaining")}
              value={t("people.ess.vacationDays", { n: remaining })}
            />
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

function OrganisationCard({ t }: { t: T }) {
  const self = useSelf();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">{t("people.ess.orgCard")}</CardTitle>
        </div>
        <CardDescription>{t("people.ess.orgDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {self.skipLevel && (
          <OrgRow
            label={t("people.ess.skipLevelLabel")}
            person={self.skipLevel}
          />
        )}
        {self.manager && <OrgRow label={t("people.ess.manager")} person={self.manager} />}

        {self.reports.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("people.ess.directReports", { count: self.reports.length })}
            </p>
            <Stagger className="space-y-2">
              {self.reports.map((report) => (
                <StaggerItem key={report.id}>
                  <OrgListItem person={report} />
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}

        {self.peers.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("people.ess.teamPeersLabel")}
            </p>
            <div className="space-y-2">
              {self.peers.map((p) => (
                <OrgListItem key={p.id} person={p} muted />
              ))}
            </div>
          </div>
        )}

        <Link
          href="/people/org-chart"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {t("people.ess.viewOrgChart")}
          <ChevronRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

function OrgRow({
  label,
  person,
}: {
  label: string;
  person: { firstName: string; lastName: string; jobTitle: string };
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-2.5 rounded-lg border border-border p-3">
        <Avatar className="size-9">
          <AvatarFallback className="text-sm font-semibold">
            {initials(`${person.firstName} ${person.lastName}`)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {person.firstName} {person.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{person.jobTitle}</p>
        </div>
      </div>
    </div>
  );
}

function OrgListItem({
  person,
  muted = false,
}: {
  person: { firstName: string; lastName: string; jobTitle: string; location: string };
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border p-2.5",
        muted && "bg-muted/30",
      )}
    >
      <Avatar className="size-8">
        <AvatarFallback className="text-xs font-semibold">
          {initials(`${person.firstName} ${person.lastName}`)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {person.firstName} {person.lastName}
        </p>
        <p className="truncate text-xs text-muted-foreground">{person.jobTitle}</p>
      </div>
      <Badge variant="outline" className="shrink-0">{person.location}</Badge>
    </div>
  );
}

function SkillsCard({ t }: { t: T }) {
  const self = useSelf();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("people.ess.secSkills")}</CardTitle>
      </CardHeader>
      <CardContent>
        {self.skills.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("people.ess.skills.empty")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {self.skills.map((s) => {
              const warn = isSkillExpiringSoon(s);
              return (
                <div
                  key={s.id}
                  className={cn(
                    "inline-flex flex-col items-start gap-0.5 rounded-md border border-border bg-card px-2.5 py-1.5",
                    warn && "border-destructive/60 bg-destructive/[0.04]",
                  )}
                  title={
                    s.expiresAt
                      ? t("people.ess.skills.expiresIn", { date: s.expiresAt })
                      : t("people.ess.skills.noExpiry")
                  }
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {warn && <AlertCircle className="size-3 text-destructive" />}
                    {t(`people.ess.skills.category.${s.category}`)}
                    {s.expiresAt && <span>· {s.expiresAt}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrainingsCard({ t }: { t: T }) {
  const self = useSelf();
  const items = self.trainings;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("people.ess.secTrainings")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="p-5 text-center text-sm text-muted-foreground">
            {t("people.ess.trainings.empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("people.ess.trainings.colName")}</TableHead>
                <TableHead>{t("people.ess.trainings.colDue")}</TableHead>
                <TableHead>{t("people.ess.trainings.colStatus")}</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((trn) => (
                <TableRow key={trn.id}>
                  <TableCell className="font-medium">{trn.name}</TableCell>
                  <TableCell className="font-mono text-xs">{trn.dueDate}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        trn.status === "due"
                          ? "pending"
                          : trn.status === "upcoming"
                            ? "scheduled"
                            : "completed"
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {trn.status !== "completed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toast.success(
                            t("people.ess.trainings.toastStart", { name: trn.name }),
                          )
                        }
                      >
                        <Play className="size-3.5" />
                        {t("people.ess.trainings.startBtn")}
                      </Button>
                    ) : (
                      <CheckCircle2 className="ml-auto size-4 text-success" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function GoalsCard({ t }: { t: T }) {
  const self = useSelf();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("people.ess.secGoals")}</CardTitle>
      </CardHeader>
      <CardContent>
        {self.careerGoals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("people.ess.goals.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {self.careerGoals.map((g) => (
              <div
                key={g.id}
                className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-tight">{g.title}</p>
                  <span className="text-xs font-mono tabular-nums text-muted-foreground">
                    {g.progress}%
                  </span>
                </div>
                <Progress value={g.progress} className="h-1.5" />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t("people.ess.goals.lastUpdate", { date: g.lastUpdate })}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
