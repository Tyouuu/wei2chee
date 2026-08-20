"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SectionShell } from "@/components/section-shell";

/**
 * The four reference sections every visitor sees, whether or not they engage
 * with the interactive flow.
 *
 * WHY THEY EXIST: measured on the real page, an anonymous visitor's entire
 * experience was 1,775px — a hero and a list of eight trades, then the document
 * ended. Everything else on the page (peer cases, the analysis, the CTA) is
 * gated behind picking a trade, so someone who scrolled instead of clicking hit
 * a void. There was no statement of what the product does, no price, no answer
 * to the one question a Malaysian SME owner asks first ("跟找一家网页公司做有什么
 * 不同?"), and no footer. A landing page that ends after two screens does not
 * read as an unfinished page; it reads as an unfinished company.
 *
 * They are grouped in one file because they are one argument delivered in four
 * beats — process, deliverable, price, objections — not four independent
 * features. Splitting them across four files would hide that they have to be
 * read, and edited, together.
 *
 * NONE OF THEM ARE NUMBERED. See SectionShell's `index` prop for why: the
 * numbered sections are the steps of the interactive flow, and three of those
 * four only render once a trade is picked.
 */

/** Shared row treatment — the same drafting-schedule rhythm IndustrySelect
 *  already establishes, so these read as more of the same sheet rather than as
 *  a marketing block bolted underneath one. */
function Rows({
  items,
}: {
  items: { term: string; detail: string; note?: string }[];
}) {
  return (
    <div className="border-t border-border">
      {items.map((item, i) => (
        <motion.div
          key={item.term}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-2 border-b border-border py-6 md:grid-cols-[13rem_1fr] md:gap-8"
        >
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-lg text-foreground/90">{item.term}</span>
          </div>
          <div>
            <p className="leading-relaxed text-foreground/70">{item.detail}</p>
            {item.note && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.note}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function HowItWorks() {
  const t = useTranslations("explainer.process");
  return (
    <SectionShell id="how" label="PROCESS" heading={t("title")}>
      <Rows
        items={[
          { term: t("s1"), detail: t("s1d"), note: t("s1n") },
          { term: t("s2"), detail: t("s2d"), note: t("s2n") },
          { term: t("s3"), detail: t("s3d"), note: t("s3n") },
        ]}
      />
    </SectionShell>
  );
}

export function WhatYouGet() {
  const t = useTranslations("explainer.scope");
  return (
    <SectionShell label="SCOPE" heading={t("title")}>
      <Rows
        items={[
          { term: t("d1"), detail: t("d1d") },
          { term: t("d2"), detail: t("d2d") },
          { term: t("d3"), detail: t("d3d") },
        ]}
      />
    </SectionShell>
  );
}

export function Pricing() {
  const t = useTranslations("explainer.price");
  return (
    <SectionShell id="pricing" label="PRICE" heading={t("title")}>
      {/* The two figures are the section, so they are set at figure scale
          rather than buried in a paragraph. The competitor this product is
          measured against (XYSTEM, RM1,499 起 for a web system) publishes a
          price list; being vaguer than them about money would be a real
          disadvantage, not a negotiating position. */}
      <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
        {[
          { amount: t("buildAmount"), label: t("buildLabel"), note: t("buildNote") },
          { amount: t("hostAmount"), label: t("hostLabel"), note: t("hostNote") },
        ].map((cell) => (
          <div key={cell.label} className="bg-background p-8">
            <div className="annotation">{cell.label}</div>
            <div className="mt-3 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-none tracking-[-0.02em] tabular-nums">
              {cell.amount}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{cell.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 border-l-2 border-blueprint/50 pl-5 leading-relaxed text-foreground/80">
        {t("free")}
      </p>
    </SectionShell>
  );
}

export function Faq() {
  const t = useTranslations("explainer.faq");
  const keys = ["q1", "q2", "q3", "q4", "q5"] as const;
  return (
    <SectionShell label="QUESTIONS" heading={t("title")}>
      <div className="border-t border-border">
        {keys.map((k, i) => (
          <motion.details
            key={k}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="group border-b border-border"
          >
            {/* <details> rather than state: a FAQ that works before hydration,
                is searchable by the browser's own find-in-page when open, and
                needs no keyboard handling written by hand. */}
            <summary className="flex cursor-pointer list-none items-center gap-5 py-5 text-left [&::-webkit-details-marker]:hidden">
              <span className="flex-1 text-lg text-foreground/90 transition-colors duration-300 group-hover:text-foreground">
                {t(k)}
              </span>
              <span
                aria-hidden="true"
                className="font-mono text-blueprint transition-transform duration-300 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="max-w-2xl pb-6 leading-relaxed text-foreground/70">{t(`${k}a`)}</p>
          </motion.details>
        ))}
      </div>
    </SectionShell>
  );
}
