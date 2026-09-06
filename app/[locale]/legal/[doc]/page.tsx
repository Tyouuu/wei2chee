import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BRAND_NAME, whatsappHref } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import chrome from "@/app/[locale]/portal/chrome.module.css";

/**
 * Privacy policy and terms of service.
 *
 * WHY THEY EXIST NOW. Neither did. A product that asks a business owner for
 * their trade, their workflow, their customer names and their money, while
 * publishing no statement of what it does with any of it, is asking for trust
 * it has not offered anything in return for. Malaysia's PDPA also requires a
 * privacy notice, and Google's OAuth review asks for the URL of one before it
 * will approve a production client.
 *
 * WRITTEN AS PLAIN SENTENCES, NOT AS A TEMPLATE. The reader is a contractor or
 * a salon owner, not a lawyer, and a page of imported boilerplate about
 * "Affiliates and Subsidiaries" says less than four honest paragraphs about
 * what actually happens to their data. Every claim here is one this codebase
 * can back: what is stored, who it goes to, and how to get it out or delete it.
 *
 * NOT LEGAL ADVICE AND SAID SO. These are accurate descriptions written by the
 * people who built the system; a real launch wants a Malaysian lawyer to read
 * them.
 */

const DOCS = ["privacy", "terms"] as const;
type Doc = (typeof DOCS)[number];

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { locale, doc } = await params;
  if (!DOCS.includes(doc as Doc)) notFound();

  const t = await getTranslations(`legal.${doc as Doc}`);
  const tc = await getTranslations("legal");
  const sections = t.raw("sections") as { heading: string; body: string }[];

  return (
    /*
     * WHITE PAPER, ON THE DARK GROUND. Terms and privacy are documents, not
     * app screens: they get read slowly, quoted back, and printed. The rule
     * this product now runs on is that Formae's own surfaces are the dark
     * room, the customer's system is the lit object in it, and the customer's
     * PAPERWORK is white -- and a terms page is paperwork in every sense.
     *
     * `chrome.paper` re-declares the surface tokens so everything inside
     * resolves against white without a single colour being hardcoded here,
     * and `chrome.paperSheet` gives it the edge and the shadow that make it a
     * sheet lying on the desk rather than a hole cut in the page. Both drop
     * away under `print:`. Same class the specification uses, deliberately:
     * these two are the only documents in the product and they should look
     * like the same stationery.
     */
    <main
      className={`${chrome.paper} ${chrome.paperSheet} mx-auto my-10 flex max-w-2xl flex-col px-10 py-12 print:my-0 print:max-w-none print:px-0 print:py-0`}
    >
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-[6px] bg-primary text-[12px] font-semibold text-primary-foreground"
          >
            F
          </span>
          <span className="text-[14px] font-semibold">{BRAND_NAME}</span>
        </Link>
        <LocaleSwitcher tone="light" />
      </div>

      <article className="mt-12">
        <h1 className="font-serif text-[2rem] leading-tight tracking-[-0.025em]">
          {t("title")}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {tc("updated")}
        </p>
        <p className="mt-6 border-l-2 border-border pl-4 text-[14px] leading-relaxed text-muted-foreground">
          {t("intro")}
        </p>

        {sections.map((section) => (
          <section key={section.heading} className="mt-9">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
              {section.heading}
            </h2>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}

        <section className="mt-12 border-t border-border pt-6">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {tc("disclaimer")}
          </p>
          {/* 🔴 号码还是占位符就整颗不画 —— 一条打给不存在的号码的连结，
              按的人会认定这家公司不是真的（`lib/brand.ts` 的原话）。 */}
          {whatsappHref() && (
            <a
              href={whatsappHref() as string}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[13px] font-medium text-primary underline-offset-4 hover:underline"
            >
              {tc("contact")} →
            </a>
          )}
        </section>
      </article>

      <p className="mt-12 text-[12px] text-muted-foreground">
        <Link
          href={`/${locale}`}
          className="transition-colors hover:text-foreground"
        >
          ← {BRAND_NAME}
        </Link>
        <span className="mx-2 opacity-40">·</span>
        <Link
          href={`/${locale}/legal/${doc === "privacy" ? "terms" : "privacy"}`}
          className="transition-colors hover:text-foreground"
        >
          {doc === "privacy" ? tc("termsLink") : tc("privacyLink")}
        </Link>
      </p>
    </main>
  );
}
