"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import { StyleScope } from "@/design-system/editor/style-scope";
import { railIcon } from "@/design-system/components/rail-icons";
import { deskSurface } from "@/lib/portal/system-register";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import type { SystemLang } from "@/lib/system-lang";
import { WorkView } from "./work-view";
import { WorkAssistant } from "./work-assistant";

/**
 * 他的系统，加上手机上那一层壳 —— 换页的底栏、藏起来的侧栏。
 *
 * ── 为什么它是一支，不是两支 ──────────────────────────────────────────────
 *
 * 这一整块本来长在 `mobile-editor.tsx` 的「用」那一格里。2026-09-05
 * 桌面也改成默认进「用」之后（见 lib/portal/front-door.ts），**伺服器直接
 * 回 `WorkView`，把那个壳整个跳过去了** —— 实测 390：那条侧栏横着长到
 * 993px、通知跟帐号被切在画面外，底下那条分页列也不见了。
 *
 * 🔴 **而那是我自己这一改弄出来的回归，读数全绿，看图才看到。**
 *
 * 修法不是在伺服器那一边再写一份手机壳 —— 这个仓库栽在「第二份手写拷贝」上
 * 至少六次。所以抽成这一支，两边共用：
 *
 *   · `variant="phone"`      编辑器里那一格（装在一个已经有高度的盒子里）
 *   · `variant="responsive"` 老板打开自己的系统那一页（宽的时候画侧栏，
 *                            窄的时候藏起来换成底栏）
 *
 * 断点跟 `editor-client.tsx` 的 `NARROW` 是同一个（`max-width: 1023px`
 * ＝ Tailwind 的 `max-lg`）。**两个地方各写一个数字，就是两个断点。**
 */
