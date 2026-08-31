"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 一段「会自己画出来的线稿」—— 机制只写一次。
 *
 * ── 从哪里来 ────────────────────────────────────────────────────────────────
 * 老板 2026-08-31 挑了 [consider.digital/story](https://consider.digital/story/)
 * （[任务 87](../../docs/founder-tasks.md)），然后：「都做 都做」。
 *
 * ── 2026-09-01 回去重看模版，量出我们差在哪 ─────────────────────────────────
 * 他讲：「线体框…弄得不够好 不够有特点」「我滑的时候不够流畅」
 * 「可以设计的比较有故事感」。逐格拍下来一看，三件事，每一件都数得出来：
 *
 *   1. **他们画的是真东西，我们画的是介面。** 风机 · 太阳能板 · 冷却塔 ·
 *      电塔 · 手机 · 灯泡 · 线框地球 —— 我们画的是浏览器外框、表格、卡片。
 *      **他们画世界，我们画后台。** 那就是「不够有特点」。
 *   2. **他们的图站在一条地平线上，底下标着名字**（wind / solar / nuclear /
 *      gas），而且**满幅贴着画面底部**；我们的挤在右边一栏里。
 *   3. **每一段有一个大数字**（400,000 伏 · 120,000 · 1 · 60 kg）——
 *      那是一段的「结论」，也是让它读起来像故事而不是像目录的东西。
 *
 * 滑不顺的根因也在这里：**钉住那一段以前只有电脑有**（`md:sticky`），
 * 手机上图一边往上跑一边画，两个运动叠在一起就是「不流畅」。现在两边都钉。
 *
 * ── 三条不可以破的（没有改） ────────────────────────────────────────────────
 * 1. **预设是画完的。** `p` 初值 1，JS 接手才归零 —— 没有 JS、整页截图、列印、
 *    爬虫都要看得到完整的图（[任务 28](../../docs/founder-tasks.md)）。
 * 2. **`prefers-reduced-motion` 直接给完成图。**
 * 3. **零依赖、零图片。** 纯 inline SVG + 一个 rAF。
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
      /* ⚠️ 没有这一行，手机上整张图几乎看不见 —— 而且是**算得出来的**：
         viewBox 是 1200 宽，画在 342px 的萤幕上，一条 1px 的线只剩 0.28px。
         `non-scaling-stroke` 让每一笔永远是萤幕上的 1px，不管图缩到多小。
         这跟「量到的东西不是画面上的东西」是同一类错的反面。 */
      vectorEffect="non-scaling-stroke"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - k}
      opacity={k > 0 ? (fill ? k : 1) : 0}
    />
  );
}

/**
 * 正文里被标出来的那一句。
 *
 * 模版整页只有三个地方有颜色：右边缘那条标签、几个被标出来的词、还有大数字。
 * 老板 2026-09-01：「我感觉青色那张只有一张的话有点奇怪」——
 * **把青撒进正文里，那一屏的青就不再是孤儿。**
 *
 * ⚠️ 用 `t.rich` 的 `<m>` 标签，不是把一句话切成三个字串再拼回去 ——
 * 中文跟英文的语序不一样，拼起来的句子在另一个语言里会散掉。
 */
export function Mark(chunks: React.ReactNode) {
  return <em className="text-[var(--color-primary)] not-italic">{chunks}</em>;
}

/** 一个圆，写成路径 —— `Stroke` 只吃 `d`，而轮子跟人头都是圆的。 */
export function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;
}

/**
 * 一整段。**版面照模版重排过**：字收在左上角一栏，
 * **图满幅贴着底部、站在一条地平线上、底下标着名字**，右上角一个大数字。
 *
 * ⚠️ 段要够高，而且内容要**钉住** —— 两件都要，而且**两个宽度都要**。
 * 只加高度：图留在顶端，滚到中段整个视窗是空的。
 * 只钉住不加高：六笔画不完就滚过去了（实测 1104px 只画到第四笔）。
 * 只在电脑钉：手机上图一边跑一边画 —— 老板 2026-09-01「滑的时候不够流畅」。
 */
