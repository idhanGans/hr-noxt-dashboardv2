"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Check, Download, Search, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FacetFilter {
  columnId: string;
  title: string;
  options: { label: string; value: string }[];
}

interface ToolbarProps<TData> {
  table: Table<TData>;
  searchKey?: string;
  searchPlaceholder?: string;
  facets?: FacetFilter[];
  onBulkDelete?: (rows: TData[]) => void;
  onBulkApprove?: (rows: TData[]) => void;
  onBulkReject?: (rows: TData[]) => void;
  extraToolbar?: React.ReactNode;
}

function exportCsv<TData>(table: Table<TData>, onDone: (count: number) => void) {
  const rows = table.getFilteredRowModel().rows;
  const cols = table
    .getVisibleLeafColumns()
    .filter((c) => c.id !== "select" && c.id !== "actions");
  const header = cols.map((c) => c.id).join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r.getValue(c.id);
          const s = v == null ? "" : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export.csv";
  a.click();
  URL.revokeObjectURL(url);
  onDone(rows.length);
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  facets = [],
  onBulkDelete,
  onBulkApprove,
  onBulkReject,
  extraToolbar,
}: ToolbarProps<TData>) {
  const t = useT();
  const filtered = table.getState().columnFilters.length > 0;
  const selected = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchKey && (
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder ?? t("common.search")}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn(searchKey)?.setFilterValue(e.target.value)
            }
            className="pl-9"
          />
        </div>
      )}

      {facets.map((facet) => {
        const col = table.getColumn(facet.columnId);
        if (!col) return null;
        const value = (col.getFilterValue() as string) ?? "all";
        return (
          <Select
            key={facet.columnId}
            value={value}
            onValueChange={(v) => col.setFilterValue(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="h-9 w-auto min-w-[140px]">
              <SelectValue placeholder={facet.title} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allOf", { field: facet.title })}</SelectItem>
              {facet.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}

      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.resetColumnFilters()}
        >
          {t("common.reset")} <X className="size-3.5" />
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {selected.length > 0 && onBulkApprove && (
          <Button
            variant="outline"
            size="sm"
            className="text-success"
            onClick={() => onBulkApprove(selected.map((r) => r.original))}
          >
            <Check className="size-3.5" />
            <Badge variant="success">{selected.length}</Badge>
          </Button>
        )}
        {selected.length > 0 && onBulkReject && (
          <Button
            variant="outline"
            size="sm"
            className="text-warning"
            onClick={() => onBulkReject(selected.map((r) => r.original))}
          >
            <X className="size-3.5" />
            <Badge variant="warning">{selected.length}</Badge>
          </Button>
        )}
        {selected.length > 0 && onBulkDelete && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => onBulkDelete(selected.map((r) => r.original))}
          >
            <Trash2 className="size-3.5" />
            <Badge variant="destructive">{selected.length}</Badge>
          </Button>
        )}

        {extraToolbar}

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportCsv(table, (count) =>
              toast.success(t("common.rowsExported", { count })),
            )
          }
        >
          <Download className="size-3.5" /> {t("common.export")}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="size-3.5" /> {t("common.columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>{t("common.visibility")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((c) => {
                const meta = c.columnDef.meta as
                  | { tooltip?: string; label?: string }
                  | undefined;
                return (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    className="capitalize"
                    title={meta?.tooltip}
                  >
                    {meta?.label ?? c.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
