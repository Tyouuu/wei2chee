import { describe, it, expect } from "vitest";
import { TRADE_SUGGESTIONS, suggestionsFor, ASSISTANT_LIMITS } from "./trade-suggestions";
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

/*
  THE SAME THREE SENTENCES ON EVERY PAGE.

  A trade's lines are about a table with stages. On 收款 the stage line is
  false -- a ledger row's status is read from the money -- and on the 官网 page
  none of them are, because there is no table on it. HAX Guideline 1 calls
  these a task mismatch and a domain mismatch, and puts 「product abandonment」
  beside them.
*/
describe("the chips follow the page, not only the trade", () => {
  it("never offers to change the stages on a money page", () => {
    for (const locale of ["zh", "en"]) {
      const lines = suggestionsFor("renovation", locale, "ledger").join(" ");
      expect(lines).not.toMatch(/把流程改成|Change the stages/);
    }
  });

  it("still offers it on a page that has stages", () => {
    const lines = suggestionsFor("renovation", "zh", "pipeline").join(" ");
    expect(lines).toMatch(/把流程改成/);
  });

  it("offers nothing about a table on the page that has no table", () => {
    const lines = suggestionsFor("renovation", "zh", "landing");
    expect(lines.join(" ")).not.toMatch(/加一列|把流程改成/);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("opens with a line about this page", () => {
    expect(suggestionsFor("renovation", "zh", "pipeline")[0]).toMatch(/^加一单/);
    expect(suggestionsFor("renovation", "zh", "ledger")[0]).toMatch(/^加一笔/);
    expect(suggestionsFor("renovation", "en", "ledger")[0]).toMatch(/^Add one/);
  });

  /* Three is the measured ceiling: a hit-test sweep found the third chip
     already pushing itself out of the panel's scroll viewport. A fourth would
     be a suggestion nobody can press. */
  it("never shows more than three, on any shape or trade", () => {
    for (const trade of Object.keys(TRADE_SUGGESTIONS)) {
      for (const shape of ["pipeline", "ledger", "landing", "directory", "catalog", "overview", null]) {
        for (const locale of ["zh", "en"]) {
          const n = suggestionsFor(trade, locale, shape).length;
          expect(n, `${trade}/${shape}/${locale}`).toBeGreaterThan(0);
          expect(n, `${trade}/${shape}/${locale}`).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  /* Unknown shape, or none: the trade's own three, which is what every caller
     got before this existed and is right on the page it was written for. */
  it("falls back rather than going blank on a shape it does not know", () => {
    expect(suggestionsFor("renovation", "zh", "no-such-shape").length).toBeGreaterThan(0);
    expect(suggestionsFor("renovation", "zh")).toEqual(TRADE_SUGGESTIONS.renovation.zh);
  });
});

describe("what it will not do", () => {
  it("says so in both languages, the same number of things", () => {
    expect(ASSISTANT_LIMITS.zh.length).toBe(ASSISTANT_LIMITS.en.length);
    expect(ASSISTANT_LIMITS.zh.length).toBeGreaterThan(0);
    for (const l of [...ASSISTANT_LIMITS.zh, ...ASSISTANT_LIMITS.en]) {
      expect(l.trim().length).toBeGreaterThan(8);
    }
  });

  /*
    ⚠️ EACH ONE IS A RULE THE ASSISTANT ACTUALLY FOLLOWS.

    A limit that is not enforced is worse than no limit: it teaches an owner
    not to ask for something the product would have done. These three are
    carried by the system prompt (invent no business facts), block-rules.ts (no
    control wired to nothing) and pick_photo being a proposal rather than a
    choice. If one of those is ever relaxed, its line has to go with it.
  */
  it("is written as promises, not as apologies", () => {
    for (const l of ASSISTANT_LIMITS.zh) expect(l).toMatch(/^不会/);
    for (const l of ASSISTANT_LIMITS.en) expect(l).toMatch(/^Won't/);
  });
});
