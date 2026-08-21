"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import chrome from "../chrome.module.css";

/**
 * THE PORTAL'S SECTION FRAME — and the answer to 「每个页面都是自己做自己」.
 *
 * WHAT WAS MISSING, MEASURED
 *
 * The acquisition site has a complete visual language and the portal used none
 * of it. Counted across both halves on 2026-08-21:
 *
 *   .annotation (mono margin labels) ..... marketing 15   portal  0
 *   SectionShell (numeral + label + rule)  marketing 24   portal  0
 *   serif display type ................... marketing  6   portal  1
 *   framer-motion ........................ marketing all  portal  0 files
 *
 * `chrome.module.css` had even defined `.annotation` already. It was used zero
 * times. So a visitor crossed from a page that annotates its margins like a
 * drawing into one that looks like a different company's admin panel, and every
 * portal screen then invented its own heading — which is exactly what "each
 * page doing its own thing" feels like from the outside.
 *
 * WHY THIS IS NOT JUST SectionShell IMPORTED
 *
 * That component is built for a page somebody SCROLLS THROUGH once: 7rem of
 * vertical padding, a 5.5rem numeral, and parallax between the margin and the
 * heading. All three are wrong on a surface somebody WORKS on. Parallax under
 * a table the customer is editing is motion for its own sake, and 7rem of air
 * between sections on a dashboard is a scroll tax.
 *
 * What carries across is the GRAMMAR, not the measurements: a margin column
 * that says what this is, a hairline that separates without boxing, and the
 * count riding beside the label rather than sitting in its own statistic.
 * Same sentence structure, spoken at working volume.
 */

/** One rhythm, everywhere. Three different page paddings were in use
 *  (`px-8 py-7`, `px-8 py-9`, `px-4 py-3`) and the composition read as three
 *  different pages because it was three different pages. */
export const PAGE_PADDING = "px-8 py-8";

/** Staggered settle. Deliberately small and quick -- 10px and 320ms -- because
 *  this runs every time a customer opens a page they are working in, and motion
 *  they will see forty times a day has to be felt rather than watched. The
 *  landing page's 20px/700ms is right for a thing seen once. */
const RISE = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function PageBody({ children }: { children: ReactNode }) {
  const still = useReducedMotion();
  return (
    <motion.div
      initial={still ? false : "hidden"}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } } }}
      className={PAGE_PADDING}
    >
      {children}
    </motion.div>
  );
}

/** A child of PageBody that rises with the stagger. Anything not wrapped in one
 *  of these appears instantly, which is the right default for a page's own
 *  chrome and the wrong one for its content. */
export function Rise({ children, className }: { children: ReactNode; className?: string }) {
  const still = useReducedMotion();
  return (
    <motion.div
      variants={still ? undefined : RISE}
      transition={{ duration: 0.32, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * A labelled section. The portal's dialect of the drawing-margin device.
 *
 * The label sits in a fixed 7rem margin column on wide screens so every section
 * on every page starts its content at the same x -- which is most of what makes
 * separate pages read as one product. On narrow screens it stacks, because a
 * 7rem margin on a phone is a 7rem hole.
 */
export function Section({
  label,
  count,
  action,
  children,
  className,
}: {
  /** Mono, uppercase, in the margin. Short -- it is a label, not a heading. */
  label: string;
  /** Rides beside the label rather than in its own box. 21st.dev's move, and
   *  the reason a library of nineteen reads as a library at all. */
  count?: number | string;
  /** One control, right-aligned on the rule. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Rise className={className}>
      <section className="grid gap-3 md:grid-cols-[7rem_1fr] md:gap-8">
        <div className="md:pt-px">
          <span className={chrome.annotation}>{label}</span>
        </div>
        <div className="min-w-0">
          {/* The hairline carries the count and the action, so a section header
              is one line rather than a stack of three. A rule that runs the
              full width and then stops is also the cheapest way to say "this
              group ends here" without drawing a box around it -- boxes inside
              boxes is what made the old gallery feel heavy. */}
          <div className="mb-5 flex items-center gap-4">
            <span className="h-px flex-1 [background-color:var(--color-ink-800)]" />
            {count !== undefined && (
              <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)] tabular-nums">
                {count}
              </span>
            )}
            {action}
          </div>
          {children}
        </div>
      </section>
    </Rise>
  );
}
