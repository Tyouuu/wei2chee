// @vitest-environment node
import { describe, expect, it } from "vitest";
import { layoutOpSchema } from "./layout-ops";

/*
  route.ts 在模组载入的时候就建了一个 OpenAI 客户端，没有钥匙会直接抛 ——
  所以先给一把假的再动态载入。这一支一次模型都不呼叫；它只读那份 schema。
*/
process.env.OPENAI_API_KEY ||= "not-a-real-key-this-suite-calls-nobody";
const { EDIT_JSON_SCHEMA, SYSTEM_PROMPT } = await import("@/app/api/portal/edit/route");

/**
 * 两份手写的操作清单，而在这之前没有任何东西在比对它们。
 *
 * ── 为什么这一支存在 ──────────────────────────────────────────────────────
 *
 * 助手能做的事写在两个地方：`layoutOpSchema`（收到之后照它校验）跟
 * `EDIT_JSON_SCHEMA`（送出去之前告诉模型可以说什么）。两份都是手打的，
 * 而 2026-09-07 之前**零个东西**在检查它们讲的是同一件事。
 *
 * 漏在哪一边，坏法完全不一样，而且两种都不会有人当场发现：
 *
 *   只加进 zod        → 模型从来不知道有这个操作。功能静静地不存在
 *   只加进 JSON schema → 模型真的说了，zod 整份拒绝 → 端点回 502，
 *                        而**同一批里其他每一个操作跟着死**
 *
 * 第二种不是推的：`set_copy` 上线那天就发生过一次，原因写在 route.ts 那份
 * `required` 清单的注解里 ——「Adding `path` to `properties` and not to this
 * list is what made the endpoint answer 502 on the first real 用讲的改
 * request after set_copy shipped」。
 *
 * 这个仓库栽在「第二份手写清单」上至少八次。这一支把它变成一条会红的守卫，
 * 而不是他在客人面前撞到的一次 502。
 *
 * ⚠️ 它守的是「两边讲同一件事」，不是「schema 该长什么样」。
 * `EDIT_JSON_SCHEMA` 故意不是从 zod 产生的（route.ts 的档头写了理由：
 * 结构化输出要每一个分支的栏位都列进 `required` 并且可空，一份自动产生、
 * 而且会静静掉一条约束的 schema，正是这个端点在防的事）。
 */

type ZodUnionish = { options: readonly unknown[] };
type ZodObjectish = { shape: Record<string, unknown> };

/** 那个联集里每一个分支的 op 字面量。 */
function opsInZod(): string[] {
  return (layoutOpSchema as unknown as ZodUnionish).options.map((branch) => {
    const lit = (branch as ZodObjectish).shape.op as { value?: unknown };
    return String(lit?.value);
  });
}

/** 每一个分支宣告过的栏位名，联集起来（`op` 自己不算）。 */
function fieldsInZod(): string[] {
  const seen = new Set<string>();
  for (const branch of (layoutOpSchema as unknown as ZodUnionish).options) {
    for (const key of Object.keys((branch as ZodObjectish).shape)) {
      if (key !== "op") seen.add(key);
    }
  }
  return [...seen].sort();
}

const item = EDIT_JSON_SCHEMA.schema.properties.operations.items;
const props = item.properties as Record<string, unknown>;
const required = item.required as readonly string[];
const opEnum = (props.op as { enum: readonly string[] }).enum;

describe("the two hand-written op lists agree", () => {
  it("has something to compare -- neither side is empty", () => {
    /* 控制组。少了它，两边一起变成空阵列的时候这一整支会一片绿地报「一致」。 */
    expect(opsInZod().length).toBeGreaterThan(5);
    expect(opEnum.length).toBeGreaterThan(5);
  });

  it("names the same operations on both sides", () => {
    expect([...opEnum].sort()).toEqual([...opsInZod()].sort());
  });

  it("gives the model a property for every field any branch declares", () => {
    /* 只加进 zod 而没有加进这里 = 模型说不出那个栏位，操作永远拿不到值。 */
    const missing = fieldsInZod().filter((f) => !(f in props));
    expect(missing).toEqual([]);
  });

  it("lists every one of those properties as required", () => {
    /*
      🔴 这一条就是 set_copy 那次 502。strict 的结构化输出要求**每一个**
      property 都出现在 required 里（可空，不是省略）—— 漏一个，OpenAI 直接
      拒绝整份 schema，而那一次的症状是端点回 502，不是少一个功能。
    */
    const missing = Object.keys(props).filter((p) => !required.includes(p));
    expect(missing).toEqual([]);
  });

  /**
   * 🔴 第三份手打的清单：提示词。
   *
   * 一个动作同时写进 zod 跟送出去那份 schema，而**提示词里一次都没提过**，
   * 结果不是报错，是那个动作**永远不会被用到** —— 模型说得出它，而没有人
   * 告诉过它什么时候该说。那正是这个仓库那一类犯过九次的错最安静的一种：
   * 能力有、线没接，而每一条既有的检查都是绿的。
   *
   * 2026-09-07 量的：20 个动作，20 个都在提示词里 —— 所以这一条今天不是在
   * 修一个洞，是挡住第 21 个。而挡它的成本是一句断言。
   *
   * ⚠️ 只问「有没有被提过」，不问「讲得对不对」。后者要真的呼叫模型
   * （`eval:editor`），而那要花钱，也不是一支单元测试答得了的。
   */
  it("names every operation in the prompt too", () => {
    const unmentioned = [...opEnum].filter((op) => !SYSTEM_PROMPT.includes(op));
    expect(unmentioned).toEqual([]);
  });
});
