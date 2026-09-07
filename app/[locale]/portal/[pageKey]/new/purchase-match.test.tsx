import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PurchaseMatch, type PurchaseMatchFacts } from "./purchase-match";
import { RECORD_COPY } from "../record-copy";

/**
 * 「这张单对不对得上」—— 而三种坏法要讲三句不同的话。
 *
 * ── 这一份守的四条 ────────────────────────────────────────────────────────
 *
 * 1. 🔴 **一张什么都还没发生的新单不是「对不上」。** 那是一张进货单
 *    大部分时间待着的状态（20260906070000 的档头就是这句话），
 *    讲成警报就是天天叫狼，而一份天天叫狼的报告没有人看。
 *
 * 2. 🔴 **付多了排最前面。** 顺序照的是「他会赔多少钱」，
 *    不是栏位顺序 —— 付多了是唯一一种钱已经出去而拿不回来的。
 *
 * 3. **一口价那种单不印「到了几行」。** 一行数量都没有的单
 *    （「运费 RM 300」）身上那个 0/0 读起来像还没到。
 *
 * 4. **还欠 0 的时候不画那一格。** 一个永远写着 RM 0 的格子是杂讯，
 *    而「付清了」那一句已经在上面讲过。
 *
 * ── 四条都故意弄坏看过它红（2026-09-07） ──────────────────────────────────
 */

const copy = RECORD_COPY.en.form;
const money = (c: number) => `RM ${(c / 100).toFixed(2)}`;

const facts = (over: Partial<PurchaseMatchFacts>): PurchaseMatchFacts => ({
  orderedCents: 185000,
  paidCents: 0,
  unpaidCents: 185000,
  linesTotal: 2,
  linesArrived: 0,
  arrived: false,
  overpaidCents: 0,
  ...over,
});

const draw = (over: Partial<PurchaseMatchFacts>) =>
  renderToStaticMarkup(
    <PurchaseMatch facts={facts(over)} money={money} copy={copy} />,
  );

describe("这张单对不对得上", () => {
  it("🔴 什么都还没发生的新单不是警报", () => {
    const html = draw({});
    expect(html).not.toContain("data-match-alarm");
    expect(html).toContain(copy.matchOpen);
  });

  it("🔴 付多了排最前面 —— 而且是警报", () => {
    /* 全部到了、也付清了，而且多付了 —— 那三句只有一句该出现。 */
    const html = draw({
      paidCents: 200000,
      unpaidCents: 0,
      linesArrived: 2,
      arrived: true,
      overpaidCents: 15000,
    });
    expect(html).toContain("data-match-alarm");
    expect(html).toContain(copy.matchOverpaid);
    expect(html).not.toContain(copy.matchSettled);
  });

  it("钱付了货没到，讲的是那一句", () => {
    const html = draw({ paidCents: 185000, unpaidCents: 0 });
    expect(html).toContain(copy.matchPaidNotArrived);
  });

  it("货到了钱没付，讲的是另外那一句", () => {
    const html = draw({ linesArrived: 2, arrived: true });
    expect(html).toContain(copy.matchArrivedNotPaid);
  });

  it("对得上的时候安静，而且不画那条警报带", () => {
    const html = draw({
      paidCents: 185000,
      unpaidCents: 0,
      linesArrived: 2,
      arrived: true,
    });
    expect(html).toContain(copy.matchSettled);
    expect(html).not.toContain("data-match-alarm");
  });

  it("一口价那种单不印「到了几行」", () => {
    const html = draw({ linesTotal: 0, linesArrived: 0 });
    expect(html).not.toContain(copy.matchArrived);
    expect(html).not.toContain("0/0");
  });

  it("还欠 0 的时候不画那一格", () => {
    const html = draw({
      paidCents: 185000,
      unpaidCents: 0,
      linesArrived: 2,
      arrived: true,
    });
    expect(html).not.toContain(copy.matchUnpaid);
  });

  it("三个数字是他自己那张单上的", () => {
    const html = draw({ paidCents: 50000, unpaidCents: 135000 });
    expect(html).toContain("RM 1850.00");
    expect(html).toContain("RM 500.00");
    expect(html).toContain("RM 1350.00");
  });
});
