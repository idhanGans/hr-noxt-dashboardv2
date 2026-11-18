"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import {
  AlertOctagon,
  FileText,
  Lock,
  MoreHorizontal,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  Shield,
  ShieldOff,
  Trash2,
  Unlock,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import type { ColumnDef, Table as TanstackTable } from "@tanstack/react-table";
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
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { AssignAssetWizard } from "@/components/people/assign-asset-wizard";
import { useAssets, useEmployees } from "@/lib/queries";
import { bulkDelete } from "@/lib/use-bulk-delete";
import { cn, formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Asset, Kpi } from "@/types";

// Fixed "today" — keeps warranty / age math deterministic between SSR and CSR.
const TODAY = new Date(Date.UTC(2026, 4, 30));
const MS_PER_DAY = 86_400_000;
const SOON_DAYS = 30;
const TREND_STUB: { label: string; value: number }[] = Array.from(
  { length: 6 },
  (_, i) => ({ label: `M${i + 1}`, value: 0 }),
);

type CategoryTab = "all" | Asset["category"];
type WarrantyState = "active" | "expired" | "soon";
type OffboardingFilter = "all" | "offboarding";

function warrantyState(iso?: string): WarrantyState {
  if (!iso) return "active";
  const diff = (Date.parse(iso) - TODAY.getTime()) / MS_PER_DAY;
  if (diff < 0) return "expired";
  if (diff <= SOON_DAYS) return "soon";
  return "active";
}

