"use client";

import { useState } from "react";
import { OPTIONAL_MODULES } from "@/lib/portal/module-catalog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { PagePreview } from "./page-preview";
import { STYLE_LABEL } from "./(app)/styles/styles-client";
import { PageBar } from "./(app)/page-bar";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import chrome from "./chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { scopeClasses } from "@/lib/portal/palettes";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  bare: styles.bare,
  docket: styles.docket,
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
  palette,
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
  /** The customer's 配色 layer, or null for this layout's native colours.
   *  Threaded from the server rather than fetched again: the same projects row
   *  supplies `style`, and a second query would be a second source of truth. */
  palette: string | null;
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

  // Capped at six: the tile is one grid cell, and a wrapping wall of every
  // remaining module turns an invitation back into a decision.
  const have = new Set(pages.map((p) => p.pageKey));
  const offerable = OPTIONAL_MODULES.filter((m) => !have.has(m.key)).slice(0, 6);

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
          className="rounded-[var(--radius-md)] px-3 py-1.5 [font-size:var(--text-xs)] [color:var(--color-paper-dim)] transition-colors hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          {t("specTitle")}
        </Link>
        <a
          href={deployHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[var(--radius-md)] px-3 py-1.5 [font-size:var(--text-xs)] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] transition-colors hover:[background-color:var(--color-primary-deep)]"
        >
          {t("buildCta")}
        </a>
      </PageBar>

      <div className="px-8 py-9">
        {/* THE FOLD.
            Three text elements, not thirty. Measured on durable.co: a 72px
            display line, a two-line subhead, one input — and their type jumps
            14 -> 72 where this page jumped 13 -> 26. The size of that jump IS
            the hierarchy; adding intermediate steps never produced one.

            The display line is the AI's own sentence about THIS business,
            because that is the only sentence on the screen that could not have
            been written about anybody else. It used to be a grey quote block
            under a product headline reading 「你的其他系统已经建好了。」 —
            which for a master dealer literally rendered the industry slug
            "其他" as their trade. */}
        <section className="max-w-3xl">
          <h1 className="text-balance [color:var(--color-paper)] [font-family:var(--font-display)] [font-size:var(--text-hero)] [font-weight:var(--fw-regular)] [letter-spacing:var(--tracking-title-lg)] [line-height:1.08]">
            {summary || (industryName ? t("titleWithIndustry", { industry: industryName }) : t("title"))}
          </h1>

          <p className="mt-5 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-base)] [line-height:var(--leading-body)]">
            {summary
              ? t("subline", { count: pages.length })
              : t("namePrompt", { name: businessName })}
          </p>

          {summary && !savedBusinessName && (
            <p className="mt-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {t("namePrompt", { name: businessName })}
            </p>
          )}
        </section>

        {/* WAS FOUR EQUAL CELLS WITH HAIRLINES BETWEEN THEM.
            Four boxed cells of identical size state that four things matter
            equally, and leave the reader to work out which to look at first —
            so 「可用组件 19」 competed with the customer's own seven pages for
            the same first look. 21st.dev sets its counts inline with the noun
            they count ("2,100+ UI components:", "Backgrounds 365") rather than
            as separate statistics, and that is what this is now: one quiet
            line, scannable, with the two things that are actually actionable
            carrying links. */}
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
          <span>
            <b className="[color:var(--color-paper)] [font-family:var(--font-numeric)] [font-weight:var(--fw-semibold)] tabular-nums">
              {pages.length}
            </b>{" "}
            {t("metaPages", { count: pages.length }).replace(/^\d+\s*/, "")}
            {draftCount > 0 && (
              <span className="[color:var(--color-brass-bright)]">
                {" · "}
                {t("metaDrafts", { count: draftCount })}
              </span>
            )}
          </span>

          <Dot />

          <span>
            {t("metaStyle")}{" "}
            <b className="[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
              {STYLE_LABEL[style]}
            </b>{" "}
            <Link
              href={`/${locale}/portal/styles`}
              className="[color:var(--color-primary)] hover:underline"
            >
              {t("metaChange")}
            </Link>
          </span>

          <Dot />

          <span>
            <b className="[color:var(--color-paper)] [font-family:var(--font-numeric)] [font-weight:var(--fw-semibold)] tabular-nums">
              {componentCount}
            </b>{" "}
            {t("metaBlocks", { count: componentCount }).replace(/^\d+\s*/, "")}{" "}
            <Link
              href={`/${locale}/portal/library`}
              className="[color:var(--color-primary)] hover:underline"
            >
              {t("metaBrowse")}
            </Link>
          </span>

          <Dot />

          {/* Plan keeps a pill rather than joining the run of plain text: it is
              the one item here that is a STATE rather than a count, and a
              customer scanning for "am I paid up" should not have to read a
              sentence to find it. */}
          <span
            className={`rounded-[var(--radius-pill)] px-2.5 py-0.5 [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] ${
              paid
                ? "[background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)]"
                : "[background-color:var(--color-ink-850)] [color:var(--color-brass-bright)]"
            }`}
          >
            {paid ? tShell("planPaid") : tShell("planFree")}
            {" · "}
            {paid ? t("statPlanPaidNote") : t("statPlanFreeNote")}
          </span>
        </div>

        <section className="mt-9">
          <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
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
                    chrome: the inner div re-scopes every token to their own
                    register, so their page sits inside Formae's frame exactly
                    as it will on their screen.

                    The mount is what keeps that legible. Without it the
                    customer's page bleeds to the card's own edge and the two
                    grounds meet directly -- which is survivable while this
                    chrome is light and is exactly what sinks a dark rail once
                    it is not. See `--mount-*` in chrome.module.css. */}
                <div className={`${chrome.mount} m-3 mb-0`}>
                  <div className={scopeClasses(style, palette)}>
                    <PagePreview data={page.layout} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2.5">
                  <span className="min-w-0">
                    <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                      {labelFor(page)}
                    </span>
                    {/* Draft and edited finally look different. Every card
                        used to carry this line in the same grey, so the one
                        page the customer HAD worked on was indistinguishable
                        from the six they had not — on the screen whose whole
                        job is to show them where they left off. Brass is the
                        product's existing "needs attention" tone; jade is its
                        "done". */}
                    <span
                      className={`mt-1 inline-block rounded-[var(--radius-pill)] px-2 py-0.5 [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] ${
                        page.isDraft
                          ? "[background-color:color-mix(in_oklab,var(--color-brass)_13%,transparent)] [color:var(--color-brass-bright)]"
                          : "[background-color:color-mix(in_oklab,var(--color-jade)_13%,transparent)] [color:var(--color-jade-bright)]"
                      }`}
                    >
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
            {/* WAS AN EMPTY DASHED BOX WITH A PLUS IN IT.
                That asked the customer to think of a page; this shows them
                what is on offer. The chips are the module catalogue
                (lib/portal/module-catalog.ts) minus what they already have —
                so a master dealer who has 对账 and 佣金 is offered 开销, 报表,
                库存, and a salon is offered something else. Same move as
                21st.dev putting a count beside every category: naming what is
                available is what makes a library read as deep. */}
            <li>
              <Link
                href={`/${locale}/portal/templates`}
                className="flex h-full min-h-[220px] flex-col justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed p-7 [border-color:var(--color-ink-700)] transition-colors hover:[border-color:var(--color-primary)]"
              >
                <span className="[color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                  {t("addPageCta")}
                </span>
                <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                  {t("addPageChips")}
                </span>
                {offerable.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-2">
                    {offerable.map((m) => (
                      <span
                        key={m.key}
                        className="rounded-[var(--radius-pill)] border px-3 py-1 [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)]"
                      >
                        {m.label}
                      </span>
                    ))}
                  </span>
                )}
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}

/** The separator between meta items. A dot rather than a pipe or a slash: at
 *  14px a pipe reads as a table rule and a slash reads as part of a value. */
function Dot() {
  return (
    <span
      aria-hidden="true"
      className="h-[3px] w-[3px] rounded-[var(--radius-pill)] [background-color:var(--color-ink-700)]"
    />
  );
}
