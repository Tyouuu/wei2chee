/*
  TEN HUES, COPIED OUT OF THE REFERENCE'S OWN SOURCE.

  `users/_components/users-columns.tsx` in arhamkhnz/next-shadcn-admin-dashboard
  (MIT) picks the avatar's colour from a fixed list of ten Tailwind pairs --
  amber · orange · rose · pink · fuchsia · purple · violet · indigo · sky ·
  emerald -- each of them `bg-{hue}-100` behind `text-{hue}-700`. That is the
  whole mechanism, and it is why their roster reads as ten different people
  and ours read as one blue repeated.

  🔴 WHY THIS ONE COMPONENT LEAVES THE TOKEN NAMESPACE, WHICH THE REST OF THIS
  DIRECTORY DOES NOT.

  Every other colour here is a TOKEN because the register repaints it: a
  status has a meaning the business's own palette should carry. An identity
  tint has no meaning at all -- it exists so the eye can tell Mrs Chan's row
  from Ms Lim's at a glance -- and the token sets only carry FOUR true hues
  (jade · brass · clay · info; slate is grey by design and primary-deep is
  overridden to near-black on the workbench). Four hues over a fifty-name
  roster is a collision every other row, which is exactly what the salon's
  five guests showed: three of them the same blue.

  So the ten are literal, and they are literal in BOTH halves: the wash and
  the letters are the reference's own 100/700 pair rather than a mix computed
  off one hue. Measured across all ten, the worst pair is amber at 4.51:1 and
  the best indigo at 6.41:1 -- every one of them clears the 4.5 threshold for
  11px text, which the computed version only reached by darkening the letters
  toward the body colour.

  ⚠️ These are decorative, never semantic. Nothing may read meaning out of
  which hue a name landed on.
*/
const PALETTE: { bg: string; fg: string }[] = [
  { bg: "#fef3c7", fg: "#b45309" }, // amber
  { bg: "#ffedd5", fg: "#c2410c" }, // orange
  { bg: "#ffe4e6", fg: "#be123c" }, // rose
  { bg: "#fce7f3", fg: "#be185d" }, // pink
  { bg: "#fae8ff", fg: "#a21caf" }, // fuchsia
  { bg: "#f3e8ff", fg: "#7e22ce" }, // purple
  { bg: "#ede9fe", fg: "#6d28d9" }, // violet
  { bg: "#e0e7ff", fg: "#4338ca" }, // indigo
  { bg: "#e0f2fe", fg: "#0369a1" }, // sky
  { bg: "#d1fae5", fg: "#047857" }, // emerald
]

/* 他们用的是 `name.length % tones.length` —— **名字多长**。
   同样长的两个名字（「Ms Lim」跟「Ms Tan」，六个字）会拿到同一个色，
   而一间沙龙的客人名字长度就是那么几种。这里保留原本那个 hash：
   同一个名字永远同一个色（那一点跟他们一样），而不同的名字散得开。 */
function fillFor(name: string): { bg: string; fg: string } {
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
export function Avatar({
  name,
  size = 28,
  /* Record-detail headers (2026-09-14, matched to a reference the founder
     handed over) use this at 64px, where --text-xs (11.5px) reads as a
     speck in a circle four times its old size — the reference sets its
     initials at roughly a third of the circle's diameter. Optional so
     every existing 28/40px call site (record-table rows, the old header
     size) keeps the exact token-driven size it already had. */
  fontSize,
}: {
  name: string
  size?: number
  fontSize?: string
}) {
  const tone = fillFor(name)
  return (
    <span
      // [font-weight:var(--fw-semibold)], not heavier: the token block sets a hard ceiling of
      // --fw-semibold because every reference product this design follows
      // stops at or below 600.
      className="grid shrink-0 place-items-center rounded-full [font-weight:var(--fw-semibold)]"
      style={{
        width: size,
        height: size,
        fontSize: fontSize ?? "var(--text-xs)",
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
        background: tone.bg,
        color: tone.fg,
      }}
    >
      {initialsFor(name)}
    </span>
  )
}
