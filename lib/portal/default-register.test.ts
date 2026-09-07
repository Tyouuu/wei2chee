import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defaultRegister } from "./default-register";
import { SYSTEM_REGISTER } from "./system-register";

/** 一个够用的替身 —— 只答这一支真的会问的那两句。 */
function reader(ctx: unknown, choices?: string[] | null) {
  return {
    rpc: () => Promise.resolve({ data: ctx }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { style_choices: choices } }) }),
      }),
    }),
  };
}
const RENO = { industry: { slug: "renovation", style_recommendation: "hearth" } };

describe("这个客户的官网穿哪一套", () => {
  it("他自己挑过的永远赢", async () => {
    expect(await defaultRegister(reader(RENO, ["ledger"]), "signboard")).toBe("signboard");
  });

  it("没挑过就照他这一行的第一顺位", async () => {
    expect(await defaultRegister(reader(RENO, ["ledger", "hearth"]))).toBe("ledger");
  });

  it("这一行没有清单，掉到更早那一版的建议", async () => {
    expect(await defaultRegister(reader(RENO, null))).toBe("hearth");
  });

  it("连行业都不知道，才用那个常数", async () => {
    expect(await defaultRegister(reader({ industry: null }))).toBe(SYSTEM_REGISTER);
  });

  /* 🔴 一次读失败不可以变成一道挡住他的门 —— 那正是这一整件事在拆掉的东西。 */
  it("读不到的时候照样给得出一套，不是抛出去", async () => {
    const broken = {
      rpc: () => Promise.reject(new Error("网路断了")),
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({}) }) }) }),
    };
    expect(await defaultRegister(broken)).toBe(SYSTEM_REGISTER);
  });
});

/**
 * 🔴 没有一页可以再把他导去挑 system style。
 *
 * 老板 2026-09-08：「沒有這個system style呢 這個已經不要了 舊概念了」。
 * 而它当时挡在**四个入口**上，所以这一条守的是那个形状不是那四行：
 * 哪一天有人再加一页、再写一次那条转向，这里会红。
 *
 * ⚠️ `style-select/page.tsx` 自己是那条转向的**目的地**，不是发起的人 ——
 * 它今天只剩一条「导去风格库」，所以它不算。
 */
describe("那道门", () => {
  const ROOT = join(process.cwd(), "app", "[locale]", "portal");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory()
        ? walk(join(dir, d.name))
        : d.name.endsWith(".tsx") || d.name.endsWith(".ts")
          ? [join(dir, d.name)]
          : [],
    );

  it("没有一页把他导去挑 system style", () => {
    const guilty: string[] = [];
    for (const f of walk(ROOT)) {
      if (f.includes(join("style-select", "page.tsx"))) continue;
      /* 🔴 先把注解拿掉再比 —— 每一页都留着一段写着这件事怎么发生的注解，
         而那段注解里就有 `redirect("/portal/style-select")` 那几个字。
         一条不允许人把理由写下来的守卫，会逗下一个人去删掉理由
         （[任务 141f](../../docs/founder-tasks.md) 栽过一次）。 */
      const src = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      const calls = src.match(/redirect\(\s*["'][^"']*style-select[^"']*["']/g) ?? [];
      if (calls.length) guilty.push(`${f.replace(process.cwd(), "")} × ${calls.length}`);
    }
    expect(guilty, "这几页还在把他挡在门外").toEqual([]);
  });

  it("那一页自己只剩一条转向，没有那个旧标题", () => {
    const src = readFileSync(join(ROOT, "style-select", "page.tsx"), "utf8");
    expect(src).toContain('redirect("/portal/styles")');
    expect(src).not.toContain("StyleSelectClient");
  });
});
