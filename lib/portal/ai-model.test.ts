import { describe, it, expect } from "vitest";
import { AI_MODEL, AI_REASONING_EFFORT } from "./ai-model";
import { PRICE_PER_MTOK_USD_2026_08_27 } from "./ai-usage";

describe("the model in use", () => {
  /*
    THE GUARD THAT MAKES THE ONE PLACE WORTH HAVING.

    `check:ai-cost` looks the model up in the price table and prints 「价格未知」
    when it misses -- quietly, in one cell, in a report nobody reads line by
    line. So the day somebody changes the model and forgets the price, the
    answer to 「这个功能花我多少钱」 stops existing and nothing says so.

    This is the fifth guard of its shape in this repo. All of them exist
    because a hand-written fact outlived the thing it described.
  */
  it("has a price, so the bill stays answerable", () => {
    expect(Object.keys(PRICE_PER_MTOK_USD_2026_08_27)).toContain(AI_MODEL);
    const price = PRICE_PER_MTOK_USD_2026_08_27[AI_MODEL];
    expect(price.in).toBeGreaterThan(0);
    expect(price.out).toBeGreaterThan(0);
  });

  /*
    Reasoning effort is not a free knob: it is most of the output tokens
    (~185 of ~307 per edit, measured 2026-08-27) and most of the latency that
    maxDuration was set against. Lowering it is a legitimate experiment and the
    eval can score it -- but it should be a decision somebody made, not a value
    that drifted, so the currently-chosen one is written down twice.
  */
  it("thinks as hard as both routes were measured at", () => {
    expect(AI_REASONING_EFFORT).toBe("high");
  });
});
