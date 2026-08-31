import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Drift guard for style-scope.module.css.
 *
 * style-scope.module.css exists because Tailwind v4 always compiles a token
 * file's `@theme { ... }` block to `:root`, which cannot be scoped to a
 * subtree — see that file's own header comment for the full rationale. The
 * workaround is a hand-maintained copy: each of design-system/tokens/
 * {ledger,hearth,blueprint}.css's custom-property declarations is rebound
 * onto a `.ledger` / `.hearth` / `.blueprint` class instead of `:root` /
 * `@theme`. Nothing derives that copy automatically, so it can silently
 * drift the next time one of the token files is edited.
 *
 * This test is the missing build-time check: for each style, it extracts
 * every `--custom-property: value;` declaration from the source token file
 * and from the module's matching class block, then asserts the two sets are
 * identical — same properties, same values, in both directions (an extra
 * property on either side, or a stale value, fails the test).
 */

const ROOT = process.cwd();

/* ⚠️ DERIVED, NOT LISTED, AND THIS COST FIVE DAYS.
 *
 * It was `["ledger", "hearth", "blueprint"]` -- the three registers that
 * existed when this file was written. Three more were added; the generator
 * learnt about them and this list did not, so half the registers had NOTHING
 * checking that the generated copy matched the source.
 *
 * What it let ship: 中台's rail text was corrected in counter.css and the
 * generated file kept the old value. Every word in that sidebar rendered at
 * 3.39:1 -- nineteen strings on one page -- while this test passed and the
 * token file's own comment claimed 6.44:1.
 *
 * Read from the directory instead. A seventh register cannot be added without
 * this file noticing, which is the whole reason it exists. */
