/* 拿掉页面标题的那一套，必须把主要动作放进侧栏。
 *
 * 老板 2026-09-04 挑了 arhamkhnz 当我们系统唯一的样子，然后说
 * `先复刻一点 我看看像不像`。
 *
 * ── 这条守卫在守哪一件 ────────────────────────────────────────────────────
 * 他们的总览 `page.tsx` 全档三行，**一个标题都没有** —— 打开就是四张卡。
 * 我们本来在每一页顶上放「Overview + 一句说明 + 一颗按钮」，所以尺子报
 * 「顺序：参考 数字→数字→数字，我们 其他→其他→图」。差的不是尺寸，
 * 是我们比他们多一整块。
 *
 * **而那一块不是装饰，它装着这门生意的主要动作**（「加一张报价单」）。
 * 拿掉标题、又没给那颗按钮一个新家 = 把产品唯一的主要动作删掉。
 * 这个仓库禁的正是这种事（画一颗按不动的按钮 · 说了没做），
 * 而「删掉一颗按得动的按钮」是同一件事的反面。
 *
 * 他们的新家是侧栏顶上那颗黑色实心的 Quick Create ——
 * `RailNav` 的 `action` 变体就是 2026-08-26 照它做的，注解白纸黑字写着，
 * **而在今天之前六套风格没有一套在用它**（第十七次「能力有、线没接」）。
 *
 * 所以这两件事绑在一起，而绑它们的是这个档案：
 *   **进 HEADLESS_DASHBOARD 的风格，RailNav 必须是 action。**
 *
 * ⚠️ 它守的是**形状不是那一次**：以后第二套风格照抄别的无标题参考，
 * 忘了改侧栏，这里一样会红。
 */
import { describe, expect, it } from "vitest";
import { HEADLESS_DASHBOARD } from "@/lib/templates/industry-template";
import { STYLE_BRIEFS } from "@/lib/portal/design-doc";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";

const prefer = (reg: string) =>
  (STYLE_BRIEFS as Record<string, { prefer?: Record<string, string> }>)[reg]?.prefer ?? {};

describe("没有页面标题的风格，主要动作要有家", () => {
  it("名单里的每一套都是真的风格 —— 一个打错的名字会让这条守卫静静地什么都不守", () => {
    for (const reg of HEADLESS_DASHBOARD) {
      expect(STYLE_ORDER, `HEADLESS_DASHBOARD 里的「${reg}」不是一套风格`).toContain(reg);
    }
  });

  it.each([...HEADLESS_DASHBOARD])("%s 的侧栏是 action", (reg) => {
    expect(
      prefer(reg).RailNav,
      `${reg} 的总览不画页面标题，而标题那一块装着主要动作。` +
        ` 侧栏必须是「action」（顶上那颗实心按钮）才有地方放它，现在是「${prefer(reg).RailNav}」。`,
    ).toBe("action");
  });

  /* 反过来也要守：一套用了 `action` 侧栏、却又画着页面标题的风格，
     等於**同一个主要动作在一页上出现两次**。参考页上它只有一个。 */
  it("反过来：用了 action 侧栏的，就不该再画页面标题", () => {
    for (const reg of STYLE_ORDER) {
      if (prefer(reg).RailNav !== "action") continue;
      expect(
        HEADLESS_DASHBOARD.has(reg),
        `${reg} 的侧栏顶上有一颗主要动作，而它的总览还画着页面标题 ——` +
          ` 同一个动作会在一页上出现两次。要嘛进 HEADLESS_DASHBOARD，要嘛换回别的侧栏。`,
      ).toBe(true);
    }
  });

  it("名单是短的 —— 六套里五套的参考页都有标题", () => {
    /* 上限不是洁癖：一个「大部分风格都没有标题」的产品，等於标题这一块
       从来没有存在的理由。真要走到那一步，该做的是把它整个拿掉，
       不是把这份名单加长到五套。 */
    expect(HEADLESS_DASHBOARD.size).toBeLessThanOrEqual(2);
  });
});
