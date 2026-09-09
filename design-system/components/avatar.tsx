// A deterministic, token-driven fill so the same name always gets the same
// color without needing a lookup table anywhere. Cycles through four of this
// design system's already-validated status hues rather than hashing to an
// arbitrary hex — every possible fill is still a `var(--...)` reference, so
// this file stays token-driven under all six token sets.
//
// TWO ENTRIES CAME OUT, AND BOTH FOR THE SAME REASON: THEY ARE NOT HUES.
//
// --color-slate-bright resolves to #54565f in every one of the six sets. It
// is the NEUTRAL status, and it is grey on purpose. As a status that is
// right; as an identity it is the one entry that says nothing, and once the
// fill became a 16% wash (below) it stopped being visible at all.
//
// --color-primary-deep looked like a hue in the six token files (Ledger's
// is #8f3d0a, Swiss's #b01f12) and is NOT one where this component actually
// runs. app/globals.css overrides it to #09090b on [data-surface="desk"] --
// near-black, deliberately, because the workbench has exactly one primary
// action colour and the reference's is near-black. A 16% wash of #09090b
// over the table measures [215,215,216]: a grey disc.
//
// 🔴 Both were found by SAMPLING THE SCREENSHOT, not by reading the token
// files -- reading them says Ledger's accent is a warm orange, and on this
// surface that is simply not what the browser resolves. Four of five guests
// came out as identical grey circles.
//
// Four hues left. Each is defined in all six sets, none is overridden on the
// desk surface, and each carries a legible tint at 16%.
const PALETTE = [
  "var(--color-jade-bright)",
  "var(--color-brass-bright)",
  "var(--color-clay-bright)",
  "var(--color-info-bright)",
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
  const tone = fillFor(name)
  return (
    <span
      // [font-weight:var(--fw-semibold)], not heavier: the token block sets a hard ceiling of
      // --fw-semibold because every reference product this design follows
      // stops at or below 600.
      className="grid shrink-0 place-items-center rounded-full [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)]"
      style={{
        width: size,
        height: size,
        /*
          A CIRCLE, AND A TINT -- BECAUSE THAT IS WHAT THE REFERENCE DOES.

          This was a rounded square carrying a SATURATED fill with white
          initials. The template every table on this side is copied from
          (arhamkhnz's users page, .screenshots/admins/arham-users.jpg, read
          at 2.5x) does neither: its avatars are full circles, the ground is
          a PALE wash of one hue, and the initials are that same hue at
          reading strength. The rounded square was never argued for anywhere
          -- record-table.tsx's own comment beside the call site already
          says 「一颗没有字的圆圈」, a circle, so the shape had drifted away
          from what this file's neighbour believed it was drawing.

          The initials are NOT the raw tone, and there is a number for that.
          Measured across all six token sets, raw tone on its own 16% wash
          bottoms out at 2.28:1 (Counter's brass, #d48806) -- initials at
          --text-xs that most people cannot read. Mixed 55% into
          --color-paper the same worst case is 5.25:1 and the best 7.77:1,
          while the letters still read as the hue rather than as ink. This
          is the same trade the Pill in record-table.tsx made after
          measuring 2.56:1 on a status label, and status-dot.tsx argues in
          its own header: the colour identifies, the contrast is what makes
          it legible.
        */
        background: `color-mix(in oklab, ${tone} 16%, transparent)`,
        color: `color-mix(in oklab, ${tone} 55%, var(--color-paper))`,
      }}
    >
      {initialsFor(name)}
    </span>
  )
}
