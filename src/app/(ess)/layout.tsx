import * as React from "react";
import Link from "next/link";
import { Hexagon, Monitor } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export default function EssLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-border bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {/* Logo fuehrt zurueck zur Desktop-Ansicht (verhindert die Sackgasse). */}
        <Link href="/dashboard/employee" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Hexagon className="size-4" />
          </div>
          <span className="font-display text-sm font-semibold">HR Noxt</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/employee"
            aria-label="Desktop"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Monitor className="size-4" />
          </Link>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 px-4 py-4 pb-24">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
