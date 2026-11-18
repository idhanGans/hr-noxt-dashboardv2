"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { flatRoutes } from "@/config/navigation";
import { useT } from "@/lib/i18n";

const SEGMENT_KEYS: Record<string, string> = {
  dashboard: "nav.group.dashboards",
  attendance: "nav.group.attendance",
  payroll: "nav.group.payroll",
  people: "nav.group.people",
  recruitment: "nav.group.recruitment",
  performance: "nav.group.performance",
  ess: "brand.tagline",
};

function titleize(segment: string) {
  return segment
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useT();
  const segments = pathname.split("/").filter(Boolean);
  const current = flatRoutes.find((r) => r.href === pathname);

  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <Link
        href="/dashboard/executive"
        className="text-muted-foreground hover:text-foreground"
      >
        {t("nav.home")}
      </Link>
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        const label =
          isLast && current
            ? t(current.titleKey)
            : SEGMENT_KEYS[seg]
              ? t(SEGMENT_KEYS[seg])
              : titleize(seg);
        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <span className="text-muted-foreground">{label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