const STYLES = readdirSync(join(ROOT, "design-system", "tokens"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => f.replace(/\.css$/, ""));
type Style = (typeof STYLES)[number];

const SOURCE_PATHS: Record<Style, string> = {
  ...Object.fromEntries(
    STYLES.map((s) => [s, join(ROOT, "design-system", "tokens", `${s}.css`)]),
  ),
};

const MODULE_PATH = join(
  ROOT,
  "app",
  "[locale]",
  "style-picker",
  "style-scope.module.css",
);

/**
 * Strips `/* ... *\/` comments, including multi-line ones. This matters:
 * every source token file has at least one comment containing a fake
 * example declaration that looks exactly like a real one, e.g.
 * `--ds-shadow-border-base: 0 0 0 1px #00000014.` inside the --border-subtle
 * comment. Without stripping comments first, a naive regex walk picks that
 * up as a real property (or worse, has its trailing text swallow the next
 * real declaration, since it has no terminating semicolon of its own before
 * the next real one). The implementer's own throwaway verification script
 * hit exactly this false positive — see task-7-report.md §1.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extracts every `--custom-property: value;` declaration inside the FIRST
 * top-level block matching `selector { ... }`. Deliberately naive (no
 * nested-brace handling, single non-global block match) because every block
 * this test reads from is flat — declarations only, no nested rules — which
 * holds for the token files' `@theme`/`:root` blocks and the module's
 * `.ledger`/`.hearth`/`.blueprint` blocks alike. Taking only the first match
 * is what excludes each file's later `@media (min-resolution: 192dpi) { ... }`
 * block, which re-declares `--hairline` outside the plain block compared here
 * (both the source files and the module apply that override the same way, so
 * excluding it symmetrically on both sides is correct, not a gap).
 */
function extractBlockDeclarations(
  css: string,
  selectorPattern: string,
): Record<string, string> {
  const blockRegex = new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`);
  const match = blockRegex.exec(css);
  if (!match) {
    throw new Error(`Could not find a "${selectorPattern} { ... }" block`);
  }
  const body = match[1];
  const decls: Record<string, string> = {};
  const declRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let declMatch: RegExpExecArray | null;
  while ((declMatch = declRegex.exec(body)) !== null) {
    /* Whitespace INSIDE a value is not part of the value. A long font stack is
       wrapped across lines in the hand-written source and emitted on one line
       by the generator, and comparing those literally reports two registers as
       drifted when nothing about them differs -- which is a ruler crying wolf,
       and a ruler that cries wolf gets switched off. Matches how selectors are
       already normalised further down this file. */
    decls[declMatch[1]] = declMatch[2].replace(/\s+/g, " ").trim();
  }
  return decls;
}

/** A source token file's tokens: the union of its `@theme` and `:root` blocks. */
function extractSourceTokens(css: string): Record<string, string> {
  const clean = stripComments(css);
  return {
    ...extractBlockDeclarations(clean, "@theme"),
    ...extractBlockDeclarations(clean, ":root"),
  };
}

/** The module's tokens for one style: its `.ledger` / `.hearth` / `.blueprint` block. */
function extractModuleTokens(css: string, style: Style): Record<string, string> {
  const clean = stripComments(css);
  return extractBlockDeclarations(clean, `\\.${style}`);
}

describe("style-scope.module.css stays in sync with the token source files", () => {
  const moduleCss = readFileSync(MODULE_PATH, "utf8");

  for (const style of STYLES) {
    it(`.${style} declares exactly the same custom properties, with the same values, as design-system/tokens/${style}.css`, () => {
      const sourceCss = readFileSync(SOURCE_PATHS[style], "utf8");
      const sourceTokens = extractSourceTokens(sourceCss);
      const moduleTokens = extractModuleTokens(moduleCss, style);

      // Sanity check on the extraction itself: each style currently carries
      // ~40 custom properties. If a selector/regex typo in this test ever
      // made extraction return nothing on both sides, toEqual({}, {}) would
      // pass without checking anything — this guards against that.
      expect(Object.keys(sourceTokens).length).toBeGreaterThan(30);
      expect(Object.keys(moduleTokens).length).toBeGreaterThan(30);

      // Deep-equal on plain objects fails if either side has a property the
      // other lacks (drift by addition/removal) or if a shared property's
      // value differs (drift by edit) — covering both directions in one
      // assertion, with a readable key-by-key diff on failure.
      expect(moduleTokens).toEqual(sourceTokens);
    });
  }
});

/**
 * Second drift guard, for Task 7a's Blueprint-only texture layer.
 *
 * blueprint.css also ships an `@layer utilities` block — `.blueprint-grid`,
 * `.blueprint-sheet-marks::before/::after` and `.blueprint-annotation` — the
 * drafting-grid, sheet-marks and mono-label rules Task 7a built specifically
 * because Blueprint's token *values* alone weren't reliably distinguishable
 * from Ledger's on real pixels (see blueprint.css's own header comment).
 * CSS custom properties can't carry background-image or ::before/::after
 * rules, so style-scope.module.css hand-copies these three rules too,
 * renamed to camelCase for CSS Modules' dot-access convention
 * (`.blueprintGrid`, `.blueprintSheetMarks`, `.blueprintAnnotation`).
 * Nothing derives that copy automatically either, and — unlike the
 * custom-property block above — it had no drift protection at all until
 * this test.
 *
 * These rule bodies are multi-declaration (background-image, border widths,
 * content, ...), not the flat `--property: value` pairs the test above
 * compares, so this extracts full rule bodies (any `property: value;` pair)
 * and compares those, keyed to a name mapping that accounts for the
 * kebab-case (source) vs camelCase (CSS Modules) naming difference.
 */

type CssRule = { selectors: string[]; body: string };

/**
 * Finds `headPattern { ... }` and returns the `{ ... }` interior via
 * brace-depth tracking rather than a `[^}]*` regex — required here because,
 * unlike extractBlockDeclarations's flat token blocks, this interior itself
 * contains nested `{ ... }` rules (the individual utility classes).
 */
function extractBracedBody(css: string, headPattern: string): string {
  const headRegex = new RegExp(`${headPattern}\\s*\\{`);
  const headMatch = headRegex.exec(css);
  if (!headMatch) {
    throw new Error(`Could not find a "${headPattern} { ... }" block`);
  }
  const bodyStart = headMatch.index + headMatch[0].length;
  let depth = 1;
  let i = bodyStart;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) {
    throw new Error(`Unbalanced braces while reading "${headPattern} { ... }"`);
  }
  return css.slice(bodyStart, i);
}

/**
 * Splits a CSS chunk into an ordered list of top-level `selector { body }`
 * rules, brace-depth aware. Deliberately does not recurse into a rule's own
 * body — correct for the texture rules themselves (no nesting), and for the
 * module.css slice this reads from, which is bounded to end before the one
 * nested block in that file (the `@media (min-resolution)` hairline
 * override), so that block is never walked into.
 */
function parseFlatRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  let i = 0;
  while (i < css.length) {
    const braceIdx = css.indexOf("{", i);
    if (braceIdx === -1) break;
    const selectorText = css.slice(i, braceIdx).trim();
    let depth = 1;
    let j = braceIdx + 1;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = css.slice(braceIdx + 1, j);
    if (selectorText) {
      const selectors = selectorText.split(",").map((s) => s.trim().replace(/\s+/g, " "));
      rules.push({ selectors, body });
    }
    i = j + 1;
  }
  return rules;
}

/**
 * Any `property: value;` pair, not just `--custom-property` ones — the
 * texture rules use ordinary CSS properties (background-image, content,
 * border-top-width, ...). Whitespace inside a value is collapsed so a
 * multi-line background-image list compares equal regardless of how it's
 * indented in either file.
 */
function extractDeclarations(body: string): Record<string, string> {
  const decls: Record<string, string> = {};
  const declRegex = /([\w-]+)\s*:\s*([^;]+);/g;
  let declMatch: RegExpExecArray | null;
  while ((declMatch = declRegex.exec(body)) !== null) {
    decls[declMatch[1]] = declMatch[2].replace(/\s+/g, " ").trim();
  }
  return decls;
}

/**
 * Maps both naming conventions' base class onto one canonical tag, so a
 * rule's selector list can be compared across the kebab-case source and the
 * camelCase CSS-Modules copy.
 */
function normalizeSelector(selector: string): string {
  return selector
    .replace(/^\.blueprint-grid\b/, ".TEXTURE_GRID")
    .replace(/^\.blueprintGrid\b/, ".TEXTURE_GRID")
    .replace(/^\.blueprint-sheet-marks\b/, ".TEXTURE_SHEET_MARKS")
    .replace(/^\.blueprintSheetMarks\b/, ".TEXTURE_SHEET_MARKS")
    .replace(/^\.blueprint-annotation\b/, ".TEXTURE_ANNOTATION")
    .replace(/^\.blueprintAnnotation\b/, ".TEXTURE_ANNOTATION");
}

/**
 * Keys a rule list by its normalized, sorted selector list — e.g. the
 * shared `::before, ::after` rule becomes one key, distinct from either
 * pseudo-element's own standalone rule. Throws on a collision rather than
 * silently overwriting, since that would mean the extraction itself is
 * ambiguous.
 */
function keyRulesBySelector(rules: CssRule[]): Record<string, Record<string, string>> {
  const byKey: Record<string, Record<string, string>> = {};
  for (const rule of rules) {
    const key = rule.selectors.map(normalizeSelector).sort().join(" | ");
    if (key in byKey) {
      throw new Error(`Duplicate normalized selector key "${key}" — extraction is ambiguous`);
    }
    byKey[key] = extractDeclarations(rule.body);
  }
  return byKey;
}

describe("style-scope.module.css stays in sync with blueprint.css's texture layer (Task 7a)", () => {
  const blueprintCss = stripComments(readFileSync(SOURCE_PATHS.blueprint, "utf8"));
  const moduleCssClean = stripComments(readFileSync(MODULE_PATH, "utf8"));

  const sourceUtilitiesBody = extractBracedBody(blueprintCss, "@layer\\s+utilities");
  const sourceRules = parseFlatRules(sourceUtilitiesBody);

  const moduleTextureStart = moduleCssClean.indexOf(".blueprintGrid");
  if (moduleTextureStart === -1) {
    throw new Error('Could not find ".blueprintGrid" in style-scope.module.css');
  }
  // The texture block ends at whichever comes first: the hairline media query
  // that has always closed the file, or the 配色 layer that now sits between
  // them (migration 20260821050000, scripts/build-palettes.mjs). Slicing to the
  // media query alone swept ten palette classes into this comparison and failed
  // a test about Blueprint's drafting grid — a real signal, pointed at the
  // wrong thing. Anything appended after the textures needs an entry here.
  const moduleEnd = Math.min(
    ...[
      moduleCssClean.indexOf("@media (min-resolution", moduleTextureStart),
      moduleCssClean.indexOf(".palette", moduleTextureStart),
    ]
      .filter((i) => i !== -1)
      .concat(moduleCssClean.length),
  );
  const moduleTextureBody = moduleCssClean.slice(moduleTextureStart, moduleEnd);
  const moduleRules = parseFlatRules(moduleTextureBody);

  const sourceByKey = keyRulesBySelector(sourceRules);
  const moduleByKey = keyRulesBySelector(moduleRules);

  it("extracts the same five texture rules from both files", () => {
    // Sanity check on the extraction itself, same reasoning as the token
    // test above: blueprint.css's utilities layer currently defines five
    // flat rules (.blueprint-grid, the shared ::before/::after pair, each
    // pseudo-element standalone, and .blueprint-annotation). If a selector
    // or brace-matching bug ever made either side extract zero rules,
    // toEqual({}, {}) below would pass without checking anything.
    expect(Object.keys(sourceByKey).length).toBe(5);
    expect(Object.keys(moduleByKey).sort()).toEqual(Object.keys(sourceByKey).sort());
  });

  it(".blueprint-grid / .blueprintGrid declare the same background rules", () => {
    expect(moduleByKey[".TEXTURE_GRID"]).toEqual(sourceByKey[".TEXTURE_GRID"]);
  });

  it(".blueprint-sheet-marks::before/::after (shared) matches .blueprintSheetMarks::before/::after", () => {
    const key = [".TEXTURE_SHEET_MARKS::after", ".TEXTURE_SHEET_MARKS::before"].sort().join(" | ");
    expect(sourceByKey[key]).toBeDefined();
    expect(moduleByKey[key]).toEqual(sourceByKey[key]);
  });

  it(".blueprint-sheet-marks::before (standalone) matches .blueprintSheetMarks::before", () => {
    expect(sourceByKey[".TEXTURE_SHEET_MARKS::before"]).toBeDefined();
    expect(moduleByKey[".TEXTURE_SHEET_MARKS::before"]).toEqual(sourceByKey[".TEXTURE_SHEET_MARKS::before"]);
  });

  it(".blueprint-sheet-marks::after (standalone) matches .blueprintSheetMarks::after", () => {
    expect(sourceByKey[".TEXTURE_SHEET_MARKS::after"]).toBeDefined();
    expect(moduleByKey[".TEXTURE_SHEET_MARKS::after"]).toEqual(sourceByKey[".TEXTURE_SHEET_MARKS::after"]);
  });

  it(".blueprint-annotation / .blueprintAnnotation declare the same rules", () => {
    expect(moduleByKey[".TEXTURE_ANNOTATION"]).toEqual(sourceByKey[".TEXTURE_ANNOTATION"]);
  });
});
