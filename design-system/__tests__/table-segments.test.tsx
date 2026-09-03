/* 表格上面那一排分段，按下去要真的筛。
 *
 * 老板 2026-09-03：`你先把人家的组件做进来啊 我没看到多少啊`。
 *
 * 那一排在这之前是一串 `<span>` —— 长得完全像一个分段控件（All / 进行中 /
 * 等收款），按下去什么都不会发生，而且它画在**每一张表**上。
 * `record-table.tsx` 自己在底下三十行写着：
 * 「一个什么都不做的框是缺陷，不是装饰」—— 搜索框照做了，这一排没有。
 *
 * ⚠️ 三件一起验，因为只做第一件会造出新的谎：
 *   ① 按下去行数真的变少
 *   ② 上面那个「几笔」跟着变（写着 7 笔压在 2 行上面，是另一个方向的同一句谎）
 *   ③ 筛到零行的时候要**讲出来**（不然表身一片空白，读起来像坏了）
 */
import { describe, expect, it } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { RecordTable } from "@/design-system/components/record-table";

const table = {
  columns: [
    { key: "primary", label: "Work", kind: "text" as const },
    { key: "status", label: "Status", kind: "status" as const },
  ],
  rows: [
    { cells: { primary: "Taman Desa reno", status: "Confirmed" } },
    { cells: { primary: "Bukit Jalil kitchen", status: "Awaiting reply" } },
    { cells: { primary: "Cheras fitout", status: "Confirmed" } },
  ],
};

const body = (c: HTMLElement) => within(c.querySelector("tbody") as HTMLElement);

describe("表格的分段", () => {
  it("按一段，行数真的变少", () => {
    const { container, getByText } = render(
      <RecordTable gridId="t" caption="Quotations" table={table} tools="search" filters={["Confirmed", "Awaiting reply"]} />,
    );
    expect(container.querySelectorAll("tbody tr").length).toBe(3);
    fireEvent.click(getByText("Awaiting reply", { selector: "button" }));
    expect(container.querySelectorAll("tbody tr").length).toBe(1);
    expect(body(container).getByText("Bukit Jalil kitchen")).toBeTruthy();
  });

  it("上面那个条数跟着变", () => {
    const { container, getByText } = render(
      <RecordTable gridId="t" caption="Quotations" table={table} tools="search" filters={["Confirmed"]} />,
    );
    expect(container.textContent).toContain("3");
    fireEvent.click(getByText("Confirmed", { selector: "button" }));
    expect(container.textContent).toContain("2");
  });

  it("按回「全部」就回来", () => {
    const { container, getByText, getAllByRole } = render(
      <RecordTable gridId="t" caption="Quotations" table={table} tools="search" filters={["Confirmed"]} />,
    );
    fireEvent.click(getByText("Confirmed", { selector: "button" }));
    expect(container.querySelectorAll("tbody tr").length).toBe(2);
    fireEvent.click(getAllByRole("button", { pressed: false })[0]);
    expect(container.querySelectorAll("tbody tr").length).toBe(3);
  });

  it("筛到零行要讲出来 —— 不准是一片空白", () => {
    const { container, getByText } = render(
      <RecordTable gridId="t" caption="Quotations" table={table} tools="search" filters={["Paid"]} />,
    );
    fireEvent.click(getByText("Paid", { selector: "button" }));
    expect(container.querySelectorAll("tbody tr").length).toBe(1);
    expect((container.querySelector("tbody")?.textContent ?? "").trim().length).toBeGreaterThan(0);
  });
});
