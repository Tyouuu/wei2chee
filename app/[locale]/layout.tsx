import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Instrument_Serif, Geist, Geist_Mono, Archivo, Nunito, Manrope, IBM_Plex_Sans, Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
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

// Bare's voice: geometric skeleton with humanist proportions and slightly
// quirky terminals. Chosen for a style that has taken every box away -- with
// no card, no border and no shadow doing any work, the typeface is the design,
// so a neutral grotesque would leave the page looking unfinished rather than
// spare.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-bare-latin",
  display: "swap",
});

// Docket's voice: IBM Plex Sans was drawn for IBM's own business documents --
// forms, invoices, technical paperwork -- which is precisely the object this
// style is imitating. Its slab-ish terminals and squared bowls read as printed
// rather than rendered.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-docket-latin",
  display: "swap",
});

// CJK, and why this file's original "Latin-only webfonts" rule now has two
// exceptions.
//
// That rule was right about the cost and wrong about the consequence. Every
// style bound its own LATIN face -- Archivo, Nunito, Geist -- and none of them
// has a single Chinese glyph, so all three fell back to the same
// "PingFang SC", "Microsoft YaHei". A customer's system is about ninety per
// cent Chinese: 报价单, 客户, 金额, 已确认. The style layer was differentiating
// the ten per cent that is Latin and leaving the ninety identical, which is
// the whole reason Ledger and Blueprint were indistinguishable side by side.
//
// The cost is not what "multi-MB CJK webfont" suggests. Google serves these
// split by unicode-range into ~100 files; a browser downloads only the blocks
// whose characters are on the page, and caches them across the whole site.
// `preload: false` is essential -- with preloading on, Next injects a link tag
// for every block in the declared subset, which IS the multi-MB download the
// original rule feared.
//
// Only two, deliberately. Hearth stays on the system font because that is the
// coherent answer for the register it is in: 「宽松·温和、好读」 is best served
// by the face the customer's own machine already renders everything else in.
const notoSerifSC = Noto_Serif_SC({
  // No `subsets`. Next's generated types only name the Latin-script subsets for
  // these families, because Google delivers the CJK blocks through
  // unicode-range rather than as a named subset. `subsets` controls PRELOADING
  // only, and preloading is exactly what must not happen here.
  weight: ["400", "600"],
  variable: "--font-song-cjk",
  display: "swap",
  preload: false,
});

const notoSansSC = Noto_Sans_SC({
  weight: ["400", "500", "700"],
  variable: "--font-hei-cjk",
  display: "swap",
  preload: false,
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
      className={`${instrumentSerif.variable} ${geist.variable} ${geistMono.variable} ${archivo.variable} ${nunito.variable} ${manrope.variable} ${plexSans.variable} ${notoSerifSC.variable} ${notoSansSC.variable}`}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
