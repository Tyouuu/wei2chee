// "use client" for the same reason hero-card.tsx carries it: an absent
// appearance prop means "follow the 版式", which is a React context lookup, and
// the saved customer page is rendered by Puck's <Render> on the SERVER.
"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { railIcon } from "./rail-icons"

/**
 * 指标排 — the row of figures a business owner reads before anything else.
 *
 * ── WHY THIS EXISTS WHEN hero-card.tsx ARGUES AGAINST IT ──────────────────
 *
 * HeroCard's own docblock says, and is right to say, that four tiles of
 * identical size state that four things matter equally and leave the reader to
 * work out which to look at first. That argument was made about a page that
 * had a hero AND a tile row competing. It was never an argument for a first
 * screen with one card on it.
 *
 * What was actually measured on 2026-08-25, by photographing eleven
 * competitors' dashboards and our own at the same viewport: they open with ten
 * to fourteen blocks and two to four charts, we open with three blocks and
 * none. The founder's reading of the same pictures: 「我们的风格跟模板都比外面
 * 那些人自己创建的差很多」 -- and the diagnosis was not the paint. Sixteen
 * registers are tuned to a tenth of a point and all of them render a page with
 * nothing on it.
 *
 * So the hierarchy argument survives and the emptiness gets fixed, by making
 * the hierarchy a VARIANT rather than a law. `lead` gives the first figure the
 * size HeroCard would have given it and demotes the rest to supporting counts;
 * `tinted`, `boxed` and `rule` are peer rows, for the registers and the trades
 * where four numbers really are peers -- a dealer reconciling four totals does
 * not have a "main" one.
 *
 * ── WHY IT CARRIES ITS OWN ICONS ──────────────────────────────────────────
 *
 * Of the six differences that were visible to the naked eye between our first
 * screen and theirs, the cheapest to close was icons: theirs carry one on every
 * nav row, every tile and every status; ours had two, both in the top-right
 * corner. `iconName` resolves through the same RAIL_ICONS registry the
 * navigation uses, so a tile and the page it points at can never drift apart,
 * and a name with no icon degrades to a text-only tile rather than throwing.
 *
 * ── WHY THE APPEARANCE PROPS HAVE NO DEFAULTS ─────────────────────────────
 *
 * `undefined` is how puck-config-client.tsx tells "the customer never chose"
 * from "the customer chose the thing that happens to be the default". A default
 * parameter here would make this component look identical in all sixteen
 * registers while appearing to be wired -- which is exactly the failure that
 * cost 315 register declarations before 2026-08-23.
 */

export type StatTile = {
  /** What the figure is. ReactNode so the editor can wrap it for in-page
   *  retyping, same as HeroCard's label. */
  label: ReactNode
  value: string
  /** Percent change against the previous period. Omit where there is no
   *  meaningful baseline -- see pctChange() in hero-card.tsx for when that is. */
  delta?: number | null
  /** What the change is measured against: 「比上月」. */
  deltaLabel?: string
  /** A figure that is bad news stays bad news whichever way it moved: money
   *  owed going UP is not growth. `tone` states the reading; `delta` only
   *  states the direction. */
  tone?: "normal" | "good" | "warn" | "bad"
  /** Resolved through RAIL_ICONS. A page key works: `payments`, `quotations`. */
  iconName?: string
  /** Where the tile takes you. A number an owner reacts to should be one press
   *  from the page they act on it in. */
  href?: string
  /** Trailing values, oldest first, drawn as a 52px sparkline. */
  spark?: number[]
  /**
   * LAST PERIOD'S FIGURE, already formatted.
   *
   * 老板 2026-09-02:「感觉不像模版的 就是没有改变多少」. Put side by side at
   * full size, the loudest difference in Studio Admin's KPI is not the size of
   * the number -- it is that every card carries a SECOND number under it:
   * 「$254,200 last month」. Four cards, four histories. Ours carried a
   * direction (↑13.2%) and no baseline, which tells you it moved and never
   * what it moved from.
   *
   * ⚠️ A STRING, AND ONLY WHERE IT IS REAL. It arrives formatted by whoever
   * formatted `value`, so this component never invents a currency or a
   * separator -- and a tile with no history simply omits it. Printing 「RM 0
   * last month」 under a figure whose history we do not have is the same defect
   * as a percentage nobody maintains (任务 40).
   */
  previous?: string
}

export type StatRowLayout = "tinted" | "boxed" | "rule" | "lead" | "chip" | "iconed"

