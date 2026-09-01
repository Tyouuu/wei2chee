/* 广告进来的那一页上，不准有一颗按下去打给不存在的号码的按钮。
 *
 * ── 这条守卫在守哪一个真错 ──────────────────────────────────────────────────
 * `WHATSAPP_IS_PLACEHOLDER` 在 lib/brand.ts 里从写出来那天就有，注解还写着
 * 「lets a surface choose to say nothing rather than offer a link that cannot
 * work」——**而没有任何一个 surface 用过它**。这个仓库第十六次
 * 「能力有、线没接」，接口就落在**陌生人按下去的最后一颗按钮**上：
 * `wa.me/60123456789`。[任务 11](../../docs/founder-tasks.md)。
 *
 * 老板 2026-09-01：「官网很重要 打广告进来 就是官网了」。
 * 一个按下去打不通的联络按钮，比没有按钮更糟 —— 按的人会认定这家公司不是真的。
 *
 * ⚠️ 这条查的是**代码有没有问过那个旗标**，不是查渲染结果 ——
 * 旗标在建置时就定了，测试环境永远是占位符，所以渲染出来永远是好的那一支。
 * 会坏的是**有人新加一个 surface 而忘了问**，这条就是守那个。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 陌生人走得到的地方。登入后的 portal 不在里面。 */
const PUBLIC_SURFACES = [
  "components/site-footer.tsx",
  "components/sections/conversion-cta.tsx",
];

describe("公开页面上没有打不通的联络按钮", () => {
  for (const f of PUBLIC_SURFACES) {
    it(`${f} 用 wa.me 之前有先问号码是不是占位符`, () => {
      const src = readFileSync(resolve(f), "utf8");
      if (!/wa\.me/.test(src)) return; // 没有用 WhatsApp 就没事
      expect(
        src.includes("WHATSAPP_IS_PLACEHOLDER"),
        `${f} 直接拿 WHATSAPP_NUMBER 去组 wa.me，没有问过它是不是还是那个占位符`,
      ).toBe(true);
    });
  }

  it("占位符那个号码没有被写死在任何公开页面里", () => {
    for (const f of PUBLIC_SURFACES) {
      const src = readFileSync(resolve(f), "utf8");
      expect(/60123456789/.test(src), `${f} 里写死了占位号码`).toBe(false);
    }
  });
});
