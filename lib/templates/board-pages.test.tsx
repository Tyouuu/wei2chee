import type React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  PAGES_FOR_INDUSTRY,
  buildPageLayout,
  type BusinessContext,
  type PageKey,
} from "./industry-template";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";
import { TaskBoard } from "@/design-system/components/board-blocks";

/* 看板那两页：板就是这一页。
 *
 * ── 这一条守的是什么 ─────────────────────────────────────────────────
 * 工程那一页本来是**看板加一张一模一样的表**：同一批七笔画两次，
 * 上面一次下面一次。参考那一页（Studio Admin 的 Kanban）只有板 ——
 * 而「同一行印两次同一个数字」正是印那一套风格被砍掉的理由（任务 17）。
 *
 * ⚠️ 拿掉那张表要先补上它唯一不可替代的东西：**第一格是连结**。
 * 所以下面第三条量的是那个，而且走的是真的渲染，不是读 props。
 */
const BOARD_PAGES: PageKey[] = ["projects", "tasks"];

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

function nodesOf(slug: string, key: PageKey): PuckNode[] {
  const keys = PAGES_FOR_INDUSTRY[slug] ?? [];
  const layout = buildPageLayout(key, ctxFor(slug), "兴发", "zh", keys.map((k) => ({ key: k }))) as unknown as {
    content: PuckNode[];
  };
  return [...walkNodes(layout.content)];
}

describe("看板那两页", () => {
  const pairs = Object.keys(PAGES_FOR_INDUSTRY).flatMap((slug) =>
    BOARD_PAGES.filter((k) => (PAGES_FOR_INDUSTRY[slug] ?? []).includes(k)).map(
      (k) => [slug, k] as const,
    ),
  );

  it("八个行业里真的有几页是板 —— 没有的话下面全部假装通过", () => {
    expect(pairs.length).toBeGreaterThan(2);
  });

  it("有一块板", () => {
    for (const [slug, key] of pairs) {
      expect(
        nodesOf(slug, key).some((n) => n.type === "TaskBoard"),
        `${slug}/${key}`,
      ).toBe(true);
    }
  });

  it("同一批记录不画两次 —— 板底下没有第二张表", () => {
    const bad: string[] = [];
    for (const [slug, key] of pairs) {
      const nodes = nodesOf(slug, key);
      if (nodes.some((n) => n.type === "TaskBoard") && nodes.some((n) => n.type === "RecordTable")) {
        bad.push(`${slug}/${key}`);
      }
    }
    expect(bad, `这几页把同一批记录画了两次：${bad.join(" · ")}`).toEqual([]);
  });

  /* ⚠️ 这一块要在浏览器那一边渲染，不能用 `renderToStaticMarkup`：
     看板底下那一层（kibo 的 DragOverlay）用 `createPortal`，
     而 React 的服务端渲染器直接拒绝 portal。 */
  it("卡片有 href 就是一个连结 —— 那是表格拿掉之后唯一的入口", () => {
    const stages = [{ name: "施工" }];
    const open = render(
      <TaskBoard
        stages={stages}
        cards={[{ title: "Taman Desa 三房翻新", stage: "施工", href: "/zh/portal/projects/abc" }]}
      />,
    );
    expect(
      open.container.querySelector('a[href="/zh/portal/projects/abc"]')?.textContent,
    ).toContain("Taman Desa");
    open.unmount();

    /* 示例没有 href，所以示范的板点不动 —— 跟表格同一条规矩。 */
    const sample = render(
      <TaskBoard stages={stages} cards={[{ title: "Taman Desa 三房翻新", stage: "施工" }]} />,
    );
    expect(sample.container.querySelector("a")).toBeNull();
  });

  it("金额自己一行、不断行", () => {
    const { container } = render(
      <TaskBoard
        stages={[{ name: "施工" }]}
        cards={[{ title: "一单", stage: "施工", note: "陈先生", amount: "RM 48,500" }]}
      />,
    );
    /* 断成两行的金额读起来是一个错的数字 —— 同一条守卫 9-03 在手机上装过一次。 */
    const money = [...container.querySelectorAll("p")].find((el) =>
      el.textContent?.includes("RM 48,500"),
    );
    expect(money, "卡片上找不到金额").toBeTruthy();
    expect(money?.className).toContain("whitespace-nowrap");
    // 对方还在，只是不再跟金额挤在同一句里。
    expect(container.textContent).toContain("陈先生");
    expect(money?.textContent).not.toContain("陈先生");
  });

  it("每一栏写着自己有几张", () => {
    const { container } = render(
      <TaskBoard
        stages={[{ name: "施工" }, { name: "尾款" }]}
        cards={[
          { title: "a", stage: "施工" },
          { title: "b", stage: "施工" },
          { title: "c", stage: "尾款" },
        ]}
      />,
    );
    const heads = [...container.querySelectorAll("span")]
      .map((el) => el.textContent ?? "")
      .filter((t) => t.startsWith("施工") || t.startsWith("尾款"));
    expect(heads.some((t) => t === "施工2"), heads.join("|")).toBe(true);
    expect(heads.some((t) => t === "尾款1"), heads.join("|")).toBe(true);
  });
});
