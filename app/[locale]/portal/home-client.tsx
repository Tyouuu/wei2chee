"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PagePreview } from "./page-preview";
import { SettingsDialog } from "./settings-dialog";
import type { PageKey } from "@/lib/templates/industry-template";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
};

const STYLE_ORDER: StyleName[] = ["ledger", "hearth", "blueprint"];

/**
 * The swatch shown on each style card.
 *
 * Modelled directly on 21st.dev's Themes grid, which is the clearest solution
 * to this exact problem anywhere: a panel painted in the theme's own surface
 * colour, a row of its palette as dots, and the name set INSIDE the panel in
 * the theme's own ink — so the card is a sample of the thing rather than a
 * label for it. Before this, the only way to choose a style in this product
 * was to read three paragraphs of prose about typefaces.
 *
 * Each swatch has to paint itself in a style OTHER than the page's current
 * one, so it carries its own scope class rather than inheriting. That is the
 * whole reason `style-scope.module.css` exists (Tailwind v4 compiles `@theme`
 * to `:root`, which cannot be narrowed to a subtree) and the reason all three
 * token sets can sit on one document at once.
 */
function StyleSwatch({ name }: { name: StyleName }) {
  return (
    <div
      className={`${styles.scope} ${SCOPE_CLASS[name]} flex h-28 flex-col justify-between overflow-hidden [border-radius:var(--radius-md)] [padding:var(--pad-card)] [background-color:var(--color-canvas)]`}
    >
      <div className="flex items-center gap-1.5">
        {/* The palette, in the order a reader meets it on a real page: accent
            first, then the two surfaces it sits on, then the ink. */}
        {["var(--color-primary)", "var(--color-ink-900)", "var(--color-ink-800)", "var(--color-nav-bg)"].map(
          (c) => (
            <span
              key={c}
              className="h-4 w-4 shrink-0 rounded-full [border:1px_solid_var(--color-ink-800)]"
              style={{ background: c }}
            />
          ),
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="[color:var(--color-paper)] [font-family:var(--font-ui)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
          {name === "ledger" ? "Ledger" : name === "hearth" ? "Hearth" : "Blueprint"}
        </span>
        {/* A miniature of this register's own table row — the single most
            visible difference between the three (32px / 42px / 52px) and the
            one a colour swatch alone cannot show. */}
        <span className="flex flex-col gap-[3px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-16 [background-color:var(--color-ink-700)]"
              style={{ height: `calc(var(--row-h) / 7)` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

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
  savedOwnerName,
}: {
  locale: string;
  accountEmail?: string;
  paid: boolean;
  style: StyleName;
  pages: { pageKey: PageKey; isDraft: boolean; layout: Data }[];
  summary: string | null;
  industryName: string | null;
  /** What the system currently calls itself — the customer's own answer if
   *  they gave one, otherwise the per-trade placeholder. */
  businessName: string;
  savedBusinessName: string | null;
  savedOwnerName: string | null;
}) {
  const t = useTranslations("portal.home");
  const tEditor = useTranslations("portal.editor");
  const router = useRouter();

  // Optimistic, exactly like the editor's own switcher: the swatches and every
  // page preview on this screen re-scope the moment a style is picked, because
  // seeing your own five pages in Hearth is the entire point of the control.
  const [activeStyle, setActiveStyle] = useState<StyleName>(style);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Held locally so the header updates the moment the dialog saves. The page
  // layouts still carry the old name until the next server render, which is
  // fine and honest: the previews are of saved pages, and the rail's brand is
  // regenerated from `projects.business_name` on the next load.
  const [identity, setIdentity] = useState({
    businessName: savedBusinessName,
    ownerName: savedOwnerName,
  });
  const shownName = identity.businessName ?? businessName;
  const [styleFailed, setStyleFailed] = useState(false);
  const [pendingStyle, setPendingStyle] = useState<StyleName | null>(null);

  async function chooseStyle(next: StyleName) {
    if (next === activeStyle || pendingStyle) return;
    const previous = activeStyle;
    setActiveStyle(next);
    setPendingStyle(next);
    setStyleFailed(false);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("update_project_style", { new_style: next });
    setPendingStyle(null);
    if (error) {
      setActiveStyle(previous);
      setStyleFailed(true);
    }
  }

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const identityLine = accountEmail ? `（账号：${accountEmail}）` : "";
  const deployHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "我的系统设计已经确定了，请开始帮我建系统" + identityLine,
  )}`;

  return (
    <div
      className={`${styles.scope} ${SCOPE_CLASS[activeStyle]} min-h-screen [background-color:var(--color-canvas)]`}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4 [background-color:var(--color-nav-bg)] [border-color:var(--color-nav-border)]">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center [background-color:var(--color-nav-accent)] [border-radius:var(--radius-sm)] [color:var(--color-nav-bg)] [font-size:var(--text-sm)] [font-weight:var(--fw-display)]"
          >
            F
          </span>
          {/* The BUSINESS leads here, not the product. Durable's Home does the
              same thing and it is the difference between "I am inside Formae"
              and "I am inside my own system". Formae is named underneath, in
              the place a tool names itself. */}
          <span className="leading-tight">
            <span className="block [color:var(--color-nav-fg)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
              {shownName}
            </span>
            <span className="block [color:var(--color-nav-fg-dim)] [font-size:var(--text-micro)]">
              Formae · {accountEmail}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-4 [font-size:var(--text-sm)]">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="[color:var(--color-nav-fg-dim)] hover:[color:var(--color-nav-fg)]"
          >
            {t("settingsCta")}
          </button>
          <LocaleSwitcher tone="dark" />
          <button
            type="button"
            onClick={handleSignOut}
            className="underline [color:var(--color-nav-fg-dim)] hover:[color:var(--color-nav-fg)]"
          >
            {tEditor("signOut")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <section>
          <p className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
            {t("eyebrow")}
          </p>
          <h1 className="mt-2 max-w-3xl text-balance [color:var(--color-paper)] [font-size:var(--text-hero)] [font-weight:var(--fw-display)] [letter-spacing:var(--tracking-title-lg)] [line-height:var(--leading-tight)]">
            {industryName ? t("titleWithIndustry", { industry: industryName }) : t("title")}
          </h1>
          {/* The AI's own sentence about this business, on the first screen
              after signing in. It is the clearest possible evidence that the
              questionnaire was not a form that went nowhere. */}
          {/* Shown only while the name is still generated. It is the one piece of
              setup the product cannot do for the customer, and asking for it
              here — under a headline that just used the placeholder — is the
              moment it is most obviously worth doing. */}
          {!identity.businessName && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="mt-4 inline-flex items-center gap-2 [border-radius:var(--radius-control)] [border:var(--border-card-width)_solid_var(--color-ink-800)] [background-color:var(--color-ink-900)] px-3.5 py-2 [color:var(--color-paper)] [font-size:var(--text-sm)] transition-colors hover:[border-color:var(--color-primary)]"
            >
              {t("namePrompt", { name: shownName })}
              <span aria-hidden="true" className="[color:var(--color-primary)]">
                →
              </span>
            </button>
          )}

          {summary && (
            <p className="mt-4 max-w-2xl border-l-2 pl-4 [border-color:var(--color-primary)] [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
              {summary}
            </p>
          )}
        </section>

        <section className="mt-14">
          <div className="flex items-baseline justify-between gap-4 border-b pb-3 [border-color:var(--color-ink-800)]">
            <h2 className="[color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
              {t("pagesTitle")}
            </h2>
            <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {t("pagesCount", { count: pages.length })}
            </span>
          </div>

          {/* The gallery. Each tile is a real render of that page, not a
              placeholder — see page-preview.tsx for why that call was made
              here and the opposite one made in the component palette. */}
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              // The link does NOT wrap the card. A live preview renders the
              // page's own rail, which is a list of <a> elements, and an <a>
              // around those is invalid HTML — React reports it as a hydration
              // error, and browsers recover by splitting the anchor, which
              // breaks the card. So the anchor sits in the footer and is
              // stretched over the card with a pseudo-element instead: one
              // link, one accessible name, whole card clickable, no nesting.
              // (Found by a browser test — the click resolved to six links.)
              <li
                key={page.pageKey}
                className="group relative overflow-hidden [border-radius:var(--radius-lg)] [border:var(--border-card-width)_solid_var(--color-ink-800)] [box-shadow:var(--shadow-card)] [background-color:var(--color-ink-900)] transition-shadow hover:[box-shadow:var(--shadow-raised)]"
              >
                <div className="border-b [border-color:var(--color-ink-800)]">
                  <PagePreview data={page.layout} />
                </div>
                <div className="flex items-center justify-between gap-3 [padding:var(--pad-card)]">
                  <span className="min-w-0">
                    <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                      {tEditor(`pages.${page.pageKey}`)}
                    </span>
                    <span className="mt-0.5 block [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                      {page.isDraft ? t("cardDraft") : t("cardEdited")}
                    </span>
                  </span>
                  <Link
                    href={`/${locale}/portal/${page.pageKey}`}
                    className="shrink-0 whitespace-nowrap [color:var(--color-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] transition-transform after:absolute after:inset-0 after:content-[''] group-hover:translate-x-0.5"
                  >
                    {t("cardCta")} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <div className="flex items-baseline justify-between gap-4 border-b pb-3 [border-color:var(--color-ink-800)]">
            <h2 className="[color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
              {t("styleTitle")}
            </h2>
            {styleFailed && (
              <span role="status" className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
                {tEditor("styleFailed")}
              </span>
            )}
          </div>
          <p className="mt-3 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
            {t("styleBody")}
          </p>

          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STYLE_ORDER.map((name) => {
              const active = name === activeStyle;
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => chooseStyle(name)}
                    disabled={Boolean(pendingStyle)}
                    aria-pressed={active}
                    className={`w-full overflow-hidden text-left transition-shadow [border-radius:var(--radius-lg)] [background-color:var(--color-ink-900)] disabled:opacity-60 ${
                      active
                        ? "[border:2px_solid_var(--color-primary)] [box-shadow:var(--shadow-raised)]"
                        : "[border:2px_solid_var(--color-ink-800)] enabled:hover:[border-color:var(--color-ink-700)]"
                    }`}
                  >
                    <StyleSwatch name={name} />
                    <span className="flex items-center justify-between gap-2 [padding:var(--pad-card)]">
                      <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                        {t(`styleTag.${name}`)}
                      </span>
                      <span
                        className={`[font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] ${
                          active ? "[color:var(--color-primary)]" : "[color:var(--color-paper-dim)]"
                        }`}
                      >
                        {active ? t("styleCurrent") : t("styleUse")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-14">
          <div className="border-b pb-3 [border-color:var(--color-ink-800)]">
            <h2 className="[color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
              {t("nextTitle")}
            </h2>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Link
              href={`/${locale}/portal/spec`}
              // Next prefetches <Link> on hover in production, and this route
              // runs an LLM call while rendering — prefetch would bill a
              // generation for every hover, for a document nobody opened.
              prefetch={false}
              className="group block [border-radius:var(--radius-lg)] [border:var(--border-card-width)_solid_var(--color-ink-800)] [box-shadow:var(--shadow-card)] [background-color:var(--color-ink-900)] [padding:var(--pad-card-lg)] transition-shadow hover:[box-shadow:var(--shadow-raised)]"
            >
              <span className="block [color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {t("specTitle")}
              </span>
              <span className="mt-2 block [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                {t("specBody")}
              </span>
              <span className="mt-4 block [color:var(--color-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                {t("specCta")} →
              </span>
            </Link>

            <a
              href={deployHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group block [border-radius:var(--radius-lg)] [border:var(--border-card-width)_solid_var(--color-ink-800)] [box-shadow:var(--shadow-card)] [background-color:var(--color-ink-900)] [padding:var(--pad-card-lg)] transition-shadow hover:[box-shadow:var(--shadow-raised)]"
            >
              <span className="block [color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {t("buildTitle")}
              </span>
              <span className="mt-2 block [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                {paid ? t("buildBodyPaid") : t("buildBody")}
              </span>
              <span className="mt-4 block [color:var(--color-jade-bright)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                {t("buildCta")} →
              </span>
            </a>
          </div>
        </section>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        businessName={identity.businessName}
        ownerName={identity.ownerName}
        onSaved={setIdentity}
      />
    </div>
  );
}
