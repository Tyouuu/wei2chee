import { describe, expect, it } from "vitest";
import {
  buildReceiptPrompt,
  receiptTroubleLines,
  RECEIPT_TROUBLE_COPY,
  toReceiptDraft,
  type ReceiptRaw,
} from "./receipt-read";

/** 一张读得干干净净的收据。每个案例只坏一格，其余照抄这一份 ——
 *  这样一条测试红的时候，红的原因只有一个。 */
const CLEAN: ReceiptRaw = {
  vendor: "Kedai Hardware Seng Huat",
  entry_on: "2026-09-01",
  total_sen: 12050,
  category: "材料",
  note: "水泥 5 包",
  trouble: "",
};

const CATS = ["材料", "工钱", "车油"];
const TODAY = "2026-09-04";

function draft(patch: Partial<ReceiptRaw> = {}) {
  return toReceiptDraft({ ...CLEAN, ...patch }, { categories: CATS, today: TODAY });
}

describe("一张读得清楚的收据", () => {
  it("六格都填好，一个 trouble 都没有", () => {
    const d = draft();
    expect(d).toMatchObject({
      party: "Kedai Hardware Seng Huat",
      note: "水泥 5 包",
      entryOn: "2026-09-01",
      amount: "120.50",
      category: "材料",
      troubles: [],
      said: "",
    });
  });
});

describe("金额", () => {
  it("sen 变令吉，两位小数补齐", () => {
    expect(draft({ total_sen: 1250 }).amount).toBe("12.50");
    expect(draft({ total_sen: 120400 }).amount).toBe("1204.00");
    expect(draft({ total_sen: 5 }).amount).toBe("0.05");
    expect(draft({ total_sen: 100 }).amount).toBe("1.00");
  });

  it("读不到就是空的，不是 0", () => {
    const d = draft({ total_sen: null });
    expect(d.amount).toBe("");
    expect(d.troubles).toContain("no-total");
  });

  /* 🔴 这一条是这个档案存在的一半理由：一笔 RM 0 的开销看起来像一笔
     真的开销，而一个空格看起来像一个空格。 */
  it("0 不是一个金额", () => {
    const d = draft({ total_sen: 0 });
    expect(d.amount).toBe("");
    expect(d.troubles).toContain("no-total");
  });

  it("负数跟小数都不收", () => {
    expect(draft({ total_sen: -1250 }).amount).toBe("");
    expect(draft({ total_sen: 12.5 }).amount).toBe("");
  });
});

describe("日期", () => {
  it("未来的日期一律丢掉 —— 那是把日跟月读反了", () => {
    const d = draft({ entry_on: "2026-09-05" });
    expect(d.entryOn).toBe("");
    expect(d.troubles).toContain("future-date");
  });

  it("今天算数", () => {
    expect(draft({ entry_on: TODAY }).entryOn).toBe(TODAY);
  });

  it("不是那个格式的丢掉", () => {
    expect(draft({ entry_on: "01/09/2026" }).troubles).toContain("bad-date");
    expect(draft({ entry_on: "" }).troubles).toContain("bad-date");
    expect(draft({ entry_on: null }).troubles).toContain("bad-date");
  });

  it("不存在的那一天丢掉", () => {
    expect(draft({ entry_on: "2026-02-30" }).troubles).toContain("bad-date");
    expect(draft({ entry_on: "2026-13-01" }).troubles).toContain("bad-date");
    expect(draft({ entry_on: "2026-02-29" }).troubles).toContain("bad-date");
  });

  it("闰年的 2 月 29 是真的一天", () => {
    const d = toReceiptDraft(
      { ...CLEAN, entry_on: "2028-02-29" },
      { categories: CATS, today: "2028-03-01" },
    );
    expect(d.entryOn).toBe("2028-02-29");
    expect(d.troubles).toEqual([]);
  });
});

