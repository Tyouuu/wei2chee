// "use client" for the same reason stat-row.tsx carries it: an absent
// appearance prop means "follow the 版式", which is a context lookup, and the
// saved customer page is rendered by Puck's <Render> on the SERVER.
"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Avatar } from "./avatar"

/**
 * 排行 — who is worth the most, in three genuinely different objects.
 *
 * ── WHY A NEW COMPONENT AND NOT ANOTHER MarkList VARIANT ──────────────────
 *
 * The dashboard's ranking was a MarkList, which draws one line of text per
 * item: 「1. Mr Tan · RM 48,500」. Put that beside the two dashboards the
 * founder sent on 2026-08-25 and the difference is not styling. shadcn-admin's
 * Recent Sales is an initials circle, a name over an email, and an amount
 * flushed to the right edge. Ant Design Pro's 门店销售额排名 is a filled rank
 * badge, a store name, and a figure flushed right. Both are ROWS with two
 * ends. Ours was a sentence with a middle dot in it, and a sentence cannot be
 * scanned down a column of figures.
 *
 * MarkList's axis is how its items are SEPARATED (nothing, a rule, a rule to
 * the edges). That is the right axis for a list of statements. It has no way
 * to express "the number goes on the other side", because a mark has one end.
 *
 * ── WHY THIS MATTERS BEYOND ONE BLOCK ─────────────────────────────────────
 *
 * Measured on 2026-08-25 across the eighteen registers, on the seven axes a
 * palette cannot repaint: twenty-seven of a hundred and thirty-six pairs
 * overlapped on more than three of them. Panel was `card` in eleven of
 * eighteen, TrendChart `bar` in ten. The founder's reading of the same
 * numbers, and it is the correct one: 「只是你再调那个颜色而已？那为什么不要放在
 * 配色？」 -- a register that survives a repaint is a register; one that does
 * not is a palette.
 *
 * The fix for that is not to shuffle the axes we have. Eighteen designs drawn
 * from eleven blocks and seven axes will rhyme no matter how they are dealt.
 * It is to ADD axes, and an axis is only real when its options are different
 * OBJECTS rather than the same object in different paint. These three are:
 * one is a numbered sentence, one is a badge-and-figure row, one is a
 * two-line person. No palette can turn any of them into either of the others.
 */

export type RankRow = {
  /** The thing being ranked — a customer, a store, a salesperson. */
  name: ReactNode
  /** The line under it in `person` shape; ignored by the other two, which have
   *  no second line to put it on. Kept in the data rather than dropped so that
   *  switching shape never loses what the customer typed. */
  sub?: string
  /** Flushed right in `badge` and `person`. A string, not a number: it arrives
   *  already formatted as money in the owner's own currency. */
  amount?: string
  href?: string
}

export type RankShape = "plain" | "badge" | "person"

/** The top three get a colour; the rest are ink. Every reference does this and
 *  the reason is that a leaderboard where row nine looks like row one is a
 *  list. Tokens, so a register with no gold in its palette still resolves. */
const MEDAL = [
  "var(--color-medal-gold)",
  "var(--color-medal-silver)",
  "var(--color-medal-bronze)",
]

export function RankList({
  heading,
  rows,
  shape,
}: {
  heading?: string
  rows: RankRow[]
  /** No default — see stat-row.tsx on why `undefined` is load-bearing. */
  shape?: RankShape
}) {
  const look: RankShape = shape ?? "plain"
  if (!rows?.length) return null

  return (
    <section className="flex flex-col [gap:var(--gap-inline)]">
      {heading ? (
        <h3 className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
          {heading}
        </h3>
      ) : null}
      <ol className="flex flex-col">
        {rows.map((r, i) => (
          <li
            key={i}
            className={
              // `plain` separates with a hairline because it has nothing else
              // to separate with. The other two have a badge or an avatar
              // starting each row, which does the separating on its own — a
              // rule under every one of those is a second answer to a question
              // already answered.
              look === "plain"
                ? "[border-bottom:var(--hairline)_solid_var(--border-subtle)] last:border-b-0"
                : ""
            }
          >
            <Row row={r} rank={i + 1} look={look} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function Row({ row, rank, look }: { row: RankRow; rank: number; look: RankShape }) {
  const body =
    look === "plain" ? (
      // A numbered statement. What a ranking looks like when it is read as
      // prose — which is right for a register built on rules and no fills.
      <span className="flex min-w-0 items-baseline [gap:var(--gap-inline)] [padding-block:calc(var(--pad-card)*0.55)]">
        <span className="tnum flex-none [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas-dim)]">
          {rank}
        </span>
        <span className="min-w-0 flex-1 truncate [font-size:var(--text-sm)]">{row.name}</span>
        {row.amount ? (
          <span className="tnum flex-none [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {row.amount}
          </span>
        ) : null}
      </span>
    ) : look === "badge" ? (
      // Ant Design Pro's shape: a filled disc for the top three, an outline for
      // the rest, the name, then the figure hard against the right edge.
      <span className="flex min-w-0 items-center [gap:var(--gap-inline)] [padding-block:calc(var(--pad-card)*0.5)]">
        <span
          aria-hidden
          className="tnum grid h-[21px] w-[21px] flex-none place-items-center rounded-full [font-size:11px] [font-weight:var(--fw-semibold)]"
          style={
            rank <= 3
              ? { background: MEDAL[rank - 1], color: "var(--color-on-dark)" }
              : {
                  border: "var(--hairline) solid var(--border)",
                  color: "var(--color-on-canvas-dim)",
                }
          }
        >
          {rank}
        </span>
        <span className="min-w-0 flex-1 truncate [font-size:var(--text-sm)]">{row.name}</span>
        {row.amount ? (
          <span className="tnum flex-none [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {row.amount}
          </span>
        ) : null}
      </span>
    ) : (
      // shadcn-admin's shape: initials, two lines, figure right. The only one
      // of the three that has somewhere to put `sub`, which is why `sub` is
      // kept in the data even when the shape cannot show it.
      <span className="flex min-w-0 items-center [gap:var(--gap-stack)] [padding-block:calc(var(--pad-card)*0.5)]">
        <Avatar name={typeof row.name === "string" ? row.name : String(rank)} size={34} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {row.name}
          </span>
          {row.sub ? (
            <span className="truncate [font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
              {row.sub}
            </span>
          ) : null}
        </span>
        {row.amount ? (
          <span className="tnum flex-none [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
            {row.amount}
          </span>
        ) : null}
      </span>
    )

  if (!row.href) return <span className="block">{body}</span>
  return (
    <Link
      href={row.href}
      className="block [border-radius:var(--radius-sm)] transition-colors [transition-duration:var(--dur-fast)] hover:[background:var(--color-ink-850)]"
    >
      {body}
    </Link>
  )
}
