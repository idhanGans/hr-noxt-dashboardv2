"use client";

import * as React from "react";

// Root-Crash-Fallback: ersetzt das Root-Layout komplett, liegt also AUSSERHALB
// des LanguageProviders. Deshalb keine useT-Nutzung — Sprache wird aus dem
// Locale-Cookie abgeleitet und mit Inline-Styles ohne Theme-CSS gerendert.
const MESSAGES = {
  de: {
    title: "Etwas ist schiefgelaufen",
    desc: "Es ist ein unerwarteter Fehler aufgetreten. Bitte lade die Seite neu.",
    retry: "Neu laden",
  },
  en: {
    title: "Something went wrong",
    desc: "An unexpected error occurred. Please reload the page.",
    retry: "Reload",
  },
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  const locale =
    typeof document !== "undefined" && document.cookie.includes("noxt-locale=en")
      ? "en"
      : "de";
  const m = MESSAGES[locale];

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
            {m.title}
          </h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 20px" }}>
            {m.desc}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              cursor: "pointer",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {m.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