describe("类别只能从他自己用过的词里挑", () => {
  it("对得上就用他那一份的写法", () => {
    expect(draft({ category: " 材料 " }).category).toBe("材料");
    expect(
      toReceiptDraft(
        { ...CLEAN, category: "materials" },
        { categories: ["Materials", "Wages"], today: TODAY },
      ).category,
    ).toBe("Materials");
  });

  /* 🔴 模型发明一个科目出来，等於我们替他开了一张他没有同意过的科目表。 */
  it("发明的那一个丢掉，而且讲出来", () => {
    const d = draft({ category: "Office Supplies" });
    expect(d.category).toBe("");
    expect(d.troubles).toContain("unknown-category");
  });

  it("没挑不是错 —— 他本来就可以不分类", () => {
    const d = draft({ category: null });
    expect(d.category).toBe("");
    expect(d.troubles).not.toContain("unknown-category");
  });

  it("他一个词都还没用过的时候，任何猜测都是发明", () => {
    const d = toReceiptDraft({ ...CLEAN, category: "材料" }, { categories: [], today: TODAY });
    expect(d.category).toBe("");
    expect(d.troubles).toContain("unknown-category");
  });
});

describe("店名", () => {
  it("读不到就讲出来", () => {
    expect(draft({ vendor: null }).troubles).toContain("no-vendor");
    expect(draft({ vendor: "   " }).troubles).toContain("no-vendor");
  });

  it("太长的截短，不是拒绝 —— 截短的还看得懂", () => {
    const d = draft({ vendor: "A".repeat(300) });
    expect(d.party).toHaveLength(120);
  });
});

describe("给模型的那一段话", () => {
  it("带着他自己的词，一个一行", () => {
    const p = buildReceiptPrompt({ categories: CATS, language: "zh", today: TODAY });
    for (const c of CATS) expect(p).toContain(`- ${c}`);
    expect(p).toContain("copied EXACTLY");
  });

  it("他一个词都没有的时候，明讲「回 null」", () => {
    const p = buildReceiptPrompt({ categories: [], language: "en", today: TODAY });
    expect(p).toContain("has not used any expense words yet");
  });

  it("今天几号写在里面 —— 未来的日期是靠这个判的", () => {
    expect(buildReceiptPrompt({ categories: [], language: "en", today: TODAY })).toContain(TODAY);
  });

  it("日在前那一条明写着，因为这个市场是这样写的", () => {
    const p = buildReceiptPrompt({ categories: [], language: "en", today: TODAY });
    expect(p).toContain("day first");
    expect(p).toContain("3 September 2026");
  });

  it("字的语言跟着他的系统走，不跨语言凑合", () => {
    expect(buildReceiptPrompt({ categories: [], language: "zh", today: TODAY })).toContain(
      "in Chinese",
    );
    expect(buildReceiptPrompt({ categories: [], language: "en", today: TODAY })).toContain(
      "in English",
    );
  });
});

describe("讲给他听的那几句", () => {
  /* 守卫：新增一种 trouble 而只写了一种语言，这一条会红。
     ⚠️ 名单是**推导出来的**，不是手写的第二份 —— 这个仓库栽在
     「第二份手写清单」上至少五次。 */
  it("每一种 trouble 两种语言都有话讲，而且不是空的", () => {
    const zh = Object.keys(RECEIPT_TROUBLE_COPY.zh).sort();
    const en = Object.keys(RECEIPT_TROUBLE_COPY.en).sort();
    expect(en).toEqual(zh);
    for (const k of zh) {
      expect(RECEIPT_TROUBLE_COPY.zh[k as keyof typeof RECEIPT_TROUBLE_COPY.zh]).not.toBe("");
      expect(RECEIPT_TROUBLE_COPY.en[k as keyof typeof RECEIPT_TROUBLE_COPY.en]).not.toBe("");
    }
  });

  it("印出来的是那几句，顺序跟 troubles 一样", () => {
    const d = draft({ total_sen: null, entry_on: null });
    expect(receiptTroubleLines(d, "zh")).toEqual([
      RECEIPT_TROUBLE_COPY.zh["no-total"],
      RECEIPT_TROUBLE_COPY.zh["bad-date"],
    ]);
    expect(receiptTroubleLines(d, "en")[0]).toBe(RECEIPT_TROUBLE_COPY.en["no-total"]);
  });
});
