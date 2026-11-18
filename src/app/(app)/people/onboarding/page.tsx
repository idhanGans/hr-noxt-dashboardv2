"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { KpiCard } from "@/components/widgets/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useEmployees, useOnboardingTasks, type OnboardingTaskState } from "@/lib/queries";
import { initials } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Employee, Kpi } from "@/types";

const KPIS_TREND = Array.from({ length: 6 }, (_, i) => ({ label: `M${i + 1}`, value: 0 }));
const TASK_COUNT = 6;

export default function OnboardingPage() {
  const t = useT();
  const { data: allEmp = [] } = useEmployees();
  const ONBOARDING_EMPLOYEES = useMemo(
    () => allEmp.filter((e) => e.status === "onboarding"),
    [allEmp],
  );
  const COMPLETED_COUNT = useMemo(
    () => allEmp.filter((e) => e.status === "active").length,
    [allEmp],
  );
  const THIS_WEEK_STARTING = Math.min(3, ONBOARDING_EMPLOYEES.length);

  const CHECKLIST_TASKS = [
    t("people.onboarding.task0"),
    t("people.onboarding.task1"),
    t("people.onboarding.task2"),
    t("people.onboarding.task3"),
    t("people.onboarding.task4"),
    t("people.onboarding.task5"),
  ];

  const [selectedId, setSelectedId] = useState<string>(
    ONBOARDING_EMPLOYEES[0]?.id ?? ""
  );

  // Abhak-Zustand kommt aus der DB (persistiert), nicht aus lokalem State.
  const queryClient = useQueryClient();
  const { data: taskRows = [] } = useOnboardingTasks();
  const taskState = useMemo(() => {
    const map: Record<string, Record<number, boolean>> = {};
    for (const r of taskRows) {
      (map[r.employeeId] ??= {})[r.taskIndex] = r.done;
    }
    return map;
  }, [taskRows]);

  function getTasksForEmployee(empId: string): Record<number, boolean> {
    return taskState[empId] ?? {};
  }

  // Optimistisch umschalten, dann via POST persistieren; bei Fehler zuruecksetzen.
  const toggle = useMutation({
    mutationFn: async (vars: { empId: string; taskIndex: number; done: boolean }) => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: vars.empId,
          taskIndex: vars.taskIndex,
          done: vars.done,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["onboarding"] });
      const prev = queryClient.getQueryData<OnboardingTaskState[]>(["onboarding"]) ?? [];
      const next = prev.filter(
        (r) => !(r.employeeId === vars.empId && r.taskIndex === vars.taskIndex),
      );
      next.push({ employeeId: vars.empId, taskIndex: vars.taskIndex, done: vars.done });
      queryClient.setQueryData(["onboarding"], next);
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["onboarding"], ctx.prev);
      toast.error(err.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });

  function toggleTask(empId: string, taskIndex: number) {
    const current = taskState[empId]?.[taskIndex] ?? false;
    toggle.mutate({ empId, taskIndex, done: !current });
  }

  // Onboarding abschliessen: Mitarbeiterstatus auf "active" setzen (echte Aenderung).
  const completeOnboarding = useMutation({
    mutationFn: async ({ empId }: { empId: string; name: string }) => {
      const res = await fetch(`/api/employees/${empId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("people.onboarding.toastCompleted", { name: vars.name }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const selectedEmployee: Employee | undefined = ONBOARDING_EMPLOYEES.find(
    (e) => e.id === selectedId
  );

  const selectedTasks = selectedEmployee ? getTasksForEmployee(selectedEmployee.id) : {};
  const completedCount = Object.values(selectedTasks).filter(Boolean).length;
  const totalTasks = TASK_COUNT;
  const progressPct = Math.round((completedCount / totalTasks) * 100);

  const kpis: Kpi[] = [
    {
      id: "onboarding",
      label: t("people.onboarding.kpiOnboarding"),
      value: ONBOARDING_EMPLOYEES.length,
      format: "number",
      delta: 0,
      trend: KPIS_TREND,
    },
    {
      id: "starting",
      label: t("people.onboarding.kpiStarting"),
      value: THIS_WEEK_STARTING,
      format: "number",
      delta: 0,
      trend: KPIS_TREND,
    },
    {
      id: "completed",
      label: t("people.onboarding.kpiCompleted"),
      value: COMPLETED_COUNT,
      format: "number",
      delta: 0,
      trend: KPIS_TREND,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("people.onboarding.title")}
        description={t("people.onboarding.desc")}
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi, i) => (
          <StaggerItem key={kpi.id}>
            <KpiCard kpi={kpi} accent={(i % 5) + 1} />
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <FadeIn className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">{t("people.onboarding.cardNewEmployees")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-0 pb-4">
              {ONBOARDING_EMPLOYEES.length === 0 && (
                <p className="px-6 text-sm text-muted-foreground">{t("people.onboarding.emptyList")}</p>
              )}
              {ONBOARDING_EMPLOYEES.map((emp) => {
                const name = `${emp.firstName} ${emp.lastName}`;
                const tasks = getTasksForEmployee(emp.id);
                const done = Object.values(tasks).filter(Boolean).length;
                const pct = Math.round((done / TASK_COUNT) * 100);
                const isSelected = emp.id === selectedId;

                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedId(emp.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      isSelected && "bg-muted"
                    )}
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold">
                        {initials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.jobTitle}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={pct} className="flex-1 h-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05} className="lg:col-span-3">
          {selectedEmployee ? (
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="text-sm font-semibold">
                        {initials(`${selectedEmployee.firstName} ${selectedEmployee.lastName}`)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {selectedEmployee.firstName} {selectedEmployee.lastName}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedEmployee.jobTitle} · {selectedEmployee.department}
                      </p>
                    </div>
                  </div>
                  <Badge variant="info">{t("people.onboarding.badgeOnboarding")}</Badge>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{t("people.onboarding.progress")}</span>
                    <span className="text-sm font-semibold">
                      {t("people.onboarding.tasks", { done: completedCount, total: totalTasks })}
                    </span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {t("people.onboarding.checklist")}
                </p>
                <Stagger className="space-y-2">
                  {CHECKLIST_TASKS.map((task, i) => {
                    const checked = selectedTasks[i] ?? false;
                    return (
                      <StaggerItem key={i}>
                        <label
                          className={cn(
                            "flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer transition-colors hover:bg-muted/50",
                            checked && "bg-muted/40"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleTask(selectedEmployee.id, i)}
                          />
                          <span className={cn("text-sm", checked && "line-through text-muted-foreground")}>
                            {task}
                          </span>
                          {checked && (
                            <CheckCircle2 className="size-4 text-emerald-500 ml-auto shrink-0" />
                          )}
                          {!checked && (
                            <Circle className="size-4 text-muted-foreground/30 ml-auto shrink-0" />
                          )}
                        </label>
                      </StaggerItem>
                    );
                  })}
                </Stagger>

                <div className="pt-4">
                  <Button
                    className="w-full"
                    disabled={progressPct < 100 || completeOnboarding.isPending}
                    onClick={() => {
                      completeOnboarding.mutate({
                        empId: selectedEmployee.id,
                        name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                      });
                    }}
                  >
                    <UserCheck className="size-4" />
                    {progressPct < 100
                      ? t("people.onboarding.completeBtnProgress", { pct: progressPct })
                      : t("people.onboarding.completeBtn")}
                  </Button>
                  {progressPct < 100 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t("people.onboarding.completeBtnHint", { total: totalTasks })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
              <p className="text-muted-foreground text-sm">{t("people.onboarding.selectEmployee")}</p>
            </Card>
          )}
        </FadeIn>
      </div>
    </div>
  );
}
