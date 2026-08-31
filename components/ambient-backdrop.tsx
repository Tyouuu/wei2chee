"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

/*
  The atmosphere, owned once for the WHOLE page rather than by the Hero.

  Before this existed, the ShaderGradient lived inside HeroSection, so scrolling
  past the Hero hard-cut from a lit, moving surface to flat dark panels — the
  page stopped feeling like one space and became stacked boxes. Here it is a
  single fixed layer behind everything: it recedes as you scroll (opacity and a
  slow drift) instead of disappearing, so every section below is still standing
  on the same lit drafting surface.

  NOTE 1: @shadergradient/react (v2.4.20) does not merge defaults when
  control="query" — it parses ONLY the query string and passes the result
  straight through, and the mesh renderer does an unconditional
  `shaders[shader][type]` lookup. A minimal URL omitting `shader` throws
  "Cannot read properties of undefined (reading 'waterPlane')" at runtime. This
  full query string is modeled on the library's own "nightyNight" preset so
  every param the component reads unconditionally is present.

  NOTE 2: REDUCED MOTION TURNS THE CANVAS OFF ENTIRELY, not down.

  This is a Three.js render loop behind every pixel of the landing page, and it
  runs forever. CSS `@media (prefers-reduced-motion)` -- which globals.css uses
  in six places -- cannot reach it, because nothing here is a CSS animation. So
  a visitor who has asked their phone to stop moving things still got a
  mouse-tilted, continuously redrawing WebGL surface.

  Three reasons it is off rather than slowed:

    · the visitor asked. A waterPlane drifting under the whole page is exactly
      the kind of thing the setting exists for.
    · 任务 57 measured this market's visitor: a mid-range Android on 4G. A
      permanent GL loop is battery, and it is the FIRST screen of the product.
    · it made every screenshot ruler flaky. `page.screenshot` on this page
      would hang past 60s waiting for a compositor frame that a never-settling
      GL canvas does not hand over, and this repo has been lied to by its own
      rulers enough times (24) that a camera which cannot get a picture is a
      defect, not an inconvenience.

  The still frame is painted from the SAME three colours the shader is given
  (#606080 / #8da0ce / #212121), so the room is the same room -- it has just
  stopped moving.

  NOTE 3: IT ALSO STOPS ONCE THE PAGE HAS TURNED WHITE.

  Measured 2026-08-31 at 390x844 with the CPU throttled 4x (Lighthouse's own
  mobile setting -- this market's visitor is a mid-range Android on 4G):

    top of the page          12 draws/s   effective opacity 1.000
    the white half           55 draws/s   effective opacity 0.000
    bottom of the page       62 draws/s   effective opacity 0.000

  It runs FASTEST where it cannot be seen at all, and crawls at 12fps where it
  can. Two thirds of this page sits past the handover, where <Handover> has
  faded this layer to nothing -- and every one of those frames is a phone
  heating up to composite something at opacity zero.

  The library's own `lazyLoad` cannot help: it mounts on an IntersectionObserver
  and this wrapper is `fixed inset-0`, so it is always "in view". Nor can the
  loop be paused, because ShaderGradientCanvas names its props explicitly and
  does not forward r3f's `frameloop`. Unmounting is the lever there is, and it
  is the same lever reduced motion already pulls.

  The two thresholds are apart on purpose: it goes away at t >= 0.995 and comes
  back at t < 0.9, so scrolling back up re-creates the GL context while the
  layer is still essentially invisible, instead of popping in.

  `--handover-t` is read rather than recomputed -- <Handover> publishes it every
  frame, and a second copy of that scroll maths here is the kind of duplicate
  fact this repo keeps being bitten by.

  NOTE 4: ShaderGradientCanvas forwards `className` to @react-three/fiber's
  <Canvas>, whose wrapper div sets `position: relative; width: 100%; height:
  100%` inline. Inline styles beat Tailwind's positioning classes, so the
  absolute/fixed wrapper has to be ours, outside ShaderGradientCanvas, or the
  canvas collapses to the browser's 300x150 fallback.
*/
export function AmbientBackdrop() {
  const hostRef = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();

  // Whether this layer is still contributing anything the visitor can see.
  // Starts true so the first paint at the top of the page is the lit one.
  const [lit, setLit] = useState(true);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      // The inline property, not the computed one: <Handover> writes it with
      // setProperty, and reading it back is far cheaper than a style
      // recalculation on every scroll frame.
      const t = Number(document.documentElement.style.getPropertyValue("--handover-t")) || 0;
      setLit((was) => (was ? t < 0.995 : t < 0.9));
    };
    /*
      TWO FRAMES, NOT ONE, AND THIS WAS MEASURED THE HARD WAY.

      <Handover> writes --handover-t from its own rAF, scheduled off the same
      scroll event. Listener order is mount order, and this component mounts
      first -- so a single rAF here reads the value from BEFORE the scroll. The
      first version of this looked right and did the wrong thing at both ends:
      the shader stayed running at the bottom of the page, and once it had gone
      away it never came back when you scrolled up. Deferring by one more frame
      reads after every rAF callback of the current frame, whatever the order.
    */
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(() => window.requestAnimationFrame(read));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Mouse-reactive tilt: the surface leans a few degrees toward the cursor, so
  // it reads as responding to the visitor rather than autoplaying underneath
  // them. Global now, not Hero-only.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const spring = { stiffness: 80, damping: 20, mass: 0.5 };
  const tiltX = useSpring(useTransform(pointerY, [-0.5, 0.5], [4, -4]), spring);
  const tiltY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-4, 4]), spring);

  // Scroll-linked recession. Measured against the document, not a section, so it
  // keeps easing out across the entire page instead of resetting per-section.
  const { scrollYProgress } = useScroll();
  // Stays substantially lit all the way down — a hard fade to flat dark is what
  // made the page read as separate screens. It recedes, it does not vanish.
  const gradientOpacity = useTransform(scrollYProgress, [0, 0.2, 1], [1, 0.55, 0.4]);
  const gradientY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const scrimOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.75]);

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (still) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  return (
    <>
      {/* Pointer listener spans the viewport but must never swallow clicks. */}
      {/* Fades out across the handover. This is the atmosphere of Formae's
          dark room; on the white half of the page it would read as a smudge on
          paper. `--handover-t` is published to the document root by
          components/handover.tsx, so a fixed element can follow it without
          being wired to anything. It defaults to 0, which is the right value
          on every page that has no handover at all. */}
      <div
        ref={hostRef}
        aria-hidden="true"
        onPointerMove={handlePointerMove}
        className="pointer-events-none fixed inset-0 -z-20"
        style={{ opacity: "calc(1 - var(--handover-t, 0))" }}
      >
        <motion.div
          className="absolute inset-0 scale-125"
          style={{
            opacity: gradientOpacity,
            y: gradientY,
            // The tilt follows the cursor, so it is motion too. Held flat
            // rather than removed, to keep one element and one style object.
            rotateX: still ? 0 : tiltX,
            rotateY: still ? 0 : tiltY,
            transformPerspective: 900,
            ...(still || !lit
              ? {
                  background:
                    "radial-gradient(70% 55% at 50% 38%, #8da0ce 0%, #606080 45%, #212121 100%)",
                }
              : null),
          }}
        >
          {still || !lit ? null : (
          <ShaderGradientCanvas>
            <ShaderGradient
              control="query"
              urlString="https://www.shadergradient.co/customize?animate=on&axesHelper=off&brightness=1&cAzimuthAngle=180&cDistance=2.8&cPolarAngle=80&cameraZoom=9.1&color1=%23606080&color2=%238da0ce&color3=%23212121&destination=onCanvas&embedMode=off&envPreset=city&format=gif&frameRate=10&gizmoHelper=hide&grain=on&lightType=3d&pixelDensity=1&positionX=0&positionY=0&positionZ=0&range=disabled&rangeEnd=40&rangeStart=0&reflection=0.1&rotationX=50&rotationY=0&rotationZ=-60&shader=defaults&type=waterPlane&uAmplitude=0&uDensity=1.5&uFrequency=0&uSpeed=0.3&uStrength=1.5&uTime=8&wireframe=false"
            />
          </ShaderGradientCanvas>
          )}
        </motion.div>

        {/*
          Scrim, deliberately restrained. An earlier heavier version fixed
          contrast but flattened the gradient into grey — and the vivid blue IS
          the impact. So this only softens the extremes: a wide low-opacity
          radial plus edge washes. Readability for the Hero copy itself is
          handled locally, by the blur panel behind the text block in
          HeroSection, rather than by desaturating the whole surface.
        */}
        <motion.div
          className="absolute inset-0"
          style={{
            opacity: scrimOpacity,
            background:
              "radial-gradient(130% 100% at 50% 42%, oklch(from var(--ink) l c h / 0.34) 0%, oklch(from var(--ink) l c h / 0.2) 55%, transparent 100%)," +
              "linear-gradient(to bottom, oklch(from var(--ink) l c h / 0.5) 0%, transparent 22%, transparent 62%, oklch(from var(--ink) l c h / 0.62) 100%)",
          }}
        />
      </div>

      {/*
        Edge ruler — the graduated edge of a drawing sheet, fixed to the viewport
        with a marker tracking scroll position. Persistent chrome like this is
        most of what makes a long page read as ONE sheet being examined rather
        than a sequence of separate screens.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 bottom-0 left-4 z-30 hidden w-px bg-white/[0.07] lg:block"
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className={`absolute -left-px bg-white/15 ${i % 4 === 0 ? "w-2" : "w-1"}`}
            style={{ top: `${(i / 23) * 100}%`, height: "1px" }}
          />
        ))}
        <motion.span
          className="absolute -left-[3px] h-10 w-[7px] bg-blueprint"
          style={{ top: useTransform(scrollYProgress, [0, 1], ["0%", "calc(100% - 2.5rem)"]) }}
        />
      </div>
    </>
  );
}
