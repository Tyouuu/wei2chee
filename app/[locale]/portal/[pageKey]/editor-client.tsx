"use client";

import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckConfig } from "@/design-system/editor/puck-config";

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
    <div className="flex h-screen flex-col">
      <div className="border-b px-4 py-2 text-[13px] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]">
        {PAGE_LABELS[pageKey] ?? pageKey}
      </div>
      <div className="flex-1">
        <Puck config={puckConfig} data={initialData} onPublish={() => {}} />
      </div>
    </div>
  );
}
