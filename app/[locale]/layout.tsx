import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Instrument_Serif, Geist, Geist_Mono, Archivo, Nunito } from "next/font/google";
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

// Per-style display faces. Until 2026-08-20 all three design-system styles
// (design-system/tokens/{ledger,hearth,blueprint}.css) shared one font stack,
// which is a large part of why they were indistinguishable to a customer
// comparing them side by side -- see docs/formae-product-direction.md sec 9.
// Each style now binds its own --font-ui; these are the Latin halves, composed
// with the same system CJK fallbacks as --font-sans above.

// Ledger's voice: a slightly condensed grotesque that carries real weight at
// display sizes. Matches how construction/ops software actually looks
// (Procore's heavy condensed headings) rather than a neutral SaaS sans.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-industrial-latin",
  display: "swap",
});

// Hearth's voice: rounded terminals, geometric skeleton, tall x-height -- the
// friendly register beauty/salon/education software runs in (Fresha).
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-rounded-latin",
  display: "swap",
});

/**
 * Everything a link needs to survive being pasted somewhere.
 *
 * Before this the whole app declared `{ title: "Formae" }` and nothing else:
 * no description, no Open Graph, no Twitter card, no image, no apple-touch
 * icon. Pasted into WhatsApp — which is where this business is actually
 * introduced in Malaysia, not email and not search — the link rendered as a
 * bare grey URL with no title, no picture and no explanation.
 *
 * That is a distribution bug, not a polish item. The founder's plan is to send
 * this link to contractors and shop owners; the preview card IS the pitch for
 * the two seconds before anyone taps.
 *
 * `metadataBase` has to be absolute for og:image to resolve at all. Vercel
 * supplies the deployment host at build time; the localhost fallback keeps
 * `next build` working off-platform rather than silently emitting relative
 * image URLs that no scraper can follow.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}`
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale !== "en";

  const title = zh ? "Formae — 先看到你的系统，再决定要不要做" : "Formae — see your system before you build it";
  const description = zh
    ? "回答几个关于生意的问题，当场看到一套照你流程做的系统：报价单、客户名单、收款记录，全部用你自己的说法。满意了我们再帮你做成真的。设计阶段免费。"
    : "Answer a few questions about your business and see a working system built around your own workflow — quotations, customers, payments, in your own words. Designing it is free.";

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${BRAND_NAME}` },
    description,
    applicationName: BRAND_NAME,
    // Both locales point at each other, so a link shared in one language can be
    // re-served in the other rather than being a dead end for half the market.
    alternates: {
      canonical: `/${locale}`,
      languages: { "zh-Hans": "/zh", en: "/en" },
    },
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      url: `${SITE_URL}/${locale}`,
      title,
      description,
      locale: zh ? "zh_CN" : "en_MY",
    },
    twitter: { card: "summary_large_image", title, description },
    icons: {
      icon: "/favicon.ico",
      // WhatsApp and iOS home-screen bookmarks both reach for this one; without
      // it iOS screenshots the page and uses that, which at this size is a
      // grey smear.
      apple: "/apple-icon.png",
    },
  };
}

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
      className={`${instrumentSerif.variable} ${geist.variable} ${geistMono.variable} ${archivo.variable} ${nunito.variable}`}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
