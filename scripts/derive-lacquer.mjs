// Derives design-system/tokens/lacquer.css from hearth.css.
//
//   node scripts/derive-lacquer.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/hearth.css";
const OUT = "design-system/tokens/lacquer.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 漆 (Lacquer) — the first register whose GROUND is a colour.

   WHY IT EXISTS, MEASURED. Saturation of every register's three surfaces on
   2026-08-23, as (max-min)/max on the hex:

     accent   0.11 … 1.00   — the whole range is used
     canvas   0.00 … 0.19   — except 夜 at 0.435, which is a near-black blue
     card     0.00 … 0.16     grey at 0.005 luminance, so not a colour either

   Seventeen registers, and every one of them is a NEUTRAL PAGE WITH A COLOURED
   BUTTON. Colour has only ever been allowed on the smallest thing on screen.
   That is a whole kind of difference the set did not have, and it is the one a
   customer names first when they say a system looks like theirs.

   WHY THE GROUND AND NOT THE CARD. A saturated card is a saturated reading
   surface, and this is a system somebody sits in front of for a working day.
   The panels stay near-white; the PAGE they sit on carries the colour. That is
   how a lacquered board with enamel panels works, and it is why the register
   is readable at all — the contrast where the text is never changes.

   WHICH TRADES. Restaurants, tea houses, bakeries, gold and jewellery,
   wedding, funeral and temple supply — Malaysian-Chinese businesses whose own
   shopfront is already a colour, and for whom a white page with a coloured
   button looks like somebody else's software.

   THE MOVES:

     1. THE GROUND IS OXBLOOD.  #6e2019 at 0.72 saturation and 0.09 luminance.
        Saturated but not bright: a strong colour behind pale panels reads as
        material, and the same colour at full brightness reads as an alert.

     2. THE PANELS STAY IVORY.  #fdfaf4, and the shadow gets deeper and warmer
        so a pale panel on a dark ground still reads as lifted rather than as a
        hole cut in it. Hearth's shadow is tuned for a card on cream.

     3. THE ACCENT IS THE GROUND.  Buttons are the same oxblood, deepened.
        A second hue on a page that already has a strong one is where this kind
        of register turns into a mess; the brand colour IS the page.

     4. GOLD IS A HAIRLINE, NEVER A FILL.  #c8952f on rules and on the nav's
        active mark. Gold as a surface is a casino; gold as a line is lacquer.

   Derived from Hearth for its shadow-not-border card and its 22px padding —
   panels need to float and need room. Radius comes in from 14 to 6: a lacquer
   panel is inlaid, not a rounded plastic tile.

   @structural --color-canvas, --color-ink-900, --color-ink-850, --color-ink-950, --color-paper, --color-paper-dim

   The whole register is the relationship between a coloured ground and pale
   panels. A palette that repaints the ground pale deletes it, and one that
   repaints the panels leaves white text on white. Same argument 夜 and 牛皮
   make. The ACCENT still follows the palette, so 漆 + 青绿 is a jade lacquer
   rather than an oxblood one — which is exactly the variation this register
   should have. */`;

const at = css.indexOf("/* Hearth —");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("hearth.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  // ── 1. the ground is a colour ───────────────────────────────────────────
  "--color-canvas": "#6e2019",
  "--color-ink-950": "#5a1712",

  // ── 2. the panels stay pale ─────────────────────────────────────────────
  "--color-ink-900": "#fdfaf4",
  "--color-ink-850": "#f6efe3",
  "--color-ink-800": "#e6d9c6",
  "--color-ink-700": "#cbb99f",
  "--color-paper": "#24140f",
  "--color-paper-dim": "#6b5348",

  // A page title sits on the GROUND, not in a panel, and the ground here is the
  // opposite value from the panels. Every other register can use one ink
  // because its two surfaces are the same value; this one cannot.
  "--color-on-canvas": "#fbeee4",
  "--color-on-canvas-dim": "#d8b9a6",

  // Deeper and warmer than Hearth's, which is tuned for a card on cream. On a
  // dark ground a cool grey shadow reads as a smudge.
  "--shadow-card": "0 2px 4px rgba(30, 8, 6, 0.28), 0 10px 26px rgba(30, 8, 6, 0.22)",
  "--shadow-raised": "0 4px 10px rgba(30, 8, 6, 0.32), 0 16px 36px rgba(30, 8, 6, 0.28)",
  "--shadow-overlay": "0 24px 60px rgba(30, 8, 6, 0.48)",

  // Inlaid, not a rounded tile.
  "--radius-sm": "4px",
  "--radius-md": "6px",
  "--radius-lg": "8px",

  // A record table has no surface of its own -- transparent in all seventeen
  // registers that came before, which was invisible while the ground was
  // near-white. Here it would show oxblood through near-black text, so the
  // body sits on the panel colour like everything else the customer reads.
  "--color-table-bg": "var(--color-ink-900)",

  // ── 3. the accent is the ground ─────────────────────────────────────────
  "--color-primary": "#8c2a20",
  "--color-primary-deep": "#6e2019",
  "--color-primary-soft": "#f7e6e2",
  "--color-on-primary": "#fdfaf4",

  // ── 4. gold is a line ───────────────────────────────────────────────────
  "--color-nav-bg": "#3f0f0b",
  "--color-nav-bg-deep": "#2c0a07",
  "--color-nav-fg": "#f6e8d8",
  "--color-nav-fg-dim": "#c0a08c",
  "--color-nav-hover": "#521712",
  "--color-nav-active": "#651d16",
  "--color-nav-border": "#7a3128",
  "--color-nav-accent": "#c8952f",
};

for (const [token, value] of Object.entries(MOVES)) {
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
