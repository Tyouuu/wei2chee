"use client";

import { useEffect, useState } from "react";

/**
 * 右边那条青色的边条 —— 你现在读到哪一章，还有整页读了多少。
 *
 * ── 为什么加它（老板 2026-09-01 的一句话逼出来的） ──────────────────────────
 * 「我感觉青色那张只有一张的话有点奇怪 也不是很好看」「还是有更好的解法吗」。
 *
 * **他讲对了，而我第一版的解法是错的方向。** 我做了一整屏的青，
 * 而十四屏里只有一屏是青的 —— 那读起来像出错，不像决定。
 * 第一直觉是「再加几条青带」，但回去量模版之后那是错的：
 *
 *   consider.digital 整整 23670px **一次都没换过地色**。
 *   它的青出现在哪里？**一条riveted 在右边缘的青色小标签，每一屏都在**，
 *   加上正文里几个被标出来的词。青的面积很小，但**它从头到尾都在**。
 *
 * 所以真正的解法不是「多来几张青」，是**让青一直在**：
 * 一条永远在的青边条 → 那一屏的青就不再是孤儿，它是这条线的高点。
 *
 * ── 三条规矩 ────────────────────────────────────────────────────────────────
 * 1. **它不可以挡到任何东西。** 桌面 40px 的边槽，手机只留 2px 的线 ——
 *    390px 上每一个像素都是内容的（[任务 55](../docs/founder-tasks.md)：
 *    我们自己官网的第一屏在手机上有三个控件点不到）。
 * 2. **`aria-hidden`。** 它是一个进度指示，不是导航；读屏念一串
 *    「01 · WHAT YOU SAY」只会吵。章节标题本身在页面上是真的 h2。
 * 3. **`prefers-reduced-motion` 不特别处理** —— 它没有动画，
 *    它只是跟着滚动位置画。没有东西在动。
 */
export function ChapterRail() {
  const [t, setT] = useState(0);
  const [label, setLabel] = useState("");

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setT(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);

      /* 哪一章离眼睛最近就是哪一章 —— 跟 process-showcase 同一个算法。
         ⚠️ 不要用 IntersectionObserver 配一条窄带：一屏里可以同时装进两章，
         而回呼是「最后一个进来的」赢，不是「最靠近眼睛的」赢
         （[任务 85](../docs/founder-tasks.md) 那次第三步永远轮不到）。 */
      const mid = window.innerHeight / 2;
      let best = "";
      let bestD = Infinity;
      for (const el of document.querySelectorAll<HTMLElement>("[data-chapter]")) {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = el.dataset.chapter ?? "";
        }
      }
      setLabel(best);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 right-0 z-40 flex h-screen w-[2px] flex-col items-end md:w-10"
    >
      {/* 整页读了多少 —— 一条细线，青的那一段是走过的。 */}
      <div className="relative h-full w-[2px] bg-border md:mr-4">
        <div
          className="w-full origin-top bg-[var(--color-primary)] transition-none"
          style={{ height: `${t * 100}%` }}
        />
      </div>

      {/* 这一章叫什么。竖着排，贴着那条线 —— 手机上不画（没有那 40px）。 */}
      {label && (
        <span
          className="absolute top-1/2 right-5 hidden origin-right -translate-y-1/2 font-mono text-[0.625rem] tracking-[0.22em] whitespace-nowrap text-muted-foreground uppercase md:block"
          style={{ writingMode: "vertical-rl" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
