import { describe, expect, it } from "vitest";
import { fieldWord, showChanges, showValue, whenInMalaysia, type ChangeRow } from "./change-log";

const row = (over: Partial<ChangeRow> = {}): ChangeRow => ({
  id: "c1",
  entity: "pipeline",
  entityId: "r1",
  label: "QT-2026-0001 厨房",
  field: "amount_cents",
  was: "4800000",
  nowIs: "3800000",
  changedBy: "u1",
  createdAt: "2026-09-04T06:32:00.000Z",
  ...over,
});

describe("一个值画出来长什么样", () => {
  it("sen 变成他读得懂的钱", () => {
    expect(showValue("amount_cents", "4800000", "—")).toBe("RM 48,000");
  });

  it("有几分钱就印几分钱", () => {
    expect(showValue("amount_cents", "4800050", "—")).toBe("RM 48,000.50");
  });

  it("🔴 本来没有，跟本来是空白，都印同一句 —— 而两个都不是 RM 0", () => {
    expect(showValue("amount_cents", null, "还没填")).toBe("还没填");
    expect(showValue("amount_cents", "", "还没填")).toBe("还没填");
  });

  it("不是钱的那几栏原样印", () => {
    expect(showValue("title", "厨房翻新", "—")).toBe("厨房翻新");
  });

  it("工地存的是 id，所以不印那一串 —— 一串 uuid 比一条横线糟", () => {
    expect(showValue("site_address_id", "6f0c1a2b-1111-2222-3333-444455556666", "—")).toBe("—");
  });
});

describe("栏位翻成他的词", () => {
  it("那一页自己的栏名赢", () => {
    expect(fieldWord("amount_cents", "zh", { amount_cents: "报价" })).toBe("报价");
  });

  it("讲不出来就退回通用的", () => {
    expect(fieldWord("amount_cents", "zh")).toBe("金额");
    expect(fieldWord("amount_cents", "en")).toBe("Amount");
  });

  it("🔴 连通用的都没有的时候，印栏位名本身，不印空白 —— 一行没有主词的历史读不懂", () => {
    expect(fieldWord("some_new_column", "zh")).toBe("some_new_column");
  });
});

describe("时间", () => {
  it("是马来西亚时间，不是伺服器的 UTC", () => {
    /* 06:32 UTC = 14:32 在这里。伺服器跑 UTC，而他在 UTC+8 ——
       同一个八小时，20260831030000 已经踩过一次。 */
    expect(whenInMalaysia("2026-09-04T06:32:00.000Z")).toBe("2026-09-04 14:32");
  });

  it("半夜那一小时印 00 不印 24", () => {
    expect(whenInMalaysia("2026-09-03T16:05:00.000Z")).toBe("2026-09-04 00:05");
  });
});

describe("整条历史", () => {
  it("一行讲得出：什么时候、改了什么、从什么变成什么、谁改的", () => {
    const [c] = showChanges([row()], { lang: "zh", blank: "—", names: { u1: "阿明" } });
    expect(c.when).toBe("2026-09-04 14:32");
    expect(c.what).toBe("金额");
    expect(c.was).toBe("RM 48,000");
    expect(c.nowIs).toBe("RM 38,000");
    expect(c.who).toBe("阿明");
    expect(c.isDelete).toBe(false);
  });

  it("🔴 查不到那个人叫什么就留白 —— 印一串 uuid 给他看没有意义", () => {
    const [c] = showChanges([row()], { lang: "zh", blank: "—" });
    expect(c.who).toBe("");
  });

  it("删掉那一行是一句完整的话，不是「从 A 变成 B」", () => {
    const [c] = showChanges([row({ field: "deleted", was: "yes", nowIs: null })], {
      lang: "zh",
      blank: "—",
    });
    expect(c.isDelete).toBe(true);
    expect(c.what).toBe("删掉了");
  });
});
