"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * The settle-in on the auth pages.
 *
 * WHY IT EXISTS. Measured across every reachable surface, the signed-out half
 * of this product had zero transforms and almost no transitions — login was
 * 61 elements with `transforms: 0`. Meanwhile the landing page choreographs a
 * datum line drawing open and three blocks rising in sequence. A visitor moved
 * from a page that behaves like an object to one that simply appears, and then
 * into a portal that also simply appears. Motion was a thing this product did
 * once, on one page, which reads as three different products rather than one.
 *
 * WHY IT IS SMALL. 12px and 380ms, not the landing page's 20px and 700ms. The
 * hero is seen once and can afford to be watched; this is seen every time
 * somebody comes back to their own system, and motion at that frequency has to
 * be felt rather than noticed. Same reasoning as the portal's PageBody.
 *
 * `useReducedMotion` disables it outright rather than shortening it — somebody
 * who asked their OS for no animation is not asking for a faster one.
 */
export function AuthSettle({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Stagger between the form and the panel beside it, so the page assembles
   *  in reading order instead of arriving as one slab. */
  delay?: number;
}) {
  const still = useReducedMotion();

  return (
    <motion.div
      initial={still ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
