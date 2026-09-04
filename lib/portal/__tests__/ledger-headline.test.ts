import { describe, expect, it } from "vitest";
import { buildLedgerHeadline } from "../live-months";

/**
 * 收款 · 开销 · 佣金那三页顶上的数字。
 *
 * 🔴 它存在的理由：`shoot:phone` 2026-09-05 量到**收款那一页顶上印着
 * `RM 71,300`** —— 每一家公司共用的示例总数。底下那张表 8-31 起就会读他
 * 自己的行，而头上那个数字没有人接（[任务 94](../../../docs/founder-tasks.md) 记过）。
 */
const now = { y: 2026, m: 9 };
const at = (on: string, cents: number, extra: Record<string, unknown> = {}) => ({
  id: `e${on}${cents}`,
  adjusts_id: null,
  direction: "in",
  category: null,
  amount_cents: cents,
  entry_on: on,
  ...extra,
});

describe("那三页顶上的数字", () => {
  it("一行都没有就回 null —— 而 null 才让示例留着", () => {
    expect(buildLedgerHeadline({ lang: "zh", now, moduleKey: "payments", ledger: [] })).toBeNull();
  });

  it("数的是这个月，不是全部", () => {
    const s = buildLedgerHeadline({
      lang: "zh", now, moduleKey: "payments",
      ledger: [at("2026-09-03", 300000), at("2026-09-20", 150000), at("2026-08-30", 999900)],
    })!;
    expect(s.tiles[0].value).toBe("RM 4,500");
    expect(s.tiles[1].value).toBe("2 笔");
  });

  /** 🔴 一笔退回去的钱在这之前照样算进这个月。跟报表那一页同一条规矩。 */
  it("🔴 冲正过的两笔都不算", () => {
    const paid = at("2026-09-03", 300000);
    const reversal = { ...at("2026-09-04", 300000), id: "rev", adjusts_id: paid.id };
    const s = buildLedgerHeadline({
      lang: "zh", now, moduleKey: "payments",
      ledger: [paid, reversal, at("2026-09-05", 120000)],
    })!;
    expect(s.tiles[0].value).toBe("RM 1,200");
    expect(s.tiles[1].value).toBe("1 笔");
  });

  it("六个月的走势，最后一格是这个月", () => {
    const s = buildLedgerHeadline({
      lang: "zh", now, moduleKey: "payments",
      ledger: [at("2026-09-03", 500000), at("2026-07-03", 200000)],
    })!;
    expect(s.trend).toHaveLength(6);
    expect(s.trend[s.trend.length - 1].value).toBe(5000);
    expect(s.trend[3].value).toBe(2000);
  });

  /** 每一页用它自己的动词 —— 一个老板不会把发给师傅的抽成叫「开销」。 */
  it("三页三个说法", () => {
    const one = (k: string) =>
      buildLedgerHeadline({ lang: "zh", now, moduleKey: k, ledger: [at("2026-09-03", 100)] })!
        .tiles[0].label;
    expect(one("payments")).toBe("本月收到");
    expect(one("expenses")).toBe("本月花掉");
    expect(one("commission")).toBe("本月佣金");
    expect(new Set(["payments", "expenses", "commission"].map(one)).size).toBe(3);
  });

  it("英文那一边也有，不跨语言凑合", () => {
    const s = buildLedgerHeadline({
      lang: "en", now, moduleKey: "commission", ledger: [at("2026-09-03", 100)],
    })!;
    expect(s.tiles[0].label).toBe("Commission this month");
    expect(/[\u4e00-\u9fff]/.test(JSON.stringify(s))).toBe(false);
  });
});
