// "use client" BECAUSE THIS COMPONENT NOW READS THE REGISTER. An absent variant
// prop means "follow the 版式", which is a React context lookup, and a context
// cannot be read from a server component. The portal's page route renders Puck's
// <Render> on the SERVER -- the editor is a client tree, but the saved page is
// not -- so without this the first paint of every customer page threw. Nothing
// else here needs the client; the props are all serialisable data.
"use client"

import { Fragment, useState, type CSSProperties } from "react"
import { useRegisterProp } from "@/design-system/editor/style-scope"
import { DataGrid } from "./data-grid"
import { useSystemWords } from "@/design-system/system-lang-context"
import { Avatar } from "@/design-system/components/avatar"
import { CheckCircle2, CircleDashed, CircleOff, Timer } from "lucide-react"
import { StatusDot, type StatusTone } from "./status-dot"
import { normalizeTable, type ColumnKind, type TableModel } from "@/lib/portal/table-model"

export type { TableModel }

/**
 * A real, Puck-friendly data table for business records (quotations,
 * customers, payments) — sits on top of `DataGrid` (a scroll-viewport
 * wrapper, not a table itself) and `StatusDot` (already registered), rather
 * than reinventing either.
 *
 * COLUMNS ARE DATA, NOT PROPS. This component used to take four fixed label
 * props, which made the column COUNT part of its type: a customer could rename
 * 「金额」 and never add 「负责的师傅」, and the assistant had to refuse the
 * request because no operation could express it. `table` is now
 * `{ columns, rows }` and everything here is driven by that array — see
 * lib/portal/table-model.ts for the shape and for why the old four props are
 * still readable rather than migrated in SQL.
 *
 * The legacy props are accepted and normalised here as well as on load, so a
 * layout that reaches this component through a path that forgot to upgrade it
 * (a preview, a cached draft) still renders the customer's real data instead of
 * an empty table.
 *
 * DENSITY: every measurement here comes from the style's own axis tokens
 * rather than a Tailwind literal, so the same table renders as a tight
 * 32px-row ops grid under Ledger and a 52px-row airy list under Hearth. A
 * table is where a register's density is most visible, so this is the one
 * component where getting it from tokens matters most.
 */

/** Per-kind width contribution to the table's minimum. A name needs more room
 *  than a status pill, and a table that has grown to seven columns must scroll
 *  rather than compress every column into unreadability — which is what
 *  DataGrid's scroll viewport and edge shadow exist for. */
const KIND_MIN: Record<ColumnKind, number> = {
  text: 130,
  detail: 120,
  amount: 95,
  status: 95,
}

