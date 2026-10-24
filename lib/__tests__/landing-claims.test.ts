/* 官网上的数字要跟代码里的真实数量对得上。
 *
 * 2026-08-31：老板挑完参考之后我去查数字，发现官网第一屏印着
 * **「17 registers」**，而 STYLE_ORDER 里只有 **6 套**。
 * 17 是 2026-08-26 砍风格之前的数字（任务 17：17 → 14，后来再收到 6），
 * 砍的时候没有人回头改这一行。
 *
 * ⚠️ 这跟同一天抓到的过期定价是同一个形状：**一个事实住在两个地方，
 * 只有走得到的那个被更新。** 而这一个更糟 —— 它是一个**关於我们自己的宣称**，
 * 印在陌生人第一眼看到的地方。[任务 19](../../docs/founder-tasks.md) 立过规矩：
 * 假的东西不上线。
 *
 * 这支测试守的是：官网上那几个数字不准跟代码漂开。
 *
 * ── 2026-10-24 改了一半（founder-tasks 任务429，重点38 定位收窄）────────
 * `proofA`/`proofB` 原本讲的是「自选风格、自选版段」那套路线——6 套风格、
 * 219 个版段，每一个都换得掉。那条路线停了（不再给客户选风格），这两个
 * 数字也跟着换了意思：`proofA` 现在是沙龙产品真的页数（14，对
 * `lib/portal/salon-nav.ts`）、`proofB` 现在是「1 个价钱，不按人头不按
 * 门店收」（查过那天的竞品研究，不是一个数得出来的档案数）。
 *
 * **`proofA` 的测试改成对新的真数**（页数），不是删掉——它要守的事情
 * 没变，只是真数换了来源。**`proofB` 不再是个「数档案」的测试**：它现在
 * 是一句定价宣称，不是一个可以用 `readdirSync` 验的数字，所以这里不再
 * 假装能验——那种时候造一个会一直绿的假检查，比没有检查更糟。
 *
 * ⚠️ 「14 个真页面」量的是 `salon-preview/` 底下真的路由数（14），
 * 不是侧栏的行数（`SALON_NAV` 只有 13 行——`packages-and-prepaid`
 * 那一行自己桥接了套票跟会员**两条路由**，一行对两页，第一版拿侧栏行数
 * 当真数，算出 13，少算了一个——读目录才是对的量法，这里改用它。
 *
 * `drawing.figure`（第二张线稿的大数字）**原本被钉死要等於 proofB**——
 * 这个钉子现在跟 proofB 的新意思对不上了（"sections to build from" 跟
 * "1 个价钱" 不是同一件事）。`components/blocks` 这个数字本身没有变、
 * 没有变假——变的只是「它该不该继续等於 proofB」。所以这里把它拆开，
 * 独立对回 `components/blocks` 真的档案数，不再绑死 proofB。
 */
import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

const findProof = (o: unknown): Record<string, string> | null => {
  if (o && typeof o === "object") {
    const r = o as Record<string, unknown>;
    if (typeof r.proofA === "string") return r as Record<string, string>;
    for (const v of Object.values(r)) {
      const hit = findProof(v);
      if (hit) return hit;
    }
  }
  return null;
};

describe("官网上的数字是真的", () => {
  it("proofA = 沙龙产品真的页数（salon-preview/ 底下真的路由数）", () => {
    /* 侧栏行数不是对的量法（见档头：一行可能桥两条路由）。数的是真的
       `page.tsx` 路由，排掉 setup（交付进度，不是一个业务功能）跟
       tools（通往旧版页面的入口，不是沙龙产品自己的一页）。 */
    const dir = resolve("app/[locale]/salon-preview");
    const real = readdirSync(dir, { withFileTypes: true }).filter(
      (e) =>
        e.isDirectory() &&
        !["setup", "tools"].includes(e.name) &&
        existsSync(resolve(dir, e.name, "page.tsx")),
    ).length;
    expect(real).toBeGreaterThan(0);
    for (const [lang, msgs] of [["en", en], ["zh", zh]] as const) {
      const proof = findProof(msgs)!;
      expect(Number(proof.proofA), `${lang} 的 proofA`).toBe(real);
    }
  });

  it("drawing.figure（第二张线稿）= components/blocks 里真的有几个档", () => {
    /* 用 import.meta.glob 之外最简单可靠的办法：读目录。这个数字本身没有
       换过意思——还是「生成器内部用几个版段拼页面」，只是不再拿来等於
       proofB（proofB 现在讲的是另一件事，见本档头）。 */
    const real = readdirSync(resolve("components/blocks")).filter((f) => f.endsWith(".tsx")).length;
    expect(real).toBeGreaterThan(0);
    const ns = (m: typeof en, k: string) => (m as unknown as Record<string, Record<string, string>>)[k];
    for (const [lang, msgs] of [["en", en], ["zh", zh]] as const) {
      expect(Number(ns(msgs, "drawing").figure), `${lang} 的 drawing.figure`).toBe(real);
    }
  });
});

/* 2026-09-01：三张线稿各多了一个大数字（模版每一段都有一个 —— 400,000 伏 /
 * 120,000 / 1）。**大数字最容易变成一个编出来的宣称**，所以这几个不准
 * 自己发明：它们必须原样等於页面上早就有守卫盯着的那几个数。
 * 这就是把「假的不上线」从一句规矩变成一条会红的检查。
 *
 * ⚠️ 「02 的数字 = proofB」那一条 2026-10-24 拿掉了——proofB 换了意思
 * 之后，drawing.figure 不该再被钉去等於它（见本档头）；drawing.figure
 * 自己真不真，上面那组测试已经守住了。 */
describe("线稿上的大数字不准自己发明", () => {
  const ns = (m: typeof en, k: string) => (m as unknown as Record<string, Record<string, string>>)[k];

  it("01 的数字 = 第一屏那个「2 分钟」", () => {
    for (const [lang, msgs] of [["en", en], ["zh", zh]] as const) {
      expect(ns(msgs, "draw1").figure, `${lang}`).toBe(findProof(msgs)!.proofC);
    }
  });

  it("03 的数字 = 收据上那个规格书价钱", () => {
    for (const [lang, msgs] of [["en", en], ["zh", zh]] as const) {
      expect(ns(msgs, "draw3").figure, `${lang}`).toBe(ns(msgs, "receipt").specV);
    }
  });
});
