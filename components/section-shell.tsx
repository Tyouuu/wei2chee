"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/*
  The continuity device.

  Every section below the Hero renders through this shell, so the page reads as
  one continuously drafted sheet instead of stacked panels — which was the exact
  failure before: a dramatic Hero, then a cliff into flat, self-contained blocks.

  Three things do the work:

  1. An oversized ghost numeral, set in the display face at section-heading
     scale. It gives each section its own piece of Hero-level typographic
     presence, and it is real structure (the sheet's sequence), not decoration.
  2. A STICKY margin column. The numeral and label stay pinned beside the
     content while it scrolls past, so the eye keeps a fixed reference — the
     single cheapest way to make a long scroll feel like one space.
  3. Scroll-driven kinetic type. The heading and the margin drift at different
     rates through the section, so scrolling animates the composition rather
     than just revealing it once and stopping.
*/
export function SectionShell({
  index,
  label,
  heading,
  id,
  children,
  headingClassName = "text-[clamp(1.875rem,4vw,3rem)]",
  headingAs = "h2",
  ground = "paper",
}: {
  /** The section's place in the visitor's flow. Omit for sections that are
   *  reference material rather than a step -- pricing and FAQ are read in any
   *  order and at any time, and numbering them would assert a sequence that
   *  does not exist. It would also lie by omission: the flow's own sections
   *  (02-05) only exist once a visitor picks a trade, so a numbered reference
   *  section below them would read as 01, 06, 07 to everyone who hasn't. */
  index?: string;
  label: string;
  heading: ReactNode;
  id?: string;
  children: ReactNode;
  headingClassName?: string;
  /** 这个区段的标题用哪一级。首页上是 h2（第一屏那句才是 h1）；
   *  一个区段单独成一页的时候要传 "h1"。 */
  headingAs?: "h1" | "h2";
  /**
   * A GROUND OF ITS OWN.
   *
   * Below the hero the page ran one continuous near-white with a faint grid for
   * five thousand pixels, which is what the founder was describing when he said
   * 「整体还是不够好看」 and then 「我要看到提升设计感」. Every reference page
   * photographed on 2026-08-25 breaks that: Stripe alternates white and tinted
   * bands, Polar drops a row of near-black cards, Attio washes from white into
   * lavender. A page with one ground has no rhythm to read by, and the reader
   * loses their place in it.
   *
   * Deliberately ONE section, not alternating every other one. Two grounds is
   * a spine; four is a striped page.
   */
  ground?: "paper" | "ink";
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Different rates for margin vs heading — parallax between the two is what
  // makes the composition feel alive under scroll.
  const numeralY = useTransform(scrollYProgress, [0, 1], ["16%", "-16%"]);
  const numeralOpacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 1, 1, 0.25]);
  const headingY = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"]);

  const Heading = headingAs === "h1" ? motion.h1 : motion.h2;

  return (
    /* py-28 was 224px of air between every pair of sections, on top of the
       48px under each heading. Measured against the pages photographed on
       2026-08-25 -- Linear, Attio, Stripe, Polar -- which run 96 to 128. Ours
       read as a page with gaps in it rather than as a page with rhythm, and
       the founder's word for the whole thing was 「整体还是不够好看」. */
    <section
      ref={ref}
      id={id}
      /* 右边那条青边条读这一栏来显示「你现在读到哪一章」。
         写在这里而不是各个 caller 上：一个事实一个来源，
         不然它会变成又一份手写清单（这仓库栽过五次）。
         见 components/chapter-rail.tsx。 */
      data-chapter={index ? `${index} · ${label}` : label}
      data-ground={ground}
      /*
        A TOKEN REMAP, NOT A TEXT COLOUR.
        The first version set `text-white` on the band and the body copy inside
        it stayed dark: `Rows` styles itself with --foreground and
        --muted-foreground, and those still resolved to the page's light-surface
        values, so the section rendered a white heading over three rows of
        near-invisible grey. Exactly the mistake SystemShell's own navTone note
        warns about and the same fix: re-point the surface family on the one
        wrapper that owns the ground, and everything inside reads the new values
        without knowing anything happened.
      */
      style={
        ground === "ink"
          ? ({
              /* ⚠️ 这里本来写死 oklch(0.16 0.012 265)。2026-08-31 把地压深到 0.13
                 （老板：「黑色一片都没有设计感」，而量出来根因是黑里面没有层次），
                 globals.css 改完这一段还是旧的 —— 一个写死的颜色就是一份不会跟着走的
                 拷贝。跟 handover.tsx 那份是同一天同一个病。 */
              "--background": "var(--ink)",
              "--foreground": "oklch(0.97 0.004 265)",
              "--muted-foreground": "oklch(0.74 0.015 265)",
              "--border": "oklch(1 0 0 / 14%)",
              "--color-border": "oklch(1 0 0 / 14%)",
            } as CSSProperties)
          : undefined
      }
      className={
        ground === "ink"
          ? // Full-bleed on the outside, the same 5xl column on the inside: the
            // band has to reach both edges or it reads as a very large card.
            "w-full bg-[var(--background)] text-[var(--foreground)]"
          : "mx-auto max-w-5xl px-6 py-20 sm:px-10 sm:py-24"
      }
    >
      <div
        className={`grid gap-10 md:grid-cols-[8rem_1fr] md:gap-14 ${
          ground === "ink" ? "mx-auto max-w-5xl px-6 py-24 sm:px-10 sm:py-28" : ""
        }`}
      >
        {/* Sticky margin column. h-fit is required for position:sticky to work
            inside a grid item — without it the item stretches to the row height
            and there is nothing left to stick within. */}
        {/* PARALLAX ONLY WHERE THERE IS SOMETHING TO PARALLAX.
            The drift is ±16%, which on a 5.5rem ghost numeral reads as motion
            and on a lone 11px uppercase label reads as a label that is not
            lined up with its own heading -- and PRICE and QUESTIONS have no
            numeral. Screenshotted at 1440 on 2026-08-25: PRICE sat 40px below
            the baseline of the heading it labels, which is the kind of thing
            nobody can name and everybody can see. */}
        <motion.div
          style={index ? { y: numeralY, opacity: numeralOpacity } : undefined}
          className="md:sticky md:top-32 md:h-fit"
        >
          {index && (
            <div className="font-serif text-[clamp(3rem,7vw,5.5rem)] leading-none tracking-[-0.04em] text-blueprint/25 tabular-nums">
              {index}
            </div>
          )}
          <div
            className={`${index ? "annotation mt-2" : "annotation"} ${
              ground === "ink" ? "!text-white/50" : ""
            }`}
          >
            {label}
          </div>
        </motion.div>

        <div>
          {/* 标题层级可以换。**首页上这是 h2**（h1 是第一屏那句），
              但同一个区段搬到自己一页上（`/pricing`）的时候，
              那一页会**一个 h1 都没有** —— 对搜寻引擎跟读屏都是缺陷。
              2026-09-01 加，因为价钱页量出来 h1 = 0。 */}
          <Heading
            style={{ y: headingY }}
            className={`max-w-2xl font-serif leading-[1.05] tracking-[-0.02em] text-balance ${headingClassName}`}
          >
            {heading}
          </Heading>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </section>
  );
}
