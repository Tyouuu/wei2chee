import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BRAND_NAME, WHATSAPP_NUMBER } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-[6px] bg-primary text-[12px] font-semibold text-primary-foreground"
          >
            F
          </span>
          <span className="text-[14px] font-semibold">{BRAND_NAME}</span>
        </Link>
        <LocaleSwitcher tone="dark" />
      </div>

      <article className="mt-12">
        <h1 className="font-serif text-[2rem] leading-tight tracking-[-0.025em]">{t("title")}</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">{tc("updated")}</p>
        <p className="mt-6 border-l-2 border-border pl-4 text-[14px] leading-relaxed text-muted-foreground">
          {t("intro")}
        </p>

        {sections.map((section) => (
          <section key={section.heading} className="mt-9">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{section.heading}</h2>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}

        <section className="mt-12 border-t border-border pt-6">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{tc("disclaimer")}</p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[13px] font-medium text-primary underline-offset-4 hover:underline"
          >
            {tc("contact")} →
          </a>
        </section>
      </article>

      <p className="mt-12 text-[12px] text-muted-foreground">
        <Link href={`/${locale}`} className="transition-colors hover:text-foreground">
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
