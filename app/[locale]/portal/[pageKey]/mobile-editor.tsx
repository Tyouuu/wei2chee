"use client";

import { Render, usePuck, type Data } from "@puckeditor/core";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
// Renders through the register-aware config, so a block nobody has
// touched takes the shape THIS register prefers. See
// design-system/editor/puck-config-client.tsx.
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";

import { StyleScope } from "@/design-system/editor/style-scope";
import { AiAssistant, type Turn } from "./ai-assistant";
import chrome from "../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import type { SystemLang } from "@/lib/system-lang";
import { deskSurface } from "@/lib/portal/system-register";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import { railIcon } from "@/design-system/components/rail-icons";
import { WorkView } from "./work-view";

/**
 * THE EDITOR ON A PHONE.
 *
 * Measured on 2026-08-21: editor-client.tsx and editor-chrome.tsx contained
 * ZERO responsive classes between them. Below about 1000px Puck's three
 * columns — palette, canvas, fields — do not fold; they compress, and a
 * five-column record table inside a 140px canvas is not a degraded experience,
 * it is a broken screen. For a product sold to Malaysian SME owners, most of
 * whom will open the link on the phone it was sent to, that is the difference
 * between a trial and a bounce.
 *
 * WHAT THIS IS NOT: a phone-sized drag-and-drop editor. Dragging a block into a
 * column with a thumb, on a canvas that has to be scaled to fit, is a worse
 * version of a thing that is already hard on a laptop, and pretending otherwise
 * would ship a screen nobody can use for its stated purpose.
 *
 * WHAT IT IS: the two things that DO work on a phone, given the whole surface.
 *
 *   1. Their system, rendered full width, scrolling. Not a thumbnail — the
 *      actual page, in their own register, on the same white mount it wears
 *      everywhere else. Most of what somebody does on a phone is look.
 *   2. The assistant, at half the screen. 「把客户改成屋主」 is a sentence, and
 *      a sentence is the one editing gesture a phone is genuinely better at
 *      than a mouse. The product's central claim is that you change your system
 *      by saying what you want; on a phone that stops being a convenience and
 *      becomes the entire interface.
 *
 * So the phone gets the AI editor and the desktop gets both. That is an honest
 * split rather than a fallback, and it is why this renders inside Puck's own
 * provider (through the `puck` override) rather than beside it: the assistant
 * reads and dispatches the same live canvas state either way, so an edit made
 * on a phone is the same edit, on the same undo stack.
 *
 * ── 2026-09-04：还差第三件，而它才是他每天在手机上要做的那一件 ──────────
 *
 * 上面那两条讲的都是「改」。而一个老板在工地上掏出手机，八成不是要改设计,
 * 是要**用**：查一张单、看客户欠多少、当场加一笔。
 *
 * 那件事这一页做不到，而且是明写着做不到的 —— 下面那个预览挂着
 * `pointer-events-none`，注解写的理由是「里面每一个连结都属於一套还不存在的系统」。
 * **那句话在 2026-08-30 之后就过期了**：十二个模块会写真资料，表格第一格是
 * 「改这一单」的连结，表头那颗「加一单」是真的路由，两条都检查自己的权限。
 * 一个理由过期了的禁用，跟一颗按不动的按钮是同一个缺陷的两面。
 *
 * 所以手机上现在是两格：
 *
 *   用  —— 他自己的系统，会重排、点得到、跟师傅看到的是同一支组件
 *          （`work-view.tsx`，本来只画给师傅）。**预设停在这一格。**
 *   改  —— 上面写的那两条，一个字都没有拿掉。
 *
 * ⚠️ **为什么不是把预览的 `pointer-events-none` 拿掉就好**：那个预览是
 * 「桌面版面的一张照片」，900px 宽、用滑的。要点一行记录得先滑过去，
 * 而他要的是查一张单，不是参观自己的版面。**两件事，两格。**
 */
