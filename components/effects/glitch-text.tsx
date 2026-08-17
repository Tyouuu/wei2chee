"use client";

// Adapted from React Bits' GlitchText component (src/ts-tailwind/TextAnimations/GlitchText):
// https://github.com/DavidHDev/react-bits/blob/main/src/ts-tailwind/TextAnimations/GlitchText/GlitchText.tsx
// React Bits is licensed MIT + Commons Clause v1.0 (https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md):
// free to use/modify inside our own product, but the component itself may not be resold or
// redistributed standalone — it is used here purely as UI inside the Formae site, not shipped
// as a library.
//
// What changed from the source:
// - `children: string` prop renamed to `text: string` (matches this task's required interface).
// - Class concatenation replaced with this project's `cn()` (clsx + tailwind-merge) helper so a
//   caller-supplied `className` can cleanly override defaults instead of just being appended.
// - The source's keyframes ship as a tailwind.config.js snippet the consumer must paste in; this
//   project uses Tailwind v4's CSS-based config (no tailwind.config.js at all), so the keyframes
//   are colocated in a scoped <style> tag instead — the component owns its own animation.
// - The source hardcodes the pseudo-element mask color to a literal `#120F17`. That color's job is
//   to paint over the real headline in the animated clip-path strip so the offset glitch copy reads
//   cleanly. This project's `--foreground` token is oklch(0.145 0 0) (near-black) in every theme
//   defined in app/globals.css (only --primary/--background/--radius vary per data-theme), and this
//   component is only ever composited over the Hero's dark ShaderGradient (see hero-section.tsx),
//   so `var(--foreground)` is used as the mask color instead of a hardcoded hex — it tracks this
//   project's real design tokens rather than an imported literal, and — because --foreground doesn't
//   change per theme — still renders correctly if a theme's dark tone ever moves.
// - Text color stays hardcoded white, mirroring the same "Hero copy is always white" convention
//   already established in hero-section.tsx (NOTE 3 there) for the same reason: the Hero's
//   ShaderGradient background is dark regardless of the active `data-theme`.

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GlitchTextProps {
  text: string;
  className?: string;
  /** Animation speed multiplier — lower is faster. Matches the source component's `speed` prop. */
  speed?: number;
  /** Whether to render the red/cyan chromatic-aberration shadow on the glitch copies. */
  enableShadows?: boolean;
}

interface GlitchCSSProperties extends CSSProperties {
  "--after-duration": string;
  "--before-duration": string;
  "--after-shadow": string;
  "--before-shadow": string;
}

export function GlitchText({ text, className, speed = 0.5, enableShadows = true }: GlitchTextProps) {
  const style: GlitchCSSProperties = {
    "--after-duration": `${speed * 3}s`,
    "--before-duration": `${speed * 2}s`,
    "--after-shadow": enableShadows ? "-5px 0 red" : "none",
    "--before-shadow": enableShadows ? "5px 0 cyan" : "none",
  };

  return (
    <>
      {/* Keyframes colocated with the component so it "owns its own animation" (see comment above). */}
      <style>{`
        @keyframes formae-glitch-clip {
          0% { clip-path: inset(20% 0 50% 0); }
          5% { clip-path: inset(10% 0 60% 0); }
          10% { clip-path: inset(15% 0 55% 0); }
          15% { clip-path: inset(25% 0 35% 0); }
          20% { clip-path: inset(30% 0 40% 0); }
          25% { clip-path: inset(40% 0 20% 0); }
          30% { clip-path: inset(10% 0 60% 0); }
          35% { clip-path: inset(15% 0 55% 0); }
          40% { clip-path: inset(25% 0 35% 0); }
          45% { clip-path: inset(30% 0 40% 0); }
          50% { clip-path: inset(20% 0 50% 0); }
          55% { clip-path: inset(10% 0 60% 0); }
          60% { clip-path: inset(15% 0 55% 0); }
          65% { clip-path: inset(25% 0 35% 0); }
          70% { clip-path: inset(30% 0 40% 0); }
          75% { clip-path: inset(40% 0 20% 0); }
          80% { clip-path: inset(20% 0 50% 0); }
          85% { clip-path: inset(10% 0 60% 0); }
          90% { clip-path: inset(15% 0 55% 0); }
          95% { clip-path: inset(25% 0 35% 0); }
          100% { clip-path: inset(30% 0 40% 0); }
        }
      `}</style>
      <h1
        data-text={text}
        style={{ ...style, "--glitch-mask-bg": "var(--foreground)" } as CSSProperties}
        className={cn(
          "relative inline-block cursor-default select-none text-white",
          "after:absolute after:top-0 after:left-[10px] after:content-[attr(data-text)] after:overflow-hidden",
          "after:text-white after:[background-color:var(--glitch-mask-bg)] after:[clip-path:inset(0)]",
          "after:[text-shadow:var(--after-shadow)] after:[animation:formae-glitch-clip_var(--after-duration)_infinite_linear_alternate-reverse]",
          "before:absolute before:top-0 before:left-[-10px] before:content-[attr(data-text)] before:overflow-hidden",
          "before:text-white before:[background-color:var(--glitch-mask-bg)] before:[clip-path:inset(0)]",
          "before:[text-shadow:var(--before-shadow)] before:[animation:formae-glitch-clip_var(--before-duration)_infinite_linear_alternate-reverse]",
          className
        )}
      >
        {text}
      </h1>
    </>
  );
}
