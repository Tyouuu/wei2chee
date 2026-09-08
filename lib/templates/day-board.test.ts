/* 一间沙龙打开预约那一页，看到的是一天摊开、一个人一栏。
 *
 * ── 为什么这一份要存在 ──────────────────────────────────────────────────
 *
 * 那根轴（`DaySchedule` 的 `columns`）2026-09-08 做好了，而**画面上一次都
 * 没有出现过** —— 它只吃 props，而没有一个地方送过它。一根做好了没有人
 * 送的轴，跟一根不存在的轴，在报告里长得一模一样。
 *
 * ── 它守的两件，两件都是量出来的判断，不是偏好 ──────────────────────────
 *
 *   1. **分栏是资料决定的，不是风格决定的。** 有派人才分得了栏；一行都没有
 *      派的时候那个属性根本不送，那一块一个像素都不会变（一间一个人的店、
 *      一张补习课表本来就没有「谁做的」这件事）。
 *
 *   2. 🔴 **分栏的时候不准再印一次那个人。** 示例那一栏是「今天 2:00 PM · Amy」
 *      —— 时间已经是这一块坐的位置，人已经是它那一栏的抬头，再印一次就是
 *      同一件事在一块小卡片上讲三遍。
 */
import { describe, expect, it } from "vitest";
import { buildPageLayout } from "./industry-template";
import { walkNodes } from "@/lib/portal/layout-ops";
import type { BusinessContext } from "./industry-template";

type Node = { type: string; props: Record<string, unknown> };
type DayRow = { time?: string; title?: string; description?: string; who?: string };

const ctxFor = (slug: string): BusinessContext => ({
  industry: {
    slug,
    name_zh: slug,
    labels: { customer: "客户", order: "项目", staff: "师傅" },
    default_workflow: [],
    suggested_modules: [],
  },
});

function dayBlock(slug: string): Node | undefined {
  const tree = buildPageLayout("bookings", ctxFor(slug)) as unknown as { content: Node[] };
  const all = walkNodes(tree.content as never) as unknown as Node[];
  return all.find((n) => n.type === "DaySchedule");
}

describe("预约那一页的一天", () => {
  it("沙龙拿到的是一天摊开、一个人一栏", () => {
    const day = dayBlock("beauty");
    expect(day, "预约那一页要有一块 DaySchedule").toBeTruthy();
    expect(day!.props.shape, "有派人就该分栏").toBe("columns");
  });

  it("那几笔真的带着谁做的，而且不只一个人", () => {
    const rows = (dayBlock("beauty")!.props.rows ?? []) as DayRow[];
    const people = new Set(rows.map((r) => r.who).filter(Boolean));
    /* 一个人分不了栏 —— 那是「几点还排得下」答不出来的那一种。 */
    expect(people.size, `谁做的：${[...people].join(" · ")}`).toBeGreaterThanOrEqual(2);
  });

  it("🔴 分栏的时候不再把那个人印进说明里", () => {
    const rows = (dayBlock("beauty")!.props.rows ?? []) as DayRow[];
    for (const r of rows) {
      for (const who of rows.map((x) => x.who).filter(Boolean) as string[]) {
        expect(
          (r.description ?? "").includes(who),
          `「${r.title}」的说明里又印了一次「${who}」：${r.description}`,
        ).toBe(false);
      }
      /* 时刻同理 —— 那一块坐的位置就是时刻。 */
      expect(
        /\d{1,2}:\d{2}/.test(r.description ?? ""),
        `「${r.title}」的说明里又印了一次时刻：${r.description}`,
      ).toBe(false);
    }
  });

  it("没有人派的行业，那个属性根本不送 —— 旧的画法一个像素都不变", () => {
    const day = dayBlock("education");
    expect(day, "补习那一页也有一块 DaySchedule").toBeTruthy();
    expect(day!.props.shape, "一行都没有派人，就不该分栏").toBeUndefined();
    const rows = (day!.props.rows ?? []) as DayRow[];
    expect(rows.every((r) => !r.who)).toBe(true);
    /* 而它那几笔照旧带着「什么时候 · 谁」那一句 —— 那是它唯一读得到时间的地方。 */
    expect(rows.some((r) => (r.description ?? "").trim().length > 0)).toBe(true);
  });
});
