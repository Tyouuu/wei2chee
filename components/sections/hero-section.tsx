"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useSpring, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

// Shared fade/slide-up entrance used to stagger the Hero's text block on mount.
// Scoped to the Hero only (see Step 4 of the Task 14 brief) — Sections 2-4 stay
// exactly as fast/clean as already built and must NOT get this treatment.
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Instrument Serif carries its weight through stroke contrast, not mass — so
// it is set at 400 (no font-bold) and allowed to get genuinely large. Negative
// tracking at this scale is what makes it read as typeset rather than default.
const HEADLINE_CLASSNAME =
  "max-w-4xl font-serif text-[clamp(2.75rem,8.5vw,6.5rem)] leading-[0.95] tracking-[-0.03em] text-balance";

export function HeroSection({ onCtaClick }: { onCtaClick: () => void }) {
  const t = useTranslations("hero");
  const sectionRef = useRef<HTMLElement>(null);

  // Mouse-reactive tilt on the shader background: the gradient plane leans a few
  // degrees toward the cursor instead of sitting static, so the scene reads as
  // responding to the visitor rather than just autoplaying underneath them.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springConfig = { stiffness: 80, damping: 20, mass: 0.5 };
  const tiltX = useSpring(useTransform(pointerY, [-0.5, 0.5], [4, -4]), springConfig);
  const tiltY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-4, 4]), springConfig);

  function handleSectionPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleSectionPointerLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  // Scroll-linked exit: as the visitor scrolls from the Hero into Section 2, the
  // text block scales down and settles instead of just disappearing off-screen,
  // and the gradient dims — the Hero reads as a directed opening beat rather
  // than a static banner sitting above the form.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const contentScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const gradientOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.35]);

  // Magnetic CTA: the button drifts a few px toward the cursor within its own
  // bounds and springs back on leave — a small, cheap Awwwards-style touch that
  // doesn't touch the copy or layout Sections 2-4 depend on.
  const ctaX = useMotionValue(0);
  const ctaY = useMotionValue(0);
  const ctaSpringConfig = { stiffness: 200, damping: 15, mass: 0.3 };
  const ctaSpringX = useSpring(ctaX, ctaSpringConfig);
  const ctaSpringY = useSpring(ctaY, ctaSpringConfig);

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
      onPointerMove={handleSectionPointerMove}
      onPointerLeave={handleSectionPointerLeave}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center"
    >
      {/*
        NOTE 1: @shadergradient/react (v2.4.20) does not merge defaults when
        control="query" — it parses ONLY the query string and passes the
        result straight through, and the mesh renderer does an unconditional
        `shaders[shader][type]` lookup. A minimal URL (just type + colors,
        as in the original task brief) omits `shader`, which throws
        "Cannot read properties of undefined (reading 'waterPlane')" at
        runtime. This full query string is modeled on the library's own
        "nightyNight" preset (same color1/color3) so every param the
        component reads unconditionally is present.

        NOTE 2: ShaderGradientCanvas forwards `className` to @react-three/fiber's
        <Canvas>, whose wrapper div sets `style="position: relative; width:
        100%; height: 100%"` inline. Inline styles beat Tailwind's `absolute`
        class, so `className="absolute inset-0"` passed directly to
        ShaderGradientCanvas has no positioning effect, and with no ancestor
        in the 100%-height chain resolving to a concrete height, the canvas
        collapsed to the browser's default 300x150 fallback size. Fix: own the
        `absolute inset-0` wrapper ourselves, outside ShaderGradientCanvas, so
        the percentage-height chain has a real pixel height to resolve against.
      */}
      <motion.div
        className="absolute inset-0 -z-10 scale-110"
        style={{ opacity: gradientOpacity, rotateX: tiltX, rotateY: tiltY, transformPerspective: 800 }}
      >
        <ShaderGradientCanvas>
          <ShaderGradient
            control="query"
            urlString="https://www.shadergradient.co/customize?animate=on&axesHelper=off&brightness=1&cAzimuthAngle=180&cDistance=2.8&cPolarAngle=80&cameraZoom=9.1&color1=%23606080&color2=%238da0ce&color3=%23212121&destination=onCanvas&embedMode=off&envPreset=city&format=gif&frameRate=10&gizmoHelper=hide&grain=on&lightType=3d&pixelDensity=1&positionX=0&positionY=0&positionZ=0&range=disabled&rangeEnd=40&rangeStart=0&reflection=0.1&rotationX=50&rotationY=0&rotationZ=-60&shader=defaults&type=waterPlane&uAmplitude=0&uDensity=1.5&uFrequency=0&uSpeed=0.3&uStrength=1.5&uTime=8&wireframe=false"
          />
        </ShaderGradientCanvas>
      </motion.div>

      {/*
        Scrim. The waterPlane gradient sweeps to a very bright blue on one side,
        and where it does, white body copy and the scroll cue drop below readable
        contrast (verified via screenshot). Two stacked layers fix it without
        touching the shader params: a center-biased radial that keeps the
        headline area clear, and a vertical wash anchoring the bottom edge where
        the scroll cue and the brightest part of the gradient collide.
        `-z-10` keeps this above the canvas (also -z-10, earlier in the stack)
        but still behind all content.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, oklch(0.16 0.012 265 / 0.72) 0%, oklch(0.16 0.012 265 / 0.5) 45%, transparent 100%)," +
            "linear-gradient(to bottom, oklch(0.16 0.012 265 / 0.55) 0%, transparent 25%, transparent 60%, oklch(0.16 0.012 265 / 0.8) 100%)",
        }}
      />
      {/*
        NOTE 3: the theme's default `--foreground` is near-black in light mode
        (see app/globals.css), which is unreadable over the dark waterPlane
        gradient behind it (verified via screenshot — headline was nearly
        invisible). Text here is hardcoded to light/white regardless of the
        active color-mode, since it always sits on the same dark gradient.
      */}
      {/* Sheet header — the title block of a drawing, top-left and top-right. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-8"
      >
        <span className="annotation !text-white/55">{BRAND_NAME} / SYS.DESIGN</span>
        <span className="annotation hidden !text-white/40 sm:block">SHEET 01 — MY</span>
      </motion.div>

      <motion.div
        style={{ scale: contentScale, opacity: contentOpacity }}
        className="relative flex flex-col items-center px-6"
      >
        {/* Hairline above the headline: a drawing's datum line. It draws itself
            open from the center, so the first thing that happens on the page is
            an instrument being laid down. */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 h-px w-40 origin-center bg-gradient-to-r from-transparent via-white/45 to-transparent"
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
          className="mt-7 max-w-md text-base leading-relaxed text-white/65"
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
            {/* Outlined, not filled: on a drawing surface a solid slab reads as
                a sticker sitting on top. A hairline box with a hover fill reads
                as part of the same drawing. */}
            <button
              onClick={onCtaClick}
              className="group relative border border-white/35 bg-transparent px-8 py-4 font-mono text-[0.8125rem] tracking-[0.14em] text-white uppercase transition-colors duration-300 hover:border-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
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
        <span className="annotation !text-white/35">SCROLL</span>
        <div className="h-12 w-px overflow-hidden bg-white/15">
          <motion.div
            className="h-1/2 w-full bg-white/70"
            animate={{ y: ["-100%", "200%"] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
