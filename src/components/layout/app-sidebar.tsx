"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Hexagon, PanelLeftClose, PanelLeft } from "lucide-react";
import { navigation } from "@/config/navigation";
import { useUiStore } from "@/stores/ui-store";
import { useMe } from "@/lib/queries";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const t = useT();
  const { data: me } = useMe();
  const role = me?.employee?.role;

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 264 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex"
    >
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Hexagon className="size-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold text-white">
              HR Noxt
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">
              {t("brand.tagline")}
            </span>
          </div>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        {navigation.map((group) => {
          // Manager-only-Eintraege (z. B. Zugriffsverwaltung) fuer Nicht-Manager ausblenden.
          const items = group.items.filter(
            (item) => !item.managerOnly || role === "manager",
          );
          if (items.length === 0) return null;
          return (
          <div key={group.labelKey} className="mb-5">
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {t(group.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-white"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
                      collapsed && "justify-center",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary"
                      />
                    )}
                    <item.icon className="size-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{t(item.titleKey)}</span>}
                    {!collapsed && item.badge && (
                      <Badge
                        variant="default"
                        className="ml-auto bg-sidebar-primary/20 text-sidebar-primary-foreground"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );

                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{t(item.titleKey)}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      <button
        onClick={toggle}
        className="flex h-12 items-center gap-3 border-t border-sidebar-border px-4 text-sm text-sidebar-foreground/70 transition-colors hover:text-white"
      >
        {collapsed ? (
          <PanelLeft className="size-[18px]" />
        ) : (
          <>
            <PanelLeftClose className="size-[18px]" />
            <span>{t("nav.collapse")}</span>
          </>
        )}
      </button>
    </motion.aside>
  );
}
