/**
 * 画出来的每一个控件，按下去都要有东西发生。
 *
 * 这个仓库自己禁的那一条（任务 15 砍掉搜不到东西的 ⌘K、任务 23 教模型不准
 * 画死按钮），一直只管到「我们手写的画面」，没有人拿它去量**产生器产出来的
 * 那几十页**。而它 2026-09-05 之前一直破着：
 *
 *   FILTERED BY 状态：等回覆 ×      ← 底下那张表七行，一行都没少
 *                                    ← 那颗 × 指着 "#"
 *
 * 一行同时讲两句不是真的话，而且第三样东西按不动。五页都是。
 *
 * ⚠️ 它量的是**产生器**，不是浏览器。它答不了「那颗按钮点得到吗」
 * （那是 `check:reachable`）也答不了「按下去画面动了吗」（那是 `eval:browser`）。
 * 它只答一句：**这一页上有没有一个从出生那天就通不到任何地方的连结。**
 */
import { describe, expect, it } from "vitest";
import {
  PAGES_FOR_INDUSTRY,
  buildPageLayout,
  type BusinessContext,
  type PageKey,
} from "./industry-template";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";
import { SITE_PAGE_KEY } from "@/lib/portal/system-register";

/** 每一个行业的每一页，全部画出来。 */
function everyGeneratedNode(): { where: string; node: PuckNode }[] {
  const out: { where: string; node: PuckNode }[] = [];
  for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
    const ctx: BusinessContext = {
      industry: {
        slug,
        name_zh: slug,
        labels: { customer: "客户", order: "单", staff: "师傅" },
        default_workflow: [],
        suggested_modules: [],
      },
    };
    const refs = keys.map((k) => ({ key: k }));
    for (const key of keys) {
      /* 官网那一页的连结指的是客人看的外面，不是工作台。 */
      if (key === SITE_PAGE_KEY) continue;
      const layout = buildPageLayout(
        key as PageKey,
        ctx,
        "兴发",
        "zh",
        refs,
      ) as unknown as { content: PuckNode[] };
      for (const n of walkNodes(layout.content)) out.push({ where: `${slug}/${key}`, node: n });
    }
  }
  return out;
}

const ALL = everyGeneratedNode();

/** 「哪里都不去」的写法只有这几种。 */
const nowhere = (v: unknown) =>
  typeof v === "string" && (v.trim() === "" || v.trim() === "#" || v.trim() === "javascript:void(0)");

describe("产生出来的页面上没有按不动的控件", () => {
  it("画得出东西来（不然下面每一条都是在量空气）", () => {
    expect(ALL.length).toBeGreaterThan(100);
  });

  it("🔴 没有一个连结指着「哪里都不去」", () => {
    const dead: string[] = [];
    for (const { where, node } of ALL) {
      const props = (node.props ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(props)) {
        if (!/href$/i.test(k)) continue;
        if (nowhere(v)) dead.push(`${where} · ${node.type}.${k}`);
      }
    }
    expect(dead).toEqual([]);
  });

  it("🔴 没有一排 chip 是每一颗都拿不掉的", () => {
    /* 一整排都拿不掉 = 这不是一个筛子，是一句印上去的话，
       而它印的那句话（「已筛选：X」）在底下那张表上不成立。 */
    const dead: string[] = [];
    for (const { where, node } of ALL) {
      const chips = (node.props as Record<string, unknown> | undefined)?.chips;
      if (!Array.isArray(chips) || chips.length === 0) continue;
      const stuck = chips.every(
        (c) => typeof c === "object" && c !== null && nowhere((c as { removeHref?: unknown }).removeHref ?? ""),
      );
      if (stuck) dead.push(`${where} · ${node.type}`);
    }
    expect(dead).toEqual([]);
  });
});
