"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";

// Bekannte Spalten (case-insensitive, inkl. deutscher Aliasse) -> Feldnamen.
const COLS: Record<string, string> = {
  firstname: "firstName", "first name": "firstName", vorname: "firstName",
  lastname: "lastName", "last name": "lastName", nachname: "lastName",
  email: "email", "e-mail": "email", "e mail": "email",
  department: "department", abteilung: "department",
  title: "title", titel: "title",
  jobtitle: "jobTitle", "job title": "jobTitle", position: "jobTitle",
  location: "location", standort: "location",
  employmenttype: "employmentType", "employment type": "employmentType",
  status: "status",
  hiredate: "hireDate", "hire date": "hireDate", eintrittsdatum: "hireDate",
  salary: "salary", gehalt: "salary",
  authuser: "authUser", login: "authUser", username: "authUser", benutzer: "authUser",
};

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  // Trennzeichen erkennen: ; (oft DE-Excel) oder ,
  const delim = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const header = splitLine(lines[0], delim).map((h) => h.toLowerCase());
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const field = COLS[h];
    if (field && idx[field] === undefined) idx[field] = i;
  });
  return lines
    .slice(1)
    .map((line) => {
      const cells = splitLine(line, delim);
      const obj: Record<string, string> = {};
      for (const [field, i] of Object.entries(idx)) {
        const v = cells[i];
        if (v) obj[field] = v;
      }
      return obj;
    })
    .filter((o) => o.firstName || o.lastName || o.email);
}

export function ImportEmployeesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const rows = React.useMemo(() => parseCsv(text), [text]);

  function reset() {
    setText("");
    setBusy(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function runImport() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/employees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body = (await res.json().catch(() => null)) as
        | { created?: number; failed?: number; error?: string }
        | null;
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      await queryClient.invalidateQueries({ queryKey: ["titles"] });
      await queryClient.invalidateQueries({ queryKey: ["kpis"] });
      const created = body?.created ?? 0;
      const failed = body?.failed ?? 0;
      if (created > 0) toast.success(t("people.import.toastDone", { created, failed }));
      else toast.error(t("people.import.toastNone", { failed }));
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("people.import.title")}</DialogTitle>
          <DialogDescription>{t("people.import.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{t("people.import.columnsTitle")}</p>
            <p className="mt-1 font-mono">
              firstName, lastName, email, department, title, jobTitle, location,
              employmentType, status, hireDate, salary, authUser
            </p>
            <p className="mt-1">{t("people.import.columnsHint")}</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
            />
          </label>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={t("people.import.pastePlaceholder")}
            className="font-mono text-xs"
          />

          {rows.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("people.import.parsed", { count: rows.length })}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button onClick={() => void runImport()} disabled={busy || rows.length === 0}>
            <UploadCloud className="size-4" />
            {t("people.import.importBtn", { count: rows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
