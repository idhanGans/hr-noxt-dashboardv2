# i18n-Contract für Seiten-Übersetzung (DE/EN)

Die i18n-Infrastruktur existiert bereits. Aufgabe: **deutsche Literale in den zugewiesenen Seiten durch `t("key")` ersetzen** und die Keys (de+en) in der **zugewiesenen** dict-Datei ergänzen.

## Regeln
- Bearbeite NUR deine zugewiesenen Seiten + deine EINE dict-Datei. Keine anderen Dateien (besonders nicht `src/components/**`, `src/lib/i18n/index.tsx`, `dictionaries.ts`, andere dict-Dateien).
- Kein `npm run build`, kein `npm install`.
- Jede Seite ist bereits `"use client"` — `t()` ist nutzbar.

## Nutzung in einer Seite
```tsx
import { useT } from "@/lib/i18n";
export default function Page() {
  const t = useT();
  return <PageHeader title={t("attendance.clock.title")} description={t("attendance.clock.desc")} />;
}
```
`t(key, vars?)` — Interpolation mit `{name}`: `t("x.greeting", { name: "Anna" })` ↔ Key `"Hallo {name}"`.

## Deine dict-Datei
Beispiel `src/lib/i18n/dict/attendance.ts` (Struktur NICHT ändern, nur Inhalt füllen):
```ts
export const attendance = {
  de: {
    "attendance.clock.title": "Ein-/Ausstempeln",
    "attendance.clock.desc": "Erfasse deine Arbeitszeit mit GPS- und Liveness-Prüfung.",
  },
  en: {
    "attendance.clock.title": "Clock In/Out",
    "attendance.clock.desc": "Track your working time with GPS and liveness check.",
  },
} as const;
```
Key-Namenskonvention: `"<bereich>.<seite>.<element>"`, z.B. `payroll.payslips.title`. **Eindeutig** halten.

## SCHON VORHANDENE Keys — NICHT neu definieren, einfach nutzen:
Aus `common` (über `t(...)`):
`common.search, common.export, common.columns, common.reset, common.save, common.cancel, common.create, common.submit, common.close, common.edit, common.delete, common.open, common.download, common.approve, common.reject, common.send, common.required, common.actions, common.status, common.date, common.name, common.department, common.location, common.amount, common.type, common.category, common.priority`
Status-Badges sind bereits übersetzt (Komponente `StatusBadge`). Tabellen-Toolbar/Pagination/Spalten-Header, Sidebar, Topbar, Notifications, KpiCard-Labels (über kpi.id) ebenfalls.

Chart-Serien (für `ChartCard seriesLabels`): `series.Anwesend, series.Remote, series.Abwesend, series.Brutto, series.Netto, series.count, series.value`.
Funnel-Kategorien: `chartlabel.Beworben, chartlabel.Screening, chartlabel.Interview, chartlabel.Angebot, chartlabel.Eingestellt`.

## Spezialfälle
- **ChartCard mit deutschen Serien** (z.B. `series={["Anwesend","Remote","Abwesend"]}` oder `["Brutto","Netto"]`):
  füge `seriesLabels={{ Anwesend: t("series.Anwesend"), Remote: t("series.Remote"), Abwesend: t("series.Abwesend") }}` hinzu. dataKeys/`series` NICHT ändern.
- **Pie/Chart-Daten mit deutschen `label`-Strings, die du selbst baust** (z.B. recruitmentFunnel): mappe die Labels:
  `recruitmentFunnel.map(d => ({ ...d, label: t("chartlabel." + d.label) }))`.
  Status-basierte Verteilungen: `label: t("status." + key)`.
- **KpiCard**: wenn du `useKpis()`-KPIs durchreichst, sind die Labels schon übersetzt — nichts tun.
- **Eigene Stat-Cards / KPI-artige Kacheln mit deutschem Text**: übersetzen (eigene Keys).
- **Spalten-Header** via `<DataTableColumnHeader title="…">` und `header: "…"`-Strings: title mit `t()` füllen.
- **Facets** `facets={[{columnId, title, options:[{label,value}]}]}`: `title` und `option.label` mit `t()` (Optionen sind oft Status/Kategorie — nutze `t("status.xxx")` wo passend).
- **toast(...)**-Texte: übersetzen.
- **Zod-Messages** (`z.string().min(1, "Pflichtfeld")`): `t("common.required")` bzw. eigene Keys verwenden — da Schemas außerhalb der Komponente stehen, definiere das Schema INNERHALB der Komponente (oder nutze eine Factory `makeSchema(t)`), damit `t` verfügbar ist. Einfachste Lösung: Schema-Definition in die Komponente ziehen.
- Personennamen, E-Mails, Geldbeträge (formatCurrency), reine Zahlen NICHT übersetzen.

## Qualität
Natürliches, professionelles Business-Englisch (HR-Domäne: „Leave", „Payroll", „Headcount", „Appraisal", „Reimbursement", „Onboarding"). Keine ungenutzten Imports. Keine Keys doppelt. Build läuft zentral am Ende.
