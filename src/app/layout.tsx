import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Lexend, Source_Sans_3, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/dictionaries";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HR Noxt — Enterprise HRIS",
  description:
    "Enterprise Human Resource Information System — Dashboards, Attendance, Payroll, Recruitment & Performance.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const stored = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : "de";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${lexend.variable} ${sourceSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
