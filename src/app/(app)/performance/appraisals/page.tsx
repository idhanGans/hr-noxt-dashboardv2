"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/components/widgets/kpi-card";
import { ChartCard } from "@/components/widgets/chart-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useT } from "@/lib/i18n";
import { useAppraisals, useEmployees } from "@/lib/queries";
import type { Employee, TimeSeriesPoint } from "@/types";

function buildPerformanceDistribution(emps: Employee[]): TimeSeriesPoint[] {
  const buckets: Record<string, number> = {
    "< 70": 0,
    "70–79": 0,
    "80–89": 0,
    "90+": 0,
  };
  emps.forEach((e) => {
    const s = e.performanceScore;
    if (s < 70) buckets["< 70"]++;
    else if (s < 80) buckets["70–79"]++;
    else if (s < 90) buckets["80–89"]++;
    else buckets["90+"]++;
  });
  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
}


export default function AppraisalsPage() {
  const t = useT();
  const { data: employees = [] } = useEmployees();
  const { data: pastAppraisals = [] } = useAppraisals();
  const performanceDistData = React.useMemo(
    () => buildPerformanceDistribution(employees),
    [employees],
  );

  const COMPETENCES = [
    { name: "fachkompetenz" as const, label: t("performance.appraisals.competence.fachkompetenz") },
    { name: "zusammenarbeit" as const, label: t("performance.appraisals.competence.zusammenarbeit") },
    { name: "kommunikation" as const, label: t("performance.appraisals.competence.kommunikation") },
    { name: "eigeninitiative" as const, label: t("performance.appraisals.competence.eigeninitiative") },
  ];

  const appraisalSchema = z.object({
    employee: z.string().min(1, t("common.required")),
    fachkompetenz: z.string().min(1, t("common.required")),
    zusammenarbeit: z.string().min(1, t("common.required")),
    kommunikation: z.string().min(1, t("common.required")),
    eigeninitiative: z.string().min(1, t("common.required")),
    comment: z.string().min(5, t("performance.appraisals.form.commentMin")),
    overallRating: z.string().min(1, t("common.required")),
  });
  type AppraisalFormValues = z.infer<typeof appraisalSchema>;

  const form = useForm<AppraisalFormValues>({
    resolver: zodResolver(appraisalSchema),
    defaultValues: {
      employee: "",
      fachkompetenz: "",
      zusammenarbeit: "",
      kommunikation: "",
      eigeninitiative: "",
      comment: "",
      overallRating: "",
    },
  });

  const queryClient = useQueryClient();
  const createAppraisal = useMutation({
    mutationFn: async (values: AppraisalFormValues) => {
      const res = await fetch("/api/appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: values.employee, // employee code
          quarter: "Q2 2026",
          overallRating: Number(values.overallRating),
          comment: values.comment,
          scoreFachkompetenz: Number(values.fachkompetenz),
          scoreZusammenarbeit: Number(values.zusammenarbeit),
          scoreKommunikation: Number(values.kommunikation),
          scoreEigeninitiative: Number(values.eigeninitiative),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      toast.success(t("performance.appraisals.toast.saved"));
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: AppraisalFormValues) {
    createAppraisal.mutate(values);
  }

  const avgScore = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.performanceScore, 0) / employees.length)
    : 0;
  const completedReviews = pastAppraisals.filter((a) => a.status === "completed").length;
  const openReviews = Math.max(0, employees.length - completedReviews * 12);

  const kpis = [
    { id: "avg-score", label: t("performance.appraisals.kpi.avgScore"), value: avgScore, format: "number" as const, delta: 0, trend: [] },
    { id: "completed-reviews", label: t("performance.appraisals.kpi.completedReviews"), value: completedReviews, format: "number" as const, delta: 0, trend: [] },
    { id: "open-reviews", label: t("performance.appraisals.kpi.openReviews"), value: openReviews, format: "number" as const, delta: 0, trend: [] },
  ];

  const ratingOptions = [
    { value: "1", label: t("performance.appraisals.rating.1") },
    { value: "2", label: t("performance.appraisals.rating.2") },
    { value: "3", label: t("performance.appraisals.rating.3") },
    { value: "4", label: t("performance.appraisals.rating.4") },
    { value: "5", label: t("performance.appraisals.rating.5") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("performance.appraisals.title")}
        description={t("performance.appraisals.desc")}
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi, i) => (
          <StaggerItem key={kpi.id}>
            <KpiCard kpi={kpi} accent={(i % 5) + 1} />
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appraisal form */}
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle>{t("performance.appraisals.form.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="employee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("performance.appraisals.form.employee")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder={t("performance.appraisals.form.employeePlaceholder")} /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.slice(0, 30).map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.firstName} {e.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {COMPETENCES.map((comp) => (
                      <FormField
                        key={comp.name}
                        control={form.control}
                        name={comp.name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{comp.label}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="1–5" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ratingOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>

                  <FormField control={form.control} name="comment" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("performance.appraisals.form.comment")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("performance.appraisals.form.commentPlaceholder")}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="overallRating" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("performance.appraisals.form.overallRating")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="1–5" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ratingOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button type="submit" className="w-full">{t("performance.appraisals.form.save")}</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Right side */}
        <div className="space-y-6">
          <FadeIn delay={0.05}>
            <Card>
              <CardHeader>
                <CardTitle>{t("performance.appraisals.past.title")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {pastAppraisals.map((appraisal) => (
                    <div key={appraisal.id} className="flex items-center justify-between px-6 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{appraisal.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{appraisal.quarter}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold">{appraisal.overallRating}/5</span>
                        <StatusBadge status={appraisal.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.1}>
            <ChartCard
              title={t("performance.appraisals.chart.title")}
              description={t("performance.appraisals.chart.desc")}
              type="bar"
              data={performanceDistData}
              series={["value"]}
              seriesLabels={{ value: t("series.value") }}
              height={220}
            />
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
