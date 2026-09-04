import { Children, type ReactNode } from "react"
import { NavAxisProvider } from "./nav-axis"
import { SystemBar } from "./system-bar"

/**
 * The page shell every generated system page is built inside: a navigation
 * column beside a content column — or, since 2026-08-21, a navigation BAR
 * above one.
 *
 * WHY IT EXISTS: Puck's canvas is a single vertical stack, and a sidebar is not
 * a stackable block. Placing RailNav as the first item in a page's `content`
 * put a full-viewport-height nav ABOVE everything else, pushing the page header,
 * the headline figure, the pipeline and the table a full screen below the fold.
 * Verified in a real browser, not reasoned about: all five components rendered
 * correctly, at x=412, y=172 / 1172 / 1243 / 1348 / 1471 -- a customer opening
 * their new system saw a sidebar and nothing else.
 *
 * The fix is structural, not cosmetic. This component owns the two-column
 * relationship, and its two Puck `slot` fields make each column a real drop
 * target, so a customer can still drag blocks into either side and reorder
 * them. That is closer to how they actually think about their system ("this bit
 * is the menu, this bit is the page") than one flat list ever was.
 *
 * WHY IT NOW HAS `nav` AND `navTone`: because RailNav grew four variants and
 * two of them are not a dark left column. The shell paints the navigation's
 * ground (see the long note below) and decides its axis, so neither of those
 * facts can live inside the rail alone. They are two fields on the shell rather
 * than one on the rail because they are properties of the PAGE -- where the
 * navigation sits, and what the strip it sits on is made of.
 */
