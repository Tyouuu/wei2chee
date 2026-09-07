import { describe, expect, it } from "vitest";
import { parseBrackets, permilleRows } from "./parse-brackets";

/**
 * 那份贴上去的费率表，读得对不对。
 *
 * 🔴 **这一支守的是钱。** 一格读错一分，`statutory_lookup` 照样回一个
 * 看起来完全正常的数字，而那笔钱是老板替他的工人缴出去的。
 * 所以每一条都拿**官方那张表真的长的样子**来问，不是拿我方便的样子。
 */

/** KWSP 第三附表那几行长的样子（RM4,900.01–5,000.00 那一格是真的）。 */
const KWSP = [
  "Wage from\tWage to\tEmployee\tEmployer",
  "4,900.01\t5,000.00\t550.00\t600.00",
  "5,000.01\t5,100.00\t561.00\t612.00",
  "20,000.01\t\t11%\t12%",
].join("\n");

describe("贴一张官方的费率表进来", () => {
  it("四栏、千分位逗号、表尾那一行的百分比，一次读完", () => {
    const r = parseBrackets(KWSP);
    if (!r.ok) throw new Error(`should have parsed: ${r.why}`);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toEqual({
      wage_from_cents: 490001,
      wage_to_cents: 500000,
      employee_cents: 55000,
      employer_cents: 60000,
    });
    /* 表尾：没有上限，而且是千分比不是金额。 */
    expect(r.rows[2]).toEqual({
      wage_from_cents: 2000001,
      wage_to_cents: null,
      employee_permille: 110,
      employer_permille: 120,
    });
    expect(permilleRows(r.rows)).toBe(1);
  });

  it("🔴 跳过了开头那一行标题，而且讲出来", () => {
    const r = parseBrackets(KWSP);
    if (!r.ok) throw new Error("should have parsed");
    /* 静静吃掉一行，正是这一整支在防的东西。 */
    expect(r.skippedHeading).toBe("Wage from\tWage to\tEmployee\tEmployer");
  });

  it("官方那一格是 490001 分，一分不差", () => {
    const r = parseBrackets("4,900.01\t4,900.05\t0.07\t0.08");
    if (!r.ok) throw new Error("should have parsed");
    expect(r.rows[0].wage_from_cents).toBe(490001);
    expect(r.rows[0].wage_to_cents).toBe(490005);
    expect(r.rows[0].employee_cents).toBe(7);
    expect(r.rows[0].employer_cents).toBe(8);
  });

  /* ⚠️ 上面那一条本来叫「钱不碰浮点数」，而**它证明不了那件事**：
     在这张表活的那个范围里（≤ RM20,000），`Math.round(x * 100)` 跟整数
     切字串给的是同一个答案。改掉那个名字，然后把真的判得出来的那一条
     写在下面 —— 一条读起来像在保护什么、而什么都没保护的测试，
     比没有那一条糟。 */
  it("🔴 多出来的那一位是切掉的，不是四舍五入", () => {
    /* 一张官方的表不会有第三位小数（20260904210000 的档头）。真的来了一张，
       `Math.round(0.999 * 100)` 会**替他进位成一分钱**，而那是一个我们
       替法律做的决定。切掉的那一分他看得出来（0.99），进上去的看不出来。 */
    const r = parseBrackets("0.00	10.00	0.999	0.999");
    if (!r.ok) throw new Error("should have parsed");
    expect(r.rows[0].employee_cents).toBe(99);
  });

  it("11.5% 是千分比 115，不是 11.5", () => {
    const r = parseBrackets("20,000.01\t\t11.5%\t12%");
    if (!r.ok) throw new Error("should have parsed");
    expect(r.rows[0].employee_permille).toBe(115);
    expect(r.rows[0].employer_permille).toBe(120);
  });

  it("从 PDF 复制出来的（单一空白、带 RM）也读得了", () => {
    const r = parseBrackets("RM 4,900.01 RM 5,000.00 RM 550.00 RM 600.00");
    if (!r.ok) throw new Error("should have parsed");
    expect(r.rows[0].employee_cents).toBe(55000);
  });

  it("另存成逗号分隔的也读得了", () => {
    const r = parseBrackets("100.00,200.00,11.00,12.00");
    if (!r.ok) throw new Error("should have parsed");
    expect(r.rows[0].wage_to_cents).toBe(20000);
  });

  it("🔴 一格是百分比而另一格不是 → 整份拒绝，讲得出第几行", () => {
    const r = parseBrackets("100.00\t200.00\t11.00\t12%");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("should have refused");
    expect(r.why).toBe("mixed");
    expect(r.line).toBe(1);
  });

  it("🔴 读不懂的那一行不是跳过，是整份拒绝 —— 而且是第几行", () => {
    const r = parseBrackets(
      ["100.00\t200.00\t1.00\t2.00", "200.01\t300.00\tabc\t2.00"].join("\n"),
    );
    if (r.ok) throw new Error("should have refused");
    expect(r.why).toBe("number");
    /* 🔴 第 2 行，不是第 1 行 —— 他要去改的是那一行。 */
    expect(r.line).toBe(2);
    if (r.why !== "number") throw new Error("wrong shape");
    expect(r.cell).toBe("abc");
  });

  it("不是四格的那一行也拒绝", () => {
    const r = parseBrackets("100.00\t200.00\t1.00");
    if (r.ok) throw new Error("should have refused");
    expect(r.why).toBe("columns");
  });

  it("「到」比「从」小就拒绝", () => {
    const r = parseBrackets("500.00\t100.00\t1.00\t2.00");
    if (r.ok) throw new Error("should have refused");
    expect(r.why).toBe("span");
  });

  it("一行都没有就拒绝，不回一份空的表", () => {
    /* 🔴 一份零格的表**装得进去**，而它到发薪那一天才会被拒绝
       （「the loaded table is incomplete」）。在这里拒绝便宜得多。 */
    const r = parseBrackets("   \n\n  ");
    if (r.ok) throw new Error("should have refused");
    expect(r.why).toBe("empty");
  });

  it("只有一行标题也算一行都没有", () => {
    const r = parseBrackets("Wage from\tWage to\tEmployee\tEmployer");
    if (r.ok) throw new Error("should have refused");
    expect(r.why).toBe("empty");
  });
});