export function MobileEditor({
  pageKey,
  style,
  palette,
  corners,
  systemLang,
  locale,
  navPages,
  isGeneratedDraft,
  onOpenSystem,
}: {
  style: StyleName;
  palette: string | null;
  /** 圆角倍数跟系统语言 —— 「用」那一格要拿它们画出跟师傅一模一样的页。 */
  corners: number;
  systemLang: SystemLang;
  locale: string;
  navPages: { key: string; label: string }[];
  /** Straight through to the assistant, which sends it to the route: a table
   *  row on a pipeline module is a business record, not a layout row. */
  pageKey: string;
  /** Passed straight through to the assistant: 排法 only applies to a page that
   *  has never been saved, and the route has to be told which this is. */
  isGeneratedDraft: boolean;
  /** 🔴 切到「用」那一格之前，把还没写下去的那一次自动保存先写掉。
   *
   *  「用」那一格里的每一行都是**连结**，点下去会离开这个编辑器 ——
   *  而 `editor-client.tsx` 的自动保存是「最后一次改动之后 2.5 秒」，
   *  而且它自己有一个 effect 在卸载的时候把那个计时器清掉。
   *  所以在这一格出现之前，一次 AI 改动之后两秒内点走 = 那次改动静静不见。
   *  这是这一格新带进来的风险，所以补在这一格里。 */
  onOpenSystem: () => void;
}) {
  const t = useTranslations("portal.editor");
  // The live canvas, not a copy threaded down: this component renders inside
  // the provider, so an edit the assistant makes appears in the preview above
  // it on the same frame.
  const { appState } = usePuck();

  /* 预设停在「用」。一个人打开自己的系统，第一件事是看它，不是改它 ——
     而这一格也正是桌面图标点下去该开的那一页（[任务 141](../../../../docs/founder-tasks.md)）。 */
  const [tab, setTab] = useState<"use" | "design">("use");
  /* 「更多」那一格开着没有。 */
  const [more, setMore] = useState(false);
  /* 底栏最多五格（那 16 个没有一个超过五格）。刚好五页就五格都放页面；
     超过五页，第五格让给「更多」。 */
  const FRONT = navPages.length > 5 ? 4 : navPages.length;
  const front = navPages.slice(0, FRONT);
  const rest = navPages.slice(FRONT);

  const tabClass = (on: boolean) =>
    /* 44px：拇指按得到。整格可按，不是只有那两个字 —— shoot:commission 在 390
       量到过一排 21px 的目标。 */
    `min-h-11 flex-1 border-b-2 px-4 [font-size:var(--text-sm)] ${
      on
        ? "[border-color:var(--color-primary)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]"
        : "border-transparent [color:var(--color-paper-dim)]"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" className="flex shrink-0 border-b [border-color:var(--color-ink-800)]">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "use"}
          className={tabClass(tab === "use")}
          onClick={() => {
            /* 先把还没写下去的那一次写掉，再让他看到一堆点得走的连结。
               见上面 onOpenSystem 的注解。 */
            onOpenSystem();
            setTab("use");
          }}
        >
          {t("phoneUse")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "design"}
          className={tabClass(tab === "design")}
          onClick={() => setTab("design")}
        >
          {t("phoneDesign")}
        </button>
      </div>

      {tab === "use" ? (
        <>
          {/* 🔴 换页由这个壳自己管，页面里那条侧栏在窄屏不画。

              量出来的理由（390px，2026-09-04）：那条 `aside` 在窄屏是一列
              flex，里面排着招牌、一颗整条宽的按钮、他每一页的连结、通知帐号
              三个带字的项目 —— 加起来 993px。它撑着 **180px 高的白**，
              而**装着页面连结的那一格宽度是 0**：他的页一个都画不出来。
              把它挤进 390 试过三种排法（换行 · 自己占一行 · 藏掉标签），
              每一种都是在替一个桌面的东西发明一个手机的版本 ——
              而那正是 `PHONE_COMPOSITION`（[任务 107](../../../../docs/founder-tasks.md)）
              该做的事，不是这一格该顺手做的。

              所以这一格照那 16 个真的老板端 app 的做法：**页面在顶上一条
              横着滑的带子**，招牌跟通知留给桌面。他在哪一页，底下那条
              面包屑本来就写着。

              ⚠️ 只在这个壳里藏 —— 师傅那一边（`work-view.tsx` 直接渲染）
              照旧有那条侧栏，而那条侧栏在窄屏本来的毛病记在任务档里。 */}
          {/* 🔴 这一条穿的是**工作台那一套**，不是编辑器的深色壳。
              老板 2026-09-04：`要贴合我们在桌面的设计感`。

              桌面上换页的那条侧栏是**浅色的**（`--color-nav-bg` 在系统那一套
              是白的），配一条细线跟一个近黑的「你在这一页」。这一条做的是
              同一件事，所以穿同一套 token —— 而不是再叠一条黑带。
              上面那两格（用 / 改设计）留在深色：那是 Formae 自己的壳，
              不是他的系统。 */}

        {/* 他自己的系统，会重排、点得到、跟师傅看到的是同一支组件。
            ⚠️ 没有 `pointer-events-none` —— 那正是这一格存在的理由。 */}
        {/* 藏掉的三样都是**同一句话的第二、第三次**，不是拿掉功能：
            侧栏（上面那一段讲了）· 面包屑（`Day to day / Clients`）·
            页面大标题跟那一句说明。上面那条带子已经写着他在哪一页。
            实测 390：他自己的第一行资料本来从 **463px** 才开始 ——
            一屏 844，前面 55% 是壳跟标签，而同一页出现三次「Clients」。

            ⚠️ **标题留着，只藏那一句说明。** 试过连标题一起藏，看图当场看到
            「加一个客户」那颗孤零零挂在左上角、右边一大片空 ——
            那正是 `align:admin` 那把尺自己在抓的「孤单的按钮」。
            桌面上那一行本来就是「标题在左、动作在右」，留着标题才是
            **贴合桌面**，而不是少一样东西。 */}
        {/* `pb-16`：底下那一条不可以吃掉最后一块。
            `check:reachable` 在 390 报「走势图 covered by 底栏」—— 一个飘在
            内容上、又不让内容躲开的东西，吃掉的正好是页面最后那一样。
            同一条我 9-03 在手机那几张 demo 上写过一次（那次是右下角那颗圆钮
            盖住 `RM 5,400`）。 */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-16 [&_aside[data-nav=side]]:hidden [&_[data-shell-bar]]:hidden [&_[data-page-title]>p]:hidden">
          <WorkView
            data={appState.data as Data}
            pageKey={pageKey}
            style={style}
            palette={palette}
            corners={corners}
            systemLang={systemLang}
            fill
          />
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            🔴 换页在**底下**，不是顶上。

            2026-09-02 量了 16 个专业老板端 app（ServiceM8 · Jobber ·
            Housecall · Fresha · Booksy · Xero · QuickBooks · Zoho · Square ·
            Loyverse · Odoo · monday · Asana · Trello · Notion · Shopee 卖家）
            —— **16 个里 16 个都有一条底部分页列**，而且是 3–5 格。
            9-04 我把它做在顶上，`shoot:phone` 当天就报「① 底部一条分页列 无」。

            为什么是底下：**他的拇指在底下。** 一个在工地上单手拿着手机的人，
            够得到的是下缘那一条，不是上缘。

            ⚠️ 三格以上五格以内，多的收进「更多」—— 那 16 个没有一个超过五格，
            而我们最多的一个客户开到八页。 */}
        <StyleScope
          register={style}
          palette={palette}
          data-surface={deskSurface(pageKey)}
          className="shrink-0"
        >
          {more ? (
            /* 剩下那几页。画在底栏上面，不是盖住它 —— 一个盖住自己入口的
               面板，关掉它的那颗按钮就在被盖住的那一格里。 */
            <div className="max-h-[46vh] overflow-y-auto [background-color:var(--color-canvas)] [border-top:var(--hairline)_solid_var(--color-ink-800)]">
              {rest.map((page) => (
                <Link
                  key={page.key}
                  href={`/${locale}/portal/${page.key}`}
                  onClick={() => setMore(false)}
                  className={`flex min-h-12 items-center [gap:var(--gap-inline)] [padding-inline:var(--pad-card-lg)] [font-size:var(--text-sm)] [border-bottom:var(--hairline)_solid_var(--color-ink-800)] ${
                    page.key === pageKey
                      ? "[color:var(--color-on-canvas)] [font-weight:var(--fw-semibold)]"
                      : "[color:var(--color-on-canvas-dim)]"
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center">
                    {railIcon(page.key, "h-[18px] w-[18px]")}
                  </span>
                  {page.label}
                </Link>
              ))}
            </div>
          ) : null}

          <nav
            aria-label={t("phoneUse")}
            className="flex items-stretch [background-color:var(--color-canvas)] [border-top:var(--hairline)_solid_var(--color-ink-800)]"
          >
            {front.map((page) => {
              const on = page.key === pageKey && !more;
              return (
                <Link
                  key={page.key}
                  href={`/${locale}/portal/${page.key}`}
                  onClick={() => setMore(false)}
                  aria-current={on ? "page" : undefined}
                  /* 每一格至少 56px 高、平分整条宽 —— 那 16 个都是这样，
                     而 44px 是拇指按得准的下限，图标加字要再高一点。 */
                  className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center [gap:2px] border-t-2 px-1 [font-size:var(--text-micro)] ${
                    on
                      ? "[border-color:var(--color-primary)] [color:var(--color-on-canvas)] [font-weight:var(--fw-semibold)]"
                      : "border-transparent [color:var(--color-on-canvas-dim)]"
                  }`}
                >
                  {/* 图标**加字**，不是只有图标。我们判 Durable 的时候
                      白纸黑字写过：没有字的图标＝死掉的按钮。 */}
                  <span className="grid h-5 w-5 place-items-center">
                    {railIcon(page.key, "h-[19px] w-[19px]")}
                  </span>
                  <span className="w-full truncate text-center">{page.label}</span>
                </Link>
              );
            })}
            {rest.length ? (
              <button
                type="button"
                onClick={() => setMore((v) => !v)}
                aria-expanded={more}
                className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center [gap:2px] px-1 [font-size:var(--text-micro)] ${
                  more
                    ? "[color:var(--color-on-canvas)] [font-weight:var(--fw-semibold)]"
                    : "[color:var(--color-on-canvas-dim)]"
                }`}
              >
                <span className="grid h-5 w-5 place-items-center [font-size:var(--text-lg)] leading-none">···</span>
                <span className="w-full truncate text-center">{t("phoneMore")}</span>
              </button>
            ) : null}
          </nav>
        </StyleScope>
        </>
      ) : (
        <>
      <p className="shrink-0 border-b px-4 py-2 [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
        {t("mobileHint")}
      </p>

      {/* Their page, full width and scrolling. `pointer-events-none` because
          this is a picture of a page: every link and control inside it belongs
          to a system that does not exist yet, and a tap that appears to do
          something and does not is worse than one that visibly cannot. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className={chrome.mount}>
          {/* THE SCROLLER IS A GRANDCHILD OF .mount, NOT ITS CHILD, and that
              nesting is the whole point of this div.

              chrome.module.css declares `.mount > * { overflow: hidden }` so the
              customer's system is clipped to the plinth's inner radius. That
              selector and Tailwind's `.overflow-x-auto` have the SAME
              specificity (0,1,0), so the one that wins is decided by source
              order -- and the CSS module lands after the utilities. The
              swipeable container below therefore computed to `overflow-x:
              hidden` and the swipe silently did nothing.

              Measured on a 390px iPhone viewport before this fix: scrollWidth
              900, clientWidth 354, and a drag moved scrollLeft by 0. A customer
              on a phone could see the left third of their own system and had no
              way to reach the rest of it -- while the comment directly below
              promised the opposite. Setting scrollLeft from script still
              worked, which is why nothing about it looked broken in code.

              Keeping the clip on this outer div preserves the rounded corners
              the mount exists for; the scroll moves one level in, where nothing
              overrides it. */}
          <StyleScope register={style} palette={palette} data-surface={deskSurface(pageKey)} className="ds-ground [background-color:var(--color-canvas)]">
            <div className="h-full overflow-x-auto">
              {/* COMPOSED AT A DESKTOP WIDTH AND SWIPED, not reflowed and not
                  scaled. Reflowing puts a five-column table and a 180px rail
                  into 366px, which is not what their system looks like — the
                  first thing they would see is a version of their own page that
                  will never exist. Scaling it to fit makes it honest and
                  unreadable. Swiping keeps both the proportions and the type
                  size, which is how every phone preview of a desktop layout
                  works. */}
              {/* 🔴 `SystemLangProvider` —— 看图才看到的：这一张预览里
                  搜索框写着「在这里筛选」，而这个客户的系统是英文的。
                  `work-view.tsx` 一直有包这一层，这一张没有，所以组件
                  退回自己的预设（中文）。`check:en` 量不到它 ——
                  它只在手机那一格里画得出来，而那把尺是在桌面宽度跑的。 */}
              <SystemLangProvider lang={systemLang}>
                <div className="pointer-events-none w-[900px]">
                  <Render config={puckConfig} data={appState.data as Data} />
                </div>
              </SystemLangProvider>
            </div>
          </StyleScope>
        </div>
      </div>

      {/* Half the phone screen, and pinned: on a phone the assistant is not a
          panel beside the work — it IS the work, so it gets a fixed share
          rather than whatever is left over.

          A TABLET IS NOT A TALL PHONE, and this is where that stopped being
          true. Puck's own floor is 1024px, so everything from 768 to 1023 --
          every iPad in portrait, every Android tablet -- lands in this layout.
          Screenshotted at 768: the customer's page got the top 45% and the
          assistant got 55% of a 1024px-tall screen, most of it empty space
          under three example chips. Half a tablet, spent on nothing.

          So the share is now a range rather than a number. On a phone it stays
          at 52%; from 640px up the assistant takes a third and the page takes
          the rest, which on a 768x1024 screen is about 640px of the customer's
          own system instead of 440. The composer stays pinned to the bottom in
          both, because that is where every assistant a customer has used puts
          it. */}
      <div className="flex h-[52%] shrink-0 flex-col border-t [border-color:var(--color-ink-800)] sm:h-[38%] md:h-[32%]">
        <AiAssistant pageKey={pageKey} 
          pages={navPages}
          locale={locale}
          activeStyle={style}
          isGeneratedDraft={isGeneratedDraft}
          compact
        />
      </div>
        </>
      )}
    </div>
  );
}
