import { describe, it, expect } from "vitest";
import { BLOCK_RULES, renderBlockRules, blockRulesTargetRealComponents } from "./block-rules";
import { REGISTERED_COMPONENTS } from "./layout-ops";

describe("block rules", () => {
  /*
    THE GUARD THIS FILE EXISTS FOR.

    A rule naming a block that has been cut is worse than no rule: it is paid
    for on every generation and teaches the model about something the customer
    can never see. This repo has shipped four hand-written lists that outlived
    what they described -- variant preferences pointing at renamed variants, a
    register list three days stale, 45 style preferences `defaultProps` was
    silently beating. Each was found by a person, late.
  */
  it("every rule names a block that still exists", () => {
    expect(blockRulesTargetRealComponents()).toEqual([]);
  });

  it("names the block the measurement caught", () => {
    // Measured at n=2: 「上面再加一个标题」 produced a second PageHeader once.
    expect(BLOCK_RULES.PageHeader).toBeTruthy();
    expect(REGISTERED_COMPONENTS).toContain("PageHeader");
  });

  it("renders one line per rule, naming the block", () => {
    const text = renderBlockRules();
    for (const name of Object.keys(BLOCK_RULES)) {
      expect(text).toContain(`- ${name}:`);
    }
    expect(text.split("\n")).toHaveLength(Object.keys(BLOCK_RULES).length);
  });

  /*
    Deliberately small. Puck's reference warns against inventing constraints
    with no evidence behind them, and the measurement that produced this file
    found the model already correct on the case it was expected to fail --
    a WorkflowStrip when the page had one was edited, not duplicated. If this
    number climbs, each new entry should have a run behind it, not a hunch.
  */
  it("stays evidence-sized", () => {
    expect(Object.keys(BLOCK_RULES).length).toBeLessThanOrEqual(5);
  });
});
