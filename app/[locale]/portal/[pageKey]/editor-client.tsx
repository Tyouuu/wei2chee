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

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  quotations: "Quotations",
  projects: "Projects",
  payments: "Payments",
};

export function PortalEditor({
  pageKey,
  initialData,
}: {
  pageKey: string;
  initialData: Record<string, unknown>;
}) {
  return (
    <div className={`portal-editor-scope ${styles.ledger} flex h-screen flex-col`}>
      <div className="border-b px-4 py-2 text-[13px] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]">
        {PAGE_LABELS[pageKey] ?? pageKey}
      </div>
      <div className="flex-1">
        <Puck config={puckConfig} data={initialData} onPublish={() => {}} />
      </div>
    </div>
  );
}
