"use client";

import { Render, type Data } from "@puckeditor/core";
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";
import { StyleScope } from "@/design-system/editor/style-scope";
import { cornerApply, cornerCapture } from "@/design-system/editor/corners";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import type { SystemLang } from "@/lib/system-lang";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { deskSurface } from "@/lib/portal/system-register";

/**
 * 师傅看到的那一页 — the same page, without the editor around it.
 *
 * ── WHY A SUPERVISOR MUST NOT GET THE EDITOR ─────────────────────────────
 *
 * `/portal/<pageKey>` is Puck. Handing it to a staff member would offer him
 * every control the owner has -- drag a block, change a variant, publish the
 * public site -- and then refuse each one at the server, because
 * `save_project_page` asks for `account_id = auth.uid()` and always will.
 * Autosave fires 2.5 seconds after any change, so his first accidental click
 * would produce an error about a page he never meant to edit.
 *
 * A control that looks available and is not is the defect this repository has
 * shipped more often than any other. The honest answer is not to draw it.
 *
 * ── WHAT HE GETS INSTEAD, AND WHY IT IS NOT LESS ─────────────────────────
 *
 * The page itself, at full size, in the business's own style and language,
 * with its real rows -- the projection already ran on the server. Every row's
 * first cell is still a link to 改这一单, and 加一单 still sits in the table's
 * own header, because those are separate routes that check permission for
 * themselves and that he is allowed to use. Adding a job from the site is the
 * entire reason the role exists.
 *
 * ⚠️ THIS IS PRESENTATION, NOT ENFORCEMENT. Nothing here decides anything: the
 * money pages were already refused by the route, the rows he can read were
 * already decided by RLS, and a page he tried to save could not be saved
 * because `project_pages` has no write policy at all. Deleting this file would
 * make the product rude, not insecure -- which is the right way round.
 */