export function SystemShell({
  sidebar,
  aside,
  main,
  nav = "side",
  navTone = "dark",
  crumbs,
  crumbNote,
  crumbMonogram,
  frame = "flush",
  width = "wide",
  bar = "inline",
}: {
  sidebar: ReactNode
  /**
   * A PERSISTENT SECOND COLUMN, between the rail and the page.
   *
   * ── WHY THIS EXISTS ──────────────────────────────────────────────────
   *
   * Researched 2026-08-26, on shipped products rather than templates:
   * 「就是先去研究其他的人的設計 是怎樣的」. Tailwind Plus publishes exactly three
   * application shells -- Stacked (9 variants), Sidebar (8), Multi-Column (6)
   * -- and Attio, Linear and Superhuman all run the third one.
   *
   * Measured against ours the same day, straight out of design-doc.ts: five
   * registers on side-deep, five on side-dark, two on side-light, three on
   * top-light, two on top-dark. side-deep and side-dark differ by HOW DARK,
   * which is colour and not structure. So seventeen registers were built on
   * TWO shells -- twelve with a side rail, five with a top bar -- and the
   * founder's 「每一套的設計要不一樣」 was being answered below the level where
   * the difference is first seen.
   *
   * This is the third shell. It is not exotic: a list on the left and the one
   * you picked on the right is how every CRM in the world is laid out, which
   * is exactly the bar he set -- 「要做一個大部分都會用到的 只是每一套的設計要不一樣」.
   *
   * Undefined on every register that does not ask for it, so nothing changes
   * for the other fourteen.
   */
  aside?: ReactNode
  main: ReactNode
  /** Where the navigation sits. Pair `"top"` with RailNav's `variant="topbar"`;
   *  the two are a matched set and neither reads right without the other.
   *  `"split"` is a side rail plus the `aside` column above. */
  /**
   * 顶栏那一条细的：你在哪。见 system-bar.tsx。
   *
   * 🔴 **它是一个普通的 prop，不是一个 slot，而这一点是量出来的。**
   * 第一版做成 slot，两次都出事：空的时候 招牌 的页头下面多出 380px
   * （空 slot 在编辑器里是一块放置区，不是零高）；加了布林闸门之后，
   * **装了东西的 slot 一样多出 350px** —— 那是 Puck 给每一个 slot 留的
   * 拖放余量，跟里面有几个东西无关。两次都是实拍看出来的，测试全绿。
   *
   * 一条顶栏本来也不需要是可拖放的：它讲的是「你在哪一页」，
   * 那是系统知道的事，不是客户要往里面摆东西的地方。
   */
  crumbs?: string[]
  /** 顶上那一条右边那句关於他这门生意的话 —— 只有总览给。见 system-bar.tsx。 */
  crumbNote?: string
  /** 顶上那一条右边的圆头像。见 system-bar.tsx。 */
  crumbMonogram?: string
  nav?: "side" | "top" | "split"
  /** What the navigation's ground is made of. `"dark"` is the register's own
   *  nav ground; `"light"` runs the navigation on the same paper as the page,
   *  separated by a hairline instead of by a colour. */
  navTone?: "dark" | "light" | "deep"
  /**
   * HOW THE PAGE SITS AGAINST THE NAVIGATION. This is geometry, and it is the
   * axis that was missing.
   *
   * ── WHY IT EXISTS ────────────────────────────────────────────────────
   *
   * The founder looked at fourteen registers photographed side by side and
   * said 「這個只是一個設計風格罷了」. He was right, and the reason was already
   * written down and not acted on. Measured on 2026-08-26 against a shipped
   * product (arhamkhnz/next-shadcn-admin-dashboard): they separate the shell on
   * `sidebar_variant` -- flush / inset / floating -- and on `content_layout` --
   * centred / full-width. Ours separated it on `navTone`, which is dark, light
   * or darker. Fourteen registers, one page frame, repainted fourteen ways.
   *
   *   flush     the rail is hard against the edge and the page begins where it
   *             ends. What every register here did, and still the right answer
   *             for the dense ones.
   *   inset     the rail is flush, and the PAGE is a rounded panel floating in
   *             a gutter of the navigation's own ground. Reads as a document
   *             held in a frame rather than as a screen filled to the edges.
   *   floating  the rail itself is a detached card with air on all four sides,
   *             over one continuous ground. Reads as a tool laid on a desk.
   *
   * A palette cannot take any of the three away, which is the test (重点 7c).
   */
  frame?: "flush" | "inset" | "floating"
  /**
   * Whether the page runs to the edge or is capped and centred.
   *
   * The second half of the same finding. A capped column at 1100px on a 1440px
   * screen is a different object from a table that runs the full width, and no
   * amount of radius or colour makes one read as the other. Centred suits the
   * registers whose case is calm and roomy; wide suits the ones whose case is
   * that everything fits on one screen.
   */
  width?: "wide" | "centred"
  /**
   * 面包屑那一条长在哪里 —— 内容的内距**里面**，还是横过整个内容区。
   *
   * 🔴 2026-09-04。他们的 `layout.tsx` 是 `<header h-12 border-b>` 在
   * `<div p-6>{children}</div>` **上面**，所以那条线横过整个内容区，
   * 而内容自己另外缩 24px。我们本来两者都在同一个内距里，
   * 於是那条线跟着内容缩进去，看起来像内容的第一行而不是视窗的横梁。
   */
  bar?: "inline" | "bleed"
}) {
  const isTop = nav === "top"
  // A split shell is a side rail that happens to have a column beside it.
  // Everything below that asks `isTop` must keep answering no.
  /* ⚠️ `Boolean(aside)` 对一个**空的**插槽也是 true —— 一个空阵列是真的。
     数子元素比它准一点点（服务端渲染时空阵列会被数成 0），**但它挡不住编辑器**：
     在编辑器里 Puck 把插槽当成一个组件传下来，所以里面有没有块，数出来都是一。

     **真正的修法不在这里，在 `industry-template.ts`** —— 装这一页的人才知道
     第二栏里有没有东西，它现在会在没有东西的时候直接把 `nav` 改成 `side`。
     这一行留着当第二道网，不是那道正门。
     （2026-09-02 的症状：台账的报价单页在侧栏跟内容之间有一条 267px 宽、
     整页高的空白 —— 眼睛在并排图上一眼看到，而尺子十八项全绿。） */
  const isSplit = nav === "split" && Children.toArray(aside).length > 0
  // `floating` only means anything beside a rail: a top bar detached from the
  // top of the window is a floating toolbar, which is a different idea and not
  // this one.
  const floating = frame === "floating" && !isTop
  const inset = frame === "inset" && !isTop

  /*
   * THE LIGHT NAVIGATION IS A TOKEN REMAP, NOT A SECOND RAIL.
   *
   * Every one of the three registers gives its own system a dark navigation
   * ground, and RailNav is written entirely against that `--color-nav-*`
   * family. Adding a light option by branching inside the rail would mean a
   * second copy of every colour decision in a 500-line component, kept in sync
   * by hand for as long as the product exists.
   *
   * So the family is re-pointed here instead, on the one wrapper that owns the
   * navigation's ground: nav-bg becomes the page's own panel, nav-fg becomes
   * its ink. Custom properties inherit and the nearest definition wins, so the
   * rail inside reads the new values without knowing anything happened — the
   * same mechanism that lets three customer registers and Formae's own chrome
   * share one component set.
   *
   * The accent becomes `--color-primary` because `--color-nav-accent` is
   * tuned for legibility on a dark ground and measures badly on paper: in
   * Ledger it is #f39158 on #14273d, which on #ffffff drops to 2.2:1.
   */
  const navVars =
    navTone === "deep"
      ? ({
          // Inverted from the customer's OWN ink, not from the style's nav
          // tokens -- the palette has already replaced those. --color-paper is
          // the text colour in a customer scope (L≈16 under every palette), so
          // it is the one value guaranteed to be dark whatever they picked.
          backgroundColor: "var(--color-paper)",
          "--color-nav-bg": "var(--color-paper)",
          "--color-nav-bg-deep": "var(--color-paper)",
          "--color-nav-fg": "var(--color-ink-900)",
          "--color-nav-fg-dim":
            "color-mix(in oklab, var(--color-ink-900) 66%, var(--color-paper))",
          "--color-nav-hover": "color-mix(in oklab, var(--color-paper) 88%, var(--color-ink-900))",
          "--color-nav-active": "color-mix(in oklab, var(--color-paper) 78%, var(--color-ink-900))",
          "--color-nav-border": "color-mix(in oklab, var(--color-paper) 84%, var(--color-ink-900))",
          // The palette's primary is tuned to sit on paper; on this ground it
          // is too dark to read, so it is lifted toward the rail's own
          // foreground rather than replaced by it -- the hue is the customer's
          // and should survive.
          "--color-nav-accent":
            "color-mix(in oklab, var(--color-primary) 55%, var(--color-ink-900))",
        } as React.CSSProperties)
      : navTone === "light"
      ? ({
          backgroundColor: "var(--color-ink-900)",
          "--color-nav-bg": "var(--color-ink-900)",
          "--color-nav-bg-deep": "var(--color-ink-900)",
          "--color-nav-fg": "var(--color-paper)",
          "--color-nav-fg-dim": "var(--color-paper-dim)",
          "--color-nav-hover": "var(--color-ink-850)",
          "--color-nav-active": "var(--color-ink-950)",
          "--color-nav-border": "var(--color-ink-800)",
          "--color-nav-accent": "var(--color-primary)",
        } as React.CSSProperties)
      : ({ backgroundColor: "var(--color-nav-bg)" } as React.CSSProperties)

  return (
    /*
      THE CONTAINER IS THIS WRAPPER, NOT THE SHELL ITSELF.

      `@container` and `@3xl:` were on the same element, and an element cannot
      query its own container: `container-type: inline-size` makes a box
      queryable BY ITS DESCENDANTS, so every `@3xl:` variant on the shell
      silently never matched. The shell stayed `flex-col` at every width, which
      put the navigation rail on TOP of the page instead of beside it -- on
      every register with a side rail, live, from the moment the container
      queries landed. Caught by measuring the page's own geometry (the heading
      sat 633px below the top of the canvas with the rail above it, not beside
      it), not by reading the CSS.
    */
    <div className="@container flex min-h-full w-full">
    <div
      /**
       * THE SYSTEM MEASURES ITSELF, NOT THE WINDOW.
       *
       * Every responsive decision inside this shell used to key off the
       * VIEWPORT: `sm:grid-cols-2` fires at a 640px window whatever width the
       * page itself has. That was wrong in two places long before anyone
       * noticed, and the phone preview added on 2026-08-25 made both visible in
       * one screenshot. The canvas is not the window -- it is the window minus
       * the editor's chrome, and minus another 472px whenever a sheet is
       * docked. And a phone preview is a 390px box inside a 1440px window, so
       * a page that asks the window "am I narrow?" is told no.
       *
       * `@container` makes this element the thing its own contents measure
       * against, so the answer is the truth in all three cases: a real 390px
       * phone, a 390px preview, and a canvas squeezed by a panel.
       *
       * The variants below are container sizes, not viewport ones -- `@3xl` is
       * 48rem/768px, which is the same number `md:` used to mean.
       */
      /*
        THE GROUND BEHIND EVERYTHING.

        `flush` paints the page's own canvas here, as it always did. The other
        two paint the NAVIGATION's ground, because in both of them something is
        floating and the thing it floats on has to be a different surface from
        the thing floating. Doing it on this element rather than on a wrapper
        keeps the rail and the gutter one continuous colour, which is what makes
        an inset page read as held rather than as misaligned.
      */
      style={
        frame === "flush"
          ? undefined
          : { backgroundColor: "var(--color-nav-bg)" }
      }
      className={`ds-ground flex min-h-full w-full ${
        frame === "flush" ? "[background-color:var(--color-canvas)]" : ""
      } ${floating ? "@3xl:gap-0 @3xl:p-3" : ""} ${
        isTop ? "flex-col" : "flex-col @3xl:flex-row @3xl:items-stretch"
      }`}
    >
      {/* `shrink-0` matters: RailNav sets its own width, and without this the
          flex row compresses it into an unreadable sliver as the main column's
          table grows.

          THE GROUND IS PAINTED HERE, not only on the rail itself, and that is
          deliberate. `items-stretch` gives this wrapper the shell's full
          height, but the rail inside it cannot inherit that height when Puck is
          driving: Puck inserts a drop zone AND a per-item wrapper between the
          two, both `height: auto`, and a percentage height needs a definite
          ancestor to resolve against. Measured on a real page: wrapper 661px,
          rail 387px -- a dark column that stopped two thirds of the way down
          with bare canvas below it.

          Turning those wrappers into flex containers would fix the chain and
          would also change the boxes Puck positions its own drag placeholders
          against, to fix something the customer only ever sees as a colour. So
          the colour is applied to the box that already has the right height,
          and the rail keeps its own matching background for when it is used
          outside this shell. Same token, so the join is invisible.

          It is a style attribute rather than a class because the value is now a
          choice (`navTone`) and there is no arbitrary-value syntax that takes a
          variable chosen at runtime. */}
      {/* The axis is published here rather than set on the rail — see
          nav-axis.tsx for the trap that avoids. */}
      {/* A split shell IS a side shell as far as the rail is concerned -- the
          extra column sits beside the page, not inside the navigation. */}
      <NavAxisProvider value={isTop ? "top" : "side"}>
        <div
          /* 🔴 `min-w-0`：窄屏那一条侧栏是靠 `overflow-x-auto` 滚的，
             而一个 flex 项目的 `min-width` 预设是 `auto`（不准缩到比内容窄）,
             所以那一条会直接长出去而不是滚。2026-09-04 在 390px 量到：
             这一格 390，里面那条 `aside` 993，`clientWidth` 也是 993 ——
             **六个页面连结在画面外，而且到不了**。

             ⚠️ `[&>*]:min-w-0` 是必要的第二半：`sidebar` 是 Puck 的插槽，
             它自己会包一层**我们改不到 class 的 div**，而那一层同样是
             flex 项目、同样 `min-width:auto`。只修 `aside` 跟只修这一格
             都量出来没有变化（993 → 993 → 993），两层一起才是 390。

             宽屏不受影响：
             那边宽度是 `@3xl:w-[220px]` 那几条写死的，`shrink-0` 也还在。 */
          className={`min-w-0 [&>*]:min-w-0 ${
            isTop ? "flex w-full shrink-0" : "flex w-full shrink-0 @3xl:w-auto"
          } ${
            floating
              ? "@3xl:overflow-hidden @3xl:[border-radius:var(--radius-lg)] @3xl:[box-shadow:var(--shadow-card)]"
              : ""
          }`}
          style={navVars}
        >
          {sidebar}
        </div>
      </NavAxisProvider>

      {/*
        THE SECOND COLUMN. Fixed width at desktop, full width and first below
        @3xl -- on a phone a list and a detail cannot sit side by side, and the
        list is the thing you navigate FROM, so it goes on top.

        It carries the page's own ground and a hairline, not a second nav
        ground: two dark columns beside each other stops being a shell and
        becomes a wall.
      */}
      {isSplit ? (
        <div className="flex w-full shrink-0 flex-col [gap:var(--gap-stack)] [padding:var(--pad-card-lg)] @3xl:w-[19rem] @3xl:[border-right:var(--hairline)_solid_var(--border-subtle)]">
          {aside}
        </div>
      ) : null}

      {/* `min-w-0` is what lets the record tables inside scroll horizontally
          instead of forcing the whole shell wider than the viewport. */}
      {/*
        THE PAGE COLUMN.

        `inset` turns it into a rounded panel on the navigation's ground -- the
        page held in a frame rather than filling the screen to its edges. It
        carries its own canvas colour, which the outer element gave up so that
        the gutter could show.

        `centred` caps and centres the content inside whichever of the three
        frames is on. The cap is in `ch` rather than px on purpose: a register
        that sets 13px body text (台账) and one that sets 15px (炉) do not want
        the same number of pixels, they want the same number of characters, and
        that is what makes a capped column read as a decision instead of as a
        window that failed to maximise.
      */}
      <div
        className={`flex min-w-0 flex-1 flex-col ${
          inset
            ? "@3xl:my-3 @3xl:mr-3 @3xl:[border-radius:var(--radius-lg)] @3xl:[box-shadow:var(--shadow-card)]"
            : floating
              ? "@3xl:ml-3 @3xl:[border-radius:var(--radius-lg)]"
              : ""
        }`}
        style={
          frame === "flush"
            ? undefined
            : { backgroundColor: "var(--color-canvas)" }
        }
      >
        {/* 满幅那一条：画在内距**外面**，所以它横过整个内容区（照他们的 layout.tsx）。 */}
        {bar === "bleed" && crumbs?.length ? (
          <SystemBar crumbs={crumbs} note={crumbNote} monogram={crumbMonogram} axis={isTop ? "top" : "side"} bleed />
        ) : null}
        <div
          className={`flex min-w-0 flex-1 flex-col [gap:var(--gap-stack)] [padding:var(--pad-card-lg)] ${
            width === "centred" ? "mx-auto w-full [max-width:96ch]" : ""
          }`}
        >
          {/* 内嵌那一种：在内距里面，所以它跟页面内容左右对齐 ——
              一条跟内容不对齐的横线，看起来像是别人的东西掉进来了。 */}
          {bar !== "bleed" && crumbs?.length ? (
            <SystemBar crumbs={crumbs} note={crumbNote} monogram={crumbMonogram} axis={isTop ? "top" : "side"} />
          ) : null}
          {main}
        </div>
      </div>
    </div>
    </div>
  )
}
