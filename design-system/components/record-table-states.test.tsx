/* 一张表的三种状态，每一种都要讲话。
 *
 * 老板 2026-09-02：「每一个页面 每一页状态 你就没有复刻好」。
 *
 * 这张表本来只画过一种状态：**有资料**。另外两种它都渲染成一个表头加一片空白 ——
 * 而那两种正好是最需要讲话的时候：
 *
 *   有资料      画出来                     ← 本来就对
 *   一行都没有  一个真实客户第一天看到的     ← **本来是空白的**
 *   筛不到      刚打完字的人看到的           ← **本来也是空白的**
 *
 * 空白的两种在画面上长得一模一样，而它们是完全不同的两件事：
 * 一个是「还没开始」，一个是「找不到」。分不出来的人会以为系统坏了。
 *
 * ⚠️ 这一条是 `check:table-search` 在浏览器里抓到的，那支要跑 dev server 跟真的
 * 帐号；这一份是同一件事的单元版，跟着每一次提交跑。
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecordTable } from "./record-table";
import type { TableModel } from "@/lib/portal/table-model";

const MODEL: TableModel = {
  columns: [
    { key: "primary", label: "Project", kind: "text" },
    { key: "amount", label: "Amount", kind: "amount" },
  ],
  rows: [
    { cells: { primary: "Taman Desa 3-room reno", amount: "RM 48,500" }, tones: {} },
    { cells: { primary: "Bukit Jalil kitchen", amount: "RM 22,800" }, tones: {} },
  ],
};

describe("一张表的三种状态", () => {
  it("有资料就画资料", () => {
    render(<RecordTable gridId="t1" caption="Recent projects" table={MODEL} />);
    expect(screen.getByText("Taman Desa 3-room reno")).toBeTruthy();
  });

  it("🔴 一行都没有的时候要讲一句话，不是留一片空白", () => {
    render(
      <RecordTable gridId="t2" caption="Recent projects" table={{ ...MODEL, rows: [] }} />,
    );
    const body = document.querySelector("tbody");
    expect(body, "表格没有 tbody").toBeTruthy();
    /* 讲什么由 system-words 决定，这里守的是**它有没有讲** ——
       一个空的 tbody 就是这条守卫存在的理由。 */
    expect(
      (body?.textContent ?? "").trim().length,
      "零行的时候 tbody 是空的 —— 客户分不出「还没开始」跟「坏了」",
    ).toBeGreaterThan(0);
  });

  it("⚠️ 而且那句话讲的是「还没有」，不是「找不到」", () => {
    render(
      <RecordTable gridId="t3" caption="Recent projects" table={{ ...MODEL, rows: [] }} />,
    );
    const text = document.querySelector("tbody")?.textContent ?? "";
    /* 「找不到」那一句一定带着他打的那个字。零行的时候没有字可以带，
       所以它绝不可以是那一句。 */
    expect(text).not.toMatch(/[“「]/);
  });
});
