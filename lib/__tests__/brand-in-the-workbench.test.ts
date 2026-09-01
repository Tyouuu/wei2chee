/* 我们自己的平台要穿我们自己的品牌色。
 *
 * ── 这条守卫在守哪一件 ──────────────────────────────────────────────────────
 * 老板 2026-09-01：`我要更有设计感 一点 不是单纯的好坏 我要的是提升` ·
 * `然后我们也有自己的品牌色`。
 *
 * 量出来的事实：品牌青 `#00beb7` 活在**官网的一条带上**（`.band-cyan`），
 * 而老板每天开的那个工作台**一滴都没有** —— 它的强调色是近白，
 * 状态色是 jade / brass / clay / slate。
 * 也就是说：**卖东西那一页有品牌，做事那一页没有。**
 *
 * ⚠️ 这不是把 `chrome.module.css` 里那段「FORMAE HAS NO ACCENT」推翻。
 * 那段论证的**前提**是「平台没有自己的颜色，它借过 Blueprint 两次」——
 * 而那个前提 9-01 不成立了。它论证里仍然成立的那一半照留：
 * **主要按钮还是墨色**，因为一颗青色的按钮会跟客户自己系统的预览抢眼睛。
 *
 * 所以这条守的是三件，不多不少：
 *   ① 品牌色两边都宣告了（深色的工作台 · 印出来的那一份）
 *   ② 侧栏「你在哪一页」那条线跟着品牌色走，不是又写死一个值
 *   ③ 主要按钮**没有**变成青的 —— 守的是那半个仍然成立的论证
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("app/[locale]/portal/chrome.module.css"), "utf8");

/** WCAG 对比度。写在这里而不是 import —— 一个守卫自己算得出来的东西，
 *  不该依赖另一个会被改掉的档案。 */
function contrast(a: string, b: string) {
  const lum = (h: string) => {
    const v = h.replace("#", "");
    const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(ch[0]) + 0.7152 * f(ch[1]) + 0.0722 * f(ch[2]);
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** 一个 token 在这个档案里宣告的**所有**值（深色一份、印出来一份）。 */
const declared = (name: string) =>
  [...css.matchAll(new RegExp(`--${name}:\\s*([^;]+);`, "g"))].map((m) => m[1].trim());

describe("工作台穿我们自己的品牌色", () => {
  it("品牌色两边都宣告了 —— 深色的工作台，跟印出来的那一份", () => {
    const brand = declared("color-brand");
    expect(brand, "--color-brand 少宣告了一边").toHaveLength(2);
    expect(brand[0]).toBe("#00beb7");
  });

  it("侧栏「你在哪一页」跟着品牌色走，不是另外写死一个值", () => {
    const nav = declared("color-nav-accent");
    expect(nav[0], "--color-nav-accent 又变回一个写死的颜色了").toBe("var(--color-brand)");
  });

  it("键盘走到哪里也跟着品牌色", () => {
    expect(declared("ring")[0]).toBe("var(--color-brand)");
  });

  /* ⚠️ 这一条守的是**没有做**的那件事，而它跟上面三条一样重要。
     一颗青色的主要按钮会跟客户自己系统的预览抢眼睛 ——
     `chrome.module.css` 那段论证里仍然成立的那一半。 */
  it("主要按钮还是墨色，青色不准爬进去", () => {
    const primary = declared("color-primary");
    expect(primary[0]).toBe("#f0f2f4");
    for (const v of primary) expect(v).not.toContain("brand");
  });

  it("深色工作台上读得到 —— 侧栏底跟工作区底都要过 AA", () => {
    /* 数字是算出来的。⚠️ 我第一版凭印象在注解里写 9.4:1，算完是 7.95。 */
    expect(contrast("#00beb7", "#10141c")).toBeGreaterThan(4.5); // 侧栏 7.95
    expect(contrast("#00beb7", "#0b0d13")).toBeGreaterThan(4.5); // 工作区 8.37
  });

  it("印出来那一份换一个更深的青 —— #00beb7 压白纸只有 1.87:1", () => {
    expect(contrast("#00beb7", "#ffffff")).toBeLessThan(3);
    expect(contrast(declared("color-brand")[1], "#ffffff")).toBeGreaterThan(4.5); // 5.99
  });
});
