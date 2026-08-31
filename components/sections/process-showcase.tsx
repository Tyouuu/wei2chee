"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * 三步 —— 左边文字，右边**钉住**的产品画面，滚到哪一步换哪一张。
 *
 * ── 为什么是这个 ────────────────────────────────────────────────────────────
 * 老板 2026-08-31:「我要有点动效 就是比较现代一点的」。
 * 而量出来的东西跟直觉相反（[任务 85](../../docs/founder-tasks.md)）：
 *
 *     Trafft（SaaS 得奖）   滚动进场 900 块里 2 块   动的是 transform
 *     LPAS（header 得奖）   685 块里 13 块          动的是 width · 圆角 · 颜色
 *     我们                  385 块里 54 块          动的只有 hover 换色
 *
 * **得奖的产品站几乎不靠滚动淡入，我们比它们都多。** 所以「再加一层淡入」
 * 是往错的方向再走一步。这一段的动效是**内容在换**，不是装饰在动：
 * 你往下读一步，右边那台机器就换成那一步的画面。
 *
 * 同时它修掉量出来最大的一个洞：**整页 6344px 只有一张产品图**，
 * 而我们卖的就是「先看到你的系统」。这里一次放上四张真的画面。
 *
 * ── 三条不可以破的 ─────────────────────────────────────────────────────────
 * 1. **预设状态是看得见的。** 第一张图直接在，不靠 JS 才出现 ——
 *    [任务 28](../../docs/founder-tasks.md) 那次 `animation-timeline: view()`
 *    让整页截图变成空白，风格画廊、列印、爬虫一起坏掉。
 * 2. **`prefers-reduced-motion` 要真的关得掉** —— 关掉之后三张图**并排全部显示**，
 *    不是只剩一张：一个把动效关掉的人，不该因此少看到三分之二的内容。
 * 3. **390px 不钉住。** 手机上没有第二栏可以钉，图跟在每一步下面。
 *    ⚠️ 这个市场的人在手机上（[任务 26](../../docs/founder-tasks.md)：19 家里 15 家
 *    第一屏就给 WhatsApp）。
 */

type Step = { term: string; detail: string; shot: string; alt: string; caption: string };

