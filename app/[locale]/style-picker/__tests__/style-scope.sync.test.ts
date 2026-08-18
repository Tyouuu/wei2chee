import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

const STYLES = ["ledger", "hearth", "blueprint"] as const;
type Style = (typeof STYLES)[number];

const SOURCE_PATHS: Record<Style, string> = {
  ledger: join(ROOT, "design-system", "tokens", "ledger.css"),
  hearth: join(ROOT, "design-system", "tokens", "hearth.css"),
  blueprint: join(ROOT, "design-system", "tokens", "blueprint.css"),
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
    decls[declMatch[1]] = declMatch[2].trim();
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
