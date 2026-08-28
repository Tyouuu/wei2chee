import { describe, expect, it } from "vitest";

import { BLOCK_TONES, toneLayers } from "../editor/block-tone";

/* ── 刷了地，就要交代字 ──────────────────────────────────────────────────────
 *
 * 这个洞在这个仓库开过两次，两次都是同一个形状：一支 tone 设了背景，没设前景。
 *
 *   · `paper`  2026-08-28 —— 招牌 的「Who you are dealing with」变成一个空的
 *               白盒子（它的地是近黑，所以它的字色是浅的）
 *   · `tint`   2026-08-29 —— 瑞士 的「As Seen On」整段几乎读不到，因为
 *               SiteCreds 整段用 --color-on-primary 写字
 *
 * 两次都是拍出来才看到的，两次的修法都只修了那一支。所以这里挡的是那个形状：
 * 任何一支 tone 只要动了「地」，就必须同时给出每一种「字」。
 *
 * ⚠️ 它挡不了什么，写清楚：它读的是这张表，不是画面。一个字色写对了、但对比度
 * 不够，这里照样绿。判那件事只能用眼睛跟 check:contrast。
 */
const GROUNDS = ["--color-canvas", "--color-ink-900", "--card"];

/* --color-on-primary 是每一支都要交代的那一个，而且理由跟别的字色不同：
   它的意思是「主色那一块上面的字」，而没有任何一支 tone 的地是主色。所以它
   永远是从别的地方继承来的一个跟这一段无关的颜色 —— 这一次就是它。 */
const WRITING = ["--color-on-primary"];

/* --color-paper（页面写字的那个颜色）只有翻面的那两支要重写。
   `tint` 不在里面，而且这是一个决定不是一个漏：--color-primary-soft 每一套都
   调成「刚好压在自己页面底色上一层」，所以地没有换边，页面本来的字色还是对的。
   哪天有一支 tone 会翻面，它必须自己进这张名单 —— 名单短，才逼得出理由。 */
const FLIPS_SIDES: string[] = ["ink", "paper"];

/* 翻面的那两支也要交代「线」。第三个家族，第三次同一个形状：ink 交代了
   --border 跟 --border-subtle，漏了 --border-strong，於是瑞士的引言框整段没有框。 */
const BORDERS = ["--border", "--border-subtle", "--border-strong"];

describe("每一支 tone", () => {
  for (const tone of BLOCK_TONES.filter((t) => t !== "page")) {
    it(`${tone}：动了地就交代了字`, () => {
      const layers = toneLayers(tone);
      expect(layers).toBeDefined();
      const apply = layers!.apply;
      const touchesGround = GROUNDS.some((k) => k in apply);
      expect(touchesGround).toBe(true);
      for (const k of WRITING) expect(Object.keys(apply)).toContain(k);
      if (FLIPS_SIDES.includes(tone)) expect(Object.keys(apply)).toContain("--color-paper");
      if (FLIPS_SIDES.includes(tone)) for (const k of BORDERS) expect(Object.keys(apply)).toContain(k);
    });

    it(`${tone}：字色不读自己（那条循环引用会静静吃掉整条规则）`, () => {
      const { capture, apply } = toneLayers(tone)!;
      for (const [k, v] of Object.entries(apply)) {
        /* apply 只准读 capture 里的私名或字面量。读一个 apply 自己也在设的名字，
           就是 block-tone.ts 档头那条 —— 变量都在 DOM 里，什么都没生效。 */
        for (const ref of v.matchAll(/var\((--[a-z0-9-]+)/g)) {
          const name = ref[1];
          if (name in capture) continue;
          expect(Object.keys(apply)).not.toContain(name);
        }
      }
    });
  }

  it("page 是「不做选择」，所以它没有层", () => {
    expect(toneLayers("page")).toBeUndefined();
    expect(toneLayers(undefined)).toBeUndefined();
  });
});
