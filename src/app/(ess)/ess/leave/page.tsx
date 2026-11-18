"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/lib/i18n";
import { useLeaveRequests, useMe } from "@/lib/queries";

export default function LeavePage() {
  const t = useT();
  const { data: leaveRequests = [] } = useLeaveRequests();
  const { data: me } = useMe();
  const [open, setOpen] = React.useState(false);

  // Live-Kontingente: aus dem Urlaubskonto bzw. genommenen Antraegen (0 wenn leer).
  const vac = me?.employee?.vacationBalance;
  const annualTotal = vac?.total ?? me?.employee?.vacationEntitlement ?? 0;
  const annualUsed =
    vac?.used ??
    leaveRequests.filter((r) => r.type === "annual").reduce((s, r) => s + r.days, 0);
  const annualRemaining = Math.max(0, annualTotal - annualUsed);
  const sickUsed = leaveRequests
    .filter((r) => r.type === "sick")
    .reduce((s, r) => s + r.days, 0);

  const LEAVE_TYPE_LABELS: Record<string, string> = {
    annual: t("ess.leave.typeAnnual"),
    sick: t("ess.leave.typeSick"),
    parental: t("ess.leave.typeParental"),
    unpaid: t("ess.leave.typeUnpaid"),
    bereavement: t("ess.leave.typeBereavement"),
  };

  const leaveSchema = z.object({
    type: z.string().min(1, t("ess.leave.validationType")),
    startDate: z.string().min(1, t("ess.leave.validationStart")),
    endDate: z.string().min(1, t("ess.leave.validationEnd")),
    reason: z.string().min(5, t("ess.leave.validationReason")),
  });

  type LeaveFormValues = z.infer<typeof leaveSchema>;

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: "", startDate: "", endDate: "", reason: "" },
  });

  const queryClient = useQueryClient();
  const createLeave = useMutation({
    mutationFn: async (values: LeaveFormValues) => {
      // Tage aus dem Zeitraum berechnen (inkl. Start- und Endtag).
      const start = new Date(values.startDate);
      const end = new Date(values.endDate);
      const days = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
      );
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          startDate: values.startDate,
          endDate: values.endDate,
          days,
          reason: values.reason,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_d, values) => {
      void queryClient.invalidateQueries({ queryKey: ["leave"] });
      toast.success(
        t("ess.leave.toastSubmitted", { type: LEAVE_TYPE_LABELS[values.type] ?? values.type }),
      );
      form.reset();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: LeaveFormValues) {
    createLeave.mutate(values);
  }

  return (
    <div className="space-y-5">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold">{t("ess.leave.title")}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("ess.leave.subtitle")}
            </p>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="min-h-9">
                <Plus className="mr-1.5 size-4" />
                {t("ess.leave.btnApply")}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
              <SheetHeader className="px-6 pb-4 pt-6">
                <SheetTitle>{t("ess.leave.sheetTitle")}</SheetTitle>
              </SheetHeader>
              <div className="px-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("ess.leave.fieldType")}</FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <SelectTrigger className="min-h-12">
                                <SelectValue placeholder={t("ess.leave.placeholderType")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="annual">{t("ess.leave.typeAnnual")}</SelectItem>
                                <SelectItem value="sick">{t("ess.leave.typeSick")}</SelectItem>
                                <SelectItem value="parental">{t("ess.leave.typeParental")}</SelectItem>
                                <SelectItem value="unpaid">{t("ess.leave.typeUnpaid")}</SelectItem>
                                <SelectItem value="bereavement">{t("ess.leave.typeBereavement")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("ess.leave.fieldFrom")}</FormLabel>
                            <FormControl>
                              <Input type="date" className="min-h-12" {...field} />
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
                            <FormLabel>{t("ess.leave.fieldTo")}</FormLabel>
                            <FormControl>
                              <Input type="date" className="min-h-12" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("ess.leave.fieldReason")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t("ess.leave.placeholderReason")}
                              className="min-h-24 resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <SheetFooter className="mt-2 px-0">
                      <Button type="submit" className="w-full min-h-12">
                        {t("ess.leave.btnSubmit")}
                      </Button>
                    </SheetFooter>
                  </form>
                </Form>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t("ess.leave.annualBalance")}</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">
                {annualRemaining}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {annualTotal} {t("ess.leave.days")}
                </span>
              </p>
              <Progress
                value={annualTotal > 0 ? (annualRemaining / annualTotal) * 100 : 0}
                className="mt-2 h-1.5"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t("ess.leave.sickBalance")}</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">
                {sickUsed}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {t("ess.leave.days")}
                </span>
              </p>
              <Progress
                value={0}
                className="mt-2 h-1.5"
                indicatorClassName="bg-warning"
              />
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("ess.leave.myRequests")}
          </h2>
          <Stagger className="space-y-2">
            {leaveRequests.slice(0, 6).map((req) => (
              <StaggerItem key={req.id}>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {LEAVE_TYPE_LABELS[req.type] ?? req.type}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {req.startDate} – {req.endDate}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {req.days} {req.days === 1 ? t("ess.leave.day") : t("ess.leave.days")} · {req.reason}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </FadeIn>
    </div>
  );
}
