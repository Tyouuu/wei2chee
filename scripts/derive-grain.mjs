// Derives design-system/tokens/grain.css from swiss.css.
//
// Same method as derive-brut / derive-ink / derive-glass / derive-night.
//
//   node scripts/derive-grain.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/swiss.css";
const OUT = "design-system/tokens/grain.css";

let css = readFileSync(SRC, "utf8");

/* The grain itself.
   feTurbulence rather than a PNG, for three reasons that all matter here:
   it is a few hundred bytes instead of a few hundred kilobytes on a page a
   Malaysian customer opens over mobile data; it tiles at any size without a
   seam; and it costs no network request at all, which a texture applied to
   every card on every page otherwise would.
   No `;` anywhere in the value -- the derive matcher below reads up to the
   first semicolon, so `data:image/svg+xml;utf8` would truncate it. */
const NOISE = (opacity, freq) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='${opacity}'/%3E%3C/svg%3E")`;

const HEADER = `/* 粒 (Grain) — the register you can feel.

   WHY IT EXISTS. Three surface kinds now exist in the set and only two were in
   use: thirteen registers are FLAT and 玻璃 is GLASS. --surface-image, added
   with the surface vocabulary on 2026-08-23, had no register using it at all —
   a word in the language that nothing had said yet.

   This says it. Every card and the page behind it carry a real noise field, so
   the whole system reads as something PRINTED rather than something displayed.
   It is the riso/photocopy look: paper you can see the tooth of, ink that sits
   on top of it, and one flat spot colour.

   HOW IT IS NOT 印 OR 墨. Both of those are also paper registers, and the
   difference is not subtle once the three are beside each other:

     印 (Docket)  a carbon-copy invoice book — Song serif, 2px rules, dark red,
                  13px on 32px rows. It is a FORM.
     墨 (Ink)     a sheet of Xuan paper — serif, 40px of padding, vermilion,
                  17px on 76px rows. It is a PAGE.
     粒 (Grain)   a risograph print — humanist SANS, 1px rules, one flat blue,
                  15px on 46px rows, and a texture neither of the other two has.

   Serif/serif/sans, form/page/print, and only one of the three has a surface
   you can see. Derived from 瑞士 rather than from either paper register for
   exactly that reason: Swiss brings the sans, the flatness and the square
   corners, and the grain does the rest.

   THE MOVES:

     1. THE TOOTH.  --surface-image on every card and --canvas-image on the
        ground, both feTurbulence. The card's grain is slightly stronger than
        the ground's, which is what makes the card read as a separate sheet
        laid on the page rather than a hole cut in it.

     2. WARM STOCK.  Swiss's canvas is a cool #f4f4f5. Uncoated paper is warm:
        #eeebe3 for the ground, #faf8f2 for the sheet. On a textured surface a
        cool grey reads as dirty rather than as paper.

     3. ONE FLAT INK.  Riso blue #2b4bd6 instead of Swiss's signal red. Flat,
        saturated, and never gradient — a spot colour is either printed or it
        is not.

     4. SOFTER BLACK.  #1c1b19 rather than #18181b, and body text at 15px
        stays. Pure black on a visible tooth looks like a scan artefact.

     5. NOTHING FLOATS.  --shadow-card stays none, as in Swiss. A drop shadow
        on a printed sheet is the one thing that would break the whole idea.

   @structural --surface-image, --canvas-image

   The two textures outrank the 配色 layer, for the same reason 粗野's 3px
   stroke does: the palette repaints COLOUR, which is right, and the grain is
   not colour. Without this, picking any palette would silently return this
   register to 瑞士. The ground, the ink and the accent all still follow the
   palette, so 粒 + 青绿 is a green risograph rather than a blue one. */`;

const at = css.indexOf("/* 瑞士 (Swiss)");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("swiss.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

/** token -> value. Every one of these is argued in the header above. */
const MOVES = {
  // ── 1. the tooth ────────────────────────────────────────────────────────
  "--surface-image": NOISE("0.30", "0.85"),
  "--canvas-image": NOISE("0.22", "0.80"),

  // ── 2. warm stock ───────────────────────────────────────────────────────
  "--color-canvas": "#eeebe3",
  "--color-ink-900": "#faf8f2",
  "--color-ink-850": "#f2efe6",
  "--color-ink-800": "#d8d3c6",
  "--color-ink-700": "#bab3a3",
  "--color-ink-950": "#e5e1d6",

  // ── 3. one flat ink ─────────────────────────────────────────────────────
  "--color-primary": "#2b4bd6",
  "--color-primary-deep": "#1e37a8",
  "--color-primary-soft": "#e4e8fb",
  "--color-on-primary": "#faf8f2",

  // ── 4. softer black ─────────────────────────────────────────────────────
  "--color-paper": "#1c1b19",
  "--color-paper-dim": "#57534b",

  // The rail is the second ink of a two-colour print: near-black stock with
  // the same blue as its one accent, rather than Swiss's navy.
  "--color-nav-bg": "#1c1b19",
  "--color-nav-bg-deep": "#131210",
  "--color-nav-fg": "#f2efe6",
  "--color-nav-fg-dim": "#a39c8f",
  "--color-nav-hover": "#282621",
  "--color-nav-active": "#332f28",
  "--color-nav-border": "#3d382f",
  "--color-nav-accent": "#7d92ee",
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
