"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hexagon, Menu } from "lucide-react";
import { navigation } from "@/config/navigation";
import { useUiStore } from "@/stores/ui-store";
import { useMe } from "@/lib/queries";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

export function MobileSidebar() {
  const pathname = usePathname();
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const t = useT();
  const { data: me } = useMe();
  const role = me?.employee?.role;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menü">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-16 items-center gap-2.5 px-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Hexagon className="size-5" />
          </div>
          <span className="font-display text-sm font-semibold text-white">
            HR Noxt
          </span>
        </div>
        <nav className="scrollbar-thin h-[calc(100vh-4rem)] overflow-y-auto px-3 pb-6">
          {navigation.map((group) => {
            const items = group.items.filter(
              (item) => !item.managerOnly || role === "manager",
            );
            if (items.length === 0) return null;
            return (
            <div key={group.labelKey} className="mb-5">
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-white"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
                      )}
                    >
                      <item.icon className="size-[18px]" />
                      {t(item.titleKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
