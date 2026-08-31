"use client";

import { useTranslations } from "next-intl";

/**
 * 收尾的「规格」—— 一张收据。
 *
 * ── 从哪里来 ────────────────────────────────────────────────────────────────
 * 老板 2026-08-31 从 62 个 Awwwards 得奖站里挑了
 * [consider.digital/story](https://consider.digital/story/)（[任务 87](../../docs/founder-tasks.md)）。
 * 逐格滚动拍下来之后，它最强的一个东西不是那些线稿图，是**收尾那一格**：
 * 整页讲完「网页太重」之后，右下角放一张**这一页自己的收据** ——
 * `document 49 kB · images 0 · requests 1`。
 *
 * **它不是宣称自己轻，它把帐单摊开。** 那是「凸显技术」最省的做法，
 * 而且比加一个 3D 更难反驳（[任务 86](../../docs/founder-tasks.md) 讲的是同一件事的另一半）。
 *
 * 我们把同一个形状换成我们的东西：一个老板读完整页，最后看到的是
 * **他会拿到什么、要付多少**，用等宽字摊成一张单，不用一段行销话术。
 *
 * ── 三条规矩 ────────────────────────────────────────────────────────────────
 * 1. **每一个数字都要是真的，而且要跟代码对得上。**
 *    `landing-claims.test.ts` 盯着 proofA/proofB —— 官网曾经印着「17 套风格」
 *    而我们只有 6 套，那是砍风格那次没有人回头改的一行。
 * 2. **不放我们没有的东西。** 没有客户数、没有评分、没有「10,000+ 用户」——
 *    [任务 19](../../docs/founder-tasks.md)：假的东西不上线。一张收据上写一个
 *    编出来的数字，比不写更伤。
 * 3. **等宽 + 细线 + 数字右对齐。** 那是一份规格书说话的样子，也是
 *    consider 那一格的样子：没有卡片、没有阴影、没有图标。
 */
export function SpecReceipt() {
  const t = useTranslations("receipt");
  const p = useTranslations("hero");

  const rows: [string, string][] = [
    [t("pages"), t("pagesV")],
    [t("registers"), p("proofA")],
    [t("sections"), p("proofB")],
    [t("langs"), t("langsV")],
    [t("time"), p("proofC")],
  ];
  const money: [string, string][] = [
    [t("spec"), t("specV")],
    [t("build"), t("buildV")],
    [t("hosting"), t("hostingV")],
  ];

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:gap-20">
          <div>
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
              {t("eyebrow")}
            </span>
            <h2 className="mt-3 max-w-[16ch] text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.08] tracking-[-0.02em]">
              {t("title")}
            </h2>
            <p className="mt-4 max-w-[46ch] leading-relaxed text-foreground/65">{t("body")}</p>
          </div>

          {/* 收据本体。没有卡片、没有阴影 —— 一条上框线、一条下框线，中间全是细线。 */}
          <div className="font-mono text-[0.8125rem]">
            <div className="border-t border-border pt-1">
              {rows.map(([k, v]) => (
                <Line key={k} k={k} v={v} />
              ))}
            </div>
            <div className="mt-6 border-t border-border pt-1">
              {money.map(([k, v]) => (
                <Line key={k} k={k} v={v} />
              ))}
            </div>
            {/* 唯一一行主色 —— 一张单上只有一件事要人看。 */}
            <div className="mt-6 flex items-baseline justify-between border-t-2 pt-3 [border-color:var(--color-primary)]">
              <span className="uppercase tracking-[0.14em] [color:var(--color-primary)]">
                {t("freeK")}
              </span>
              <span className="tabular-nums [color:var(--color-primary)]">{t("freeV")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border/60 py-2.5">
      <span className="text-foreground/55">{k}</span>
      {/* 数字右对齐、等宽 —— 一列数字要对得起来才读得出来 */}
      <span className="shrink-0 tabular-nums text-foreground/90">{v}</span>
    </div>
  );
}
