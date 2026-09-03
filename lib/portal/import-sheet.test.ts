import { describe, expect, it } from "vitest";
import {
  dateOfCell,
  mapHeaders,
  parseSheet,
  rowHasSomething,
  rowToRecord,
  senOfCell,
  sniffDelimiter,
  keyForRow,
} from "./import-sheet";

const columns = [
  { key: "title", label: "工程" },
  { key: "party", label: "客户" },
  { key: "amount_cents", label: "报价" },
  { key: "due_on", label: "有效期到" },
  { key: "plate", label: "车牌号" },
];

describe("分隔符是数出来的，不是问他的", () => {
  it("🔴 从 Excel 贴出来是 tab —— 一支只认逗号的剖析器会把整行当成一栏", () => {
    expect(sniffDelimiter("工程\t客户\t报价\n厨房\t陈先生\t48500")).toBe("tab");
  });

  it("档案是逗号", () => {
    expect(sniffDelimiter("工程,客户,报价\n厨房,陈先生,48500")).toBe("comma");
  });

  it("🔴 一致才算数，多不算 —— 地址里的逗号可以比 tab 多", () => {
    /* 每一行 tab 都是 2 个（一致）；逗号 3 个、1 个、2 个（不一致）。 */
    const text =
      "工程\t地址\t报价\n" +
      "厨房\tLot 42, Jalan Kebun, Klang\t48500\n" +
      "浴室\tNo 8 Jalan Sekolah\t8000\n" +
      "阳台\tA, B\t1200";
    expect(sniffDelimiter(text)).toBe("tab");
  });

  it("什么都没有的时候不炸", () => {
    expect(sniffDelimiter("")).toBe("comma");
  });
});

describe("切开一行", () => {
  it("引号里的分隔符不算 —— 「Lot 42, Jalan Kebun」是一栏", () => {
    const s = parseSheet('工程,地址\n厨房,"Lot 42, Jalan Kebun"');
    expect(s.rows[0]).toEqual(["厨房", "Lot 42, Jalan Kebun"]);
  });

  it("引号里的两个引号是一个引号", () => {
    const s = parseSheet('名字\n"他叫""阿明"""');
    expect(s.rows[0][0]).toBe('他叫"阿明"');
  });

  it("空行丢掉 —— 从 Excel 贴出来常常带几行空的", () => {
    const s = parseSheet("工程,客户\n厨房,陈先生\n\n\n");
    expect(s.rows.length).toBe(1);
  });
});

describe("认表头", () => {
  it("用他自己那一页的字", () => {
    const m = mapHeaders(["工程", "客户", "报价"], columns);
    expect(m.byIndex).toEqual(["title", "party", "amount_cents"]);
    expect(m.unmatched).toEqual([]);
  });

  it("大小写、空格、冒号都不影响", () => {
    const m = mapHeaders([" 工程 ", "Title", "AMOUNT_CENTS"], columns);
    expect(m.byIndex).toEqual(["title", "title", "amount_cents"]);
  });

  it("🔴 认不出来的不猜，列出来给他看 —— 猜错一栏，五百行的电话会存进备注", () => {
    const m = mapHeaders(["工程", "他老婆的名字"], columns);
    expect(m.byIndex).toEqual(["title", null]);
    expect(m.unmatched).toEqual(["他老婆的名字"]);
  });

  it("一栏都没认出来的时候讲得出来（多半是第一行不是表头）", () => {
    expect(mapHeaders(["厨房", "陈先生"], columns).nothingMatched).toBe(true);
  });
});

describe("一格变成一个值", () => {
  it("RM 48,500 → sen", () => {
    expect(senOfCell("RM 48,500")).toBe(4_850_000);
  });

  it("有几分钱就算几分钱", () => {
    expect(senOfCell("48500.50")).toBe(4_850_050);
  });

  it("🔴 空的回 null 不是 0 —— 「没写」跟「零元」不是同一件事", () => {
    expect(senOfCell("")).toBe(null);
    expect(senOfCell("—")).toBe(null);
  });

  it("ISO 的日期照用", () => {
    expect(dateOfCell("2026-09-04")).toBe("2026-09-04");
  });

  it("🔴 4/9/2026 是九月四号，不是四月九号", () => {
    /* 马来西亚写日/月/年。美式读法会给一个读起来完全正常的错误日期。 */
    expect(dateOfCell("4/9/2026")).toBe("2026-09-04");
  });

  it("认不出来的日期回 null，不是今天", () => {
    expect(dateOfCell("下个月")).toBe(null);
  });
});

describe("一行变成一笔记录", () => {
  const m = mapHeaders(["工程", "客户", "报价", "有效期到", "车牌号"], columns);
  const own = new Set(["plate"]);

  it("认得的进本来那几栏，他自己加的那一栏进 extra", () => {
    const r = rowToRecord(
      ["厨房翻新", "陈先生", "RM 48,500", "4/9/2026", "WXY 1234"],
      m,
      own,
    );
    expect(r).toEqual({
      title: "厨房翻新",
      party: "陈先生",
      amount_cents: "4850000",
      due_on: "2026-09-04",
      extra: { plate: "WXY 1234" },
    });
  });

  it("空的格子不送 —— 送一个空字串进去，等於把那一栏清掉", () => {
    const r = rowToRecord(["厨房", "", "", "", ""], m, own);
    expect(r).toEqual({ title: "厨房" });
  });

  it("认不出来的日期整格丢掉，不是送一个坏字串进去", () => {
    const r = rowToRecord(["厨房", "", "", "下个月", ""], m, own);
    expect(r).toEqual({ title: "厨房" });
  });

  it("防重复的钥匙跟着走", () => {
    const r = rowToRecord(["厨房"], m, own, "11111111-1111-1111-1111-111111111111");
    expect(r.idempotency_key).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("整行空的认得出来", () => {
    expect(rowHasSomething(["", "  ", ""])).toBe(false);
    expect(rowHasSomething(["", "厨房"])).toBe(true);
  });
});

describe("防重复的钥匙", () => {
  const text = "工程\t客户\n厨房\t陈先生\n厨房\t陈先生";

  it("形状是一个合法的 uuid", () => {
    /* 🔴 第一版不是，而资料库整批拒绝 —— 四行一行都没进去。 */
    expect(keyForRow(text, 0)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("🔴 同一份贴上去按两次，钥匙一样 —— 第二次一行都不会重复", () => {
    expect(keyForRow(text, 3)).toBe(keyForRow(text, 3));
  });

  it("🔴 同一份里两笔一模一样的行，钥匙不一样 —— 两笔都要进得去", () => {
    expect(keyForRow(text, 1)).not.toBe(keyForRow(text, 2));
  });

  it("另一份表算出来是另一把", () => {
    expect(keyForRow(text, 0)).not.toBe(keyForRow(`${text}\n阳台\t黄先生`, 0));
  });
});
