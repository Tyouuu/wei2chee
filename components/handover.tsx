"use client";

import { useEffect } from "react";

/**
 * 滚动进度的发布者。**它以前会把整页从黑翻成白 —— 2026-09-01 拿掉了。**
 *
 * ── 为什么拿掉（量出来的，不是我觉得） ──────────────────────────────────────
 * 老板：「为什么要做浅色 我们就做黑色跟青色」，然后：「白色 你觉得要留吗…
 * 你去做深度研究先」。七个站整页滚下来，量画面上的**像素**（不是 CSS）：
 *
 *     模版5 consider.digital   换 0 次   跨度 0.01   ← 他自己挑的那一个
 *     Linear · Framer · Vercel 换 0 次   跨度 0.00
 *     Stripe                   换 2 次   跨度 0.86   但**换回来了**
 *     Trafft                   换 3 次   跨度 0.87   但**换回来了**
 *     我们（改之前）            换 1 次   跨度 0.87   **换了不回来**
 *
 * **会换地色的站每一次都换回来；只有我们上半页一个网站、下半页另一个网站。**
 * 而白那一半量出来是坏的：Showroom 的标题实测 **1.1:1**（白纸写白字），
 * 因为 `--foreground` 的过渡在收尾那一段跟地色对不上。
 *
 * ⚠️ **这推翻了一个记录在案的决定**（「深色是 Formae 的，浅色是客户的纸」），
 * 所以是当面问过他、他说「都做吧」才动的 —— 不是我自己删掉的。
 * 那句话现在由**展品**在讲：客户的系统本来就是白介面，摆在全黑页上它就是
 * 整页最亮的东西。**用展品分，不用把整个房间刷白。**
 *
 * ── 为什么这个档案没有整个删掉 ────────────────────────────────────────────
 * `--handover-t` 不只是给颜色用的。`components/ambient-backdrop.tsx` 读它来
 * **卸掉那一层 WebGL** —— 实测手机上它在不透明度已经是 0 的地方还在跑
 * 62 draws/s（任务 80）。删掉这个档案 = 那个耗电的 bug 原样回来，
 * 而 `npm run check:ambient` 会红。
 *
 * **所以它现在只做一件事：把「滚到哪了」发布出去。一个数字，没有颜色。**
 */
export function Handover({ anchorId = "handover" }: { anchorId?: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    function apply() {
      frame = 0;
      const anchor = document.getElementById(anchorId);
      if (!anchor) return;

      const vh = window.innerHeight;
      const top = anchor.getBoundingClientRect().top;
      // 一段刻意很短的带（约 40% 视窗）。摊开一整屏的话，页面会在中间
      // 那一段停留很久；压短了它是一个事件，不是一次慢慢的洗牌。
      const start = vh * 0.35;
      const end = -vh * 0.05;
      const raw = (start - top) / (start - end);
      const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      // 6t⁵ − 15t⁴ + 10t³ —— 两端平、中间陡。
      const eased = reduce ? (t < 0.5 ? 0 : 1) : t * t * t * (t * (t * 6 - 15) + 10);
      root.style.setProperty("--handover-t", eased.toFixed(4));
    }

    function onScroll() {
      // rAF 节流：滚动事件比萤幕重画频繁得多。
      if (!frame) frame = window.requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--handover-t");
    };
  }, [anchorId]);

  return null;
}
