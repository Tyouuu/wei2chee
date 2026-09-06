/**
 * `nudges_due` 回的每一种事，画面上都要有一句话。
 *
 * ── 为什么（2026-09-06）────────────────────────────────────────────────────
 *
 * 那一份清单的抬头是一张**手写的对照表**（六种 → 六句话），
 * 而这个仓库栽在「第二份手写清单」上至少八次：它活得比它描述的东西久。
 *
 * 资料库那一支已经从五种长到六种（20260906280000 加了「官网有人订了」）。
 * 第七种加进去而没有人回来补一句话，画面上会印出 `booking_unseen` 这种字 ——
 * 不会报错，也没有人会去按它。
 *
 * ⚠️ 守的是**有没有那句话**，不是它写得好不好。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** 从**最后一次**定义 `nudges_due` 的那一支 migration 里读出它回哪几种。
 *  ⚠️ 最后一支才算 —— 这一支被重写过四次，读错一支就是量一个旧真相。 */
function kindsFromMigration(): string[] {
  const dir = join(ROOT, "supabase", "migrations");
  const last = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) =>
      readFileSync(join(dir, f), "utf8").includes("create or replace function public.nudges_due"),
    )
    .pop();
  expect(last, "找不到 nudges_due 那一支 migration").toBeTruthy();
  const src = readFileSync(join(dir, last as string), "utf8");
  const found = [...src.matchAll(/select '([a-z_]+)'::text/g)].map((m) => m[1]);
  return [...new Set(found)];
}

describe("每一种事都有一句话", () => {
  const kinds = kindsFromMigration();
  const client = readFileSync(
    join(ROOT, "app", "[locale]", "portal", "(app)", "today", "nudge-list.tsx"),
    "utf8",
  );

  it("真的读到了那几种（读不到的话下面每一条都是空过）", () => {
    expect(kinds.length).toBeGreaterThanOrEqual(6);
  });

  it.each(kinds)("%s 在画面那份对照表里", (kind) => {
    expect(client, `nudge-list.tsx 没有认得 ${kind}`).toContain(`${kind}: "kind_${kind}"`);
  });

  it.each(["en", "zh"])("%s 每一种都有字", (lang) => {
    const dict = JSON.parse(readFileSync(join(ROOT, "messages", `${lang}.json`), "utf8")) as {
      portal: { today: Record<string, string> };
    };
    const missing = kinds.filter((k) => !dict.portal.today[`kind_${k}`]);
    expect(missing, `${lang} 少了：${missing.join(" · ")}`).toEqual([]);
  });
});
