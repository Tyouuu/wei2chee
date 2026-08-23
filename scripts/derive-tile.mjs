// Derives design-system/tokens/tile.css from hearth.css.
//
//   node scripts/derive-tile.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/hearth.css";
const OUT = "design-system/tokens/tile.css";

let css = readFileSync(SRC, "utf8");

/* The motif.
   A 48px tile: a four-petal figure with a diamond at each corner, which is the
   bones of the Peranakan floor tiles in every old kopitiam and shophouse in
   Malacca and Penang. Drawn rather than photographed — it tiles seamlessly at
   any size, costs a few hundred bytes, and needs no network request on a page
   somebody opens over mobile data.
   No `;` in the value: the derive matcher below reads to the first semicolon. */
const TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='none' stroke='%2314837a' stroke-opacity='0.20' stroke-width='1.1'%3E%3Cpath d='M24 6c6 6 12 12 18 18-6 6-12 12-18 18C18 36 12 30 6 24 12 18 18 12 24 6z'/%3E%3Cpath d='M24 15c3 3 6 6 9 9-3 3-6 6-9 9-3-3-6-6-9-9 3-3 6-6 9-9z'/%3E%3C/g%3E%3Cg fill='%23c25a3a' fill-opacity='0.16'%3E%3Ccircle cx='0' cy='0' r='2.6'/%3E%3Ccircle cx='48' cy='0' r='2.6'/%3E%3Ccircle cx='0' cy='48' r='2.6'/%3E%3Ccircle cx='48' cy='48' r='2.6'/%3E%3Ccircle cx='24' cy='24' r='2'/%3E%3C/g%3E%3C/svg%3E")`;

const HEADER = `/* 砖 (Tile) — the register whose ground is a pattern.

   WHY IT EXISTS, MEASURED. --canvas-image has been on every register since the
   surface vocabulary was built, and exactly two have ever set it: 玻璃 with
   three radial fields and 夜 with one low pool of light. Both are WASHES. No
   register has ever put a REPEATING FIGURE on the ground, which is a different
   thing entirely — a wash is atmosphere, a pattern is a material with a
   history.

   The other measurement is the luminance spread: sixteen of nineteen registers
   sit above 0.82. The near-white end is where everything already is, so a
   twentieth that is another near-white page needs a reason that is not colour,
   and a floor is one.

   WHAT THE FIGURE IS. A 48px tile: a four-petal figure with a diamond at each
   corner, which is the bones of the Peranakan floor tiles in every old
   kopitiam and shophouse in Malacca and Penang. It is drawn as an SVG rather
   than photographed, so it tiles seamlessly at any size, costs a few hundred
   bytes, and needs no network request on a page somebody opens over mobile
   data.

   WHICH TRADES. Kopitiam, bakery, kaya toast, heritage café, herbal shop, tea
   merchant, old-town anything. These are businesses whose premises already have
   this floor, and for whom every register in this set so far has been somebody
   else's software.

   THE PANELS STAY PLAIN, and that rule comes from 漆: a pattern under text is
   the fastest way to make a system unreadable. The figure is on the GROUND;
   every card is flat cream, and the contrast where the words are never changes.
   The pattern is what a customer sees around the work, not through it.

   HOW IT IS NOT 粒. 粒 is a texture — noise, no figure, no repeat you can
   point at. This is a MOTIF: it has a shape, an origin and a grid. One is a
   surface treatment, the other is a decoration, and the difference is whether
   you can draw it from memory.

   @structural --canvas-image

   The 配色 layer repaints colour, and a pattern is not colour — but it is the
   only thing this register is, so nothing may repaint it away. The ground, the
   ink and the accent all still follow the palette, which is what makes
   砖 + 青绿 a green-tiled floor rather than a different register. */`;

const at = css.indexOf("/* Hearth —");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("hearth.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  // ── the floor ───────────────────────────────────────────────────────────
  "--canvas-image": TILE,
  // Warm cement, the colour the grout goes. Hearth's #faf6f0 is a paper cream
  // and the figure disappears into it.
  "--color-canvas": "#f0e9dd",

  // ── the panels stay plain ───────────────────────────────────────────────
  // Flat cream, no pattern, and a slightly firmer shadow than Hearth's so a
  // card reads as sitting ON the floor rather than being part of it.
  "--color-ink-900": "#fffdf8",
  "--color-ink-850": "#f7f1e6",
  "--color-ink-800": "#e3d8c6",
  "--shadow-card": "0 1px 2px rgba(60, 40, 24, 0.07), 0 8px 20px rgba(60, 40, 24, 0.09)",

  // A record table is transparent by default, which is invisible on nineteen
  // registers whose ground is flat. Here the floor showed straight through the
  // data rows -- the exact thing this register's own rule forbids. The token
  // exists because 漆 needed it first.
  "--color-table-bg": "var(--color-ink-900)",

  // Tiles are cut and laid; they do not have soft corners.
  "--radius-sm": "4px",
  "--radius-md": "6px",
  "--radius-lg": "8px",

  // The two colours in the motif, promoted: the glaze teal and the terracotta
  // of the corner dots.
  "--color-primary": "#14837a",
  "--color-primary-deep": "#0f645d",
  "--color-primary-soft": "#dff0ee",
  "--color-paper": "#26201a",
  "--color-paper-dim": "#6a5b4c",

  "--color-nav-bg": "#26201a",
  "--color-nav-bg-deep": "#1a1611",
  "--color-nav-accent": "#e08a5c",
};

for (const [token, value] of Object.entries(MOVES)) {
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
