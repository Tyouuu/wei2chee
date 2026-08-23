// Derives design-system/tokens/pop.css from soft.css.
//
//   node scripts/derive-pop.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/soft.css";
const OUT = "design-system/tokens/pop.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 波普 (Pop) — the register that uses more than one colour.

   WHERE IT CAME FROM. The founder found arhamkhnz/next-shadcn-admin-dashboard
   (MIT, Next.js 16, Tailwind v4, shadcn on Radix — the same stack as this
   project) and said of its 「soft pop」 preset: 「这种才能被称为一种风格」. He
   was right that it is a style rather than a repaint, and the measurement says
   why.

   WHAT IT DOES THAT NO REGISTER HERE DID, MEASURED across the twenty-one on
   2026-08-23:

     1. THREE SATURATED COLOURS, NOT ONE. Every register in this set has one
        accent and a neutral ramp; the status tones are the only other colour
        and they are reserved for meaning. soft-pop carries an indigo primary,
        a teal secondary and an amber accent, all above chroma 0.12, and uses
        them as DECORATION. Chroma of the secondary across the existing
        twenty-one: 0.00 to 0.05. This is the first one where the second and
        third colours are colours.

     2. A BIG RADIUS AND A HARD BLACK EDGE AT THE SAME TIME. The set had
        rounded-and-borderless (柔和, radius 18px, border 0px) and
        square-and-bordered (粗野, radius 12px, border 3px black). Nothing had
        both. 26px corners with a 2px pure-black outline is a different object
        from either — it reads as a sticker rather than as a card or a slab.

     3. A GROUND THAT IS NOT PAPER AND NOT DARK. oklch(0.9789 0.0082 121.6)
        is a pale mint. Sixteen of the twenty-one grounds sit above lightness
        0.82 with chroma under 0.02 — near-white. This one is nearly as light
        and unmistakably green.

   WHO IT IS FOR. Businesses whose customer is choosing with their eyes and is
   under forty: bubble tea, dessert, nail salon, pet grooming, kids' classes,
   party supplies, phone accessories. A 老字号 or a law firm that picked this
   would look like it was trying too hard, which is the honest warning to put
   on the card.

   COLOUR SOURCE. tweakcn's soft-pop (jnsahaj/tweakcn, Apache-2.0) — the same
   source as the twenty-five 配色, already attributed in every palette file.
   Values copied; the structure below is this project's own.

   @structural --color-ink-800, --border-card-width

   The 配色 layer repaints hues, and it should: 波普 + 森绿 is a green sticker.
   But the black EDGE is the register, not the colour — a palette that softened
   it to its own grey would turn this back into 柔和 wearing a different hue. */`;

const at = css.indexOf("/* 柔和 (Soft)");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("soft.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  // ── 1. the black edge, which is the whole object ────────────────────────
  // 柔和 is 0px and floats on a shadow; this one is drawn.
  "--border-card-width": "2px",
  "--color-ink-800": "#000000",
  "--color-ink-700": "#000000",
  // The shadow stops being atmosphere and becomes a second, offset edge --
  // small, because at 26px radius a big offset reads as a mistake rather than
  // as weight (which is 粗野's move and needs square corners to work).
  // Rendered at 3px and measured by eye: at 26px radius the offset disappears
  // into the corner curve and the panel reads as an ordinary outlined card.
  // 5px is where it starts to read as a second, displaced edge.
  "--shadow-card": "5px 5px 0 rgba(0, 0, 0, 1)",
  "--shadow-raised": "6px 6px 0 rgba(0, 0, 0, 1)",
  "--shadow-overlay": "8px 8px 0 rgba(0, 0, 0, 1)",

  // ── 2. three colours, all of them colours ───────────────────────────────
  "--color-primary": "#5b4bd6",
  "--color-primary-deep": "#4436b4",
  "--color-primary-soft": "#e6e2fb",
  "--color-on-primary": "#ffffff",
  // The secondary and the accent are DECORATION here, so they are named on the
  // two roles this system already renders in quantity rather than invented as
  // new tokens: 玉 is the teal, 铜 the amber.
  "--color-jade": "#0e8a86",
  "--color-jade-bright": "#14a8a3",
  "--color-jade-chart": "#14a8a3",
  "--color-brass": "#a86a05",
  "--color-brass-bright": "#d98c0a",
  "--color-brass-chart": "#d98c0a",
  "--color-clay": "#c8341f",
  "--color-clay-bright": "#e0472f",
  "--color-clay-deep": "#a3230f",

  // ── 3. a ground that is faintly green ───────────────────────────────────
  "--color-canvas": "#f3f8ee",
  "--color-ink-950": "#eaf2e2",
  "--color-ink-900": "#ffffff",
  "--color-ink-850": "#f6f6f4",
  "--color-paper": "#000000",
  "--color-paper-dim": "#4a4a48",

  // ── the sticker's corners ───────────────────────────────────────────────
  "--radius-sm": "12px",
  "--radius-md": "16px",
  "--radius-lg": "26px",
  "--radius-control": "999px",

  // Slightly heavier than 柔和's, because a 2px black outline next to a light
  // weight reads as an outline around nothing.
  "--fw-medium": "600",
  "--fw-semibold": "800",

  // THE NAVIGATION GETS THE EDGE TOO. Rendered first without this and the top
  // bar -- the largest element on the page -- was the one thing with no black
  // outline, in the register whose entire identity is the black outline.
  "--color-nav-border": "#000000",
  "--color-nav-bg": "#141414",
  "--color-nav-bg-deep": "#000000",
  "--color-nav-accent": "#9d92f0",
};

for (const [token, value] of Object.entries(MOVES)) {
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
