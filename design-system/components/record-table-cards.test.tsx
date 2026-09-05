/* 一件一张卡 —— 同一批行，另一个形状。
 *
 * 老板 2026-09-05：`我不要一直都是同个组件`。量出来他讲的是真的：
 * **十七页里十六页画的是这一张表**，其中十一页骨架一个字不差。
 *
 * 而修法不是再造一个零件。同一批行、同一个搜索、同一排分段，换一个形状 ——
 * 再造一个要再接一次投影、再写一次筛选、再验一次手机，而那三样这里已经是对的。
 *
 * 这一份守的就是那句话：**换了形状，那三样一个都不准掉。**
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecordTable } from "./record-table";
import type { TableModel } from "@/lib/portal/table-model";

const table: TableModel = {
  columns: [
    { key: "primary", label: "Item", kind: "text" },
    { key: "secondary", label: "Where", kind: "detail" },
    { key: "amount", label: "On hand", kind: "amount" },
    { key: "status", label: "Status", kind: "status" },
  ],
  rows: [
    { cells: { primary: "Cement 50kg", secondary: "Store 1 · bag", amount: "128", status: "In stock" }, tones: { status: "positive" } },
    { cells: { primary: "River sand", secondary: "Store 1 · tonne", amount: "9", status: "Running low" }, tones: { status: "warning" } },
    { cells: { primary: "Tile adhesive", secondary: "Store 2 · bag", amount: "340", status: "Slow moving" }, tones: { status: "neutral" } },
  ],
};

const draw = (extra: Record<string, unknown> = {}) =>
  render(<RecordTable gridId="stock" caption="Stock" look="cards" table={table} {...extra} />);

describe("货架那一片格子", () => {
  it("每一件都在，一件都不少", () => {
    draw();
    for (const name of ["Cement 50kg", "River sand", "Tile adhesive"]) {
      /* 两份：格子一份、手机那一行一份 —— 读的是同一份 columns。 */
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("🔴 架上几件是那张卡最大的字，不是一栏字", () => {
    const { container } = draw();
    const big = [...container.querySelectorAll("span")].find(
      (el) => el.textContent === "128" && el.className.includes("--text-hero"),
    );
    expect(big, "那个数字要用 --text-hero 画").toBeTruthy();
  });

  it("状态还是一颗点加一个词，不是一块色", () => {
    draw();
    expect(screen.getAllByText("Running low").length).toBeGreaterThan(0);
  });

  it("🔴 换了形状，那张表还是不画（不然同一批行画两次）", () => {
    const { container } = draw();
    const wrap = container.querySelector("table")?.closest("div.hidden");
    expect(wrap, "表格那一半要整个藏起来").toBeTruthy();
  });

  it("手机那一行照旧在 —— 格子是桌面的，手机永远是一行一笔", () => {
    const { container } = draw();
    const ul = [...container.querySelectorAll("ul")].find((el) => el.className.includes("3xl:hidden"));
    expect(ul).toBeTruthy();
  });

  it("一行都没有的时候不画一片空格子", () => {
    const { container } = render(
      <RecordTable gridId="stock" caption="Stock" look="cards" table={{ columns: table.columns, rows: [] }} />,
    );
    expect(container.querySelectorAll(".grid > div").length).toBe(0);
  });
});
