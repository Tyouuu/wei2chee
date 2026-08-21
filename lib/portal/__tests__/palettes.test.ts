import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { PALETTES, PALETTE_BY_KEY } from "../palettes";

/**
 * The 配色 layer exists in four places at once: CSS files in
 * design-system/palettes/, a class per file in the generated
 * style-scope.module.css, a list in lib/portal/palettes.ts, and a check
 * constraint in migration 20260821050000.
 *
 * Nothing forces them to agree, and the failure when they do not is the quiet
 * kind. A key in TypeScript with no CSS class renders the layout's NATIVE
 * colours and reports nothing — the customer picks 「青绿」, the page reloads,
 * and it looks exactly the same as before. No error anywhere; the system is
 * just silently wrong. A key the database refuses instead throws at the moment
 * of choosing, which is at least visible.
 */

const ROOT = process.cwd();
const PALETTE_DIR = join(ROOT, "design-system", "palettes");
const SCOPE_CSS = join(ROOT, "app", "[locale]", "style-picker", "style-scope.module.css");

/** kebab file name -> the camelCase class the generator writes, which is also
 *  what CSS Modules exposes for dot access. */
const camel = (key: string) =>
  "palette" + key.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");

describe("the palette layer agrees with itself", () => {
  const files = readdirSync(PALETTE_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => f.replace(/\.css$/, ""))
    .sort();

  const scopeCss = readFileSync(SCOPE_CSS, "utf8");

  it("has palettes at all", () => {
    // Guards every comparison below against passing vacuously on an empty dir.
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it("lists exactly the palettes that have CSS files", () => {
    expect(PALETTES.map((p) => p.key).sort()).toEqual(files);
  });

  it("emits a class into the scope stylesheet for every palette", () => {
    for (const key of files) {
      expect(scopeCss, `no .${camel(key)} in style-scope.module.css`).toContain(`.${camel(key)}`);
    }
  });

  it("puts the palettes AFTER the layouts, which is the whole mechanism", () => {
    // A palette class and a layout class are both single class selectors, so
    // they have identical specificity and source order decides. If palettes
    // ever moved above the layouts, every one of them would stop applying and
    // nothing would report it.
    // The layout BLOCKS, matched as `^.ledger {` — not any mention of the word.
    // The file ends with a shared `.ledger, .hearth, .blueprint { --hairline }`
    // media query that sits after the palettes and is correct there: hairline
    // is structural, so it belongs to the 版式 and a palette must not win it.
    const lastLayoutBlock = Math.max(
      ...[/^\.ledger\s*\{/gm, /^\.hearth\s*\{/gm, /^\.blueprint\s*\{/gm].map((re) => {
        let last = -1;
        for (const m of scopeCss.matchAll(re)) last = m.index ?? last;
        return last;
      }),
    );
    const firstPalette = scopeCss.search(/^\.palette[A-Z]/m);
    expect(lastLayoutBlock).toBeGreaterThan(-1);
    expect(firstPalette).toBeGreaterThan(-1);
    expect(firstPalette).toBeGreaterThan(lastLayoutBlock);
  });

  it("changes only colour, never structure", () => {
    // The reason 3 layouts x N palettes works at all: a palette that set a
    // radius or a font size would silently overwrite the 版式 it is combined
    // with, and Ledger-with-Supabase would stop being Ledger.
    const STRUCTURAL = /--(font|fw|text|leading|tracking|radius|pad|gap|row-h|control-h|shadow|hairline|border-card|label-transform)/;
    for (const key of files) {
      const css = readFileSync(join(PALETTE_DIR, `${key}.css`), "utf8");
      const declared = [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]);
      const structural = declared.filter((d) => STRUCTURAL.test(d));
      expect(structural, `${key}.css declares structural tokens`).toEqual([]);
      expect(declared.length, `${key}.css declares nothing`).toBeGreaterThan(20);
    }
  });

  it("gives every palette a label, a blurb and four swatch colours", () => {
    for (const p of PALETTES) {
      expect(p.label.length, p.key).toBeGreaterThan(0);
      expect(p.blurb.length, p.key).toBeGreaterThan(4);
      expect(p.dots, p.key).toHaveLength(4);
      for (const d of p.dots) expect(d, `${p.key} swatch`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("keys the lookup by the same names", () => {
    for (const p of PALETTES) expect(PALETTE_BY_KEY[p.key]).toBe(p);
  });
});

describe("the SQL mirror", () => {
  const dir = join(ROOT, "supabase", "migrations");
  const file = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .find((f) => readFileSync(join(dir, f), "utf8").includes("projects_palette_check"))!;
  const sql = readFileSync(join(dir, file), "utf8");

  it("accepts every palette the app can produce", () => {
    for (const p of PALETTES) {
      expect(sql, `constraint rejects ${p.key}`).toContain(`'${p.key}'`);
    }
  });

  it("still allows NULL, which is the native pairing rather than a missing value", () => {
    expect(sql).toMatch(/palette is null/i);
  });
});
