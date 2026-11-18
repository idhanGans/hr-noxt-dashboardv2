"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { mobileNav } from "@/config/navigation";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-stretch">
        {mobileNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                />
              )}
              <item.icon className="size-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">
                {t(item.titleKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
