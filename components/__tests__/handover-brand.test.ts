/* 品牌色只有一个真相。
 *
 * 2026-08-31：老板要把主色从蓝换成青。globals.css 改完，服务出去的 CSS 是
 * `--blueprint: #00bdb6`，**而画面一点都没变** —— 因为 handover.tsx 里有
 * 第二份拷贝（`{ c: 0.17, h: 262 }`），它每一帧写成 <html> 的 inline style，
 * 而 inline 赢过所有样式表。查了四轮才找到。
 *
 * **一份手写的拷贝活得比它描述的东西久** —— 这个仓库第五次。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("品牌色只有一个真相", () => {
  it("handover.tsx 的 --blueprint 跟 globals.css 的对得上", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    const m = css.match(/--blueprint:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
    expect(m, "globals.css 里找不到 --blueprint").toBeTruthy();
    const [, L, c, h] = m!;

    const tsx = readFileSync(resolve("components/handover.tsx"), "utf8");
    const n = tsx.match(/"--blueprint":\s*\{\s*darkL:\s*([\d.]+),\s*lightL:\s*([\d.]+),\s*c:\s*([\d.]+),\s*h:\s*(\d+)/);
    expect(n, "handover.tsx 里找不到 --blueprint 那一行").toBeTruthy();
    const [, darkL, , cc, hh] = n!;

    expect(Number(darkL), "深底的亮度要等於 globals 的 L").toBeCloseTo(Number(L), 3);
    expect(Number(cc), "彩度要一样").toBeCloseTo(Number(c), 3);
    expect(Number(hh), "色相要一样").toBe(Number(h));
  });

  /* --ink / --card 也是同一张表里的拷贝，同一天一起过期的。 */
  it("handover 的 --ink / --card 起点跟 globals 对得上", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    const tsx = readFileSync(resolve("components/handover.tsx"), "utf8");
    const cssL = (name: string) => {
      const m = css.match(new RegExp(name + String.raw`:\s*oklch\(([\d.]+)`));
      expect(m, "globals.css 里找不到 " + name).toBeTruthy();
      return Number(m![1]);
    };
    const tsxFrom = (name: string) => {
      const m = tsx.match(new RegExp('"' + name + String.raw`":\s*\{\s*from:\s*\[([\d.]+)`));
      expect(m, "handover.tsx 里找不到 " + name).toBeTruthy();
      return Number(m![1]);
    };
    expect(tsxFrom("--ink"), "地").toBeCloseTo(cssL("--ink"), 3);
    expect(tsxFrom("--card"), "卡").toBeCloseTo(cssL("--ink-raised"), 3);
  });

  it("浅底那一档要真的比深底暗（不然白底上会糊）", () => {
    const tsx = readFileSync(resolve("components/handover.tsx"), "utf8");
    const n = tsx.match(/"--blueprint":\s*\{\s*darkL:\s*([\d.]+),\s*lightL:\s*([\d.]+)/)!;
    expect(Number(n[2])).toBeLessThan(Number(n[1]) - 0.1);
  });
});
