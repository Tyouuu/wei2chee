/* 开发费算得对不对。
 *
 * ⚠️ 这几条不是在测「数字对不对」（数字是老板的，随时会改），
 * 是在测**结构**：同一个形状的第二个比第一个便宜、认不得的 key 不算钱、
 * 规格书抵扣只扣一次。数字改了这些照样要过。
 */
import { describe, expect, it } from "vitest";
import {
  buildQuote,
  formatMyr,
  BUILD_BASE_MYR,
  SHAPE_FIRST_MYR,
  SHAPE_REPEAT_MYR,
  SPEC_FEE_MYR,
  moduleLabelFor,
} from "./build-quote";
import { MODULE_CATALOG } from "./module-catalog";

describe("开发费", () => {
  it("一个模块都没有，也要收起底那一笔", () => {
    const q = buildQuote([]);
    expect(q.subtotalMyr).toBe(BUILD_BASE_MYR);
    expect(q.lines).toEqual([]);
  });

  it("同一个形状的第二个比第一个便宜 —— 这是整张表的重点", () => {
    /* 报价单 · 订单 · 工程 全部是「走单」。做完第一个，后面两个是拼的。 */
    const q = buildQuote(["quotations", "orders", "projects"]);
    expect(q.lines.map((l) => l.amountMyr)).toEqual([
      SHAPE_FIRST_MYR,
      SHAPE_REPEAT_MYR,
      SHAPE_REPEAT_MYR,
    ]);
    expect(q.subtotalMyr).toBe(BUILD_BASE_MYR + SHAPE_FIRST_MYR + SHAPE_REPEAT_MYR * 2);
  });

  it("不同形状各算各的第一个", () => {
    const q = buildQuote(["quotations", "payments", "customers"]);
    expect(q.lines.every((l) => l.nth === 1)).toBe(true);
    expect(q.subtotalMyr).toBe(BUILD_BASE_MYR + SHAPE_FIRST_MYR * 3);
  });

  it("认不得的 key 不算钱 —— 多算一笔客户没有的东西比少算严重", () => {
    const q = buildQuote(["quotations", "not_a_real_module", "orders"]);
    expect(q.lines).toHaveLength(2);
    expect(q.subtotalMyr).toBe(BUILD_BASE_MYR + SHAPE_FIRST_MYR + SHAPE_REPEAT_MYR);
  });

  it("规格书付过就扣掉，而且只扣一次", () => {
    const keys = ["quotations", "payments"];
    const unpaid = buildQuote(keys, false);
    const paid = buildQuote(keys, true);
    expect(unpaid.specCreditMyr).toBe(0);
    expect(paid.specCreditMyr).toBe(SPEC_FEE_MYR);
    expect(unpaid.totalMyr - paid.totalMyr).toBe(SPEC_FEE_MYR);
  });

  it("目录里每一个模块都算得出价钱 —— 新加一个模块忘了给形状就红", () => {
    const q = buildQuote(MODULE_CATALOG.map((m) => m.key));
    expect(q.lines).toHaveLength(MODULE_CATALOG.length);
    expect(q.lines.every((l) => l.amountMyr > 0)).toBe(true);
  });

  it("装修那一套算出来落在老板自己开过的价钱附近", () => {
    /* 总览 · 报价单 · 工程 · 收款 · 客户 · 官网 —— 一个装修承包商的标准手牌。
       这一条是**锚**，不是断言好坏：数字改了它会红，那正是要它红的时候。 */
    const q = buildQuote(["dashboard", "quotations", "projects", "payments", "customers", "website"]);
    expect(q.subtotalMyr).toBe(5800);
  });

  it("印出来是马来西亚人读的格式", () => {
    expect(formatMyr(5800)).toBe("RM 5,800");
    expect(formatMyr(500)).toBe("RM 500");
  });
});

/* 每一个模块在规格书里都叫得出名字。
 *
 * 🔴 2026-09-01 抓到的真 bug：`spec-outline.ts` 本来有两张**手写的七条**
 * 页名对照表，而 `isBuiltInPage()` 查的是十八个 key 的名单。於是
 * `website` 这种不在七条里的页回 `undefined`，那个字串一路走进送给模型的
 * 文字，模型照抄，最后印在客户收 RM 500 的文件上：
 * 「网站 — 对应「**undefined** (website)」」。
 * ⚠️ 型别挡不住，因为 `PageKey = string`。现在名字从 MODULE_CATALOG 来，
 * 而这一条盯着它：**任何一个模块叫不出名字就红**。
 */
describe("规格书里每一个模块都叫得出名字", () => {
  for (const lang of ["zh", "en"] as const) {
    it(`${lang}：十八个模块没有一个是 undefined`, () => {
      const bad = MODULE_CATALOG.filter((m) => {
        const label = moduleLabelFor(m.key, lang);
        return !label || label === m.key || /undefined/i.test(label);
      });
      expect(bad.map((m) => m.key), "这几个模块印出来会是 key 或 undefined").toEqual([]);
    });
  }
});