export function WorkView({
  data,
  pageKey,
  style,
  palette,
  corners,
  systemLang,
  fill,
  designHref,
  designLabel,
}: {
  data: Data;
  /** 哪一页 —— 只用来问 `deskSurface()`。官网那一页穿客户自己的主色，
   *  其余每一页是工作台。见 lib/portal/system-register.ts。 */
  pageKey: string;
  style: StyleName;
  palette: string | null;
  /** The owner's radius setting is a MULTIPLIER of the register's own ladder,
   *  not a radius -- so his system looks to a supervisor exactly the way it
   *  looks to him. A page that renders differently for two people in one
   *  business is two systems. Two elements, because a variable may not read
   *  itself: see design-system/editor/corners.tsx. */
  corners: number;
  systemLang: SystemLang;
  /** 装在一个已经有高度的盒子里（手机上那一格），不是自己占一整屏。
   *
   *  🔴 **它修的不是好看，是一张被压扁的表。** 2026-09-04 在 390px 量到：
   *  底下那两段 `min-h-screen` 把内容那一栏撑到 844，而 `columns.tsx`
   *  的 `[&>*>*>*]:h-full` 会把多出来的高度**平均分给里面每一段** ——
   *  於是筛选、搜索、表格、页尾各拿 173px：**七行客户被塞进一个 174px
   *  的窗口里，自己另外滚**，中间三条加起来 321px 的空白。
   *  外面那一层已经有确定的高度（手机那一格是 `flex-1 overflow-y-auto`），
   *  所以这里只要不再要求一整屏，那一栏就回到内容的高度，表也就摊开了。
   *
   *  ⚠️ 底色留在外面那一层（`min-h-full`），不然内容短的时候底下会露出
   *  壳自己的颜色。 */
  fill?: boolean;
  /** 老板看这一页的时候，这里是他进「改设计」的门。师傅拿不到它。
   *
   *  🔴 **为什么是一条连结、而且只有一条。** 2026-09-05 量的：在编辑器里
   *  打开报价单，画布里有 **10 个真的连结**（他自己的侧栏、他的页面、
   *  「加一单」），**一个都点不动** —— Puck 把画布上每一次点击都收去当
   *  「选中这一块」，连 `force` 都走不过去。老板每天要做的事全部在那十个
   *  连结后面，而正门是一把施工工具。
   *
   *  所以这一页现在是正门，而设计是他按一下才进去的一个模式。
   *  这一条跟手机上那两格（`mobile-editor.tsx`，2026-09-04）是同一个决定，
   *  桌面只是晚了一天。
   *
   *  ⚠️ 它跟着 **Formae 的介面语言**（`locale`）走，不是跟着他系统的语言 ——
   *  这一颗是我们的工具，不是他系统里的字。所以字是从伺服器传下来的，
   *  这个组件自己不查字典。 */
  designHref?: string;
  designLabel?: string;
}) {
  return (
    <StyleScope
      /* 工作台自己的主要动作颜色。见 lib/portal/system-register.ts。 */
      data-surface={deskSurface(pageKey)}
      register={style}
      palette={palette}
      style={cornerCapture}
      /* 🔴 `pb-*` 只在有那颗药丸的时候加，而且加在**上过色的这一层里面**。
         看图看到的：390 上那颗「改设计」压在最后一行的状态上（`In progress`
         被吃掉一半）。加在外面那一层会露出壳自己的颜色，所以加在这里。
         同一条这个仓库写过三次 —— 一个飘在内容上、又不让内容躲开的东西，
         吃掉的永远是最后那一样。 */
      /* `max-lg:pb-16` 加在**上过色的这一层里面**，不是外面 —— 窄屏底下那条
         分页列是 `fixed` 的，而外层的 padding 会在页尾露出一条没上色的地。
         而最低高度要**扣掉**那 4rem，不然「一整屏 ＋ 64px」永远比一屏高，
         内容装得下的页面也会多出一段可以滚的空白。`dvh` 不是 `vh`：
         手机浏览器的网址列会伸缩，`vh` 量的是它伸出去之前那个高度。

         ⚠️ **宽屏那个 `lg:pb-24` 2026-09-07 拿掉了** —— 它当时是要让内容
         躲开那颗浮着的药丸，而药丸已经排进流里面了（见底下那一段）。
         留着就是每一页尾巴多 96px 谁都没有要的空白。 */
      className={`ds-ground [background-color:var(--color-canvas)] ${fill ? "min-h-full" : "lg:min-h-screen max-lg:min-h-[calc(100dvh-4rem)] max-lg:pb-16"}`}
    >
      <SystemLangProvider lang={systemLang}>
        {/* ⚠️ A FLEX COLUMN, NOT `[&>*]:min-h-screen`. That was the first
            version and the screenshot showed what it does: the page ended at
            520px with bare canvas under it, dark rail included. `min-height`
            is not a definite height, so `SystemShell`'s own `h-full` resolved
            against nothing and collapsed -- the same failure page-preview.tsx
            documents, arrived at from the other side. `flex-1` in a column
            with a real minimum gives the child a height to be full OF.

            ⚠️ AND THAT WAS STILL NOT ENOUGH -- the second screenshot was
            identical to the first. Measured in the browser rather than guessed
            again: the flex child was 900px, and `SystemShell` under it asks for
            `min-height: 100%`, which resolves against the PARENT'S `height`
            property. That property is `auto`; 900 was a used size, not a
            declared one, so the percentage had nothing to resolve against and
            the shell fell back to its content -- 521px, rail included.

            So the shell is given a viewport minimum directly. `vh` needs
            nothing above it to be definite, which is the whole reason it works
            where two percentage chains did not.

            Both wrong answers are written down because both looked right in
            code and only the picture told them apart. */}
        <div
          className={
            fill
              ? "flex flex-col [&>*]:flex-1"
              : /* 窄屏那条 4rem 的底栏是 `fixed` 的，所以这一整条链子都要扣掉它 ——
                   只扣最外面那一层，里面还写着一整屏，加起来还是比一屏高 64px，
                   於是每一页都多出一段滚得动的空白。三层写同一个数字听起来很蠢，
                   而它就是 `min-height` 百分比链子的样子（档头那两段讲的是同一件事）。 */
                "flex flex-col lg:min-h-screen max-lg:min-h-[calc(100dvh-4rem)] [&>*]:flex-1 lg:[&>*>*]:min-h-screen max-lg:[&>*>*]:min-h-[calc(100dvh-4rem)]"
          }
          style={cornerApply(corners)}
        >
          <Render config={puckConfig} data={data} />
        </div>
        {designHref ? (
          /* 🔴 **它不再浮在他的页面上。宽窄都是。**

             ── 第四版，而前三版全部是同一个毛病 ────────────────────────
             窄屏试过三版，三版都在吃掉页面最后那一样东西：
             ① `fixed bottom-5` —— 压在最后一行的状态上
             ② 加 `pb-28` 想让内容躲开 —— **padding 只在下面加空间，
                内容一个像素都不会往上移**，画面跟①一模一样
             ③ 排在页面最后 —— 掉到那条 `fixed` 底栏**底下**去了
             窄屏的答案是把它收进底栏的「更多」（见 system-view.tsx），
             而**宽屏当时留着那颗浮的**，理由写的是「那一边没有底栏」。

             ── 🔴 那个理由不成立，而这一次是量出来的 ──────────────────
             老板 2026-09-06 拍图：**那颗药丸盖住第三行的 `RM 3,400`**。
             逐个角量过（1440×960，`scratchpad/_corner-probe.mjs`）：

               payments · 卷到顶 · 右下角 → 底下是 <TD> In progress · <TD> To do
               customers · 卷到顶 · 左下角 → 底下是 <A> Reports · <A> Ranking

             **两个角都在盖东西**，只是盖到哪一样看他卷到哪里 ——
             一个跟卷动位置有关的缺陷，一张截图有时候照得到有时候照不到，
             而那正是它活了这么久的原因。

             → 所以答案跟窄屏是同一个，不是再挪一次位子：
             **一个鲜少按一次的动作，不该永远压在他每天要读的那一栏上。**
             它排在页面最后，在流里面，**永远不会盖住任何东西**。

             ⚠️ 代价讲出来：他要卷到底才看得到（实测这几页 1206–1245px，
             视窗 960 —— 一次滑动）。换到的是那两栏永远读得到。 */
          <div className="max-lg:hidden flex justify-end [padding-block:var(--pad-card-lg)] [padding-inline:var(--pad-card-lg)] [border-top:var(--hairline)_solid_var(--color-ink-800)]">
            <a
              href={designHref}
              className="inline-flex items-center gap-2 rounded-full border [border-color:var(--color-ink-700)] [background-color:var(--color-ink-900)] [color:var(--color-paper)] px-4 py-2.5 text-sm [font-weight:var(--fw-medium)]"
            >
              <span aria-hidden="true">✎</span>
              {designLabel}
            </a>
          </div>
        ) : null}
      </SystemLangProvider>
    </StyleScope>
  );
}
