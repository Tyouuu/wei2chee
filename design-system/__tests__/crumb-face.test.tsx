/* 同一屏上不准有两颗头像。
 *
 * 老板 2026-09-03：`每一套都是要每一页放大来看 你复刻的仔细一点`。
 * 放大两倍看中台的客户那一页，右上角一颗「陈」在顶栏里，
 * **另一颗「陈老」孤零零挂在面包屑那一行的右边** —— 同一个人，同一屏，两次。
 * Tabler 自己那一页只有一颗，而且带着名字跟职称。
 *
 * ── 为什么它躲了那么久 ────────────────────────────────────────────────────
 * `SystemBar` 本来是问 `NavAxisContext`「侧栏在上面还是旁边」，
 * 而 `SystemShell` 只把那个 Provider 包在**侧栏那一段**上 ——
 * 这一条画在它外面，所以永远读到预设的 `"side"`。
 * **一个读不到的 context，跟一个没有写过的判断，在档案里长得一模一样。**
 *
 * 所以这条守卫不问 context，它问**画出来的结果**：
 * 顶栏那几套的面包屑行不准有头像，侧栏那几套一定要有。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SystemBar } from "@/design-system/components/system-bar";

describe("面包屑那一行的头像", () => {
  it("侧栏在旁边的时候要有 —— 侧栏底下那一颗常常掉到折线以下", () => {
    const { container } = render(<SystemBar crumbs={["Day to day", "Clients"]} monogram="陈老" axis="side" />);
    expect(container.textContent).toContain("陈老");
  });

  it("侧栏在上面的时候不准有 —— 顶栏自己右上角就有一颗", () => {
    const { container } = render(<SystemBar crumbs={["Day to day", "Clients"]} monogram="陈老" axis="top" />);
    expect(container.textContent).not.toContain("陈老");
    /* 面包屑本身还在 —— 挡掉的是头像，不是整条。 */
    expect(container.textContent).toContain("Clients");
  });

  it("没有面包屑也没有头像的时候，整条不画", () => {
    const { container } = render(<SystemBar axis="top" monogram="陈老" />);
    expect(container.innerHTML).toBe("");
  });
});
