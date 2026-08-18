"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/design-system/components/field";
import { PageHeader } from "@/design-system/components/page-header";
import { EmptyState } from "@/design-system/components/empty-state";
import { DataGrid } from "@/design-system/components/data-grid";
import { StatusDot, type StatusTone } from "@/design-system/components/status-dot";
import { FilterChips } from "@/design-system/components/filter-chips";

type RowStatus = "paid" | "pending" | "overdue";
type Row = { date: string; description: string; amount: string; status: RowStatus };

const STATUS_TONE: Record<RowStatus, StatusTone> = {
  paid: "positive",
  pending: "warning",
  overdue: "negative",
};

const thClass =
  "sticky top-0 z-[1] border-b px-3 py-2 text-left text-[12px] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]";

/**
 * One representative content set — a generic month-of-transactions view,
 * not tied to any real client or industry — rendered through the Task 2-3
 * component library (`PageHeader`, `FilterChips`, `DataGrid`, `StatusDot`,
 * `Field`, `EmptyState`).
 *
 * This is intentionally the *same* JSX regardless of which style is
 * active: it reads every color, weight and spacing value through the
 * components' own `var(--color-*)` / `var(--fw-*)` references, so mounting
 * it under a different <StyleColumn> scope is the only thing that changes
 * how it looks. That's the point of the whole page — a client compares
 * style against style, never content against content.
 *
 * A Client Component (not the server-rendered default the rest of this
 * page's tree uses) because it renders `Field`, itself a Client Component
 * whose `children` prop is a render-prop function — a Server Component
 * cannot pass a function across the server/client boundary as a prop, so
 * anything mounting `Field` has to already be on the client side of that
 * boundary itself.
 */
export function SampleContent() {
  const t = useTranslations("stylePicker.sample");
  const rows = t.raw("rows") as Row[];
  const statusLabels = t.raw("statusLabels") as Record<RowStatus, string>;
  const headers = t.raw("dataGridHeaders") as Record<"date" | "description" | "amount" | "status", string>;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("pageHeaderTitle")} subtitle={t("pageHeaderSubtitle")} />

      <FilterChips
        chips={[{ label: t("filterLabel"), value: t("filterValue"), removeHref: "#" }]}
        clearAllHref="#"
      />

      <DataGrid id="style-picker-sample" label={t("dataGridLabel")}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={thClass}>{headers.date}</th>
              <th className={thClass}>{headers.description}</th>
              <th className={`${thClass} text-right`}>{headers.amount}</th>
              <th className={thClass}>{headers.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.date}-${row.description}`}
                className="border-b last:border-b-0 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
              >
                <td className="px-3 py-2 [color:var(--color-paper-dim)]">{row.date}</td>
                <td className="px-3 py-2 [color:var(--color-paper)]">{row.description}</td>
                <td className="tnum px-3 py-2 text-right [color:var(--color-paper)]">{row.amount}</td>
                <td className="px-3 py-2">
                  <StatusDot tone={STATUS_TONE[row.status]} label={statusLabels[row.status]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataGrid>

      <Field label={t("fieldLabel")} hint={t("fieldHint")}>
        {(id) => (
          <input
            id={id}
            type="text"
            placeholder={t("fieldPlaceholder")}
            className="w-full rounded-lg border px-3 py-2 text-[13px] text-[color:var(--color-paper)] outline-none transition-colors [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [transition-duration:var(--dur-fast)] placeholder:text-[color:var(--color-paper-dim)] focus-visible:[border-color:var(--color-primary)]"
          />
        )}
      </Field>

      <div>
        <p className="mb-1.5 text-[11px] tracking-wide uppercase [color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">
          {t("emptyStateLabel")}
        </p>
        <EmptyState variant="empty" title={t("emptyStateTitle")} description={t("emptyStateDescription")} />
      </div>
    </div>
  );
}