export function RecordTable(props: {
  gridId: string
  caption: string
  table?: TableModel
  /** Legacy four-column shape. Still read (see table-model.ts) so no saved
   *  layout can render blank; never written by anything current. */
  primaryLabel?: string
  secondaryLabel?: string
  amountLabel?: string
  statusColumnLabel?: string
  rows?: unknown[]
  /** Set by the 换个款式 picker. `plain` is a rule between rows; `compact`
   *  is the same table at three-quarter height for a page that has to show
   *  twenty jobs rather than five; `zebra` is the banded look every business
   *  owner already reads in Excel; `grid` rules the columns as well, for a
   *  table that is being copied from or checked against paper. */
  look?: "plain" | "compact" | "zebra" | "grid" | "cards"
  /**
   * WHAT A ROW CONTAINS -- a second, independent axis.
   *
   * `look` says how rows are SEPARATED (a rule, a band, column lines, less
   * height). Measured on 2026-08-25, eight of eighteen registers chose `plain`
   * on it, because separation is a small question and most briefs have no
   * opinion. This axis asks a different one and gets different answers: a
   * status can be a dot with a word beside it or a filled pill, and a person
   * can be a name or a name with a face.
   *
   * Both of the dashboards the founder sent that day differ from us here and
   * not on separation -- shadcn-admin puts an initials circle on every row of
   * Recent Sales, Ant Design Pro puts a filled badge on every status.
   */
  row?: "plain" | "pill" | "avatar"
  /**
   * 一组一张表 —— 出处 arhamkhnz 的 `infrastructure`：每一个专案自己一个
   * 标题、自己一段表身，而不是一整张平表配一个「专案」栏。
   *
   * 分的是**说明那一栏**（`kind: "detail"`）。对帐那一页那一栏是上游是谁
   * （哪一家银行、哪一个电信商），而一个经销商每个月要跟三家对 ——
   * 三家的数字混在一张表里，他要用眼睛自己分组。
   *
   * ⚠️ **只有两组以上才分。** 一组的时候画一个组标题，就是在一张表上面
   * 加一行没有作用的字 —— 跟那一排只有一个选项的分段是同一个毛病
   * （见 `segments`）。
   */
  grouped?: boolean
  /**
   * Segment labels shown above the table, after an "All" the component adds
   * itself. Empty or absent means no segment row, which is right for a table
   * that is already the whole of its page.
   *
   * 🔴 **它们是真的会筛的**（2026-09-03）。在这之前它们是一排 `<span>` ——
   * 长得完全像一个分段控件，按下去什么都不会发生，而它画在**每一张表**上。
   * 这个档案自己在底下三十行的地方写着：
   * 「一个什么都不做的框是缺陷，不是装饰」——搜索框照做了，这一排没有。
   *
   * 筛的是**状态那一栏**（`kind: "status"`），因为分段讲的就是状态；
   * 跟搜索框叠加，而且**上面那个条数跟着一起变** ——
   * 一个写着「7 records」的标题压在两行上面，是另一个方向的同一句谎。
   */
  filters?: string[]
  /**
   * 「这张清单上有哪几种状态」自己算出来，而不是有人写进去。
   *
   * 🔴 这一根轴存在是因为写进去的那一种会说谎。产生页面的那一层只看得到
   * **示例资料**，而客户第一笔真记录一进来示例就整批消失（8-30 他自己定的）
   * —— 於是一排照示例状态刻出来的分段，会在他自己的资料上一格都筛不到，
   * 而它长得跟一排会筛的一模一样。任务 111 记着的那个
   * 「FILTERED BY 状态：等回覆 ×」就是同一个形状。
   * `live-rows.ts` 从来不碰 `filters`，所以那份清单没有人会去更新。
   *
   * 自己算就永远对得上：示例的时候是示例的状态，真资料的时候是他自己的状态。
   *
   * ⚠️ **两个条件都要满足才画**，不然它不是筛选是杂讯：
   *   ① 至少有一种状态**出现不止一次** —— 每一行都是自己一格的时候，
   *      那一排分段只是把这张表又抄了一遍（実测：美容那七行是七种状态）
   *   ② 不超过六格 —— 参考那一页是四个下拉，一排八格会自己折行
   */
  segments?: boolean
  /**
   * THE TABLE'S OWN FURNITURE -- a third axis, and the one shadcn's task table
   * is entirely made of.
   *
   * 老板 2026-09-02:「重点去复刻就可以了」. Photographed the same week, their
   * page is a title, a TOOLBAR and one table -- no stat cards, no chart. The
   * toolbar is the design: a field you type into, the segments beside it, the
   * count following what you typed.
   *
   * `chips`  the segment row we already had, sharing the caption's line
   * `search` the toolbar on its OWN row: a working field + the segments
   * `none`   caption and count only
   *
   * ⚠️ **The field really filters.** 任务 15 killed a ⌘K for being a search box
   * that searched nothing, and 任务 94 found a filter chip claiming a list was
   * filtered when it was not. A box that does nothing is the defect, not the
   * decoration. Rows are already an array on this side, so filtering them is
   * one `.filter()` -- there was never a reason for it to be inert.
   *
   * ⚠️ And the count follows the filter. A heading that says 「3 records」 over
   * one visible row is the same lie in the other direction.
   */
  tools?: "chips" | "search" | "none" | "inline"
  /**
   * 这一张清单上的第一栏是**一个人（或一家店）**，不是一件事。
   *
   * 🔴 这不是一根版式轴，所以它不问 register。参考那一页（Studio Admin 的
   * Users）每一行左边有一颗头像，而**同一行照样有状态药丸** —— 我们本来的
   * `row: "avatar"` 一个 prop 管两件事：它把头像画在**联络那一格**旁边，
   * 而且顺手把状态从药丸降成一个圆点。这个仓库为「两根轴共用一个键」
   * 栽过两次，注解就写在上面三十行。
   *
   * 所以头像跟着**资料**走：一张名册的第一栏是一个名字，一张报价单的第一栏
   * 是一件工程 —— 那是关於这张表在讲什么，不是关於它好不好看。
   */
  faces?: boolean
}) {
  const { gridId, caption, look, row, filters: given, tools, faces, segments, grouped } = props
  const w = useSystemWords()
  // Absent means "follow the register", not "plain" -- see style-scope.tsx.
  /*
    THE HOOK IS CALLED UNCONDITIONALLY, THE FALLBACK IS APPLIED AFTER.

    This read `prop ?? useRegisterProp(...) ?? default` on one line, which is
    the precedence rule stated exactly right and executed exactly wrong: `??`
    SHORT-CIRCUITS, so when the customer's own prop is present the hook is
    never called. useRegisterVariant is useContext + useMemo -- two hook slots
    -- so the number of hooks this component calls changed with its props.
    React matches hooks positionally, so that is either "rendered fewer hooks
    than expected" or, worse, a memo silently read from the wrong slot; in
    RecordTable, where there were TWO of these in a row, the second could take
    the first one's place.

    Splitting the line changes no semantics -- the hook is pure and its result
    is still the middle term of the same precedence chain -- and it makes the
    hook count constant. Found by `npm run lint`, which had never once run:
    there was no eslint config in the repository, so `react-hooks/rules-of-hooks`
    has been switched off for this codebase's entire life.
  */
  const lookPref = useRegisterProp<"plain" | "compact" | "zebra" | "grid" | "cards">("RecordTable", "look")
  const shown = look ?? lookPref ?? "plain"
  // "RecordTableRow", NOT "RecordTable". A register's preference is a VARIANT
  // ID, and the id is looked up in VARIANTS under the same key -- so two axes
  // on one component need two keys, or the second silently reads the first
  // one's props and finds nothing. This is the same class of failure as the
  // 315 preferences that reached nothing before 2026-08-23, and it is silent
  // in exactly the same way: the table renders, it just renders the default.
  const rowPref = useRegisterProp<"plain" | "pill" | "avatar" | "mark">("RecordTableRow", "row")
  const rowShape = row ?? rowPref ?? "plain"
  /* A THIRD KEY, not a third read of "RecordTable". The comment above says why:
     a register's preference is looked up under the axis name, so two axes on
     one component sharing a key means the second silently finds nothing. */
  const toolsPref = useRegisterProp<"chips" | "search" | "none" | "inline">("RecordTableTools", "tools")
  const toolShape = tools ?? toolsPref ?? "chips"

  const [query, setQuery] = useState("")
  const { columns, rows: allRows } = normalizeTable(props as unknown as Record<string, unknown>)
  /* 没有包 useMemo，这是故意的：React Compiler 报
     `Existing memoization could not be preserved` —— 它看不出
     `normalizeTable(props)` 回来的阵列不会被改，所以整个组件被跳过不优化。
     一张表就那几十行，一次 filter 的成本远低于「让整个组件失去自动优化」。
     手写的 memo 换掉编译器的 memo，是这里最贵的一笔交易。 */
  /** 选中的那一段。`null` 是「全部」—— 组件自己加的那一格。 */
  const [seg, setSeg] = useState<string | null>(null)
  /** 状态是哪一栏。分段讲的是状态，所以按栏的**种类**找，不是按栏名找
   *  —— 栏名是老板自己取的，他随时可以改成「到哪一步」。 */
  const statusKey = columns.find((c) => c.kind === "status")?.key
  /* 一组一张表。分的是说明那一栏，而且**两组以上才分** ——
     见 `grouped`。顺序照第一次出现，不重排：一张突然自己换过顺序的表，
     读起来像资料变了。 */
  const groupKey = columns.find((c) => c.kind === "detail")?.key
  /* 明确写进来的赢 —— 总览那一张是有人挑过的。其余的自己算，见上面 `segments`。 */
  const filters = given?.length ? given : segments ? autoSegments(allRows, statusKey) : undefined
  /* 手机上那一行读的是**同一份 `columns`**：第一栏当标题、金额靠右、
     状态在第二行右边、其余的用「·」串成第二行。客户自己加一栏，
     它自己会出现，不用有人回来改这里。 */
  const phoneTitle =
    columns.find((c) => c.key === "primary") ??
    columns.find((c) => c.kind !== "status" && c.kind !== "amount") ??
    columns[0]
  const phoneAmount = columns.find((c) => c.kind === "amount")
  const phoneRest = columns.filter(
    (c) => c.key !== phoneTitle?.key && c.kind !== "amount" && c.kind !== "status",
  )

  const q = query.trim().toLowerCase()
  const searched =
    q && toolShape === "search"
      ? allRows.filter((r) =>
          Object.values(r.cells ?? {}).join(" ").toLowerCase().includes(q),
        )
      : allRows
  const filtered =
    seg && statusKey
      ? searched.filter((r) =>
          String(r.cells?.[statusKey] ?? "").toLowerCase().includes(seg.toLowerCase()),
        )
      : searched

  /* ── 点栏头排序 ──────────────────────────────────────────────────────────
     `align:admin` 2026-09-02：**参考那一页四栏可以点着排，我们零栏。**
     一个每天扫四十行的承包商，第一个动作就是「哪一单钱最大」「哪一单最久没动」，
     而在这之前他只能自己用眼睛找。

     ⚠️ **金额要按数字排，不是按字排。** 「RM 9,600」跟「RM 48,500」照字排的话
     9 排在 4 后面 —— 一张把最大那一单排到最下面的表，比不能排更糟。
     金额那一栏在 `table-model` 里本来就标着 kind，直接用它。

     ⚠️ 不排就是**他自己的顺序**，那是有意义的顺序（最近的在上面），
     所以第三下点回「不排」，不是在两个方向之间来回。 */
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const numeric = (v: string) => {
    const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""))
    return Number.isFinite(n) ? n : null
  }
  const rows = (() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return filtered
    const sign = sort.dir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const x = String(a.cells?.[sort.key] ?? "")
      const y = String(b.cells?.[sort.key] ?? "")
      if (col.kind === "amount") {
        const nx = numeric(x), ny = numeric(y)
        if (nx !== null && ny !== null) return (nx - ny) * sign
      }
      return x.localeCompare(y, undefined, { numeric: true }) * sign
    })
  })()
  const nextSort = (key: string) =>
    setSort((s) =>
      !s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null,
    )

  /* ── 一组一张表 ────────────────────────────────────────────────────────
     出处 arhamkhnz 的 `infrastructure`：每一个专案自己一个标题、自己一段表身。

     ⚠️ **两组以上才分。** 一组的时候画一个组标题，就是在一张表上面加一行
     没有作用的字 —— 跟那一排只有一个选项的分段是同一个毛病。
     顺序照第一次出现，不重排：一张突然自己换过顺序的表，读起来像资料变了。 */
  const groups = (() => {
    const flat = [{ label: null as string | null, rows: rows.map((row, i) => ({ row, i })) }]
    if (!grouped || !groupKey) return flat
    const by = new Map<string, { row: (typeof rows)[number]; i: number }[]>()
    rows.forEach((row, i) => {
      const key = String(row.cells?.[groupKey] ?? "").trim()
      if (!by.has(key)) by.set(key, [])
      by.get(key)!.push({ row, i })
    })
    if (by.size < 2) return flat
    return [...by.entries()].map(([label, rs]) => ({ label, rows: rs }))
  })()

  // Column heads carry the register's label voice: SMALL CAPS WITH WIDE
  // TRACKING under Ledger (--label-transform: uppercase), plain sentence case
  // under Hearth and Blueprint (--label-transform: none). Applying both tokens
  // unconditionally is correct — each style's own value decides the outcome.
  const headCell =
    "border-b text-left align-middle [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)] " +
    // The head's colours come from tokens rather than from a hard-coded pair,
    // so a register can fill the band instead of ruling it. Seven of the eight
    // declare the same values this used to hard-code, so nothing moved; 印头
    // fills it. See design-system/tokens/stamp.css.
    "[border-color:var(--color-ink-800)] [color:var(--color-table-head-fg)] " +
    "[font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] " +
    "[letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]"

  const bodyCell =
    "align-middle [padding-inline:var(--pad-cell-x)] " +
    "[padding-block:var(--row-pad-y,var(--pad-cell-y))] [height:var(--row-height,var(--row-h))]" +
    // Column rules stop before the last cell, or the table grows a right-hand
    // border that does not line up with the card edge behind it.
    (shown === "grid" ? " [&:not(:last-child)]:border-r [&:not(:last-child)]:[border-color:var(--color-ink-800)]" : "")

  // Computed, not the old flat 440 — but tuned so the DEFAULT four columns
  // still add up to exactly that. The narrowest real case is the editor with a
  // side panel open: a 1440px window gives the canvas 782, the customer's own
  // rail takes 228 and the shell's padding another 48, leaving ~460px for the
  // table. Four columns fit that; a fifth the customer added cannot, and must
  // widen the table and scroll — silently squeezing 状态 in half is the exact
  // defect that has already been fixed twice by widening things.
  const minWidth = columns.reduce((w, c) => w + KIND_MIN[c.kind], 0)

  return (
    <div className="flex flex-col [gap:var(--gap-inline)]">
      {/* THE TABLE'S HEADING, WHICH UNTIL 2026-08-25 NOBODY COULD SEE.
          `caption` was passed straight into DataGrid as an accessible name and
          rendered nowhere, so every table in every register shipped with no
          title, no count and no filters — while all eleven competitors
          photographed that day carry a heading, a total and a segment row
          above theirs. It was the cheapest missing thing on the page: the
          string was already being computed and already being passed in.

          The count is derived, never given: a caller who passes a number and a
          list can disagree with itself, and it is the list that is on screen. */}
      {/* 🔴 `inline` —— 表名 · 条数 · 搜索 · 分段**全部同一行**（2026-09-05）。
          出处 arhamkhnz 的 `users` 那一页：搜索跟四颗按钮在标题那一行，
          而我们本来是「表名 ＋ 条数」一行、「搜索 ＋ 分段」再一行。省一行。

          ⚠️ **第一版把表名整个藏掉了**（参考那一页确实没有第二个标题），
          而 `site-fields.test.tsx` 当场红：`customers/RecordTable.caption`
          变成一个**存得住、画不出来**的字段 —— 那是这个仓库最核心的那条守卫，
          不可以为了少一个重复的字去弱化它。表名留着，只是搬上来。 */}
      {toolShape === "inline" ? (
        <div className="flex flex-wrap items-center [gap:var(--gap-inline)]">
          <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {caption}
          </span>
          <span className="tnum [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
            {w.rowCount(rows.length)}
          </span>
          <SearchField value={query} onChange={setQuery} label={w.tableSearch} />
          {filters?.length ? (
            <Segments filters={filters} all={w.filterAll} picked={seg} onPick={setSeg} />
          ) : null}
        </div>
      ) : (
      <div className="flex flex-wrap items-center [gap:var(--gap-inline)]">
        <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
          {caption}
        </span>
        <span className="tnum [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
          {w.rowCount(rows.length)}
        </span>
        {toolShape === "chips" && filters?.length ? (
          <Segments filters={filters} all={w.filterAll} picked={seg} onPick={setSeg} />
        ) : null}
      </div>
      )}

      {/* THE TOOLBAR, ON ITS OWN LINE. shadcn's task table puts the field and
          the segments under the heading rather than beside it, and that one
          decision is most of why theirs reads as a tool and ours read as a
          caption: a control sharing a line with a title is an ornament on the
          title; a control on its own line is a place to work. */}
      {toolShape === "search" ? (
        <div className="flex flex-wrap items-center [gap:var(--gap-inline)]">
          <SearchField value={query} onChange={setQuery} label={w.tableSearch} />
          {filters?.length ? (
            <Segments filters={filters} all={w.filterAll} picked={seg} onPick={setSeg} />
          ) : null}
        </div>
      ) : null}

      {/* `revealEndWhen`: adding a column in a 460px-wide canvas puts the new
          column past the right edge, so the customer's own action appeared to do
          nothing. The grid scrolls to show it. Measured, not assumed — this was
          visible in the first browser check of the column editor. */}
      {/* ─────────────────────────────────────────────────────────────────
          手机上一行一笔，不是一张表。

          老板 2026-09-04：`就是在手机看表格还是很难的东西`。他讲对了，
          而 Apple 自己的指南就是这么写的（`Lists and tables`，原文）：

            「**Keep item text succinct so row content is comfortable to read.**
             … If each item consists of a large amount of text, consider
             alternatives that help you avoid displaying over-large table rows.
             For example, **you could list item titles only, letting people
             choose an item to reveal its content in a detail view.**」
            「**Consider ways to preserve readability of text that might
             otherwise get clipped or truncated.**」

          而它讲多栏表格的地方，配的全部是**桌面才有的东西**：可以拉宽的栏、
          隔行底色、点栏头排序 —— 那三样在 390px 上一样都没有。

          实拍的两个同行也是同一个形状（`.screenshots/appui/`）：
          · **ServiceM8**：左边一颗状态圆点 · 时间粗体 · 客户 · 一行小灰字，单号靠右
          · **QuickBooks**：名字加一行小灰字，金额靠右 —— 而它唯一画成表格的
            那一屏是**报表**，不是记录清单

          ⚠️ **这一行是同一份栏位投影出来的，不是第二份手写清单。**
          客户自己加一栏，它自己会出现在第二行 —— 这个仓库栽在
          「第二份手写拷贝」上至少六次。 */}
      {rows.length > 0 ? (
        <ul className="flex flex-col @3xl:hidden">
          {rows.map((row, i) => {
            const title = String(row.cells?.[phoneTitle.key] ?? "")
            const amount = phoneAmount ? String(row.cells?.[phoneAmount.key] ?? "") : ""
            const status = statusKey ? String(row.cells?.[statusKey] ?? "") : ""
            const tone = (statusKey ? row.tones?.[statusKey] : undefined) as StatusTone | undefined
            const rest = phoneRest
              .map((c) => String(row.cells?.[c.key] ?? "").trim())
              .filter(Boolean)
              .join(" · ")
            const body = (
              <>
                <span className="flex items-baseline [gap:var(--gap-inline)]">
                  {/* 标题一行到底，装不下就切 —— Apple 那一条讲的就是这个。
                      切掉的部分点进去看得到，而一个折成三行的标题会把
                      每一笔的高度撑到不一样，清单就扫不动了。 */}
                  <span className="min-w-0 flex-1 truncate [color:var(--color-paper)] [font-weight:var(--fw-medium)]">
                    {title}
                  </span>
                  {amount ? (
                    <span className="shrink-0 whitespace-nowrap tabular-nums [color:var(--color-paper)] [font-family:var(--font-numeric)]">
                      {amount}
                    </span>
                  ) : null}
                </span>
                {rest || status ? (
                  <span className="flex items-center [gap:var(--gap-inline)] [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
                    <span className="min-w-0 flex-1 truncate">{rest}</span>
                    {status ? (
                      <span className="shrink-0">
                        <StatusDot tone={tone ?? "neutral"} label={status} />
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </>
            )
            /* 整行都点得到 —— 一个拇指按不准一句字里的那几个字。
               ⚠️ 跟表格那边同一条规矩：只有真的记录有 `href`，
               示例资料没有，所以画廊跟纸上它照样是死的。 */
            return (
              <li
                key={i}
                className="[&:not(:last-child)]:border-b [&:not(:last-child)]:[border-color:var(--color-ink-800)]"
              >
                {row.href ? (
                  <a
                    href={row.href}
                    className="flex min-h-14 flex-col justify-center [gap:2px] [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)]"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="flex min-h-14 flex-col justify-center [gap:2px] [padding-inline:var(--pad-cell-x)] [padding-block:var(--pad-cell-y)]">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────────
          一片格子，不是一张表。

          老板 2026-09-05：`我不要一直都是同个组件`。量出来他讲的是真的：
          **十七页里有十六页画的是这一张表**，而其中十一页的骨架
          一个字都不差 —— 标题 → 筛一下 → 一张表。

          🔴 而修法不是再造一个新零件。同一批行、同一个搜索、同一排分段，
          换一个**形状**就够了 —— 这正是这套系统本来就有的那根轴
          （register 挑每一块长什么样，见 design-doc.ts）。
          再造一个零件要再接一次投影、再写一次筛选、再验一次手机，
          而那三样这里都已经是对的。

          抄的是参考那一套的 `file-manager`（`.screenshots/upstream/`）：
          **每一件东西一张卡，名字在上、那个数字大、一行小字在底下**。
          一间五金店的老板扫的是「架上还有几包」，不是一行一行读四栏字。

          ⚠️ 一样东西都没有多画：第一栏当名字、金额那一栏当那个大数字、
          状态画成一颗药丸、其余的用「·」串成底下那一行 ——
          **跟手机那一行读的是同一份 `columns`**。客户自己加一栏，
          它自己会出现，不用有人回来改这里。 */}
      {shown === "cards" && rows.length > 0 ? (
        <div className="hidden grid-cols-2 @3xl:grid @5xl:grid-cols-3 @7xl:grid-cols-4 [gap:var(--gap-inline)]">
          {rows.map((row, i) => {
            const title = String(row.cells?.[phoneTitle.key] ?? "")
            const amount = phoneAmount ? String(row.cells?.[phoneAmount.key] ?? "") : ""
            const status = statusKey ? String(row.cells?.[statusKey] ?? "") : ""
            const tone = (statusKey ? row.tones?.[statusKey] : undefined) as StatusTone | undefined
            const rest = phoneRest
              .map((c) => String(row.cells?.[c.key] ?? "").trim())
              .filter(Boolean)
              .join(" · ")
            return (
              <div
                key={i}
                className="flex flex-col [gap:var(--gap-inline)] [background:var(--color-table-bg)] [border:var(--border-card-width)_solid_var(--border)] [border-radius:var(--radius-card)] [padding:var(--pad-card)]"
              >
                <span className="truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                  {title}
                </span>
                {amount ? (
                  /* 那个数字是这张卡的主角，所以它比标题大 ——
                     跟 `stat-row` 那一条同一个道理（见 stat-outranks-heading）。 */
                  <span className="tnum [color:var(--color-paper)] [font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] [line-height:1.1]">
                    {amount}
                  </span>
                ) : null}
                <span className="flex flex-wrap items-center [gap:var(--gap-inline)]">
                  {status ? <StatusDot tone={tone ?? "neutral"} label={status} /> : null}
                  {rest ? (
                    <span className="min-w-0 flex-1 truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                      {rest}
                    </span>
                  ) : null}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className={rows.length > 0 && shown !== "cards" ? "hidden @3xl:block" : shown === "cards" ? "hidden" : undefined}>
      <DataGrid id={gridId} label={caption} revealEndWhen={columns.length}>
      <table
        className="w-full border-collapse [background-color:var(--color-table-bg)] [font-size:var(--text-sm)]"
        style={
          shown === "compact"
            ? ({
                minWidth: `${minWidth}px`,
                // Multipliers, not pixels -- see this component's `look` note.
                // Distinct names: a property that reads itself is a cycle and
                // CSS discards the whole declaration, which would have left
                // 紧凑 silently identical to 正常.
                /* 0.72 → 0.9（2026-09-02）。`align:admin` 拿六套去对它们各自
                   抄的那一页，**六套的行全部比参考矮**：参考 49–75px，我们 26–52。
                   最矮那一套（台账）画出来只有 26px —— 那不是「密」，
                   那是**挤到不好读**，而且它比号称全库最密的中台还要矮，
                   我们自己那两句主张互相打架。
                   紧凑仍然是紧凑，只是不再把行压掉三成。 */
                "--row-height": "calc(var(--row-h) * 0.9)",
                "--row-pad-y": "calc(var(--pad-cell-y) * 0.7)",
              } as CSSProperties)
            : { minWidth: `${minWidth}px` }
        }
      >
        <thead>
          <tr className="sticky top-0 [background-color:var(--color-table-head-bg)]">
            {columns.map((col) => {
              const on = sort?.key === col.key
              return (
                <th
                  key={col.key}
                  className={col.kind === "amount" ? `${headCell} !text-right` : headCell}
                  aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {/* 整个栏头就是那颗按钮 —— 一个只有箭头能点的栏头，
                      在手机上是一个点不中的目标（`check:reachable` 守着这件事）。 */}
                  <button
                    type="button"
                    onClick={() => nextSort(col.key)}
                    className={`inline-flex max-w-full items-center gap-1 ${
                      col.kind === "amount" ? "flex-row-reverse" : ""
                    } [font:inherit] [letter-spacing:inherit] [text-transform:inherit] [color:inherit]`}
                  >
                    <span className="truncate">{col.label}</span>
                    {/* 没有在排的时候画一个淡的、方向中立的记号，
                        那是在说「这里可以点」；不画的话没有人知道它能点。 */}
                    <svg
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0"
                      style={{ opacity: on ? 1 : 0.35 }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    >
                      {on ? (
                        sort.dir === "asc" ? (
                          <path d="M6 9.5V2.5M3 5.5 6 2.5l3 3" />
                        ) : (
                          <path d="M6 2.5v7M3 6.5l3 3 3-3" />
                        )
                      ) : (
                        <path d="M3.5 4.5 6 2l2.5 2.5M3.5 7.5 6 10l2.5-2.5" />
                      )}
                    </svg>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {/* 🔴 筛到零行的时候，表格本来是**整个空白的**。
              实测（`npm run check:table-search`）：打一个找不到的字，tbody 的
              内容是空字串 —— 一个刚打完字的人分不出「找不到」跟「这东西坏了」。
              这跟这个仓库一直在犯的那一类是同一件事：能力做出来了，
              **它讲不出自己发生了什么**。 */}
          {/* 🔴 一行都还没有 —— 跟「筛不到」是两件不同的事，而这张表本来
              两件都不会讲：零行的时候它渲染出一个表头加一片空白。
              老板 2026-09-02:「每一个页面 每一页状态 你就没有复刻好」。
              这是一个真实客户第一天打开系统时看到的那一屏，
              而它本来什么都没有说。 */}
          {rows.length === 0 && !q && !seg ? (
            <tr>
              <td
                colSpan={columns.length}
                className="[padding-block:var(--pad-card)] [padding-inline:var(--pad-cell-x)] text-center [color:var(--color-paper-dim)] [font-size:var(--text-xs)]"
              >
                {w.tableEmpty}
              </td>
            </tr>
          ) : null}
          {/* 🔴 分段也会筛到零行，而在这之前这一支只问搜索框（2026-09-03）。
              按一下「已确认」而一笔都没有的时候，上面那个空状态说
              「还没有记录」、这一支不出声 —— **整个表身是一片空白**。
              这个档案自己在上面写过同一句：一个刚筛完的人，分不出
              「找不到」跟「这东西坏了」。 */}
          {rows.length === 0 && (q || seg) ? (
            <tr>
              <td
                colSpan={columns.length}
                className="[padding-block:var(--pad-card)] [padding-inline:var(--pad-cell-x)] text-center [color:var(--color-paper-dim)] [font-size:var(--text-xs)]"
              >
                {w.tableNoMatch(q ? query.trim() : (seg as string))}
              </td>
            </tr>
          ) : null}
          {groups.map((g) => (
            <Fragment key={`g:${g.label ?? ""}`}>
              {/* 组标题。整行跨栏 —— 参考那一页每一组自己一个标题，
                  而不是一整张平表配一个「哪一组」栏。 */}
              {g.label !== null ? (
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={columns.length}
                    className="[background:var(--color-ink-850)] [padding-inline:var(--pad-cell-x)] [padding-block:calc(var(--pad-cell-y)*0.85)] text-left [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] [color:var(--color-paper)]"
                  >
                    {g.label || "—"}
                  </th>
                </tr>
              ) : null}
              {g.rows.map(({ row, i }) => (
            <tr
              key={i}
              className={
                // Bands and rules are alternatives, not additions: a zebra
                // table with a rule under every row is two separators doing
                // one job, and reads as noise at the row heights these tables
                // actually run at.
                shown === "zebra"
                  ? "even:[background-color:var(--color-ink-850)]"
                  : "[&:not(:last-child)]:border-b [&:not(:last-child)]:[border-color:var(--color-ink-800)]"
              }
            >
              {columns.map((col) => {
                const value = row.cells?.[col.key] ?? ""
                if (col.kind === "status") {
                  const tone = (row.tones?.[col.key] as StatusTone) ?? "neutral"
                  return (
                    <td key={col.key} className={bodyCell}>
                      {value ? (
                        rowShape === "pill" ? (
                          <Pill tone={tone} label={value} />
                        ) : rowShape === "mark" ? (
                          <StatusMark tone={tone} label={value} />
                        ) : (
                          <StatusDot tone={tone} label={value} />
                        )
                      ) : null}
                    </td>
                  )
                }
                if (col.kind === "amount") {
                  // --font-numeric is a mono face under Ledger and Blueprint and
                  // the rounded UI face under Hearth, which deliberately has no
                  // mono anywhere: a monospaced figure is a precision signal, and
                  // precision is not that register's job.
                  return (
                    <td
                      key={col.key}
                      /* 🔴 `whitespace-nowrap`：一个断成两行的金额，读起来是一个错的数字。
                         实测 390 的报价单页：`RM 48,500` 被折成「RM」跟「48,500」两行。
                         宽度不够的时候宁可让整张表横着滑 —— 表本来就会滑，
                         而一个断开的金额没有任何地方讲得清楚它其实是一个数。
                         （同一条守卫 2026-09-03 在手机那几张 demo 上装过一次。） */
                      className={`${bodyCell} whitespace-nowrap text-right tabular-nums [color:var(--color-paper)] [font-family:var(--font-numeric)]`}
                    >
                      {value}
                    </td>
                  )
                }
                if (col.kind === "detail") {
                  return (
                    <td key={col.key} className={`${bodyCell} [color:var(--color-paper-dim)]`}>
                      {rowShape === "avatar" && value ? (
                        <span className="flex items-center [gap:var(--gap-inline)]">
                          {/*
                            THE FACE BELONGS TO THE PERSON, NOT TO THE CELL.

                            This read `name={value}` -- the DETAIL cell -- so the
                            initials were taken from whatever happened to be in
                            the second column. With the sample rows that looked
                            plausible (「Taman Desa · 013-2xx xxxx」 -> Ta); with a
                            business's real customers, where that column is a
                            composed contact line, 陈先生 got a badge reading
                            「06」 and 建材行 A got 「王·」.

                            Found by looking at the page on the day directory
                            went live. Twenty-nine database assertions and the
                            whole unit suite were green -- none of them can see
                            two digits of a phone number in a circle.
                          */}
                          <Avatar name={String(row.cells?.primary || value)} size={24} />
                          <span className="truncate">{value}</span>
                        </span>
                      ) : (
                        value
                      )}
                    </td>
                  )
                }
                return (
                  <td
                    key={col.key}
                    className={`${bodyCell} [color:var(--color-paper)] [font-weight:var(--fw-medium)]`}
                  >
                    {/*
                      A REAL RECORD OPENS; A SAMPLE DOES NOT.

                      `row.href` is set only by the live-rows projection, so a
                      demonstration table has nothing to click and a business's
                      own row can be opened and fixed. An anchor rather than a
                      control on purpose: this table is drawn in the style
                      gallery, in hundreds of thumbnails and on paper, where
                      there is no session -- a link is inert in all of them and
                      a button would not be.

                      Only the first column. A row of four links is four
                      answers to one question, and the underline would fight
                      the amount column's alignment.
                    */}
                    {(() => {
                      const label =
                        row.href && col.key === "primary" && value ? (
                          <a
                            href={row.href}
                            className="underline decoration-[color:var(--color-ink-700)] underline-offset-[3px] hover:decoration-[color:var(--color-primary)]"
                          >
                            {value}
                          </a>
                        ) : (
                          value
                        )
                      /* 头像只画在第一栏，而且只在这张表说自己是一张名册的时候。
                         名字是空的就不画 —— 一颗没有字的圆圈是一个装饰。 */
                      if (!faces || col.key !== "primary" || !value) return label
                      return (
                        <span className="flex items-center [gap:var(--gap-inline)]">
                          <Avatar name={String(value)} size={24} />
                          <span className="truncate">{label}</span>
                        </span>
                      )
                    })()}
                  </td>
                )
              })}
            </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </DataGrid>
      </div>

      {/* 表格底下那一条。
          🔴 组件清单 2026-09-03 报「缺 表格页尾」—— 参考那几页表格底下都有一条
          （shadcn 是「10 Rows per page · Page 1 of 10」）。
          ⚠️ **我们不画分页**：一次把每一行都显示出来，
          一颗翻不了页的翻页钮就是这个仓库一直在禁的那种死按钮。
          这一条讲的是真的：显示了几笔、一共几笔 —— 筛过之后两个数字会分开。 */}
      {allRows.length > 0 ? (
        <div
          className="flex items-center justify-end [padding-block:var(--pad-control-y)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)]"
          style={{
            borderTopWidth: "var(--hairline)",
            borderTopStyle: "solid",
            borderTopColor: "var(--border-subtle)",
          }}
        >
          <span className="tnum">{w.tableFoot(rows.length, allRows.length)}</span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * A filled status, for the registers whose briefs are loud enough to carry one.
 *
 * WHY NOT REUSE Tag. Tag is a label the customer writes -- 「加急」, 「熟客」 --
 * and its tones are chosen by hand. This one reads the row's own status tone,
 * so a table can never show a green pill on a row the dot would have shown red
 * on. Same tones, one source.
 *
 * The fill is the status colour at low opacity rather than a second token per
 * tone: every register already defines these four, and a --*-soft for each
 * would be sixteen new declarations to keep in step with four that already
 * exist.
 */
/* ── 第四种：形状说话，颜色不说话 ────────────────────────────────────────
   台账抄的 shadcn Tasks 那一页，状态栏是**一个图标加一个词**，而那个图标
   跟其余的字同一个灰 —— 🚫 Canceled · ✓ Done · ? Backlog。
   2026-09-03 放大到两倍并排才看清楚：我们画的是一颗有颜色的圆点，
   而他们画的是一个**形状**。

   为什么值得单独做一种，而不是把圆点换个颜色：
   · **它是这四种里唯一一种，把状态从颜色搬到形状上的。** 一张印出来的报价单、
     一台调成灰阶的萤幕、一个分不出红绿的人 —— 圆点在这三种情况下讲不出话
   · 它同时是[任务 100c](../../docs/founder-tasks.md) 那条「有颜色的面积 ≤ 7%」
     的答案：一栏状态从此不再往那个数字里加东西
   · [重点 7c](../../docs/founder-points.md)：换个配色它还在，所以它是骨架不是漆

   ⚠️ 图标**不上色**，跟 `StatusDot` 的档头讲的是同一条：
   一个跟着状态变色的字，是整页对比度最低的那一段，而它偏偏是要读的。 */
const MARK_ICON = {
  positive: CheckCircle2,
  warning: Timer,
  negative: CircleOff,
  neutral: CircleDashed,
} as const

function StatusMark({ tone, label }: { tone: StatusTone; label: string }) {
  const Icon = MARK_ICON[tone] ?? CircleDashed
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap [font-size:var(--text-sm)] [color:var(--color-paper)]">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 [color:var(--color-paper-dim)]" strokeWidth={2} />
      {label}
    </span>
  )
}

const PILL_TONE: Record<string, string> = {
  positive: "var(--color-jade-bright)",
  warning: "var(--color-brass-bright)",
  negative: "var(--color-clay-bright)",
  neutral: "var(--color-slate-bright)",
}

function Pill({ tone, label }: { tone: StatusTone; label: string }) {
  const c = PILL_TONE[tone] ?? PILL_TONE.neutral
  return (
    <span
      className="inline-flex max-w-full items-center truncate whitespace-nowrap [border-radius:var(--radius-control)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [padding-block:2px] [padding-inline:var(--pad-control-x)]"
      /*
        THE LABEL IS NEVER THE TONE, AND THIS FILE'S SIBLING SAYS SO.

        status-dot.tsx, three files over, argues it in its own header: 「A label
        that also takes the hue is the weakest-contrast text on the page for
        something meant to be read.」 The dot obeys it; this pill did not -- it
        painted the label in the status colour at --text-xs, which measured
        2.56:1 for 「Awaiting reply」 and 2.74:1 for 「Confirmed」 on 中台's
        table band. Both are STATES OF HIS OWN JOBS, at 11.5px.

        The tone still says everything it said: it is the fill and the border,
        which is what makes a pill a pill. Only the words moved to reading
        contrast, and they are mixed a quarter of the way back toward the tone
        so the chip keeps its character.
      */
      style={{
        color: `color-mix(in oklab, ${c} 25%, var(--color-paper))`,
        background: `color-mix(in oklab, ${c} 14%, transparent)`,
        border: `var(--hairline) solid color-mix(in oklab, ${c} 32%, transparent)`,
      }}
    >
      {label}
    </span>
  )
}

/** 那个**真的会筛**的框。两种排法（自己一行 · 跟标题同一行）画的是同一个框，
 *  所以它只有一份 —— 抄第二份，两处迟早会漂。 */
function SearchField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 [background:var(--color-ink-900)] [border:var(--border-card-width)_solid_var(--input)] [border-radius:var(--radius-control)] [padding-inline:var(--pad-control-x)] sm:max-w-[22rem]">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 [color:var(--color-paper-dim)]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.5 13.5 3 3" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="w-full bg-transparent [padding-block:var(--pad-control-y)] [font-size:var(--text-xs)] [color:var(--color-paper)] outline-none placeholder:[color:var(--color-paper-dim)]"
      />
    </label>
  )
}

/** 这张清单上真的有的那几种状态。见 RecordTable 的 `segments`。 */
function autoSegments(
  rows: { cells?: Record<string, string> }[],
  statusKey: string | undefined,
): string[] | undefined {
  if (!statusKey) return undefined
  const count = new Map<string, number>()
  for (const r of rows) {
    const v = String(r.cells?.[statusKey] ?? "").trim()
    if (v) count.set(v, (count.get(v) ?? 0) + 1)
  }
  const labels = [...count.keys()]
  if (labels.length < 2 || labels.length > 6) return undefined
  /* 每一格都只有一行 = 这一排是这张表的第二份拷贝，不是一个筛子。 */
  if (![...count.values()].some((n) => n > 1)) return undefined
  return labels
}

/** The segment row. Lifted out because the toolbar draws it in one of two
 *  places now -- beside the caption, or under it next to the field. */
function Segments({
  filters,
  all,
  picked,
  onPick,
}: {
  filters: string[]
  all: string
  /** `null` = 全部。 */
  picked: string | null
  onPick: (v: string | null) => void
}) {
  return (
    <div
      className="ms-auto flex overflow-hidden [border:var(--border-card-width)_solid_var(--border)] [border-radius:var(--radius-control)]"
      role="group"
    >
      {[null, ...filters].map((f) => {
        const on = picked === f
        return (
          <button
            key={f ?? "__all"}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(f)}
            className={`whitespace-nowrap [font-size:var(--text-xs)] [padding-block:2px] [padding-inline:var(--pad-control-x)] ${
              on
                ? "[background:var(--color-primary-soft)] [color:var(--color-primary)] [font-weight:var(--fw-medium)]"
                : "[color:var(--color-paper-dim)] hover:[color:var(--color-paper)]"
            }`}
          >
            {f ?? all}
          </button>
        )
      })}
    </div>
  )
}
