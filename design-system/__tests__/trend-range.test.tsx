/* 图表卡头上那个开关，按下去要真的换。
 *
 * 老板 2026-09-03：`一页一页放大来优化 尽量复刻到完善`。
 * 四个参考页的图表卡头上都有一个控件（Tabler「Last 7 days」·
 * Studio Admin「Last 12 months」· TailAdmin 三段＋日期 · Ant「全部项目」），
 * 而我们的卡头从 8-26 起就是空的（[任务 24](../../docs/founder-tasks.md) 记着）。
 *
 * ⚠️ 补一个控件很容易，补一个**按了没反应**的控件更容易 ——
 * 而那正是这个仓库禁的东西（⌘K 那个假搜索框就是因为这个被砍的）。
 * 所以这条守卫只问一件事：**按下去，画出来的柱子有没有少，那句说明有没有跟着变。**
 */
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TrendChart } from "@/design-system/components/trend-chart";

const points = Array.from({ length: 12 }, (_, i) => ({ label: `M${i + 1}`, value: 1000 * (i + 1) }));

describe("图表卡头的「看多久」", () => {
  it("有模子、有两格以上，才画那个开关", () => {
    const { getByText } = render(
      <TrendChart title="Revenue" caption="Last 12 periods" captionTemplate="Last {n} periods"
        points={points} ranges={[6, 12]} />,
    );
    expect(getByText("6")).toBeTruthy();
    expect(getByText("12")).toBeTruthy();
  });

  it("按下去，说明真的跟着变", () => {
    const { getByText, container } = render(
      <TrendChart title="Revenue" caption="Last 12 periods" captionTemplate="Last {n} periods"
        points={points} ranges={[6, 12]} />,
    );
    expect(container.textContent).toContain("Last 12 periods");
    fireEvent.click(getByText("6"));
    expect(container.textContent, "按了没反应的控件就是死按钮").toContain("Last 6 periods");
    expect(container.textContent).not.toContain("Last 12 periods");
  });

  it("没有模子就不画 —— 换了期数而说明还写 12，那句话就是假的", () => {
    const { queryByText } = render(
      <TrendChart title="Revenue" caption="Last 12 periods" points={points} ranges={[6, 12]} />,
    );
    expect(queryByText("6")).toBeNull();
  });

  it("只有一格不算开关", () => {
    const { queryByText } = render(
      <TrendChart title="Revenue" captionTemplate="Last {n} periods" points={points} ranges={[12]} />,
    );
    expect(queryByText("12")).toBeNull();
  });

  it("比手上的资料还长的那一格，不算", () => {
    const { queryByText, getByText } = render(
      <TrendChart title="Revenue" captionTemplate="Last {n} periods"
        points={points.slice(0, 8)} ranges={[6, 12]} />,
    );
    /* 只剩 6 一格 → 整个不画 */
    expect(queryByText("12")).toBeNull();
    expect(getByText("Revenue")).toBeTruthy();
  });
});
