"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import "@/design-system/editor/puck-theme.css";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { puckConfig } from "@/design-system/editor/puck-config";
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from "../local-draft";
import { EditorChrome } from "./editor-chrome";
import { ComponentPreview } from "@/design-system/editor/component-preview";
import { StyleSwitcher } from "./style-switcher";
// Reused rather than re-declared: this is the same scoped Ledger token
// class app/[locale]/portal/style-select's <StyleColumn> already applies,
// kept in sync with design-system/tokens/ledger.css by
// style-picker/__tests__/style-scope.sync.test.ts. The editor's chrome is
// always Ledger regardless of which style the customer picked for their
// canvas content (see puck-theme.css's header comment) -- ledger.css itself
// is never @import-ed directly anywhere in this app because its --color-*
// custom properties collide, at :root, with app/globals.css's own
// same-named shadcn/Blueprint marketing-site tokens.
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";



// Same lookup app/[locale]/style-picker/style-column.tsx uses internally
// (its own `SCOPE_CLASS` isn't exported, so this is a second, identical
// binding rather than a shared import -- both read the same three classes
// off style-scope.module.css, so there's nothing to drift out of sync).
const CANVAS_SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
};

type SaveState = "idle" | "saving" | "saved" | "error" | "paywall";

export function PortalEditor({
  pageKey,
  projectId,
  accountEmail,
  paid,
  initialData,
  isGeneratedDraft,
  locale,
  pageKeys,
  style,
}: {
  pageKey: string;
  projectId: string;
  /** accounts.email, threaded down from page.tsx's getSessionUser() -- the
   * only identifying information in either WhatsApp handoff below. Flipping
   * projects.paid in Supabase Studio is the whole payment mechanism in v1
   * (spec's Global Constraint: no gateway), and WhatsApp contact is by phone
   * with no link back to the signup email, so without this the founder gets
   * an anonymous "I want to pay" message and no way to find the account. */
  accountEmail: string;
  /** projects.paid (Task 1) -- save_project_page raises "payment required"
   * server-side for an unpaid project (the real enforcement), but the
   * paywall interstitial below is shown client-side off this prop so an
   * unpaid customer sees a purpose-built CTA instead of a raw error. */
  paid: boolean;
  initialData: Record<string, unknown>;
  /** True when `initialData` is the system generated from the customer's own
   * industry and AI analysis rather than something they saved themselves. Drives
   * the banner below -- without it a customer cannot tell the difference between
   * "we drafted this for you, change anything" and real saved data, which is the
   * difference between feeling understood and feeling misled. */
  isGeneratedDraft: boolean;
  /** next-intl's active locale. Needed because this component links between the
   * portal pages, and those routes are locale-prefixed. */
  locale: string;
  /** The pages THIS account has, in its own order. Pages are provisioned per
   * industry (migration 20260820160000), so the nav cannot be a fixed list:
   * a salon has no 报价单 and a restaurant has no 项目. */
  pageKeys: string[];
  /** The customer's own chosen style (projects.style, Task 3) -- applies to
   * canvas CONTENT only. Chrome (this component's own wrapper below) stays
   * Ledger regardless, per Task 5's own reviewed design. */
  style: StyleName;
}) {
  const t = useTranslations("portal.editor");
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Session-local tracking is sufficient for v1's deliberately narrow Deploy
  // definition (spec §6) -- true once a save has actually succeeded, not
  // just on mount. Doesn't need to survive a reload: the Deploy button is a
  // WhatsApp handoff a customer clicks once, right after saving.
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  // The style is editor STATE, not just a prop, because it is now changeable
  // from inside the editor (see style-switcher.tsx). Seeded from the server's
  // value; the switcher moves it optimistically so the canvas re-scopes on the
  // same frame as the click, and rolls it back if the write fails.
  const [activeStyle, setActiveStyle] = useState<StyleName>(style);

  // Fix round 1 (post-review): `readLocalDraft` short-circuits to `null`
  // during SSR (local-draft.ts's own `typeof window === "undefined"`
  // guard), but NOT during the client's first render -- `window` already
  // exists by then, even before React's hydration diff against the
  // server-rendered HTML has run. Reading the draft directly in the
  // render body (as this file originally did) therefore made the
  // client's first render disagree with the server's whenever a draft
  // existed and differed from `initialData` -- exactly the free-tier
  // reload scenario this file exists to support -- which is a real,
  // deterministic React hydration error, not the "intermittent dev-tool
  // noise" task-6-report.md originally (incorrectly) concluded.
  //
  // Fix: `hydrated` starts `false` on both the server and the client's
  // first render, so `startingData` resolves to `initialData` on both --
  // an identical first paint. Only this effect (client-only, and only
  // after hydration has already completed) flips it, and only then does
  // `startingData` start reading the local draft.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Free-tier customers have no server-side save (save_project_page's
  // payment-required check, supabase/migrations/20260818120000), so for
  // them the local draft (local-draft.ts) -- a passive mirror of every
  // change written by handleChange below -- is the only thing that survives
  // a page reload, and it correctly wins over the empty server row.
  //
  // Fix round 2 (post-review): the `!paid` gate is load-bearing, not
  // defensive. Without it, a PAID customer's local draft outranked their
  // own server row on every device that had ever opened the editor: explore
  // on device A (draft written to A's localStorage), do the real work and
  // save on device B, come back to device A -- and A's stale, pre-payment
  // draft would be what loaded, with the next Save silently overwriting the
  // good server data with it. localStorage is per-device and never synced,
  // so for a paid customer the server row is authoritative by definition;
  // the draft is a free-tier mechanism only, exactly as local-draft.ts's
  // own doc comment describes it.
  //
  // The `hydrated` gate is unchanged and still does its job: for an unpaid
  // customer `hydrated && !paid` is false on the server and on the client's
  // pre-effect first render (identical first paint), true only afterwards.
  // For a paid customer it's false in every case, so `initialData` either
  // way -- server and client still agree, no hydration mismatch.
  const startingData =
    hydrated && !paid
      ? ((readLocalDraft(projectId, pageKey) as Data | null) ?? (initialData as Data))
      : (initialData as Data);

  function handleChange(data: Data) {
    // Passive mirror on every change, independent of the explicit save
    // action below -- see local-draft.ts's own doc comment.
    writeLocalDraft(projectId, pageKey, data as Record<string, unknown>);
  }

  async function handleSaveClick(data: Data) {
    if (!paid) {
      setSaveState("paywall");
      return;
    }

    setSaveState("saving");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("save_project_page", {
      target_page_key: pageKey,
      new_layout: data,
    });
    // Never surface the RPC's raw Postgres error text (e.g. "payment
    // required", "page not found: %") -- same discipline as
    // style-select-client.tsx's set_project_style handling: map through
    // t() instead of displaying rpcError.message. The `paid` gate above
    // already prevents the payment-required case from being reachable in
    // the normal flow, so a generic saveError message covers whatever's
    // left (network failure, unexpected server error, etc.).
    if (!error) {
      setSaveState("saved");
      setHasSavedOnce(true);
      // The server row is now authoritative and strictly fresher than
      // anything in localStorage. Dropping the draft here keeps it from
      // lingering as a stale landmine on this device if the `!paid` gate
      // on `startingData` above ever stops applying to this
      // project/pageKey (e.g. a refund, or a future free/paid toggle).
      clearLocalDraft(projectId, pageKey);
    } else {
      setSaveState("error");
    }
  }

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    // Same post-action navigation pattern as style-select-client.tsx. The
    // real session teardown is signOut() clearing the Supabase auth cookies;
    // /login is just where the customer lands afterwards.
    router.push("/login");
  }

  // Identity for the two WhatsApp handoffs below. Signup is by email,
  // WhatsApp is by phone, and nothing links the two -- so without this the
  // founder receives an anonymous message and cannot tell which Supabase
  // account to flip `paid` on. projectId is included as well because it's
  // the exact value to search Supabase Studio by.
  const identityLine = `\n\n账号邮箱: ${accountEmail}\n项目编号: ${projectId}`;

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "我的设计已经准备好了，我想付款保存" + identityLine,
  )}`;

  const deployWhatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "我的系统设计已经确定了，请开始帮我建系统" + identityLine,
  )}`;

  return (
    <div
      // Regression fix: this wrapper (and the header bar inside it) never
      // painted its own background -- it silently depended on
      // portal/layout.tsx's shared `--color-canvas` fill, which got
      // reverted for breaking /portal/style-select's contrast (that page
      // deliberately keeps the acquisition site's dark theme; this one
      // never should have shared a wrapper with it). Scoped here instead,
      // to just this route, so it can't leak into style-select again.
      // Without it, the header bar's dark-on-light text (--color-paper /
      // --color-paper-dim, tuned for Ledger's light surfaces) rendered
      // against the acquisition site's dark <body> showing through --
      // barely legible, not just unstyled.
      className={`portal-editor-scope ${styles.ledger} flex h-screen flex-col [background-color:var(--color-canvas)]`}
    >
      <div className="flex items-center justify-between gap-4 border-b px-4 py-2 text-[13px] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]">
        {/* Page navigation. Before this the editor showed the current page's
            name as plain text and offered no way to reach the other four --
            they existed as routes and as rows in project_pages, but the only
            way to open one was to type its URL. A customer designing a
            five-page system could only ever see the page they landed on, which
            made the product look like a one-page toy. */}
        <nav className="flex items-center gap-1 overflow-x-auto" aria-label={t("pageNavLabel")}>
          {pageKeys.map((key) => {
            const active = key === pageKey;
            return (
              <Link
                key={key}
                href={`/${locale}/portal/${key}`}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "whitespace-nowrap rounded-md px-2.5 py-1 [background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]"
                    : "whitespace-nowrap rounded-md px-2.5 py-1 [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
                }
              >
                {t(`pages.${key}`)}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          {saveState === "saved" ? (
            <span className="[color:var(--color-jade-bright)]">{t("saveSuccess")}</span>
          ) : null}
          {saveState === "error" ? (
            <span className="[color:var(--color-clay-bright)]">{t("saveError")}</span>
          ) : null}
          {hasSavedOnce ? (
            <a
              href={deployWhatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-1.5 text-[12px] text-[color:var(--color-on-primary)] [background-color:var(--color-jade)] [font-weight:var(--fw-semibold)]"
            >
              {t("deployCta")}
            </a>
          ) : null}
          {/* The specification document. Reachable at any time, not only after
              a save: a free-tier customer has saved nothing yet and is exactly
              the person who needs to see what they would be paying for. */}
          <Link
            href={`/${locale}/portal/spec`}
            // Next prefetches <Link> on hover in production, and this route
            // runs an LLM call while rendering -- prefetch would bill a
            // generation for every hover, for a document nobody opened.
            prefetch={false}
            className="rounded-md px-2.5 py-1 [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
          >
            {t("specCta")}
          </Link>
          <StyleSwitcher style={activeStyle} onPreview={setActiveStyle} />
          <button
            type="button"
            onClick={handleSignOut}
            className="underline [color:var(--color-paper-dim)]"
          >
            {t("signOut")}
          </button>
        </div>
      </div>

      {/* The generated-draft banner. A customer who has just answered a
          questionnaire about their business now opens the editor on a system
          already built from those answers -- their own industry vocabulary,
          their own workflow stages, their own summary line. That is only a good
          experience if they are TOLD it is a draft: without this line, sample
          rows like "Taman Desa 三房翻新" read either as real data the product
          invented, or as a generic demo. With it, they read as an invitation to
          edit. Disappears the moment they save, because from then on the canvas
          is genuinely their own work. */}
      {isGeneratedDraft ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2 text-[13px] [background-color:var(--color-primary-soft)] [border-color:var(--color-ink-800)]">
          <span className="[color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]">
            {t("draftBannerTitle")}
          </span>
          <span className="[color:var(--color-paper-dim)]">{t("draftBannerBody")}</span>
        </div>
      ) : null}

      {/* Fix round 2 (post-review): the paywall is an OVERLAY over a
          still-mounted <Puck>, not a branch that replaces it. It used to be
          `saveState === "paywall" ? <paywall/> : <Puck/>`, which unmounted
          the canvas at exactly the moment a customer clicked Save -- so the
          only thing standing between a free-tier customer and losing their
          whole in-progress design was local-draft.ts, which is explicitly
          best-effort and silently drops writes when localStorage is
          unavailable (private browsing, quota exceeded). Keeping Puck
          mounted means its own internal state holds the work regardless of
          whether localStorage did anything at all.

          Side effect worth noting: the `hydrated` remount below is now the
          ONLY thing that ever remounts Puck in this file. "Back to editing"
          no longer re-reads the local draft (it can't -- nothing remounts),
          and doesn't need to: Puck still has the customer's latest edit. */}
      <div className="relative flex-1">
        {saveState === "paywall" ? (
          // `absolute inset-0` + an opaque token background (--color-canvas
          // resolves against this component's own `.ledger` chrome scope) --
          // fully obscures the canvas rather than dimming it, and swallows
          // every pointer event that would otherwise reach Puck underneath.
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center [background-color:var(--color-canvas)]">
            <h2 className="text-[18px] [font-weight:var(--fw-semibold)]">{t("paywallTitle")}</h2>
            <p className="text-[14px] [color:var(--color-paper-dim)]">{t("paywallBody")}</p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 rounded-lg px-4 py-2.5 text-[13px] text-[color:var(--color-on-primary)] [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)]"
            >
              {t("paywallCta")}
            </a>
            <button
              type="button"
              onClick={() => setSaveState("idle")}
              className="text-[13px] underline [color:var(--color-paper-dim)]"
            >
              {t("backToEditing")}
            </button>
          </div>
        ) : null}
        <div className="h-full">
          <Puck
            // Forces exactly one clean remount at the ssr->hydrated
            // transition above. Puck's own `data` prop is consumed only
            // once, inside a lazy `useState(() => ...)` initializer deep
            // in its `PuckProvider` (verified against the installed
            // 0.23.0 bundle, node_modules/@puckeditor/core/dist/index.js)
            // -- passing a new `data` value into an already-mounted
            // `<Puck>` on a later render is a no-op from Puck's own
            // perspective, so without this `key` change the local draft
            // would never actually reach the canvas after hydration, even
            // though `startingData` above is already correct by then.
            // `hydrated` only flips once, so this only remounts once per
            // page load. Fix round 2: the paywall used to be a sibling
            // branch that unmounted this <Puck> on every toggle -- that's
            // gone now (the paywall is an overlay ABOVE this, always
            // mounted, see the comment on the wrapping div), so this `key`
            // is the ONLY thing that ever remounts Puck in this file.
            key={hydrated ? "hydrated" : "ssr"}
            config={puckConfig}
            data={startingData}
            onChange={handleChange}
            onPublish={handleSaveClick}
            // Renders the canvas directly in this document instead of a
            // `srcdoc` iframe -- see puck-theme.css's now-removed body-leak
            // comment and task-5a-report.md for why: with the iframe gone,
            // there's no separate DOM/CSSOM for the `.ledger`/`.hearth`/
            // `.blueprint` scope classes to fail to reach into. Viewport
            // switching (Puck's responsive-preview feature, which disabling
            // the iframe also disables per Puck's own docs) is unused
            // anywhere in this app -- confirmed via a repo-wide grep, task
            // 5a's report has the details.
            iframe={{ enabled: false }}
            overrides={{
              // Puck's own toolbar is English and unstyled by this app's
              // tokens -- replaced wholesale. See editor-chrome.tsx.
              // A miniature of each block beside its name, so the palette is
              // browsed by sight rather than by reading fifteen nouns off
              // identical white rectangles. See component-preview.tsx.
              drawerItem: ({ children, name }) => (
                <div className="flex items-center gap-2.5">
                  <ComponentPreview name={name} />
                  <div className="min-w-0 flex-1">{children}</div>
                </div>
              ),
              header: () => (
                <EditorChrome
                  pageLabel={t(`pages.${pageKey}`)}
                  saving={saveState === "saving"}
                  onSave={handleSaveClick}
                />
              ),
              // The one supported override point for wrapping just the
              // canvas's rendered subtree (Puck's own Preview component),
              // independent of the chrome wrapper above -- reuses the exact
              // `.scope` + per-style class pairing style-column.tsx already
              // applies to each of its three comparison columns, so canvas
              // content resolves var(--color-*) against the CUSTOMER's
              // chosen style, not Ledger. `h-full` matters here: Puck's own
              // Preview/frame elements are `height: 100%` all the way down,
              // which needs an explicit height on this wrapper or the chain
              // collapses to 0.
              preview: ({ children }) => (
                <div className={`${styles.scope} ${CANVAS_SCOPE_CLASS[activeStyle]} h-full`}>{children}</div>
              ),
            }}
          />
        </div>
      </div>
    </div>
  );
}
