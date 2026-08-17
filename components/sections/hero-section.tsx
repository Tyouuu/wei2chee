"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";
import { GlitchText } from "@/components/effects/glitch-text";
import { useTheme } from "@/lib/use-theme";

// Shared fade/slide-up entrance used to stagger the Hero's text block on mount.
// Scoped to the Hero only (see Step 4 of the Task 14 brief) — Sections 2-4 stay
// exactly as fast/clean as already built and must NOT get this treatment.
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Headline sizing shared by both render paths (plain <h1> and GlitchText) so the
// "bolder default typography" upgrade applies to every theme, not just industrial.
const HEADLINE_CLASSNAME = "max-w-2xl text-5xl font-bold tracking-tight sm:text-7xl";

export function HeroSection({ onCtaClick }: { onCtaClick: () => void }) {
  const t = useTranslations("hero");
  const { theme } = useTheme();

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center">
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
      <div className="absolute inset-0 -z-10">
        <ShaderGradientCanvas>
          <ShaderGradient
            control="query"
            urlString="https://www.shadergradient.co/customize?animate=on&axesHelper=off&brightness=1&cAzimuthAngle=180&cDistance=2.8&cPolarAngle=80&cameraZoom=9.1&color1=%23606080&color2=%238da0ce&color3=%23212121&destination=onCanvas&embedMode=off&envPreset=city&format=gif&frameRate=10&gizmoHelper=hide&grain=on&lightType=3d&pixelDensity=1&positionX=0&positionY=0&positionZ=0&range=disabled&rangeEnd=40&rangeStart=0&reflection=0.1&rotationX=50&rotationY=0&rotationZ=-60&shader=defaults&type=waterPlane&uAmplitude=0&uDensity=1.5&uFrequency=0&uSpeed=0.3&uStrength=1.5&uTime=8&wireframe=false"
          />
        </ShaderGradientCanvas>
      </div>
      {/*
        NOTE 3: the theme's default `--foreground` is near-black in light mode
        (see app/globals.css), which is unreadable over the dark waterPlane
        gradient behind it (verified via screenshot — headline was nearly
        invisible). Text here is hardcoded to light/white regardless of the
        active color-mode, since it always sits on the same dark gradient.
      */}
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
        {theme === "industrial" ? (
          // React Bits-sourced effect (see components/effects/glitch-text.tsx for source/license).
          // GlitchText renders its own <h1>, so it's wrapped in a motion.div here rather than
          // converted into a motion.h1 itself, to keep the entrance stagger without reaching into
          // the effect component's internals.
          <GlitchText text={t("headline")} className={HEADLINE_CLASSNAME} />
        ) : (
          <h1 className={`${HEADLINE_CLASSNAME} text-white`}>{t("headline")}</h1>
        )}
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
        <Button size="lg" className="mt-8" onClick={onCtaClick}>
          {t("cta")}
        </Button>
      </motion.div>
    </section>
  );
}
