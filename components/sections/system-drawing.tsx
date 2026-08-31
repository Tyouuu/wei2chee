"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * 一套系统，用线画出来。
 *
 * ── 从哪里来 ────────────────────────────────────────────────────────────────
 * 老板 2026-08-31，挑完 [consider.digital/story](https://consider.digital/story/)：
 * 「我覺得我們可以不放照片 可是我們要做5的風格 pattern出來」。
 *
 * 那一页每一段都是**一张自己画出来的线稿**：高压电塔一座一座走过整页、
 * 手机→基地台→机房、html/css/js 的等角堆叠。整页 **48 kB、零张图、一个请求** ——
 * 它不宣称自己轻，它就是轻的（[任务 87](../../docs/founder-tasks.md)）。
 *
 * 这一段是那个 pattern 的第一个落点，画的是**我们的产品**：
 * 一句话 → 一个外框 → 侧栏 → 数字 → 记录表 → 流程。
 * 滚到哪一步画哪一步。
 *
 * ── 为什么线稿比照片对 ──────────────────────────────────────────────────────
 * 一张产品截图讲的是「这一套长这样」；**一张会自己画出来的线稿讲的是「它是怎么长出来的」**，
 * 而后者才是我们在卖的东西（讲两分钟 → 当场看到）。
 * ⚠️ 但截图不会被这一段取代 —— 论证归线稿，**证据归截图**（三步那一段）。
 * 一个老板最后还是要看到真的画面。
 *
 * ── 三条不可以破的 ─────────────────────────────────────────────────────────
 * 1. **零依赖、零图片。** 纯 inline SVG + 一个 rAF —— 这一段自己就是
 *    「我们会写」的证据，装一个动画库进来会把这句话讲掉。
 * 2. **预设状态是画完的。** 没有 JS、整页截图、列印、爬虫都要看得到完整的图
 *    （[任务 28](../../docs/founder-tasks.md)：`animation-timeline: view()` 那次
 *    让整页截图变成空白）。所以 `--p` 的初值是 1，JS 接手之后才改成 0 往上跑。
 * 3. **`prefers-reduced-motion` 直接给完成图**，不是给一张空白。
 */

/** 一笔画多久 —— 每一组占整段进度的一个区间。 */
const STAGES = 6;

export function SystemDrawing() {
  const t = useTranslations("drawing");
  const host = useRef<HTMLDivElement | null>(null);
  const [p, setP] = useState(1); // 1 = 画完。见档头第 2 条。

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = host.current;
    if (!el) return;
    setP(0);
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      /* 这一段从「顶端进到视窗底」到「底端离开视窗顶」之间算 0→1。
         用视窗高当分母，所以一段多高都是同一条曲线。 */
      const span = r.height + window.innerHeight;
      const done = window.innerHeight - r.top;
      setP(Math.max(0, Math.min(1, done / span)));
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

  /* 第 i 组的进度：把 0→1 切成 STAGES 段，每段自己从 0 跑到 1。
     前面留 12% 当引子，后面留 8% 让最后一笔画完还看得到。 */
  const stage = (i: number) => {
    const a = 0.12 + (i / STAGES) * 0.8;
    const b = a + 0.8 / STAGES;
    return Math.max(0, Math.min(1, (p - a) / (b - a)));
  };

  const steps = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5"), t("s6")];
  const now = Math.min(STAGES - 1, Math.max(0, Math.floor(((p - 0.12) / 0.8) * STAGES)));

  return (
    /* ⚠️ 段要够高，不然画到一半就滚过去了。实测第一版 1104px：
         六笔只画得到第四笔，最后那一笔主色永远看不到。
         consider 那一页每一段 2400–3600px —— 它的图有时间画完。 */
    <section ref={host} className="border-t border-border md:min-h-[190vh]">
      {/* ⚠️ 高度给了还要**把内容钉住**，不然滚到段中段看到的是一片空。
          第一版只加了 min-h：段变成 1710px，而字跟图留在顶端，
          滚到 80% 整个视窗是空的。跟三步那一段的 `top-24` 是同一个错 ——
          **给了空间不等於内容还在眼前。** */}
      <div className="mx-auto max-w-7xl px-6 py-20 md:sticky md:top-0 md:flex md:min-h-screen md:flex-col md:justify-center md:py-16">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          {t("eyebrow")}
        </span>
        <h2 className="mt-3 max-w-[20ch] text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.08] tracking-[-0.02em]">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-[52ch] leading-relaxed text-foreground/65">{t("body")}</p>

        <div className="mt-14 grid gap-10 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-14">
          {/* 左边：等宽的步骤表，读到哪一步哪一步亮 —— consider 的注解语言 */}
          <ol className="font-mono text-[0.75rem]">
            {steps.map((s, i) => {
              const on = p >= 0.12 && i <= now;
              return (
                <li
                  key={s}
                  className="flex gap-3 border-b border-border/60 py-2.5 transition-colors duration-300"
                  style={{ color: on ? "var(--foreground)" : "oklch(0.52 0.012 265)" }}
                >
                  <span className="tabular-nums" style={{ color: i === now && p >= 0.12 ? "var(--color-primary)" : undefined }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{s}</span>
                </li>
              );
            })}
          </ol>

          {/* 右边：整张图。一条线都不是图片。 */}
          <div className="relative">
            <Drawing stage={stage} label={t} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** 一组线：`d` 是路径，`k` 是这一组画到哪了（0→1）。 */
function Stroke({ d, k, w = 1, accent = false }: { d: string; k: number; w?: number; accent?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      strokeWidth={w}
      stroke={accent ? "var(--color-primary)" : "currentColor"}
      strokeLinecap="square"
      /* 用 pathLength 归一化，所以每一笔不管多长，dash 都是 0→1 ——
         不用去量每一条路径的实际长度（量错一条，那一笔就永远画不完）。 */
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - k}
      opacity={k > 0 ? 1 : 0}
    />
  );
}

function Drawing({ stage, label }: { stage: (i: number) => number; label: (k: string) => string }) {
  const W = 720, H = 460;
  const s = [0, 1, 2, 3, 4, 5].map(stage);

  /* 一张后台的骨架：外框 → 侧栏 → 四格数字 → 记录表 → 流程 → 一句话落进标题 */
  const frame = `M8 8 H${W - 8} V${H - 8} H8 Z`;
  const rail = `M8 44 H${W - 8} M170 44 V${H - 8}`;
  const navs = [80, 108, 136, 164, 192].map((y) => `M28 ${y} H140`).join(" ");
  const tiles = [0, 1, 2, 3]
    .map((i) => {
      const x = 194 + i * 128;
      return `M${x} 72 h112 v72 h-112 Z M${x + 12} 96 h44 M${x + 12} 122 h64`;
    })
    .join(" ");
  const table = [
    `M194 176 H${W - 20} M194 176 V${H - 120} M${W - 20} 176 V${H - 120} M194 ${H - 120} H${W - 20}`,
    `M194 206 H${W - 20}`,
    ...[236, 268, 300].map((y) => `M194 ${y} H${W - 20}`),
    ...[300, 430, 560].map((x) => `M${x} 176 V${H - 120}`).slice(0, 3),
  ].join(" ");
  const flow = [0, 1, 2, 3, 4]
    .map((i) => {
      const x = 194 + i * 104;
      return `M${x} ${H - 96} h80 v48 h-80 Z` + (i < 4 ? ` M${x + 84} ${H - 72} h16` : "");
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full text-foreground/55"
      role="img"
      aria-label={label("alt")}
    >
      <Stroke d={frame} k={s[0]} />
      <Stroke d={rail} k={s[1]} />
      <Stroke d={navs} k={s[1]} />
      <Stroke d={tiles} k={s[2]} />
      <Stroke d={table} k={s[3]} />
      <Stroke d={flow} k={s[4]} />
      {/* 最后一笔是主色：流程里「你现在在哪一步」那一格 ——
          整张图只有一个地方有颜色，跟收据那一行同一条规矩。 */}
      <Stroke d={`M194 ${H - 96} h80 v48 h-80 Z`} k={s[5]} w={2} accent />
    </svg>
  );
}
