// Derives design-system/tokens/ink.css from large.css.
//
// Same method as scripts/derive-brut.mjs: take the closest existing register
// and move only the axes that make the new one a different register, by script
// rather than by hand, so the ~120 tokens that should NOT change cannot drift.
//
//   node scripts/derive-ink.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/large.css";
const OUT = "design-system/tokens/ink.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 墨 (Ink) — the register that is mostly empty on purpose.

   WHERE IT CAME FROM. uiprompt.site's brief for Ink Wash (水墨), recovered in
   docs/style-briefs/README.md. Its own words: 「留白 —— emptiness is not void
   but extension of meaning」, "five shades of ink: burnt, dense, heavy, light,
   pale", "generous whitespace, strong breathing room", "spacious distance
   between elements", vermilion seal red as the one accent on Xuan paper.

   WHY IT EXISTS, MEASURED. The eleven registers were measured again on
   2026-08-23, the way the weight audit was run before 粗野. Colour, radius,
   border width, elevation and row height are all well spread. SPACE is not:

     --pad-card    14 16 18 18 20 20 22 24 24        (nothing above 24)
     --row-h       32 32 36 40 42 46 48 50 52 54 56  (nothing above 56)
     --text-base   13 13 13 14 15 15 15 15 15 15 17

   Every register in the set is a normal-density business tool. There is no
   spacious one, in the way there was no heavy one before 粗野. This register
   is that axis: pad-card 40, row-h 76, one and a half times the loosest thing
   already here, so the difference is a thing you see rather than a thing you
   measure.

   AND IT IS THE ONE REGISTER THIS MARKET WOULD RECOGNISE. All eleven others
   are Western-derived — Swiss, ledger, blueprint, docket, contract, brut. For
   a product whose customers are Malaysian-Chinese SME owners, 水墨 is the only
   one of the seventy-three briefs that is theirs. That is a reason to build it
   ahead of Glassmorphism, not a decoration on top of the space argument.

   WHAT IT IS NOT. Not 素 (bare). Bare's idea is 「没有框」 — it removes the card
   entirely and lets blocks sit on the canvas. This one KEEPS the card, because
   a sheet of Xuan paper is the object the whole style is about; it just puts
   forty pixels of nothing inside it. Bare is no container. 墨 is a very large
   one.

   THE MOVES, and there are only five:

     1. SPACE.      pad-card 24 -> 40, row-h 56 -> 76, gap-stack 20 -> 30.
     2. PAPER.      Canvas #f5f1e8 (宣纸), cards #fdfbf7 — warm, not white.
     3. FIVE INKS.  Text runs the brief's own ramp: burnt #1a1a1a for headings,
                    light #5c5751 for secondary, pale #a8a29a for hairlines.
                    Greys with a warm bias, so they belong to the paper.
     4. VERMILION.  #c41e3a, the seal. One accent, used sparingly — which is
                    what the brief means by 「意在笔先」 and what a register with
                    this much white space needs to stay legible.
     5. SQUARE.     radius 0. Ink has no rounded corners, and at 40px padding a
                    corner radius is not what anyone is looking at anyway.

   Type stays 大字's — 17px on 1.75 leading, serif CJK — because a spacious
   register set in small type is just a page with wide margins. Derived from
   large.css for exactly that reason. */`;

// Replace large.css's own header comment (the one immediately before @theme).
const start = css.indexOf("/* 大字 (Large)");
const end = css.indexOf("@theme", start);
if (start < 0 || end < 0) throw new Error("large.css header not found");
css = css.slice(0, start) + HEADER + "\n" + css.slice(end);

/** token -> value. Every one of these is argued in the header above. */
const MOVES = {
  // ── 1. space ────────────────────────────────────────────────────────────
  "--pad-card": "40px",
  "--pad-card-lg": "48px",
  "--gap-stack": "30px",
  "--row-h": "76px",
  "--pad-cell-x": "20px",
  "--pad-control-x": "18px",
  "--pad-control-y": "12px",

  // ── 2. paper ────────────────────────────────────────────────────────────
  "--color-canvas": "#f5f1e8",
  "--color-ink-950": "#efe9dc",
  "--color-ink-900": "#fdfbf7",
  "--color-ink-850": "#f7f2e8",
  "--color-ink-800": "#e0d8c8",
  "--color-ink-700": "#c8bda8",

  // ── 3. five inks ────────────────────────────────────────────────────────
  "--color-paper": "#1a1a1a",
  "--color-paper-dim": "#5c5751",

  // ── 4. vermilion ────────────────────────────────────────────────────────
  "--color-primary": "#c41e3a",
  "--color-primary-deep": "#9c1830",
  "--color-primary-soft": "#f9ebe9",
  "--color-on-primary": "#fdfbf7",

  // The dark rail is the ink itself rather than a coloured navy: on a page
  // whose whole argument is paper and ink, a green or blue sidebar is a third
  // material nobody asked for.
  "--color-nav-bg": "#26221e",
  "--color-nav-bg-deep": "#1a1714",
  "--color-nav-fg": "#f2ede2",
  "--color-nav-fg-dim": "#a8a096",
  "--color-nav-hover": "#332e28",
  "--color-nav-active": "#3d372f",
  "--color-nav-border": "#453e35",
  "--color-nav-accent": "#e0685c",

  // ── 5. square, and no lift ──────────────────────────────────────────────
  "--radius-sm": "0px",
  "--radius-md": "0px",
  "--radius-lg": "0px",
  "--radius-pill": "0px",
  "--border-card-width": "1px",
  "--hairline": "1px",
  "--shadow-card": "none",
  "--shadow-raised": "none",
  "--shadow-overlay": "0 18px 44px rgba(38, 34, 30, 0.16)",

  // Serif, and the CJK half is the half that matters: a Chinese business page
  // is ~90% Han characters, so binding --font-song-cjk is what actually changes
  // what this register looks like. 合约 already pairs these two faces, and at
  // 13px on 40px rows it reads as a contract; at 17px on 76px rows with 40px of
  // padding it reads as a page of a book. Same ink, different amount of paper.
  "--font-ui":
    'var(--font-serif-latin), var(--font-song-cjk), "Songti SC", "SimSun", "PingFang SC", "Microsoft YaHei", Georgia, serif',

  // Labels in the brief's own register: 「意在笔先」 is quiet, so no shouting.
  "--label-transform": "none",
  "--tracking-label": "0.06em",
};

for (const [token, value] of Object.entries(MOVES)) {
  // Exactly TWO spaces of indent, and the value may span lines.
  //
  // `^s*` used to match the prose inside the surface-token comment box
  // first: those lines read `     --surface-blur: backdrop-filter for the
  // card`, which is indistinguishable from a declaration to a regex. The
  // derive reported 21 tokens moved and had rewritten a sentence inside a
  // comment. The comment lines were renamed too, so this is the second lock.
  const re = new RegExp(`(^  ${token}\s*:\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);
