"use client";

import { useEffect, useState } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import "@/design-system/editor/puck-theme.css";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { puckConfig } from "@/design-system/editor/puck-config";
import { readLocalDraft, writeLocalDraft } from "../local-draft";
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

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  quotations: "Quotations",
  projects: "Projects",
  payments: "Payments",
};

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
  paid,
  initialData,
  style,
}: {
  pageKey: string;
  projectId: string;
  /** projects.paid (Task 1) -- save_project_page raises "payment required"
   * server-side for an unpaid project (the real enforcement), but the
   * paywall interstitial below is shown client-side off this prop so an
   * unpaid customer sees a purpose-built CTA instead of a raw error. */
  paid: boolean;
  initialData: Record<string, unknown>;
  /** The customer's own chosen style (projects.style, Task 3) -- applies to
   * canvas CONTENT only. Chrome (this component's own wrapper below) stays
   * Ledger regardless, per Task 5's own reviewed design. */
  style: StyleName;
}) {
  const t = useTranslations("portal.editor");
  const [saveState, setSaveState] = useState<SaveState>("idle");

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
  // payment-required check, supabase/migrations/20260818120000). The local
  // draft (local-draft.ts) is a passive mirror of every change written by
  // handleChange below, independent of paid status, so this picks up the
  // customer's latest in-progress edit -- not the last-saved server
  // snapshot -- both on a page reload and when toggling back from the
  // paywall interstitial (setSaveState("idle") below) after Puck has
  // unmounted. Computed fresh on every render (once `hydrated`), not
  // frozen into state once, so the paywall-toggle remount below still
  // picks up whatever handleChange most recently wrote -- not just
  // whatever the draft was at page-load time.
  const startingData = hydrated
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
    setSaveState(error ? "error" : "saved");
  }

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "我的设计已经准备好了，我想付款保存",
  )}`;

  return (
    <div className={`portal-editor-scope ${styles.ledger} flex h-screen flex-col`}>
      <div className="flex items-center justify-between border-b px-4 py-2 text-[13px] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]">
        <span>{PAGE_LABELS[pageKey] ?? pageKey}</span>
        {saveState === "saved" ? (
          <span className="[color:var(--color-jade-bright)]">{t("saveSuccess")}</span>
        ) : null}
        {saveState === "error" ? (
          <span className="[color:var(--color-clay-bright)]">{t("saveError")}</span>
        ) : null}
      </div>

      {saveState === "paywall" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
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
      ) : (
        <div className="flex-1">
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
            // page load -- the paywall interstitial's own conditional
            // render (below) already remounts Puck independently on every
            // paywall<->editor toggle, which is what keeps that path
            // picking up the latest in-session edit.
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
                <div className={`${styles.scope} ${CANVAS_SCOPE_CLASS[style]} h-full`}>{children}</div>
              ),
            }}
          />
        </div>
      )}
    </div>
  );
}
