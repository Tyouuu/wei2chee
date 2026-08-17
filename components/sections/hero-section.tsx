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

const HEADLINE_CLASSNAME = "max-w-2xl text-5xl font-bold tracking-tight sm:text-7xl";

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
        NOTE 3: the theme's default `--foreground` is near-black in light mode
        (see app/globals.css), which is unreadable over the dark waterPlane
        gradient behind it (verified via screenshot — headline was nearly
        invisible). Text here is hardcoded to light/white regardless of the
        active color-mode, since it always sits on the same dark gradient.
      */}
      <motion.div style={{ scale: contentScale, opacity: contentOpacity }} className="flex flex-col items-center">
        <motion.p
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.35, delay: 0, ease: "easeOut" }}
          className="mb-2 text-sm uppercase tracking-widest text-white/70"
        >
          {BRAND_NAME}
        </motion.p>
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
        >
          <h1 className={`${HEADLINE_CLASSNAME} text-white`}>{t("headline")}</h1>
        </motion.div>
        <motion.p
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.35, delay: 0.16, ease: "easeOut" }}
          className="mt-4 max-w-xl text-lg text-white/80"
        >
          {t("subheadline")}
        </motion.p>
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.35, delay: 0.24, ease: "easeOut" }}
        >
          <motion.div
            className="mt-8 inline-block"
            style={{ x: ctaSpringX, y: ctaSpringY }}
            onPointerMove={handleCtaPointerMove}
            onPointerLeave={handleCtaPointerLeave}
          >
            <Button size="lg" onClick={onCtaClick}>
              {t("cta")}
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
