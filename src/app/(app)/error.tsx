"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

// Fehler-Boundary fuer die (app)-Shell. Bleibt innerhalb von Sidebar/Topbar und
// hat Zugriff auf den LanguageProvider (useT).
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CircleAlert className="size-7" />
          </span>
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold">
              {t("common.error.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("common.error.desc")}
            </p>
          </div>
          <Button variant="outline" onClick={reset}>
            {t("common.error.retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
