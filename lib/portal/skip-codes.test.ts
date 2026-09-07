// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { SKIP_CODES, type SkipCode } from "./skip-codes";

/*
  🔴 这一支守的是 2026-09-07 量出来的那件事：**四十九处写死的中文**，
  而 portal 的 locale 跟 `system_language` 预设都是 `en`。

  ⚠️ 而 `check:en` 抓不到它们 —— 那把尺走的是画面上的字，而这几句**只在一个
  动作失败之后才出现**，那要一次真的模型呼叫。所以它们躲过了任务 18 那一轮。
  这一支不开浏览器、不呼叫模型，它只对着档案数。
*/

const zh = JSON.parse(readFileSync("messages/zh.json", "utf8"));
const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
const say = (m: Record<string, unknown>) =>
  ((m.portal as { editor: { skipped: Record<string, string> } }).editor.skipped ?? {});

const CJK = /[\u4e00-\u9fff]/;

describe("助手讲不出的那几句", () => {
  it("控制组：代号是一份真的清单", () => {
    expect(SKIP_CODES.length).toBeGreaterThanOrEqual(40);
  });

  /* 🔴 这一条就是这一支存在的理由：第五十句不会再是中文。 */
  it("每一个代号在两份语言档里都有一句", () => {
    const missing: string[] = [];
    for (const c of SKIP_CODES) {
      if (!say(zh)[c]?.trim()) missing.push("zh:" + c);
      if (!say(en)[c]?.trim()) missing.push("en:" + c);
    }
    expect(missing).toEqual([]);
  });

  it("语言档里没有多出来的、指不到任何东西的句子", () => {
    const known = new Set<string>(SKIP_CODES);
    expect(Object.keys(say(zh)).filter((k) => !known.has(k))).toEqual([]);
    expect(Object.keys(say(en)).filter((k) => !known.has(k))).toEqual([]);
  });

  /* 🔴 英文那一份里出现中文，就是这个 bug 的第二版。 */
  it("英文那一份里一个中文字都没有", () => {
    const bad = Object.entries(say(en)).filter(([, v]) => CJK.test(String(v)));
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  /*
    一句只会说「不行」的拒绝，是一个比较礼貌的死路。
    预约跟对帐拒绝，是因为那个动作本身给不了时间 / 给不了那个总数 ——
    不是因为少一个分支，所以那一句非讲出该去哪里不可，而且两种语言都要。
  */
  it.each([
    ["writeCalendar", "预约那一页", "bookings page"],
    ["writeReconcile", "对帐那一页", "reconciliation page"],
    ["actLedger", "冲正", "reversal"],
    ["actCatalog", "货架那一页", "shelf page"],
    ["actReconcile", "对帐那一页", "reconciliation page"],
    ["cannotLogDay", "师傅那一页", "staff page"],
  ])("%s 讲得出该去哪里", (code, inZh, inEn) => {
    expect(say(zh)[code]).toContain(inZh);
    expect(say(en)[code]).toContain(inEn);
  });

  /*
    而它不可以是一句资料库的话。⚠️ `dbSaid` 是例外，而且是**故意**的：
    它整个存在的理由就是包住资料库自己那一句，让他知道那不是我们在讲话。
  */
  it("除了那一句包起来的，没有一句在讲机器的话", () => {
    const machine = /\b(rpc|module|pipeline|null|undefined|constraint|violates)\b/i;
    const bad: string[] = [];
    for (const c of SKIP_CODES) {
      if (c === "dbSaid") continue;
      if (machine.test(say(zh)[c] ?? "")) bad.push("zh:" + c);
      if (machine.test(say(en)[c] ?? "")) bad.push("en:" + c);
    }
    expect(bad).toEqual([]);
  });

  /*
    🔴 而这一条守的是「下一个人怎么加第五十句」：写入跟版面那两支里，
    一个 `reason:` 或者 `return "..."` 的位置上不可以再出现中文。
    少了它，代号这一整套只是把今天那四十九句搬了个家。
  */
  it("那两支档案里，讲给他听的位置上一个中文字都没有", () => {
    const bad: string[] = [];
    for (const f of ["lib/portal/record-ops.ts", "lib/portal/layout-ops.ts"]) {
      readFileSync(f, "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          const code = line.replace(/^\s+/, "");
          /* 注解不算 —— 那是写给下一个 session 看的（重点 22b）。 */
          if (/^(\/\/|\*|\/\*)/.test(code)) return;
          if (!CJK.test(code)) return;
          if (/reason:\s*"|reason:\s*`|return\s*"|return\s*`/.test(code)) {
            bad.push(f.split("/").pop() + ":" + (i + 1) + " " + code.slice(0, 46));
          }
        });
    }
    expect(bad).toEqual([]);
  });
});

/* 型别那一半由编译器守：一个不在联集里的代号推不上去。 */
const _typed: SkipCode = "notFound";
void _typed;
