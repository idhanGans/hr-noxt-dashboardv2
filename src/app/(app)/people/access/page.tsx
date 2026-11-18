"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FadeIn } from "@/components/motion";
import { useT } from "@/lib/i18n";
import { useMe, useAccessUsers, type AccessUser } from "@/lib/queries";

const COMPANY_DOMAIN = "@example.com";

export default function AccessPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const role = me?.employee?.role;
  const { data: users = [], isLoading } = useAccessUsers();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const grantSchema = z.object({
    firstName: z.string().min(1, t("common.required")),
    lastName: z.string().min(1, t("common.required")),
    email: z
      .string()
      .email(t("common.required"))
      .refine((e) => e.toLowerCase().endsWith(COMPANY_DOMAIN), {
        message: t("access.errEmailDomain"),
      }),
    authUser: z.string().min(1, t("common.required")),
    role: z.enum(["manager", "staff"]),
  });
  type GrantValues = z.infer<typeof grantSchema>;

  const form = useForm<GrantValues>({
    resolver: zodResolver(grantSchema),
    defaultValues: { firstName: "", lastName: "", email: "", authUser: "", role: "staff" },
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["access"] });
    void queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  const grant = useMutation({
    mutationFn: async (values: GrantValues) => {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_d, values) => {
      invalidate();
      toast.success(t("access.toastGranted", { name: `${values.firstName} ${values.lastName}` }));
      form.reset();
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await fetch(`/api/access/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_d, vars) => {
      invalidate();
      const u = users.find((x) => x.id === vars.id);
      toast.success(t("access.toastRoleChanged", { name: u?.name ?? "" }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/access/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (_d, id) => {
      invalidate();
      const u = users.find((x) => x.id === id);
      toast.success(t("access.toastRevoked", { name: u?.name ?? "" }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleLabel = (r: AccessUser["role"]) =>
    r === "manager" ? t("access.roleManager") : r === "admin" ? t("access.roleAdmin") : t("access.roleStaff");

  // Nur Manager duerfen die Zugriffsverwaltung sehen.
  if (role && role !== "manager") {
    return (
      <div className="py-16 text-center">
        <ShieldOff className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h2 className="font-display text-lg font-semibold">{t("access.deniedTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("access.deniedDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("access.title")}
        description={t("access.subtitle")}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t("access.grantBtn")}
          </Button>
        }
      />

      <FadeIn>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">{t("access.colName")}</th>
                    <th className="px-4 py-3 font-medium">{t("access.colEmail")}</th>
                    <th className="px-4 py-3 font-medium">{t("access.colLogin")}</th>
                    <th className="px-4 py-3 font-medium">{t("access.colStatus")}</th>
                    <th className="px-4 py-3 font-medium">{t("access.colRole")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("access.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        {isLoading ? "…" : t("access.empty")}
                      </td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {u.name}
                        {u.isSelf && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            {t("access.self")}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3 font-mono text-xs">{u.authUser ?? "—"}</td>
                      <td className="px-4 py-3">
                        {u.canLogin ? (
                          <Badge variant="success">{t("access.canLogin")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("access.noLogin")}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={u.role === "admin" ? "manager" : u.role}
                          onValueChange={(v) => changeRole.mutate({ id: u.id, role: v })}
                          disabled={u.isSelf}
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue>{roleLabel(u.role)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manager">{t("access.roleManager")}</SelectItem>
                            <SelectItem value="staff">{t("access.roleStaff")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={u.isSelf || !u.canLogin}
                          onClick={() => revoke.mutate(u.id)}
                        >
                          <ShieldOff className="mr-1 size-3.5" />
                          {t("access.revoke")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              {t("access.dialogTitle")}
            </DialogTitle>
            <DialogDescription>{t("access.dialogDesc")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => grant.mutate(v))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("access.fieldFirstName")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("access.fieldLastName")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("access.fieldEmail")}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={`max.muster${COMPANY_DOMAIN}`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="authUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("access.fieldAuthUser")}</FormLabel>
                    <FormControl>
                      <Input placeholder="max_mustermann" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t("access.fieldAuthUserHint")}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("access.fieldRole")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="staff">{t("access.roleStaff")}</SelectItem>
                        <SelectItem value="manager">{t("access.roleManager")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("access.cancel")}
                </Button>
                <Button type="submit" disabled={grant.isPending}>
                  {t("access.submit")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
