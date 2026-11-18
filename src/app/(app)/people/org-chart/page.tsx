"use client";

import * as React from "react";
import {
  Workflow,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Plus,
  Minus,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FadeIn } from "@/components/motion";
import { useOrgTree, type OrgTreeNode } from "@/lib/queries";
import { initials, cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;
const ZOOM_STEP = 0.15;

const idOf = (n: OrgTreeNode) => String(n.employee.id);

// Markiert alle Knoten, die selbst oder ueber einen Nachfahren auf das
// Filter-Praedikat passen (visible), plus die direkten Treffer (matched).
function computeVisibility(
  roots: OrgTreeNode[],
  matches: (n: OrgTreeNode) => boolean,
) {
  const visible = new Set<string>();
  const matched = new Set<string>();
  const walk = (n: OrgTreeNode): boolean => {
    const self = matches(n);
    if (self) matched.add(idOf(n));
    let childHit = false;
    for (const c of n.children) if (walk(c)) childHit = true;
    const keep = self || childHit;
    if (keep) visible.add(idOf(n));
    return keep;
  };
  roots.forEach(walk);
  return { visible, matched, matchCount: matched.size };
}

export default function OrgChartPage() {
  const t = useT();
  const { roots, employees, isLoading } = useOrgTree();

  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState<string>("all");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });

  const departments = React.useMemo(
    () =>
      Array.from(new Set(employees.map((e) => e.department))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [employees],
  );

  const q = query.trim().toLowerCase();
  const filterActive = q.length > 0 || dept !== "all";

  const { visible, matched, matchCount } = React.useMemo(() => {
    if (!filterActive)
      return {
        visible: new Set<string>(),
        matched: new Set<string>(),
        matchCount: 0,
      };
    const matchesNode = (n: OrgTreeNode) => {
      const e = n.employee;
      const text =
        q === "" ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.jobTitle.toLowerCase().includes(q);
      const inDept = dept === "all" || e.department === dept;
      return text && inDept;
    };
    return computeVisibility(roots, matchesNode);
  }, [roots, filterActive, q, dept]);

  // Alle Knoten mit Kindern (fuer "Alle einklappen").
  const collapsibleIds = React.useMemo(() => {
    const ids: string[] = [];
    const walk = (n: OrgTreeNode) => {
      if (n.children.length) {
        ids.push(idOf(n));
        n.children.forEach(walk);
      }
    };
    roots.forEach(walk);
    return ids;
  }, [roots]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(collapsibleIds));

  const zoomIn = () =>
    setScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(2)));
  const zoomOut = () =>
    setScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(2)));
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // --- Pan via Pointer-Events ---
  const drag = React.useRef({ startX: 0, startY: 0, ox: 0, oy: 0, active: false });
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-pan]")) return;
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: offset.x,
      oy: offset.y,
      active: true,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.startX),
      y: drag.current.oy + (e.clientY - drag.current.startY),
    });
  };
  const endPan = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer bereits freigegeben */
    }
  };

  function renderNode(n: OrgTreeNode): React.ReactNode {
    const id = idOf(n);
    if (filterActive && !visible.has(id)) return null;

    const e = n.employee;
    const hasChildren = n.children.length > 0;
    const isExpanded = filterActive ? true : !collapsed.has(id);
    const isMatch = matched.has(id);
    const childrenToRender = filterActive
      ? n.children.filter((c) => visible.has(idOf(c)))
      : n.children;

    return (
      <li key={id}>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-card px-3 py-2 shadow-sm transition-colors",
            isMatch ? "border-primary ring-2 ring-primary/40" : "border-border",
          )}
        >
          {hasChildren && !filterActive ? (
            <button
              data-no-pan
              type="button"
              onClick={() => toggle(id)}
              aria-label={t(
                isExpanded ? "people.orgChart.collapse" : "people.orgChart.expand",
              )}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          ) : (
            <span className="size-5 shrink-0" />
          )}

          <Avatar className="size-9 shrink-0">
            {e.avatar ? (
              <AvatarImage src={e.avatar} alt={`${e.firstName} ${e.lastName}`} />
            ) : null}
            <AvatarFallback className="text-xs font-semibold">
              {initials(`${e.firstName} ${e.lastName}`)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {e.firstName} {e.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{e.jobTitle}</p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
              {e.department}
            </Badge>
            {hasChildren && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Badge variant="outline" className="tabular-nums">
                      {n.children.length}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("people.orgChart.reports", { count: n.children.length })}</p>
                  {n.descendants !== n.children.length && (
                    <p className="text-xs opacity-80">
                      {t("people.orgChart.totalReports", { count: n.descendants })}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && childrenToRender.length > 0 && (
          <ul className="ml-6 mt-2 space-y-2 border-l border-border pl-4">
            {childrenToRender.map(renderNode)}
          </ul>
        )}
      </li>
    );
  }

  const showEmpty = !isLoading && employees.length === 0;
  const showNoResults = filterActive && matchCount === 0 && !isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("people.orgChart.title")}
        description={t("people.orgChart.desc")}
      />

      {showEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Workflow className="size-7" />
            </span>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("people.orgChart.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <FadeIn className="space-y-4">
          {/* Toolbar: Suche + Abteilungsfilter + Aus-/Einklappen */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("people.orgChart.searchPlaceholder")}
                className="pl-8"
              />
            </div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("people.orgChart.allDepartments")}
                </SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 sm:ml-auto">
              {filterActive && (
                <span className="text-sm text-muted-foreground">
                  {t("people.orgChart.matches", { count: matchCount })}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                disabled={filterActive}
              >
                <ChevronsUpDown className="size-4" />
                {t("people.orgChart.expandAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                disabled={filterActive}
              >
                <ChevronUp className="size-4" />
                {t("people.orgChart.collapseAll")}
              </Button>
            </div>
          </div>

          {/* Pan/Zoom-Canvas mit dem Organigramm */}
          <Card className="overflow-hidden">
            <CardContent className="relative p-0">
              <div
                className="relative h-[68vh] min-h-[480px] touch-none overflow-hidden bg-muted/20 active:cursor-grabbing"
                style={{ cursor: "grab" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPan}
                onPointerLeave={endPan}
              >
                {isLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-12 rounded-xl"
                        style={{ width: `${70 - i * 6}%`, marginLeft: `${i * 24}px` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className="absolute left-0 top-0 p-6 will-change-transform"
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                      transformOrigin: "0 0",
                    }}
                  >
                    <ul className="w-max space-y-2">{roots.map(renderNode)}</ul>
                  </div>
                )}

                {showNoResults && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
                    <p className="max-w-xs text-sm text-muted-foreground">
                      {t("people.orgChart.noResults")}
                    </p>
                  </div>
                )}

                {/* Zoom-Steuerung */}
                <div
                  data-no-pan
                  className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-md backdrop-blur"
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={zoomIn}
                    aria-label={t("people.orgChart.zoomIn")}
                  >
                    <Plus className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={zoomOut}
                    aria-label={t("people.orgChart.zoomOut")}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={resetView}
                    aria-label={t("people.orgChart.zoomReset")}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
