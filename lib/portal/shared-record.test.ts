import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SHAREABLE_MODULES, ANSWERABLE_MODULES } from "./shared-record";

/**
 * 这一份跟资料库那一份不可以漂开。
 *
 * 🔴 画面必须在**画那颗按钮之前**就知道哪几种单发得出去 —— 所以这里
 * 必然是第二份清单。这个仓库栽在「第二份手写清单」上至少八次，
 * 而每一次的形状都一样：**分开写没关系，分开漂就有关系。**
 *
 * 所以这一条去读那支 migration 的**原文**，不是读我记得的东西。
 * 资料库那一边多一种单而这里没跟上 → 红。
 */

const DIR = "supabase/migrations";

/** 最后一次定义那支函式的那个档案 —— 不是第一个。
 *  （任务 183 · 189 各栽过一次：「原来那一支」是最后一次定义它的那个。） */
function lastBody(fn: string): string {
  const marker = `create or replace function public.${fn}(`;
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  let found: string | null = null;
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), "utf8");
    const i = sql.indexOf(marker);
    if (i >= 0) found = sql.slice(i, i + 600);
  }
  if (!found) throw new Error(`no migration defines ${fn}`);
  return found;
}

/** `select k in ('a', 'b')` 里那几个字。 */
function modulesIn(body: string): string[] {
  const m = body.match(/select\s+k\s+in\s*\(([^)]*)\)/i);
  if (!m) throw new Error("could not read the module list out of the SQL");
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
}

describe("发得给客人看的那几种单", () => {
  it("跟资料库那一份一模一样", () => {
    expect(modulesIn(lastBody("is_shareable_module"))).toEqual([...SHAREABLE_MODULES].sort());
  });

  it("他答得了的那几种也是", () => {
    expect(modulesIn(lastBody("is_answerable_module"))).toEqual([...ANSWERABLE_MODULES].sort());
  });

  it("🔴 答得了的一定是发得出去的 —— 反过来不成立", () => {
    for (const k of ANSWERABLE_MODULES) {
      expect(SHAREABLE_MODULES as readonly string[]).toContain(k);
    }
    /* 一张已经在做的工程发得出去（看进度），而没有「同意」这个动作。 */
    expect(SHAREABLE_MODULES as readonly string[]).toContain("projects");
    expect(ANSWERABLE_MODULES as readonly string[]).not.toContain("projects");
  });
});
