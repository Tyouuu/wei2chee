/* 一张详情、一张单据，四种画法都必须把**值**印出来。
 *
 * ── 抓到它的那一天 ────────────────────────────────────────────────────────
 * 老板 2026-09-03：`每一套都是要每一页放大来看 你复刻的仔细一点`。
 * 放大两倍看客户那一页右边那一格：标题「Mr Tan」，底下两行
 * **「Contact / notes」跟「Status」—— 两个栏名，一个值都没有**。
 * 同一个毛病在报价单那张「可以印的纸」上更贵：
 * Work quoted / Client / Quoted / Status，**一张没有任何数字的报价单**。
 *
 * 根因：`InfoRows` 把栏名放 `primary`、值放 `secondary`，
 * 而 `InfoRow` 的**紧凑**那一支只渲染 `primary`。
 * 六套里四套用紧凑，所以四套的详情跟单据都在讲一半。
 *
 * ⚠️ 缩图上看不出来 —— 它长得就像一份还没填的表格。
 *
 * ── 这条守卫的形状 ────────────────────────────────────────────────────────
 * 名单**从 `VARIANTS` 推出来**，不手写（[重点 27](../../docs/founder-points.md) 第 6 步）：
 * 以后有人加第五种画法，它自动被问同一个问题。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { InfoRows } from "@/design-system/components/trade-blocks";
import { VARIANTS } from "@/design-system/editor/variants";

const shapes = VARIANTS.InfoRows as { id: string; props: Record<string, unknown> }[];

describe("InfoRows 每一种画法都要印出值", () => {
  it("读得到四种以上 —— 读到零种的话下面会假装通过", () => {
    expect(shapes.length).toBeGreaterThanOrEqual(4);
  });

  it.each(shapes.map((s) => [s.id, s.props] as const))("%s 印得出值", (_id, props) => {
    const { container } = render(
      <InfoRows
        heading="Mr Tan"
        rows={[{ label: "Contact / notes", value: "Taman Desa · 013-2xx xxxx", icon: "person" }]}
        {...(props as { variant?: "comfortable" | "compact"; framed?: boolean })}
      />,
    );
    const text = container.textContent ?? "";
    expect(text, "栏名不见了").toContain("Contact / notes");
    expect(text, "值不见了 —— 那是这一格存在的理由").toContain("Taman Desa · 013-2xx xxxx");
  });

  it("没有栏名的那一行，值自己就是那句话", () => {
    const { container } = render(
      <InfoRows rows={[{ label: "", value: "Klang Valley", icon: "pin" }]} variant="compact" />,
    );
    expect(container.textContent).toContain("Klang Valley");
  });
});
