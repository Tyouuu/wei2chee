/* 考尺子自己 —— 拿一张我知道答案的图给它量。
 *
 * 老板 2026-09-03：`那把够准确吗 我需要一把好用的尺子`。
 *
 * ── 诚实的答案，以及这个档案为什么存在 ────────────────────────────────────
 * 那把尺 2026-09-03 一天里**错了八次**，八次都是我看 1:1 的图才发现的：
 *   ① 整页被一个大 div 包着，「一屏几块」报 1，而画面上有四块
 *   ② 表格的每一行够宽够高，於是 tbody 变成「装最多块的容器」，参考报 14 块
 *   ③ 框跟内距不在同一个元素上，内距报 0
 *   ④ 页尾用 `find` 照 DOM 顺序找，先撞到 `<html>`（它当然「有字」），报「没有」
 *   ⑤ 「孤单的按钮」问的是 innerText，而那会把整个子树算进去 —— 对着它就是
 *      为了抓的那颗置中红按钮报 0
 *   ⑥ 像素探针 12px 一格，而中台的缝是 14px，四张卡黏成一块
 *   ⑦ 缩图之后才读宽度，换算永远是 1，**每一个像素数都小 1.6 倍**
 *   ⑧ 侧栏的两个门槛太紧，六套里四套连「有没有侧栏」都读不到
 *
 * 八次里没有一次是测试抓到的，因为**没有一条测试在考它**。
 * 一把没有人考过的尺，跟一把说「你没问题」的尺，印出来长得一模一样。
 *
 * 所以这里画几张**我知道答案的图**丢给它：一条侧栏、一行四张卡、一片空地。
 * 它答错就红。
 *
 * ⚠️ 这只考得了**像素**那一支（`probe-image.mjs`）——
 * 读 DOM 那一支要一个真的浏览器，那一半还没有守卫，写在这里免得下一个人
 * 以为整把尺都被考过了。
 */
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { measureImage } from "@/scripts/probe-image.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

/** 画一张假的后台：左边一条侧栏，右边一行 n 张卡。数字全部是我给的。 */
async function fakeDashboard({
  width = 1440,
  height = 900,
  rail = 240,
  cards = 4,
  cardTop = 120,
  cardHeight = 160,
  gutter = 24,
  ground = "#f0f2f5",
  railColour = "#17181a",
  cardColour = "#ffffff",
}: {
  width?: number; height?: number; rail?: number; cards?: number;
  cardTop?: number; cardHeight?: number; gutter?: number;
  ground?: string; railColour?: string; cardColour?: string;
}) {
  const inner = width - rail - 48;
  const cardW = Math.floor((inner - gutter * (cards - 1)) / cards);
  /* 侧栏宽 0 的时候不要画它 —— sharp 收不到宽度 0 的图层，
     而那会让这条测试因为**测试自己写错**而红，看起来像尺子错了。 */
  const parts: unknown[] = rail
    ? [
        {
          input: { create: { width: rail, height, channels: 3 as const, background: railColour } },
          left: 0,
          top: 0,
        },
      ]
    : [];
  for (let i = 0; i < cards; i++) {
    parts.push({
      input: { create: { width: cardW, height: cardHeight, channels: 3 as const, background: cardColour } },
      left: rail + 24 + i * (cardW + gutter),
      top: cardTop,
    });
  }
  return sharp({ create: { width, height, channels: 3, background: ground } })
    .composite(parts as never)
    .png()
    .toBuffer();
}

describe("像素那把尺，考它自己", () => {
  it("量得出侧栏有多宽", async () => {
    const img = await fakeDashboard({ rail: 240 });
    const m = await measureImage(img);
    /* 容差 12px：探针是逐栏投票的，边缘那一两栏本来就会有一点出入。 */
    expect(Math.abs((m.rail ?? 0) - 240), `量出来 ${m.rail}，画进去的是 240`).toBeLessThanOrEqual(12);
  });

  it("🔴 一行四张卡就要数出四张 —— 缝只有 14px 也一样", async () => {
    /* 这一条守的是第 ⑥ 个错：探针本来 12px 一格，而中台的缝是 14px，
       缝老是跟卡挤在同一格里，四张卡黏成一块，报「一块，1120 宽」。 */
    const img = await fakeDashboard({ cards: 4, gutter: 14 });
    const m = await measureImage(img);
    expect(m.perRowMax, `一行数出 ${m.perRowMax} 张，画进去的是 4 张`).toBe(4);
  });

  it("🔴 量出来的宽度要是原图的宽度，不是缩图的", async () => {
    /* 这一条守的是第 ⑦ 个错：缩到 900 宽之后才读宽度，换算永远是 1，
       Tabler 的卡报 192 而它是 307 —— **每一行数字都小 1.6 倍，而它看起来完全正常。** */
    const img = await fakeDashboard({ width: 1440, rail: 240, cards: 4, gutter: 24 });
    const m = await measureImage(img);
    const expected = Math.floor((1440 - 240 - 48 - 24 * 3) / 4);
    expect(m.width).toBe(1440);
    expect(
      Math.abs((m.cardWidth ?? 0) - expected),
      `卡宽量出来 ${m.cardWidth}，画进去的是 ${expected}`,
    ).toBeLessThanOrEqual(14);
  });

  it("地是什么颜色要认得出来", async () => {
    const m = await measureImage(await fakeDashboard({ ground: "#f0f2f5" }));
    const [r, g, b] = (m.ground.match(/\d+/g) ?? []).map(Number);
    expect(Math.abs(r - 240) + Math.abs(g - 242) + Math.abs(b - 245)).toBeLessThanOrEqual(30);
  });

  it("🔴 近白的卡压在近白的地上，一样要数得出来", async () => {
    /* 这一条守的是最早那个错：门槛设 14 阶明度，而现代后台是
       `#fff` 的卡压在 `#f8f8f8` 的地上，只差 7 阶 —— 松的门槛把卡也算成地，
       整批参考的侧栏全部报 0，整页读成一片平的。 */
    const img = await fakeDashboard({ ground: "#f8f8f8", cardColour: "#ffffff", cards: 4, rail: 0 });
    const m = await measureImage(img);
    expect(m.perRowMax, `近白压近白，一行数出 ${m.perRowMax} 张`).toBe(4);
  });

  it("一片空地上不要凭空数出块来", async () => {
    const img = await sharp({ create: { width: 1440, height: 900, channels: 3, background: "#f5f6f8" } })
      .png()
      .toBuffer();
    const m = await measureImage(img);
    expect(m.cards, `空白的图上数出 ${m.cards} 块`).toBe(0);
    expect(m.rail, `空白的图上量出 ${m.rail}px 的侧栏`).toBe(0);
  });

  it("有颜色的面积：全灰的图要接近 0", async () => {
    const img = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#f0f0f0" } })
      .png()
      .toBuffer();
    const m = await measureImage(img);
    expect(m.colour).toBeLessThan(1);
  });

  it("有颜色的面积：一整片红要接近 100", async () => {
    const img = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#c8102e" } })
      .png()
      .toBuffer();
    const m = await measureImage(img);
    expect(m.colour).toBeGreaterThan(95);
  });
});
