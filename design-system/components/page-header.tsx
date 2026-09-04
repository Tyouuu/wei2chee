import Link from "next/link"
import type { ReactNode } from "react"

/**
 * The page's identity zone: title, an optional one-line summary of scale,
 * and the one action this page is for. It renders on the page background,
 * OUTSIDE any card that holds the page's content — that placement keeps
 * "you are here" (this header) visually separate from "here is the data"
 * (the content below it), instead of both rendering at the same elevation
 * inside one bordered surface, where the border stops grouping anything and
 * just becomes an outline drawn around the whole page.
 *
 * The action slot is what gives a page's primary action somewhere to live,
 * next to the heading it belongs to, rather than only existing as a nav
 * link elsewhere in the app.
 *
 * Ported and generalized from a real client codebase's `page-header.tsx`.
 */
export function PageHeader({
  title,
  subtitle,
  meta,
  action,
  layout,
}: {
  /** ReactNode, not string, so the editor can wrap it in an <Inline> marker
   *  and let the customer retype it on the page. Every existing caller passes
   *  a string, which is a ReactNode. */
  title: ReactNode
  /** One line on the scale of what's below, e.g. "249 records · 44 regions". */
  subtitle?: ReactNode
  /** Small trailing element beside the title, e.g. a read-only badge. */
  meta?: ReactNode
  /** Either a link-style primary action (rendered as a styled link) or any
      other node — a button, a group of buttons — for full control. */
  action?: { href: string; label: string } | ReactNode
  /**
   * WHY THIS AXIS EXISTS. Measured 2026-08-23: 43 of 57 components had no
   * alternative look at all, and this one — the first thing on every page —
   * was among them. Twenty-two registers, one page heading.
   *
   *   split     title left, action right. The default a working system wants.
   *   stacked   action drops under the title. What a page with a long title
   *             or a phone-first business needs, and what 大字 / 清 should
   *             have been getting all along.
   *   centred   for a register whose whole argument is air (墨, 素).
   *   ruled     a hairline under the whole block — the 台账 / 单据 answer,
   *             where a heading is a section marker rather than a title.
   *
   * No default in the signature: absent means "follow the register".
   * See puck-config-client.tsx.
   */
  layout?: "split" | "stacked" | "centred" | "ruled"
}) {
  const stacked = layout === "stacked"
  const centred = layout === "centred"
  const ruled = layout === "ruled"
  const actionNode =
    action && typeof action === "object" && "href" in action ? (
      <Link
        href={action.href}
        className="inline-flex shrink-0 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] [color:var(--color-on-primary)] transition-colors [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] [transition-duration:var(--dur)] [transition-timing-function:var(--ease-out-quad)] hover:[background-color:var(--color-primary-deep)]"
      >
        {action.label}
      </Link>
    ) : (
      action
    )

  return (
    <div
      // ONE alignment class, chosen — not three appended and left to fight.
      // The first version emitted `items-start justify-between` AND
      // `flex-col items-center text-center` together for 墨: both set
      // align-items, and which wins is decided by the order the rules happen to
      // sit in the compiled stylesheet rather than by the order they are
      // written here. Measured: the register's preference arrived correctly and
      // the heading still rendered left.
      className={[
        "mb-4 flex flex-wrap gap-x-4 gap-y-2",
        centred
          ? "flex-col items-center text-center"
          : stacked
            ? "flex-col items-start"
            : "items-start justify-between",
        ruled ? "[border-bottom:var(--hairline)_solid_var(--color-ink-800)] [padding-bottom:var(--gap-stack)]" : "",
      ].join(" ")}
    >
      {/* `data-page-title`：给外面一个抓得到的把手。手机上那个壳顶上
          已经有一条写着页名的带子，所以这一格在那里是同一句话的第三次
          （面包屑 · 带子 · 这里）—— 见 mobile-editor.tsx。
          动作那一颗留着，它不是标题。 */}
      <div data-page-title className="min-w-0">
        <h1 className="ds-display flex items-center [gap:var(--gap-inline)] [font-size:var(--text-title)] tracking-[var(--tracking-title)] text-[color:var(--color-on-canvas)] [font-weight:var(--fw-semibold)]">
          {title}
          {meta}
        </h1>
        {subtitle && (
          <p className="mt-0.5 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">{subtitle}</p>
        )}
      </div>
      {actionNode}
    </div>
  )
}
