"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Send, MessageSquare } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { selectColumn } from "@/components/data-table/select-column";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/widgets/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTickets, useMe } from "@/lib/queries";
import { bulkDelete } from "@/lib/use-bulk-delete";
import { useT } from "@/lib/i18n";
import type { HelpdeskTicket, Kpi } from "@/types";

const KPIS_TREND = Array.from({ length: 6 }, (_, i) => ({ label: `M${i + 1}`, value: 0 }));

function TicketSheet({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: HelpdeskTicket | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [currentStatus, setCurrentStatus] = useState(ticket?.status ?? "open");

  if (!ticket) return null;

  const STATUS_OPTIONS = [
    { label: t("status.open"), value: "open" },
    { label: t("status.in_progress"), value: "in_progress" },
    { label: t("status.resolved"), value: "resolved" },
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    payroll: t("people.helpdesk.catPayroll"),
    it: t("people.helpdesk.catIT"),
    facilities: t("people.helpdesk.catFacilities"),
    policy: t("people.helpdesk.catPolicy"),
    benefits: t("people.helpdesk.catBenefits"),
  };

  // Keine erfundene Kommentarhistorie (es gibt kein Kommentar-Backend).
  const EXAMPLE_COMMENTS: { author: string; time: string; text: string }[] = [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-6">{ticket.subject}</SheetTitle>
          <SheetDescription>
            {t("people.helpdesk.sheetCreatedDesc", {
              id: ticket.id,
              date: ticket.createdAt,
              assignee: ticket.assignee,
            })}
          </SheetDescription>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
            <StatusBadge status={ticket.priority} />
            <StatusBadge status={currentStatus} />
          </div>
        </SheetHeader>

        <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {t("people.helpdesk.sheetHistory")}
            </p>
            <div className="space-y-3">
              {EXAMPLE_COMMENTS.map((c, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.author}</span>
                    <span className="text-xs text-muted-foreground">{c.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.text}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {t("people.helpdesk.sheetChangeStatus")}
            </p>
            <Select
              value={currentStatus}
              onValueChange={(v) => {
                const next = v as "open" | "in_progress" | "resolved";
                setCurrentStatus(next);
                fetch(`/api/tickets/${ticket.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: next }),
                })
                  .then((r) => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
                  })
                  .catch((e) => toast.error((e as Error).message));
                toast.success(
                  t("people.helpdesk.toastStatusChanged", {
                    label: STATUS_OPTIONS.find((s) => s.value === v)?.label ?? v,
                  })
                );
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="px-6 pb-6">
          <div className="w-full space-y-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t("people.helpdesk.sheetReplyPlaceholder")}
              rows={3}
            />
            <Button
              className="w-full"
              disabled={reply.trim().length === 0}
              onClick={() => {
                toast.success(t("people.helpdesk.toastReplySent"));
                setReply("");
              }}
            >
              <Send className="size-4" /> {t("common.send")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function HelpdeskPage() {
  const t = useT();
  const { data, isLoading } = useTickets();
  const tickets = data ?? [];

  const [selected, setSelected] = useState<HelpdeskTicket | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const CATEGORY_OPTIONS = [
    { label: t("people.helpdesk.catPayroll"), value: "payroll" },
    { label: t("people.helpdesk.catIT"), value: "it" },
    { label: t("people.helpdesk.catFacilities"), value: "facilities" },
    { label: t("people.helpdesk.catPolicy"), value: "policy" },
    { label: t("people.helpdesk.catBenefits"), value: "benefits" },
  ];

  const PRIORITY_OPTIONS = [
    { label: t("status.low"), value: "low" },
    { label: t("status.medium"), value: "medium" },
    { label: t("status.high"), value: "high" },
    { label: t("status.urgent"), value: "urgent" },
  ];

  const STATUS_OPTIONS = [
    { label: t("status.open"), value: "open" },
    { label: t("status.in_progress"), value: "in_progress" },
    { label: t("status.resolved"), value: "resolved" },
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    payroll: t("people.helpdesk.catPayroll"),
    it: t("people.helpdesk.catIT"),
    facilities: t("people.helpdesk.catFacilities"),
    policy: t("people.helpdesk.catPolicy"),
    benefits: t("people.helpdesk.catBenefits"),
  };

  const ticketSchema = z.object({
    subject: z.string().min(3, t("people.helpdesk.validSubject")),
    category: z.string().min(1, t("common.required")),
    priority: z.string().min(1, t("common.required")),
    description: z.string().min(10, t("people.helpdesk.validDescription")),
  });
  type TicketFormValues = z.infer<typeof ticketSchema>;

  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;

  const kpis: Kpi[] = [
    { id: "open", label: t("people.helpdesk.kpiOpen"), value: open, format: "number", delta: 0, trend: KPIS_TREND },
    { id: "in_progress", label: t("people.helpdesk.kpiInProgress"), value: inProgress, format: "number", delta: 0, trend: KPIS_TREND },
    { id: "resolved", label: t("people.helpdesk.kpiResolved"), value: resolved, format: "number", delta: 0, trend: KPIS_TREND },
  ];

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: "", category: "", priority: "", description: "" },
  });

  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const createTicket = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const requester = me ? `${me.employee.firstName} ${me.employee.lastName}` : "—";
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: values.subject,
          requester,
          category: values.category,
          priority: values.priority,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_d, values) => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(t("people.helpdesk.toastCreated", { subject: values.subject }));
      form.reset();
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onCreateTicket(values: TicketFormValues) {
    createTicket.mutate(values);
  }

  const columns: ColumnDef<HelpdeskTicket>[] = [
    selectColumn<HelpdeskTicket>(),
    {
      accessorKey: "subject",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.helpdesk.colSubject")} />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm truncate max-w-[220px]">{row.original.subject}</span>
        </div>
      ),
    },
    {
      accessorKey: "requester",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.helpdesk.colRequester")} />,
      cell: ({ row }) => <span className="text-sm">{row.original.requester}</span>,
    },
    {
      accessorKey: "category",
      header: t("common.category"),
      cell: ({ row }) => (
        <Badge variant="outline">{CATEGORY_LABELS[row.original.category]}</Badge>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "priority",
      header: t("common.priority"),
      cell: ({ row }) => <StatusBadge status={row.original.priority} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.helpdesk.colCreatedAt")} />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.createdAt}</span>
      ),
    },
    {
      accessorKey: "assignee",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("people.helpdesk.colAssignee")} />,
      cell: ({ row }) => <span className="text-sm">{row.original.assignee}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("people.helpdesk.title")}
        description={t("people.helpdesk.desc")}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus /> {t("people.helpdesk.createBtn")}
          </Button>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi, i) => (
          <StaggerItem key={kpi.id}>
            <KpiCard kpi={kpi} accent={(i % 5) + 1} />
          </StaggerItem>
        ))}
      </Stagger>

      <FadeIn>
        <DataTable
          columns={columns}
          data={tickets}
          loading={isLoading}
          searchKey="subject"
          searchPlaceholder={t("people.helpdesk.searchPlaceholder")}
          facets={[
            { columnId: "category", title: t("people.helpdesk.filterCategory"), options: CATEGORY_OPTIONS },
            { columnId: "priority", title: t("common.priority"), options: PRIORITY_OPTIONS },
            { columnId: "status", title: t("common.status"), options: STATUS_OPTIONS },
          ]}
          onRowClick={(ticket) => {
            setSelected(ticket);
            setSheetOpen(true);
          }}
          onBulkDelete={(rows) => bulkDelete("tickets", "tickets", rows)}
          pageSize={10}
        />
      </FadeIn>

      <TicketSheet ticket={selected} open={sheetOpen} onOpenChange={setSheetOpen} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("people.helpdesk.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("people.helpdesk.dialogDesc")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateTicket)} className="space-y-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("people.helpdesk.labelSubject")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("people.helpdesk.subjectPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.category")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("people.helpdesk.selectPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.priority")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("people.helpdesk.selectPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("people.helpdesk.labelDescription")}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder={t("people.helpdesk.descPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">{t("common.cancel")}</Button>
                </DialogClose>
                <Button type="submit">{t("people.helpdesk.submitTicket")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
