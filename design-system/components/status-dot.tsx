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
  small,
}: {
  tone: StatusTone
  label: string
  /** Marks a live/in-progress state with a soft pulse on the dot. */
  pulse?: boolean
  /**
   * Draw it at caption size, for the metadata rows inside a card.
   *
   * The reference this product's card grid is copied from (arhamkhnz's
   * file-manager, read from source) sets that whole row to text-xs:
   * 「PDF」 and 「8.4 MB」 are the same size, because they are one line of
   * metadata and not two facts of different weight. Ours put a --text-sm
   * state beside a --text-xs unit in that same row, which reads as a
   * rendering mistake rather than a hierarchy.
   *
   * A prop rather than a second component: there is ONE state mark in this
   * system, and a copy of it is a second place for the tones to drift.
   */
  small?: boolean
}) {
  return (
    // `whitespace-nowrap`: a status is one token and must never break across
    // lines. Without it the roomier registers (Hearth's 13.5px type and 16px
    // cell padding, against the same column width Ledger fits 12px into) wrap
    // two-character labels mid-word -- "已付 款", "待处 理" -- which reads as a
    // rendering bug in the customer's own system. Caught in a real browser on
    // the three-column style comparison, where all three run side by side at
    // their narrowest.
    <span
      className={`inline-flex items-center whitespace-nowrap text-[color:var(--color-paper)] ${
        small
          ? "gap-1.5 [font-size:var(--text-xs)]"
          : "gap-1.5 [font-size:var(--text-sm)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`${small ? "h-1.5 w-1.5" : "h-2 w-2"} shrink-0 rounded-full ${pulse ? "animate-pulse" : ""}`}
        style={{ background: TONE_COLOR[tone] }}
      />
      {label}
    </span>
  )
}
