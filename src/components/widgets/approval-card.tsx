"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getQueryClient } from "@/components/providers";
import { initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { ApprovalItem } from "@/types";

export function ApprovalCard({ items }: { items: ApprovalItem[] }) {
  const t = useT();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Die item.id traegt ein Resource-Praefix ("leave-12" / "reimb-3"), darueber
  // wird der echte approve/reject-Endpoint angesprochen. Nach Erfolg laedt die
  // zugehoerige Query neu -> der Eintrag verschwindet aus der Liste.
  async function resolve(item: ApprovalItem, approved: boolean) {
    const dash = item.id.indexOf("-");
    const prefix = dash >= 0 ? item.id.slice(0, dash) : "";
    const idStr = dash >= 0 ? item.id.slice(dash + 1) : item.id;
    const resource = prefix === "reimb" ? "reimbursements" : "leave";
    setBusyId(item.id);
    try {
      const res = await fetch(
        `/api/${resource}/${idStr}/${approved ? "approve" : "reject"}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const qc = getQueryClient();
      void qc.invalidateQueries({ queryKey: [resource] });
      void qc.invalidateQueries({ queryKey: ["kpis"] });
      toast[approved ? "success" : "error"](
        approved ? t("approval.approved") : t("approval.rejected"),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t("approval.title")}</CardTitle>
        <Badge variant="warning">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("approval.empty")}
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <Avatar className="size-9">
              <AvatarFallback>{initials(item.requester)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.requester} · {item.submittedAt}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="icon-sm"
                variant="outline"
                disabled={busyId === item.id}
                onClick={() => resolve(item, false)}
                aria-label={t("common.reject")}
              >
                <X className="text-destructive" />
              </Button>
              <Button
                size="icon-sm"
                variant="success"
                disabled={busyId === item.id}
                onClick={() => resolve(item, true)}
                aria-label={t("common.approve")}
              >
                <Check />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
