// Derives design-system/tokens/code.css from ledger.css.
//
//   node scripts/derive-code.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/ledger.css";
const OUT = "design-system/tokens/code.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 码 (Code) — the register where every character is the same width.

   WHY IT EXISTS, MEASURED. Body faces across the eighteen registers on
   2026-08-23:

     bare · brut · docket ×2 · industrial ×3 · rounded ×2 · sans ×2
     serif ×2 · soft ×2 · swiss ×3

   Nine families, and every one of them PROPORTIONAL. --font-numeric has been
   monospace on all eighteen since the beginning, so the product already knows
   the difference matters — it just never let a register make that difference
   the whole page. Monospace changes the texture of a screen more completely
   than any colour does, and it was the last untouched thing about type after
   招牌 took the display face.

   IT IS NOT A DEVELOPER THEME. The businesses this is for spend their day
   looking at codes: spare parts and their part numbers, phone and IT repair,
   printing with job numbers, courier with tracking codes, anything with a
   model column. Set a table of those in a proportional face and every column
   is ragged; set it in monospace and the digits line up without anybody
   asking. That is the argument, and it is why the density stays 台账's —
   13px on 32px rows, because this is a register for reading a lot of short
   strings rather than any prose.

   AND IT IS HONEST ABOUT THE CJK HALF. There is no Han monospace here: 黑体 is
   already fixed-width for Han characters, so a Chinese line comes out aligned
   whatever face it is in, and the Latin half is the part that needed fixing.
   Shipping a Han "mono" webfont would cost megabytes to solve a problem that
   does not exist.

   THE MOVES, and there are only three:

     1. THE BODY IS MONOSPACE.  --font-ui and --font-display both. A heading in
        a proportional face over a monospace table reads as two systems.

     2. THE ACCENT IS PRINTER'S BLUE.  #0f6fa8. 台账's burnt orange is the one
        thing about it that reads as a ledger book, and this is not one.

     3. SQUARE AND COOL.  Radius 3 -> 2, and the warm grey ground goes cool.
        A monospace page with rounded corners reads as a code sandbox.

   Everything else — density, borders, elevation, the uppercase labels — stays
   台账's exactly. One move, said clearly. */`;

const at = css.indexOf("/* Ledger —");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("ledger.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  // ── 1. every character the same width ───────────────────────────────────
  "--font-ui":
    'var(--font-mono-latin), ui-monospace, "SFMono-Regular", Menlo, var(--font-hei-cjk), "PingFang SC", "Microsoft YaHei", monospace',
  "--font-display":
    'var(--font-mono-latin), ui-monospace, "SFMono-Regular", Menlo, var(--font-hei-cjk), "PingFang SC", "Microsoft YaHei", monospace',
  // Monospace runs wide, so the same 13px needs a little more room per line
  // and a little less between them.
  "--leading-body": "1.5",
  "--tracking-label": "0.08em",

  // ── 2. printer's blue ───────────────────────────────────────────────────
  "--color-primary": "#0f6fa8",
  "--color-primary-deep": "#0b5580",
  "--color-primary-soft": "#e2f0f8",

  // ── 3. square and cool ──────────────────────────────────────────────────
  "--radius-sm": "2px",
  "--radius-md": "2px",
  "--radius-lg": "2px",
  "--color-canvas": "#f4f6f7",
  "--color-ink-950": "#e9edef",
  "--color-ink-900": "#ffffff",
  "--color-ink-850": "#f2f5f6",
  "--color-ink-800": "#dde3e6",
  "--color-ink-700": "#c3ccd1",
  "--color-paper": "#15202a",
  "--color-paper-dim": "#5b6b76",

  "--color-nav-bg": "#15202a",
  "--color-nav-bg-deep": "#0e1720",
  "--color-nav-accent": "#4aa8dd",
};

for (const [token, value] of Object.entries(MOVES)) {
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
