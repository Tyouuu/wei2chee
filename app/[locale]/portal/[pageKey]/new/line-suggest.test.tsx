import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LineEditor, blankLine, linesBlank, type Line, type LineSuggest } from "./line-editor";
import { fillFromShelf, type ShelfItem } from "./line-suggest";
import { RECORD_COPY } from "../record-copy";

/**
 * 省他的字，不可以拿「猜」来省。
 *
 * ── 这一份守的三条 ────────────────────────────────────────────────────────
 *
 * 1. 🔴 **「照上次那一张」只在整张明细还空着的时候画。**
 *    它按下去是整批换掉 —— 出现在一张打了一半的单上，就是一颗会吃掉他的字
 *    的按钮，而**他不会知道少了什么**。
 *
 * 2. 🔴 **挑一件货，不准盖掉他已经打的价。**
 *    [任务 144]：目录上的价是他平常卖的价，这一单谈的价是这一单的。
 *    一个会盖掉他谈好的价的目录，他第二天就不敢用了。
 *
 * 3. **他自己打的一句话照样打得进去。**
 *    「拆除旧厨房」不在任何人的货架上，而那是装修每一张单的第一行 ——
 *    所以那一格是 datalist 不是下拉，而这一条量的是「有没有留一条自己打的路」。
 *
 * ── 为什么是元件测试，不是浏览器 ──────────────────────────────────────────
 *
 * 第 1 条要的是**两个状态并排比**（空的 vs 打了一半），而一个用完就删的帐号
 * 造得出前者、造不出后者 —— 那要有人先在浏览器里打字。
 * ⚠️ 而这一份**不取代**用眼睛看：它答得了「那颗按钮在不在」，
 * 答不了「那一格挤不挤得下」。
 *
 * ── 三条都故意弄坏看过它红（2026-09-05） ──────────────────────────────────
 *
 * 拿掉 `linesBlank` · 拿掉两条「不盖掉」→ 当场红 3 条。
 */

const copy = RECORD_COPY.en.form;

/* 🔴 River sand 卖完了，而它在这份名单里排**第一** ——
   只有排序真的在跑，它才掉得到后面。
   第一版把它摆在后面，於是那一条断言**拆掉排序也照样绿**：
   一条量不到东西的断言，跟一条真的在守的，在报告里长得一模一样。 */
const shelf: ShelfItem[] = [
  { itemId: "i2", name: "River sand", unit: "load", priceCents: 12000, onHand: 0 },
  { itemId: "i1", name: "Cement 50kg", unit: "bag", priceCents: 1850, onHand: 84 },
];

const lastTime: Line[] = [
  { description: "Cement 50kg", qty: "100", unit: "bag", unitPrice: "18.50", amount: "1850.00" },
];

const suggest = (over: Partial<LineSuggest> = {}): LineSuggest => ({
  items: shelf,
  units: ["bag", "load", "piece"],
  lastLines: lastTime,
  lastFrom: { docNo: "QT-2026-0007", on: "2026-08-12" },
  fill: (l) => fillFromShelf(l, shelf),
  ...over,
});

const draw = (lines: Line[], s?: LineSuggest) =>
  renderToStaticMarkup(<LineEditor lines={lines} onChange={() => {}} copy={copy} suggest={s} />);

describe("上次那一张", () => {
  it("整张空着的时候给", () => {
    expect(draw([blankLine()], suggest())).toContain(copy.lineUseLast);
  });

  it("🔴 他打了一个字就不给 —— 按下去会盖掉他打的", () => {
    const half: Line[] = [{ ...blankLine(), description: "拆除旧厨房" }];
    expect(linesBlank(half)).toBe(false);
    expect(draw(half, suggest())).not.toContain(copy.lineUseLast);
  });

  it("这个客人没有上一张就不给", () => {
    expect(draw([blankLine()], suggest({ lastLines: null }))).not.toContain(copy.lineUseLast);
  });

  it("一支都没接的时候，那一页跟以前一模一样", () => {
    const plain = draw([blankLine()]);
    expect(plain).not.toContain(copy.lineUseLast);
    expect(plain).not.toContain("<datalist");
    /* 加一行照旧在 —— 这一条挡的是「接了新东西把旧的弄坏」 */
    expect(plain).toContain(copy.lineAdd);
  });
});

describe("挑一件货", () => {
  it("空的那几格填进去", () => {
    const l: Line = { ...blankLine(), description: "Cement 50kg" };
    expect(fillFromShelf(l, shelf)).toEqual({ unit: "bag", unitPrice: "18.50" });
  });

  it("🔴 他已经打的价不准盖掉", () => {
    const l: Line = { ...blankLine(), description: "Cement 50kg", unitPrice: "17.00" };
    expect(fillFromShelf(l, shelf)).toEqual({ unit: "bag" });
  });

  it("🔴 单位也一样，打过的不动", () => {
    const l: Line = { ...blankLine(), description: "Cement 50kg", unit: "包", unitPrice: "17.00" };
    expect(fillFromShelf(l, shelf)).toBeUndefined();
  });

  it("他自己打的一句话，什么都不做", () => {
    const l: Line = { ...blankLine(), description: "拆除旧厨房" };
    expect(fillFromShelf(l, shelf)).toBeUndefined();
  });

  it("货架还没抓回来也不会炸", () => {
    expect(fillFromShelf({ ...blankLine(), description: "Cement 50kg" }, null)).toBeUndefined();
  });
});

describe("那两份清单", () => {
  it("货架跟单位都画得出来", () => {
    const html = draw([blankLine()], suggest());
    expect(html).toContain("Cement 50kg");
    expect(html).toContain("River sand");
    expect(html).toContain('value="bag"');
  });

  it("🔴 卖完的排在后面 —— 排第一是让他每一次都要滑过去", () => {
    const html = draw([blankLine()], suggest());
    expect(html.indexOf("Cement 50kg")).toBeLessThan(html.indexOf("River sand"));
  });

  it("🔴 有货架才讲「打前几个字」—— 没有的时候那是一句假话", () => {
    /* 装修那一行开局没有库存那一页（`PAGES_FOR_INDUSTRY.renovation`），
       所以 `suggest_items` 回空的。对他讲「你自己的货会出来」就是骗他。 */
    expect(draw([blankLine()], suggest())).toContain(copy.lineShelfHint);
    expect(draw([blankLine()], suggest({ items: [] }))).not.toContain(copy.lineShelfHint);
    expect(draw([blankLine()], suggest({ items: null }))).not.toContain(copy.lineShelfHint);
  });

  it("🔴 清单里只有名字，没有价钱", () => {
    /* 那一格的字会被原样填进「是什么」，而
       「Cement 50kg · RM 18.50」不是一个货品名。 */
    const list = draw([blankLine()], suggest()).split("<datalist")[1] ?? "";
    expect(list).not.toContain("18.50");
  });
});
