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
import { SystemView } from "./system-view";

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
        /* 他的系统 —— 跟老板打开 `/portal/<key>` 看到的是**同一支组件**。
           见 system-view.tsx 那段档头：桌面改成默认进「用」之后，
           在伺服器那一边再写一份手机壳，就是第七次「第二份手写拷贝」。 */
        <SystemView
          data={appState.data as Data}
          pageKey={pageKey}
          style={style}
          palette={palette}
          corners={corners}
          systemLang={systemLang}
          locale={locale}
          navPages={navPages}
          variant="phone"
        />
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
