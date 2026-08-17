export type StatusTone = "positive" | "warning" | "negative" | "neutral"

const TONE_COLOR: Record<StatusTone, string> = {
  positive: "var(--color-jade-bright)",
  warning: "var(--color-brass-bright)",
  negative: "var(--color-clay-bright)",
  neutral: "var(--color-slate-bright)",
}

/**
 * A state: a coloured dot, plus a label at full reading contrast.
 *
 * The label is never coloured — colour lives on the dot only. A label that
 * also takes the hue is the weakest-contrast text on the page for something
 * meant to be read, and a differently-coloured shape per state makes the
 * eye re-read each one instead of comparing one small mark at a glance. The
 * dot is the only part of this component that needs the colour; the label
 * carries the meaning.
 *
 * Ported and generalized from a real client codebase's `status-dot.tsx`.
 * There, `color` took a raw token name (one of four literal token
 * identifiers from that app's palette); here it's a semantic `tone`, so the
 * same four states map to whichever of this design system's token sets
 * (Ledger/Hearth/Blueprint) is active without the caller needing to know
 * any token's literal name.
 */
export function StatusDot({
  tone,
  label,
  pulse,
}: {
  tone: StatusTone
  label: string
  /** Marks a live/in-progress state with a soft pulse on the dot. */
  pulse?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-[color:var(--color-paper)]">
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${pulse ? "animate-pulse" : ""}`}
        style={{ background: TONE_COLOR[tone] }}
      />
      {label}
    </span>
  )
}
