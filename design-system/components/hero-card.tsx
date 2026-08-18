import Link from "next/link"
import type { ReactNode } from "react"

// null means "no meaningful baseline" — callers must skip the change badge
// rather than render it.
//
// Two ways a baseline stops being meaningful. The prior period being 0 is
// the obvious one: the arithmetic is a divide by zero. The other case is
// subtler: a swing like "34,799 ↑ 840.5%" is arithmetically right and tells
// the reader nothing, because it's really a statement about how small the
// prior period was, not how big the current one is. Past a few hundred
// percent the number reads as a bug and the two absolute figures say it
// better; the caption beside the badge already names the period being
// compared, so dropping the badge loses nothing.
const MAX_MEANINGFUL_PCT = 300

export function pctChange(curr: number, prev: number): number | null {
  if (!prev) return null
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) >= MAX_MEANINGFUL_PCT) return null
  return pct
}

/**
 * One headline figure with its supporting numbers — a hero for whatever
 * page's whole reason for existing is "here is a number."
 *
 * It replaces a row of equal-weight KPI tiles. Four tiles of identical size
 * state that four things matter equally, which leaves the reader to work
 * out which one to look at first — NN/g's visual-hierarchy guidance is that
 * scale IS the signal for importance, and their guideline for complex
 * applications is to make important information salient by emphasizing it
 * *or by removing what isn't essential*. This does the second thing: one
 * clear figure with up to three supporting stats beneath it, rather than
 * several peers competing for the same first look. Stripe's dashboard home
 * opens the same way — one primary figure with supporting counts beneath
 * it, not a row of peers.
 *
 * Ported and generalized from a real client codebase's `hero-card.tsx`.
 */
export function HeroCard({
  label,
  value,
  chg,
  chgSuffix,
  stats,
  spark,
  sparkLabel,
  chart,
  footnote,
  header,
  flat,
  href,
}: {
  /** What the headline number is. Kept short — the number is the message. */
  label: string
  value: string
  /** Percent change vs the previous period. null = no meaningful baseline. */
  chg?: number | null
  /** e.g. "vs last month" — says what the change is measured against. */
  chgSuffix?: string
  /** The supporting figures. Deliberately capped at 3 in practice: past that
      this stops being a hierarchy and becomes the tile row again.
   *
   *  Optional, because a hero over a number small enough to count on one
   *  hand doesn't need one. A two-part breakdown restating the total as its
   *  own parts, under a headline figure that was already small, once
   *  doubled a card's height and pushed real content off the first screen —
   *  when the split fits in a short clause, it belongs in `chgSuffix`
   *  instead. */
  stats?: {
    label: string
    value: string
    href: string
    /** 'caution' is a warning tone ("expected, worth noticing"); 'warn' is
        a negative tone ("something is wrong"). A figure that's negative by
        design — a cost recognized before the matching revenue lands, say —
        must not read as an error every single period. */
    tone?: "normal" | "caution" | "warn"
    /** Percent change vs the prior period, shown small beside the value. */
    chg?: number | null
    /** One short line under the value — a caveat, not a second figure. */
    sub?: string
  }[]
  /** Trailing period-over-period values, oldest first. Omit where there's no series. */
  spark?: number[]
  sparkLabel?: string
  /** A real chart in place of the sparkline, for when the same series is
      already drawn in full elsewhere on the page and doesn't need to be
      drawn twice — once as this card's sparkline, once again as a full
      trend chart directly below it. */
  chart?: ReactNode
  /** Anything that needs to sit below the stats — an explanation the figures can't carry on their own. */
  footnote?: ReactNode
  /** Identity that belongs above the figure — who or what these numbers are about, when that isn't already established by the page around the card. */
  header?: ReactNode
  /** Drop the card treatment and sit directly on the page canvas as a plain band — for a hero that's the only thing on a dense dashboard, where four stacked bordered panels would be the actual problem. */
  flat?: boolean
  href: string
}) {
  return (
    <div
      className={
        flat
          ? "flex flex-col justify-between gap-5"
          : "flex flex-col justify-between gap-5 rounded-xl border p-5 shadow-sm [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
      }
    >
      {header && <div className="border-b pb-5 [border-color:var(--color-ink-800)]">{header}</div>}
      <div>
        <Link href={href} className="group inline-flex items-center gap-1.5">
          <span className="text-[13px] text-[color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)] group-hover:text-[color:var(--color-paper)]">
            {label}
          </span>
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* The one number the reader came for — 38px against 15px
              supporting figures below, a real step rather than a nudge.

              A leading non-numeric prefix (a currency symbol, a unit) is
              split out and set smaller/dimmer rather than left inline: at
              38px a full-width separator character between prefix and
              amount reads as a visible gap, invisible at the 15px these
              figures normally run at. Splitting it also puts the emphasis
              where it belongs — on the amount, not on what it's measured
              in. */}
          <span className="flex items-baseline gap-1.5 text-[color:var(--color-paper)]">
            {(() => {
              // The separator is \u00a0 (a non-breaking space). Written as
              // an escape rather than typed as the character itself: an
              // invisible byte inside a regex is a trap for whoever edits
              // this next.
              const m = /^([^\d.-]+)\u00a0(.+)$/.exec(value)
              if (!m) return <span className="tnum text-[38px] font-semibold leading-none tracking-tight">{value}</span>
              return (
                <>
                  <span className="text-[19px] leading-none text-[color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">{m[1]}</span>
                  <span className="tnum text-[38px] font-semibold leading-none tracking-tight">{m[2]}</span>
                </>
              )
            })()}
          </span>
          {chg != null && <Delta pct={chg} big />}
          {chgSuffix && <span className="text-[12px] text-[color:var(--color-paper-dim)]">{chgSuffix}</span>}
        </div>
      </div>

      {/* The sparkline stays tucked under the number it trails. A full
          chart doesn't belong in this same slot — it belongs below the
          stats that support the headline figure, not wedged between the
          figure and them, splitting one thought in half. */}
      {!chart && spark && spark.length > 1 && <Sparkline values={spark} label={sparkLabel} />}

      {/* No stats, no rule and no row — an empty grid under a hairline is a
          card that looks like it failed to load its second half. */}
      {(stats?.length || footnote) && (
        <div>
          {stats?.length ? (
            <div className="grid grid-cols-1 gap-3 border-t pt-4 [border-color:var(--color-ink-800)] sm:grid-cols-3">
              {stats.map((s) => (
                <Link key={s.label} href={s.href} className="group min-w-0">
                  <div className="truncate text-[12px] text-[color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">{s.label}</div>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span
                      className={`tnum truncate whitespace-nowrap text-[14px] [font-weight:var(--fw-semibold)] group-hover:underline ${
                        s.tone === "warn"
                          ? "text-[color:var(--color-clay-bright)]"
                          : s.tone === "caution"
                            ? "text-[color:var(--color-brass-bright)]"
                            : "text-[color:var(--color-paper)]"
                      }`}
                    >
                      {s.value}
                    </span>
                    {s.chg != null && <Delta pct={s.chg} />}
                  </div>
                  {s.sub && <div className="mt-0.5 text-[12px] leading-snug text-[color:var(--color-paper-dim)]">{s.sub}</div>}
                </Link>
              ))}
            </div>
          ) : null}
          {footnote && <div className="mt-3 text-[12px] leading-relaxed text-[color:var(--color-paper-dim)]">{footnote}</div>}
        </div>
      )}

      {chart}
    </div>
  )
}

