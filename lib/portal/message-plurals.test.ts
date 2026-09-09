import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

/**
 * 英文那一份里，不准出现「(s)」那种偷懒的复数。
 *
 * ── 为什么有这一条（2026-09-09）──────────────────────────────────────────
 *
 * 助手每做成一件事，画面上就印一次 `{count} change(s) made` ——
 * **那是这整个功能里他看得最多次的一句话**，而它读起来像一份没做完的表格。
 *
 * [任务 230] 已经为同一个形状修过五句（`1 suppliers` · `1 days late` ·
 * `1 enquiries so far` · `1 items have no cost yet` · `1 months ago`），
 * 而那一轮的判准写得很清楚：**只改会碰到 1 的那几句**，
 * 因为 1 正好是他第一次看到那一句的那一次。
 *
 * 而这一句漏了 —— **它每一次都会碰到 1**（一句话改一处是常态）。
 *
 * ⚠️ 中文那一份不管：中文没有复数，`改了 {count} 处` 一个字都不用动。
 * 一条对着中文也叫的守卫，会教下一个人去关掉它。
 */
const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as unknown;

function everyString(node: unknown, path: string): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (!node || typeof node !== "object") return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    everyString(v, path ? `${path}.${k}` : k),
  );
}

describe("英文那一份里的复数", () => {
  it("没有一句用「(s)」凑复数", () => {
    const lazy = everyString(en, "")
      .filter(([, v]) => /\(s\)/.test(v))
      .map(([k, v]) => `${k} = ${v}`);
    expect(lazy).toEqual([]);
  });

  /* 顺手守住它真正该长的样子 —— 一条只禁「不要那样写」的守卫，
     挡不住下一个人把它改成 `{count} changes made`（而 1 的时候就是错的）。 */
  it("助手那一句用的是真的复数规则", () => {
    const applied = (en as { portal: { editor: { aiApplied: string } } }).portal
      .editor.aiApplied;
    expect(applied).toMatch(/plural/);
    expect(applied).toMatch(/one \{/);
  });
});
