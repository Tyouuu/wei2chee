"use client";

import { useEffect } from "react";

/**
 * THE HANDOVER. The landing page changes colour once, from Formae's dark
 * ground to white paper, across the stretch where the visitor's own system
 * first appears.
 *
 * WHY IT IS NOT AN EFFECT. This product now runs on one rule — dark is
 * Formae's, light is the customer's — and the landing page is the only surface
 * that is both. Everything above the handover is us talking; everything below
 * it is about their business. The colour change is that sentence, performed.
 *
 * Two rules keep it from collapsing into decoration, and both are load-bearing:
 *
 *   1. THE CUSTOMER'S SYSTEM NEVER INTERPOLATES. It is light at the top of a
 *      dark page and light at the bottom of a white one — see `.handover-fixed`
 *      in globals.css. If the exhibit changed with the room, the whole point
 *      would be gone and this would be a gradient.
 *   2. THE PAGE TURNS ONCE. Not per section. A page that turns twice is a theme
 *      that cannot make up its mind, which is exactly the oscillation this
 *      settles.
 *
 * HOW: the tokens are written to the document root rather than to a wrapper, so
 * FIXED elements (the sticky header, the ambient backdrop) invert for free
 * instead of needing to be told. Every section on this page is already styled
 * through `text-foreground` / `text-muted-foreground` / `border-border`, which
 * Tailwind's `@theme inline` resolves straight to these custom properties — so
 * nothing below has to know this component exists.
 *
 * `prefers-reduced-motion` gets a single step at the midpoint rather than a
 * ramp. The information is "the ground changed here"; the ramp is only how it
 * is delivered.
 */

/*
 * THE GROUND EASES. THE INK JUMPS. This is the whole reason the file is
 * shaped this way, and it was found by screenshotting the transition rather
 * than by reasoning about it.
 *
 * Interpolating every token together produces a mid-point that is mid-grey
 * text on a mid-grey ground: measured at t=0.4, body copy at oklch 0.65 sat on
 * a ground at oklch 0.49, which is 1.6:1 and simply cannot be read. That is
 * unavoidable for ANY smooth crossfade between a dark theme and a light one —
 * a ground passing through the middle has no ink that contrasts with it.
 *
 * So the two halves of the palette are treated differently. The ground eases
 * (smootherstep, which spends less of its travel near the middle than
 * smoothstep does), and everything that has to stay legible ON that ground
 * flips in one step at the crossing point. There is a single frame where the
 * ink changes while the ground is mid-way; it measures ~3.3:1, it is a few
 * pixels of scroll wide, and it is never a resting position. Anything smoother
 * is worse, not better.
 */
type Triple = [number, number, number];

/** Eased. Surfaces — nothing is read directly off these. */
/* ⚠️ 这一整张表是 globals.css 的**第二份拷贝**，而且它每一帧写成 <html> 的
   inline style —— inline 赢过所有样式表。2026-08-31 改深色层次（地 0.16 → 0.13、
   卡 0.21 → 0.22）跟主色（蓝 → 青），globals.css 全部改完而**画面一点都没变**，
   四轮才查到是这里。
   handover-brand.test.ts 现在会盯着 from 那一栏，跟 globals.css 对不上就红。 */
const GROUND: Record<string, { from: Triple; to: Triple }> = {
  "--background": { from: [0.13, 0.012, 265], to: [1, 0, 265] },
  "--ink": { from: [0.13, 0.012, 265], to: [1, 0, 265] },
  // On the dark half a panel is LIGHTER than the ground; on the light half it
  // has to be darker, or every card vanishes into the page.
  "--ink-raised": { from: [0.22, 0.014, 265], to: [0.975, 0.002, 265] },
  "--card": { from: [0.22, 0.014, 265], to: [0.975, 0.002, 265] },
  "--popover": { from: [0.22, 0.014, 265], to: [0.975, 0.002, 265] },
  "--muted": { from: [0.26, 0.014, 265], to: [0.95, 0.003, 265] },
  "--secondary": { from: [0.26, 0.014, 265], to: [0.95, 0.003, 265] },
  "--accent": { from: [0.28, 0.03, 262], to: [0.94, 0.012, 262] },
};

/*
 * Stepped at the crossing, and then HELD AWAY FROM THE GROUND.
 *
 * Stepping alone is not enough, and the screenshot said so. At the instant
 * after the crossing the ground is still around oklch 0.62, and body copy
 * jumping straight to its resting light-half value of 0.46 gives 1.8:1 —
 * the heading became readable and the paragraph under it did not.
 *
 * So each of these carries a MINIMUM LIGHTNESS GAP from wherever the ground
 * currently is. On the dark side the ink is pushed lighter, on the light side
 * darker, and each one relaxes to its resting value only once the ground has
 * travelled far enough that the gap no longer binds. The resting values are
 * unchanged; this only governs the two hundred milliseconds in between.
 */
