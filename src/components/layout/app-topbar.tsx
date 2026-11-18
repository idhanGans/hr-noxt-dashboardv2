"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import { initials } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { NotificationsMenu } from "./notifications-menu";
import { MobileSidebar } from "./mobile-sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { GlobalSearch } from "./global-search";

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  admin: "Admin",
  staff: "Mitarbeiter",
};

export function AppTopbar() {
  const t = useT();
  const { data: me } = useMe();
  const emp = me?.employee;
  const fullName = emp ? `${emp.firstName} ${emp.lastName}` : "…";
  const subtitle = emp?.jobTitle && emp.jobTitle !== "—" ? emp.jobTitle : ROLE_LABELS[emp?.role ?? ""] ?? "";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <MobileSidebar />

      <div className="hidden lg:block">
        <Breadcrumbs />
      </div>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <LanguageToggle className="mr-1 hidden sm:inline-flex" />
        <ThemeToggle />
        <NotificationsMenu />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted">
              <Avatar className="size-8">
                <AvatarFallback>{emp ? initials(fullName) : "?"}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-medium">{fullName}</p>
                {subtitle && (
                  <p className="text-[11px] text-muted-foreground">{subtitle}</p>
                )}
              </div>
              <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="leading-tight">
                <p className="text-sm font-medium">{fullName}</p>
                {emp?.email && (
                  <p className="text-[11px] font-normal text-muted-foreground">{emp.email}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/people/ess">
                <User /> {t("common.profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/people/ess">
                <Settings /> {t("common.settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                window.location.href = "/api/auth/logout";
              }}
            >
              <LogOut /> {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
