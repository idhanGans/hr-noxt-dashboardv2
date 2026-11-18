"use client";

import Link from "next/link";
import { Hexagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

// Gebrandete 404-Seite. Rendert im Root-Layout (innerhalb der Provider), daher
// ist useT verfuegbar.
export default function NotFound() {
  const t = useT();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <Hexagon className="size-8" />
      </div>
      <div className="space-y-2">
        <p className="font-display text-5xl font-bold tracking-tight text-primary">
          404
        </p>
        <h1 className="font-display text-xl font-semibold">
          {t("common.notFound.title")}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("common.notFound.desc")}
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard/executive">{t("common.notFound.back")}</Link>
      </Button>
    </div>
  );
}
