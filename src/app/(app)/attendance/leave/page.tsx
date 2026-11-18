"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { CalendarWidget } from "@/components/widgets/calendar-widget";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { useLeaveRequests, useMe } from "@/lib/queries";
import { bulkDelete } from "@/lib/use-bulk-delete";
import { useT } from "@/lib/i18n";
import type { LeaveRequest } from "@/types";

export default function LeavePage() {
  const t = useT();
  const { data, isLoading } = useLeaveRequests();
  const { data: me } = useMe();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const queryClient = useQueryClient();

  // Approve/reject a pending request, then refresh the list.
  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approve" | "reject" }) => {
      const res = await fetch(`/api/leave/${id}/${decision}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["leave"] });
      toast.success(
        vars.decision === "approve"
          ? t("attendance.leave.toastApproved")
          : t("attendance.leave.toastRejected"),
      );
    },
    onError: (err: Error) =>
      toast.error(t("attendance.leave.toastDecisionError"), { description: err.message }),
  });

  const LEAVE_LABELS: Record<string, string> = {
    annual: t("attendance.leave.typeAnnual"),
    sick: t("attendance.leave.typeSick"),
    parental: t("attendance.leave.typeParental"),
    unpaid: t("attendance.leave.typeUnpaid"),
    bereavement: t("attendance.leave.typeBereavement"),
  };

  const LEAVE_TYPE_OPTIONS = [
    { label: t("attendance.leave.typeAnnual"), value: "annual" },
    { label: t("attendance.leave.typeSick"), value: "sick" },
    { label: t("attendance.leave.typeParental"), value: "parental" },
    { label: t("attendance.leave.typeUnpaid"), value: "unpaid" },
    { label: t("attendance.leave.typeBereavement"), value: "bereavement" },
  ];

  const STATUS_OPTIONS = [
    { label: "Ausstehend", value: "pending" },
    { label: "Genehmigt", value: "approved" },
    { label: "Abgelehnt", value: "rejected" },
    { label: "Storniert", value: "cancelled" },
  ];

  const leaveSchema = z.object({
    type: z.string().min(1, t("attendance.leave.errTypeRequired")),
    startDate: z.string().min(1, t("attendance.leave.errStartRequired")),
    endDate: z.string().min(1, t("attendance.leave.errEndRequired")),
    reason: z.string().min(5, t("attendance.leave.errReasonMin")),
  });

  type LeaveForm = z.infer<typeof leaveSchema>;

  const columns: ColumnDef<LeaveRequest>[] = [
    selectColumn<LeaveRequest>(),
    {
      accessorKey: "employeeName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("attendance.leave.colEmployee")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.employeeName}</span>
      ),
    },
    {
      accessorKey: "type",
      header: t("common.type"),
      cell: ({ row }) => (
        <Badge variant="outline">
          {LEAVE_LABELS[row.original.type] ?? row.original.type}
        </Badge>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "days",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("attendance.leave.colDays")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.days}d</span>
      ),
    },
    {
      accessorKey: "startDate",
      header: t("attendance.leave.colFrom"),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.startDate}</span>
      ),
    },
    {
      accessorKey: "endDate",
      header: t("attendance.leave.colTo"),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.endDate}</span>
      ),
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("attendance.leave.colActions")}</span>,
      cell: ({ row }) => {
        const lr = row.original;
        if (lr.status !== "pending") return null;
        return (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={decide.isPending}
              onClick={() => openEdit(lr)}
            >
              <Pencil className="size-3.5" />
              <span className="sr-only">{t("common.edit")}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: lr.id, decision: "approve" })}
            >
              {t("common.approve")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: lr.id, decision: "reject" })}
            >
              {t("common.reject")}
            </Button>
          </div>
        );
      },
    },
  ];

  // Kontingente aus dem Urlaubskonto bzw. genommenen Antraegen (0 wenn leer).
  const leaveRows = data ?? [];
  const vac = me?.employee?.vacationBalance;
  const annualTotal = vac?.total ?? me?.employee?.vacationEntitlement ?? 0;
  const annualTaken =
    vac?.used ?? leaveRows.filter((r) => r.type === "annual").reduce((s, r) => s + r.days, 0);
  const sickTaken = leaveRows.filter((r) => r.type === "sick").reduce((s, r) => s + r.days, 0);
  const leaveBalances = [
    {
      label: t("attendance.leave.balanceAnnual"),
      total: annualTotal,
      remaining: Math.max(0, annualTotal - annualTaken),
      taken: annualTaken,
      color: "bg-chart-1",
    },
    {
      label: t("attendance.leave.balanceSick"),
      total: 0,
      remaining: 0,
      taken: sickTaken,
      color: "bg-chart-3",
    },
  ];

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: "", startDate: "", endDate: "", reason: "" },
  });

  // Create a leave request via the API, then refresh the list.
  const createLeave = useMutation({
    mutationFn: async (values: LeaveForm) => {
      const start = new Date(values.startDate).getTime();
      const end = new Date(values.endDate).getTime();
      const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
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
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, values) => {
      void queryClient.invalidateQueries({ queryKey: ["leave"] });
      toast.success(t("attendance.leave.toastSubmittedTitle"), {
        description: `${LEAVE_LABELS[values.type] ?? values.type} vom ${values.startDate} bis ${values.endDate}`,
      });
      form.reset();
      setDialogOpen(false);
    },
    onError: (err: Error) =>
      toast.error(t("attendance.leave.toastDecisionError"), { description: err.message }),
  });

  // Bearbeitet einen noch ausstehenden Antrag (PATCH), dann Liste aktualisieren.
  const updateLeave = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: LeaveForm }) => {
      const start = new Date(values.startDate).getTime();
      const end = new Date(values.endDate).getTime();
      const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
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
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leave"] });
      toast.success(t("attendance.leave.toastUpdated"));
      form.reset();
      setEditing(null);
      setDialogOpen(false);
    },
    onError: (err: Error) =>
      toast.error(t("attendance.leave.toastDecisionError"), { description: err.message }),
  });

  function openCreate() {
    setEditing(null);
    form.reset({ type: "", startDate: "", endDate: "", reason: "" });
    setDialogOpen(true);
  }

  function openEdit(lr: LeaveRequest) {
    setEditing(lr);
    form.reset({
      type: lr.type,
      startDate: lr.startDate,
      endDate: lr.endDate,
      reason: lr.reason,
    });
    setDialogOpen(true);
  }

  function onSubmitLeave(values: LeaveForm) {
    if (editing) {
      updateLeave.mutate({ id: editing.id, values });
    } else {
      createLeave.mutate(values);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("attendance.leave.title")}
        description={t("attendance.leave.desc")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            {t("attendance.leave.requestLeave")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {leaveBalances.map((b) => (
              <StaggerItem key={b.label}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      {b.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="font-display text-3xl font-semibold">
                        {b.remaining}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t("attendance.leave.balanceOf", {
                          total: String(b.total),
                        })}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${b.color}`}
                        style={{
                          width: `${b.total > 0 ? (b.remaining / b.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("attendance.leave.balanceTaken", {
                        taken: String(b.taken),
                      })}
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>

          <FadeIn>
            <DataTable
              columns={columns}
              data={data ?? []}
              loading={isLoading}
              searchKey="employeeName"
              searchPlaceholder={t("common.search")}
              facets={[
                {
                  columnId: "type",
                  title: t("attendance.leave.facetType"),
                  options: LEAVE_TYPE_OPTIONS,
                },
                {
                  columnId: "status",
                  title: t("common.status"),
                  options: STATUS_OPTIONS,
                },
              ]}
              onBulkDelete={(rows) => bulkDelete("leave", "leave", rows)}
              pageSize={8}
            />
          </FadeIn>
        </div>

        <FadeIn delay={0.1}>
          <CalendarWidget title={t("attendance.leave.calendarTitle")} />
        </FadeIn>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("attendance.leave.dialogEditTitle") : t("attendance.leave.dialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmitLeave)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("attendance.leave.fieldType")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "attendance.leave.fieldTypePlaceholder",
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LEAVE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
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
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("attendance.leave.fieldFrom")}</FormLabel>
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
                      <FormLabel>{t("attendance.leave.fieldTo")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                    <FormLabel>{t("attendance.leave.fieldReason")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t(
                          "attendance.leave.fieldReasonPlaceholder",
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
                  {editing ? t("common.save") : t("attendance.leave.submitBtn")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
