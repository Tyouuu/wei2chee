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

/**
 * 每一个拿**我们自己的号码**去组 wa.me 的地方。
 *
 * 🔴 这份名单本来只有官网那两个档案，於是**系统里面三个地方从来没有被
 * 点名过**：他自己首页右上角那一颗 · 规格书那一页 · 「交给我们建」。
 * 老板 2026-09-07 自己去点，三颗都打给 `wa.me/60123456789`。
 * 「登入后的 portal 不在里面」那句判断是错的 —— 一颗打不通的按钮，
 * 在他自己的系统里跟在官网上一样糟，而且那三颗正好是**付了钱的客户**在按的。
 *
 * ⚠️ 客户自己的号码不算（询价 · 车主 · 名册）——
 * 那几支组的是**他客人的**号码，不是我们的。
 */
const PUBLIC_SURFACES = [
  "components/site-footer.tsx",
  "components/sections/conversion-cta.tsx",
  "app/[locale]/legal/[doc]/page.tsx",
  "app/[locale]/portal/home-client.tsx",
  "app/[locale]/portal/(app)/spec/page.tsx",
  "app/[locale]/portal/[pageKey]/editor-client.tsx",
];

describe("公开页面上没有打不通的联络按钮", () => {
  for (const f of PUBLIC_SURFACES) {
    it(`${f} 用 wa.me 之前有先问号码是不是占位符`, () => {
      const src = readFileSync(resolve(f), "utf8");
      /* 走 `whatsappHref()` 的也算问过 —— 那一支自己就问了。 */
      if (!/wa\.me|whatsappHref/.test(src)) return;
      expect(
        src.includes("WHATSAPP_IS_PLACEHOLDER") || src.includes("whatsappHref"),
        `${f} 直接拿 WHATSAPP_NUMBER 去组 wa.me，没有问过它是不是还是那个占位符`,
      ).toBe(true);
    });
  }

  it("占位符那个号码没有被写死在任何公开页面里", () => {
    for (const f of PUBLIC_SURFACES) {
      /* ⚠️ **先把注解拿掉**。这条第一次跑就把一段**记录这个 bug 的注解**
         当成了 bug 本身 —— 而一条不允许人把理由写下来的守卫，
         会逗下一个人去把理由删掉。这个仓库同一件事栽过第二次。 */
      const src = readFileSync(resolve(f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      /* ⚠️ 而那一句里的 `[^:]` 不是装饰：一条网址里的 `https://` 自己就带着两条斜线,
         而第一版把它当成注解开头，于是把 `wa.me/60123456789` 整段删掉了 —
         故意弄坏那一次它照样绿，而那次绿是假的。 */
      expect(/60123456789/.test(src), `${f} 里写死了占位号码`).toBe(false);
    }
  });
});
