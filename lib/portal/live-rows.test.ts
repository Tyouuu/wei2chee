import { describe, it, expect } from "vitest";
import { ringgit, toneForStage, rowsFromRecords, withLiveRows } from "./live-rows";
import { buildPageLayout } from "@/lib/templates/industry-template";

const WORKFLOW = ["客户", "报价", "订金", "施工", "尾款"];

describe("ringgit", () => {
  it("writes it the way a contractor writes it", () => {
    // 「RM 48,500」 is a job sheet; 「RM 48,500.00」 is software.
    expect(ringgit(4_850_000)).toBe("RM 48,500");
  });

  it("keeps the sen when there are any", () => {
    expect(ringgit(4_850_050)).toBe("RM 48,500.50");
  });

  it("says nothing rather than RM 0 when there is no amount", () => {
    // A task has no amount. Printing RM 0 would be a claim about the money.
    expect(ringgit(null)).toBeUndefined();
    expect(ringgit(undefined)).toBeUndefined();
  });
});

describe("toneForStage", () => {
  /*
    A stage carries no severity of its own -- 「等确认」 is where most of a
    healthy pipeline sits, not a warning. Position is the only honest signal.
  */
  it("reads the last stage as done", () => {
    expect(toneForStage("尾款", WORKFLOW)).toBe("positive");
  });

  it("reads the first as not started", () => {
    expect(toneForStage("客户", WORKFLOW)).toBe("neutral");
  });

  it("reads the middle as moving", () => {
    expect(toneForStage("订金", WORKFLOW)).toBe("warning");
  });

  it("refuses to judge a stage the business did not declare", () => {
    // The customer renamed or typed it. Colouring it by guesswork would be
    // inventing an opinion about their business.
    expect(toneForStage("我自己加的", WORKFLOW)).toBe("neutral");
    expect(toneForStage("", WORKFLOW)).toBe("neutral");
  });
});

describe("rowsFromRecords", () => {
  it("leads with what the row is about, not who it is with", () => {
    const [row] = rowsFromRecords(
      [{ title: "Taman Desa 三房翻新", party: "陈先生", amount_cents: 4_850_000, stage: "订金" }],
      WORKFLOW,
    );
    expect(row.primary).toBe("Taman Desa 三房翻新");
    expect(row.secondary).toBe("陈先生");
    expect(row.amount).toBe("RM 48,500");
    expect(row.tone).toBe("warning");
  });

  /*
    A row with no title is not a broken row -- a task often has only a person.
    Falling back to the party keeps the first column from being blank, which is
    the one thing an owner scanning a list cannot read past.
  */
  it("falls back to the party when there is no title", () => {
    const [row] = rowsFromRecords(
      [{ title: "", party: "阿明", amount_cents: null, stage: "施工" }],
      WORKFLOW,
    );
    expect(row.primary).toBe("阿明");
    expect(row.amount).toBeUndefined();
  });
});

