import { describe, it, expect } from "vitest";
import { buildProfit, jobProfit, type ProfitFact } from "./profit";

const f = (p: Partial<ProfitFact> & { id: string }): ProfitFact => ({
  direction: "out",
  amount_cents: 0,
  entry_on: "2026-09-04",
  category: null,
  adjusts_id: null,
  ...p,
});

describe("buildProfit", () => {
  it("takes money out of money in", () => {
    const s = buildProfit([
      f({ id: "a", direction: "in", amount_cents: 500_000 }),
      f({ id: "b", direction: "out", amount_cents: 120_000 }),
    ]);
    expect(s.inCents).toBe(500_000);
    expect(s.outCents).toBe(120_000);
    expect(s.profitCents).toBe(380_000);
  });

  it("says a losing month is losing, and does not clamp it at zero", () => {
    /* 把一个亏钱的月份夹成 0，是替他把一个坏消息藏起来 -- 而那正是他
       打开这一页要看的那件事。 */
    const s = buildProfit([
      f({ id: "a", direction: "in", amount_cents: 100_000 }),
      f({ id: "b", direction: "out", amount_cents: 250_000 }),
    ]);
    expect(s.profitCents).toBe(-150_000);
  });

  it("🔴 does not count a reversal as an expense", () => {
    /* 冲掉一笔收款，写出来的是一笔 `out`。一支只会 sum(direction='out')
       的损益表，会把「那笔钱其实没收到」算成一笔成本 -- 两边都错。 */
    const s = buildProfit([
      f({ id: "paid", direction: "in", amount_cents: 300_000 }),
      f({ id: "undo", direction: "out", amount_cents: 300_000, adjusts_id: "paid" }),
    ]);
    expect(s.inCents).toBe(0);
    expect(s.outCents).toBe(0);
    expect(s.profitCents).toBe(0);
    expect(s.byCategory).toEqual([]);
  });

  it("drops an expense that was itself reversed", () => {
    const s = buildProfit([
      f({ id: "spent", direction: "out", amount_cents: 90_000, category: "材料" }),
      f({ id: "undo", direction: "in", amount_cents: 90_000, adjusts_id: "spent" }),
    ]);
    expect(s.outCents).toBe(0);
    expect(s.byCategory).toEqual([]);
  });

  it("groups what was spent, biggest first", () => {
    const s = buildProfit([
      f({ id: "a", amount_cents: 40_000, category: "车油" }),
      f({ id: "b", amount_cents: 840_000, category: "材料" }),
      f({ id: "c", amount_cents: 60_000, category: "材料" }),
    ]);
    expect(s.byCategory).toEqual([
      { name: "材料", cents: 900_000 },
      { name: "车油", cents: 40_000 },
    ]);
  });

  it("keeps what has no category visible, and always last", () => {
    /* 「没写」不是一个类别，它是一个洞 -- 而一张有一半躺在洞里的表，
       要讲得出它现在有多准。所以它看得见，而且不准靠大小排到第一。 */
    const s = buildProfit([
      f({ id: "a", amount_cents: 900_000 }),
      f({ id: "b", amount_cents: 10_000, category: "车油" }),
    ]);
    expect(s.byCategory).toEqual([
      { name: "车油", cents: 10_000 },
      { name: null, cents: 900_000 },
    ]);
  });

  it("treats blank and whitespace as no category, not as a category named ' '", () => {
    const s = buildProfit([
      f({ id: "a", amount_cents: 100, category: "" }),
      f({ id: "b", amount_cents: 200, category: "   " }),
    ]);
    expect(s.byCategory).toEqual([{ name: null, cents: 300 }]);
  });

  it("counts only the month asked for, reading the date as digits", () => {
    /* 不是 new Date() -- 那是一个 DATE 栏位，而伺服器跑 UTC。 */
    const facts = [
      f({ id: "a", direction: "in", amount_cents: 100_000, entry_on: "2026-09-01" }),
      f({ id: "b", direction: "in", amount_cents: 700_000, entry_on: "2026-08-31" }),
      f({ id: "c", direction: "out", amount_cents: 30_000, entry_on: "2026-09-30" }),
    ];
    const s = buildProfit(facts, { y: 2026, m: 9 });
    expect(s.inCents).toBe(100_000);
    expect(s.outCents).toBe(30_000);
    expect(s.count).toBe(2);
  });

  it("has nothing to say about an empty book, and says nothing rather than zero-ish nonsense", () => {
    const s = buildProfit([]);
    expect(s).toEqual({
      inCents: 0,
      outCents: 0,
      profitCents: 0,
      count: 0,
      byCategory: [],
    });
  });

  it("orders two equal categories by name, so the same books draw the same page twice", () => {
    const s = buildProfit([
      f({ id: "a", amount_cents: 5_000, category: "工钱" }),
      f({ id: "b", amount_cents: 5_000, category: "车油" }),
    ]);
    expect(s.byCategory.map((c) => c.name)).toEqual(["工钱", "车油"]);
  });
});

describe("jobProfit", () => {
  it("is what came in against the document, less what was filed against it", () => {
    const p = jobProfit({
      paidCents: 4_850_000,
      costs: [
        f({ id: "a", amount_cents: 1_200_000, category: "材料" }),
        f({ id: "b", amount_cents: 800_000, category: "工钱" }),
      ],
    });
    expect(p.costCents).toBe(2_000_000);
    expect(p.profitCents).toBe(2_850_000);
    expect(p.byCategory[0]).toEqual({ name: "材料", cents: 1_200_000 });
  });

  it("a job with no expenses filed against it has cost nothing, which is a fact and not a claim", () => {
    const p = jobProfit({ paidCents: 100_000, costs: [] });
    expect(p.costCents).toBe(0);
    expect(p.profitCents).toBe(100_000);
  });

  it("can be under water, and says so", () => {
    const p = jobProfit({
      paidCents: 50_000,
      costs: [f({ id: "a", amount_cents: 320_000, category: "材料" })],
    });
    expect(p.profitCents).toBe(-270_000);
  });

  it("🔴 ignores a cost that was reversed", () => {
    const p = jobProfit({
      paidCents: 500_000,
      costs: [
        f({ id: "spent", amount_cents: 300_000, category: "材料" }),
        f({ id: "undo", direction: "in", amount_cents: 300_000, adjusts_id: "spent" }),
      ],
    });
    expect(p.costCents).toBe(0);
    expect(p.profitCents).toBe(500_000);
  });
});
