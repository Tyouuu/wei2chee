"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { PagePreview } from "./page-preview";
import { PageBar } from "./(app)/page-bar";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import chrome from "./chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
};

/** Mirrors PAGE_KEYS. Kept as a plain array here rather than imported so this
 *  client component does not pull the whole template module into the browser
 *  bundle for one membership test. */
const BUILT_IN_PAGE_KEYS: string[] = [
  "dashboard",
  "customers",
  "quotations",
  "projects",
  "payments",
  "bookings",
  "orders",
];

/**
 * The customer's home.
 *
 * REBUILT AS A DASHBOARD, NOT A LANDING PAGE. The previous version was a
 * 1643px scroll: a serif display headline, an eyebrow, a centred narrow column,
 * and four sections separated by 56px gaps — the layout language of a marketing
 * page, applied to a signed-in product. It also owned the only navigation in
 * the whole application (three text links in the top-right corner), and carried
 * the style picker and the settings dialog because there was nowhere else to
 * put them.
 *
 * The shell (`(app)/portal-shell.tsx`) now owns navigation, settings and adding
 * a page; the style picker has its own route. What is left here is what a home
 * should be: what the system understood about this business, the state of it at
 * a glance, the pages themselves, and the next action.
 *
 * THE GRID HOLE. Five cards in a three-column grid left the sixth cell empty,
 * which reads as something failing to load. The 加一页 tile is the last grid
 * item, so it fills whatever cell comes next at any page count — and it is a
 * real control rather than a spacer.
 *
 * PREVIEW LEGIBILITY. At three columns a tile was 355px wide showing a 1180px
 * page — a 0.30 scale that turned 13px body text into 4px of noise. Two columns
 * on a normal laptop puts it near 0.47, where the shape of the page is
 * readable, which is the entire job of a gallery tile.
 */
