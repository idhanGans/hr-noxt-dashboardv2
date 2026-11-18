"use client";

import { toast } from "sonner";
import { getQueryClient } from "@/components/providers";

// Generisches Bulk-Loeschen: ruft DELETE /api/<resource>/<id> pro Zeile,
// laedt die zugehoerige Query neu und meldet ein ehrliches Ergebnis.
// Plain function (kein Hook) -> kann direkt im onBulkDelete-Callback genutzt werden.
export async function bulkDelete(
  resource: string,
  queryKey: string,
  rows: { id: string | number }[],
): Promise<void> {
  if (rows.length === 0) return;
  const results = await Promise.allSettled(
    rows.map((r) =>
      fetch(`/api/${resource}/${r.id}`, { method: "DELETE" }).then((res) => {
        if (!res.ok) throw new Error(String(res.status));
      }),
    ),
  );
  await getQueryClient().invalidateQueries({ queryKey: [queryKey] });
  const ok = results.filter((x) => x.status === "fulfilled").length;
  const failed = results.length - ok;
  if (ok > 0) toast.success(`${ok} Eintrag${ok === 1 ? "" : "e"} gelöscht`);
  if (failed > 0) toast.error(`${failed}× konnte nicht gelöscht werden`);
}
