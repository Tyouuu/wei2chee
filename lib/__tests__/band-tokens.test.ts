/* 一条色带要嘛把每一个 token 都交代掉，要嘛就会有一样东西拿深色页的值
 * 画在亮青上。
 *
 * ── 这条守卫在守哪一个真的错 ────────────────────────────────────────────
 * 2026-09-01 之前那半页是白的，而 Showroom 的标题实测 **1.1:1** ——
 * 白纸写白字。根因不是「白不好看」，是**那半页只换了地，没有把每一样
 * 读得到的东西一起换**。自订属性会继承，:root 的深色值一路穿下来，
 * 只有更近的一份宣告赢得了它。
 *
 * 所以判准不是「颜色好不好看」（那只有眼睛判得了 —— 重点 24），
 * 是**「有没有漏掉一个」**，而那个数得出来。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("app/globals.css"), "utf8");

const block = (sel: string) => {
  const i = css.indexOf(sel + " {");
  expect(i, `globals.css 里找不到 ${sel}`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("\n}", i));
};
const tokens = (sel: string) =>
  new Set([...block(sel).matchAll(/^\s*(--[a-z-]+):/gm)].map((m) => m[1]));

describe("青带", () => {
  it("交代的 token 不比页面自己那一套少", () => {
    const page = tokens(".handover-fixed"); // 页面深色那一套的完整清单
    const band = tokens(".band-cyan");
    const missing = [...page].filter((t) => !band.has(t));
    expect(missing, `青带漏了这几个，它们会拿深色页的值画在亮青上：${missing.join(" · ")}`).toEqual([]);
  });

  it("字是深的、地是亮的 —— 亮青只配得起深色字（配暖白只有 1.72:1）", () => {
    const b = block(".band-cyan");
    const L = (name: string) => {
      const m = b.match(new RegExp(name + String.raw`:\s*oklch\(([\d.]+)`));
      expect(m, `青带里找不到 ${name}`).toBeTruthy();
      return Number(m![1]);
    };
    expect(L("--background"), "地要亮").toBeGreaterThan(0.6);
    expect(L("--foreground"), "字要深").toBeLessThan(0.3);
    expect(L("--muted-foreground"), "次要字也要深").toBeLessThan(0.42);
    /* 「青主 + 黑配」：青已经是地了，强调色只能是黑。 */
    expect(L("--blueprint"), "强调色要是黑，不是又一个青").toBeLessThan(0.3);
  });
});
