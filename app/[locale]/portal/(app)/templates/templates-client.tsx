"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PagePreview } from "../../page-preview";
import { PageBar } from "../page-bar";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import chrome from "../../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
};

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

export function TemplatesClient({
  locale,
  style,
  templates,
  pageCount,
}: {
  locale: string;
  style: StyleName;
  templates: Template[];
  pageCount: number;
}) {
  const t = useTranslations("portal.templates");
  const tAdd = useTranslations("portal.addPage");
  const tEditor = useTranslations("portal.editor");
  const router = useRouter();

  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");

  const full = pageCount >= PAGE_LIMIT;

  async function add(requestedKey: string | null, title: string) {
    if (busy || full) return;
    setBusy(requestedKey ?? "__custom__");
    setFailed(null);

    const { data, error } = await createBrowserSupabaseClient().rpc("add_project_page", {
      requested_key: requestedKey,
      new_title: title,
    });
    setBusy(null);

    if (error) {
      setFailed(error.message.includes("limit") ? tAdd("failedLimit") : tAdd("failed"));
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
        <span className="text-[12px] [color:var(--color-paper-dim)]">
          {t("pageCount", { count: pageCount, limit: PAGE_LIMIT })}
        </span>
      </PageBar>

      <div className="px-8 py-7">
        <p className="max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {t("body")}
        </p>

        {failed && (
          <p role="alert" className="mt-4 [color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
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
          className="mt-6 max-w-2xl rounded-[11px] [border:1px_solid_var(--color-ink-800)] [background-color:var(--color-ink-900)] p-5"
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
              className="min-w-0 flex-1 rounded-[7px] border px-3 py-2 text-[13px] outline-none [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={!customTitle.trim() || busy !== null || full}
              className="shrink-0 rounded-[7px] px-4 py-2 text-[13px] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] disabled:opacity-40 enabled:hover:[background-color:var(--color-primary-deep)]"
            >
              {busy === "__custom__" ? tEditor("saving") : tAdd("add")}
            </button>
          </div>
        </form>

        <section className="mt-10">
          <h2 className="text-[13px] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("readyTitle")}
            <span className="ml-2 opacity-60">{templates.length}</span>
          </h2>
          <p className="mt-2 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {t("readyBody")}
          </p>

          <ul className="mt-5 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            {templates.map((tpl) => {
              const isDashboard = tpl.pageKey === "dashboard";
              return (
                <li
                  key={tpl.pageKey}
                  className={`overflow-hidden rounded-[11px] [background-color:var(--color-ink-900)] ${
                    tpl.alreadyAdded
                      ? "[border:1px_solid_var(--color-ink-850)] opacity-70"
                      : "[border:1px_solid_var(--color-ink-800)]"
                  }`}
                >
                  {/* A real render of the page this customer would get — their
                      trade's words, their workflow, their sample records. */}
                  <div
                    className={`${styles.scope} ${SCOPE_CLASS[style]} ${chrome.sheet} m-3 border-b-0`}
                  >
                    <PagePreview data={tpl.layout} />
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t px-4 py-3 [border-color:var(--color-ink-800)]">
                    <span className="min-w-0">
                      <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                        {tpl.label}
                      </span>
                      <span className="block truncate text-[11px] [color:var(--color-paper-dim)] [font-family:var(--font-mono)]">
                        {tpl.pageKey}
                      </span>
                    </span>

                    {tpl.alreadyAdded ? (
                      <span className="shrink-0 text-[12px] [color:var(--color-paper-dim)]">
                        {isDashboard ? t("alwaysIncluded") : tAdd("alreadyAdded")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(tpl.pageKey, "")}
                        disabled={busy !== null || full}
                        title={full ? tAdd("failedLimit") : undefined}
                        className="shrink-0 rounded-[7px] border px-3 py-1.5 text-[12.5px] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors disabled:opacity-40 enabled:hover:[border-color:var(--color-primary)]"
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
    </>
  );
}
