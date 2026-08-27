import { describe, it, expect } from "vitest";
import { TRADE_SUGGESTIONS, suggestionsFor } from "./trade-suggestions";
import { TRADE_QUERIES } from "@/lib/images/stock";

describe("the three chips", () => {
  /*
    THE TRADE LIST IS ONE LIST, AND IT LIVES IN stock.ts.

    A second hand-written copy of the eight trades is exactly how this repo has
    been bitten five times over. A trade that gains a photo query and not a set
    of suggestions would silently show that owner somebody else's business.
  */
  it("covers every trade the photo picker knows", () => {
    expect(Object.keys(TRADE_SUGGESTIONS).sort()).toEqual(Object.keys(TRADE_QUERIES).sort());
  });

  it("gives three in each language, and never blanks", () => {
    for (const [trade, set] of Object.entries(TRADE_SUGGESTIONS)) {
      expect(set.zh, trade).toHaveLength(3);
      expect(set.en, trade).toHaveLength(3);
      expect(set.zh.every((s) => s.trim().length > 0), trade).toBe(true);
      expect(set.en.every((s) => s.trim().length > 0), trade).toBe(true);
    }
  });

  /*
    A CHIP IS A PROMISE, AND THE ASSISTANT HAS TO BE ABLE TO KEEP IT.

    Puck's own AI guidance warns against invented example prompts: they are
    vague, and they advertise abilities the product does not have. Every line
    here has to be one of the three shapes that map onto a real operation, so a
    fourth kind cannot be added without somebody deciding it can be carried out.
  */
  it("only promises things there is an operation for", () => {
    const shapes = [/加一列/, /把流程改成/, /把「.+」改成/];
    const enShapes = [/^Add an? "/, /^Change the stages to:/, /^Rename "/];
    for (const [trade, set] of Object.entries(TRADE_SUGGESTIONS)) {
      for (const s of set.zh) expect(shapes.some((r) => r.test(s)), `${trade}: ${s}`).toBe(true);
      for (const s of set.en) expect(enShapes.some((r) => r.test(s)), `${trade}: ${s}`).toBe(true);
    }
  });

  /*
    THE BUG THIS FILE EXISTS FOR. Every owner in the product was shown a DENTAL
    example -- 「把「客户」改成「病人」」 -- whatever business they ran.
  */
  it("never shows a renovation contractor somebody else's trade", () => {
    const zh = suggestionsFor("renovation", "zh").join(" ");
    expect(zh).not.toContain("病人");
    expect(zh).toContain("师傅");
  });

  it("falls back rather than guessing when the trade is unknown", () => {
    // Guessing a trade nobody told us is how 「病人」 got there in the first
    // place; the fallback says nothing about what the business is.
    expect(suggestionsFor(null, "zh")).toEqual(TRADE_SUGGESTIONS.other.zh);
    expect(suggestionsFor("something-new", "en")).toEqual(TRADE_SUGGESTIONS.other.en);
  });

  it("follows the interface language, not the trade", () => {
    // 重点 13: the editor speaks the locale, and never falls back across
    // languages to fill a gap.
    expect(suggestionsFor("fnb", "en").join(" ")).not.toMatch(/[一-鿿]/);
    expect(suggestionsFor("fnb", "zh").join(" ")).toMatch(/[一-鿿]/);
  });
});
