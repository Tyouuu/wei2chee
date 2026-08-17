// A deterministic, token-driven fill so the same name always gets the same
// color without needing a lookup table anywhere. Cycles through six of this
// design system's already-validated saturated tones (the four status-bright
// colors, the spare categorical hue, and the deep accent) rather than
// hashing to an arbitrary hex — every possible fill is still a `var(--...)`
// reference, so this file stays token-driven under all three token sets.
const PALETTE = [
  "var(--color-jade-bright)",
  "var(--color-brass-bright)",
  "var(--color-clay-bright)",
  "var(--color-slate-bright)",
  "var(--color-info-bright)",
  "var(--color-primary-deep)",
]

function fillFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  )
}

/**
 * A name, reduced to initials on a colored square — used wherever a person
 * needs a compact visual identity and no photo is available.
 *
 * Ported and generalized from a real client codebase's `avatar.tsx`. There,
 * the fill came from an app-specific `avatarHex(name)` helper (an arbitrary
 * hex per name) imported from outside the component; here `fillFor` cycles
 * through this design system's own token palette instead, so the component
 * has no dependency beyond its own file and still produces a different
 * color under Hearth/Blueprint without any code change.
 */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      // font-semibold, not heavier: the token block sets a hard ceiling of
      // --fw-semibold because every reference product this design follows
      // stops at or below 600.
      className="grid shrink-0 place-items-center rounded-[8px] text-[12px] [font-weight:var(--fw-semibold)] [color:var(--color-on-dark)]"
      style={{ width: size, height: size, background: fillFor(name) }}
    >
      {initialsFor(name)}
    </span>
  )
}
