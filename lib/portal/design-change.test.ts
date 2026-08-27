import { describe, it, expect } from "vitest";
import { planDesignChange, DESIGN_FIELDS, type DesignChange } from "./design-change";

const CURRENT = "ledger";

/** A value that is valid for each field, used to prove the field reaches an RPC.
 *  Not checked against the real registers/palettes here -- validDesign in the
 *  route does that, and duplicating those lists is the mistake this file exists
 *  to catch. */
const SAMPLE: Record<(typeof DESIGN_FIELDS)[number], DesignChange> = {
  style: { style: "swiss" },
  palette: { palette: "zen" },
  layout: { layout: "table" },
};

describe("planDesignChange", () => {
  it("does nothing when the owner asked for nothing", () => {
    expect(planDesignChange(null, CURRENT)).toEqual([]);
    expect(planDesignChange({}, CURRENT)).toEqual([]);
  });

  /*
    THE REGRESSION. 「表格放前面」 reached the model, came back correct, and was
    dropped by the browser for as long as the field existed -- and because the
    assistant still replied 「已经把表格放前面了」, the only symptom was a page
    that did not move while the reply said it had.
  */
  it("sends an arrangement-only answer to set_project_layout", () => {
    const calls = planDesignChange({ layout: "table" }, CURRENT);
    expect(calls).toEqual([{ rpc: "set_project_layout", args: { new_layout: "table" } }]);
  });

  it("does not touch the palette when only the register changed", () => {
    const calls = planDesignChange({ style: "swiss" }, CURRENT);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      rpc: "set_project_style",
      // clear_palette false and new_palette null is the RPC's "leave it alone"
      // state. Getting this wrong repaints a system the owner never asked to
      // repaint, while they were asking for something else.
      args: { new_style: "swiss", new_palette: null, clear_palette: false },
    });
  });

  it("treats palette:null as 拿掉配色, not as silence", () => {
    const calls = planDesignChange({ palette: null }, CURRENT);
    expect(calls[0]).toEqual({
      rpc: "set_project_style",
      // The register is unchanged but still has to be named: the RPC's first
      // argument is NOT NULL.
      args: { new_style: CURRENT, new_palette: null, clear_palette: true },
    });
  });

  it("sets a named palette without changing the register", () => {
    const calls = planDesignChange({ palette: "zen" }, CURRENT);
    expect(calls[0]).toEqual({
      rpc: "set_project_style",
      args: { new_style: CURRENT, new_palette: "zen", clear_palette: false },
    });
  });

  it("carries a register and an arrangement in one turn", () => {
    const calls = planDesignChange({ style: "swiss", layout: "board" }, CURRENT);
    expect(calls.map((c) => c.rpc)).toEqual(["set_project_style", "set_project_layout"]);
  });

  /*
    THE RULER, not a case. Every field the route can return must turn into at
    least one RPC. A field added to the reply and to the schema but never spent
    -- which is exactly how `layout` shipped broken -- fails here instead of
    reaching a customer as an assistant that lies about what it did.
  */
  it.each(DESIGN_FIELDS)("spends the %s field on an RPC", (field) => {
    const calls = planDesignChange(SAMPLE[field], CURRENT);
    expect(calls.length).toBeGreaterThan(0);
  });
});