export function ProcessShowcase() {
  const t = useTranslations("explainer.process");
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const marks = useRef<(HTMLDivElement | null)[]>([]);

  const steps: Step[] = [
    { term: t("s1"), detail: t("s1d"), shot: "/shots/ask.jpg", alt: t("s1"), caption: t("s1c") },
    { term: t("s2"), detail: t("s2d"), shot: "/shots/system.jpg", alt: t("s2"), caption: t("s2c") },
    { term: t("s3"), detail: t("s3d"), shot: "/shots/website.jpg", alt: t("s3"), caption: t("s3c") },
  ];

  useEffect(() => {
    if (reduced) return;
    /* ⚠️ 第一版用 IntersectionObserver 配一条 10% 的窄带，**第三步永远轮不到**：
       三步挤在 1449px 里，那条带一次可以同时装进两步，而回呼是「最后一个进来的」
       赢，不是「最靠近眼睛的」赢。实测滚到 15% 跟 50% 都还停在第一张。

       改成**算距离**：哪一步的中线离视窗中线最近，哪一步就是现在读的那一步。
       它是确定的（同一个滚动位置永远给同一个答案），而且步数变几步都不用改。 */
    let raf = 0;
    const pick = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestD = Infinity;
      marks.current.forEach((m, i) => {
        if (!m) return;
        const r = m.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      setActive(best);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick); };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  return (
    /* ⚠️ 我先做成浅底，做错了，老板当场纠正：
      「为什么要做浅色 我们就做黑色跟青色」。

      他讲「黑色一片都没有设计感」的时候，我读成「要加浅色」——
      而他要的是**让黑真的成立**。我自己量出来的第二个原因正好支持他：
      卡 #212938 在地 #0B0D13 上只差两阶，**边界几乎看不到** ——
      问题从来不是「太黑」，是**黑里面没有层次**。

      所以修的是三件，不是把它翻白：地压深、卡拉高、边线加重（见 globals.css），
      主色换成青（对地 8.4:1，原本那个蓝 6.1:1）。
      三张浅色的产品截图放在深底上，本身就是这一页最亮的东西 —— 那才是对比。 */
    <section id="how" className="border-y border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
            PROCESS
          </span>
        </div>
        <h2 className="mt-3 max-w-[18ch] text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.08] tracking-[-0.02em] ">
          {t("title")}
        </h2>

        {/* 关掉动效：三张并排，全部看得见。 */}
        {reduced ? (
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.term}>
                <Frame src={s.shot} alt={s.alt} priority={i === 0} />
                <StepText i={i} step={s} active />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-12 grid gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] md:gap-14">
            <div>
              {/* ⚠️ 每一步要够高（md:min-h-[70vh] 配 justify-center），不然三步挤在
                  一屏里，钉住的那张图还没换完整段就滚过去了 ——
                  实测 1449px 装三步，第三步永远轮不到。 */}
              {steps.map((s, i) => (
                <div
                  key={s.term}
                  ref={(el) => {
                    marks.current[i] = el;
                  }}
                  className="flex flex-col justify-center border-b border-border py-10 md:min-h-[70vh] md:py-16"
                >
                  <StepText i={i} step={s} active={active === i} />
                  {/* 手机上没有钉住的那一栏，图跟在每一步下面。 */}
                  <div className="mt-6 md:hidden">
                    <Frame src={s.shot} alt={s.alt} priority={i === 0} />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              {/* 钉住一整屏、垂直置中 —— 不是 top-24。
                  用 top-24 的时候图黏在视窗顶端，而每一步的字是置中的，
                  於是「这一步」跟「这一步的画面」在画面上差了半屏，右下角空一片。
                  看图才看得到，而那时候每一项读数都是绿的。 */}
              <div className="sticky top-0 flex h-screen items-center">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-card shadow-[0_24px_60px_-16px_rgba(0,0,0,.65)] ring-1 ring-[oklch(1_0_0/12%)]">
                  {steps.map((s, i) => (
                    <motion.div
                      key={s.shot}
                      aria-hidden={active !== i}
                      initial={false}
                      animate={{ opacity: active === i ? 1 : 0 }}
                      transition={{ duration: 0.32, ease: "easeOut" }}
                      className="absolute inset-0"
                      style={{ opacity: i === 0 ? 1 : 0 }}
                    >
                      <Image
                        src={s.shot}
                        alt={s.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 620px"
                        className="object-cover object-top"
                        priority={i === 0}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** 一步的字。**动的是形状跟颜色**，不是淡入 —— 见档头那三份读数。 */
function StepText({ i, step, active }: { i: number; step: Step; active: boolean }) {
  return (
    /* 设计感从**我们自己卖的东西**来：Formae 交的是一份规格书，
       所以这里说的是规格书的话 —— 大号等宽编号、细线、状态标注。
       动的是 LPAS 量出来的那三样（宽 · 圆角 · 颜色），不是再加一层淡入。 */
    <div className="flex gap-6 md:gap-8">
      <div className="flex flex-col items-center pt-1">
        <span
          className="font-mono text-[2rem] leading-none tabular-nums transition-colors duration-300 md:text-[2.75rem]"
          style={{ color: active ? "var(--foreground)" : "oklch(0.45 0.012 265)" }}
        >
          {String(i + 1).padStart(2, "0")}
        </span>
        {/* 这一条就是「你读到哪里」。 */}
        <span
          aria-hidden
          className="mt-3 block flex-1 rounded-full transition-all duration-300 ease-out"
          style={{
            width: active ? "3px" : "1px",
            minHeight: "2.5rem",
            backgroundColor: active ? "var(--color-primary)" : "oklch(1 0 0 / 18%)",
          }}
        />
      </div>
      <div className="pb-2">
        <span
          className="font-mono text-[0.625rem] uppercase tracking-[0.22em] transition-colors duration-300"
          style={{ color: active ? "var(--color-primary)" : "oklch(0.58 0.012 265)" }}
        >
          {active ? "NOW" : `STEP ${i + 1}`}
        </span>
        <h3
          className="mt-2 text-[1.375rem] leading-snug tracking-[-0.015em] transition-colors duration-300 md:text-[1.75rem]"
          style={{ color: active ? "var(--foreground)" : "oklch(0.62 0.012 265)" }}
        >
          {step.term}
        </h3>
        <p className="mt-3 max-w-[44ch] text-[0.9375rem] leading-relaxed" style={{ color: "oklch(0.72 0.012 265)" }}>
          {step.detail}
        </p>
        <p className="mt-4 font-mono text-[0.6875rem] tracking-[0.04em]" style={{ color: "oklch(0.58 0.012 265)" }}>
          {step.caption}
        </p>
      </div>
    </div>
  );
}

function Frame({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-card shadow-[0_18px_44px_-16px_rgba(0,0,0,.6)] ring-1 ring-[oklch(1_0_0/12%)]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 380px"
        className="object-cover object-top"
        priority={priority}
      />
    </div>
  );
}
