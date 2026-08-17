import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Instrument_Serif, Geist, Geist_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { BRAND_NAME } from "@/lib/brand";
import "../globals.css";

// Latin-only webfonts, composed with system CJK fallbacks in globals.css'
// --font-sans/--font-serif so Chinese text uses the OS's own (already good)
// CJK fonts instead of shipping a multi-MB CJK webfont subset.
//
// Instrument Serif is the display voice: very high stroke contrast, narrow,
// almost no tracking needed at large sizes — it reads as typeset rather than
// rendered, which is the whole difference at Hero scale. Single 400 weight by
// design (the face carries its weight through contrast, not mass).
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif-latin",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans-latin",
  display: "swap",
});

// The draughtsman's hand — margin annotations, section indices, workflow nodes.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: BRAND_NAME,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      className={`${instrumentSerif.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
