"use client";

import { useRef, type ReactNode } from "react";
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

  return (
    <section ref={ref} id={id} className="mx-auto max-w-5xl px-6 py-28 sm:px-10">
      <div className="grid gap-10 md:grid-cols-[8rem_1fr] md:gap-14">
        {/* Sticky margin column. h-fit is required for position:sticky to work
            inside a grid item — without it the item stretches to the row height
            and there is nothing left to stick within. */}
        <motion.div
          style={{ y: numeralY, opacity: numeralOpacity }}
          className="md:sticky md:top-32 md:h-fit"
        >
          {index && (
            <div className="font-serif text-[clamp(3rem,7vw,5.5rem)] leading-none tracking-[-0.04em] text-blueprint/25 tabular-nums">
              {index}
            </div>
          )}
          <div className={index ? "annotation mt-2" : "annotation"}>{label}</div>
        </motion.div>

        <div>
          <motion.h2
            style={{ y: headingY }}
            className={`max-w-2xl font-serif leading-[1.05] tracking-[-0.02em] text-balance ${headingClassName}`}
          >
            {heading}
          </motion.h2>
          <div className="mt-12">{children}</div>
        </div>
      </div>
    </section>
  );
}
