import { describe, expect, it } from "vitest";
import { commissionOn, tierProblems, tierPhrase } from "./commission";

const RM = (cents: number) => `RM ${(cents / 100).toLocaleString("en-MY")}`;
const WORDS = { first: "First {amount} at {percent}", then: "{percent} on everything", from: "From {amount}, {percent}", join: " · " };

describe("commissionOn", () => {
  /* 🔴 这一条就是整个档案的理由。同一批数字在 check:records 里
     拿去问资料库，两边不一样就红。 */
  it("算的是分段，不是整笔跳档", () => {
    const tiers = [
      { fromCents: 0, percent: 10 },
      { fromCents: 500_000, percent: 15 },
    ];
    /* 5000 × 10% + 3000 × 15% = 500 + 450 = 950 */
    expect(commissionOn(800_000, tiers)).toBe(95_000);
    /* 整笔算会给 120_000。差 25_000 —— 那 250 块就是这条测试守的东西。 */
    expect(commissionOn(800_000, tiers)).not.toBe(120_000);
  });

  it("刚好落在档的边上", () => {
    const tiers = [
      { fromCents: 0, percent: 10 },
      { fromCents: 500_000, percent: 15 },
    ];
    expect(commissionOn(500_000, tiers)).toBe(50_000);
  });

  it("三档", () => {
    const tiers = [
      { fromCents: 0, percent: 5 },
      { fromCents: 300_000, percent: 10 },
      { fromCents: 800_000, percent: 20 },
    ];
    /* 3000×5% + 5000×10% + 2000×20% = 150 + 500 + 400 = 1050 */
    expect(commissionOn(1_000_000, tiers)).toBe(105_000);
  });

  it("他一行一行加，没排序也要对", () => {
    const jumbled = [
      { fromCents: 500_000, percent: 15 },
      { fromCents: 0, percent: 10 },
    ];
    expect(commissionOn(800_000, jumbled)).toBe(95_000);
  });

  it("第一档不从零开始 —— 做满三千才算，是真的有人这样写", () => {
    const tiers = [{ fromCents: 300_000, percent: 10 }];
    /* 头三千没有佣金：只有 5000-3000 那一段算。 */
    expect(commissionOn(500_000, tiers)).toBe(20_000);
    expect(commissionOn(200_000, tiers)).toBe(0);
  });

  it("没有档就是没有佣金，不是报错", () => {
    expect(commissionOn(800_000, [])).toBe(0);
  });

  it("没赚就没有", () => {
    expect(commissionOn(0, [{ fromCents: 0, percent: 10 }])).toBe(0);
    expect(commissionOn(-100, [{ fromCents: 0, percent: 10 }])).toBe(0);
  });

  it("分是整数，而且往下截 —— 多给一分是我们替他多付的钱", () => {
    /* 333 × 10% = 33.3 */
    expect(commissionOn(333, [{ fromCents: 0, percent: 10 }])).toBe(33);
  });

  it("抽零成的一档就是零，不是跳过它去用下一档", () => {
    const tiers = [
      { fromCents: 0, percent: 0 },
      { fromCents: 300_000, percent: 10 },
    ];
    expect(commissionOn(500_000, tiers)).toBe(20_000);
  });
});

describe("tierProblems", () => {
  const words = { duplicate: "两档不能从同一个数字开始", tooMany: "太多档了", badPercent: "百分比要在 0 到 100 之间" };

  it("两档同一个起点", () => {
    expect(
      tierProblems([{ fromCents: 0, percent: 10 }, { fromCents: 0, percent: 15 }], words),
    ).toEqual([words.duplicate]);
  });

  it("七档", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ fromCents: i * 1000, percent: 5 }));
    expect(tierProblems(seven, words)).toContain(words.tooMany);
  });

  it("一百二十趴", () => {
    expect(tierProblems([{ fromCents: 0, percent: 120 }], words)).toContain(words.badPercent);
  });

  it("正常的一份不吭声", () => {
    expect(
      tierProblems([{ fromCents: 0, percent: 10 }, { fromCents: 500_000, percent: 15 }], words),
    ).toEqual([]);
  });
});

describe("tierPhrase", () => {
  it("讲一句他读得懂的", () => {
    expect(
      tierPhrase(
        [{ fromCents: 0, percent: 10 }, { fromCents: 500_000, percent: 15 }],
        RM,
        WORDS,
      ),
    ).toBe("First RM 5,000 at 10% · From RM 5,000, 15%");
  });

  it("只有一档就不讲「头多少」", () => {
    expect(tierPhrase([{ fromCents: 0, percent: 10 }], RM, WORDS)).toBe("10% on everything");
  });

  /* 🔴 没有档回 null，不是空字串 —— 空字串会画出一行空的说明。 */
  it("没有档回 null", () => {
    expect(tierPhrase([], RM, WORDS)).toBeNull();
  });
});
