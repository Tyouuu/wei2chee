// Derives design-system/tokens/clear.css from large.css.
//
//   node scripts/derive-clear.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/large.css";
const OUT = "design-system/tokens/clear.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 清 (Clear) — the register for an owner who cannot read the others.

   WHY IT EXISTS, MEASURED. Three ends of three axes, all empty, across the
   twenty registers on 2026-08-23:

     --text-base        13 13 13 13 14 15 ×10 17 17      nothing above 17
     --pad-control-y    5 ×6  8 ×5  10 ×5  12 ×2         nothing above 12,
                                                          so no touch target
                                                          taller than ~41px
     dim text on card   3.89 5.15 5.26 … 7.73            only 4 of 20 reach 7:1

   Every register in this set was designed by somebody who can read 13px grey
   on white. A Malaysian SME is very often run by a person in their fifties or
   sixties, on a phone, in a shop with the lights on behind them. Nothing here
   was for them.

   HOW IT IS NOT 大字 OR 墨, which are also big. Those two are about AIR: 墨 is
   40px of padding and 76px rows at 17px type, and its argument is that空间 is
   a register. This one is about being ABLE TO READ IT, and the moves are
   different in kind:

     大字   17px type · 56px rows · dim text at 5.15:1
     墨     17px type · 76px rows · dim text at 6.92:1
     清     20px type · 64px rows · dim text at 7.4:1 · 52px touch targets

   The row height is deliberately LOWER than 墨's. Air is not the point; a page
   that shows four rows instead of eight helps nobody who is squinting.

   THE MOVES:

     1. TWENTY PIXELS.  Every other size scales with it — nothing is left at a
        size that was chosen against a 15px body.

     2. TARGETS YOU CAN HIT.  --pad-control-y 12 -> 16, which puts a control
        at about 52px. The current maximum in the set is 41px, and 41px is a
        miss on a phone held in one hand in a shop.

     3. NO FAINT TEXT.  --color-paper-dim is 7.4:1 against the card rather than
        the 5.15 大字 inherits. Secondary text that disappears is the single
        most common way an interface excludes somebody, and it is invisible to
        every test that does not measure it.

     4. NOTHING DECORATIVE.  No shadow, 1px borders, 4px corners, one accent at
        full strength. Every pixel spent on style here is a pixel not spent on
        legibility.

   Derived from 大字 because it is already the largest thing in the set, so the
   diff is only what makes this a different KIND of large. */`;

const at = css.indexOf("/* 大字 (Large)");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("large.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  // ── 1. twenty pixels, and everything with it ────────────────────────────
  "--text-micro": "13px",
  "--text-xs": "14px",
  "--text-sm": "16px",
  "--text-base": "20px",
  "--text-lg": "22px",
  "--text-title": "28px",
  "--text-hero": "40px",
  "--row-h": "64px",
  "--leading-body": "1.65",

  // ── 2. targets you can hit ──────────────────────────────────────────────
  "--pad-control-y": "16px",
  "--pad-control-x": "20px",
  "--pad-cell-x": "18px",
  "--pad-card": "24px",

  // ── 3. no faint text ────────────────────────────────────────────────────
  // 7.4:1 against this register's own card. The set's median is 5.9 and its
  // worst was 3.89 until this same audit fixed 柔和.
  "--color-paper": "#101418",
  "--color-paper-dim": "#4a5560",

  // ── 4. nothing decorative ───────────────────────────────────────────────
  "--radius-sm": "4px",
  "--radius-md": "4px",
  "--radius-lg": "6px",
  "--shadow-card": "none",
  "--shadow-raised": "0 2px 0 rgba(16, 20, 24, 0.10)",
  "--border-card-width": "1px",
  "--color-canvas": "#f2f4f6",
  "--color-ink-900": "#ffffff",
  "--color-ink-850": "#eef1f4",
  "--color-ink-800": "#c9d1d8",

  // One accent, at full strength, and blue because it is the hue that survives
  // the most common colour-vision differences.
  "--color-primary": "#1d4ed8",
  "--color-primary-deep": "#1739a8",
  "--color-primary-soft": "#e4eafc",

  "--color-nav-bg": "#101418",
  "--color-nav-bg-deep": "#080b0e",
  "--color-nav-accent": "#7aa2ff",
};

for (const [token, value] of Object.entries(MOVES)) {
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
