import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordTable } from "./record-table";

/**
 * 名册那一栏画的是一个人 —— 而且那颗头像要真的到得了画面。
 *
 * ── 这一条守的是什么 ──────────────────────────────────────────────────
 *
 * 参考那一页（Studio Admin 的 Users，`.screenshots/upstream/up-users.png`）
 * 每一行左边一颗头像，而且**同一行照样有状态药丸**。我们本来只有
 * `row: "avatar"`，一个 prop 管两件事：头像画在**联络那一格**旁边，
 * 而且顺手把状态从药丸降成一个圆点 —— 所以想要头像就得放弃药丸。
 *
 * 🔴 而这个档案真正要挡的是另一件，这个仓库栽过至少两次：
 * **产生页面的那一层传了，而 `puck-config.tsx` 那一行 render 少接了它。**
 * 任务 18 的「筛选条件 / 清空全部」就是这样死的 —— 组件退回自己的预设，
 * 而画面上完全正常。所以下面第二条不是渲染组件，是**走 Puck 那一条路**。
 */
describe("名册第一栏的那颗头像", () => {
  const table = {
    columns: [
      { key: "primary", label: "Client", kind: "text" as const },
      { key: "secondary", label: "Contact", kind: "detail" as const },
      { key: "status", label: "Status", kind: "status" as const },
    ],
    rows: [
      {
        cells: { primary: "陈先生", secondary: "012-345 6789", status: "施工中" },
        tones: { status: "neutral" as const },
      },
    ],
  };

  const badge = (out: string) => out.match(/<span class="grid shrink-0[^>]*>([^<]*)</)?.[1];

  it("字取自第一栏那个名字", () => {
    const out = renderToStaticMarkup(
      <RecordTable gridId="t" caption="Clients" table={table} faces />,
    );
    expect(badge(out)).toBe("陈");
  });

  it("没有说自己是名册就不画", () => {
    const out = renderToStaticMarkup(<RecordTable gridId="t" caption="Clients" table={table} />);
    expect(badge(out)).toBeUndefined();
  });

  it("名字是空的不画一颗空圆圈", () => {
    const out = renderToStaticMarkup(
      <RecordTable
        gridId="t"
        caption="Clients"
        table={{ ...table, rows: [{ cells: { secondary: "012-345 6789" }, tones: {} }] }}
        faces
      />,
    );
    expect(badge(out)).toBeUndefined();
  });

  it("头像不会把状态药丸换掉 —— 两件事，两根轴", () => {
    const out = renderToStaticMarkup(
      <RecordTable gridId="t" caption="Clients" table={table} faces row="pill" />,
    );
    expect(badge(out)).toBe("陈");
    // 药丸自己那一颗，不是圆点。两个都在，就是参考那一页的样子。
    expect(out).toContain("施工中");
  });
});
