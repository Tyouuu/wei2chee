/* 一个价钱只有一个真相。
 *
 * 2026-08-31：老板要我逐个画面去研究，裁开登入页一看，它印着
 * 「RM5,000 to build, then RM100–300/month hosting」—— 那是 2026-08-25
 * **已经改掉**的定价（任务 9）。
 * 官网改了，登入页没改，需求书没改，而最糟的是 **opengraph 那张卡**没改 ——
 * 那是别人把连结贴进 WhatsApp 时跳出来的图，**它比官网更早被看到**。
 *
 * 一个价钱散在四个地方，改的时候只会记得走得到的那几个。
 * 这支测试守的是：**旧的数字不准再出现在任何客户看得到的字里**。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = ["messages/en.json", "messages/zh.json", "app/[locale]/opengraph-image.tsx"];

/* 旧定价的每一种写法。要再改价钱，就把新的旧值加进来。 */
const RETIRED = [/RM ?5,000/, /RM ?100[–-]300/];

describe("定价只有一个真相", () => {
  for (const f of FILES) {
    it(`${f} 里没有已经作废的价钱`, () => {
      const src = readFileSync(resolve(f), "utf8");
      for (const re of RETIRED) {
        const hit = src.match(re);
        expect(hit, `${f} 还印着 ${hit?.[0]} —— 那是 2026-08-25 改掉的定价`).toBeNull();
      }
    });
  }

  it("现行定价的数字都还在（免得有人整段删掉就算过）", () => {
    const en = readFileSync(resolve("messages/en.json"), "utf8");
    expect(en).toMatch(/RM ?500/);
    expect(en).toMatch(/RM ?199/);
  });
});
