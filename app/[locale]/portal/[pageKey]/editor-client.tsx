"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import { EditorChrome } from "./editor-chrome";
import { ComponentPreview } from "@/design-system/editor/component-preview";
import { ClickToAdd } from "./drawer-add";
import { LivePreview } from "@/design-system/editor/live-preview";
import { FieldsPanel } from "@/design-system/editor/fields-panel";
import { StyleSwitcher } from "./style-switcher";
import { AiAssistant, type Turn } from "./ai-assistant";
import { MobileEditor } from "./mobile-editor";
import { LocaleSwitcher } from "@/components/locale-switcher";
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
import chrome from "../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { scopeClasses } from "@/lib/portal/palettes";



// Same lookup app/[locale]/style-picker/style-column.tsx uses internally
// (its own `SCOPE_CLASS` isn't exported, so this is a second, identical
// binding rather than a shared import -- both read the same three classes
// off style-scope.module.css, so there's nothing to drift out of sync).
const CANVAS_SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  bare: styles.bare,
  docket: styles.docket,
  large: styles.large,
  stamp: styles.stamp,
  contract: styles.contract,
};

type SaveState = "idle" | "saving" | "saved" | "error" | "paywall";

/**
 * Is this a phone-sized window?
 *
 * `useSyncExternalStore` rather than a `useState` + `useEffect` pair, because
 * the server has no viewport and has to answer something: the server snapshot
 * is always `false`, so both the server and the client's FIRST render agree on
 * the desktop layout and React's hydration diff passes. The subscription then
 * corrects it on the next frame. A `window.matchMedia` read during render is
 * the classic way to produce a hydration error here — this file has already
 * been bitten by exactly that shape once, with the local draft.
 *
 * 1024px is Puck's own floor, not a guess: below it the three columns compress
 * rather than fold, and the canvas drops under what a five-column record table
 * needs to render without clipping.
 */
const NARROW = "(max-width: 1023px)";

function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const getNarrow = () => window.matchMedia(NARROW).matches;
const getNarrowServer = () => false;

