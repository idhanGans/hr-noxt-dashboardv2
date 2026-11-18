"use client";

import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/widgets/kpi-card";
import { ChartCard } from "@/components/widgets/chart-card";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useT } from "@/lib/i18n";
import { useGoals, useEmployees } from "@/lib/queries";
import type { Goal } from "@/types";

function NewGoalDialog() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data: employees = [] } = useEmployees();
  const queryClient = useQueryClient();

  const goalSchema = z.object({
    title: z.string().min(2, t("common.required")),
    type: z.string().min(1, t("common.required")),
    employeeName: z.string().min(1, t("common.required")), // hier: Mitarbeiter-Code
    quarter: z.string().min(1, t("common.required")),
    weight: z
      .number()
      .min(1, t("performance.goals.form.weightMin"))
      .max(100, t("performance.goals.form.weightMax")),
  });
  type GoalFormValues = z.infer<typeof goalSchema>;

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: { title: "", type: "", employeeName: "", quarter: "Q2 2026", weight: 20 },
  });

  const createGoal = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: values.employeeName, // ist der Mitarbeiter-Code aus dem Select
          title: values.title,
          type: values.type,
          quarter: values.quarter,
          weight: values.weight,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_d, values) => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success(t("performance.goals.toast.created", { title: values.title }));
      form.reset();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: GoalFormValues) {
    createGoal.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> {t("performance.goals.createGoal")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("performance.goals.newDialog.title")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("performance.goals.form.goalTitle")}</FormLabel>
                <FormControl><Input placeholder={t("performance.goals.form.goalTitlePlaceholder")} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("performance.goals.form.type")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder={t("performance.goals.form.select")} /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="okr">OKR</SelectItem>
                      <SelectItem value="kpi">KPI</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quarter" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("performance.goals.form.quarter")}</FormLabel>
                  <FormControl><Input placeholder={t("performance.goals.form.quarterPlaceholder")} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="employeeName" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("performance.goals.form.employee")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder={t("performance.goals.form.employeePlaceholder")} /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="weight" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("performance.goals.form.weight")}</FormLabel>
                <FormControl><Input type="number" min={1} max={100} {...field} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit">{t("performance.goals.form.submit")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function GoalsPage() {
  const t = useT();
  const { data: goals = [], isLoading } = useGoals();

  const columns: ColumnDef<Goal>[] = [
    selectColumn<Goal>(),
    {
      accessorKey: "employeeName",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("performance.goals.table.employee")} />,
      cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span>,
    },
    {
      accessorKey: "title",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("performance.goals.table.goal")} />,
      cell: ({ row }) => <span className="text-sm">{row.original.title}</span>,
    },
    {
      accessorKey: "type",
      header: t("common.type"),
      filterFn: (row, id, value) => row.getValue(id) === value,
      cell: ({ row }) => (
        <Badge variant={row.original.type === "okr" ? "default" : "secondary"}>
          {row.original.type === "okr" ? "OKR" : "KPI"}
        </Badge>
      ),
    },
    {
      accessorKey: "progress",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("performance.goals.table.progress")} />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <Progress value={row.original.progress} className="h-2 flex-1" />
          <span className="text-xs font-medium text-muted-foreground w-8 text-right">
            {row.original.progress}%
          </span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      filterFn: (row, id, value) => row.getValue(id) === value,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "quarter",
      header: t("performance.goals.table.quarter"),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.quarter}</span>,
    },
    {
      accessorKey: "weight",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("performance.goals.table.weight")} />,
      cell: ({ row }) => <span className="text-sm">{row.original.weight}%</span>,
    },
  ];

  const total = goals.length;
  const onTrack = goals.filter((g) => g.status === "on_track").length;
  const atRisk = goals.filter((g) => g.status === "at_risk").length;
  const avgProgress = total > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / total) : 0;

  const kpis = [
    { id: "total-goals", label: t("performance.goals.kpi.total"), value: total, format: "number" as const, delta: 0, trend: [] },
    { id: "on-track", label: t("performance.goals.kpi.onTrack"), value: onTrack, format: "number" as const, delta: 0, trend: [] },
    { id: "at-risk", label: t("performance.goals.kpi.atRisk"), value: atRisk, format: "number" as const, delta: 0, trend: [] },
    { id: "avg-progress", label: t("performance.goals.kpi.avgProgress"), value: avgProgress, format: "percent" as const, delta: 0, trend: [] },
  ];

  const statusChartData = [
    { label: t("performance.goals.chart.onTrack"), value: goals.filter((g) => g.status === "on_track").length },
    { label: t("performance.goals.chart.atRisk"), value: goals.filter((g) => g.status === "at_risk").length },
    { label: t("performance.goals.chart.behind"), value: goals.filter((g) => g.status === "behind").length },
    { label: t("performance.goals.chart.completed"), value: goals.filter((g) => g.status === "completed").length },
  ];

  const typeOptions = [
    { label: "OKR", value: "okr" },
    { label: "KPI", value: "kpi" },
  ];

  const statusOptions = [
    { label: t("performance.goals.chart.onTrack"), value: "on_track" },
    { label: t("performance.goals.chart.atRisk"), value: "at_risk" },
    { label: t("performance.goals.chart.behind"), value: "behind" },
    { label: t("performance.goals.chart.completed"), value: "completed" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("performance.goals.title")}
        description={t("performance.goals.desc")}
        actions={<NewGoalDialog />}
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <StaggerItem key={kpi.id}>
            <KpiCard kpi={kpi} accent={(i % 5) + 1} />
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn className="lg:col-span-2">
          <DataTable
            columns={columns}
            data={goals}
            loading={isLoading}
            searchKey="employeeName"
            searchPlaceholder={t("performance.goals.search")}
            facets={[
              { columnId: "type", title: t("performance.goals.facet.type"), options: typeOptions },
              { columnId: "status", title: t("performance.goals.facet.status"), options: statusOptions },
            ]}
            pageSize={8}
          />
        </FadeIn>
        <FadeIn delay={0.1}>
          <ChartCard
            title={t("performance.goals.chart.title")}
            description={t("performance.goals.chart.desc")}
            type="bar"
            data={statusChartData}
            series={["value"]}
            seriesLabels={{ value: t("series.value") }}
            height={300}
          />
        </FadeIn>
      </div>
    </div>
  );
}
