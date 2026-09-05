"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/design-system/components/field";
import { PageHeader } from "@/design-system/components/page-header";
import { EmptyState } from "@/design-system/components/empty-state";
import { DataGrid } from "@/design-system/components/data-grid";
import { StatusDot, type StatusTone } from "@/design-system/components/status-dot";

type RowStatus = "paid" | "pending" | "overdue";
type Row = { date: string; description: string; amount: string; status: RowStatus };

const STATUS_TONE: Record<RowStatus, StatusTone> = {
  paid: "positive",
  pending: "warning",
  overdue: "negative",
};

const thClass =
  // Column heads carry each register's own label voice: uppercase with wide
  // tracking under Ledger, plain sentence case under Hearth and Blueprint.
  // Applying both tokens unconditionally is correct -- each style's own value
  // for --label-transform decides the outcome.
  // The head's two colours are tokens, not literals, for the same reason the
  // real record-table.tsx reads them: 印头 fills this band with its accent and
  // every other register leaves it card-coloured. Hard-coding them here made
  // the gallery unable to show the one thing that register is FOR.
  "sticky top-0 z-[1] whitespace-nowrap border-b text-left [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)] [background-color:var(--color-table-head-bg)] [border-color:var(--color-ink-800)] [color:var(--color-table-head-fg)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]";

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

      {/* 🔴 那一排「已筛选：等回覆 ×」拿掉了（2026-09-05）。

          它印在**一个新客户看到的第一屏**上，而底下那张表六行一行都没少
          （Paid · Pending · Overdue 三种都在），那颗 × 指着 "#"。
          一句在第一屏上就查得出来是假的话，比少一个零件贵得多。

          样板本来就已经在示范这一套风格怎么画标题、表格、状态点、
          输入框跟空的时候那一格 —— 多这一排只多一句不成立的话。
          产生器那一边同一天一起拿掉了，见 industry-template.ts 的
          `filterChips` 那一段。 */}
      <DataGrid id="style-picker-sample" label={t("dataGridLabel")}>
        {/* --text-sm, not a literal: 大字 runs its body at 15px here and 13px
            hard-coded meant the one register whose entire axis is TYPE SIZE
            rendered its table at everyone else's size. */}
        <table
          className="w-full border-collapse [font-size:var(--text-sm)]"
          // Four columns of Chinese plus a right-aligned amount need this much
          // before they start wrapping. DataGrid scrolls what overflows; the
          // table simply never claimed the room, so 大字 crushed instead.
          style={{ minWidth: 380 }}
        >
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
                <td className="whitespace-nowrap [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)] [color:var(--color-paper-dim)]">{row.date}</td>
                <td className="[padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)] [color:var(--color-paper)]">{row.description}</td>
                <td className="tnum whitespace-nowrap text-right [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)] [color:var(--color-paper)] [font-family:var(--font-numeric)]">{row.amount}</td>
                <td className="[padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)]">
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
