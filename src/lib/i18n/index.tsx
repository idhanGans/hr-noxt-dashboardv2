"use client";

import * as React from "react";
import { dictionary, LOCALE_COOKIE, type Locale } from "./dictionaries";

export type { Locale };
export { LOCALE_COOKIE };

type Vars = Record<string, string | number>;
type Translate = (key: string, vars?: Vars) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const t = React.useCallback<Translate>(
    (key, vars) => {
      const value =
        dictionary[locale][key] ?? dictionary.de[key] ?? key;
      return interpolate(value, vars);
    },
    [locale],
  );

  const value = React.useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

// Localizes relative-time strings baked into mock data ("vor 12 Min" / "vor 2 Std").
export function localizeRelTime(value: string, t: Translate): string {
  const min = value.match(/vor (\d+) Min/);
  if (min) return t("reltime.min", { n: min[1] });
  const hour = value.match(/vor (\d+) Std/);
  if (hour) return t("reltime.hour", { n: hour[1] });
  return value;
}
