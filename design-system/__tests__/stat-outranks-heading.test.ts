/* 每一套风格里，一个数字都要比页面标题大。
 *
 * ── 这条守卫在守哪一件 ──────────────────────────────────────────────────────
 * 老板 2026-09-02，看完六套重新上色之后：「为什么看起来还是不是很惊艳的
 * 就不像你所参考模版一样」。
 *
 * 同一支探针量他们跟我们：
 *
 *                    整页最大的字   那是什么          字级阶梯
 *   Studio Admin CRM     36px      「523 leads」        10 级
 *   我们                  21px      「Overview」          7 级
 *
 * **他们整页最大的东西是一个数字。我们最大的东西是「Overview」这个词** ——
 * 因为 `stat-row.tsx` 把数值画在 `--text-title` 上，而那正是这一页 h1 用的
 * 同一个 token。标题跟它introduce 的那个数字一样大，不叫克制，
 * 叫**没有焦点**，而那是「不惊艳」的大半个原因。
 *
 * `--text-hero`（34–46px）本来就在，但六套里**只有图纸**够得到它
 * （靠 StatRow 的 `lead` 形状）。梯子在，五套没有踏板。
 *
 * ⚠️ **这条守的是次序，不是数字。** 它不规定任何一套要多大 ——
 * 它只要求「数字 > 标题」这个次序在每一套里都成立，而且不准爬过 hero。
 * 密度不是被牺牲的东西：Ant Design Pro 比我们密，它的总销售额还是接近 30px。
 * 密度是行高，这是一个数字。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve("design-system/tokens");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".css"));

/** 一个 px token 的值。读的是**第一次**宣告 —— 后面的媒体查询不算基准。 */
function px(file: string, name: string): number | null {
  const css = readFileSync(resolve(DIR, file), "utf8");
  const m = css.match(new RegExp(`--${name}:\\s*([\\d.]+)px\\s*;`));
  return m ? Number(m[1]) : null;
}

describe("每一套风格的字级阶梯", () => {
  it("读得到六个档案 —— 读到零个的话下面全部会假装通过", () => {
    expect(FILES.length).toBeGreaterThan(3);
  });

  it.each(FILES)("%s: 有一个给数字用的档位", (file) => {
    expect(px(file, "text-stat"), `${file} 没有宣告 --text-stat`).not.toBeNull();
  });

  it.each(FILES)("%s: 数字比页面标题大", (file) => {
    const stat = px(file, "text-stat");
    const title = px(file, "text-title");
    if (stat === null || title === null) return;
    /* 大多少不管，但一定要真的大一档 —— 差 1px 在画面上等於没有差。 */
    expect(stat, `${file} --text-stat ${stat} vs --text-title ${title}`).toBeGreaterThanOrEqual(
      title + 4,
    );
  });

  it.each(FILES)("%s: 但没有爬过 hero", (file) => {
    const stat = px(file, "text-stat");
    const hero = px(file, "text-hero");
    if (stat === null || hero === null) return;
    /* hero 是给「一个大数字」那种版面留的（StatRow 的 lead 形状）。
       stat 爬过去，那一层就没有东西可以再大了。 */
    expect(stat, `${file} --text-stat ${stat} vs --text-hero ${hero}`).toBeLessThan(hero);
  });
});
