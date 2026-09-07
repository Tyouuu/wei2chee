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
      readFileSync(join(dir, f), "utf8").includes(
        "create or replace function public.nudges_due",
      ),
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
    expect(client, `nudge-list.tsx 没有认得 ${kind}`).toContain(
      `${kind}: "kind_${kind}"`,
    );
  });

  it.each(["en", "zh"])("%s 每一种都有字", (lang) => {
    const dict = JSON.parse(
      readFileSync(join(ROOT, "messages", `${lang}.json`), "utf8"),
    ) as {
      portal: { today: Record<string, string> };
    };
    const missing = kinds.filter((k) => !dict.portal.today[`kind_${k}`]);
    expect(missing, `${lang} 少了：${missing.join(" · ")}`).toEqual([]);
  });
});

/**
 * 🔴 借来的那两栏，每一种要自己讲自己的话。
 *
 * ── 这一条是怎么冒出来的（2026-09-07）───────────────────────────────────
 *
 * `nudges_due` 只有两栏放数字（`qty_left` · `qty_floor`），而**三种事
 * 借去装三样不同的东西**（那一支自己的注解就写着「借同两栏」）：
 *
 *   below_reorder  剩几个 · 补货线
 *   absent_twice   缺席几堂
 *   party_lapsed   来过几次 · 平常隔几天
 *
 * 而画面上原本只有一句话（`leftOf`＝「还剩 N，线是 M」）。
 * 所以第十一种上线那天画出来是 **「还剩 2，线是 0」** ——
 * 一句关於库存的话，印在一个连着两堂没来的学生旁边。
 * 一天之后第十二种加进来，会照样中。
 *
 * ⚠️ 它不报错、不会红、也不会让页面白掉 —— 那正是它活了一天的原因。
 * 上面那三条守的是「有没有一句话」；这一条守的是**那句话是不是这一种的**。
 */
describe("借来的那两栏，讲的是不是自己那一句", () => {
  const dir = join(ROOT, "supabase", "migrations");
  const last = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) =>
      readFileSync(join(dir, f), "utf8").includes(
        "create or replace function public.nudges_due",
      ),
    )
    .pop() as string;
  const sql = readFileSync(join(dir, last), "utf8");
  const client = readFileSync(
    join(ROOT, "app", "[locale]", "portal", "(app)", "today", "nudge-list.tsx"),
    "utf8",
  );

  /** 那一种有没有往 `qty_left` 塞东西 —— 看它那一段里有没有一个
   *  不是 `null` 的 `::numeric`。⚠️ 认的是**塞了东西**，不是塞了什么：
   *  塞什么只有写它的人知道，而这一条要问的是「有没有人替它讲话」。 */
  const fillsQty = (kind: string) => {
    const at = sql.indexOf(`select '${kind}'::text`);
    if (at < 0) return false;
    const stop = sql.indexOf("\n    from", at);
    const block = sql.slice(at, stop > at ? stop : at + 600);
    return /(?<!null)::numeric/.test(block.replace(/null::numeric/g, ""));
  };

  const borrowers = kindsFromMigration().filter(fillsQty);

  /** 画面上那张 `QTY_WORD`。⚠️ 读的是**那一段**不是整个档案 ——
   *  `KIND_LABEL` 里每一种也长得像 `xxx:`，拿整个档案去比会全部放行。 */
  const qtyWord = (() => {
    const at = client.indexOf("const QTY_WORD");
    const end = client.indexOf("};", at);
    return at < 0 ? "" : client.slice(at, end);
  })();

  it("真的读到了借那两栏的那几种", () => {
    expect(borrowers.length, "一种都没读到 —— 这一条在量空气").toBeGreaterThan(
      1,
    );
    expect(qtyWord, "画面上找不到 QTY_WORD 那一段").not.toBe("");
  });

  it.each(borrowers)("%s 有自己那一句", (kind) => {
    expect(
      qtyWord,
      `${kind} 会退回「还剩 N，线是 M」—— 那是补货线的话`,
    ).toContain(`${kind}:`);
  });

  it.each(["en", "zh"])("%s 那几句话都在", (lang) => {
    const dict = JSON.parse(
      readFileSync(join(ROOT, "messages", `${lang}.json`), "utf8"),
    ) as { portal: { today: Record<string, string> } };
    const keys = [...qtyWord.matchAll(/:\s*"([a-zA-Z]+)"/g)].map((m) => m[1]);
    expect(keys.length, "QTY_WORD 里一个键都读不到").toBeGreaterThan(1);
    const missing = keys.filter((k) => !dict.portal.today[k]);
    expect(missing, `${lang} 少了：${missing.join(" · ")}`).toEqual([]);
  });
});
