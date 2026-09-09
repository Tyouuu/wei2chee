/* 一天摊开，一个人一栏。
 *
 * ── 为什么是这一页，而不是一张椅子图 ────────────────────────────────────
 *
 * 老板 2026-09-09 转来他朋友的话：沙龙不像餐馆，椅子很少，画一张椅子图
 * 没有必要。去量过，**他朋友讲对了，而且外面那一批也是这样做的**：
 * Fresha 跟 Booksy（两家最大的）**都不给椅子图，给的是一个师傅一栏的日历**
 * —— 因为一间沙龙稀缺的是**师傅**不是椅子。
 * （餐馆反过来：桌子会撞，所以 Lightspeed 跟 Toast 把平面图当主画面。）
 *
 * 而另外四种画法全部是**一条清单** —— 一条清单答得了「接下来是谁」，
 * 答不了「**几点还排得下**」，后者是一间沙龙一天问最多次的那一句。
 *
 * ── 这一份守三件，三件都是真的会咬人的 ──────────────────────────────────
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DaySchedule } from "./trade-blocks";

const at = (time: string, title: string, who?: string, endTime?: string) => ({
  time,
  endTime,
  title,
  who,
});

describe("一天摊开，一个人一栏", () => {
  it("两个师傅就是两栏，抬头是他们的名字", () => {
    render(
      <DaySchedule
        shape="columns"
        rows={[
          at("09:30", "染发", "Amy"),
          at("11:00", "面部护理", "Jasmine"),
          at("14:30", "美甲", "Amy"),
        ]}
      />,
    );
    expect(screen.getByText("Amy")).toBeTruthy();
    expect(screen.getByText("Jasmine")).toBeTruthy();
    /* 三笔都在 —— 一个把同一个人第二笔吃掉的分栏，画面上完全正常。 */
    expect(screen.getByText("染发")).toBeTruthy();
    expect(screen.getByText("面部护理")).toBeTruthy();
    expect(screen.getByText("美甲")).toBeTruthy();
  });

  /* 🔴 这一条是这一份最要紧的。
     第一版把没有派人的那几笔**静静丢掉** —— 而一个还没安排的预约
     正好是她今天要处理的那一笔，少掉一笔比多一栏糟得多。 */
  it("还没安排的那一笔不会不见，它去最后那一栏", () => {
    render(
      <DaySchedule
        shape="columns"
        rows={[at("09:30", "染发", "Amy"), at("14:00", "美甲", undefined)]}
      />,
    );
    expect(screen.getByText("美甲")).toBeTruthy();
    expect(screen.getByText("还没安排")).toBeTruthy();
  });

  /* 🔴 没有讲要哪一种的时候，由这几行自己决定。
     产生页面那一层只送得出**示例**看到的答案，而真资料是投影换上去的 ——
     所以一间真的沙龙排满了师傅，以前照样画成一条清单。
     2026-09-09 实拍看到的就是那个样子（`.screenshots/trade/salon/`）。 */
  it("没有讲要哪一种，而这几行有人 —— 自己分栏", () => {
    render(<DaySchedule rows={[at("09:30", "染发", "Amy"), at("11:00", "洗剪吹", "Jasmine")]} />);
    expect(screen.getByText("Amy")).toBeTruthy();
    expect(screen.getByText("Jasmine")).toBeTruthy();
  });

  it("一行都没有人的时候，一个像素都不变", () => {
    render(<DaySchedule rows={[at("09:30", "洗剪吹")]} />);
    /* 分栏那一版永远会画出「还没安排」那一栏的抬头；这里不可以有。 */
    expect(screen.queryByText("还没安排")).toBeNull();
    expect(screen.getByText("洗剪吹")).toBeTruthy();
  });
  it("全部都派好了就没有那一栏", () => {
    render(
      <DaySchedule shape="columns" rows={[at("09:30", "染发", "Amy")]} />,
    );
    expect(screen.queryByText("还没安排")).toBeNull();
  });

  /* 一间一个人的店、一张补习课表，本来就没有「谁做的」这件事 ——
     那时候这一根轴自己退回原来那几种画法，而不是画一栏叫「（没有）」。 */
  it("一行都没有给的时候，退回原来那一种，一笔都不掉", () => {
    render(
      <DaySchedule
        shape="columns"
        rows={[at("09:30", "洗剪吹"), at("11:00", "染发")]}
      />,
    );
    expect(screen.getByText("洗剪吹")).toBeTruthy();
    expect(screen.getByText("染发")).toBeTruthy();
    expect(screen.queryByText("还没安排")).toBeNull();
  });

  /* 读不懂的时刻要丢掉：一块掉到早上零点的预约，在画面上看起来完全正常。 */
  it("读不懂的时刻丢掉，而读得懂的照旧在", () => {
    render(
      <DaySchedule
        shape="columns"
        rows={[at("09:30", "染发", "Amy"), at("稍后", "美甲", "Amy")]}
      />,
    );
    expect(screen.getByText("染发")).toBeTruthy();
    expect(screen.queryByText("美甲")).toBeNull();
  });
});
