/* 一个比较的字，里面一定要有比较。
 *
 * 老板 2026-09-03：`每一套都是要每一页放大来看`。
 * 放大两倍看收款那一页：**「RM 71,300　vs last month」—— 中间什么都没有。**
 *
 * ⚠️ 这个仓库 2026-08-26 修过一次同一句话（那次在总览），
 * 修的是**那一处**，不是那个形状。於是收款 · 开销 · 佣金 · 对帐 · 报表
 * 每一页又长回来 —— 因为 `heroNode` 跟 `payments-hero` 都只传了后半句。
 *
 * 所以这一次修在**画的地方**：那句话是那个数字的说明，数字不在，说明闭嘴。
 * 这条守卫盯的就是那个开关。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HeroCard } from "@/design-system/components/hero-card";

const base = { label: "Confirmed jobs this month", value: "RM 71,300", href: "/en/portal/payments" };

describe("HeroCard 的「跟上个月比」", () => {
  it("有涨跌的时候，那句话要在", () => {
    const { container } = render(<HeroCard {...base} chg={13.2} chgSuffix="vs last month" />);
    expect(container.textContent).toContain("vs last month");
    expect(container.textContent).toContain("13.2");
  });

  it("没有涨跌的时候，那句话不准出现", () => {
    const { container } = render(<HeroCard {...base} chgSuffix="vs last month" />);
    expect(container.textContent).toContain("RM 71,300");
    expect(container.textContent, "一个比较的字，里面没有比较").not.toContain("vs last month");
  });

  it("涨跌是 0 也算有 —— 「持平」是一个答案，不是没有答案", () => {
    const { container } = render(<HeroCard {...base} chg={0} chgSuffix="vs last month" />);
    expect(container.textContent).toContain("vs last month");
  });
});
