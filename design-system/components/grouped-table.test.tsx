/**
 * 一组一张表 —— 出处 arhamkhnz 的 `infrastructure`。
 *
 * 那一页每一个专案自己一个标题、自己一段表身，而不是一整张平表配一个
 * 「哪一组」栏。对帐那一页要的是同一件事：一个经销商每个月跟三家对，
 * 三家的数字混在一张表里，他要用眼睛自己分组。
 *
 * ⚠️ 守的重点是**两组以上才分** —— 一组的时候画一个组标题，
 * 就是在一张表上面加一行没有作用的字。跟那一排只有一个选项的分段
 * 是同一个毛病，而这个仓库刚花了一整轮把那一排拿掉。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RecordTable } from "./record-table";

const COLUMNS = [
  { key: "primary", label: "Period", kind: "text" as const },
  { key: "secondary", label: "Source", kind: "detail" as const },
  { key: "amount", label: "Theirs", kind: "amount" as const },
  { key: "status", label: "Status", kind: "status" as const },
];

const row = (period: string, source: string, amount: string) => ({
  cells: { primary: period, secondary: source, amount, status: "Checked" },
  tones: { status: "positive" as const },
});

const THREE = [
  row("Sep 2026", "Maybank", "RM 30,850"),
  row("Aug 2026", "Maybank", "RM 21,400"),
  row("Sep 2026", "Celcom", "RM 12,000"),
];
const ONE = [row("Sep 2026", "Maybank", "RM 30,850"), row("Aug 2026", "Maybank", "RM 21,400")];

const heads = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('th[scope="colgroup"]')].map((el) =>
    (el.textContent ?? "").trim(),
  );

describe("RecordTable 的一组一张表", () => {
  it("两组以上，一组一个标题", () => {
    const { container } = render(
      <RecordTable gridId="g" caption="对帐" table={{ columns: COLUMNS, rows: THREE }} grouped />,
    );
    expect(heads(container)).toEqual(["Maybank", "Celcom"]);
  });

  it("🔴 只有一组就不分 —— 一行没有作用的字比没有更糟", () => {
    const { container } = render(
      <RecordTable gridId="g" caption="对帐" table={{ columns: COLUMNS, rows: ONE }} grouped />,
    );
    expect(heads(container)).toEqual([]);
  });

  it("没有开的时候一个组标题都不画", () => {
    const { container } = render(
      <RecordTable gridId="g" caption="对帐" table={{ columns: COLUMNS, rows: THREE }} />,
    );
    expect(heads(container)).toEqual([]);
  });

  it("一行都不丢，而且顺序照第一次出现", () => {
    const { container } = render(
      <RecordTable gridId="g" caption="对帐" table={{ columns: COLUMNS, rows: THREE }} grouped />,
    );
    const text = container.textContent ?? "";
    for (const amount of ["RM 30,850", "RM 21,400", "RM 12,000"]) {
      expect(text, `${amount} 不见了`).toContain(amount);
    }
    /* Maybank 先出现，所以它排前面 —— 一张自己重排过顺序的表，
       读起来像资料变了。 */
    expect(text.indexOf("Maybank")).toBeLessThan(text.indexOf("Celcom"));
  });

  it("底下那一条数的还是全部的行，不是组数", () => {
    const { container } = render(
      <RecordTable gridId="g" caption="对帐" table={{ columns: COLUMNS, rows: THREE }} grouped />,
    );
    expect(container.textContent).toContain("3");
  });
});
