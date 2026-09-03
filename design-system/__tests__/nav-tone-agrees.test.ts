/* 一套风格的侧栏颜色，不可以被它的外壳偷偷盖掉。
 *
 * 老板 2026-09-03：`我能明显看出不一样啊 背景的颜色 特点没复刻啊`。
 *
 * ── 这条守卫在守哪一件 ────────────────────────────────────────────────────
 * 那一天我把六套的 `--color-nav-bg` 全部改成白，跑完尺子、看完颜色的数字，
 * 六套都在门槛内。**而台账画出来的侧栏还是深蓝。**
 *
 * 原因：`SystemShell` 的 `deep` 那一种会把侧栏改用 `--color-paper` 上色
 * （见 system-shell.tsx 约 170 行），而台账的 `--color-paper` 是 `#14273d`。
 * 所以 token 是白的、画面是深的，两个都「对」，只是不是同一件事在决定。
 *
 * 后果量得出来：有颜色的面积 0.4% → **13.1%**，而它一直挂在那里，
 * 直到老板指着图讲「背景的颜色明显不一样」。
 *
 * **一个被别处覆盖掉的 token，跟一个根本没改的 token，在档案里长得一模一样。**
 * 所以这一条不问「颜色好不好看」，它只问一句：
 * **这一套的侧栏 token 是浅的，那它的外壳就不可以是深色那一种。**
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STYLE_BRIEFS } from "@/lib/portal/design-doc";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";

/** 一个 hex 有多亮。只用来分「浅」跟「深」，不做别的。 */
function lum(hex: string): number | null {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function token(register: string, name: string): string | null {
  const css = readFileSync(resolve(`design-system/tokens/${register}.css`), "utf8");
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  return m ? m[1] : null;
}

describe("外壳的深浅要跟侧栏的颜色讲同一句话", () => {
  it("读得到六套 —— 读到零套的话下面会假装通过", () => {
    expect(STYLE_ORDER.length).toBeGreaterThan(3);
  });

  it.each([...STYLE_ORDER])("%s 的外壳没有偷偷把浅侧栏画成深的", (reg) => {
    const shell = (STYLE_BRIEFS as Record<string, { prefer?: Record<string, string> }>)[reg]
      ?.prefer?.SystemShell;
    if (!shell) return;
    const bg = token(reg, "--color-nav-bg");
    const l = bg ? lum(bg) : null;
    if (l === null) return;
    /* 亮过 200 就算浅色侧栏。`deep` 那一种会拿 `--color-paper` 盖掉它，
       而每一套的 paper 都是近黑 —— 那等於把刚设好的白丢掉。 */
    if (l > 200) {
      expect(
        shell.includes("deep"),
        `${reg} 的侧栏 token 是浅的（${bg}），而外壳是「${shell}」——` +
          ` deep 会改用 --color-paper 上色，画出来是深的。两句话对不上。`,
      ).toBe(false);
    }
  });
});
