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
import {
  clearLocalDraft,
  readLocalDraft,
  writeLocalDraft,
} from "../local-draft";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import { EditorChrome } from "./editor-chrome";
import { ComponentPreview } from "@/design-system/editor/component-preview";
import { ClickToAdd } from "./drawer-add";
import { LivePreview } from "@/design-system/editor/live-preview";
import { EditorUiProvider, SheetHost } from "@/design-system/editor/editor-ui";
import { BarMenu, barMenuItem } from "@/design-system/editor/bar-menu";
import { PublishSite } from "./publish-site";
import { ExitPreview } from "@/design-system/editor/preview-toggle";
import { DraftNotice } from "@/design-system/editor/draft-notice";
import { BlockToolbar } from "@/design-system/editor/block-toolbar";
import { InsertAffordance } from "@/design-system/editor/insert-affordance";
import { BlockSheets, InsertSheet } from "@/design-system/editor/editor-sheets";
import { AiDock } from "@/design-system/editor/ai-dock";
import { StyleButton, StyleSheet } from "@/design-system/editor/style-sheet";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import type { SystemLang } from "@/lib/system-lang";
import { InlineEditing } from "@/design-system/editor/inline-editing";
import { CanvasGutter } from "@/design-system/editor/canvas-gutter";
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
import {
  STYLE_ORDER,
  type StyleName,
} from "@/app/[locale]/style-picker/style-column";
import { scopeClasses } from "@/lib/portal/palettes";
import { RegisterProvider } from "@/design-system/editor/style-scope";

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
  swiss: styles.swiss,
  soft: styles.soft,
  brut: styles.brut,
  ink: styles.ink,
  glass: styles.glass,
  night: styles.night,
};

type SaveState = "idle" | "saving" | "saved" | "error" | "paywall";