export function PortalEditor({
  pageKey,
  seededComponent,
  projectId,
  accountEmail,
  paid,
  initialData,
  isGeneratedDraft,
  locale,
  navPages,
  style,
  palette,
}: {
  pageKey: string;
  /** The component name that ?add= just inserted, or null. */
  seededComponent?: string | null;
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
  /** Every page in this system with its display label, already resolved on the
   *  server. Labels cannot be looked up here any more: a page the customer
   *  invented has no `portal.editor.pages.*` message, and next-intl throws on a
   *  missing key rather than falling back. */
  navPages: { key: string; label: string }[];
  /** The customer's own chosen style (projects.style, Task 3) -- applies to
   * canvas CONTENT only. Chrome (this component's own wrapper below) stays
   * Ledger regardless, per Task 5's own reviewed design. */
  style: StyleName;
  /** The customer's 配色 layer, or null for this layout's native colours.
   *  Threaded from the server rather than fetched again: the same projects row
   *  supplies `style`, and a second query would be a second source of truth. */
  palette: string | null;
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

  // The assistant's conversation. Held HERE rather than inside AiAssistant
  // because Puck re-creates `overrides` render functions as the editor
  // re-renders -- and the assistant's own successful edit is one of the things
  // that triggers that. State kept inside it would be wiped by its own results.
  // (There is no `assistantOpen` any more: the assistant is not a thing that
  // opens. See the `fields` override below.)
  const [historyOpen, setHistoryOpen] = useState(false);
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, getNarrowServer);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [instruction, setInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  // Edited since the last successful save. `handleChange` fires on every Puck
  // mutation including the assistant's, so this is the honest answer to "is
  // there work on screen that is not in the database".
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const autosaveTimer = useRef<number | null>(null);

  // A pending autosave must not fire against an unmounted editor -- navigating
  // between pages remounts this component, and the timer would otherwise write
  // the page the customer just left.
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, []);

  // The browser's own "leave site?" prompt, armed only while there is
  // something to lose. A customer who has spent twenty minutes designing and
  // then closes the tab should not lose it silently -- and for a FREE customer
  // there is no server copy at all, only the local draft, which makes this the
  // last line rather than a nicety.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Strip ?add= once it has been applied. `replace`, not `push`, so the back
  // button does not walk into a URL that adds the block a second time — and
  // `window.history` rather than the router, because a router navigation would
  // re-render the server component and re-seed the very block being cleaned up.
  useEffect(() => {
    if (!seededComponent) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("add")) return;
    url.searchParams.delete("add");
    window.history.replaceState(null, "", url.pathname + url.search);
    // The seeded block is an unsaved edit like any other, so the save state has
    // to say so — otherwise the editor claims "已保存" over a page that has one.
    setDirty(true);
  }, [seededComponent]);

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
  // Upgraded too: a draft is a mirror of whatever the layout looked like when it
  // was written, so a free-tier customer returning after this change has a
  // device-local copy in the old shape. The null test stays OUTSIDE the upgrade
  // -- `upgradeLayout({})` returns `{}`, which is truthy, and would quietly turn
  // "no draft on this device" into an empty canvas.
  const localDraft = hydrated && !paid ? readLocalDraft(projectId, pageKey) : null;
  const startingData = localDraft
    ? (upgradeLayout(localDraft) as Data)
    : (initialData as Data);

  function handleChange(data: Data) {
    // Passive mirror on every change, independent of the explicit save
    // action below -- see local-draft.ts's own doc comment.
    writeLocalDraft(projectId, pageKey, data as Record<string, unknown>);
    setDirty(true);
    // A stale "已保存" beside a canvas the customer has just changed is worse
    // than no indicator: it asserts something untrue about their data.
    setSaveState((prev) => (prev === "saved" ? "idle" : prev));

    // AUTOSAVE. Paid only, and not defensively: an unpaid customer has no
    // server-side save at all (save_project_page raises "payment required"), so
    // a background attempt would either throw on a timer or -- worse -- raise
    // the paywall overlay over a canvas the customer is in the middle of
    // editing, without them having pressed anything.
    //
    // 2.5s after the last change, not on an interval: an interval fires in the
    // middle of a drag and mid-word while someone is typing a column heading.
    // Debouncing means a save happens when the customer pauses, which is also
    // when the state is worth keeping.
    //
    // Safe to have at all only because of the version history landing in the
    // same change (migration 20260820220000) -- autosave over a single
    // overwritten row is a faster way to lose work, not a safety net.
    //
    // AND NOT BEFORE THE FIRST DELIBERATE SAVE. Caught in a browser check: with
    // autosave armed from the start, opening the generated system and nudging
    // one thing wrote it to the database -- which flips `isGeneratedDraft`
    // false on the next load and takes the 「这是根据你的生意自动生成的初稿」
    // banner with it. The sample rows then read as real records the customer
    // entered, which is precisely the misreading that banner exists to prevent.
    // The first save is the moment a customer accepts the draft as their own;
    // autosave protects work from then on, and does not manufacture that moment
    // on their behalf.
    if (!paid || (isGeneratedDraft && !hasSavedOnce)) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      void persist(data, true);
    }, 2500);
  }

  /** The write itself. Shared by the Save button, ⌘S and the autosave timer, so
   *  there is one place that knows what a successful save means. */
  async function persist(data: Data, auto: boolean) {
    if (auto) setAutosaving(true);
    else setSaveState("saving");

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("save_project_page", {
      target_page_key: pageKey,
      new_layout: data,
    });
    if (auto) setAutosaving(false);
    // Never surface the RPC's raw Postgres error text (e.g. "payment
    // required", "page not found: %") -- same discipline as
    // style-select-client.tsx's set_project_style handling: map through
    // t() instead of displaying rpcError.message. The `paid` gate above
    // already prevents the payment-required case from being reachable in
    // the normal flow, so a generic saveError message covers whatever's
    // left (network failure, unexpected server error, etc.).
    if (!error) {
      // An autosave leaves the indicator at the quieter "已保存 14:32" rather
      // than flashing the explicit-save confirmation, which would read as a
      // response to a press that never happened.
      if (!auto) setSaveState("saved");
      setHasSavedOnce(true);
      setDirty(false);
      setSavedAt(Date.now());
      // The server row is now authoritative and strictly fresher than
      // anything in localStorage. Dropping the draft here keeps it from
      // lingering as a stale landmine on this device if the `!paid` gate
      // on `startingData` above ever stops applying to this
      // project/pageKey (e.g. a refund, or a future free/paid toggle).
      clearLocalDraft(projectId, pageKey);
    } else if (!auto) {
      setSaveState("error");
    }
    // A failed AUTOSAVE stays silent and leaves `dirty` true. It was not asked
    // for, the work is still on screen and still in the local draft, and the
    // next pause tries again -- surfacing a red error for a background attempt
    // would teach customers to distrust an editor that is working fine.
  }

  async function handleSaveClick(data: Data) {
    if (!paid) {
      setSaveState("paywall");
      return;
    }
    // A queued autosave of an older snapshot must not land after this one.
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    await persist(data, false);
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
      // Formae's own chrome, no longer Ledger's. The editor used to borrow the
      // customer's lightest style for its toolbar, palette and panels, which is
      // why signing in felt like leaving this product and entering a generic
      // one -- see chrome.module.css for the full argument. `portal-editor-scope`
      // stays: it maps Puck's own --puck-color-* variables onto whatever
      // --color-* resolves to here, so Puck's chrome follows automatically.
      className={`portal-editor-scope ${chrome.chrome} ${chrome.workbench} flex h-screen flex-col`}
    >
      {/* `flex-wrap` and a scrolling page list, because this bar is the one
          thing on the editor that a phone still has to show in full. Measured
          at 390px: the right-hand cluster alone is 493px wide and pushed the
          document to 671px, so the whole editor scrolled sideways under a
          fixed-height layout — the worst combination there is. It wraps to a
          second line instead. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b px-4 py-2 [font-size:var(--text-sm)] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]">
        {/* Page navigation. Before this the editor showed the current page's
            name as plain text and offered no way to reach the other four --
            they existed as routes and as rows in project_pages, but the only
            way to open one was to type its URL. A customer designing a
            five-page system could only ever see the page they landed on, which
            made the product look like a one-page toy. */}
        {/* Back to the home screen. The editor used to BE the landing surface
            (/portal redirected straight here), so there was nowhere to go
            back to; now that /portal is a real home, an authoring tool with
            no exit is a trap. First item in the bar, before the page tabs,
            because that is where a reader looks for "up". */}
        <Link
          href={`/${locale}/portal`}
          className="mr-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          <span aria-hidden="true">←</span>
          {t("backHome")}
        </Link>
        <span aria-hidden="true" className="h-5 w-px shrink-0 [background-color:var(--color-ink-800)]" />

        <nav className="flex items-center gap-1 overflow-x-auto" aria-label={t("pageNavLabel")}>
          {navPages.map(({ key, label }) => {
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
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
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
              className="rounded-md px-3 py-1.5 [font-size:var(--text-xs)] text-[color:var(--color-on-primary)] [background-color:var(--color-jade)] [font-weight:var(--fw-semibold)]"
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
          <LocaleSwitcher />
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2 [font-size:var(--text-sm)] [background-color:var(--color-primary-soft)] [border-color:var(--color-ink-800)]">
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
      <div className="relative min-h-0 flex-1">
        {saveState === "paywall" ? (
          // `absolute inset-0` + an opaque token background (--color-canvas
          // resolves against this component's own `.ledger` chrome scope) --
          // fully obscures the canvas rather than dimming it, and swallows
          // every pointer event that would otherwise reach Puck underneath.
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center [background-color:var(--color-canvas)]">
            <h2 className="[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">{t("paywallTitle")}</h2>
            <p className="[font-size:var(--text-sm)] [color:var(--color-paper-dim)]">{t("paywallBody")}</p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 rounded-lg px-4 py-2.5 [font-size:var(--text-sm)] text-[color:var(--color-on-primary)] [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)]"
            >
              {t("paywallCta")}
            </a>
            <button
              type="button"
              onClick={() => setSaveState("idle")}
              className="[font-size:var(--text-sm)] underline [color:var(--color-paper-dim)]"
            >
              {t("backToEditing")}
            </button>
          </div>
        ) : null}
        {/* THE 84px THE EDITOR WAS TOO TALL.
            Measured: `.Puck` computed to 950px at top 84 in a 950px viewport
            — a 1034px document — because Puck's root is 100vh and it sits
            under Formae's own page tabs and draft banner.

            Invisible while the right column scrolled its own overflow. It
            stopped being invisible when the assistant moved to the bottom of
            that column: the composer, the one control the whole feature exists
            for, sat 80px below the fold on first load.

            Three parts, and all three are needed. The wrapper above takes
            `min-h-0` so it can shrink to the 866px actually left; this div
            takes `h-full` (NOT `flex-1` — its parent is `display: block`, so
            a flex property on it is inert) to inherit that definite height;
            and puck-theme.css overrides `.Puck` from 100vh to 100%. */}
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
            // THE BLOCK DRAWER STARTS CLOSED, and the canvas is ~300px wider
            // for it. Adding a block is the occasional action -- most editing
            // is retyping a label or asking the assistant -- and a permanent
            // 54-item list is most of why this screen reads as busier than
            // Durable's. 「+ 加东西」 in the toolbar opens it; see
            // editor-chrome.tsx for why that is not the buried-button mistake
            // again.
            ui={{ leftSideBarVisible: false }}
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
              // A gallery tile, not a list row: the block renders itself, at
              // the size it is, in the customer's OWN style -- so 趋势图 is a
              // chart and 记录表格 is a table, instead of both being two grey
              // bars. See live-preview.tsx for why the schematics had to go.
              drawerItem: ({ children, name }) => (
                <ClickToAdd name={name}>
                  <div className="w-full overflow-hidden rounded-[var(--radius-md)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-950)] transition-colors group-hover/add:[border-color:var(--color-ink-700)]">
                    <LivePreview
                      name={name}
                      style={activeStyle}
                      palette={palette}
                      fallback={
                        <div className="grid h-16 place-items-center">
                          <ComponentPreview name={name} />
                        </div>
                      }
                    />
                  </div>
                  <div className="flex w-full items-center justify-between gap-2 px-0.5">
                    <div className="min-w-0 flex-1">{children}</div>
                    <span
                      aria-hidden
                      className="shrink-0 opacity-0 transition-opacity [color:var(--color-paper-dim)] [font-size:var(--text-xs)] group-hover/add:opacity-100"
                    >
                      + 加
                    </span>
                  </div>
                </ClickToAdd>
              ),
              header: () => (
                <EditorChrome
                  saving={saveState === "saving"}
                  autosaving={autosaving}
                  onSave={handleSaveClick}
                  dirty={dirty}
                  savedAt={savedAt}
                  historyOpen={historyOpen}
                  onOpenHistory={() => setHistoryOpen(true)}
                  onCloseHistory={() => setHistoryOpen(false)}
                  paid={paid}
                  pageKey={pageKey}
                  locale={locale}
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
              // `[background-color:var(--color-canvas)]` closes the second
              // seam: SystemShell is as tall as its content, the canvas is as
              // tall as the window, and the strip between them was Puck's own
              // white showing through under the customer's page. Painting this
              // wrapper in the CUSTOMER's canvas colour -- it sits inside the
              // style scope, so `--color-canvas` is theirs, not Ledger's --
              // makes that strip continuous with the page above it.
              // THE ASSISTANT IS THE RIGHT COLUMN, PERMANENTLY.
              //
              // It used to wrap Puck's ENTIRE layout via the `puck` override,
              // as a flex sibling of everything — which made it a FOURTH
              // column, and that is precisely why it could not default to
              // open: four fixed columns at 1440px leave the canvas around
              // 550px, below what a five-column record table renders without
              // clipping. So it hid behind a toolbar button, and the founder's
              // objection followed: 「把这个AI修改放在这里谁会去按啦」.
              //
              // Wrapping `fields` instead puts it inside the column Puck
              // already has. Still three columns. The assistant is simply
              // always there, and the block's own fields sit underneath it
              // when something is selected — which is also the honest reading
              // of what the two are: one edits the page by describing it, the
              // other edits one block by hand, and they are the same job at
              // two levels of zoom rather than two modes.
              //
              // PUCK'S WHOLE LAYOUT, REPLACED ON A PHONE.
              //
              // This override was removed when the assistant moved into the
              // fields column; it is back for the one thing it is actually the
              // right tool for. Below 1024px Puck's three columns do not fold,
              // they compress, and the canvas ends up too narrow to render a
              // record table at all — so on a phone the whole layout is
              // replaced rather than squeezed. See mobile-editor.tsx for what
              // it is replaced WITH, and why that is a split rather than a
              // fallback.
              //
              // Inside the provider, so the assistant is the same assistant
              // editing the same live canvas on the same undo stack.
              puck: ({ children }) =>
                narrow ? (
                  <MobileEditor
                    style={activeStyle}
                    palette={palette}
                    locale={locale}
                    navPages={navPages}
                    turns={turns}
                    setTurns={setTurns}
                    instruction={instruction}
                    setInstruction={setInstruction}
                    aiBusy={aiBusy}
                    setAiBusy={setAiBusy}
                  />
                ) : (
                  // Wrapped rather than returned bare: Puck's RenderFunc is
                  // typed to a single element, and `children` is ReactNode.
                  <>{children}</>
                ),
              // FIELDS ON TOP, ASSISTANT UNDERNEATH, and the order is forced
              // rather than chosen. Puck renders this column's title bar --
              // 「整个页面」, or the selected block's name and its breadcrumb --
              // OUTSIDE this override, permanently above whatever it returns.
              // Putting the assistant first therefore files it under a heading
              // that describes the fields, which reads as a mislabelled panel.
              //
              // It also lands the composer at the bottom of the column, which
              // is where every assistant a customer has already used puts it.
              //
              // The fields half is capped at half the column and scrolls its
              // own overflow: a RecordTable's column editor is long enough to
              // push the assistant off the bottom of the screen entirely, and
              // an assistant you have to scroll a properties panel to reach is
              // the buried toolbar button again with extra steps.
              // PICTURES FIRST, THEN THE FIELDS THAT FINE-TUNE THEM.
              //
              // The founder selected 重点数字卡, looked at what appeared, and
              // said he wanted Durable's version: 「我看到图片 就是我可以替换的
              // 别的款式 然后我点击就可以替换了」. What was there was 文字 /
              // 数值 / 链接 / 对比说明 — four inputs that change the CONTENT of
              // a card whose SHAPE was not offered at all.
              //
              // So the picker sits above the fields, outside their scroll area,
              // and stays put: choosing the shape comes before filling it in,
              // and it is the choice that has to be visible without scrolling.
              // It draws nothing at all for a block with no alternatives, which
              // is most of them — an empty 换个款式 heading on 头像 would be a
              // worse panel than no heading.
              fields: ({ children }) => (
                <FieldsPanel
                  style={activeStyle}
                  palette={palette}
                  assistant={
                    <AiAssistant
                      turns={turns}
                      setTurns={setTurns}
                      instruction={instruction}
                      setInstruction={setInstruction}
                      busy={aiBusy}
                      setBusy={setAiBusy}
                      pages={navPages}
                      locale={locale}
                    />
                  }
                >
                  {children}
                </FieldsPanel>
              ),
              // The canvas is the one thing on this screen Formae does not
              // own, so it is presented as an object rather than as the
              // background: the customer's style scope re-resolves every token
              // to their own register inside a frame that stays Formae's. The
              // token cascade does this by itself -- custom properties inherit
              // and the nearest defining ancestor wins -- which is why nothing
              // inside the canvas needed changing.
              //
              // The mount is the white plinth it stands on. This is the single
              // most important of the seven: it is the surface the customer
              // spends the most time looking at, and the one where their own
              // dark rail comes closest to Formae's frame.
              preview: ({ children }) => (
                <div className={`${chrome.mount} h-full`}>
                  <div
                    className={`${scopeClasses(activeStyle, palette)} h-full [background-color:var(--color-canvas)]`}
                  >
                    {children}
                  </div>
                </div>
              ),
            }}
          />
        </div>
      </div>
    </div>
  );
}
