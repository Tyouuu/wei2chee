"use client";

import { useEffect } from "react";

/**
 * 滚动进场 —— and the reason it can exist this time.
 *
 * ── WHY IT WAS REMOVED BEFORE ─────────────────────────────────────────────
 *
 * The first attempt used `animation-timeline: view()`, the modern
 * compositor-driven way with no listener. Then the OKLab sample of the page
 * came back with a contrast span of 0.10 and 0% colour, worse than before the
 * whole finish layer, and the screenshot explained it: a full-page capture does
 * not scroll, so every section below the fold sat at its `from` keyframe,
 * invisible. That is not a measurement problem. It is the feature's real
 * behaviour everywhere a page renders without scrolling — print, a crawler,
 * a link preview, and our OWN style gallery, which draws whole pages scaled
 * down to a thumbnail. Fourteen register cards would have shown a hero and a
 * blank page.
 *
 * ── WHY THIS ONE IS SAFE ──────────────────────────────────────────────────
 *
 * The hidden state is never in the stylesheet. CSS renders every section
 * VISIBLE; this component adds `data-reveal-armed` to the root at runtime,
 * and only then does the hidden state apply. So:
 *
 *   · no JavaScript (crawler, link preview, print) → everything visible
 *   · JavaScript, but capture before hydration          → everything visible
 *   · prefers-reduced-motion                            → never armed
 *   · a real reader                                     → sections arrive
 *
 * The gallery keeps working because it renders the tree without this mounting.
 * That is the property `animation-timeline: view()` could not give at any
 * price, and it is worth a listener.
 *
 * ── WHERE IT COMES FROM ───────────────────────────────────────────────────
 *
 * tympanus.net/codrops, sent by the founder 2026-08-27. Their Playground is
 * tagged `scroll` more than anything else — Blurry Text Reveal on Scroll,
 * Consecutive Scroll Animations, On-Scroll Layout Formations — and their demos
 * are MIT. What is NOT taken from them is the machinery: their scroll work
 * runs on GSAP ScrollTrigger, and GSAP's licence asks for a Business
 * membership from anyone charging their end users an access fee, which is
 * exactly what RM199 a month is. The technique is not copyrightable and does
 * not need to be bought. Twelve lines of IntersectionObserver do it.
 *
 * The blur is theirs and it is the part that reads as expensive: type that
 * sharpens as it arrives, rather than sliding.
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* THE PAGE'S OWN TOP-LEVEL BLOCKS. `.ds-site > * > *` is what globals.css
       already gives the measure and the rhythm to, so it is the same set the
       page is composed of -- and marking them here rather than in fourteen
       components means a new section joins the motion by existing. */
    const targets = document.querySelectorAll<HTMLElement>(".ds-site > * > *");
    if (!targets.length) return;

    /* ARM ONLY NOW. Everything above this line rendered visible, which is the
       whole safety property -- see the note above. */
    root.setAttribute("data-reveal-armed", "");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-revealed", "");
          io.unobserve(e.target);
        }
      },
      /* A section counts as arrived once a tenth of it is up, and the bottom
         margin means it has already started before it reaches the fold --
         which is what stops the page feeling like it is catching up with the
         reader. */
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );

    for (const el of targets) {
      el.setAttribute("data-reveal", "");
      io.observe(el);
    }

    /* A page shorter than the viewport never fires an intersection change for
       what is already on screen in some browsers, and a reader who never
       scrolls would see a permanently hidden page. Belt and braces. */
    const failsafe = window.setTimeout(() => {
      for (const el of targets) el.setAttribute("data-revealed", "");
    }, 2500);

    return () => {
      window.clearTimeout(failsafe);
      io.disconnect();
      root.removeAttribute("data-reveal-armed");
    };
  }, []);

  return null;
}
