/**
 * 每一个 `words.X` 都要有人传下去。
 *
 * ── 为什么有这一条（2026-09-06 量到的）────────────────────────────────────
 *
 * 七个工具页都是同一个形状：伺服器那一边把翻译好的字装成一个包
 * （`words={{ … }}`）传给浏览器那一边，浏览器那一边写 `words.save`。
 *
 * 而 `words` 的型别是 `Record<string, string>` —— **TypeScript 抓不到少一个**。
 * 少掉的那一个在画面上是 `undefined`，React 把它渲染成**什么都没有**：
 *
 *   税那一页的「看看那一份」**整颗按钮没有字**，而它底下那张单据的
 *   四行标题（从谁 · 给谁 · 几行 · 含税总额）是四条空白。
 *
 * 五个字从写出来那天就没有传下去，而 tsc 干净 · lint 干净 · 43 条尺全绿 ——
 * 因为那一颗只在「一张单什么都不缺」的时候才画得出来，
 * 而尺子的那张单永远缺东西。
 *
 * ⚠️ 这不是「小心一点」，是**一个包一定要有人对帐**。同一个形状这个仓库
 * 栽过八次（第二份手写清单）——只是这一次那份清单是**隐形**的。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = join(process.cwd(), "app", "[locale]", "portal", "(app)");

/** 用同一个包的那几页。**从档案夹推出来，不是手写的** ——
 *  新开一页照样被守着，不用有人回来改这里。 */
function pagesWithWordBags(): string[] {
  return readdirSync(BASE, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => {
      try {
        return readFileSync(join(BASE, e.name, "page.tsx"), "utf8").includes(
          "words={{",
        );
      } catch {
        return false;
      }
    })
    .map((e) => e.name);
}

/** 那个包里给了哪几个 key。 */
function given(dir: string): Set<string> {
  const src = readFileSync(join(BASE, dir, "page.tsx"), "utf8");
  const out = new Set<string>();
  /* 一页可以传好几个包（例如清单一个、表单一个）。 */
  for (const m of src.matchAll(/words=\{\{([\s\S]*?)\n\s*\}\}/g))
    for (const k of m[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)) out.add(k[1]);
  return out;
}

/** 浏览器那一边读了哪几个。 */
function used(dir: string): Set<string> {
  const out = new Set<string>();
  for (const f of readdirSync(join(BASE, dir))) {
    if (f === "page.tsx" || !f.endsWith(".tsx")) continue;
    const src = readFileSync(join(BASE, dir, f), "utf8");
    for (const m of src.matchAll(/words\.([A-Za-z0-9_]+)/g)) out.add(m[1]);
  }
  return out;
}

describe("每一个 words.X 都有人传下去", () => {
  const dirs = pagesWithWordBags();

  it("找得到那几页 —— 找不到的话下面每一条都是空过", () => {
    expect(dirs.length).toBeGreaterThanOrEqual(6);
  });

  it.each(dirs)("%s", (dir) => {
    const missing = [...used(dir)].filter((k) => !given(dir).has(k)).sort();
    expect(missing, `${dir}/page.tsx 没有传：${missing.join(" · ")}`).toEqual(
      [],
    );
  });

  /* ⚠️ 反过来那一半**故意不判**：伺服器那一边多传一个字是浪费，
     不是缺陷 —— 而一条会因为多一个字变红的守卫，会教下一个人去关掉它。
     多出来的只印出来。 */
  it("印出来：传了而没有人读的", () => {
    const extra = dirs.map(
      (d) => [d, [...given(d)].filter((k) => !used(d).has(k))] as const,
    );
    for (const [d, ks] of extra)
      if (ks.length) console.log(`  ${d}: ${ks.join(" · ")}`);
    expect(true).toBe(true);
  });
});
