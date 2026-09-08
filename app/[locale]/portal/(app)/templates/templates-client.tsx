"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PagePreview } from "../../page-preview";
import { PageBar } from "../page-bar";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import chrome from "../../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

import { StyleScope } from "@/design-system/editor/style-scope";

/** Mirrors add_project_page's own ceiling (migration 20260820200000). Stated in
 *  both places on purpose: the customer should meet the limit as a disabled
 *  button with a reason, not as a raw Postgres error after pressing one. */
const PAGE_LIMIT = 12;

type Template = {
  pageKey: string;
  label: string;
  alreadyAdded: boolean;
  layout: Data;
};

/** One SHAPE for the website page, as opposed to one KIND of page. */
type Landing = {
  key: string;
  label: string;
  blurb: string;
  layout: Data;
};

export function TemplatesClient({
  locale,
  style,
  palette,
  templates,
  landings,
  hasWebsite,
  pageCount,
}: {
  locale: string;
  style: StyleName;
  /** The customer's 配色 layer, or null for this layout's native colours.
   *  Threaded from the server rather than fetched again: the same projects row
   *  supplies `style`, and a second query would be a second source of truth. */
  palette: string | null;
  templates: Template[];
  /** The six 官网 shapes, already built with this business's own words. */
  landings: Landing[];
  /** False only for an account whose website page was deleted -- the section
   *  then offers to add it back rather than linking to a page that is gone. */
  hasWebsite: boolean;
  pageCount: number;
}) {
  const t = useTranslations("portal.templates");
  const tAdd = useTranslations("portal.addPage");
  const tEditor = useTranslations("portal.editor");
  const router = useRouter();

  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  // Which template is open at full size. A quarter-card render proves a page
  // exists; it cannot be read, and reading it is the decision.
  const [zoomed, setZoomed] = useState<(typeof templates)[number] | null>(null);
  const [zoomedLanding, setZoomedLanding] = useState<Landing | null>(null);

  const full = pageCount >= PAGE_LIMIT;

  async function add(requestedKey: string | null, title: string) {
    if (busy || full) return;
    setBusy(requestedKey ?? "__custom__");
    setFailed(null);

    const { data, error } = await createBrowserSupabaseClient().rpc(
      "add_project_page",
      {
        requested_key: requestedKey,
        new_title: title,
      },
    );
    setBusy(null);

    if (error) {
      setFailed(
        error.message.includes("limit") ? tAdd("failedLimit") : tAdd("failed"),
      );
      return;
    }
    // Straight into the editor for the page that was just created. Adding a
    // page and being left on the gallery makes the customer hunt for the thing
    // they just made.
    router.push(`/${locale}/portal/${String(data)}`);
  }

  return (
    <>
      <PageBar title={t("title")} subtitle={t("subtitle")}>
        <span className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
          {t("pageCount", { count: pageCount, limit: PAGE_LIMIT })}
        </span>
      </PageBar>

      <div className="px-8 py-7">
        <p className="max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {t("body")}
        </p>

        {failed && (
          <p
            role="alert"
            className="mt-4 [color:var(--color-clay-bright)] [font-size:var(--text-sm)]"
          >
            {failed}
          </p>
        )}

        {/* THE ONE THAT MATTERS MOST, FIRST. A page this product has never heard
            of is the difference between designing a system and picking from a
            menu, so it leads rather than sitting under the ready-made ones as
            an afterthought. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (customTitle.trim()) add(null, customTitle.trim());
          }}
          className="mt-6 max-w-2xl rounded-[var(--radius-lg)] [border:1px_solid_var(--color-ink-800)] [background-color:var(--color-ink-900)] p-5"
        >
          <h2 className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
            {t("customTitle")}
          </h2>
          <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
            {t("customBody")}
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              maxLength={24}
              placeholder={tAdd("namePlaceholder")}
              aria-label={tAdd("nameLabel")}
              className="min-w-0 flex-1 rounded-[var(--radius-md)] border px-3 py-2 [font-size:var(--text-sm)] outline-none [background-color:var(--color-ink-850)] [border-color:var(--input)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={!customTitle.trim() || busy !== null || full}
              className="shrink-0 rounded-[var(--radius-md)] px-4 py-2 [font-size:var(--text-sm)] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] disabled:opacity-40 enabled:hover:[background-color:var(--color-primary-deep)]"
            >
              {busy === "__custom__" ? tEditor("saving") : tAdd("add")}
            </button>
          </div>
        </form>

        {/* 官网版面 — THE ONE GALLERY IN THIS PRODUCT THAT IS ABOUT LOOKS.
            Everywhere else a customer picks WHAT a page is; here they pick what
            it LOOKS like, which is the thing 21st.dev does and nothing here
            did. Six shapes rather than eight, because they are keyed on how the
            business closes a sale rather than on its trade -- a contractor and
            an aircon servicer are different trades that sell the same way. See
            lib/templates/landing-templates.ts. */}
        <section className="mt-10" data-landing-gallery>
          <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("landingTitle")}
            <span className="ml-2 opacity-60">{landings.length}</span>
          </h2>
          {/* The 「not saved yet」 clause is the load-bearing half of this
              sentence -- it is what makes trying one feel free -- so it is a
              placeholder rather than a separate string, and stays bold in both
              languages. */}
          <p className="mt-2 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
            {/* 🔴 那个数字**从清单数出来**，不是写死在句子里。
                它原本写着「六种做法」，而它右上角的计数印着 **7** ——
                同一屏两个答案，而多的那一张是后来加的。
                一句写死的数字，是一句迟早会跟旁边那个数字对不上的话。 */}
            {t.rich("landingBody", {
              n: landings.length,
              unsaved: (chunks) => (
                <b className="[color:var(--color-paper)] [font-weight:var(--fw-medium)]">
                  {chunks}
                </b>
              ),
            })}
          </p>

          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {landings.map((lp) => (
              <li
                key={lp.key}
                className="overflow-hidden rounded-[var(--radius-lg)] [background-color:var(--color-ink-900)] [border:1px_solid_var(--color-ink-800)]"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setZoomedLanding(lp)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setZoomedLanding(lp);
                    }
                  }}
                  aria-label={t("zoom", { name: lp.label })}
                  className={`${chrome.mount} m-3 cursor-zoom-in`}
                >
                  <StyleScope register={style} palette={palette}>
                    {/* Travelling, not cropped: all six landing templates share a
                        masthead and differ below it. See the note on the prop. */}
                    <PagePreview data={lp.layout} travel />
                  </StyleScope>
                </div>

                <div className="flex items-start justify-between gap-3 border-t px-3 py-3 [border-color:var(--color-ink-800)]">
                  <span className="min-w-0">
                    <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                      {lp.label}
                    </span>
                    <span className="mt-0.5 block [font-size:var(--text-xs)] [color:var(--color-paper-dim)] [line-height:var(--leading-body)]">
                      {lp.blurb}
                    </span>
                  </span>

                  {hasWebsite ? (
                    <Link
                      href={`/${locale}/portal/website?tpl=${lp.key}`}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors hover:[border-color:var(--color-primary)]"
                    >
                      {t("use")}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => add("website", "")}
                      disabled={busy !== null || full}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors disabled:opacity-40 enabled:hover:[border-color:var(--color-primary)]"
                    >
                      {tAdd("add")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("readyTitle")}
            <span className="ml-2 opacity-60">{templates.length}</span>
          </h2>
          <p className="mt-2 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {t("readyBody")}
          </p>

          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((tpl) => {
              const isDashboard = tpl.pageKey === "dashboard";
              return (
                <li
                  key={tpl.pageKey}
                  className={`overflow-hidden rounded-[var(--radius-lg)] [background-color:var(--color-ink-900)] ${
                    tpl.alreadyAdded
                      ? "[border:1px_solid_var(--color-ink-850)] opacity-70"
                      : "[border:1px_solid_var(--color-ink-800)]"
                  }`}
                >
                  {/* A real render of the page this customer would get — their
                      trade's words, their workflow, their sample records —
                      on a white mount, so it reads as an object on the card
                      rather than as the card's own background. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setZoomed(tpl)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setZoomed(tpl);
                      }
                    }}
                    aria-label={t("zoom", { name: tpl.label })}
                    className={`${chrome.mount} m-3 cursor-zoom-in`}
                  >
                    <StyleScope register={style} palette={palette}>
                      <PagePreview data={tpl.layout} travel />
                    </StyleScope>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t px-3 py-3 [border-color:var(--color-ink-800)]">
                    <span className="min-w-0">
                      <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                        {tpl.label}
                      </span>
                      <span className="block truncate [font-size:var(--text-micro)] [color:var(--color-paper-dim)] [font-family:var(--font-mono)]">
                        {tpl.pageKey}
                      </span>
                    </span>

                    {tpl.alreadyAdded ? (
                      <span className="shrink-0 [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
                        {isDashboard
                          ? t("alwaysIncluded")
                          : tAdd("alreadyAdded")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(tpl.pageKey, "")}
                        disabled={busy !== null || full}
                        title={full ? tAdd("failedLimit") : undefined}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors disabled:opacity-40 enabled:hover:[border-color:var(--color-primary)]"
                      >
                        {busy === tpl.pageKey ? tEditor("saving") : tAdd("add")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      {/* Full width, the customer's own style, their own words. Same shape as
          the component library's zoom so the two galleries behave alike —
          they were inconsistent for exactly as long as it took to notice. */}
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.label}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 sm:p-8"
          onClick={() => setZoomed(null)}
        >
          <div
            className="flex max-h-full w-full max-w-6xl flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-baseline gap-3">
              <span className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {zoomed.label}
              </span>
              <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                {zoomed.pageKey}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setZoomed(null)}
                aria-label={t("close")}
                className="rounded-[var(--radius-md)] [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] px-3 py-1.5"
              >
                ✕
              </button>
            </div>
            <div className={`${chrome.mount} min-h-0 overflow-auto`}>
              <StyleScope register={style} palette={palette}>
                <PagePreview data={zoomed.layout} />
              </StyleScope>
            </div>
          </div>
        </div>
      )}

      {/* Same dialog for a 官网版面. A quarter-card render proves a shape
          exists; it cannot be read, and reading it is the decision -- which is
          more true here than in the gallery above, because these six differ
          in exactly the details a thumbnail loses. */}
      {zoomedLanding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoomedLanding.label}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 sm:p-8"
          onClick={() => setZoomedLanding(null)}
        >
          <div
            className="flex max-h-full w-full max-w-6xl flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-baseline gap-3">
              <span className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {zoomedLanding.label}
              </span>
              <span className="min-w-0 truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                {zoomedLanding.blurb}
              </span>
              <span className="flex-1" />
              {hasWebsite && (
                <Link
                  href={`/${locale}/portal/website?tpl=${zoomedLanding.key}`}
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-3 py-1.5 [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]"
                >
                  {t("use")}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setZoomedLanding(null)}
                aria-label={t("close")}
                className="rounded-[var(--radius-md)] [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] px-3 py-1.5"
              >
                ✕
              </button>
            </div>
            <div className={`${chrome.mount} min-h-0 overflow-auto`}>
              <StyleScope register={style} palette={palette}>
                <PagePreview data={zoomedLanding.layout} />
              </StyleScope>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
