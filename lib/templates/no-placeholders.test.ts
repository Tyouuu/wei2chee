/* 产生出来的页面上，不准留着模子里的大括号。
 *
 * 老板 2026-09-03：`一页一页放大来优化`。
 * 放大两倍看收款那一页，图底下印着 **「Last {n} periods」** ——
 * 一个大括号，原样印在客户看得到的地方。
 *
 * 那几句话是**模子**（「最近 {n} 期」），用之前要把数字填进去。
 * 总览那一处从写出来就填了，收款那一处没有 —— 一个字的差别，
 * 而它在缩图上就是一行小灰字，看不出来。
 *
 * ⚠️ 这条守卫扫的是**整份版面的每一个字串**，不是某一个字段：
 * 下一个漏填的地方不会是同一个字段。
 */
import { describe, expect, it } from "vitest";
import { buildPageLayout } from "@/lib/templates/industry-template";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";
import { MODULE_KEYS } from "@/lib/portal/module-catalog";

/** 模子里的洞长这样：`{n}`、`{name}`。只认这一种，不认别的大括号
 *  （客户自己打的字里可以有大括号，那是他的字）。 */
const HOLE = /\{[a-z][a-z0-9_]*\}/i;

/** 名字以 `Template` 结尾的字段**本来就该带着洞** —— 它是模子，不是画出来的字
 *  （`TrendChart.captionTemplate` 是「最近 {n} 期」，组件按下开关才填数字）。
 *  除了这一种，其余每一个字串都是要给人读的。 */
const IS_TEMPLATE = /Template$/;

function stringsIn(v: unknown, out: string[] = [], key = ""): string[] {
  if (IS_TEMPLATE.test(key)) return out;
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out, key));
  else if (v && typeof v === "object")
    Object.entries(v).forEach(([k, x]) => stringsIn(x, out, k));
  return out;
}

describe("产生出来的页面不准留着模子的洞", () => {
  it("读得到页面 —— 读到零页的话下面会假装通过", () => {
    const l = buildPageLayout("dashboard", {}, "兴发", "en", [{ key: "dashboard" }], "ledger", null);
    expect(stringsIn(l).length).toBeGreaterThan(50);
  });

  it.each([...STYLE_ORDER])("%s 的每一页都填好了", (reg) => {
    const bad: string[] = [];
    for (const key of ["dashboard", ...MODULE_KEYS]) {
      for (const lang of ["en", "zh"] as const) {
        const l = buildPageLayout(key, { lang }, "兴发", lang, [{ key }], reg, null);
        for (const s of stringsIn(l)) {
          if (HOLE.test(s)) bad.push(`${reg}/${key}/${lang}：「${s}」`);
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
