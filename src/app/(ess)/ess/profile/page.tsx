"use client";

import * as React from "react";
import {
  Mail,
  Phone,
  Building2,
  Calendar,
  MapPin,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { FadeIn } from "@/components/motion";
import { initials } from "@/lib/utils";
import { useMe } from "@/lib/queries";
import { useT } from "@/lib/i18n";

export default function ProfilePage() {
  const t = useT();
  const { data: me, isLoading } = useMe();
  const employee = me?.employee;
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  function handleLogout() {
    toast.info(t("ess.profile.toastLogout"));
  }

  // Solange das Profil laedt oder kein Mitarbeiter-Datensatz existiert: leerer Zustand.
  if (!employee) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {isLoading ? "…" : t("common.noResults")}
      </div>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const STAMM_DATA = [
    { icon: Mail, label: t("ess.profile.fieldEmail"), value: employee.email },
    { icon: Phone, label: t("ess.profile.fieldPhone"), value: employee.phone ?? "—" },
    { icon: Building2, label: t("ess.profile.fieldDepartment"), value: employee.department },
    { icon: Calendar, label: t("ess.profile.fieldHireDate"), value: employee.hireDate },
    { icon: MapPin, label: t("ess.profile.fieldLocation"), value: employee.location },
  ];

  return (
    <div className="space-y-5">
      <FadeIn>
        <div className="flex flex-col items-center gap-3 py-4">
          <Avatar className="size-20">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
              {initials(fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold">{fullName}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {employee.jobTitle}
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("ess.profile.masterDataSection")}
          </h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {STAMM_DATA.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="truncate text-sm font-medium">{value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("ess.profile.settingsSection")}
          </h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">{t("common.theme")}</span>
                <ThemeToggle />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t("ess.profile.notificationsLabel")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("ess.profile.notificationsDesc")}
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={(checked) => {
                    setNotificationsEnabled(checked);
                    toast.success(
                      checked
                        ? t("ess.profile.toastNotificationsOn")
                        : t("ess.profile.toastNotificationsOff"),
                    );
                  }}
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">{t("common.language")}</span>
                <LanguageToggle />
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.15}>
        <Button
          variant="outline"
          className="w-full min-h-12 text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/30"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 size-4" />
          {t("common.logout")}
        </Button>
      </FadeIn>
    </div>
  );
}
