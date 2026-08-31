"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 一段「会自己画出来的线稿」—— 机制只写一次。
 *
 * ── 从哪里来 ────────────────────────────────────────────────────────────────
 * 老板 2026-08-31 挑了 [consider.digital/story](https://consider.digital/story/)
 * （[任务 87](../../docs/founder-tasks.md)），然后：「都做 都做 你不是已经有模版
 * 可以去学习了吗」。
 *
 * 那一页**八段各一张线稿**：电塔走过整页、手机→基地台→机房、html/css/js 的
 * 等角堆叠、点云、灯泡对 LED、线框地球。整页 48 kB、零张图。
 *
 * ⚠️ **所以要先有机制，不是先画第二张。** 第一张（system-drawing）把滚动进度、
 * 分段、dash 归一化全部写在自己里面；再复制一次就是两份会各自漂移的拷贝 ——
 * 而「一个决定被手写在七个地方」正是今天花掉最多时间的那个错
 * （品牌色换青那次）。这里把机制收成一份，每一段只描述**它画什么**。
 *
 * ── 三条不可以破的（跟第一张同一套） ───────────────────────────────────────
 * 1. **预设是画完的。** `p` 初值 1，JS 接手才归零 —— 没有 JS、整页截图、列印、
 *    爬虫都要看得到完整的图（[任务 28](../../docs/founder-tasks.md)）。
 * 2. **`prefers-reduced-motion` 直接给完成图。**
 * 3. **零依赖、零图片。** 纯 inline SVG + 一个 rAF。一段在讲「我们会写」的东西，
 *    装一个动画库进来会把那句话讲掉。
 */

/** 这一段滚到哪了（0→1）。段多高都是同一条曲线。 */
export function useDrawProgress(ref: React.RefObject<HTMLElement | null>) {
  const [p, setP] = useState(1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    setP(0);
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = r.height + window.innerHeight;
      setP(Math.max(0, Math.min(1, (window.innerHeight - r.top) / span)));
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
  }, [ref]);
  return p;
}

/** 把 0→1 切成 n 段，第 i 段自己从 0 跑到 1。
 *  前 12% 当引子、后 8% 留给最后一笔画完还看得到。 */
export function stageOf(p: number, i: number, n: number) {
  const a = 0.12 + (i / n) * 0.8;
  const b = a + 0.8 / n;
  return Math.max(0, Math.min(1, (p - a) / (b - a)));
}

/** 现在读到第几步。 */
export function stepOf(p: number, n: number) {
  return Math.min(n - 1, Math.max(0, Math.floor(((p - 0.12) / 0.8) * n)));
}

/**
 * 一组线。
 * ⚠️ `pathLength={1}` 把每一笔归一化，所以不管路径多长 dash 都是 0→1 ——
 * 去量每一条路径的实际长度，量错一条那一笔就永远画不完。
 */
export function Stroke({
  d, k, w = 1, accent = false, fill = false,
}: { d: string; k: number; w?: number; accent?: boolean; fill?: boolean }) {
  return (
    <path
      d={d}
      fill={fill ? "currentColor" : "none"}
      strokeWidth={w}
      stroke={accent ? "var(--color-primary)" : "currentColor"}
      strokeLinecap="square"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - k}
      opacity={k > 0 ? (fill ? k : 1) : 0}
    />
  );
}

/**
 * 一整段：标题 + 左边的等宽步骤表 + 右边钉住的线稿。
 *
 * ⚠️ 段要够高（190vh），而且内容要**钉住** —— 两件都要。
 * 只加高度：图留在顶端，滚到中段整个视窗是空的。
 * 只钉住不加高：六笔画不完就滚过去了（实测 1104px 只画到第四笔）。
 * 两个错今天各犯过一次。
 */
export function LineScene({
  id, eyebrow, title, body, steps, children, viewBox = "0 0 720 460",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  steps: string[];
  /** 拿到 (第 i 步画到哪, 现在读到第几步) 之后自己画 */
  children: (stage: (i: number) => number, now: number, p: number) => React.ReactNode;
  viewBox?: string;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const p = useDrawProgress(host);
  const n = steps.length;
  const now = stepOf(p, n);

  return (
    <section id={id} ref={host} className="border-t border-border md:min-h-[190vh]">
      <div className="mx-auto max-w-7xl px-6 py-20 md:sticky md:top-0 md:flex md:min-h-screen md:flex-col md:justify-center md:py-16">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
        <h2 className="mt-3 max-w-[20ch] text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.08] tracking-[-0.02em]">
          {title}
        </h2>
        <p className="mt-4 max-w-[52ch] leading-relaxed text-foreground/65">{body}</p>

        <div className="mt-12 grid gap-10 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-14">
          <ol className="font-mono text-[0.75rem]">
            {steps.map((s, i) => {
              const on = p >= 0.12 && i <= now;
              return (
                <li
                  key={s}
                  className="flex gap-3 border-b border-border/60 py-2.5 transition-colors duration-300"
                  style={{ color: on ? "var(--foreground)" : "oklch(0.52 0.012 265)" }}
                >
                  <span
                    className="tabular-nums"
                    style={{ color: i === now && p >= 0.12 ? "var(--color-primary)" : undefined }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{s}</span>
                </li>
              );
            })}
          </ol>

          <div className="relative">
            <svg viewBox={viewBox} className="w-full text-foreground/55" role="img" aria-label={title}>
              {children((i) => stageOf(p, i, n), now, p)}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
