/**
 * 「图 + 结论」那一种 —— 出处 arhamkhnz 的 `crm`（Qualified Lead Flow）。
 *
 * ⚠️ 这一种 2026-09-02 就做出来了，而**到 09-05 为止一页都没有用过它** ——
 * 所以下面两条守的东西，是它做出来那天就带着、而没有人看过的：
 *
 *   ① 它掉进最后那一支 `AreaChart` —— 页面上写着「一根就是一个月」，
 *      画出来是一条面积。**说明跟画面互相打架。**
 *   ② 结论那一栏重印了卡头那句说明 —— 同一张卡上同一句话两次。
 *
 * 两条都是看图看到的，不是任何一条断言抓到的（[重点 7l]）。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TrendChart, drawsBars } from "../components/trend-chart";

const POINTS = [
  { label: "Apr", value: 1000 },
  { label: "May", value: 2000 },
  { label: "Jun", value: 3000 },
];

describe("TrendChart 的「图 + 结论」", () => {
  it("🔴 画的是柱状，不是面积 —— 说明里写着「一根」", () => {
    /* ⚠️ **这一条不看 DOM，而那不是偷懒。** recharts 在 jsdom 里量到 0×0，
       整张图一个节点都不画 —— 第一版断言「没有 recharts-area」，
       而**把 `sum` 改回面积之后它照样绿**。量的是空气。
       组件跟这里问的是同一支 `drawsBars`。 */
    expect(drawsBars("sum"), "sum 掉回面积图了").toBe(true);
    expect(drawsBars("bar")).toBe(true);
    expect(drawsBars("area")).toBe(false);
    expect(drawsBars("line")).toBe(false);
  });

  it("🔴 结论那一栏不重印卡头那句说明", () => {
    const caption = "Each bar is one month.";
    const { container } = render(
      <TrendChart title="Turnover" caption={caption} kind="sum" unit="RM" points={POINTS} />,
    );
    const text = container.textContent ?? "";
    const seen = text.split(caption).length - 1;
    expect(seen, `同一张卡上出现了 ${seen} 次`).toBe(1);
  });

  it("给了 summary 才画那一句，而且它跟 caption 是两句话", () => {
    const { container } = render(
      <TrendChart
        title="Turnover"
        caption="Each bar is one month."
        summary="Turnover added up over the last six months."
        kind="sum"
        unit="RM"
        points={POINTS}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Turnover added up over the last six months.");
    expect(text.split("Each bar is one month.").length - 1).toBe(1);
  });

  it("总数是那几个点自己加出来的，没有新资料", () => {
    const { container } = render(
      <TrendChart title="Turnover" kind="sum" unit="RM" points={POINTS} />,
    );
    /* 1000 + 2000 + 3000 */
    expect(container.textContent).toContain("6,000");
    /* 最后一期，跟它占全部的几成 */
    expect(container.textContent).toContain("3,000");
    expect(container.textContent).toContain("50%");
  });

  it("另外三种不画结论那一栏", () => {
    for (const kind of ["bar", "line", "area"] as const) {
      const { container } = render(
        <TrendChart title="Turnover" kind={kind} unit="RM" points={POINTS} />,
      );
      expect(container.textContent, `${kind} 画了结论`).not.toContain("6,000");
    }
  });
});
