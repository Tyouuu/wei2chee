import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";
import { OrganizationSchema } from "@/components/organization-schema";
import { fontVariables } from "@/app/fonts";
import "../globals.css";
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
/* 搬进 lib/site-url.ts —— sitemap 跟 robots 也要用同一个。 */

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
      className={fontVariables}
    >
      <body>
        {/* 「这家公司是谁」，讲给机器听。见 components/organization-schema.tsx —— 里面写了
            为什么没有地址跟电话（那两样今天是假的，宁可留白）。 */}
        <OrganizationSchema locale={locale} />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
