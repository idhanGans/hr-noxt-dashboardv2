import { common } from "./dict/common";
import { nav } from "./dict/nav";
import { status } from "./dict/status";
import { widgets } from "./dict/widgets";
import { dashboards } from "./dict/dashboards";
import { attendance } from "./dict/attendance";
import { payroll } from "./dict/payroll";
import { people } from "./dict/people";
import { recruitment } from "./dict/recruitment";
import { performance } from "./dict/performance";
import { ess } from "./dict/ess";
import { director } from "./dict/director";
import { access } from "./dict/access";
import { org } from "./dict/org";

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "noxt-locale";

type Part = { de: Record<string, string>; en: Record<string, string> };

const parts: Part[] = [
  common,
  nav,
  status,
  widgets,
  dashboards,
  attendance,
  payroll,
  people,
  recruitment,
  performance,
  ess,
  director,
  access,
  org,
];

function build(locale: Locale): Record<string, string> {
  return Object.assign({}, ...parts.map((p) => p[locale]));
}

export const dictionary: Record<Locale, Record<string, string>> = {
  de: build("de"),
  en: build("en"),
};

export function isLocale(value: string | undefined): value is Locale {
  return value === "de" || value === "en";
}