/** The order the eight registers are offered in, oldest and plainest first --
 *  the same order /portal/styles uses, so a customer who has seen that page
 *  finds them where they left them. */
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
  seededTemplate,
  projectId,
  accountEmail,
  paid,
  initialData,
  isGeneratedDraft,
  locale,
  navPages,
  style,
  palette,
  systemLang,
  siteSlug,
  sitePublished,
}: {
  pageKey: string;
  /** The component name that ?add= just inserted, or null. */
  seededComponent?: string | null;
  /** The 官网版面 that ?tpl= just applied, or null. */
  seededTemplate?: string | null;
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
  /** The language the customer's SYSTEM is written in
   *  (`projects.system_language`, default English). Not `locale`, which is the
   *  language the OWNER reads Formae in -- see lib/system-lang.ts. Threaded
   *  down so the canvas can be wrapped in it: the blocks inside are the
   *  customer's system, the chrome around them is Formae's. */
  systemLang: SystemLang;
  /** projects.site_slug -- the 官网's public address, or null before one is
   *  claimed. Only the website page does anything with it. */
  siteSlug: string | null;
  /** projects.site_published -- whether that address answers. Separate from the
   *  slug on purpose: taking a site down must not release the address, or a
   *  business loses a URL it has already printed. */
  sitePublished: boolean;
}) {
  const t = useTranslations("portal.editor");
  // The eight one-line tags ('紧凑 · 表格多、行数多') already exist under
  // portal.home for the style gallery. Read from there rather than copied, so
  // the sheet and the gallery cannot describe the same register differently.
  const tHome = useTranslations("portal.home");
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Session-local tracking is sufficient for v1's deliberately narrow Deploy
  // definition (spec §6) -- true once a save has actually succeeded, not
  // just on mount. Doesn't need to survive a reload: the Deploy button is a
  // WhatsApp handoff a customer clicks once, right after saving.
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  // THE STYLE IS CHANGED HERE AGAIN, AND WITHOUT LEAVING THE PAGE.
  //
  // It moved to /portal/styles when the bar was cut from fifteen controls to
  // four, which was right about the bar and wrong about the choice: picking a
  // register meant leaving your own system, comparing eight samples of somebody
  // else's invoice, and coming back to find out whether you were right.
  // Durable's Themes is one press in the top bar and the site changes under
  // you. Everything downstream already reads this one value -- the canvas
  // scope, the drawer previews, the variant tiles -- so setting it repaints the
  // customer's REAL page, with their words in it, on the same frame.
  //
  // Optimistic, and rolled back if the database refuses, for the same reason
  // the styles page is: what the round trip confirms is persistence, not
  // appearance.
  const [activeStyle, setActiveStyle] = useState<StyleName>(style);
  const [stylePending, setStylePending] = useState<StyleName | null>(null);
  const [styleFailed, setStyleFailed] = useState(false);

  async function pickStyle(next: StyleName) {
    if (next === activeStyle || stylePending) return;
    const previous = activeStyle;
    setActiveStyle(next);
    setStylePending(next);
    setStyleFailed(false);
    const { error } = await createBrowserSupabaseClient().rpc(
      "update_project_style",
      {
        new_style: next,
      },
    );
    setStylePending(null);
    if (error) {
      setActiveStyle(previous);
      setStyleFailed(true);
    }
  }

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
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    getNarrow,
    getNarrowServer,
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [instruction, setInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  // Edited since the last successful save. `handleChange` fires on every Puck
  // mutation including the assistant's, so this is the honest answer to "is
  // there work on screen that is not in the database".
  const [dirty, setDirty] = useState(false);
  const latestData = useRef<Data | null>(null);
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

  // Same for a 官网版面 arriving from 模板库. Left in the URL it would re-apply
  // the template on every reload, which would quietly discard whatever the
  // customer changed after choosing it.
  useEffect(() => {
    if (!seededTemplate) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("tpl")) return;
    url.searchParams.delete("tpl");
    window.history.replaceState(null, "", url.pathname + url.search);
    setDirty(true);
  }, [seededTemplate]);

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
  const localDraft =
    hydrated && !paid ? readLocalDraft(projectId, pageKey) : null;
  const startingData = localDraft
    ? (upgradeLayout(localDraft) as Data)
    : (initialData as Data);

  function handleChange(data: Data) {
    // The last thing Puck rendered, for the two controls that live in this
    // scope rather than inside Puck's provider and so cannot ask for it: the
    // pre-save handoff button below, and nothing else yet. Everything inside
    // Puck reads its own state.
    latestData.current = data;
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

  // THE TOP BAR'S CONTENT, HANDED TO EditorChrome RATHER THAN DRAWN HERE.
  //
  // There used to be three stacked bands above the canvas -- this nav row,
  // the draft banner, and Puck's header (EditorChrome) -- costing about
  // 200px before the customer saw anything of their own. Durable, which the
  // founder holds this up against, has one.
  //
  // They could not merge by moving markup: EditorChrome renders through
  // Puck's `header` override so it can read history and dispatch, and this
  // component is outside Puck's provider. Passing the content down as a node
  // puts both halves in one flex row without either side changing what it
  // knows.
  // THE BAR, CUT FROM FIFTEEN CONTROLS TO FOUR.
  //
  // Measured before this change: ← 我的系统 · 总览 · 客户 · 收款 · 报价单 · 项目 ·
  // 系统需求书 · 风格 · 中文 · EN · 登出 · 历史 · ↺ · ↻ · 保存设计 -- fifteen pieces
  // of Chinese text in a 50px strip. Durable's carries about seven, mostly
  // icons, and switches page through a single 「Page: Home ▾」. The founder's
  // 「感觉还是跟durable的有点差距」 is mostly this bar: everything else had already
  // stopped being docked, but the top was still a list to read.
  //
  // What stays in the open is what a customer touches while designing: which
  // page, and the handoff once they have saved. Everything else -- the other
  // pages' entry point, the spec, the style gallery, language, sign-out -- is
  // one press away in 更多, which is where Durable keeps the same class of thing.
  const topNav = (
    <>
      <BarMenu
        label={
          <span className="[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
            {navPages.find((p) => p.key === pageKey)?.label ?? pageKey}
          </span>
        }
      >
        {navPages.map(({ key, label }) => (
          <Link
            key={key}
            href={`/${locale}/portal/${key}`}
            aria-current={key === pageKey ? "page" : undefined}
            className={barMenuItem}
            style={
              key === pageKey
                ? {
                    color: "var(--color-paper)",
                    backgroundColor: "var(--color-ink-850)",
                  }
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </BarMenu>

      {/* The one thing that must never be behind a menu: it only appears after
          a successful save, it is the moment the customer hands the design over
          to be built, and it is how the founder gets told. */}
      {saveState === "saved" ? (
        <span className="[color:var(--color-jade-bright)]">
          {t("saveSuccess")}
        </span>
      ) : null}
      {saveState === "error" ? (
        <span className="[color:var(--color-clay-bright)]">
          {t("saveError")}
        </span>
      ) : null}
    </>
  );

  const finishCta = (
    <>
      {/* ALWAYS ON SCREEN, NOT ONLY AFTER THE FIRST SAVE.
        It used to appear only once `hasSavedOnce`, which meant a customer
        opening their system for the first time could not see where any of
        this was going. Durable's Publish is lit from the first second, and
        that is most of what makes its editor feel like it has an end.
        Before the first save it is the same button in a quieter treatment
        and it does the step that has to come first -- it saves -- rather
        than being disabled, which would answer the question with nothing. */}
      {hasSavedOnce ? (
        <a
          href={deployWhatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md px-3 py-1.5 [font-size:var(--text-xs)] text-[color:var(--color-on-primary)] [background-color:var(--color-jade)] [font-weight:var(--fw-semibold)]"
        >
          {t("deployCta")}
        </a>
      ) : (
        <button
          type="button"
          onClick={() =>
            void handleSaveClick(latestData.current ?? (startingData as Data))
          }
          title={t("deployNeedsSave")}
          className="rounded-md border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-jade)] [color:var(--color-jade-bright)] [font-weight:var(--fw-semibold)] hover:[background-color:var(--color-ink-850)]"
        >
          {t("deployCta")}
        </button>
      )}
    </>
  );

  // Everything that used to sit in the open on the right-hand side. Rendered by
  // EditorChrome inside its own bar so undo/redo/save stay beside it.
  const overflowMenu = (
    <BarMenu label={<span>{t("moreMenu")}</span>} align="end">
      <Link href={`/${locale}/portal`} className={barMenuItem}>
        <span aria-hidden="true">←</span>
        {t("backHome")}
      </Link>
      <Link
        href={`/${locale}/portal/spec`}
        // Next prefetches <Link> on hover in production, and this route runs an
        // LLM call while rendering -- prefetch would bill a generation for every
        // hover, for a document nobody opened.
        prefetch={false}
        className={barMenuItem}
      >
        {t("specCta")}
      </Link>
      <div className={barMenuItem}>
        <LocaleSwitcher />
      </div>
      <button type="button" onClick={handleSignOut} className={barMenuItem}>
        {t("signOut")}
      </button>
    </BarMenu>
  );

  return (
    <EditorUiProvider>
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

        {/* The generated-draft banner. A customer who has just answered a
          questionnaire about their business now opens the editor on a system
          already built from those answers -- their own industry vocabulary,
          their own workflow stages, their own summary line. That is only a good
          experience if they are TOLD it is a draft: without this line, sample
          rows like "Taman Desa 三房翻新" read either as real data the product
          invented, or as a generic demo. With it, they read as an invitation to
          edit. Disappears the moment they save, because from then on the canvas
          is genuinely their own work. */}

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
            <div className="ds-ground absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center [background-color:var(--color-canvas)]">
              <h2 className="[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {t("paywallTitle")}
              </h2>
              <p className="[font-size:var(--text-sm)] [color:var(--color-paper-dim)]">
                {t("paywallBody")}
              </p>
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
              // NOTHING IS DOCKED. Both of Puck's side columns are collapsed for
              // the life of the editor, and neither ever reopens in place.
              //
              // The founder put four Durable screenshots beside this editor and
              // said 「我还是觉得durable的好看更简单操作一点」. Counting what is on
              // screen at rest explains it: Durable shows one bar; this showed a
              // nav row, a style row, a draft banner, a toolbar, a 58px icon rail
              // and a 400px properties column, with the customer's own system
              // sixth. Measured at 1600px, the canvas was 1212px of it.
              //
              // The two columns still RENDER -- `leftSideBarVisible` and
              // `rightSideBarVisible` only set their grid column to 0 (see
              // `_PuckLayout--rightSideBarVisible_` in @puckeditor/core's
              // index.css), the subtrees are untouched. That is what makes this
              // possible without re-implementing anything: the `fields` and
              // `drawer` overrides below still receive Puck's own field editors
              // and its own palette, and portal them into sheets that float over
              // the canvas only while they are being used.
              ui={{ leftSideBarVisible: false, rightSideBarVisible: false }}
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
                    {/* ONE CARD, ONE ASPECT RATIO, THE WHOLE BLOCK INSIDE IT.
                        Same card as 组件库 and for the same reason — see
                        design-system/editor/specimen.tsx. What was here was a
                        78px window onto a 168px composition, so every tile in
                        加一段 showed a slice: 官网大标题 was a headline and the
                        top third of a button, 重点数字卡 lost the figures under
                        its number. Screenshotted at 1440 on 2026-08-23, which
                        is the only way that kind of fault ever surfaces —
                        nothing throws and every test stays green. */}
                    <div className="w-full overflow-hidden rounded-[var(--radius-md)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-950)] transition-colors group-hover/add:[border-color:var(--color-ink-700)]">
                      <LivePreview
                        name={name}
                        style={activeStyle}
                        palette={palette}
                        // Composed at 620 and scaled to fit. Two per row now,
                        // so a shelf of six is one screen instead of six.
                        width={620}
                        frameHeight={104}
                        fallback={
                          <div className="grid h-[104px] place-items-center">
                            <ComponentPreview name={name} />
                          </div>
                        }
                      />
                      <div className="flex w-full items-center justify-between gap-1 border-t [border-color:var(--color-ink-800)] pr-2 [background-color:var(--color-ink-900)]">
                        <div className="min-w-0 flex-1">{children}</div>
                        <span
                          aria-hidden
                          className="shrink-0 opacity-0 transition-opacity [color:var(--color-paper-dim)] [font-size:var(--text-xs)] group-hover/add:opacity-100"
                        >
                          ＋
                        </span>
                      </div>
                    </div>
                  </ClickToAdd>
                ),
                header: () => (
                  <EditorChrome
                    nav={topNav}
                    tools={<StyleButton label={t("styleLabel")} />}
                    publish={
                      // Website only. 收款 and 客户 are the business's own
                      // working pages -- there is nothing to publish, and a
                      // greyed-out 发布 on five pages teaches the customer that
                      // the button is decorative.
                      pageKey === "website" ? (
                        <PublishSite
                          initialSlug={siteSlug}
                          initialPublished={sitePublished}
                        />
                      ) : null
                    }
                    finish={finishCta}
                    overflow={overflowMenu}
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
                // PUCK'S FIELDS, FLOATED. The override still runs with the right
                // column collapsed to 0px, so `children` is the real field tree
                // for the selected block -- every field type, every resolver,
                // unchanged. BlockSheets portals it into the 改文字 sheet and
                // renders the 换款式 sheet beside it.
                //
                // The assistant is no longer passed down here: it used to share
                // this column 60/40 with the fields, which is what made an empty
                // 「整个页面」 heading sit above 400px of nothing whenever no block
                // was selected. It floats at the foot of the canvas now -- see
                // the `preview` override below.
                fields: ({ children }) => (
                  <BlockSheets style={activeStyle} palette={palette}>
                    {children}
                  </BlockSheets>
                ),
                // THE FLOATING TOOLBAR under the selected block: 换款式 · 改文字,
                // then Puck's own move/duplicate/delete. Durable's Design / Edit
                // content pill, which is the third screenshot the founder sent.
                actionBar: ({ label, children, parentAction }) => (
                  <BlockToolbar label={label} parentAction={parentAction}>
                    {children}
                  </BlockToolbar>
                ),
                // ＋ 加一段 in the gap under each block, carrying the position it
                // will insert at -- so adding no longer means opening a 54-tile
                // drawer and then dragging the result up from the bottom.
                componentOverlay: ({
                  children,
                  hover,
                  isSelected,
                  componentId,
                }) => (
                  <InsertAffordance
                    hover={hover}
                    isSelected={isSelected}
                    componentId={componentId}
                  >
                    {children}
                  </InsertAffordance>
                ),
                // The palette, in a sheet instead of a column. Same tiles, same
                // live previews, same click-to-add: only the docking is gone.
                drawer: ({ children }) => <InsertSheet>{children}</InsertSheet>,
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
                  // `relative` so the assistant can be positioned against the
                  // canvas rather than the window: it has to sit at the foot of
                  // the customer's page, not the foot of the screen, or it covers
                  // the browser's own chrome on a short window.
                  <div
                  data-editor-canvas
                  className={`${chrome.mount} relative h-full`}
                >
                    {/* Holds a strip clear on the right while a sheet is docked
                      there, so the block being edited reflows beside the panel
                      instead of underneath it. See canvas-gutter.tsx. */}
                    <CanvasGutter
                      className={`ds-ground ${scopeClasses(activeStyle, palette)} h-full [background-color:var(--color-canvas)]`}
                    >
                      {/* Everything inside the canvas is the CUSTOMER'S system
                        and speaks their system language; everything outside it
                        is Formae and speaks the owner's. The provider sits at
                        exactly that boundary, one layer inside the style scope
                        it mirrors. RegisterProvider is beside it for the same
                        reason: the canvas paints in `activeStyle`, so the blocks
                        inside it must also take their SHAPE from `activeStyle`.
                        Announcing it here rather than in StyleScope is what makes
                        换个款式 relayout the page on the same click that repaints
                        it -- CanvasGutter needs the classes on itself. */}
                      <RegisterProvider style={activeStyle}>
                        <SystemLangProvider lang={systemLang}>
                          {children}
                        </SystemLangProvider>
                      </RegisterProvider>
                    </CanvasGutter>
                    {/* Type on the page instead of in a panel. Renders nothing;
                      it turns the <Inline> spans puck-config leaves in the
                      canvas into editable text. Inside Puck's provider because
                      it dispatches, and inside the preview override because
                      that is the only place that is true. */}
                    <InlineEditing />
                    {/* The draft note now rides the canvas instead of being a
                      band above it -- see draft-notice.tsx for the measurement
                      that motivated the move. */}
                    {isGeneratedDraft ? (
                      <DraftNotice
                        title={t("draftBannerTitle")}
                        body={t("draftBannerBody")}
                        dismiss={t("draftDismiss")}
                      />
                    ) : null}
                    <ExitPreview label={t("exitPreview")} />
                    {/* OUTSIDE the style scope on purpose. The assistant is
                      Formae's, not the customer's -- scoping it would repaint
                      it in whichever register they picked, which is the exact
                      confusion chrome.module.css exists to prevent. */}
                    <AiDock>
                      <AiAssistant
                        turns={turns}
                        setTurns={setTurns}
                        instruction={instruction}
                        setInstruction={setInstruction}
                        busy={aiBusy}
                        setBusy={setAiBusy}
                        pages={navPages}
                        locale={locale}
                        // Not a phone here -- but `compact` is the same request
                        // either way: drop the duplicate header and lay the three
                        // examples out as a swipeable row rather than a stack.
                        // Measured docked and non-compact: 385px of the canvas,
                        // most of it the explanation the composer's placeholder
                        // already gives.
                        compact
                      />
                    </AiDock>
                  </div>
                ),
              }}
            />
          </div>
        </div>
        {/* Every sheet lands here: inside this component's scoped chrome, so the
          --color-* tokens they read are Formae's, and after Puck so nothing in
          its layout can clip them. Renders nothing by itself. */}
        <SheetHost />
        <StyleSheet
          active={activeStyle}
          palette={palette}
          pending={stylePending}
          failed={styleFailed}
          onPick={pickStyle}
          locale={locale}
          styles={STYLE_ORDER.map((name) => ({
            name,
            tag: tHome(`styleTag.${name}`),
          }))}
          labels={{
            title: t("styleLabel"),
            current: tHome("styleCurrent"),
            failed: t("styleFailed"),
            more: t("styleMore"),
          }}
        />
      </div>
    </EditorUiProvider>
  );
}