export function SystemView({
  data,
  pageKey,
  style,
  palette,
  corners,
  systemLang,
  locale,
  navPages,
  variant,
  designHref,
  designLabel,
}: {
  data: Data;
  pageKey: string;
  style: StyleName;
  palette: string | null;
  corners: number;
  systemLang: SystemLang;
  locale: string;
  navPages: { key: string; label: string }[];
  variant: "phone" | "responsive";
  /** 「改设计」去哪。编辑器里那一格不给 —— 它上面已经有那两格了。 */
  designHref?: string;
  designLabel?: string;
}) {
  const t = useTranslations("portal.editor");
  /* 「更多」那一格开着没有。 */
  const [more, setMore] = useState(false);
  /* 底栏最多五格（那 16 个没有一个超过五格）。刚好五页就五格都放页面；
     超过五页，第五格让给「更多」。 */
  const FRONT = navPages.length > 5 ? 4 : navPages.length;
  const front = navPages.slice(0, FRONT);
  const rest = navPages.slice(FRONT);

  /* 窄的时候藏三样（侧栏 · 顶上那条 · 页面那句说明），宽的时候一样都不藏 ——
     桌面上那条侧栏就是换页的地方。

     🔴 **两行都必须整条写在原始码里，不可以拼。** 第一版是
     `hide.split(" ").map((c) => `max-lg:${c}`)` —— Tailwind 扫的是**原始码的
     文字**，一个在执行时才拼出来的 class 名字它从来没看到过，所以那三条规则
     根本没有产生。看图当场看到：那条侧栏还在，而且还是横着长出画面外。
     同一家的错这个 session 撞过第二次（上一次是一个带引号的 arbitrary
     variant，一样是静静地什么都不产生）。 */
  /* 那一条开着没有。**住在这里不住在那一块里面**，因为开着的时候
     整页内容要往左收 345px（见底下 `askClass`）。 */
  const [ask, setAsk] = useState(false);
  /* 侧栏那一行按下去只发一个事件 —— 那条侧栏是伺服器画出来的一个块，
     它接不到这里的 state，而**一个事件比一条穿过五层的 prop 便宜得多**。 */
  useEffect(() => {
    const open = () => setAsk(true);
    window.addEventListener("formae:ask-open", open);
    return () => window.removeEventListener("formae:ask-open", open);
  }, []);

  const wrapClass =
    variant === "phone"
      ? "min-h-0 flex-1 overflow-y-auto pb-16 [&_aside[data-nav=side]]:hidden [&_[data-shell-bar]]:hidden [&_[data-page-title]>p]:hidden"
      /* 🔴 `max-lg:pb-16`：**平板上那条分页列本来盖着内容最后那一段。**
         手机那一支（上面）一直都有 `pb-16`，而 820 走的是这一支，它只有
         `lg:pb-14` —— 也就是「宽屏躲得开、平板躲不开」。
         2026-09-09 三个行业拍 820 才看到（[任务 318](../../../../docs/founder-tasks.md)）。

         🔴 而它是 `pb-32` 不是 `pb-16`：窄屏上讲话那颗圆钮浮在下缘 72px、
         自己 56px 高，上缘落在 128px —— 一个飘在内容上、又不让内容躲开的东西，
         吃掉的正好是页面最后那一样。这一条这个档案自己写过三次，
         我不打算变成第四次。 */
      : `min-h-screen max-md:pb-32 max-md:[&_aside[data-nav=side]]:hidden max-md:[&_[data-shell-bar]]:hidden max-md:[&_[data-page-title]>p]:hidden${
          ask ? " lg:pe-[345px]" : ""
        }`;
  /*
    🔴 那一刀从 `lg` 提到 `md` —— 也就是 **iPad 直立（820）留着他自己的侧栏**。

    他 2026-09-09：`桌面手機跟ipad端 這三個都是要調整好的`。
    量出来这个仓库**平板那一档一次都没有量过**（1440 量了 101 处 · 390 量了
    39 处 · 744–1180 是 0 处，[任务 317](../../../../docs/founder-tasks.md#317)）——
    而 820 走的是 `max-lg` 那一支，於是**它穿的是手机那一套壳**：
    侧栏藏起来、顶栏藏起来、底下一条分页列。实拍三个行业都一样。

    参考读数也在那一条里：外面 11 套后台在 820 上**只有 Ant Design Pro 做对**
    ——它把侧栏收成一条 64 的图标条，把 192px 还给内容。
    ⚠️ **我们今天只做第一步**：820 有 580px 给内容（一栏摆得下），
    所以先把侧栏还回去，而**不是**发明一个我们没有的图标条模式
    （那要 RailNav 换 variant，而那一支的样子是由风格挑的，不是由视窗宽挑的）。
    收成图标条排在后面，落点写在任务档里。

    ⚠️ `md` 是 768：一台 iPad 直立（820）在这一边，一支手机（390）在那一边。
  */
  /* 底栏在手机上才画 —— 平板跟桌面都有侧栏。 */
  const barClass =
    variant === "phone"
      ? "shrink-0"
      : "fixed inset-x-0 bottom-0 z-30 md:hidden";
  /*
    🔴 用讲的做事那一条，贴在**画面**下缘 —— 不是挂在页尾。

    第一版挂在页尾（放在内容那一层里面），尺子数到它而 1440 的实拍里
    **一个像素都看不到**：报价单那一页比一屏长。改成贴之后再看一次，
    它压在侧栏的「Ranking」上并且被切掉一半 —— 因为内容那一层
    **包含他自己那条侧栏**，一条在里面贴着的东西会盖到它。
    [重点 7l] 两次：数字过关不等於眼睛过关。

    所以照这个档案自己那条底栏的做法（上面 `barClass`）：整页宽、`fixed`、
    在内容外面。窄屏留给那一条分页列（`lg:hidden`），这一条只在 `lg` 以上 ——
    两条叠在同一条边上，吃掉的永远是内容最后那一样，同一条这里写过三次。

    ⚠️ 而它要让内容躲开自己（`lg:pb-14`），理由同上：一个飘在内容上、
    又不让内容躲开的东西，吃掉的正好是页面最后那一样。
  */
  /* 🔴 `max-lg:hidden` 拿掉了 —— 而上面那一段的理由一个字都没有被推翻。
       它讲的是「不要在下缘再贴一条」，不是「窄屏上不要有入口」。
       窄屏那一边现在是一颗**离下缘 72px** 的圆钮（见 work-assistant），
       避得开那条 64px 的分页列，谁都不贴谁。
       这个盒子本身在窄屏上是零高度的 —— 里面那颗钮自己 `fixed`。 */
  /* 🔴 那一条现在贴右边，不是贴下缘 —— 老板 2026-09-09 把下缘那一版退回来
       （`整个在下面那个ai助手的Ui设计 我不要了`），叫我去看别人怎么做。
       拍了 23 家，真的开得出面板的六家里他挑了「右边一整条」那一种
       （Stripe 文件 · assistant-ui）。规格逐项量在[任务 318]。

       ⚠️ 这个盒子本身**收起来的时候是空的** —— 入口在侧栏那一行
       （`RailNav` 的 `askLabel`），窄屏是里面那颗自己 `fixed` 的圆钮。 */
  const askClass = "";

  return (
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
      <div className={wrapClass}>
        <WorkView
          data={data}
          pageKey={pageKey}
          style={style}
          palette={palette}
          corners={corners}
          systemLang={systemLang}
          fill={variant === "phone"}
          designHref={designHref}
          designLabel={designLabel}
        />
      </div>

      {/*
        🔴 用讲的做事 —— 那 11 个动作第一次在**他的系统**上够得到。
        他 2026-09-09 问的：`如果是產品為什麼不是接在產品裡面呢`。
        见 work-assistant.tsx 的档头，位置的理由见上面 `askClass`。

        ⚠️ **只在 `responsive`**，也就是他自己打开的那一页。
        `phone` 那一种装在 `mobile-editor.tsx` 里面，而那个外壳已经挂着
        编辑器那一块完整的助手 —— 两块助手同一屏，是「同一件事两个入口」，
        正好是这个仓库最贵的那一类缺陷。

        ⚠️ 长相不是这里决定的（`你只是要接功能 反正Ui是另外一邊設計的`）。
        它现在是一条能按的线，排法跟密度登记在任务档里给画面那一边。
      */}
      {/* 🔴 Stripe 那一条是**把内容推开**，不是浮在字上面
            （2026-09-09 在 1400 的实拍上量的：内容从 1400 收到 1055）。
            一个浮在他表格上的面板会盖掉最右边那一栏，而那一栏通常是钱。
            窄屏整屏，所以窄屏不留这一段。 */}
      {variant === "responsive" ? (
        <StyleScope
          register={style}
          palette={palette}
          data-surface={deskSurface(pageKey)}
          className={askClass}
        >
          <WorkAssistant
            pageKey={pageKey}
            data={data}
            pages={navPages}
            open={ask}
            setOpen={setAsk}
          />
        </StyleScope>
      ) : null}

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
        className={barClass}
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
            {/* 🔴 「改设计」住在这里，不是浮在页面上。
                  窄屏那颗浮着的药丸试过三版，三版都在吃掉页面最后那一样东西
                  （见 work-view.tsx）。而它本来就跟这几页是同一类：
                  **Formae 的导航**，不是他系统里的一块。

                  ⚠️ 所以「更多」那一格在有它的时候一定要画 —— 一个客户只开了
                  四页的时候本来没有「更多」，而那样他在手机上就再也进不去
                  改设计了。 */}
            {designHref ? (
              <Link
                href={designHref}
                onClick={() => setMore(false)}
                className="flex min-h-12 items-center [gap:var(--gap-inline)] [padding-inline:var(--pad-card-lg)] [font-size:var(--text-sm)] [color:var(--color-on-canvas-dim)]"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center [font-size:var(--text-lg)] leading-none">
                  ✎
                </span>
                {designLabel}
              </Link>
            ) : null}
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
                <span className="w-full truncate text-center">
                  {page.label}
                </span>
              </Link>
            );
          })}
          {rest.length || designHref ? (
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
              <span className="grid h-5 w-5 place-items-center [font-size:var(--text-lg)] leading-none">
                ···
              </span>
              <span className="w-full truncate text-center">
                {t("phoneMore")}
              </span>
            </button>
          ) : null}
        </nav>
      </StyleScope>
    </>
  );
}
