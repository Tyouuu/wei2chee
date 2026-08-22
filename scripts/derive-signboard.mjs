// Derives design-system/tokens/signboard.css from swiss.css.
//
//   node scripts/derive-signboard.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/swiss.css";
const OUT = "design-system/tokens/signboard.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 招牌 (Signboard) — the first register whose headings are set in a different
   face from its body.

   WHY IT EXISTS, MEASURED. All sixteen registers declared exactly two faces:
   --font-ui and --font-numeric. A page heading and a table cell were the same
   family in every single one of them. TYPE CONTRAST — the difference between a
   shop sign and the price list under it — was a kind of difference the
   vocabulary could not express, in the same way blur and grain could not be
   expressed before the surface tokens were added the same day.

   --font-display was added to every register on 2026-08-23, defaulting to
   --font-ui so that nothing changed. This is the register that gives it a
   reason to exist.

   WHAT IT IS. A shoplot sign and the price list beneath it. The name is set in
   a heavy condensed face at 46px with the tracking pulled in; everything under
   it is a plain readable sans at 15px. The contrast between those two is the
   whole register — not the colour, not the corners.

   WHY Archivo Narrow AND NOT Oswald. Oswald is the condensed face every
   generated "bold headline" page reaches for, and a register that used it
   would read as copied. Archivo Narrow is the same superfamily as the Archivo
   already bound to --font-industrial-latin, so the pairing looks chosen.

   FOR THE CJK HALF, the contrast is WEIGHT rather than family, and that is
   honest rather than a compromise: a Malaysian-Chinese shop sign is bold 黑体
   over regular 黑体, which is exactly what a heavier display weight on the same
   face gives. Pretending otherwise would mean shipping a display CJK webfont
   that costs megabytes on a phone.

   HOW IT IS NOT 瑞士, which it derives from. Swiss sets everything in one
   grotesque at 38px and reads as a printed information sheet — deliberately
   even. This one breaks that evenness on purpose: 46px condensed against 15px
   regular is a jump Swiss would never make, and the accent is a signboard red
   rather than Swiss's signal red, which is a red for warning rather than for
   being seen from across a street.

   @structural --font-display

   The 配色 layer repaints colour, and a face is not colour — but without this,
   nothing stops a future palette layer from touching it. Stated so the one
   thing this register IS cannot be repainted away. */`;

const at = css.indexOf("/* 瑞士 (Swiss)");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("swiss.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  // ── the sign ────────────────────────────────────────────────────────────
  "--font-display":
    'var(--font-signboard-latin), var(--font-hei-cjk), "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  // 46 against a 15px body. Swiss's 38 is a heading; this is a sign.
  "--text-hero": "46px",
  "--text-title": "26px",
  // Condensed type wants its tracking pulled in further, or the narrow
  // counters read as gaps.
  "--tracking-title": "-0.03em",
  "--leading-tight": "1.02",
  "--fw-semibold": "700",

  // ── seen from across a street ───────────────────────────────────────────
  // Swiss's #d92b1c is a signal red: it means stop. This is a sign red: it
  // means look. Warmer, deeper, and it holds against a warm white.
  "--color-primary": "#c8102e",
  "--color-primary-deep": "#9d0c24",
  "--color-primary-soft": "#fbe8ea",

  // Warm white rather than Swiss's neutral grey. A sign is painted board, and
  // a cool grey under a heavy condensed face reads as a spec sheet.
  "--color-canvas": "#f7f4ef",
  "--color-ink-900": "#ffffff",
  "--color-ink-850": "#f2eee7",
  "--color-ink-800": "#ddd7cc",
  "--color-paper": "#161412",

  "--color-nav-bg": "#161412",
  "--color-nav-bg-deep": "#0d0c0b",
  "--color-nav-accent": "#ff5c47",
};

for (const [token, value] of Object.entries(MOVES)) {
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
