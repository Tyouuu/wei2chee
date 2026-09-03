/**
 * 一箱 24 罐。
 *
 * ── 为什么这一格是批发跟五金的刚需 ────────────────────────────────────────
 *
 * [任务 61] 点过名：**进货用箱，卖出用罐**。一个杂货批发商的库存写着
 * 「91 罐」，而他站在仓库里看到的是**三箱多十九罐** —— 他数不出 91。
 *
 * ── 🔴 而这两栏早就存得进去了，只是没有人读 ──────────────────────────────
 *
 * `catalog_items.pack_size` / `pack_unit` 从 20260901070000 就在，
 * 表单也一直收得到（「一箱几个」「一箱叫什么」）——
 * **grep 全仓库，除了存跟读回表单，没有任何一个地方拿它算过东西。**
 * 他打了「1 箱 = 24 罐」，然后画面上什么都没有变。
 *
 * ── 底下的单位永远是「罐」 ────────────────────────────────────────────────
 *
 * 存进 `stock_moves` 的数量永远是**最小的那个单位**，箱只是一个说法。
 * 两个单位一起存，就是两个真相：他改了一箱有几罐，去年的箱数会跟着变，
 * 而去年的罐数不会 —— 而去年真正发生的是罐。
 *
 * ⚠️ 所以 `pack_size` 改了，**过去的流水一分都不会动**，只有「怎么念它」
 * 会变。那是对的，而且要讲出来，因为它看起来像一个 bug。
 */

/** 一箱有几个才算数。1 或者 0 或者空，就是没有箱这个概念。 */
export function hasPacks(packSize: number | null | undefined): boolean {
  return packSize != null && Number.isFinite(packSize) && packSize > 1;
}

export type Split = {
  /** 几箱 */
  packs: number;
  /** 剩几个 */
  loose: number;
};

/**
 * 91 罐、一箱 24 → 3 箱又 19 罐。
 *
 * ⚠️ 负数照样切得开（盘点差额可以是负的），而箱数跟零头**同号** ——
 * 「−3 箱 −19 罐」读得懂，「−4 箱 +5 罐」读不懂。
 */
export function splitPacks(qty: number, packSize: number): Split {
  if (!hasPacks(packSize) || !Number.isFinite(qty)) return { packs: 0, loose: qty };
  const sign = qty < 0 ? -1 : 1;
  const abs = Math.abs(qty);
  const packs = Math.floor(abs / packSize);
  /* 浮点数：24 * 3.0000000000000004 那一类。小数点后三位是
     `stock_moves.qty` 的精度（numeric(14,3)），所以对齐它。 */
  const loose = Math.round((abs - packs * packSize) * 1000) / 1000;
  return { packs: packs * sign, loose: loose * sign };
}

/** 3 箱又 19 罐 → 91。 */
export function fromPacks(packs: number, loose: number, packSize: number): number {
  const p = Number.isFinite(packs) ? packs : 0;
  const l = Number.isFinite(loose) ? loose : 0;
  if (!hasPacks(packSize)) return l;
  return Math.round((p * packSize + l) * 1000) / 1000;
}

/**
 * 画出来那一句：「3 箱 + 19 罐」。
 *
 * ⚠️ 整箱的时候不写「+ 0 罐」，零头不足一箱的时候不写「0 箱」——
 * 一句读起来像人讲的话，才有人会读它。
 * 而 `packSize` 没有的时候回 null（**不是空字串**）：呼叫的人照这个
 * 决定要不要画那一行，而不是画一行空的。
 */
export function packPhrase(
  qty: number,
  packSize: number | null | undefined,
  packUnit: string,
  unit: string,
): string | null {
  if (!hasPacks(packSize)) return null;
  const { packs, loose } = splitPacks(qty, packSize as number);
  const p = packUnit.trim() || "pack";
  const u = unit.trim();
  const packPart = packs !== 0 ? `${packs} ${p}` : "";
  const loosePart = loose !== 0 ? `${loose}${u ? ` ${u}` : ""}` : "";
  if (!packPart && !loosePart) return `0 ${p}`;
  if (packPart && loosePart) return `${packPart} + ${loosePart}`;
  return packPart || loosePart;
}
