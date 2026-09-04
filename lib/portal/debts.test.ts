import { describe, expect, it } from "vitest";
import {
  describeOwing,
  oldestOwing,
  overLimitCents,
  owingTotalCents,
  type PartyOwing,
} from "./debts";

function owing(patch: Partial<PartyOwing> = {}): PartyOwing {
  return {
    partyId: "p1",
    name: "陈先生",
    owedCents: 4850000,
    oldestDays: 42,
    limitCents: null,
    ...patch,
  };
}

describe("总数跟最久的那一个", () => {
  it("总数是全部人加起来，不是印出来的那几行", () => {
    expect(owingTotalCents([owing({ owedCents: 100 }), owing({ owedCents: 250 })])).toBe(350);
  });

  /* 🔴 这一条是这个档案存在的一半理由：欠 RM 300 欠了两年的那一个，
     排在金额榜的最后，而他正是要打电话的那一个。 */
  it("最久的那一个不受排名影响", () => {
    const rows = [
      owing({ partyId: "big", name: "大客户", owedCents: 9_000_00, oldestDays: 3 }),
      owing({ partyId: "old", name: "拖很久那个", owedCents: 300_00, oldestDays: 720 }),
    ];
    expect(oldestOwing(rows)?.partyId).toBe("old");
  });

  it("没有一笔有日期的时候，最久的那一个是 null", () => {
    expect(oldestOwing([owing({ oldestDays: null })])).toBeNull();
  });
});

describe("额度", () => {
  it("没写额度就不讲", () => {
    expect(overLimitCents(owing({ limitCents: null }))).toBeNull();
  });

  it("没超过也不讲 —— 一句「还有额度」不是他要的资讯", () => {
    expect(overLimitCents(owing({ owedCents: 100, limitCents: 500 }))).toBeNull();
  });

  it("超过多少讲多少", () => {
    expect(overLimitCents(owing({ owedCents: 700, limitCents: 500 }))).toBe(200);
  });
});

describe("讲给模型听的那几行", () => {
  it("每个人一行，带名字、金额、欠几天", () => {
    const out = describeOwing([owing({ name: "陈先生", owedCents: 3_000_00, oldestDays: 12 })], "zh");
    expect(out.join("\n")).toContain("陈先生");
    expect(out.join("\n")).toContain("RM 3,000");
    expect(out.join("\n")).toContain("12 天");
  });

  it("总数写在抬头上", () => {
    const out = describeOwing(
      [owing({ owedCents: 1_000_00, oldestDays: 1 }), owing({ owedCents: 2_000_00, oldestDays: 2 })],
      "zh",
    );
    expect(out[0]).toContain("2 个");
    expect(out[0]).toContain("RM 3,000");
  });

  /* 🔴 没有问 跟 没有人欠 是两句话。混成一句，画面就会对一个师傅
     讲「没有人欠你钱」，而他老板的帐上挂着三万。 */
  it("没有问的时候一个字都不讲", () => {
    expect(describeOwing(null, "zh")).toEqual([]);
    expect(describeOwing(null, "en")).toEqual([]);
  });

  it("问了而没有人欠，讲得出「都收齐了」", () => {
    expect(describeOwing([], "zh").join("")).toContain("没有人欠");
    expect(describeOwing([], "en").join("")).toContain("Nobody owes");
  });

  it("超过额度的那一行才带额度那句", () => {
    const out = describeOwing(
      [
        owing({ partyId: "a", name: "超额那个", owedCents: 700_00, limitCents: 500_00 }),
        owing({ partyId: "b", name: "没超那个", owedCents: 100_00, limitCents: 500_00 }),
      ],
      "zh",
    ).join("\n");
    expect(out).toMatch(/超额那个.*超过他写的额度/);
    expect(out).not.toMatch(/没超那个.*超过/);
  });

  describe("截断", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      owing({
        partyId: `p${i}`,
        name: `客户${i}`,
        owedCents: (20 - i) * 100_00,
        oldestDays: i === 19 ? 900 : i,
      }),
    );

    it("只列前几个，而且讲出来还有几个", () => {
      const out = describeOwing(many, "zh", 5);
      expect(out.join("\n")).toContain("客户0");
      expect(out.join("\n")).not.toContain("客户9");
      expect(out.join("\n")).toContain("还有 15 个");
    });

    it("🔴 总数还是全部人的，不是印出来那五个的", () => {
      const out = describeOwing(many, "zh", 5);
      expect(out[0]).toContain("20 个");
      /* 20 个人，第 i 个欠 (20-i) 百块 -> 100_00 * (20+19+...+1) = RM 21,000。
         ⚠️ 第一版我在这里写了 RM 210,000，红的是**我的算术**不是产品 ——
         而把作者算错的数字写成正确答案，尺子就不再量产品，开始量作者。 */
      expect(out[0]).toContain("RM 21,000");
    });

    it("🔴 被切掉的那个如果欠最久，照样讲得出来", () => {
      const out = describeOwing(many, "zh", 5).join("\n");
      expect(out).toContain("客户19");
      expect(out).toContain("900 天");
    });
  });

  it("两种语言都有话讲，不跨语言凑合", () => {
    const rows = [owing({ name: "Ah Chai", owedCents: 500_00, oldestDays: 9 })];
    expect(describeOwing(rows, "en").join("\n")).toContain("days outstanding");
    expect(describeOwing(rows, "zh").join("\n")).toContain("欠了 9 天");
  });
});
