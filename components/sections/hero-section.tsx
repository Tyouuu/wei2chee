"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useSpring, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";
import { BRAND_NAME } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";

// Instrument Serif carries its weight through stroke contrast, not mass — so it
// is set at 400 (no font-bold) and allowed to get genuinely large. Negative
// tracking at this scale is what makes it read as typeset rather than default.
const HEADLINE_CLASSNAME =
  "max-w-4xl font-serif text-[clamp(2.75rem,8.5vw,6.5rem)] leading-[0.95] tracking-[-0.03em] text-balance";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function HeroSection({ onCtaClick }: { onCtaClick: () => void }) {
  const t = useTranslations("hero");
  const sectionRef = useRef<HTMLElement>(null);

  // The shader surface itself now lives in AmbientBackdrop, fixed behind the
  // entire page, so the atmosphere carries into every section below instead of
  // hard-cutting at the Hero's bottom edge. What stays here is the Hero's own
  // scroll choreography.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  // Kinetic exit: the block rises and settles back as it leaves, rather than
  // just fading — the type behaves like an object in the scene.
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const contentScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  // Magnetic CTA: drifts toward the cursor within its own bounds, springs back.
  const ctaX = useMotionValue(0);
  const ctaY = useMotionValue(0);
  const ctaSpring = { stiffness: 200, damping: 15, mass: 0.3 };
  const ctaSpringX = useSpring(ctaX, ctaSpring);
  const ctaSpringY = useSpring(ctaY, ctaSpring);

  function handleCtaPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    ctaX.set((e.clientX - (rect.left + rect.width / 2)) * 0.3);
    ctaY.set((e.clientY - (rect.top + rect.height / 2)) * 0.3);
  }

  function handleCtaPointerLeave() {
    ctaX.set(0);
    ctaY.set(0);
  }

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center"
    >
      {/* Sheet header — the title block of a drawing. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-8"
      >
        <span className="annotation !text-white/70">{BRAND_NAME} / SYS.DESIGN</span>
        {/* `pointer-events-auto` because the wrapper turns them off for the
            whole header strip — the annotations are decoration, this is the
            one control in it. It sits here rather than in a nav bar the page
            does not have: the sheet header is already the page's only
            persistent chrome. */}
        <span className="pointer-events-auto flex items-center gap-5">
          <LocaleSwitcher tone="dark" />
          <span className="annotation hidden !text-white/50 sm:block">SHEET 01 — MY</span>
        </span>
      </motion.div>

      <motion.div
        style={{ y: contentY, scale: contentScale, opacity: contentOpacity }}
        className="relative flex flex-col items-center px-6"
      >
        {/*
          Local readability panel. The gradient is deliberately left vivid (the
          colour IS the impact), so contrast is bought only where it's needed —
          a soft blurred ellipse directly behind the copy — instead of
          desaturating the whole surface with a heavy full-viewport scrim.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[oklch(0.16_0.012_265/0.5)] blur-3xl"
        />

        {/* Datum line: draws open from the centre, so the page opens with an
            instrument being laid down. */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 h-px w-40 origin-center bg-gradient-to-r from-transparent via-white/55 to-transparent"
        />
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.7, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className={`${HEADLINE_CLASSNAME} text-white`}>{t("headline")}</h1>
        </motion.div>
        <motion.p
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.7, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 max-w-md text-base leading-relaxed text-white/80"
        >
          {t("subheadline")}
        </motion.p>
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.7, delay: 0.56, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="mt-11 inline-block"
            style={{ x: ctaSpringX, y: ctaSpringY }}
            onPointerMove={handleCtaPointerMove}
            onPointerLeave={handleCtaPointerLeave}
          >
            {/* Outlined, not filled: on a lit surface a solid slab reads as a
                sticker on top. A hairline box that floods on hover reads as
                part of the same drawing. */}
            <button
              onClick={onCtaClick}
              className="group relative overflow-hidden border border-white/45 bg-white/[0.06] px-8 py-4 font-mono text-[0.8125rem] tracking-[0.14em] text-white uppercase backdrop-blur-sm transition-colors duration-300 hover:border-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
            >
              <span className="absolute inset-0 origin-left scale-x-0 bg-white transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
              <span className="relative transition-colors duration-300 group-hover:text-[oklch(0.16_0.012_265)]">
                {t("cta")}
              </span>
            </button>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll cue: a plumb line dropping off the bottom of the sheet. */}
      <motion.div
        style={{ opacity: contentOpacity }}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
      >
        <span className="annotation !text-white/45">SCROLL</span>
        <div className="h-12 w-px overflow-hidden bg-white/20">
          <motion.div
            className="h-1/2 w-full bg-white/80"
            animate={{ y: ["-100%", "200%"] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
