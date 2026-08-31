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

type Step = { term: string; detail: string; shot: string; alt: string };

export function ProcessShowcase() {
  const t = useTranslations("explainer.process");
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const marks = useRef<(HTMLDivElement | null)[]>([]);

  const steps: Step[] = [
    { term: t("s1"), detail: t("s1d"), shot: "/shots/ask.jpg", alt: t("s1") },
    { term: t("s2"), detail: t("s2d"), shot: "/shots/system.jpg", alt: t("s2") },
    { term: t("s3"), detail: t("s3d"), shot: "/shots/website.jpg", alt: t("s3") },
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
    <section id="how" className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
            PROCESS
          </span>
        </div>
        <h2 className="mt-3 max-w-[18ch] text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.08] tracking-[-0.02em]">
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
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-card">
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
    <div className="group flex gap-5">
      {/* 这一条就是「你读到哪里」：读到的时候变高、变宽、变成主色。
          LPAS 量出来动的正是 width / border-radius / color 这三样。 */}
      <span
        aria-hidden
        className="mt-2 block w-[3px] shrink-0 rounded-full transition-all duration-300 ease-out"
        style={{
          height: active ? "2.75rem" : "1rem",
          width: active ? "5px" : "3px",
          backgroundColor: active ? "var(--color-primary, #3b6cf5)" : "var(--border, #d4d4d8)",
        }}
      />
      <div>
        <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
          {String(i + 1).padStart(2, "0")}
        </span>
        <h3
          className="mt-1 text-lg transition-colors duration-300"
          style={{ color: active ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 62%, transparent)" }}
        >
          {step.term}
        </h3>
        <p className="mt-2 max-w-[46ch] leading-relaxed text-foreground/65">{step.detail}</p>
      </div>
    </div>
  );
}

function Frame({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-card">
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