// The VALUE only takes a colour when the colour is a reading of the figure and
// not a decoration. A headline total painted green says "up" -- which nothing
// here knows -- so `good` deliberately resolves to normal ink and lets the
// delta beside it carry the direction. Only the two figures that are bad news
// get a colour, because those are the ones an owner has to notice.
const TONE_FG: Record<string, string> = {
  good: "text-[color:var(--color-on-canvas)]",
  warn: "text-[color:var(--color-brass-bright)]",
  bad: "text-[color:var(--color-clay-bright)]",
  normal: "text-[color:var(--color-on-canvas)]",
}

export function StatRow({
  tiles,
  layout,
}: {
  tiles: StatTile[]
  /** No default — see the docblock. */
  layout?: StatRowLayout
}) {
  const look: StatRowLayout = layout ?? "tinted"
  if (!tiles?.length) return null

  // `lead` is the only layout whose first tile is a different SIZE, so it is
  // the only one that needs a non-uniform grid. Everything else is peers.
  // `lead` spends two column-units on the first tile, so a four-column grid
  // leaves the fourth tile stranded on a row of its own. Five units: 2 + 1+1+1.
  const cols =
    look === "lead"
      ? "grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-5"
      : tiles.length >= 4
        ? "grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-4"
        : tiles.length === 3
          ? "grid-cols-1 @2xl:grid-cols-3"
          : "grid-cols-1 @2xl:grid-cols-2"

  const gap = look === "rule" ? "gap-0" : "[gap:var(--gap-stack)]"

  return (
    <div
      className={`grid ${cols} ${gap} ${
        look === "rule"
          ? "[border-top:var(--hairline)] [border-bottom:var(--hairline)] [border-color:var(--border-subtle)]"
          : ""
      }`}
    >
      {tiles.map((t, i) => (
        <Tile key={i} tile={t} look={look} lead={look === "lead" && i === 0} first={i === 0} />
      ))}
    </div>
  )
}

