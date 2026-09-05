/**
 * 钱那几页照 `finance` 抄的那两个形状 —— 一个矩形切成格 · 名字加比例条。
 *
 * 两条都不是「好不好看」，是**它到底是不是另一个东西**（[重点 7c]）：
 *   · `quad` 跟 `boxed` 的差别是**共用一个框**。共用不了，它就只是有框再来一次
 *   · `bars` 跟另外三种的差别是**那条比例条**。条子不按金额长，它就只是一张清单
 *
 * ⚠️ 两条都故意弄坏看过它红才留下（没有人看过它红的守卫等於没有守卫）。
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StatRow } from "./stat-row";
import { RankList } from "./rank-list";

const TILES = [
  { label: "Received this month", value: "RM 30,850", deltaLabel: "vs last month", iconName: "payments" },
  { label: "Entries", value: "5", deltaLabel: "Counted on the day the money arrived", iconName: "reconciliation" },
];

/** 一个元素身上有没有「我是一个框」那一笔。`quad` 只准有一个。 */
const boxed = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>("*")].filter((el) =>
    el.className.includes("[border:var(--border-card-width)"),
  );

describe("StatRow 的 quad —— 一个矩形切成格", () => {
  it("整组只有一个框，格子自己不带框", () => {
    const { container } = render(<StatRow tiles={TILES} layout="quad" />);
    expect(boxed(container)).toHaveLength(1);
    /* 而那一个框就是最外面那一层 —— 框在里面就不是「共用」，是「其中一格有框」。 */
    expect(boxed(container)[0]).toBe(container.firstElementChild);
  });

  it("格线是缝，不是每一格自己画一条", () => {
    const { container } = render(<StatRow tiles={TILES} layout="quad" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("gap-px");
    /* 缝要看得见，所以底下那一层是线色。 */
    expect(root.className).toContain("[background:var(--border-subtle)]");
  });

  it("🔴 不画那个上了色的图标方块 —— 参考那四格一个图标都没有", () => {
    const { container } = render(<StatRow tiles={TILES} layout="quad" />);
    const tinted = [...container.querySelectorAll<HTMLElement>("span")].filter((el) =>
      el.className.includes("var(--color-primary-soft)"),
    );
    expect(tinted).toHaveLength(0);
  });

  it("`boxed` 照旧是几张分开的卡 —— 两种不可以合成一种", () => {
    const { container } = render(<StatRow tiles={TILES} layout="boxed" />);
    expect(boxed(container)).toHaveLength(TILES.length);
  });
});

const ROWS = [
  { name: "Hup Seng Trading", sub: "Deposit", amount: "RM 12,000" },
  { name: "KL Metalworks", sub: "Deposit", amount: "RM 6,000" },
  { name: "Pantai Interiors", sub: "Deposit", amount: "RM 2,000" },
];

/** 那条比例条的**填色**那一段。
 *  ⚠️ 第一版写成「有 inline 宽度又有底色的 span」，而 `person` 那一种的头像
 *  正好两样都有 —— 於是它对着三张头像叫「另外三种也画了条」。
 *  **红的是选择器，不是产品。** 认轨道（那个 6px 高的槽），再拿它里面那一段。 */
const bars = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>("span")]
    .filter((el) => el.className.includes("h-[6px]"))
    .map((track) => track.firstElementChild as HTMLElement)
    .filter(Boolean);

describe("RankList 的 bars —— 名字 + 比例条", () => {
  it("条子按金额长，最大那一行满格", () => {
    const { container } = render(<RankList rows={ROWS} shape="bars" />);
    const widths = bars(container).map((el) => parseInt(el.style.width, 10));
    expect(widths).toHaveLength(3);
    expect(widths[0]).toBe(100);
    /* 12000 : 6000 : 2000 → 100 : 50 : 17 */
    expect(widths[1]).toBe(50);
    expect(widths[2]).toBe(17);
    expect(widths[0]).toBeGreaterThan(widths[2]);
  });

  it("占几成算出来，而且是占全部不是占最大那一行", () => {
    const { container } = render(<RankList rows={ROWS} shape="bars" />);
    /* 12000 / 20000 = 60% */
    expect(container.textContent).toContain("60%");
    expect(container.textContent).toContain("30%");
    expect(container.textContent).toContain("10%");
  });

  it("🔴 一个金额都读不出来就不画条 —— 一排全长的空条不是资讯，是噪音", () => {
    const { container } = render(
      <RankList rows={[{ name: "A" }, { name: "B" }]} shape="bars" />,
    );
    expect(bars(container)).toHaveLength(0);
    /* 名字照旧要在 —— 没有条不等於没有那一行。 */
    expect(container.textContent).toContain("A");
  });

  it("画出来的还是他自己那串字，不是我们算出来的数字", () => {
    const { container } = render(<RankList rows={ROWS} shape="bars" />);
    expect(container.textContent).toContain("RM 12,000");
  });

  it("另外三种一条比例条都不画 —— 四种是四个物件，不是一张图的四种漆", () => {
    for (const shape of ["plain", "badge", "person"] as const) {
      const { container } = render(<RankList rows={ROWS} shape={shape} />);
      expect(bars(container)).toHaveLength(0);
    }
  });
});
