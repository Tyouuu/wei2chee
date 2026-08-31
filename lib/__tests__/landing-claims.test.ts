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
 * 这支测试守的是：官网上那三个数字不准跟代码漂开。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
  it("风格套数 = STYLE_ORDER 里真的有几套", () => {
    const src = readFileSync(resolve("app/[locale]/style-picker/style-column.tsx"), "utf8");
    const block = src.slice(src.indexOf("STYLE_ORDER"), src.indexOf("];", src.indexOf("STYLE_ORDER")));
    const real = (block.match(/"[a-z]+"/g) ?? []).length;
    expect(real).toBeGreaterThan(0);
    for (const [lang, msgs] of [["en", en], ["zh", zh]] as const) {
      const proof = findProof(msgs)!;
      expect(Number(proof.proofA), `${lang} 的 proofA`).toBe(real);
    }
  });

  it("版段数 = components/blocks 里真的有几个档", () => {
    /* 用 import.meta.glob 之外最简单可靠的办法：读目录。 */
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const real = readdirSync(resolve("components/blocks")).filter((f) => f.endsWith(".tsx")).length;
    expect(real).toBeGreaterThan(0);
    for (const [lang, msgs] of [["en", en], ["zh", zh]] as const) {
      const proof = findProof(msgs)!;
      expect(Number(proof.proofB), `${lang} 的 proofB`).toBe(real);
    }
  });
});