function Tile({
  tile,
  look,
  lead,
  first,
}: {
  tile: StatTile
  look: StatRowLayout
  lead: boolean
  first: boolean
}) {
  const icon = tile.iconName ? railIcon(tile.iconName, "h-[15px] w-[15px]") : null

  // Each layout is a different CONTAINER, which is the whole point of the axis:
  // a register that has no shadows must not be handed a raised tile, and one
  // with no borders must not be handed a boxed one.
  const shell =
    look === "rule"
      ? `[padding:var(--pad-card)] ${first ? "" : "@2xl:[border-left:var(--hairline)] @2xl:[border-color:var(--border-subtle)]"}`
      : look === "boxed" || look === "iconed"
        ? "[background:var(--card)] [border:var(--border-card-width)_solid_var(--border)] [border-radius:var(--radius)] [padding:var(--pad-card)]"
        : "[background:var(--card)] [border-radius:var(--radius)] [padding:var(--pad-card)] [box-shadow:var(--shadow-card)] [border:var(--border-card-width)_solid_var(--border-subtle)]"

  const span = lead ? "@2xl:col-span-2 @5xl:col-span-2" : ""
  /* 🔴 WAS --text-title, WHICH IS THE PAGE HEADING'S OWN TOKEN.
     Measured 2026-09-02 against Studio Admin: their biggest text is a figure
     at 36px, ours was the word 「Overview」 at 21px, and the number tied with
     it. See any register token file for the full note. --text-stat is the rung
     between title and hero; the fallback keeps a register that has not
     declared one rendering exactly as before rather than collapsing. */
  const valueSize = lead ? "var(--text-hero)" : "var(--text-stat, var(--text-title))"

  return (
    <Wrap href={tile.href} className={`min-w-0 ${shell} ${span}`}>
      {/* 🔴 `iconed` 的图标**自己一行**，在标签上面（2026-09-03 放大两倍量的）。
          TailAdmin 的卡片是：一个 48px 的灰底圆角方块装图标 → 底下一行标签 →
          再底下一行「大数字靠左、涨跌药丸靠右」。其余四个版面的图标是**跟标签
          同一行的一颗小方块**，那是另一种东西。
          ⚠️ 底色用中性的 `--color-ink-850`，不用主色 —— 招牌的主色是那个红，
          四张卡各挂一个红方块，等於把[任务 100c](../../docs/founder-tasks.md)
          刚压下去的有色面积再加回来。TailAdmin 自己那四个也是灰的。 */}
      {look === "iconed" && icon ? (
        <span
          className="mb-3 grid h-11 w-11 place-items-center [background:var(--color-ink-850)] [border-radius:var(--radius-sm)] text-[color:var(--color-paper-dim)]"
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <div className="flex items-center [gap:var(--gap-inline)]">
        {/* The tinted square is what makes a tile read as a tile at a glance
            rather than as a paragraph that happens to contain a number. It is
            skipped on `rule` and `boxed`, whose registers have no tint to
            spend — Ledger and Swiss put weight in the rule and the label. */}
        {/* 🔴 `chip` 也不画（2026-09-03）。Studio Admin 的四张 KPI 卡
            **一个图标都没有** —— 右上角只有一个灰色的 ↗，标签自己占一整行。
            我们画的是一个上了主色的方块，四张卡就是四块颜色，
            而瑞士的主色是玫瑰色 —— 那正好是[任务 100c](../../docs/founder-tasks.md)
            刚压下去的有色面积。 */}
        {icon && look !== "rule" && look !== "boxed" && look !== "iconed" && look !== "chip" ? (
          <span
            className="grid h-[30px] w-[30px] flex-none place-items-center [border-radius:var(--radius-sm)] [background:var(--color-primary-soft)] text-[color:var(--color-primary)]"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        {/*
          IT WRAPS, IT DOES NOT TRUNCATE.

          Screenshotted across all sixteen registers on 2026-08-26: the
          uppercase registers printed 「CONFIRMED JOBS TH…」 and 「QUOTES
          AWAITING R…」 on 印 and 仪表盘. A KPI whose label is an ellipsis has
          stopped telling you what the number is, which is the only job the
          label has. Small caps make the same words about a fifth wider, so it
          is exactly the registers that dress the label up that cut it off.

          Two lines and then it clips -- `line-clamp` rather than free wrapping,
          because a four-line label in a 130px tile pushes the figure out of the
          row and the figure is the point.
        */}
        {/* 🔴 `chip` 不套小型大写（2026-09-02）。
            这个版面是照 arhamkhnz 那一套量出来的，而他们的卡片标签是
            **普通大小写、正常字级、一行**：「Lead Pipeline Value」。
            套上小型大写之后同样的字宽了两成，「CONFIRMED JOBS THIS MONTH」
            折成两行 —— 一个折了两行的全大写标签读起来是**资料库的栏名**，
            不是一张卡片的题目，而那正是「看起来不像模版」的一部分。
            其余四个版面照旧跟风格自己的 `--label-transform` 走。 */}
        <span
          className={`min-w-0 [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas-dim)] ${
            /* 🔴 `line-clamp-2`，不是 `truncate`（2026-09-03）。
               参考页的标签全部很短（Lead Pipeline Value · Customers），
               而**他自己那几句不短**：「Confirmed jobs this month」在这个宽度
               被切成「Confirmed jobs ...」。这个档案上面那段注解自己写着：
               一张卡的标签变成省略号，它就不再讲那个数字是什么了。
               折两行难看一点，切掉是错的。 */
            look === "chip" || look === "iconed"
              ? "line-clamp-2 [font-size:var(--text-sm)]"
              : "line-clamp-2 [font-size:var(--text-xs)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]"
          }`}
        >
          {tile.label}
        </span>
      </div>

      {/*
        THE FIGURE IS THE ONE THING ON THIS TILE THAT MAY NOT BE CUT.

        It read `truncate`, and in a narrow tile it did exactly that.
        Screenshotted on 炉 at 1440 and then measured: the value box was 64px
        holding 117px of text inside a 130px tile, so the dashboard's headline
        number printed as 「RM …」. A stat card whose statistic is an ellipsis is
        worse than no stat card.

        `flex-wrap` and `shrink-0` together are the fix: the number keeps its
        width and the sparkline drops to the next line when there is not enough
        room for both. The spark is the decoration; the figure is the point.
      */}
      <div
        className={`mt-2 flex flex-wrap items-baseline [gap:var(--gap-inline)] ${
          /* TailAdmin 把数字跟药丸推到两边 —— 数字靠左、涨跌靠右，
             中间那一段空白就是这张卡的呼吸。 */
          look === "iconed" ? "justify-between" : ""
        }`}
      >
        <span
          className={`tnum shrink-0 leading-none [font-weight:var(--fw-semibold)] ${TONE_FG[tile.tone ?? "normal"]}`}
          style={{ fontSize: valueSize }}
        >
          {tile.value}
        </span>
        {(look === "chip" || look === "iconed") && tile.delta != null ? (
          <DeltaPill pct={tile.delta} />
        ) : tile.spark && tile.spark.length > 1 ? (
          <Spark values={tile.spark} />
        ) : null}
      </div>

      {/*
        `chip` puts the change BESIDE the figure as a pill and leaves the words
        underneath on their own. Measured on
        arhamkhnz/next-shadcn-admin-dashboard on 2026-08-26: that is the whole
        difference between their KPI and everyone else's -- the number and its
        direction read as one object, and the sentence explaining it is a
        separate, quieter line. The other four layouts stack all three, which
        makes the direction a footnote to the figure rather than part of it.
      */}
      {(tile.delta != null || tile.deltaLabel) && look !== "chip" && look !== "iconed" && (
        <div className="mt-1.5 flex items-center [gap:var(--gap-inline)] [font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
          {tile.delta != null && <Delta pct={tile.delta} />}
          {tile.deltaLabel && <span className="truncate">{tile.deltaLabel}</span>}
        </div>
      )}
      {(look === "chip" || look === "iconed") && (tile.previous || tile.deltaLabel) && (
        <p className="mt-1.5 [font-size:var(--text-xs)] [line-height:var(--leading-body)] text-[color:var(--color-on-canvas-dim)]">
          {tile.previous ? (
            <>
              <span className="tnum [color:var(--color-on-canvas)] [font-weight:var(--fw-medium)]">
                {tile.previous}
              </span>{" "}
            </>
          ) : null}
          {tile.deltaLabel}
        </p>
      )}
    </Wrap>
  )
}

/** A tile with a destination is a link; one without is a div. Rendering a
 *  non-navigating <a> would hand the keyboard a stop that does nothing. */
function Wrap({
  href,
  className,
  children,
}: {
  href?: string
  className: string
  children: ReactNode
}) {
  if (!href) return <div className={className}>{children}</div>
  return (
    <Link href={href} className={`${className} block transition-[box-shadow,transform] [transition-duration:var(--dur-fast)] hover:[box-shadow:var(--shadow-raised)]`}>
      {children}
    </Link>
  )
}

/** Same three-state rule as HeroCard's Delta: a rounded 0.0% shown in green
 *  with an up arrow reads as growth when nothing moved. */
function Delta({ pct }: { pct: number }) {
  const r = Math.round(pct * 10) / 10
  const tone =
    r === 0
      ? "text-[color:var(--color-brass-bright)]"
      : r > 0
        ? "text-[color:var(--color-jade-bright)]"
        : "text-[color:var(--color-clay-bright)]"
  return (
    <span className={`tnum whitespace-nowrap [font-weight:var(--fw-semibold)] ${tone}`}>
      {r === 0 ? "→" : r > 0 ? "↑" : "↓"} {Math.abs(r).toFixed(1)}%
    </span>
  )
}

/**
 * The same reading, worn as a pill.
 *
 * `chip` is the only layout that fills the tone rather than colouring the text,
 * and it is the reason the register it belongs to can keep its chrome in plain
 * black ink: with the primary set to #141414, this pill is the ONLY colour on
 * the page, so it is also the only thing colour is saying anything about.
 *
 * Soft fill, not solid: a saturated green block beside a 30px figure competes
 * with the figure. Measured off the source at 2026-08-26 -- theirs is a tinted
 * capsule at roughly 12% of the hue.
 */
function DeltaPill({ pct }: { pct: number }) {
  const r = Math.round(pct * 10) / 10
  const [fg, bg] =
    r === 0
      ? ["var(--color-brass-bright)", "color-mix(in oklab, var(--color-brass-bright) 12%, transparent)"]
      : r > 0
        ? ["var(--color-jade-bright)", "color-mix(in oklab, var(--color-jade-bright) 12%, transparent)"]
        : ["var(--color-clay-bright)", "color-mix(in oklab, var(--color-clay-bright) 12%, transparent)"]
  return (
    <span
      className="tnum inline-flex shrink-0 items-center gap-1 whitespace-nowrap [border-radius:var(--radius-pill)] px-2 py-0.5 [font-size:var(--text-xs)] [font-weight:var(--fw-medium)]"
      style={{ color: fg, backgroundColor: bg }}
    >
      {r === 0 ? "→" : r > 0 ? "↗" : "↘"} {r > 0 ? "+" : ""}
      {r.toFixed(1)}%
    </span>
  )
}

/** Deliberately unlabelled and unaxised — a direction, not a readable chart.
 *  The full chart is its own block directly below this row. */
function Spark({ values }: { values: number[] }) {
  const W = 52
  const H = 16
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const d = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - lo) / span) * H}`)
    .join(" L ")
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-none overflow-visible" aria-hidden>
      <path d={`M ${d}`} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
