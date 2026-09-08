"use client";

import { Render } from "@puckeditor/core";
// Renders through the register-aware config, so a block nobody has
// touched takes the shape THIS register prefers. See
// design-system/editor/puck-config-client.tsx.
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";

import { StyleScope } from "@/design-system/editor/style-scope";
import chrome from "@/app/[locale]/portal/chrome.module.css";
import { useLocale, useTranslations } from "next-intl";
import { sampleSystem } from "@/lib/portal/sample-system";
import { SystemLangProvider } from "@/design-system/system-lang-context";

/**
 * THE SHOWROOM, and the point where the page hands over.
 *
 * WHY IT EXISTS: measured on 2026-08-21, this landing page had 249 elements and
 * not one of them was a rendered system. A product whose entire pitch is "see
 * your system before you pay for it" was describing that system in prose. Every
 * comparable — Durable, Framer, Lovable — puts the artefact on the fold; this
 * one put an argument there.
 *
 * So a real one is rendered here, through the same `Render` + `puckConfig` path
 * the editor and the sign-in page use. Not a screenshot, not a diagram: the
 * actual components, in an actual register, with a contractor's actual words.
 * The same sample the sign-in page shows, deliberately — a visitor who signs up
 * and goes looking for it finds the same thing rather than a bait.
 *
 * ── 青的只有那一句，不是整段 ────────────────────────────────────────────────
 * 老板 2026-09-01：「我感觉青色那张只有一张的话有点奇怪 也不是很好看」。
 * **他讲对了，而且我第一版把两件事塞在同一块青上**：一句宣告，跟一块
 * 白底的产品面板。同一屏上三个地 —— 青 + 白 + 深色外壳，那正是他讲过的
 * 「四不像」（[任务 20](../../docs/founder-tasks.md)）。
 *
 * 模版的做法不是这样：consider.digital 整整 23670px **一次都没换过地色**，
 * 它的停顿是**一句话独占一屏**（「1 / PAGE SIZE / 0.5 g CO₂e」）。
 * 所以现在青只装那一句宣告，**面板搬回黑底** ——
 * 白面板在黑底上本来就是整页最亮的东西，「房间跟展品」那句话由展品自己讲。
 *
 * ⚠️ 2026-09-01 之前它是从黑**翻成白、而且再也不翻回来** —— 量完七个站之后
 * 拿掉了（模版5 整整 23670px 换 0 次；Stripe 换 2 次、Trafft 换 3 次，
 * 两个都换回来）。理由跟证据写在 components/handover.tsx 的档头。
 * `id="handover"` 留着：那一层 WebGL 靠它算什么时候卸载。
 */

// A client component because the landing page itself is one — `app/[locale]/
// page.tsx` holds the questionnaire's state, so everything it renders is on
// the client and `getTranslations` (server-only) throws there.
export function Showroom() {
  const t = useTranslations("showroom");
  // The sample follows the visitor's language. It used to be hardcoded
  // Chinese, so /en showed the product's central demonstration in a language
  // the visitor had explicitly declined. See lib/portal/sample-system.ts.
  const locale = useLocale();
  const sample = sampleSystem(locale, "show", true);

  return (
    <section id="handover" className="relative" aria-labelledby="showroom-heading">
      {/* ── 那一句宣告。满幅的青，只有字。 */}
      <div className="band-cyan border-y border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:px-10 md:py-28">
      <p className="annotation">{t("eyebrow")}</p>
      <h2
        id="showroom-heading"
        className="mt-4 max-w-[18ch] font-serif text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.04] tracking-[-0.025em] text-foreground"
      >
        {t("heading")}
      </h2>
      <p className="mt-5 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
        {t("body")}
      </p>
      {/* 那条把刚才那件事讲出来的线。没有它，颜色只是一个转场；有它，它是一句话。 */}
      <div className="mt-12 flex items-center gap-5">
        <span className="h-px flex-1 bg-border" />
        <span className="annotation shrink-0">{t("rule")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
        </div>
      </div>

      {/* ── 展品。搬回黑底 —— 白面板在黑底上是整页最亮的东西。 */}
      <div className="mx-auto max-w-5xl px-6 pt-16 pb-24 sm:px-10">
      {/*
        THE MOUNT, and the one element on this page that does not change colour.

        `handover-fixed` 把这一块用到的每一个 token 钉回页面自己的值，所以
        这块面板在黑底上跟在青带上长得一模一样。
        **房间换了，展品没有换** —— 那句话本来是白底在讲的，现在由青带讲，
        而它成立的前提就是这一块不跟着变。

        `chrome.mount` is the same white plinth the portal, the editor and the
        sign-in page use — so a visitor meets the object here in exactly the
        frame they will meet it in for the rest of the product.
      */}
      <div className={`handover-fixed ${chrome.mount} mt-12`}>
        <StyleScope register="ledger" className="[background-color:var(--color-canvas)]">
          <div className="pointer-events-none [padding:var(--pad-card-lg)]">
            {/* 🔴 示范的**资料**跟着他的语言走，而示范画面上那几个字没有 ——
            2026-09-08 `audit:platform` 在 `/en` 上量到「共 4 条」
            「全部 4 笔都在这里」。那几个字来自 `SYSTEM_WORDS`，
            而那个 context **预设是中文**（system-lang-context.tsx 写着
            为什么：一个没有被包起来的组件，读它的是那个要被卖的老板）。

            **同一件事两条路，只修了一条** —— showroom 那一支的注解
            自己就写着上一半：「It used to be hardcoded Chinese, so /en
            showed the product's central demonstration in a language the
            visitor had explicitly declined」。这是它的下一半。 */}
            <SystemLangProvider lang={locale === "zh" ? "zh" : "en"}>
              <Render config={puckConfig} data={sample as never} />
            </SystemLangProvider>
          </div>
        </StyleScope>
      </div>

      </div>
    </section>
  );
}
