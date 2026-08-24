import { describe, it, expect } from "vitest";
import { STYLE_BRIEFS } from "./design-doc";
import { VARIANTS } from "@/design-system/editor/variants";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";

/**
 * A register's preference has to name a variant that EXISTS.
 *
 * WHY THIS TEST IS HERE. This is the third time this exact class of failure has
 * cost this product real work. 315 register preferences reached no component at
 * all until 2026-08-23 because nothing called the hook. Puck's defaultProps then
 * made "never chosen" indistinguishable from "chosen", so the register could
 * never win. Both were invisible: no type error, no thrown render, every test
 * green, and sixteen registers drawing one page.
 *
 * The third form is a preference that names a variant nobody wrote --
 * `ShelfList: "row"` when the ids are boxed / boxed-sm / ruled / ruled-sm. It
 * was written on 2026-08-25 while adding 中台 and would have shipped as one more
 * silently-ignored line, indistinguishable from the register having no opinion.
 *
 * `prefer` is a Record<string, string>, so TypeScript cannot catch any of this.
 * A test can.
 */
describe("every register's preferences point at something real", () => {
  it("names a component that has variants", () => {
    for (const [style, brief] of Object.entries(STYLE_BRIEFS)) {
      for (const component of Object.keys(brief.prefer)) {
        expect(
          VARIANTS[component],
          `${style} prefers a variant of ${component}, which has none`,
        ).toBeDefined();
      }
    }
  });

  it("names a variant that component actually has", () => {
    for (const [style, brief] of Object.entries(STYLE_BRIEFS)) {
      for (const [component, id] of Object.entries(brief.prefer)) {
        const ids = (VARIANTS[component] ?? []).map((v) => v.id);
        expect(ids, `${style} wants ${component}="${id}"`).toContain(id);
      }
    }
  });

  // A register with a token file and no brief renders in the right colours and
  // the wrong SHAPE -- it silently falls back to every component's default,
  // which is the 「每一版都是一样的」 the whole variant layer exists to fix.
  it("gives every pickable register a brief", () => {
    for (const style of STYLE_ORDER) {
      expect(STYLE_BRIEFS[style], `${style} has no brief`).toBeDefined();
    }
  });
});
