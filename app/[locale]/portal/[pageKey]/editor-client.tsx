"use client";

import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import "@/design-system/editor/puck-theme.css";
import { puckConfig } from "@/design-system/editor/puck-config";
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

export function PortalEditor({
  pageKey,
  initialData,
  style,
}: {
  pageKey: string;
  initialData: Record<string, unknown>;
  /** The customer's own chosen style (projects.style, Task 3) -- applies to
   * canvas CONTENT only. Chrome (this component's own wrapper below) stays
   * Ledger regardless, per Task 5's own reviewed design. */
  style: StyleName;
}) {
  return (
    <div className={`portal-editor-scope ${styles.ledger} flex h-screen flex-col`}>
      <div className="border-b px-4 py-2 text-[13px] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]">
        {PAGE_LABELS[pageKey] ?? pageKey}
      </div>
      <div className="flex-1">
        <Puck
          config={puckConfig}
          data={initialData}
          onPublish={() => {}}
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
    </div>
  );
}
