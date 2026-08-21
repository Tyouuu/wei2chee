// Generates app/[locale]/style-picker/style-scope.module.css from the three
// design-system token files.
//
// WHY THIS EXISTS: style-scope.module.css is a scoped copy of
// design-system/tokens/{ledger,hearth,blueprint}.css -- see that file's own
// header comment for why the copy is unavoidable (Tailwind v4 compiles
// `@theme` to `:root`, and `:root` can't be narrowed to a subtree, but the
// style-picker has to mount all three token sets on one document at once).
//
// Until 2026-08-20 that copy was maintained BY HAND, with
// __tests__/style-scope.sync.test.ts as the only thing standing between an
// edit and silent drift. That was survivable while each style carried ~40
// tokens that changed rarely. It stopped being survivable when the styles
// grew real radius / density / type / elevation axes (~65 tokens each, three
// styles, all of them expected to keep moving as the visual design is tuned).
//
// So the copy is now derived instead of typed. The sync test is unchanged and
// still runs -- it is now checking a generator's output rather than a human's
// transcription, which is exactly the check you want to keep.
//
//   node scripts/build-style-scope.mjs        # rewrite the module
//   node scripts/build-style-scope.mjs --check # exit 1 if it would change
//
// Run it after editing any token file, then run the sync test.

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = ["ledger", "hearth", "blueprint", "bare", "docket", "large", "stamp", "contract"];
const OUT = join(ROOT, "app", "[locale]", "style-picker", "style-scope.module.css");

const sourcePath = (style) => join(ROOT, "design-system", "tokens", `${style}.css`);

/** Strips /* ... *\/ comments. Every token file contains commented-out example
 *  declarations that a naive declaration walk would otherwise pick up as real
 *  ones -- the same hazard the sync test documents at length. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Returns the interior of the first `head { ... }`, brace-depth aware so it
 *  works on blocks that contain nested rules (`@layer utilities`). */
function bracedBody(css, headPattern) {
  const m = new RegExp(`${headPattern}\\s*\\{`).exec(css);
  if (!m) throw new Error(`Could not find "${headPattern} { ... }"`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  if (depth !== 0) throw new Error(`Unbalanced braces after "${headPattern}"`);
  return css.slice(start, i - 1);
}

/** `--prop: value;` pairs, in source order -- order is preserved so the
 *  generated file reads like the token file it came from. */
function declarations(body) {
  const out = [];
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(body)) !== null) out.push([m[1], m[2].replace(/\s+/g, " ").trim()]);
  return out;
}

/** The `border-radius` a token file's own `:focus-visible` rule sets, so the
 *  scoped copy rings match the real thing per style. */
function focusRadius(css) {
  const body = bracedBody(css, ":focus-visible");
  const m = /border-radius\s*:\s*([^;]+);/.exec(body);
  if (!m) throw new Error("no border-radius in :focus-visible");
  return m[1].trim();
}

const HEADER = `/*
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *   source:    design-system/tokens/{ledger,hearth,blueprint}.css
 *   generator: scripts/build-style-scope.mjs
 *   verify:    app/[locale]/style-picker/__tests__/style-scope.sync.test.ts
 *
 * Scoped copies of the three design-system token files.
 *
 * WHY THIS FILE EXISTS: each of those files declares its custom properties
 * inside an \`@theme { ... }\` block (which Tailwind v4 always compiles to
 * \`:root\`) plus a plain \`:root { ... }\` block of craft tokens. \`:root\` always
 * means the document's root element -- no CSS mechanism, including the
 * \`@scope\` at-rule, can retarget it to something narrower. A normal consuming
 * app only ever imports ONE token file (design-system/tokens/README.md), so
 * that binding is never a problem there.
 *
 * The style-picker is the one deliberate exception in the whole design system:
 * it has to mount all three registers on the same document at the same time so
 * a customer can compare them side by side. Importing the three token files
 * directly would have every \`@theme\`/\`:root\` block collide on the same
 * property names -- last import wins for all of them, and all three columns
 * render identically.
 *
 * So the declarations below are the same values, rebound to \`.ledger\` /
 * \`.hearth\` / \`.blueprint\` classes instead of \`:root\`. Every ported component
 * in design-system/components reads these property names through \`var(--...)\`
 * and has no idea whether the value arrived from \`:root\` or from one of these
 * classes.
 */

.scope {
  color: var(--color-paper);
  background-color: var(--color-ink-950);
  font-family: var(--font-ui);
  font-size: var(--text-base);
  line-height: var(--leading-body);
  letter-spacing: var(--tracking-body);
}

.scope :global(b),
.scope :global(strong) {
  font-weight: var(--fw-semibold);
}

/* Matches each token file's own \`.tnum\` utility -- numeric columns opt in via
   a plain \`className="tnum"\`, same as the component rule requires. */
.scope :global(.tnum) {
  font-variant-numeric: tabular-nums;
}

/* Two-layer focus ring: a surface-coloured gap, then the accent -- the shape
   all three token files ship, each keyed to its own tokens. Only the ring
   radius differs per style below, matching each file's own :focus-visible
   rule. */
.scope :focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--color-ink-900),
    0 0 0 4px var(--color-primary);
}
`;

