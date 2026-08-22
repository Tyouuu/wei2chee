// Derives design-system/tokens/night.css from ledger.css.
//
// Same method as derive-brut / derive-ink / derive-glass: take the closest
// existing register and move only the axes that make the new one a different
// register, by script rather than by hand, so the ~120 tokens that should NOT
// change cannot drift.
//
//   node scripts/derive-night.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/ledger.css";
const OUT = "design-system/tokens/night.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 夜 (Night) — the one that is not a white page.

   WHY IT EXISTS, MEASURED. Canvas luminance across the thirteen registers on
   2026-08-23:

     0.823 0.855 0.856 0.880 0.881 0.900 0.903 0.904 0.905 0.925 0.927
     0.949 0.965

   Thirteen registers, every one of them between 0.82 and 0.97. Every single
   page this product can build is a white page with different furniture on it.
   That is the same shape of gap the weight audit found before 粗野 and the
   space audit found before 墨: not a value that could be pushed further, an
   axis with nothing on one end of it.

   AND IT IS NOT A SYMMETRY ARGUMENT. A car workshop, a photo studio, a gym, a
   bar, an events company, a print shop — the trades whose customers judge them
   on how something LOOKS — do not see themselves in a cream page with a serif.
   Right now this product has nothing to offer any of them. 「各行各业」 was the
   instruction; this is one of the industries that had no answer.

   WHAT IT IS DERIVED FROM, AND WHY. ledger.css: the cool, tight, industrial
   one — 3px corners, 32px rows, 13px text, no card shadow, borders doing all
   the separating. Inverted it becomes a console rather than a document, which
   is what a dark business system should be. Deriving from 柔和 or 大字 instead
   would have produced a dark MARKETING page, and this register has to survive
   eight hours of somebody entering quotations.

   THE MOVES:

     1. THE GROUND GOES UNDER.  Canvas #0d1117, cards #161b22, raised #1c2230.
        Not pure black: #000 with white text vibrates, and every card drawn on
        it has to invent its own edge. Three steps of near-black instead, so the
        card is separated from the page the way Ledger separates them — by
        value, not by shadow.

     2. THE BORDERS INVERT.  Ledger's borders are dark ink at 14%/26% on white.
        Here they are white at 8%/16% on near-black. Same job, opposite sign;
        a dark register that keeps light-grey borders gets a page of glowing
        rectangles.

     3. THE ACCENT HAS TO EMIT.  Ledger's burnt orange #b8500f is a print
        colour and disappears at this luminance. #ff7a45 is the same hue pushed
        until it reads as lit rather than painted, which is the one thing a
        dark interface can do that a light one cannot.

     4. A GROUND THAT IS NOT FLAT.  --canvas-image paints one very low radial
        pool behind the top-left. Flat #0d1117 across 1400px reads as a dead
        screen; one soft pool of slightly-blue light reads as a room. Uses the
        token added on 2026-08-23 — before that this register could not have
        had it.

     5. THE RAIL STOPS BEING THE DARK THING.  On twelve light registers the
        navigation is the one dark object. Here the page is dark, so the rail
        goes DARKER than the canvas rather than lighter — otherwise it floats
        forward and the content sinks behind it.

   Density, radius, type and row height stay Ledger's exactly. This register is
   one move — the ground — and a register that changed everything at once would
   be a different product rather than the same tool at night.

   @structural --color-canvas, --color-ink-900, --color-ink-850, --color-ink-950, --color-paper, --color-paper-dim, --color-ink-800, --color-ink-700

   The whole point of this register is its VALUE, and the 配色 layer repaints
   colour after the register is applied. On twelve light registers that is
   right. Here a palette that repaints the ground light does not restyle 夜, it
   deletes it — and worse, it repaints the ground without repainting the text,
   which is white. Every surface and every ink is therefore structural; the
   ACCENT still follows the palette, so 夜 + 青绿 is a green-on-black console
   rather than a black one. */`;

// Replace ledger.css's own header comment (the one immediately before @theme).
// ledger.css opens with a shared font-stack comment that every register
// carries; the register's OWN header is the second one, "/* Ledger — ".
// Anchoring on the first `/*` would have eaten the font declaration.
const at = css.indexOf("/* Ledger —");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("ledger.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

/** token -> value. Every one of these is argued in the header above. */
const MOVES = {
  // ── 1. the ground goes under ────────────────────────────────────────────
  "--color-canvas": "#0d1117",
  "--color-ink-950": "#080b0f",
  "--color-ink-900": "#161b22",
  "--color-ink-850": "#1c2230",
  "--color-ink-800": "rgba(255, 255, 255, 0.10)",
  "--color-ink-700": "rgba(255, 255, 255, 0.18)",

  // Text. Not #fff: pure white on near-black is the other half of the
  // vibration problem, and 92% reads as white without the buzz.
  "--color-paper": "#e8edf4",
  "--color-paper-dim": "#8b98a9",

  // ── 2. borders invert ───────────────────────────────────────────────────
  "--border-subtle": "rgba(255, 255, 255, 0.08)",
  "--border-strong": "rgba(255, 255, 255, 0.16)",

  // ── 3. the accent emits ─────────────────────────────────────────────────
  "--color-primary": "#ff7a45",
  "--color-primary-deep": "#ff9166",
  "--color-primary-soft": "rgba(255, 122, 69, 0.14)",
  "--color-on-primary": "#1a0d06",

  // ── 4. a ground that is not flat ────────────────────────────────────────
  "--canvas-image":
    "radial-gradient(70rem 48rem at 18% -6%, rgba(90, 130, 200, 0.10), transparent 62%)",

  // ── 5. the rail goes darker, not lighter ────────────────────────────────
  "--color-nav-bg": "#080b0f",
  "--color-nav-bg-deep": "#05070a",
  "--color-nav-fg": "#e8edf4",
  "--color-nav-fg-dim": "#7b8798",
  "--color-nav-hover": "#12171f",
  "--color-nav-active": "#1a212b",
  "--color-nav-border": "rgba(255, 255, 255, 0.08)",
  "--color-nav-accent": "#ff7a45",

  // Elevation on a dark ground is a lighter surface, not a darker shadow --
  // Ledger separates by border and keeps --shadow-card none, which is still
  // right here. Only the overlay keeps a shadow, and it goes deeper so a modal
  // still reads as floating over a page that is already dark.
  "--shadow-raised": "0 1px 0 rgba(255, 255, 255, 0.06)",
  "--shadow-overlay": "0 16px 40px rgba(0, 0, 0, 0.60)",
};

for (const [token, value] of Object.entries(MOVES)) {
  // Exactly TWO spaces of indent, and the value may span lines. `^\s*` matched
  // the prose inside the surface-token comment box on 2026-08-23 and rewrote a
  // sentence while reporting success.
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