export function LineScene({
  id, eyebrow, title, body, aside, steps, figure, figureCap, labels, children,
  viewBox = "0 0 1200 420",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  /** 正文。可以是 `t.rich(...)` 的产物 —— 模版会把一整句标出来，
   *  那是它整页除了那条边条以外唯一有颜色的地方。 */
  body: React.ReactNode;
  /** 左边一条细线框起来的等宽旁注。模版几乎每一段都有一块，
   *  写的是**关於这一页自己**的事实（它那句是「no images · no webfonts ·
   *  one small file」）。⚠️ 只写查得到的（[任务 19](../../docs/founder-tasks.md)）。 */
  aside?: string;
  steps: string[];
  /** 这一段的结论，一个大数字。模版每一段都有一个。 */
  figure?: string;
  figureCap?: string;
  /** 地平线底下标的名字，对齐图里那几个东西。 */
  labels?: string[];
  children: (stage: (i: number) => number, now: number, p: number) => React.ReactNode;
  viewBox?: string;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const p = useDrawProgress(host);
  const n = steps.length;
  const now = stepOf(p, n);

  return (
    <section id={id} ref={host} data-chapter={eyebrow} className="border-t border-border min-h-[220vh]">
      {/* ⚠️ 手机上底下留 96px 给同意条 —— 图贴着画面最底，而同意条就钉在那里。 */}
      <div className="sticky top-0 mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-6 pt-16 pb-24 md:pt-20 md:pb-8">
        {/* ── 上半：字。收在左边一栏，右上角一个大数字。 */}
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <span className="font-mono text-[0.6875rem] tracking-[0.18em] text-muted-foreground uppercase">
              {eyebrow}
            </span>
            <h2 className="mt-3 max-w-[16ch] text-[clamp(1.5rem,3.6vw,3rem)] leading-[1.06] tracking-[-0.02em]">
              {title}
            </h2>
            <p className="mt-3 max-w-[44ch] text-[0.8125rem] leading-relaxed text-foreground/65 md:mt-4 md:text-[0.9375rem]">
              {body}
            </p>
            {aside && (
              /* 左边一条细线的等宽旁注 —— 模版每一段都有一块。
                 它讲的是**关於这一页自己**的事实，不是行销话。 */
              <p className="mt-5 max-w-[46ch] border-l border-border py-1 pl-4 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
                {aside}
              </p>
            )}
          </div>
          {figure && (
            /* 这一段的结论。模版把它放得很大很孤单，那是它读起来像故事的原因。
               ⚠️ 手机上收起来 —— 390px 一屏里塞不下大数字又塞得下图。 */
            <div className="hidden shrink-0 text-right md:block">
              <div className="font-mono text-[clamp(2rem,4.5vw,3.5rem)] leading-none tabular-nums">
                {figure}
              </div>
              {figureCap && (
                <div className="mt-2 font-mono text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">
                  {figureCap}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 中间：步骤表。你读到第几步，图就画到第几笔。 */}
        <ol className="mt-5 font-mono text-[0.6875rem] md:mt-0 md:columns-2 md:gap-10 md:text-[0.75rem]">
          {steps.map((s, i) => {
            const on = p >= 0.12 && i <= now;
            return (
              <li
                key={s}
                className="flex gap-3 break-inside-avoid border-b border-border/60 py-1.5 transition-colors duration-300 md:py-2"
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

        {/* ── 下半：图。满幅、贴底、站在地平线上，底下标名字。 */}
        <div className="mt-5 md:mt-8">
          {/* ⚠️ 图要**封顶**。量出来：1440×900 上这个钉住的容器高 1084px ——
              **溢出 184px**，於是段底那条线跟章节标记永远在画面外，
              图的下缘也被切掉。一个「钉住」的东西比视窗高，就没有钉住这回事。
              封顶之后它会留白在两侧（`meet`），那是对的：宁可图小一点，
              不要一段读不完。 */}
          <svg
            viewBox={viewBox}
            preserveAspectRatio="xMidYMax meet"
            className="max-h-[30vh] w-full"
            style={{ color: "var(--line-ink, oklch(0.82 0.018 85))" }}
            role="img"
            aria-label={title}
          >
            {children((i) => stageOf(p, i, n), now, p)}
          </svg>
          {labels && (
            <div className="mt-2 flex justify-between font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
              {labels.map((l) => (
                <span key={l} className="flex-1 text-center first:text-left last:text-right">{l}</span>
              ))}
            </div>
          )}
          {/* 段底那条线 + 右下角再讲一次这是第几章 —— 模版每一屏底下都有。
              它让每一段读起来像一本书的一页，而不是一个滚动的区块。 */}
          <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-2">
            <span className="flex-1" />
            <span className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
              {eyebrow}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
