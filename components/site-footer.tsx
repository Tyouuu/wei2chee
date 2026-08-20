"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BRAND_NAME, WHATSAPP_NUMBER } from "@/lib/brand";

/**
 * The page's last line. It existed nowhere before — the document simply
 * stopped, which on a page asking a business owner for RM5,000 reads as
 * abandonment rather than restraint.
 *
 * It carries exactly two things: a way to reach a human, and a statement of
 * where the business is. Both are trust signals for this specific buyer — a
 * Malaysian SME owner deciding whether the person behind the site is local and
 * reachable — and WhatsApp is where that conversation actually happens here,
 * not email.
 */
export function SiteFooter() {
  const t = useTranslations("footer");
  const tLegal = useTranslations("legal");
  const locale = useLocale();
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("waMessage"))}`;

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16 sm:px-10 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="annotation">{BRAND_NAME} / SYS.DESIGN</div>
          <p className="mt-4 max-w-md font-serif text-[clamp(1.25rem,2.5vw,1.75rem)] leading-[1.25] tracking-[-0.02em] text-balance">
            {t("line")}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">{t("place")}</p>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative shrink-0 self-start border border-blueprint/50 px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-blueprint uppercase transition-colors duration-300 hover:border-blueprint focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none md:self-auto"
        >
          <span className="absolute inset-0 origin-left scale-x-0 bg-blueprint transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
          <span className="relative transition-colors duration-300 group-hover:text-[var(--ink)]">
            {t("wa")} →
          </span>
        </a>
      </div>

      {/* The legal line. It had exactly one link on it before — WhatsApp — so
          there was no route to a privacy policy or terms from anywhere on the
          site, and no sign-in link either. Both are things a visitor looks for
          in a footer before deciding a company is real. */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-5 text-[12.5px] text-muted-foreground sm:px-10">
          <span>© {new Date().getFullYear()} {BRAND_NAME}</span>
          <Link href={`/${locale}/legal/privacy`} className="transition-colors hover:text-foreground">
            {tLegal("privacyLink")}
          </Link>
          <Link href={`/${locale}/legal/terms`} className="transition-colors hover:text-foreground">
            {tLegal("termsLink")}
          </Link>
          <span className="flex-1" />
          <Link href={`/${locale}/login`} className="transition-colors hover:text-foreground">
            {t("signIn")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