describe("withLiveRows", () => {
  const tree = () => ({
    content: [
      { type: "PageHeader", props: { id: "h", title: "报价单" } },
      { type: "RecordTable", props: { id: "t", columns: [{ key: "primary", label: "报价内容" }], rows: [{ primary: "示例", tone: "neutral", status: "等确认" }] } },
    ],
  });

  const real = [{ primary: "Cheras 店面装修", tone: "warning" as const, status: "订金" }];

  it("replaces the sample rows and nothing else", () => {
    const out = withLiveRows(tree(), real) as { content: { type: string; props: Record<string, unknown> }[] };
    const table = out.content.find((n) => n.type === "RecordTable")!;
    expect(table.props.rows).toEqual(real);
    // The columns are the customer's own headings, which they may have renamed.
    expect(table.props.columns).toEqual([{ key: "primary", label: "报价内容" }]);
    expect(out.content[0].props.title).toBe("报价单");
  });

  /*
    THIS IS HOW THE SAMPLES RETIRE.

    Not a flag, not a migration, not a state anybody has to maintain: with no
    real rows the tree comes back untouched, so an empty business still gets a
    page that teaches them what it is for. The first quotation they write is
    what ends the demonstration.
  */
  it("leaves the samples alone when the business has no rows yet", () => {
    const t = tree();
    expect(withLiveRows(t, [])).toBe(t);
  });

  it("does not throw on a tree that has no content", () => {
    expect(withLiveRows({}, real)).toEqual({});
    expect(withLiveRows({ content: "not an array" } as never, real)).toEqual({ content: "not an array" });
  });

  /*
    A saved page has the sample rows FROZEN into its props, so this has to run
    on saved trees too -- otherwise a customer who saved the page before writing
    their first quotation keeps 陈先生 · RM 48,500 forever. Nothing about the
    input says whether it was generated or saved, and that is the point.
  */
  it("works on a page that was saved before any real rows existed", () => {
    const saved = { content: [{ type: "RecordTable", props: { id: "t", rows: [{ primary: "陈先生" }] } }] };
    const out = withLiveRows(saved, real) as { content: { props: Record<string, unknown> }[] };
    expect(out.content[0].props.rows).toEqual(real);
  });
});

/*
  THE ONE THAT WOULD HAVE CAUGHT IT.

  The tests above use a hand-made flat tree, and they all passed while the
  projection found nothing on any page in the product. A generated page is
  one SystemShell whose `main` prop holds the blocks, so the table is never
  where a flat fixture puts it.

  This builds the page the way the product builds it. A fixture that does not
  match the product measures the fixture.
*/
/*
  THE ONE THAT WOULD HAVE CAUGHT BOTH.

  Two versions of this projection shipped broken while a test passed, and
  both times for the same reason: the fixture was a shape this codebase never
  produces. First a flat tree, when a page is one SystemShell holding slots.
  Then rows at props.rows, when a generated table keeps them inside
  props.table beside their columns.

  So this asserts nothing about WHERE the rows live. It builds the page the
  way the product builds it, and asks the only question that cannot be got
  wrong: are the sample rows still on the page, and are the real ones?
*/
describe("the tree the product actually renders", () => {
  const real = () =>
    buildPageLayout("quotations", {}, "老板", "zh", [{ key: "quotations" }], "ledger", null) as unknown as Record<string, unknown>;

  /** Every string anywhere in the tree -- deliberately blind to prop names. */
  const textOf = (tree: unknown): string => JSON.stringify(tree);

  const sampleText = () => {
    const t = textOf(real());
    // Whatever the generated samples say, they are in there before we touch it.
    return t;
  };

  it("has a table with sample rows before anything is projected", () => {
    expect(sampleText().includes(String.fromCharCode(34)+"rows"+String.fromCharCode(34)+":")).toBe(true);
  });

  it("puts the real rows on the page", () => {
    const rows = [{ primary: "Cheras 店面装修", secondary: "王老板", amount: "RM 96,000", tone: "warning" as const, status: "订金" }];
    const out = withLiveRows(real(), rows);
    expect(textOf(out)).toContain("Cheras 店面装修");
    expect(textOf(out)).toContain("RM 96,000");
  });

  /* The point of the whole feature: the demonstration ends when real work
     begins. Compared against the untouched tree rather than a literal, so a
     change to the sample copy cannot quietly disable this. */
  it("removes every sample row", () => {
    const before = real();
    const table = JSON.parse(textOf(before)) as unknown;
    const samples = (JSON.stringify(table).match(/"primary":"([^"]+)"/g) ?? []).slice(0, 3);
    expect(samples.length).toBeGreaterThan(0);

    const out = textOf(withLiveRows(before, [{ primary: "只有这一笔", tone: "neutral" as const, status: "新" }]));
    for (const s of samples) expect(out).not.toContain(s);
    expect(out).toContain("只有这一笔");
  });

  it("leaves the samples in place when the business has no rows", () => {
    const before = textOf(real());
    expect(textOf(withLiveRows(real(), []))).toBe(before);
  });
});