function yearsBetween(from: string, to: Date): number {
  return (to.getTime() - Date.parse(from)) / (365.25 * MS_PER_DAY);
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

export default function AssetsPage() {
  const t = useT();
  const { data, isLoading } = useAssets();
  const { data: emp = [] } = useEmployees();
  const assetRows = useMemo(() => data ?? [], [data]);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("all");
  const [offboardingFilter, setOffboardingFilter] = useState<OffboardingFilter>("all");
  const tableRef = useRef<TanstackTable<Asset> | null>(null);

  // ----- Labels & options -----
  const CATEGORY_LABELS: Record<Asset["category"], string> = {
    laptop: t("people.assets.catLaptop"),
    phone: t("people.assets.catPhone"),
    monitor: t("people.assets.catMonitor"),
    access_card: t("people.assets.catAccessCard"),
    vehicle: t("people.assets.catVehicle"),
  };
  const CONDITION_LABELS: Record<NonNullable<Asset["condition"]>, string> = {
    new: t("people.assets.condition.new"),
    good: t("people.assets.condition.good"),
    damaged: t("people.assets.condition.damaged"),
  };
  const WARRANTY_LABELS: Record<WarrantyState, string> = {
    active: t("people.assets.warrantyActive"),
    expired: t("people.assets.warrantyExpired"),
    soon: t("people.assets.warrantySoon"),
  };

  const STATUS_OPTIONS = [
    { label: t("status.assigned"), value: "assigned" },
    { label: t("status.available"), value: "available" },
    { label: t("status.maintenance"), value: "maintenance" },
    { label: t("status.retired"), value: "retired" },
    { label: t("status.lost"), value: "lost" },
    { label: t("status.disposed"), value: "disposed" },
  ];

  const WARRANTY_OPTIONS = [
    { label: t("people.assets.warrantyActive"), value: "active" },
    { label: t("people.assets.warrantyExpired"), value: "expired" },
    { label: t("people.assets.warrantySoon"), value: "soon" },
  ];

  const vendorOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assetRows) if (a.vendor) counts.set(a.vendor, (counts.get(a.vendor) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([v]) => ({ value: v, label: v }));
  }, []);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of assetRows) if (a.location) set.add(a.location);
    return Array.from(set).map((l) => ({ value: l, label: l }));
  }, []);

  // ----- Offboarding pending count -----
  const offboardingNames = useMemo(() => {
    const set = new Set<string>();
    for (const e of emp) {
      if (e.status === "offboarding") set.add(`${e.firstName} ${e.lastName}`);
    }
    return set;
  }, [emp]);
  const offboardingPendingCount = useMemo(
    () =>
      assetRows.filter(
        (a) =>
          a.status === "assigned" && a.assignedTo && offboardingNames.has(a.assignedTo),
      ).length,
    [offboardingNames],
  );

  // ----- KPI computation -----
  const totalAssignedValue = assetRows
    .filter((a) => a.status === "assigned")
    .reduce((s, a) => s + (a.purchasePrice ?? 0), 0);
  const totalAvailableValue = assetRows
    .filter((a) => a.status === "available")
    .reduce((s, a) => s + (a.purchasePrice ?? 0), 0);
  const assignedCount = assetRows.filter((a) => a.status === "assigned").length;
  const availableCount = assetRows.filter((a) => a.status === "available").length;
  const maintenanceCount = assetRows.filter((a) => a.status === "maintenance").length;
  const warrantyExpiredCount = assetRows.filter(
    (a) => warrantyState(a.warrantyUntil) === "expired",
  ).length;
  const avgAgeYears = useMemo(() => {
    if (assetRows.length === 0) return 0;
    const sum = assetRows.reduce((s, a) => s + yearsBetween(a.purchaseDate, TODAY), 0);
    return Math.round((sum / assetRows.length) * 10) / 10;
  }, []);

  const kpis: Kpi[] = [
    {
      id: "asset-assigned",
      label: t("people.assets.kpiAssigned"),
      value: assignedCount,
      format: "number",
      delta: 0,
      trend: TREND_STUB,
    },
    {
      id: "asset-available",
      label: t("people.assets.kpiAvailable"),
      value: availableCount,
      format: "number",
      delta: 0,
      trend: TREND_STUB,
    },
    {
      id: "asset-maintenance",
      label: t("people.assets.kpiMaintenance"),
      value: maintenanceCount,
      format: "number",
      delta: 0,
      trend: TREND_STUB,
    },
    {
      id: "asset-warranty-expired",
      label: t("people.assets.kpiWarrantyExpired"),
      value: warrantyExpiredCount,
      format: "number",
      delta: 0,
      trend: TREND_STUB,
    },
    {
      id: "asset-age",
      label: t("people.assets.kpiAge"),
      value: avgAgeYears,
      format: "number",
      delta: 0,
      trend: TREND_STUB,
    },
  ];

  // ----- Wizard preselection -----
  const [preselectAssetId, setPreselectAssetId] = useState<string | undefined>(undefined);
  function openWizardWith(assetId?: string) {
    setPreselectAssetId(assetId);
    setAssignDialogOpen(true);
  }
  function handleWizardOpenChange(open: boolean) {
    setAssignDialogOpen(open);
    if (!open) setPreselectAssetId(undefined);
  }

  // ----- Filtered data (offboarding toggle is client-side) -----
  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (offboardingFilter === "all") return rows;
    return rows.filter(
      (a) =>
        a.status === "assigned" && a.assignedTo && offboardingNames.has(a.assignedTo),
    );
  }, [data, offboardingFilter, offboardingNames]);

  // ----- Category tabs drive the column filter -----
  function applyCategoryTab(tab: CategoryTab) {
    setCategoryTab(tab);
    const table = tableRef.current;
    table?.getColumn("category")?.setFilterValue(tab === "all" ? undefined : tab);
  }

  function openSheet(asset: Asset) {
    setSelected(asset);
    setSheetOpen(true);
  }

  // ----- Columns -----
  const columns: ColumnDef<Asset>[] = [
    selectColumn<Asset>(),
    {
      accessorKey: "assetTag",
      header: t("people.assets.colAssetTag"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.assetTag ?? "—"}
        </span>
      ),
      meta: { label: t("people.assets.colAssetTag") },
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title={t("common.name")} />,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.name}</span>
      ),
      meta: { label: t("common.name") },
    },
    {
      accessorKey: "category",
      header: t("people.assets.colCategory"),
      cell: ({ row }) => (
        <Badge variant="secondary">{CATEGORY_LABELS[row.original.category]}</Badge>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.assets.colCategory") },
    },
    {
      accessorKey: "vendor",
      header: t("people.assets.colVendor"),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.vendor ?? "—"}</span>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.assets.colVendor") },
    },
    {
      accessorKey: "serial",
      header: t("people.assets.colSerial"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.serial}</span>
      ),
      meta: { label: t("people.assets.colSerial") },
    },
    {
      accessorKey: "assignedTo",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("people.assets.colAssignedTo")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.assignedTo ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
      meta: { label: t("people.assets.colAssignedTo") },
    },
    {
      accessorKey: "assignedSince",
      header: t("people.assets.colSince"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.assignedSince ?? "—"}
        </span>
      ),
      meta: { label: t("people.assets.colSince") },
    },
    {
      accessorKey: "location",
      header: t("people.assets.colLocation"),
      cell: ({ row }) => <span className="text-sm">{row.original.location ?? "—"}</span>,
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("people.assets.colLocation") },
    },
    {
      accessorKey: "warrantyUntil",
      header: t("people.assets.colWarranty"),
      cell: ({ row }) => {
        const iso = row.original.warrantyUntil;
        const state = warrantyState(iso);
        return (
          <span
            className={cn(
              "font-mono text-xs",
              state === "expired" && "text-destructive font-semibold",
              state === "soon" && "text-warning font-semibold",
              state === "active" && "text-muted-foreground",
            )}
          >
            {iso ?? "—"}
          </span>
        );
      },
      meta: { label: t("people.assets.colWarranty") },
    },
    // Synthetic column for the warranty-state facet.
    {
      id: "warrantyState",
      accessorFn: (row) => warrantyState(row.warrantyUntil),
      header: t("people.assets.filterWarranty"),
      cell: ({ row }) => {
        const s = warrantyState(row.original.warrantyUntil);
        return (
          <Badge
            variant={s === "expired" ? "destructive" : s === "soon" ? "warning" : "muted"}
          >
            {WARRANTY_LABELS[s]}
          </Badge>
        );
      },
      filterFn: (row, _id, value) => warrantyState(row.original.warrantyUntil) === value,
      meta: { label: t("people.assets.filterWarranty") },
    },
    {
      accessorKey: "condition",
      header: t("people.assets.colCondition"),
      cell: ({ row }) => {
        const c = row.original.condition;
        if (!c) return <span className="text-xs text-muted-foreground">—</span>;
        const variant = c === "new" ? "info" : c === "good" ? "success" : "destructive";
        return <Badge variant={variant}>{CONDITION_LABELS[c]}</Badge>;
      },
      meta: { label: t("people.assets.colCondition") },
    },
    {
      accessorKey: "os",
      header: t("people.assets.colOs"),
      cell: ({ row }) => {
        const a = row.original;
        if (a.category !== "laptop") return <span className="text-xs text-muted-foreground">—</span>;
        return <span className="text-xs">{a.os ?? "—"}</span>;
      },
      meta: { label: t("people.assets.colOs") },
    },
    {
      id: "encryption",
      header: t("people.assets.colEncryption"),
      cell: ({ row }) => {
        const a = row.original;
        if (a.category !== "laptop")
          return <span className="text-xs text-muted-foreground">—</span>;
        return a.encryptionEnabled ? (
          <span
            className="inline-flex items-center gap-1 text-success"
            title={t("people.assets.encryptionOn")}
          >
            <Lock className="size-3.5" />
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-destructive"
            title={t("people.assets.encryptionOff")}
          >
            <Unlock className="size-3.5" />
          </span>
        );
      },
      meta: { label: t("people.assets.colEncryption") },
    },
    {
      accessorKey: "insuranceCovered",
      header: t("people.assets.colInsurance"),
      cell: ({ row }) =>
        row.original.insuranceCovered ? (
          <span
            className="inline-flex items-center gap-1 text-success"
            title={t("people.assets.insuranceCovered")}
          >
            <Shield className="size-3.5" />
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-muted-foreground"
            title={t("people.assets.insuranceNone")}
          >
            <ShieldOff className="size-3.5" />
          </span>
        ),
      meta: { label: t("people.assets.colInsurance") },
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => row.getValue(id) === value,
      meta: { label: t("common.status") },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const asset = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                // The assign wizard only sources available assets — preselecting
                // an id whose status isn't `available` silently drops it.
                disabled={asset.status !== "available"}
                onClick={(e) => {
                  e.stopPropagation();
                  openWizardWith(asset.id);
                }}
              >
                <UserCheck /> {t("people.assets.actionAssign")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  toast.success(t("people.assets.toastReturned", { name: asset.name }));
                }}
              >
                <RotateCcw /> {t("people.assets.actionReturn")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  toast.warning(t("people.assets.toastMaintenance", { name: asset.name }));
                }}
              >
                <Wrench /> {t("people.assets.actionMaintenance")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.error(t("people.assets.toastLost", { name: asset.name }));
                }}
              >
                <AlertOctagon /> {t("people.assets.actionLost")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  toast.message(t("people.assets.toastDisposed", { name: asset.name }));
                }}
              >
                <Trash2 /> {t("people.assets.actionDispose")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  toast.success(t("people.assets.toastHandoverPdf", { name: asset.name }));
                }}
              >
                <FileText /> {t("people.assets.actionHandoverPdf")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // ----- Render -----
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title={t("people.assets.title")}
          description={t("people.assets.desc")}
          actions={
            <Button onClick={() => openWizardWith(undefined)}>
              <Plus /> {t("people.assets.assignBtn")}
            </Button>
          }
          className="flex-1"
        />
        <Card
          className={cn(
            "shrink-0 lg:w-72",
            offboardingPendingCount > 0 && "border-warning/40 bg-warning/[0.06]",
          )}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                offboardingPendingCount > 0
                  ? "bg-warning/15 text-warning"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <AlertOctagon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-snug text-muted-foreground">
                {t("people.assets.offboardingPending", { count: offboardingPendingCount })}
              </p>
              {offboardingFilter === "all" ? (
                <button
                  type="button"
                  disabled={offboardingPendingCount === 0}
                  onClick={() => setOffboardingFilter("offboarding")}
                  className="mt-0.5 cursor-pointer text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                >
                  {t("people.assets.offboardingClick")} →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOffboardingFilter("all")}
                  className="mt-0.5 cursor-pointer text-xs font-semibold text-primary hover:underline"
                >
                  {t("people.assets.offboardingClear")}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI row */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StaggerItem>
          <KpiCard
            kpi={kpis[0]}
            accent={1}
            hideDelta
            meta={t("people.assets.kpiAssignedMeta", {
              value: formatCurrency(totalAssignedValue),
            })}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            kpi={kpis[1]}
            accent={2}
            hideDelta
            meta={t("people.assets.kpiAvailableMeta", {
              value: formatCurrency(totalAvailableValue),
            })}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard kpi={kpis[2]} accent={3} hideDelta />
        </StaggerItem>
        <StaggerItem>
          <div
            className={cn(
              "rounded-xl",
              warrantyExpiredCount > 0 &&
                "ring-1 ring-destructive/40 shadow-[0_0_0_4px_color-mix(in_oklch,var(--destructive)_12%,transparent)]",
            )}
          >
            <KpiCard kpi={kpis[3]} accent={4} hideDelta />
          </div>
        </StaggerItem>
        <StaggerItem>
          <KpiCard kpi={kpis[4]} accent={5} hideDelta />
        </StaggerItem>
      </Stagger>

      {/* Category tabs */}
      <Tabs
        value={categoryTab}
        onValueChange={(v) => applyCategoryTab(v as CategoryTab)}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">{t("people.assets.tabAll")}</TabsTrigger>
          <TabsTrigger value="laptop">{t("people.assets.tabLaptops")}</TabsTrigger>
          <TabsTrigger value="phone">{t("people.assets.tabPhones")}</TabsTrigger>
          <TabsTrigger value="monitor">{t("people.assets.tabMonitors")}</TabsTrigger>
          <TabsTrigger value="access_card">{t("people.assets.tabCards")}</TabsTrigger>
          <TabsTrigger value="vehicle">{t("people.assets.tabVehicles")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <FadeIn>
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          searchKey="name"
          searchPlaceholder={t("people.assets.searchPlaceholder")}
          facets={[
            {
              columnId: "vendor",
              title: t("people.assets.filterVendor"),
              options: vendorOptions,
            },
            {
              columnId: "warrantyState",
              title: t("people.assets.filterWarranty"),
              options: WARRANTY_OPTIONS,
            },
            {
              columnId: "location",
              title: t("people.assets.filterLocation"),
              options: locationOptions,
            },
            {
              columnId: "status",
              title: t("common.status"),
              options: STATUS_OPTIONS,
            },
          ]}
          initialColumnVisibility={{
            warrantyState: false,
            serial: false,
            assignedSince: false,
            os: false,
            encryption: false,
            insuranceCovered: false,
          }}
          onTableReady={(tbl) => {
            tableRef.current = tbl as unknown as TanstackTable<Asset>;
          }}
          onRowClick={openSheet}
          onBulkDelete={(rows) => bulkDelete("assets", "assets", rows)}
          pageSize={10}
        />
      </FadeIn>

      <AssetDetailSheet
        asset={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* Assign-asset wizard (replaces the previous single-screen dialog) */}
      <AssignAssetWizard
        open={assignDialogOpen}
        onOpenChange={handleWizardOpenChange}
        defaultAssetId={preselectAssetId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Detail sheet
// ---------------------------------------------------------------------

type T = (k: string, v?: Record<string, string | number>) => string;

function AssetDetailSheet({
  asset,
  open,
  onOpenChange,
}: {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const [damageDraft, setDamageDraft] = useState("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full overflow-y-auto">
        {asset && (
          <>
            <SheetHeader className="pb-3">
              <div className="flex items-start gap-3 pt-2">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Receipt className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <SheetTitle>{asset.name}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2">
                    <span className="font-mono">{asset.assetTag}</span>
                    <span>·</span>
                    <StatusBadge status={asset.status} />
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="details" className="px-6 pb-6">
              <TabsList className="flex-wrap">
                <TabsTrigger value="details">{t("people.assets.drawerTabDetails")}</TabsTrigger>
                <TabsTrigger value="history">{t("people.assets.drawerTabHistory")}</TabsTrigger>
                <TabsTrigger value="damage">{t("people.assets.drawerTabDamage")}</TabsTrigger>
                <TabsTrigger value="docs">{t("people.assets.drawerTabDocs")}</TabsTrigger>
                <TabsTrigger value="qr">{t("people.assets.drawerTabQr")}</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <DetailsList asset={asset} t={t} />
              </TabsContent>

              <TabsContent value="history">
                <HistoryTimeline asset={asset} t={t} />
              </TabsContent>

              <TabsContent value="damage">
                <DamageLog
                  asset={asset}
                  t={t}
                  draft={damageDraft}
                  setDraft={setDamageDraft}
                />
              </TabsContent>

              <TabsContent value="docs">
                <DocsList asset={asset} t={t} />
              </TabsContent>

              <TabsContent value="qr">
                <AssetTagPanel
                  tag={asset.assetTag ?? asset.id}
                  caption={t("people.assets.qrCaption")}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailsList({ asset, t }: { asset: Asset; t: T }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("people.assets.detailsAssetTag"), value: <span className="font-mono">{asset.assetTag ?? "—"}</span> },
    { label: t("people.assets.detailsVendor"), value: asset.vendor ?? "—" },
    {
      label: t("people.assets.detailsPurchasePrice"),
      value: asset.purchasePrice != null ? formatCurrency(asset.purchasePrice) : "—",
    },
    { label: t("people.assets.detailsPurchaseDate"), value: asset.purchaseDate },
    {
      label: t("people.assets.detailsWarrantyUntil"),
      value: (() => {
        const s = warrantyState(asset.warrantyUntil);
        return (
          <span
            className={cn(
              "font-mono",
              s === "expired" && "text-destructive font-semibold",
              s === "soon" && "text-warning font-semibold",
            )}
          >
            {asset.warrantyUntil ?? "—"}
          </span>
        );
      })(),
    },
    { label: t("people.assets.detailsLocation"), value: asset.location ?? "—" },
    {
      label: t("people.assets.detailsCondition"),
      value: asset.condition ? t(`people.assets.condition.${asset.condition}`) : "—",
    },
  ];

  if (asset.category === "laptop") {
    rows.push({ label: t("people.assets.detailsOs"), value: asset.os ?? "—" });
    rows.push({
      label: t("people.assets.detailsEncryption"),
      value: asset.encryptionEnabled ? (
        <span className="inline-flex items-center gap-1 text-success">
          <Lock className="size-3.5" /> {t("people.assets.encryptionOn")}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-destructive">
          <Unlock className="size-3.5" /> {t("people.assets.encryptionOff")}
        </span>
      ),
    });
  }

  rows.push({ label: t("people.assets.detailsAssignedSince"), value: asset.assignedSince ?? "—" });
  rows.push({
    label: t("people.assets.detailsInsurance"),
    value: asset.insuranceCovered ? (
      <span className="inline-flex items-center gap-1 text-success">
        <Shield className="size-3.5" /> {t("people.assets.insuranceCovered")}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <ShieldOff className="size-3.5" /> {t("people.assets.insuranceNone")}
      </span>
    ),
  });
  if (asset.notes) rows.push({ label: t("people.assets.detailsNotes"), value: asset.notes });

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className="font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HistoryTimeline({ asset, t }: { asset: Asset; t: T }) {
  // Keine erfundene Verlaufshistorie (kein History-Backend) — nur der aktuelle Status unten.
  const holders: string[] = [];
  const dates: string[] = [];

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      <li className="relative">
        <span className="absolute -left-[26px] top-1.5 inline-block size-2.5 rounded-full bg-info ring-2 ring-background" />
        <p className="text-sm font-medium">
          {asset.assignedTo
            ? t("people.assets.historyAssigned", { name: asset.assignedTo })
            : t("status.available")}
        </p>
        <p className="text-xs text-muted-foreground">{asset.assignedSince ?? "—"}</p>
      </li>
      {holders.map((h, i) => (
        <React.Fragment key={h}>
          <li className="relative">
            <span className="absolute -left-[26px] top-1.5 inline-block size-2.5 rounded-full bg-muted-foreground ring-2 ring-background" />
            <p className="text-sm font-medium">{t("people.assets.historyReturned")}</p>
            <p className="text-xs text-muted-foreground">{dates[i]}</p>
          </li>
          <li className="relative">
            <span className="absolute -left-[26px] top-1.5 inline-block size-2.5 rounded-full bg-info/70 ring-2 ring-background" />
            <p className="text-sm font-medium">
              {t("people.assets.historyAssigned", { name: h })}
            </p>
            <p className="text-xs text-muted-foreground">{dates[i]}</p>
          </li>
        </React.Fragment>
      ))}
    </ol>
  );
}

function DamageLog({
  asset,
  t,
  draft,
  setDraft,
}: {
  asset: Asset;
  t: T;
  draft: string;
  setDraft: (v: string) => void;
}) {
  const entries: { date: string; text: string }[] = [];
  if (asset.notes) {
    entries.push({ date: "—", text: asset.notes });
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
          {t("people.assets.damageEmpty")}
        </p>
      ) : (
        entries.map((e, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <p className="mb-1 text-xs text-muted-foreground">{e.date}</p>
            <p className="text-sm">{e.text}</p>
          </div>
        ))
      )}
      <Separator />
      <Textarea
        rows={3}
        value={draft}
        onChange={(ev) => setDraft(ev.target.value)}
        placeholder={t("people.assets.damagePlaceholder")}
      />
      <Button
        className="w-full"
        disabled={draft.trim().length === 0}
        onClick={() => {
          toast.success(t("people.assets.damageToast"));
          setDraft("");
        }}
      >
        <Send className="size-4" />
        {t("people.assets.damageAddBtn")}
      </Button>
    </div>
  );
}

function DocsList({ asset, t }: { asset: Asset; t: T }) {
  // Kein Dokumenten-Backend -> leer (keine erfundenen Dateien).
  const docs: { date: string }[] = [];
  return (
    <div className="space-y-2">
      {docs.map((d) => {
        const name = t("people.assets.docName", { date: d.date });
        return (
          <div
            key={d.date}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{asset.assetTag}</p>
              </div>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => toast.success(t("people.assets.docDownloadToast", { name }))}
            >
              <X className="size-4 rotate-45" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Asset-Tag-Anzeige — zeigt die eindeutige Inventarnummer gross und klar.
// (Frueher ein dekorativer Fake-QR; ohne QR-Bibliothek nicht echt scannbar,
//  deshalb durch die echte Kennung ersetzt.)
// ---------------------------------------------------------------------

function AssetTagPanel({ tag, caption }: { tag: string; caption: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="rounded-lg border border-border bg-muted/40 px-8 py-6">
        <p className="font-mono text-2xl font-semibold tracking-[0.2em]">{tag}</p>
      </div>
      <p className="text-sm text-muted-foreground">{caption}</p>
    </div>
  );
}
