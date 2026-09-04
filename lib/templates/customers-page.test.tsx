import type React from "react";
/* 客户那一页：整页一张表、带真的分面、第一栏一颗头像。
 *
 * ── 为什么有这一条 ────────────────────────────────────────────────────
 * `npm run align:pages`（我们每一页 vs 他挑的那一套对应的那一页）2026-09-05
 * 判客户那一页：**一屏几块 9 对 3 · 缝是他们的 12.3 倍**。
 * 并排图看出来那 12.3 倍是什么：右边那一格「详情」只画**第一行**那一个人，
 * 两行就停了，底下留一整条空。
 *
 * 而那一格本来的理由写在 `buildCustomers` 里：客户详情页还不存在，
 * 所以先在旁边放半个。**那一页 2026-09-03 上线了**（任务 119），
 * 表格第一格从 8-31 起就是连到它的连结 —— 理由过期了。
 *
 * ⚠️ 左清单右详情**没有被推翻**：供应商跟师傅还是那个排法（他们的 Logistics
 * 那一页）。换掉的只有客户，而客户对上的本来就是他们的 Users。
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PAGES_FOR_INDUSTRY,
  buildPageLayout,
  type BusinessContext,
  type PageKey,
} from "./industry-template";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";
import { puckConfig } from "@/design-system/editor/puck-config";

function ctxFor(slug: string): BusinessContext {
  return {
    industry: {
      slug,
      name_zh: slug,
      labels: { customer: "客户", order: "单", staff: "师傅" },
      default_workflow: [],
      suggested_modules: [],
    },
  };
}

function pageNodes(slug: string, key: PageKey): PuckNode[] {
  const keys = PAGES_FOR_INDUSTRY[slug] ?? [];
  const refs = keys.map((k) => ({ key: k }));
  const layout = buildPageLayout(key, ctxFor(slug), "兴发", "zh", refs) as unknown as {
    content: PuckNode[];
  };
  return [...walkNodes(layout.content)];
}

const withCustomers = Object.keys(PAGES_FOR_INDUSTRY).filter((s) =>
  (PAGES_FOR_INDUSTRY[s] ?? []).includes("customers"),
);

describe("客户那一页", () => {
  it("八个行业里真的有几个开了这一页 —— 没有的话下面全部假装通过", () => {
    expect(withCustomers.length).toBeGreaterThan(3);
  });

  it("整页一张表：不再画那一格只有第一行的详情", () => {
    const bad: string[] = [];
    for (const slug of withCustomers) {
      const nodes = pageNodes(slug, "customers");
      const detail = nodes.find(
        (n) => n.type === "InfoRows" && String(n.props?.id ?? "").endsWith("-detail"),
      );
      if (detail) bad.push(slug);
    }
    expect(bad, `这几个行业的客户页还画着那一格详情：${bad.join(" · ")}`).toEqual([]);
  });

  it("第一栏是一个人 —— 那张表说自己是名册", () => {
    for (const slug of withCustomers) {
      const list = pageNodes(slug, "customers").find(
        (n) => n.type === "RecordTable" && String(n.props?.id ?? "").endsWith("-list"),
      );
      expect(list, `${slug} 的客户页没有那张表`).toBeTruthy();
      expect(list?.props?.faces, `${slug}`).toBe(true);
    }
  });

  it("分段是那张表自己算的，不是这里刻进去的", () => {
    for (const slug of withCustomers) {
      const list = pageNodes(slug, "customers").find(
        (n) => n.type === "RecordTable" && String(n.props?.id ?? "").endsWith("-list"),
      );
      expect(list?.props?.segments, `${slug}`).toBe(true);
      /* 🔴 刻进去的那一排会在他自己的资料上一格都筛不到：这一层只看得到示例，
         而第一笔真记录一进来示例就整批消失，`live-rows.ts` 也从来不碰它。 */
      expect(list?.props?.filters, `${slug} 把示例的状态刻进了分段`).toBeUndefined();
    }
  });

  it("每一行都是自己一格的时候，那一排不画 —— 那是这张表的第二份拷贝", () => {
    const R = puckConfig.components.RecordTable.render as (
      p: Record<string, unknown>,
    ) => React.ReactElement;
    const cols = [
      { key: "primary", label: "客户", kind: "text" as const },
      { key: "status", label: "状态", kind: "status" as const },
    ];
    const draw = (statuses: string[]) =>
      renderToStaticMarkup(
        <>
          {R({
            gridId: "t",
            caption: "客户",
            segments: true,
            table: {
              columns: cols,
              rows: statuses.map((st, i) => ({
                cells: { primary: `人 ${i}`, status: st },
                tones: { status: "neutral" as const },
              })),
            },
            puck: { renderDropZone: () => null },
          })}
        </>,
      );
    /* 有重复 = 真的在分组 → 画。 */
    expect(draw(["施工中", "施工中", "新客户"])).toContain("aria-pressed");
    /* 🔴 每一行自己一格 → 不画。**这一条要单独用三行试**：
       七行七种会先撞到「不超过六格」那一条，於是把「有没有重复」那一条
       拆掉之后测试照样绿 —— 那就是一条量在旁边的守卫（实测过）。 */
    expect(draw(["a", "b", "c"])).not.toContain("aria-pressed");
    /* 超过六格也不画：参考那一页是四个下拉，一排八格会自己折行。 */
    expect(draw(["a", "a", "b", "c", "d", "e", "f", "g"])).not.toContain("aria-pressed");
    /* 只有一种 → 不画：两格都回同一批行。 */
    expect(draw(["施工中", "施工中"])).not.toContain("aria-pressed");
  });

  /* 🔴 这一条守的不是设计，是那一行 render。
     任务 18 的「筛选条件 / 清空全部」：产生页面的那一层老早就传了，
     而 `puck-config.tsx` 那一行的解构少接了两个 —— 组件退回自己的预设，
     而画面上完全正常。所以这一条走 Puck 那一条路，不是直接渲染组件。 */
  it("那颗头像真的穿得过 Puck 那一行 render", () => {
    const R = puckConfig.components.RecordTable.render as (p: Record<string, unknown>) => React.ReactElement;
    const table = {
      columns: [
        { key: "primary", label: "客户", kind: "text" as const },
        { key: "status", label: "状态", kind: "status" as const },
      ],
      rows: [{ cells: { primary: "陈先生", status: "施工中" }, tones: { status: "neutral" as const } }],
    };
    const on = renderToStaticMarkup(
      <>{R({ gridId: "t", caption: "客户", table, faces: true, puck: { renderDropZone: () => null } })}</>,
    );
    const off = renderToStaticMarkup(
      <>{R({ gridId: "t", caption: "客户", table, puck: { renderDropZone: () => null } })}</>,
    );
    const badge = (out: string) => out.match(/<span class="grid shrink-0[^>]*>([^<]*)</)?.[1];
    expect(badge(on)).toBe("陈");
    expect(badge(off)).toBeUndefined();
  });
});
