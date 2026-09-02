/* 点栏头排序 —— 而且金额要按数字排。
 *
 * `align:admin` 2026-09-02 量出来：**参考那一页四栏可以点着排，我们零栏。**
 *
 * ⚠️ 这一条真正守的是**金额那一栏**。照字排的话「RM 9,600」会排在
 * 「RM 48,500」后面（9 > 4），而一张把最大那一单排到最下面的表，
 * 比一张不能排的表更糟 —— 它看起来在回答问题，答案是错的。
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecordTable } from "../components/record-table";
import type { TableModel } from "@/lib/portal/table-model";

const MODEL: TableModel = {
  columns: [
    { key: "primary", label: "Project", kind: "text" },
    { key: "amount", label: "Amount", kind: "amount" },
  ],
  rows: [
    /* ⚠️ 这三个数字是**挑过的**，不是随手写的。
       浏览器自己的「带数字的字串比较」会把「RM 900」跟「RM 1,200」比成
       900 > 1（它读到逗号就断了），於是一千二排在九百前面 —— 而那是错的。
       第一版的样本是 9,600 / 48,500 / 22,800，那三个**照字排也刚好是对的**，
       所以我把金额那一支拿掉，测试照样全绿。**一条没有人看过它红的守卫，
       等於没有守卫。** 换成这一组之后，拿掉那一支当场红。 */
    { cells: { primary: "Bukit Jalil kitchen", amount: "RM 1,200" }, tones: {} },
    { cells: { primary: "Cheras shoplot fitout", amount: "RM 900" }, tones: {} },
    { cells: { primary: "Ampang retile", amount: "RM 48,500" }, tones: {} },
  ],
};

const amounts = () =>
  [...document.querySelectorAll("tbody tr")].map(
    (r) => r.querySelectorAll("td")[1]?.textContent?.trim() ?? "",
  );

describe("表格排序", () => {
  it("不点的时候是他自己的顺序", () => {
    render(<RecordTable gridId="s0" caption="Recent" table={MODEL} />);
    expect(amounts()).toEqual(["RM 1,200", "RM 900", "RM 48,500"]);
  });

  it("🔴 金额按数字排，不按字排", () => {
    render(<RecordTable gridId="s1" caption="Recent" table={MODEL} />);
    fireEvent.click(screen.getByRole("button", { name: /Amount/ }));
    /* 照字排会把 1,200 排在 900 前面。 */
    expect(amounts()).toEqual(["RM 900", "RM 1,200", "RM 48,500"]);
  });

  it("再点一下反过来", () => {
    render(<RecordTable gridId="s2" caption="Recent" table={MODEL} />);
    const b = screen.getByRole("button", { name: /Amount/ });
    fireEvent.click(b);
    fireEvent.click(b);
    expect(amounts()).toEqual(["RM 48,500", "RM 1,200", "RM 900"]);
  });

  it("第三下回到他自己的顺序 —— 不是在两个方向之间来回", () => {
    render(<RecordTable gridId="s3" caption="Recent" table={MODEL} />);
    const b = screen.getByRole("button", { name: /Amount/ });
    fireEvent.click(b);
    fireEvent.click(b);
    fireEvent.click(b);
    expect(amounts()).toEqual(["RM 1,200", "RM 900", "RM 48,500"]);
  });

  it("读屏的人也知道现在按哪一栏排", () => {
    render(<RecordTable gridId="s4" caption="Recent" table={MODEL} />);
    fireEvent.click(screen.getByRole("button", { name: /Amount/ }));
    const th = [...document.querySelectorAll("th")].find((h) => /Amount/.test(h.textContent ?? ""));
    expect(th?.getAttribute("aria-sort")).toBe("ascending");
  });
});