export function PortalHome({
  locale,
  accountEmail,
  paid,
  style,
  pages,
  summary,
  industryName,
  businessName,
  savedBusinessName,
  componentCount,
}: {
  locale: string;
  accountEmail?: string;
  paid: boolean;
  style: StyleName;
  pages: { pageKey: string; title: string | null; isDraft: boolean; layout: Data }[];
  summary: string | null;
  industryName: string | null;
  businessName: string;
  savedBusinessName: string | null;
  /** How many blocks the customer can build with. On the home because it is the
   *  honest scale of what they have been handed, and the entry point to the
   *  library where they are browsed. */
  componentCount: number;
}) {
  const t = useTranslations("portal.home");
  const tEditor = useTranslations("portal.editor");
  const tShell = useTranslations("portal.shell");
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  const labelFor = (page: { pageKey: string; title: string | null }) =>
    page.title?.trim() ||
    (BUILT_IN_PAGE_KEYS.includes(page.pageKey) ? tEditor(`pages.${page.pageKey}`) : t("customPage"));

  async function removePage(pageKey: string, label: string) {
    if (removing) return;
    if (!window.confirm(t("removeConfirm", { name: label }))) return;
    setRemoving(pageKey);
    const { error } = await createBrowserSupabaseClient().rpc("remove_project_page", {
      target_page_key: pageKey,
    });
    setRemoving(null);
    if (!error) router.refresh();
  }

  const identityLine = accountEmail ? `（账号：${accountEmail}）` : "";
  const deployHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "我的系统设计已经确定了，请开始帮我建系统" + identityLine,
  )}`;

  const draftCount = pages.filter((p) => p.isDraft).length;

  return (
    <>
      <PageBar title={t("navTitle")}>
        <Link
          href={`/${locale}/portal/spec`}
          prefetch={false}
          className="rounded-[7px] px-3 py-1.5 text-[12.5px] [color:var(--color-paper-dim)] transition-colors hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          {t("specTitle")}
        </Link>
        <a
          href={deployHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[7px] px-3 py-1.5 text-[12.5px] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] transition-colors hover:[background-color:var(--color-primary-deep)]"
        >
          {t("buildCta")}
        </a>
      </PageBar>

      <div className="px-8 py-7">
        <section className="max-w-3xl">
          <h1 className="text-balance text-[26px] leading-[1.25] [color:var(--color-paper)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title-lg)]">
            {industryName ? t("titleWithIndustry", { industry: industryName }) : t("title")}
          </h1>

          {/* The AI's own sentence about this business, on the first screen
              after signing in — the clearest evidence that the questionnaire
              was not a form that went nowhere. */}
          {summary && (
            <p className="mt-3 border-l-2 pl-3.5 [border-color:var(--color-primary)] [color:var(--color-paper-dim)] [font-size:var(--text-base)] [line-height:var(--leading-body)]">
              {summary}
            </p>
          )}

          {!savedBusinessName && (
            <p className="mt-3 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {t("namePrompt", { name: businessName })}
            </p>
          )}
        </section>

        {/* THE STATUS STRIP. What turns a page into a dashboard: the state of
            the thing, readable without scrolling or clicking. */}
        <dl className="mt-7 grid gap-px overflow-hidden rounded-[9px] [background-color:var(--color-ink-800)] sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("statPages")} value={String(pages.length)} note={t("statDrafts", { count: draftCount })} />
          <Stat
            label={t("statStyle")}
            // The style's NAME, with its description as the note. The value slot
            // is what a reader scans; "制图 · 精准、技术感" there answers a
            // question nobody asked, and hides the one word that identifies it.
            value={style === "ledger" ? "Ledger" : style === "hearth" ? "Hearth" : "Blueprint"}
            note={t(`styleTag.${style}`)}
            href={`/${locale}/portal/styles`}
            cta={t("statChange")}
          />
          <Stat label={t("statBlocks")} value={String(componentCount)} note={t("statBlocksNote")} href={`/${locale}/portal/library`} cta={t("statBrowse")} />
          <Stat
            label={t("statPlan")}
            value={paid ? tShell("planPaid") : tShell("planFree")}
            note={paid ? t("statPlanPaidNote") : t("statPlanFreeNote")}
            tone={paid ? "good" : "warn"}
          />
        </dl>

        <section className="mt-9">
          <h2 className="text-[13px] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("pagesTitle")}
          </h2>

          <ul className="mt-4 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            {pages.map((page) => (
              // The link does NOT wrap the card. A live preview renders the
              // page's own rail, which is a list of <a> elements, and an <a>
              // around those is invalid HTML — React reports it as a hydration
              // error and browsers recover by splitting the anchor, which breaks
              // the card. So the anchor sits in the footer and is stretched over
              // the card with a pseudo-element instead. (Found by a browser
              // test: the click resolved to six links.)
              <li
                key={page.pageKey}
                className={`group relative ${chrome.sheet} [background-color:var(--color-ink-900)] transition-transform duration-200 hover:-translate-y-0.5`}
              >
                {/* The one place the customer's own style is let out into the
                    chrome: this div re-scopes every token to their light
                    register, so a light page sits inside a dark frame exactly as
                    it will on their screen. */}
                <div
                  className={`${styles.scope} ${SCOPE_CLASS[style]} border-b [border-color:var(--color-ink-800)]`}
                >
                  <PagePreview data={page.layout} />
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                      {labelFor(page)}
                    </span>
                    <span className="mt-0.5 block [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                      {page.isDraft ? t("cardDraft") : t("cardEdited")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {/* The dashboard is not removable — every page's rail links
                        back to it and /portal sends people there. The database
                        refuses it too (migration 20260820200000), so this is the
                        affordance matching the rule, not the rule itself. */}
                    {page.pageKey !== "dashboard" && (
                      <button
                        type="button"
                        onClick={() => removePage(page.pageKey, labelFor(page))}
                        disabled={removing === page.pageKey}
                        // `relative z-10`: the open link below stretches a
                        // pseudo-element over the whole card, and without its own
                        // stacking context this button sits underneath it and can
                        // never be clicked.
                        className="relative z-10 whitespace-nowrap [color:var(--color-paper-dim)] [font-size:var(--text-xs)] transition-colors hover:[color:var(--color-clay-bright)] disabled:opacity-50"
                      >
                        {t("removePage")}
                      </button>
                    )}
                    <Link
                      href={`/${locale}/portal/${page.pageKey}`}
                      className="whitespace-nowrap [color:var(--color-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] transition-transform after:absolute after:inset-0 after:content-[''] group-hover:translate-x-0.5"
                    >
                      {t("cardCta")} →
                    </Link>
                  </span>
                </div>
              </li>
            ))}

            {/* Last grid item, so it fills whatever cell follows the pages at
                any count — the fix for a gallery that showed a hole where a
                sixth page would have been. */}
            <li>
              <Link
                href={`/${locale}/portal/templates`}
                className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-[11px] border border-dashed [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] transition-colors hover:[border-color:var(--color-primary)] hover:[color:var(--color-paper)]"
              >
                <span aria-hidden="true" className="text-[22px] leading-none">
                  +
                </span>
                <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                  {t("addPageCta")}
                </span>
                <span className="max-w-[16rem] text-center text-[11.5px] leading-snug">
                  {t("addPageHint")}
                </span>
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  note,
  href,
  cta,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
  cta?: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="[background-color:var(--color-ink-900)] px-4 py-3.5">
      <dt className="text-[10.5px] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-[19px] leading-none [font-weight:var(--fw-semibold)] ${
          tone === "good"
            ? "[color:var(--color-jade-bright)]"
            : tone === "warn"
              ? "[color:var(--color-brass-bright)]"
              : "[color:var(--color-paper)]"
        }`}
      >
        {value}
      </dd>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
        <span className="[color:var(--color-paper-dim)]">{note}</span>
        {href && cta && (
          <Link href={href} className="shrink-0 [color:var(--color-primary)] hover:underline">
            {cta} →
          </Link>
        )}
      </div>
    </div>
  );
}
