/**
 * 一句讲数量的话，数字要**从清单来**，不可以写死在句子里。
 *
 * ── 为什么有这一条（2026-09-06）────────────────────────────────────────────
 *
 * 模板那一页的抬头右上角印着 **7**，而它正下方那一句写着
 * **「One business, six ways」**。同一屏两个答案，而多出来的那一张
 * 是后来加的 —— 没有人会想到回去改一句话里的一个中文/英文数词。
 *
 * 风格那一页也一样（六套 register，句子里写「六」）。
 *
 * 🔴 **这不是文案品味，是一个会自己过期的事实。**
 * 一个写死的数字，跟一句描述已经不存在的行为的话（见 system-register.test.ts）
 * 是同一类缺陷：它不会报错，也不会有人去按它。
 *
 * ⚠️ 这一条只管**这几句**，不扫全部文案 —— 一把把每一个数词都判红的尺
 * （「两分钟」「三步」）会教下一个人去关掉它。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** 句子 → 它旁边那个数字是从哪里数出来的。 */
const MUST_TAKE_A_COUNT: [string[], string][] = [
  [["templates", "landingBody"], "landings.length —— 抬头右上角印的就是它"],
  [["styles", "subtitle"], "STYLE_ORDER.length"],
  [["home", "styleBody"], "STYLE_ORDER.length"],
  [["home", "metaPages"], "pages.length"],
  [["home", "metaBlocks"], "componentCount"],
];

describe("讲数量的那几句，数字从清单来", () => {
  for (const lang of ["en", "zh"] as const) {
    const dict = JSON.parse(
      readFileSync(join(process.cwd(), "messages", `${lang}.json`), "utf8"),
    ) as Record<string, Record<string, Record<string, unknown>>>;

    it.each(MUST_TAKE_A_COUNT)(`${lang} · %s`, (path, from) => {
      const said = path.reduce<unknown>(
        (o, k) => (o as Record<string, unknown>)[k],
        dict.portal,
      );
      expect(typeof said, `${path.join(".")} 不见了`).toBe("string");
      const text = said as string;

      /* 它要收得下那个数字。
         ⚠️ **只判这一条。** 第一版还判「句子里不可以出现数量词」——
         而它当场把三句好话判红了：「**One** business, six ways」的 One
         讲的是同一间公司、「下面每**一张**」讲的是每一个、
         「你自己每天在用的那几**页**」讲的是那些页。
         那三个字都不是数量。**而原本那个 bug 这一条自己就抓得到** ——
         「六种做法」没有位子放数字。
         一把会把好话判红的尺，会教下一个人去关掉它。 */
      expect(
        /\{(count|n)\}/.test(text),
        `${path.join(".")} 没有位子放 ${from}`,
      ).toBe(true);
    });
  }
});
