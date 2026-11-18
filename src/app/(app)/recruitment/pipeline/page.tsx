"use client";

import * as React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, MapPin, FileText, Download, Calendar, Clock, ChevronRight, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/motion";
import { motion } from "@/components/motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { useT } from "@/lib/i18n";
import { useCandidates } from "@/lib/queries";
import { initials } from "@/lib/utils";
import type { Candidate, CandidateStage } from "@/types";

const NEXT_STAGE: Partial<Record<CandidateStage, CandidateStage>> = {
  applied: "screening",
  screening: "interview",
  interview: "offer",
  offer: "hired",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < rating ? "fill-warning text-warning" : "fill-transparent text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

function CandidateSheet({
  candidate,
  onClose,
  onAdvance,
  onReject,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onAdvance: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const t = useT();
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");

  if (!candidate) return null;

  const canAdvance = !!NEXT_STAGE[candidate.stage];

  const STAGES: { id: CandidateStage; label: string }[] = [
    { id: "applied", label: t("recruitment.pipeline.stage.applied") },
    { id: "screening", label: t("recruitment.pipeline.stage.screening") },
    { id: "interview", label: t("recruitment.pipeline.stage.interview") },
    { id: "offer", label: t("recruitment.pipeline.stage.offer") },
    { id: "hired", label: t("recruitment.pipeline.stage.hired") },
  ];

  return (
    <Sheet open={!!candidate} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{candidate.name}</SheetTitle>
          <SheetDescription>{candidate.role} · {candidate.department}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-6">
          {/* Stammdaten */}
          <div className="flex items-start gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initials(candidate.name)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-sm font-medium">{candidate.email}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" /> {candidate.location}
              </div>
              <StarRating rating={candidate.rating} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t("recruitment.pipeline.sheet.source")}</p>
              <p className="font-medium">{candidate.source}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("recruitment.pipeline.sheet.appliedAt")}</p>
              <p className="font-medium">{candidate.appliedAt}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("recruitment.pipeline.sheet.stage")}</p>
              <StatusBadge status={candidate.stage} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("recruitment.pipeline.sheet.rating")}</p>
              <p className="font-medium">{candidate.rating} / 5</p>
            </div>
          </div>

          <Separator />

          {/* CV preview */}
          <div>
            <p className="mb-2 text-sm font-semibold">{t("recruitment.pipeline.sheet.cvPreview")}</p>
            <Card className="bg-muted/30">
              <CardContent className="flex items-center gap-3 py-4">
                <FileText className="size-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">CV_{candidate.name.replace(/\s+/g, "_")}.pdf</p>
                  <p className="text-xs text-muted-foreground">PDF · 248 KB</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success(t("recruitment.pipeline.sheet.cvDownloadToast"))}
                >
                  <Download className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Schedule interview */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">{t("recruitment.pipeline.sheet.scheduleInterview")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="interview-date" className="flex items-center gap-1.5 text-xs">
                  <Calendar className="size-3.5" /> {t("recruitment.pipeline.sheet.date")}
                </Label>
                <Input
                  id="interview-date"
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interview-time" className="flex items-center gap-1.5 text-xs">
                  <Clock className="size-3.5" /> {t("recruitment.pipeline.sheet.time")}
                </Label>
                <Input
                  id="interview-time"
                  type="time"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (!interviewDate || !interviewTime) {
                  toast.error(t("recruitment.pipeline.sheet.interviewMissingFields"));
                  return;
                }
                toast.success(
                  t("recruitment.pipeline.sheet.interviewScheduled", {
                    name: candidate.name,
                    date: interviewDate,
                    time: interviewTime,
                  }),
                );
              }}
            >
              {t("recruitment.pipeline.sheet.saveInterview")}
            </Button>
          </div>

          <Separator />
        </div>

        <SheetFooter className="gap-2">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => {
              onReject(candidate.id);
              toast.info(t("recruitment.pipeline.sheet.rejected", { name: candidate.name }));
              onClose();
            }}
          >
            <XCircle className="size-4" /> {t("recruitment.pipeline.sheet.reject")}
          </Button>
          {canAdvance && (
            <Button
              className="flex-1"
              onClick={() => {
                onAdvance(candidate.id);
                const next = NEXT_STAGE[candidate.stage];
                const label = STAGES.find((s) => s.id === next)?.label ?? next;
                toast.success(`${candidate.name} → ${label}`);
                onClose();
              }}
            >
              {t("recruitment.pipeline.sheet.advance")} <ChevronRight className="size-4" />
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function PipelinePage() {
  const t = useT();
  const { data: rawCandidates, isLoading } = useCandidates();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const queryClient = useQueryClient();

  // Persist a stage change to the API, then refetch to stay in sync.
  const patchStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: CandidateStage }) => {
      const res = await fetch(`/api/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const STAGES: { id: CandidateStage; label: string }[] = [
    { id: "applied", label: t("recruitment.pipeline.stage.applied") },
    { id: "screening", label: t("recruitment.pipeline.stage.screening") },
    { id: "interview", label: t("recruitment.pipeline.stage.interview") },
    { id: "offer", label: t("recruitment.pipeline.stage.offer") },
    { id: "hired", label: t("recruitment.pipeline.stage.hired") },
  ];

  // One-shot hydration of the kanban board from React Query data. After the
  // initial load, drag/move operations live in `candidates` only.
  React.useEffect(() => {
    if (rawCandidates) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCandidates(rawCandidates.filter((c) => c.stage !== "rejected"));
    }
  }, [rawCandidates]);

  function handleAdvance(id: string) {
    const current = candidates.find((c) => c.id === id);
    const next = current ? NEXT_STAGE[current.stage] : undefined;
    if (!next) return;
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, stage: next } : c)));
    patchStage.mutate({ id, stage: next });
  }

  function handleReject(id: string) {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    patchStage.mutate({ id, stage: "rejected" });
  }

  const grouped = STAGES.reduce<Record<CandidateStage, Candidate[]>>(
    (acc, s) => {
      acc[s.id] = candidates.filter((c) => c.stage === s.id);
      return acc;
    },
    {} as Record<CandidateStage, Candidate[]>,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("recruitment.pipeline.title")}
        description={t("recruitment.pipeline.desc")}
      />

      <FadeIn>
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((s) => (
              <div key={s.id} className="min-w-[280px] h-[400px] animate-pulse rounded-xl border border-border bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const cols = grouped[stage.id] ?? [];
              return (
                <div key={stage.id} className="flex min-w-[280px] max-w-[280px] flex-col gap-3">
                  <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                    <span className="text-sm font-semibold">{stage.label}</span>
                    <Badge variant="secondary">{cols.length}</Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {cols.map((candidate) => (
                      <motion.div
                        key={candidate.id}
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setSelectedCandidate(candidate)}
                      >
                        <Card className="cursor-pointer border-border transition-shadow hover:shadow-md">
                          <CardHeader className="pb-2">
                            <div className="flex items-start gap-3">
                              <Avatar className="size-8 shrink-0">
                                <AvatarFallback className="text-xs">
                                  {initials(candidate.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{candidate.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{candidate.role}</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-1.5">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3" /> {candidate.location}
                            </div>
                            <StarRating rating={candidate.rating} />
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                    {cols.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                        {t("recruitment.pipeline.empty")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FadeIn>

      <CandidateSheet
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onAdvance={handleAdvance}
        onReject={handleReject}
      />
    </div>
  );
}
