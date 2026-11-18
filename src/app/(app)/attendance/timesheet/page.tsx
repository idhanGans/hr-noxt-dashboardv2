"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useAttendance } from "@/lib/queries";
import { bulkDelete } from "@/lib/use-bulk-delete";
import { formatNumber } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { DEPARTMENT_OPTIONS } from "@/config/options";
import type { AttendanceRecord } from "@/types";

const DEPT_OPTIONS = DEPARTMENT_OPTIONS;

const STATUS_VALUES = ["present", "remote", "late", "absent", "on_leave"] as const;

export default function TimesheetPage() {
  const t = useT();
  const { data, isLoading } = useAttendance();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Status-Labels aus dem i18n-Wörterbuch (DE/EN) statt hartkodiert.
  const STATUS_OPTIONS = STATUS_VALUES.map((value) => ({
    label: t("status." + value),
    value,
  }));

  const overtimeSchema = z.object({
    date: z.string().min(1, t("attendance.timesheet.errDateRequired")),
    hours: z
      .string()
      .min(1, t("attendance.timesheet.errHoursRequired"))
      .refine((v) => Number(v) > 0, t("attendance.timesheet.errHoursMin")),
    reason: z.string().min(5, t("attendance.timesheet.errReasonMin")),
  });

  type OvertimeForm = z.infer<typeof overtimeSchema>;

  const columns: ColumnDef<AttendanceRecord>[] = [
    selectColumn<AttendanceRecord>(),
    {
      accessorKey: "employeeName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("attendance.timesheet.colEmployee")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.employeeName}</span>
      ),
    },
    {
      accessorKey: "department",
      header: t("common.department"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.department}
        </span>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "clockIn",
      header: t("attendance.timesheet.colClockIn"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.clockIn ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "clockOut",
      header: t("attendance.timesheet.colClockOut"),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.clockOut ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "workedHours",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("attendance.timesheet.colHours")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.workedHours}h
        </span>
      ),
    },
  ];

  const rows = data ?? [];
  const totalWorked = rows.reduce((sum, r) => sum + r.workedHours, 0);
  const totalSoll = rows.length * 8;
  const overtime = Math.max(0, totalWorked - totalSoll);

  const kpis = [
    { label: t("attendance.timesheet.kpiTarget"), value: totalSoll, suffix: "h" },
    { label: t("attendance.timesheet.kpiActual"), value: totalWorked, suffix: "h" },
    { label: t("attendance.timesheet.kpiOvertime"), value: overtime, suffix: "h" },
  ];

  // Wochenuebersicht aus den echten Anwesenheitsdaten (Mo–Fr), 0h wenn keine Daten.
  const WEEKDAY_LABELS = [
    "Sonntag",
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
  ];
  const weekDays = [1, 2, 3, 4, 5].map((wd) => {
    const hours = rows
      .filter((r) => new Date(r.date).getDay() === wd)
      .reduce((s, r) => s + r.workedHours, 0);
    return {
      day: WEEKDAY_LABELS[wd],
      hours: Math.round(hours * 10) / 10,
      pct: (hours / 8) * 100,
    };
  });

  const form = useForm<OvertimeForm>({
    resolver: zodResolver(overtimeSchema),
    defaultValues: { date: "", hours: "", reason: "" },
  });

  const queryClient = useQueryClient();
  const createOvertime = useMutation({
    mutationFn: async (values: OvertimeForm) => {
      const res = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: values.date,
          hours: Number(values.hours),
          reason: values.reason,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, values) => {
      void queryClient.invalidateQueries({ queryKey: ["overtime"] });
      toast.success(t("attendance.timesheet.toastOvertimeTitle"), {
        description: t("attendance.timesheet.toastOvertimeDesc", {
          hours: values.hours,
          date: values.date,
        }),
      });
      form.reset();
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmitOvertime(values: OvertimeForm) {
    createOvertime.mutate(values);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("attendance.timesheet.title")}
        description={t("attendance.timesheet.desc")}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t("attendance.timesheet.requestOvertime")}
          </Button>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <StaggerItem key={kpi.label}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-semibold tracking-tight">
                  {formatNumber(kpi.value)}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    {kpi.suffix}
                  </span>
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("attendance.timesheet.weekTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weekDays.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="w-24 text-sm text-muted-foreground">
                  {d.day}
                </span>
                <Progress
                  value={Math.min(d.pct, 100)}
                  className="flex-1"
                  indicatorClassName={
                    d.pct > 100 ? "bg-warning" : "bg-chart-1"
                  }
                />
                <span className="w-12 text-right font-mono text-sm font-medium">
                  {d.hours}h
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.05}>
        <DataTable
          columns={columns}
          data={data ?? []}
          loading={isLoading}
          searchKey="employeeName"
          searchPlaceholder={t("common.search")}
          facets={[
            {
              columnId: "department",
              title: t("attendance.timesheet.facetDept"),
              options: DEPT_OPTIONS,
            },
            {
              columnId: "status",
              title: t("common.status"),
              options: STATUS_OPTIONS,
            },
          ]}
          onBulkDelete={(rows) => bulkDelete("attendance", "attendance", rows)}
          pageSize={10}
        />
      </FadeIn>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("attendance.timesheet.dialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmitOvertime)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("attendance.timesheet.fieldDate")}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("attendance.timesheet.fieldHours")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        placeholder={t(
                          "attendance.timesheet.fieldHoursPlaceholder",
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
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("attendance.timesheet.fieldReason")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "attendance.timesheet.fieldReasonPlaceholder",
                        )}
                        rows={3}
                        {...field}
                      />
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
                  {t("attendance.timesheet.submitBtn")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
