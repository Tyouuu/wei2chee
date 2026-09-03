import { describe, expect, it } from "vitest";
import { fromPacks, hasPacks, packPhrase, splitPacks } from "./pack-units";

describe("有没有箱这个概念", () => {
  it("一箱一个不算箱", () => {
    expect(hasPacks(1)).toBe(false);
  });

  it("没填不算", () => {
    expect(hasPacks(null)).toBe(false);
    expect(hasPacks(undefined)).toBe(false);
    expect(hasPacks(0)).toBe(false);
  });

  it("一箱 24 算", () => {
    expect(hasPacks(24)).toBe(true);
  });
});

describe("91 罐是三箱又十九罐", () => {
  it("切得开", () => {
    expect(splitPacks(91, 24)).toEqual({ packs: 3, loose: 19 });
  });

  it("整箱就没有零头", () => {
    expect(splitPacks(72, 24)).toEqual({ packs: 3, loose: 0 });
  });

  it("不足一箱就没有箱", () => {
    expect(splitPacks(19, 24)).toEqual({ packs: 0, loose: 19 });
  });

  it("🔴 负数箱跟零头同号 —— 「−4 箱 +5 罐」读不懂", () => {
    /* 盘点的差额可以是负的，而那一句要读得出来。 */
    expect(splitPacks(-91, 24)).toEqual({ packs: -3, loose: -19 });
  });

  it("小数对齐流水那一栏的精度（三位）", () => {
    expect(splitPacks(2.5, 1.25)).toEqual({ packs: 2, loose: 0 });
  });

  it("没有箱的时候整个数都是零头", () => {
    expect(splitPacks(91, 1)).toEqual({ packs: 0, loose: 91 });
  });
});

describe("三箱又十九罐是 91", () => {
  it("加得回去", () => {
    expect(fromPacks(3, 19, 24)).toBe(91);
  });

  it("只打箱数也算得出来", () => {
    expect(fromPacks(3, 0, 24)).toBe(72);
  });

  it("没有箱的时候只算零头 —— 不可以把箱数乘进去", () => {
    expect(fromPacks(3, 19, 1)).toBe(19);
  });

  it("空的当成 0，不是 NaN", () => {
    expect(fromPacks(NaN, 19, 24)).toBe(19);
  });

  it("切开再加回去是同一个数", () => {
    const s = splitPacks(91, 24);
    expect(fromPacks(s.packs, s.loose, 24)).toBe(91);
  });
});

describe("画出来那一句", () => {
  it("三箱又十九罐", () => {
    expect(packPhrase(91, 24, "carton", "tins")).toBe("3 carton + 19 tins");
  });

  it("整箱不写「+ 0 罐」", () => {
    expect(packPhrase(72, 24, "carton", "tins")).toBe("3 carton");
  });

  it("不足一箱不写「0 箱」", () => {
    expect(packPhrase(19, 24, "carton", "tins")).toBe("19 tins");
  });

  it("零就是零箱", () => {
    expect(packPhrase(0, 24, "carton", "tins")).toBe("0 carton");
  });

  it("🔴 没有箱的时候回 null，不是空字串 —— 呼叫的人照这个决定画不画那一行", () => {
    expect(packPhrase(91, 1, "carton", "tins")).toBe(null);
    expect(packPhrase(91, null, "carton", "tins")).toBe(null);
  });

  it("箱没有名字的时候有一个字可以印，不是一段空白", () => {
    expect(packPhrase(72, 24, "", "tins")).toBe("3 pack");
  });
});
