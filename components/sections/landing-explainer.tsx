"use client";

import Link from "next/link";

import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
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
  const locale = useLocale();
  return (
    // The one dark band. 交付什么 is the section where the reader stops
    // browsing and starts checking whether this is real, so it is the one
    // worth stopping the page for.
    <SectionShell label="SCOPE" heading={t("title")} ground="ink">
      <Rows
        items={[
          { term: t("d1"), detail: t("d1d") },
          { term: t("d2"), detail: t("d2d") },
          { term: t("d3"), detail: t("d3d") },
        ]}
      />

      {/*
        THE MIDDLE OF THE PAGE HAD NOTHING TO PRESS.

        Counted on 2026-08-25: this page offered an action in the hero and again
        in the footer, and across the five thousand pixels between them, none.
        Linear, Attio, Stripe and Polar all repeat theirs three or four times,
        for the plain reason that a reader is not persuaded on a schedule -- the
        one who is ready at 「你最后拿到的是这些东西」 should not have to scroll
        past two more sections to act on it.

        Here rather than anywhere else because this is the section that answers
        "is it real", and a white button on the one ink band is the strongest
        object the page has to offer at that moment.
      */}
      <div className="mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
        <Link
          href={`/${locale}#ask`}
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[oklch(0.16_0.012_265)] transition-transform duration-200 hover:scale-[1.02]"
        >
          {t("cta")}
          <span aria-hidden>&rarr;</span>
        </Link>
        <span className="text-sm text-[var(--muted-foreground)]">{t("ctaNote")}</span>
      </div>
    </SectionShell>
  );
}

export function Pricing() {
  const t = useTranslations("explainer.price");
  const locale = useLocale();
  // `t.raw` rather than three flat keys: the steps are a LIST, and a list in
  // the message file is one edit when it becomes four steps instead of three.
  const steps = t.raw("steps") as { label: string; amount: string; note: string; includes?: string[] }[];

  return (
    <SectionShell id="pricing" label="PRICE" heading={t("title")}>
      {/*
        THREE STEPS, NOT TWO FIGURES.
        Confirmed by the founder on 2026-08-25 after he said the page had it
        wrong: RM 500 for the spec, the build priced by module, RM 199 a month
        to host. The old copy said 「开发费 RM 5,000 一口价」, which was neither
        the agreed price nor the agreed SHAPE -- a flat fee hides the one thing
        that makes this affordable to a Malaysian SME, which is that they pay
        for the modules they actually want.

        The competitor this is measured against (XYSTEM, RM1,499 起) publishes
        a price list; being vaguer than them about money would be a real
        disadvantage rather than a negotiating position.

        A rail down the left rather than three boxed cards: these are STEPS in
        an order, and three equal cards say "pick one", which is exactly the
        wrong reading. The number is the object -- set at figure scale, with
        the step's name above it in the annotation face.
      */}
      <ol className="border-t border-border">
        {steps.map((step, i) => (
          <motion.li
            key={step.label}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-x-10 gap-y-3 border-b border-border py-8 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
          >
            <div>
              <div className="annotation">{step.label}</div>
              <div className="mt-2 font-serif text-[clamp(1.75rem,3.2vw,2.35rem)] leading-none tracking-[-0.02em] tabular-nums">
                {step.amount}
              </div>
            </div>
            <div className="max-w-[46ch] self-center">
              <p className="text-sm leading-relaxed text-muted-foreground">{step.note}</p>
              {/* 打勾的清单。
                  2026-09-01 量了六个真的在收订阅费的价钱页（Linear · Vercel ·
                  Framer · Stripe · Trafft · Notion，对照图
                  `.screenshots/pricing/sheet.jpg`）——**六个里六个**在价钱底下
                  都是一串打勾的短句，没有一个用整段文字。
                  ⚠️ 他们的**四栏并排**我们故意不抄：那是「三选一」的形状，
                  而我们这三步是**照顺序全部都要付**的。抄成并排等於在骗人。
                  能搬的是这一样 —— 一个老板读「按模块计价」学不到东西，
                  读三个打勾学得到。 */}
              <ul className="mt-3 grid gap-1.5">
                {(step.includes ?? []).map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm leading-snug text-foreground/70">
                    <span aria-hidden className="mt-[0.35em] size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </motion.li>
        ))}
      </ol>

      {/* A SECTION ABOUT MONEY WITH NOTHING TO PRESS. Every reference page
          photographed on 2026-08-25 -- Linear, Attio, Stripe, Polar -- ends its
          pricing with an action. This one ended with a paragraph, so the reader
          most ready to act was handed nothing and had to scroll on. */}
      <div className="mt-10 flex flex-col gap-6 border-l-2 border-blueprint/50 pl-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[52ch] leading-relaxed text-foreground/80">{t("free")}</p>
        <Link
          href={`/${locale}#ask`}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {t("cta")}
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
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
