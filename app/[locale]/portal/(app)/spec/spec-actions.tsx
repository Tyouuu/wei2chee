"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { btn } from "../kit";

/**
 * 规格书顶栏上的两颗按钮。
 *
 * ── 为什么把它们从纸上搬下来（2026-09-01）────────────────────────────────────
 * 这一页是**一份文件**：`chrome.paper` 的纸、`max-w-3xl` 的版心、
 * 一整套 `print:` 规则。而「回上一页」跟「交给我们建」两颗控件
 * **长在那张纸里面**，靠 `print:hidden` 在列印的时候藏掉。
 *
 * 那是两件事挤在一个身体里：**纸上不该有按钮**。一个客户把这份规格书
 * 印出来交给别人，纸上那两颗按钮从来不属於文件 —— 它们属於**外壳**。
 * 搬到 `PageBar` 之后，那张纸只剩文件，列印规则也少一条要维护的例外。
 *
 * ── 顺手补上的那颗：列印 ────────────────────────────────────────────────────
 * 🔴 **这一页整套 `print:` 样式写好了，而产品里没有任何一个地方可以按「列印」。**
 * 一份为了交出去而存在的文件，唯一的列印入口是浏览器选单 ——
 * 一个装修承包商不会去那里找。这个仓库最常犯的错是「能力有、线没接」，
 * 这是同一个形状：**样式写了，按钮没有。**
 *
 * ⚠️ 「交给我们建」按下去打给一个**不存在的号码**（`60123456789`）。
 * 那不是这一轮修的，也不该在这一轮修：老板 8-29 讲过
 * `别改别改 我过后会给你的`（重点 21），而 `npm run check:launch`
 * 已经把它列成上线前的挡路项。**它只差一个环境变数，代码一行都不用动。**
 */
export function SpecActions({ handoffHref, backHref }: { handoffHref: string; backHref: string }) {
  const t = useTranslations("portal.spec");
  return (
    <>
      {/* 「回编辑器」留着，只是换了位子。
          ⚠️ 拿掉它很容易 —— 侧栏本来就走得回去 —— 但这个外壳**没有面包屑**，
          一个人从这份文件里抬头，画面上唯一告诉他怎么回去的就是这一句。
          面包屑那件要老板点头，在那之前不要先把仅有的那条路也拆了。 */}
      <Link
        href={backHref}
        className="[font-size:var(--text-sm)] [color:var(--color-paper-dim)] underline underline-offset-4 hover:[color:var(--color-paper)]"
      >
        {t("back")}
      </Link>
      <button type="button" onClick={() => window.print()} className={btn("quiet")}>
        {t("print")}
      </button>
      <a
        href={handoffHref}
        target="_blank"
        rel="noopener noreferrer"
        className={btn("primary")}
      >
        {t("handoff")}
      </a>
    </>
  );
}
