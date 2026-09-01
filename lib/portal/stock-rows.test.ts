import { describe, it, expect } from "vitest";
import { rowsFromStock, withLiveRows, type StockRow } from "./live-rows";

/**
 * 库存 is the first shape whose `amount` column is NOT money.
 *
 * ⚠️ THAT IS THE WHOLE REASON THIS FILE EXISTS. Every other projection puts
 * ringgit in that cell and the page's own heading for it here is 「数量」/「Qty」.
 * One `ringgit()` reached for out of habit prints 「RM 84」 against a bag of
 * cement, and nobody reviewing a diff would see it -- the same class as 任务 79
 * ④, where a directory's three columns were read as a pipeline's four and a
 * customer's own status was dropped as though it were a price.
 */

const item = (over: Partial<StockRow> = {}): StockRow => ({
  item_id: "i1",
  name: "水泥 50kg",
  unit: "包",
  location: "仓库",
  reorder_at: 20,
  on_hand: 84,
  moves: 3,
  ...over,
});

describe("rowsFromStock", () => {
  it("puts a COUNT in the amount cell, never money", () => {
    const [r] = rowsFromStock([item()]);
    expect(r.amount).toBe("84");
    expect(r.amount).not.toMatch(/RM/);
  });

  it("writes 84 and not 84.000", () => {
    /* numeric(14,3) comes back as a string with three decimals. He counted
       bags; he did not count thousandths of a bag. */
    expect(rowsFromStock([item({ on_hand: "84.000" })])[0].amount).toBe("84");
    expect(rowsFromStock([item({ on_hand: "2.500" })])[0].amount).toBe("2.5");
  });

  it("composes the second column the way the page reads it", () => {
    expect(rowsFromStock([item()])[0].secondary).toBe("仓库 · 包");
    /* A shelf with no location is not 「 · 包」. */
    expect(rowsFromStock([item({ location: "" })])[0].secondary).toBe("包");
    expect(rowsFromStock([item({ location: "", unit: "" })])[0].secondary).toBe("");
  });

  describe("the status is computed, and that is the point", () => {
    /* Storing it would give the page two answers that can disagree -- and this
       is the one shape where nobody can tell by eye which is right: a
       contractor does not know he should have 84 bags. */
    it("says nothing at all when he never asked to be told", () => {
      const [r] = rowsFromStock([item({ reorder_at: null })]);
      expect(r.status).toBe("");
      expect(r.tone).toBe("positive");
    });

    it("warns at the line he set, not before it", () => {
      expect(rowsFromStock([item({ on_hand: 21 })])[0].tone).toBe("positive");
      expect(rowsFromStock([item({ on_hand: 20 })])[0].tone).toBe("warning");
      expect(rowsFromStock([item({ on_hand: 19 })])[0].tone).toBe("warning");
    });

    it("zero is out of stock even with no reorder level", () => {
      const [r] = rowsFromStock([item({ on_hand: 0, reorder_at: null })]);
      expect(r.tone).toBe("negative");
      expect(r.status).toBe("没货了");
    });

    it("speaks the system's language, not the portal's", () => {
      expect(rowsFromStock([item({ on_hand: 12 })], "en")[0].status).toBe("Running low");
      expect(rowsFromStock([item({ on_hand: 12 })], "zh")[0].status).toBe("快没了");
    });
  });

  it("links each row to its own page when asked", () => {
    const [r] = rowsFromStock([item()], "zh", (id) => `/en/portal/inventory/${id}`);
    expect(r.href).toBe("/en/portal/inventory/i1");
    expect(rowsFromStock([item()])[0].href).toBeUndefined();
  });
});

describe("the demonstration's filter chip", () => {
  /* 🔴 Found by opening the stock page, not by any ruler. Every generated page
     carries 「FILTERED BY  Status: Running low ×」, which is honest over samples
     and a lie over his rows: it says the list is cut down while showing all of
     it, and its × goes to `#`. */
  const page = () => ({
    content: [
      {
        type: "SystemShell",
        props: {
          main: [
            { type: "FilterChips", props: { chips: [{ label: "Status", value: "Running low" }] } },
            { type: "RecordTable", props: { table: { columns: [], rows: [] } } },
          ],
        },
      },
    ],
  });

  const chipsOf = (t: Record<string, unknown>) =>
    // @ts-expect-error -- reaching into a plain tree in a test, on purpose
    t.content[0].props.main[0].props.chips;

  it("stays while the page is a demonstration", () => {
    expect(chipsOf(withLiveRows(page(), []))).toHaveLength(1);
  });

  it("empties the moment the rows are his", () => {
    const out = withLiveRows(page(), rowsFromStock([item()]));
    expect(chipsOf(out)).toHaveLength(0);
  });

  it("empties on a page he has started but that is empty today", () => {
    /* `businessIsLive` means 「records somewhere, none on this page」. Covering
       only the other case would have left the chip on every page that has
       stock, which is every page anybody looks at. */
    expect(chipsOf(withLiveRows(page(), [], { businessIsLive: true }))).toHaveLength(0);
  });

  it("leaves the block itself where he put it", () => {
    /* Emptied, not dropped: he may have moved or renamed it, and it has to
       come back the moment there is a real filter to put in it. */
    // @ts-expect-error -- see above
    expect(withLiveRows(page(), rowsFromStock([item()])).content[0].props.main[0].type).toBe(
      "FilterChips",
    );
  });
});