// The three-state change badge, shared by the hero figure and its
// supporting stats. Rounding to one decimal means a real change of +0.04%
// displays as 0.0%, and showing that in green with an up arrow would read
// as growth when nothing moved — hence a neutral third state rather than a
// binary up/down.
function Delta({ pct, big = false }: { pct: number; big?: boolean }) {
  const r = Math.round(pct * 10) / 10
  const tone = r === 0 ? "[color:var(--color-brass-bright)]" : r > 0 ? "[color:var(--color-jade-bright)]" : "[color:var(--color-clay-bright)]"
  return (
    <span className={`tnum ${tone} [font-weight:var(--fw-semibold)] ${big ? "" : "text-[12px]"}`}>
      {r === 0 ? "→" : r > 0 ? "↑" : "↓"} {Math.abs(r).toFixed(1)}%
    </span>
  )
}

// A headline number says where you are; a shape says where you're heading.
// Deliberately unlabeled and unaxised — it's a direction, not a readable
// chart. A full chart with hover figures belongs elsewhere on the page when
// one is needed at all.
function Sparkline({ values, label }: { values: number[]; label?: string }) {
  const W = 100
  const H = 22
  const max = Math.max(...values)
  const min = Math.min(...values)

  // Nothing at all is not the same as nothing changed. A flat run of zeros
  // renders a dead-straight rule the full width of the card — several of
  // those stacked down a page reads as a set of stray horizontal lines
  // rather than as charts. A trend line implies there is a trend; when
  // every point is zero there's no history yet, and the honest thing is to
  // draw nothing. (A flat series that is *not* zero still draws — that
  // genuinely is "nothing changed," which is worth showing.)
  if (values.every((v) => v === 0)) return null

  // A flat series would divide by zero and collapse every point onto y=0.
  const span = max - min || 1
  const pt = (v: number, i: number) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / span) * (H - 2) - 1
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }
  const line = values.map(pt).join(" ")
  const area = `0,${H} ${line} ${W},${H}`
  const rising = values[values.length - 1] >= values[0]
  const stroke = rising ? "var(--color-jade)" : "var(--color-clay)"

  return (
    <div className="mt-1">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-10 w-full" role="img" aria-label={label ?? "Trend"}>
        <polygon points={area} fill={stroke} opacity="0.10" />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {label && <p className="mt-1.5 text-[12px] text-[color:var(--color-paper-dim)]">{label}</p>}
    </div>
  )
}
