"use client";

import * as React from "react";
import { Plus, Trash2, ShieldOff, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FadeIn } from "@/components/motion";
import { useT } from "@/lib/i18n";
import { useMe, useDepartments, useTitles, type OrgUnit } from "@/lib/queries";

function OrgSection({
  title,
  resource,
  queryKey,
  items,
}: {
  title: string;
  resource: "departments" | "titles";
  queryKey: string;
  items: OrgUnit[];
}) {
  const t = useT();
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editName, setEditName] = React.useState("");

  async function add() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(t("org.toastAdded", { name: n }));
      setName("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(u: OrgUnit) {
    const n = editName.trim();
    if (!n || n === u.name) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/${resource}/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(t("org.toastRenamed", { name: n }));
      setEditingId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(u: OrgUnit) {
    try {
      const res = await fetch(`/api/${resource}/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(t("org.toastRemoved", { name: u.name }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("org.placeholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
          />
          <Button onClick={() => void add()} disabled={busy || !name.trim()}>
            <Plus className="size-4" /> {t("org.add")}
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("org.empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                {editingId === u.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void save(u);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                    />
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void save(u)}
                        aria-label={t("common.save")}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingId(null)}
                        aria-label={t("common.cancel")}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{u.name}</span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditingId(u.id);
                          setEditName(u.name);
                        }}
                        aria-label={`${u.name} ${t("common.edit")}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void remove(u)}
                        aria-label={`${u.name} entfernen`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrgPage() {
  const t = useT();
  const { data: me } = useMe();
  const role = me?.employee?.role;
  const { data: departments = [] } = useDepartments();
  const { data: titles = [] } = useTitles();

  if (role && role !== "manager") {
    return (
      <div className="py-16 text-center">
        <ShieldOff className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h2 className="font-display text-lg font-semibold">{t("org.deniedTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("org.deniedDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("org.title")} description={t("org.subtitle")} />
      <FadeIn>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OrgSection
            title={t("org.departments")}
            resource="departments"
            queryKey="departments"
            items={departments}
          />
          <OrgSection
            title={t("org.titles")}
            resource="titles"
            queryKey="titles"
            items={titles}
          />
        </div>
      </FadeIn>
    </div>
  );
}
