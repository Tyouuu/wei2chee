// Derives design-system/tokens/lacquer.css from hearth.css.
//
//   node scripts/derive-lacquer.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/hearth.css";
const OUT = "design-system/tokens/lacquer.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 漆 (Lacquer) — gold hairlines and inlaid panels on a warm ivory board.

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

   NO STRUCTURAL TOKENS ANY MORE -- the annotation this file used to carry on
   the line above is gone, and deliberately. It was there because the register
   was a
   coloured ground under pale panels, and a palette repainting the ground pale
   deleted it. With a neutral board that whole hazard is gone, and the register
   gains what it was excluded from: all nine palettes may repaint it, so 漆 + 森绿
   is a jade lacquer and 漆 + 群青 a blue one. The identity that survives is the
   one that never depended on the hue — gold hairlines, inlaid 6px panels,
   floating shadow, and the trades it speaks to. */`;

const at = css.indexOf("/* Hearth —");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("hearth.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  /* ── 1. THE GROUND IS NOT A COLOUR ANY MORE ───────────────────────────
     2026-08-27. This register was built as 「the first register whose GROUND
     is a colour」 -- #6e2019 oxblood, chroma 0.112 -- for Malaysian-Chinese
     trades whose own shopfront is already red.

     The founder: 「这些鲜艳的颜色只会是配色 跟着就没有人会使用来当底色」, and
     then, when the argument was that it might still hold on a dashboard:
     「我觉得在后台也站不住」.

     Measured the same hour. Ten mature landing pages, dominant ground colour:
     five #080808, five #f8f8f8, chroma 0.000 on ALL TEN. Nine real business
     systems on 2026-08-26 (SQL Account, AutoCount, Xero, Linear, Stripe,
     Notion, monday, FreshBooks, Zoho): grounds 9/9 neutral, primaries 9/9
     coloured. Two independent samples, one answer, and it is his.

     So the board is warm ivory now and the oxblood is where every reference
     puts its colour: the accent. Nothing else about the register moves -- the
     gold hairline, the inlaid 6px radius, the floating panel and the trades it
     is for are all still only true of this one. What it loses is the one
     property no product in either sample has. */
  "--color-canvas": "#f7efe8",
  "--color-ink-950": "#f0e4da",

  // ── 2. the panels are white, so they still lift off the board ──────────
  "--color-ink-900": "#ffffff",
  "--color-ink-850": "#f6efe3",
  "--color-ink-800": "#e6d9c6",
  "--color-ink-700": "#cbb99f",
  "--color-paper": "#24140f",
  "--color-paper-dim": "#6b5348",

  /* The inversion this register needed is gone with the coloured ground: its
     two surfaces are the same value again, like every other register's, so a
     page title reads in the same ink as everything else. */
  "--color-on-canvas": "#24140f",
  "--color-on-canvas-dim": "#6b5348",

  /* Warm rather than grey -- a cool shadow on a warm ivory board reads as a
     smudge -- but lighter than the version tuned for the oxblood ground. */
  "--shadow-card": "0 1px 2px rgba(60, 24, 16, 0.10), 0 6px 18px rgba(60, 24, 16, 0.10)",
  "--shadow-raised": "0 2px 6px rgba(60, 24, 16, 0.14), 0 12px 30px rgba(60, 24, 16, 0.12)",
  "--shadow-overlay": "0 24px 60px rgba(60, 24, 16, 0.26)",

  // Inlaid, not a rounded tile.
  "--radius-sm": "4px",
  "--radius-md": "6px",
  "--radius-lg": "8px",

  // A record table has no surface of its own -- transparent in all seventeen
  // registers that came before, which was invisible while the ground was
  // near-white. Here it would show oxblood through near-black text, so the
  // body sits on the panel colour like everything else the customer reads.
  "--color-table-bg": "var(--color-ink-900)",

  // --background IS THE SURFACE CONTENT SITS ON, not the page ground.
  //
  // shadcn pairs --background with --foreground, and every pulled section
  // renders `bg-background text-foreground`. Mapping it to --color-canvas is
  // right for seventeen registers whose ground and panels are the same value;
  // here it put near-black text on oxblood, and a contrast audit of the
  // customer's own website page found 95 nodes below 4.5:1.
  //
  // Pointing it at the panel instead is not a workaround -- it is what this
  // register means. Content sits on ivory; the oxblood is the board AROUND the
  // panels, which SystemShell paints from --color-canvas directly and which is
  // therefore untouched.
  "--background": "var(--color-ink-900)",

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