function styleBlock(style) {
  const raw = readFileSync(sourcePath(style), "utf8");
  const clean = stripComments(raw);
  const tokens = [
    ...declarations(bracedBody(clean, "@theme")),
    ...declarations(bracedBody(clean, ":root")),
  ];
  // Later wins, matching how the browser resolves the two source blocks when
  // both land on :root -- deduped here so the emitted block has one line per
  // property (which is also what the sync test's object comparison expects).
  const merged = new Map();
  for (const [prop, value] of tokens) merged.set(prop, value);

  const lines = [...merged].map(([p, v]) => `  ${p}: ${v};`).join("\n");
  const bar = "-".repeat(70);
  return `
/* ${bar} *
 * ${style[0].toUpperCase()}${style.slice(1)} -- generated from design-system/tokens/${style}.css
 * ${bar} */
.${style} {
${lines}
}

.${style} :focus-visible {
  border-radius: ${focusRadius(clean)};
}
`;
}

/** Blueprint's texture layer: background-image and ::before/::after rules that
 *  custom properties can't carry, so they are copied as rules and renamed to
 *  camelCase for CSS Modules' dot-access convention. */
function blueprintTexture() {
  const clean = stripComments(readFileSync(sourcePath("blueprint"), "utf8"));
  const body = bracedBody(clean, "@layer\\s+utilities");
  const renamed = body
    .replace(/\.blueprint-grid\b/g, ".blueprintGrid")
    .replace(/\.blueprint-sheet-marks\b/g, ".blueprintSheetMarks")
    .replace(/\.blueprint-annotation\b/g, ".blueprintAnnotation");
  // Re-indent from inside `@layer utilities { }` back to top level.
  const dedented = renamed
    .split("\n")
    .map((l) => (l.startsWith("  ") ? l.slice(2) : l))
    .join("\n")
    .trim();
  return `
/* Blueprint's drafting-grid / sheet-marks / annotation texture, generated from
 * design-system/tokens/blueprint.css's own \`@layer utilities\` block. Copied as
 * rules rather than tokens for the same reason the declarations above are
 * copied at all: this page can't import blueprint.css directly, and CSS custom
 * properties don't carry background-image or ::before/::after rules. Renamed to
 * camelCase for CSS Modules' dot-access convention. */
${dedented}
`;
}

/**
 * The 配色 layer, appended AFTER the three 版式 blocks.
 *
 * Source order is doing real work here and it is worth stating why. A palette
 * class and a layout class are both single class selectors, so they carry
 * identical specificity -- which means whichever appears LAST in the stylesheet
 * wins for the tokens they both declare. Palettes must therefore come after
 * layouts, and the layout keeps everything the palette does not mention: type
 * scale, weights, tracking, radii, density, shadows.
 *
 * That is the whole 3 x N mechanism. `.ledger .paletteSupabase` is Ledger's
 * tight rows and 3px corners wearing Supabase's greens, and neither file knows
 * about the other.
 *
 * Files come from scripts/build-palettes.mjs, which pulls them from tweakcn
 * (Apache-2.0) and repairs any contrast pair that fails AA by moving lightness
 * only. Read that generator before touching anything here.
 */
function paletteBlocks() {
  const dir = join(ROOT, "design-system", "palettes");
  if (!existsSync(dir)) return "";
  const files = readdirSync(dir).filter((f) => f.endsWith(".css")).sort();
  return files
    .map((f) => {
      const css = readFileSync(join(dir, f), "utf8").trim();
      return `
/* ---- palette: ${f.replace(/\.css$/, "")} ---- */
${css}
`;
    })
    .join("");
}

const FOOTER = `
/* Each token file ships the same 2x-display hairline override on its own
   \`:root\`; scoped here to all three classes at once. */
@media (min-resolution: 192dpi) {
  .ledger,
  .hearth,
  .blueprint {
    --hairline: 0.5px;
  }
}
`;

const output =
  HEADER + STYLES.map(styleBlock).join("") + blueprintTexture() + paletteBlocks() + FOOTER;

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== output) {
    console.error(
      "style-scope.module.css is out of date. Run: node scripts/build-style-scope.mjs",
    );
    process.exit(1);
  }
  console.log("style-scope.module.css is up to date.");
} else {
  writeFileSync(OUT, output, "utf8");
  console.log(`Wrote ${OUT}`);
}