const INK: Record<string, { darkL: number; lightL: number; c: number; h: number; gap: number }> = {
  "--foreground": { darkL: 0.96, lightL: 0.18, c: 0.008, h: 265, gap: 0.42 },
  "--muted-foreground": { darkL: 0.68, lightL: 0.46, c: 0.014, h: 265, gap: 0.34 },
  /* ⚠️ 这里是品牌色的**第二份拷贝**，而且它每一帧写成 <html> 的 inline style ——
     inline 赢过所有样式表。2026-08-31 把 globals.css 的 --blueprint 换成青，
     整份 CSS 都对了，**画面一点都没变**，因为这一行还是旧的蓝。
     查了四轮才找到（服务的 CSS 是 #00bdb6，浏览器算出来却是 oklch(0.6600 0.17 262)
     —— 那个四位小数就是这里 toFixed 出来的）。
     **一份手写的拷贝活得比它描述的东西久**，这个仓库第五次。
     底下的 handover-brand.test.ts 现在会盯着它。

     青在两个地上不是同一个值：深底用 L 0.72（对 #0B0D13 是 8.4:1），
     浅底要压到 **L 0.55**（#008882，对白 4.34:1）才及格 —— 0.72 在白底上只有
     2.3:1，整段文字会糊掉。色相跟彩度不动，所以它还是同一个青。 */
  "--blueprint": { darkL: 0.72, lightL: 0.55, c: 0.13, h: 190, gap: 0.3 },
};

/** Hairlines. They flip polarity in one step rather than fading, because white
 *  at 11% eased into black at 11% crosses through a visible double edge — and
 *  nothing is read off them, so the gap rule above does not apply. */
const EDGES: Record<string, { from: string; to: string }> = {
  "--border": { from: "oklch(1 0 0 / 11%)", to: "oklch(0 0 0 / 11%)" },
  "--input": { from: "oklch(1 0 0 / 14%)", to: "oklch(0 0 0 / 14%)" },
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 6t⁵ − 15t⁴ + 10t³. Flatter at both ends and steeper through the middle than
 *  smoothstep, which is exactly the shape wanted here: linger on each ground,
 *  cross the illegible zone quickly. */
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

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
      // A DELIBERATELY SHORT BAND — about 40% of a viewport, roughly 380px on a
      // laptop. Spread over a full screen the page spends a long, readable-
      // looking stretch in the grey middle; compressed, the turn is decisive
      // and reads as one event rather than as a slow wash.
      const start = vh * 0.35;
      const end = -vh * 0.05;
      const raw = (start - top) / (start - end);
      const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      const eased = reduce ? (t < 0.5 ? 0 : 1) : smootherstep(t);
      const crossed = eased >= 0.5;

      let groundL = 0;
      for (const [name, spec] of Object.entries(GROUND)) {
        const l = mix(spec.from[0], spec.to[0], eased);
        const c = mix(spec.from[1], spec.to[1], eased);
        const h = mix(spec.from[2], spec.to[2], eased);
        if (name === "--background") groundL = l;
        root.style.setProperty(name, `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`);
      }
      for (const [name, spec] of Object.entries(INK)) {
        // Resting value, unless the ground has not travelled far enough yet —
        // then hold the gap. `max`/`min` mean this stops binding by itself.
        const l = crossed
          ? Math.min(spec.lightL, groundL - spec.gap)
          : Math.max(spec.darkL, groundL + spec.gap);
        const clamped = l < 0 ? 0 : l > 1 ? 1 : l;
        root.style.setProperty(name, `oklch(${clamped.toFixed(4)} ${spec.c} ${spec.h})`);
      }
      for (const [name, spec] of Object.entries(EDGES)) {
        root.style.setProperty(name, crossed ? spec.to : spec.from);
      }
      // Published so anything that is not a token — the ambient backdrop's
      // opacity, a drafting grid — can follow the same single source.
      root.style.setProperty("--handover-t", eased.toFixed(4));
    }

    function onScroll() {
      // rAF-throttled: scroll fires far more often than the screen repaints,
      // and writing thirteen custom properties per event is how a landing page
      // starts dropping frames on a mid-range Android.
      if (!frame) frame = window.requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      // Leaving the page must leave the tokens as globals.css defined them.
      // Without this, navigating from a scrolled landing page into /login
      // carries a half-white ground into a route that never asked for one.
      for (const name of [...Object.keys(GROUND), ...Object.keys(INK), ...Object.keys(EDGES)]) {
        root.style.removeProperty(name);
      }
      root.style.removeProperty("--handover-t");
    };
  }, [anchorId]);

  return null;
}
