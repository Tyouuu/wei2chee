"use client";

import type { CSSProperties } from "react";

/**
 * 圆角 — one slider over whatever radius ladder the register defines.
 *
 * ── WHY TWO LAYERS OF VARIABLES ───────────────────────────────────────────
 *
 * The obvious version is one element declaring
 *
 *     --radius-md: calc(var(--radius-md) * var(--corner-scale));
 *
 * which is a property reading itself: a cycle, and CSS discards every
 * declaration in a cycle. It fails silently — the variables all appear in the
 * DOM and every corner stays exactly as it was. This codebase has now met that
 * rule three times (record-table.tsx's --row-height, block-tone.ts's inversion,
 * and this), so it is written down here as well.
 *
 * `cornerCapture` freezes the register's own ladder under private names on an
 * outer element; `cornerApply` multiplies those on an inner one. No name ever
 * reads itself, and the register's proportions survive — 台账's 3px stays three
 * times smaller than 柔和's 10px at every setting of the slider.
 *
 * ── WHY THE PILL RADII ARE LEFT ALONE ────────────────────────────────────
 *
 * `--radius-control` and `--radius-pill` are 999px in most registers, which is
 * not a corner, it is a shape: a status pill and a segmented filter are round
 * because being round is what makes them read as a control rather than as a
 * box. Multiplying 999 by 0 turns every status chip into a rectangle, which is
 * not what anyone means by 「方一点」.
 */

/** 0 squares everything, 1 is the register as designed, 2 the roundest allowed.
 *  The same range the database constraint enforces (migration 20260825070000). */
export const CORNER_MIN = 0;
export const CORNER_MAX = 2;
export const CORNER_STEP = 0.05;

const LADDER = ["xs", "sm", "md", "lg"] as const;

/** Goes on the OUTER element: the register's current ladder, frozen. */
export const cornerCapture: CSSProperties = Object.fromEntries(
  LADDER.map((k) => [`--c-${k}`, `var(--radius-${k})`]),
) as CSSProperties;

/** Goes on the INNER element: the same ladder, scaled. */
export function cornerApply(scale: number): CSSProperties {
  return {
    ...Object.fromEntries(
      LADDER.map((k) => [`--radius-${k}`, `calc(var(--c-${k}) * ${scale})`]),
    ),
    // --radius itself is an alias for one rung (see each token file's tail), so
    // it has to be re-pointed after the rungs move or it keeps the old value.
    "--radius": `calc(var(--c-md) * ${scale})`,
  } as CSSProperties;
}

/**
 * The control. A slider rather than a set of presets, because what is being
 * chosen is an AMOUNT and three buttons labelled 方 / 一般 / 圆 would be three
 * lies about a continuous thing.
 */
export function CornerSlider({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="mb-3 flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 [background-color:var(--color-ink-850)]">
      <span className="shrink-0 [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
        {label}
      </span>
      {/* The two ends of the slider are drawn as what they DO — a square corner
          and a round one — so the control explains itself without a legend. */}
      <span
        aria-hidden
        className="h-3 w-3 shrink-0 border-t border-l [border-color:var(--color-paper-dim)]"
      />
      <input
        type="range"
        min={CORNER_MIN}
        max={CORNER_MAX}
        step={CORNER_STEP}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [background:var(--color-ink-700)] disabled:opacity-50 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-paper)]"
      />
      <span
        aria-hidden
        className="h-3 w-3 shrink-0 rounded-tl-[10px] border-t border-l [border-color:var(--color-paper-dim)]"
      />
    </label>
  );
}
