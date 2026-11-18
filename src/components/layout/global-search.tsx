"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, FileText, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { navigation } from "@/config/navigation";
import { useEmployees } from "@/lib/queries";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Globale Suche (⌘K / Strg+K). Durchsucht Navigationsseiten + Mitarbeiter,
// navigiert bei Auswahl. Rein clientseitig, keine zusaetzliche Dependency.
export function GlobalSearch() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const { data: employees = [] } = useEmployees();

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pages = React.useMemo(
    () => navigation.flatMap((g) => g.items).map((i) => ({ label: t(i.titleKey), href: i.href })),
    [t],
  );

  const ql = q.trim().toLowerCase();
  const pageHits = (ql ? pages.filter((p) => p.label.toLowerCase().includes(ql)) : pages).slice(0, 6);
  const empHits = ql
    ? employees
        .filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(ql))
        .slice(0, 6)
    : [];

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const items: { key: string; icon: React.ReactNode; label: string; sub?: string; href: string }[] = [
    ...pageHits.map((p) => ({ key: "p:" + p.href, icon: <FileText className="size-4" />, label: p.label, href: p.href })),
    ...empHits.map((e) => ({
      key: "e:" + e.id,
      icon: <User className="size-4" />,
      label: `${e.firstName} ${e.lastName}`,
      sub: e.department,
      href: "/people/employees",
    })),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">{t("common.search")}</span>
        <kbd className="rounded border border-border bg-card px-1.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">{t("common.search")}</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("common.search")}
              className="h-12 border-0 focus-visible:ring-0 shadow-none"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("common.noResults")}
              </p>
            ) : (
              items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => go(it.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                  )}
                >
                  <span className="text-muted-foreground">{it.icon}</span>
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.sub && <span className="text-xs text-muted-foreground">{it.sub}</span>}
                  <CornerDownLeft className="size-3.5 text-muted-foreground/50" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
