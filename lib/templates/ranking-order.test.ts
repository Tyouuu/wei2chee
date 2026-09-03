/* 一张写着「谁最值钱」的榜，第一名一定要是最大的那个数字。
 *
 * 老板 2026-09-03：`一页一页放大来优化`。
 * 放大两倍看台账的总览，左边那张榜印着
 *   1 Mr Tan   RM 48,500
 *   2 Mrs Lee  RM 22,800
 *   3 Mr Wong  RM 96,000   ← 最大的那个，排第三
 * **编号本身就是在宣称「已经排过了」**，而它当时只是照记录本来的顺序印。
 *
 * ⚠️ 这一类在缩图上看不出来 —— 四行字加四个金额，形状完全正常。
 */
import { describe, expect, it } from "vitest";
import { buildPageLayout } from "@/lib/templates/industry-template";
import { walkNodes, type PuckLayout } from "@/lib/portal/layout-ops";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";

const num = (s: unknown) => Number(String(s ?? "").replace(/[^0-9.]/g, ""));

describe("排行榜的顺序", () => {
  it("六套里至少有一套真的画了这张榜 —— 一套都没有的话下面会假装通过", () => {
    const found = STYLE_ORDER.some((reg) => {
      const l = buildPageLayout("dashboard", {}, "兴发", "en", [{ key: "dashboard" }], reg, null) as unknown as PuckLayout;
      return walkNodes(l.content).some((n) => n.type === "RankList");
    });
    expect(found).toBe(true);
  });

  it.each([...STYLE_ORDER])("%s 的榜是从大排到小", (reg) => {
    const l = buildPageLayout("dashboard", {}, "兴发", "en", [{ key: "dashboard" }], reg, null) as unknown as PuckLayout;
    for (const n of walkNodes(l.content)) {
      if (n.type !== "RankList") continue;
      const rows = (n.props.rows ?? []) as { name?: string; amount?: string }[];
      const nums = rows.map((r) => num(r.amount)).filter((x) => Number.isFinite(x) && x > 0);
      const sorted = [...nums].sort((a, b) => b - a);
      expect(
        nums,
        `${reg} 的榜：${rows.map((r) => `${r.name} ${r.amount}`).join(" · ")}`,
      ).toEqual(sorted);
    }
  });
});
