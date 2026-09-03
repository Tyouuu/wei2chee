import { describe, it, expect } from "vitest";
import { priceSchedule, suggestedFor, type PaymentTerm } from "./payment-terms";

/**
 * 每一条写成他会读到的那一句，或者他会看到的那一张纸。
 */

const RENO: PaymentTerm[] = [
  { description: "订金", portion: 30 },
  { description: "动工", portion: 40 },
  { description: "完工", portion: 30 },
];

describe("装修那三期", () => {
  it("RM 48,500 切成 14,550 / 19,400 / 14,550", () => {
    const s = priceSchedule(RENO, 4850000);
    expect(s.terms.map((t) => t.cents)).toEqual([1455000, 1940000, 1455000]);
  });

  it("加起来正好是单上那个数", () => {
    const s = priceSchedule(RENO, 4850000);
    expect(s.totalCents).toBe(4850000);
    expect(s.matches).toBe(true);
    expect(s.differenceCents).toBe(0);
  });

  /* 客人手上那张纸一定要加得起来。33.33 × 3 差 RM 1.85 —— 最后一期吃掉。 */
  it("除不尽的时候，最后一期吃掉那几分钱", () => {
    const thirds: PaymentTerm[] = [
      { description: "一", portion: 33.33 },
      { description: "二", portion: 33.33 },
      { description: "三", portion: 33.34 },
    ];
    const s = priceSchedule(thirds, 4850000);
    expect(s.totalCents).toBe(4850000);
    expect(s.matches).toBe(true);
  });
});

describe("写死的金额", () => {
  it("照写，不换算", () => {
    const s = priceSchedule([{ description: "订金", amount_cents: 500000 }], 4850000);
    expect(s.terms[0].cents).toBe(500000);
  });

  /* 🔴 这一条是这个档案最重要的一条：加不起来的时候讲出来差多少，
     不要偷偷把最后一期改大。一个我们替他调过的数字，他不知道被调过。 */
  it("加不起来的时候讲差多少，不偷偷补上", () => {
    const s = priceSchedule(
      [
        { description: "订金", amount_cents: 500000 },
        { description: "完工", amount_cents: 1000000 },
      ],
      4850000,
    );
    expect(s.totalCents).toBe(1500000);
    expect(s.matches).toBe(false);
    expect(s.differenceCents).toBe(-3350000);
  });

  /* 混着写的时候也不动 —— 那时候「余数」不知道该算谁的。 */
  it("一期写金额一期写比例，不吃余数", () => {
    const s = priceSchedule(
      [
        { description: "订金", amount_cents: 500000 },
        { description: "余额", portion: 50 },
      ],
      4850000,
    );
    expect(s.terms.map((t) => t.cents)).toEqual([500000, 2425000]);
    expect(s.matches).toBe(false);
  });

  /* 比例加起来不是 100 也不动 —— 那是他还没写完，不是一个要我们补的洞。 */
  it("比例加起来不到一百，照实算，不补到一百", () => {
    const s = priceSchedule([{ description: "订金", portion: 30 }], 4850000);
    expect(s.terms[0].cents).toBe(1455000);
    expect(s.differenceCents).toBe(-3395000);
  });
});

describe("单还没有总数的时候", () => {
  /* ⚠️ 「不知道」跟「零」是两件事。印 RM 0 是印一个我们没有的数字。 */
  it("比例那几期算不出来，而且不准说是零", () => {
    const s = priceSchedule(RENO, null);
    expect(s.documentCents).toBeNull();
    expect(s.matches).toBeNull();
    expect(s.differenceCents).toBeNull();
  });

  it("写死金额的那几期照样算得出来", () => {
    const s = priceSchedule([{ description: "订金", amount_cents: 500000 }], null);
    expect(s.terms[0].cents).toBe(500000);
    expect(s.totalCents).toBe(500000);
  });

  it("一期都没有的时候，不是一个错，是还没写", () => {
    const s = priceSchedule([], 4850000);
    expect(s.terms).toEqual([]);
    expect(s.totalCents).toBe(0);
    expect(s.matches).toBe(false);
  });
});

describe("建议的那几期", () => {
  it("装修是三成四成三成", () => {
    expect(suggestedFor("renovation")?.map((t) => t.portion)).toEqual([30, 40, 30]);
  });

  it("加起来一定是一百 —— 一个加不到一百的建议是在教他写错", () => {
    for (const trade of ["renovation", "services"]) {
      const sum = (suggestedFor(trade) ?? []).reduce((n, t) => n + t.portion, 0);
      expect(sum, trade).toBe(100);
    }
  });

  it("没有量过的行业就不建议 —— 猜一份付款办法比不给更糟", () => {
    for (const t of ["retail", "fnb", "beauty", "wholesale", "education", "other", ""]) {
      expect(suggestedFor(t), t).toBeNull();
    }
  });
});
