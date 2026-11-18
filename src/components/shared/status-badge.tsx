"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

type Variant = NonNullable<BadgeProps["variant"]>;

const VARIANTS: Record<string, Variant> = {
  active: "success",
  onboarding: "info",
  on_leave: "warning",
  offboarding: "muted",
  terminated: "destructive",
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "muted",
  present: "success",
  remote: "info",
  late: "warning",
  absent: "destructive",
  paid: "success",
  processing: "info",
  scheduled: "muted",
  open: "info",
  in_progress: "warning",
  resolved: "success",
  on_hold: "warning",
  closed: "muted",
  applied: "muted",
  screening: "info",
  interview: "default",
  offer: "warning",
  hired: "success",
  on_track: "success",
  at_risk: "warning",
  behind: "destructive",
  completed: "info",
  assigned: "info",
  available: "success",
  maintenance: "warning",
  retired: "muted",
  lost: "destructive",
  disposed: "muted",
  low: "muted",
  medium: "info",
  high: "warning",
  urgent: "destructive",
  expired: "destructive",
  expiring_soon: "warning",
  draft: "muted",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const variant = VARIANTS[status] ?? "muted";
  return <Badge variant={variant}>{t(`status.${status}`)}</Badge>;
}
