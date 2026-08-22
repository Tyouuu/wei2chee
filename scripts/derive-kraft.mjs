// Derives design-system/tokens/kraft.css from docket.css.
//
// Same method as derive-brut / derive-ink / derive-glass / derive-night /
// derive-grain.
//
//   node scripts/derive-kraft.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/docket.css";
const OUT = "design-system/tokens/kraft.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 牛皮 (Kraft) — the register that is neither a white page nor a dark one.

   WHY IT EXISTS, MEASURED. Canvas luminance across the fifteen registers on
   2026-08-23, after 夜 filled the dark end:

     0.005   ← 夜
     0.823 0.831 0.855 0.856 0.880 0.881 0.900 0.903 0.904 0.905 0.925
     0.927 0.949 0.965

   One value at 0.005 and fourteen above 0.82. THE ENTIRE MIDDLE IS EMPTY.
   Every page this product builds is either paper-white or lights-off; there is
   nothing that reads as a material. This is 0.55: a kraft board, ink printed
   straight onto it.

   AND IT USES THE LAST WORD NOBODY HAD SAID. The same audit:
   border-style dashed 0, double 0, outline 0. --surface-border-style has been
   on every register since the surface vocabulary was built and no register has
   ever set it. A double rule is what a shipping label has, and on a mid-tone
   board it is the difference between a card and a printed panel.

   WHICH TRADES. The ones that sell a material rather than a service:
   hardware, timber, leather, coffee roasting, farm produce, packaging,
   furniture. A cream page with a serif does not look like their shop, and
   neither does a near-black console.

   HOW IT IS NOT 印 OR 粒, since all three are paper-ish:

     印 (Docket)  a carbon-copy invoice book. WHITE stock, Song serif, dark red.
     粒 (Grain)   a risograph print. NEAR-WHITE stock, sans, one flat blue,
                  visible tooth.
     牛皮 (Kraft) a printed board. MID-TONE stock at 0.55, industrial sans,
                  double rules, stencil red. The ground is the difference and
                  it is a whole axis, not a shade.

   Derived from 印 for its density and its square corners — 13px on 32px rows
   is exactly the density of a printed label — with the stock, the rules and
   the type all moved.

   @structural --color-canvas, --color-ink-900, --color-ink-850, --color-ink-950, --color-paper, --color-paper-dim, --surface-border-style

   The point of this register is the VALUE of its ground, and the 配色 layer
   repaints colour after the register is applied. Repaint a kraft board white
   and there is no register left — the same argument 夜 makes from the other
   end. The accent still follows the palette, so 牛皮 + 青绿 is a green stencil
   on board rather than a green page. */`;

const at = css.indexOf("/* 印 (Docket)");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("docket.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

/** token -> value. Every one of these is argued in the header above. */
const MOVES = {
  // ── the board ───────────────────────────────────────────────────────────
  // 0.55 luminance. Dark enough that white is not the subject and light enough
  // that near-black text keeps a 7:1 ratio against it -- a mid-tone ground is
  // only usable if the ink stays legible for a full working day.
  "--color-canvas": "#c9bca2",
  "--color-ink-950": "#bcae92",
  "--color-ink-900": "#dbd0b9",
  "--color-ink-850": "#d2c6ad",
  "--color-ink-800": "#a2957a",
  "--color-ink-700": "#8a7d63",

  // Ink printed onto board, not paper: warm near-black rather than the cool
  // navy 印 uses, because a cool ink on a warm ground reads as a colour cast.
  "--color-paper": "#241f16",
  "--color-paper-dim": "#584f3d",

  // ── the double rule ─────────────────────────────────────────────────────
  // The word no register had said. At 3px a double rule renders as two 1px
  // lines with a gap, which is what a shipping label's border is and what
  // separates a printed panel from a card.
  "--surface-border-style": "double",
  "--border-card-width": "3px",
  "--hairline": "1px",
  "--radius-sm": "0px",
  "--radius-md": "0px",
  "--radius-lg": "0px",
  "--shadow-card": "none",
  "--shadow-raised": "none",
  "--shadow-overlay": "0 14px 32px rgba(36, 31, 22, 0.34)",

  // ── stencil ─────────────────────────────────────────────────────────────
  // A stamped red-brown, the colour of ink pressed through a stencil onto
  // board. 印's #9b2c2c is a printed red and looks like it is sitting on top;
  // this one looks soaked in.
  "--color-primary": "#8c3a1e",
  "--color-primary-deep": "#6d2a13",
  "--color-primary-soft": "rgba(140, 58, 30, 0.14)",
  "--color-on-primary": "#f2ebdc",

  // Labels stencilled, which is what makes the type read as printed onto a
  // surface rather than typeset for a page.
  "--label-transform": "uppercase",
  "--tracking-label": "0.16em",

  // The rail is the crate itself: darker board, not a coloured navy.
  "--color-nav-bg": "#3b3225",
  "--color-nav-bg-deep": "#2b241a",
  "--color-nav-fg": "#e8dfcb",
  "--color-nav-fg-dim": "#a89b81",
  "--color-nav-hover": "#4a4030",
  "--color-nav-active": "#574b38",
  "--color-nav-border": "#5c5140",
  "--color-nav-accent": "#d9713f",
};

for (const [token, value] of Object.entries(MOVES)) {
  // Exactly TWO spaces of indent, and the value may span lines.
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
