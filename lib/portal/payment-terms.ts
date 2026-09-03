/**
 * 分期付款表的算术 —— 订金 30% · 动工 40% · 完工 30%。
 *
 * ── 一条规矩：这里永远不会凭空生出一个数字 ────────────────────────────
 *
 * 一期要嘛是**比例**（照单的总数算），要嘛是**写死的金额**（照写）。
 * 加起来跟总数对不上的时候，**讲出来差多少**，不要偷偷把最后一期改大 ——
 * 客人手上那张纸要加得起来，而一个我们替他调过的数字，他不知道被调过。
 *
 * ── 唯一一次我们会动数字，而且只动几分钱 ──────────────────────────────
 *
 * 三期各 33.33%，RM 48,500 算下来是 16,166.05 × 3 = 48,498.15，差 RM 1.85。
 * 这时候**最后一期吃掉余数**，理由是那张纸必须加得起来 ——
 * 而且只有在「每一期都是比例、而且加起来正好 100」的时候才这样做。
 * 有任何一期是写死的金额，就不动，因为那时候「余数」不知道该算谁的。
 *
 * ── 为什么算在这里，不算在资料库里 ────────────────────────────────────
 *
 * 单的总数有两个来源：他自己打的，或者逐项明细加起来的（20260831150000
 * 的触发器）。两个都住在 `pipeline_records.amount_cents`，所以这里只要
 * 收一个总数，不用知道它是哪来的。
 *
 * 而资料库那一张 `record_terms` 存的是**他答应的条件**（三成），不是
 * 那三成今天等於多少 —— 存后者会在他加一行明细的那一秒过期。
 */

export type PaymentTerm = {
  description: string;
  /** 三成就是 30。跟 amount_cents 只能有一个（资料库 check 挡着）。 */
  portion?: number | null;
  amount_cents?: number | null;
  due_on?: string | null;
  note?: string | null;
};

export type PricedTerm = PaymentTerm & {
  /** 这一期今天等於多少 sen。算出来的，从来不存。 */
  cents: number;
};

export type PricedSchedule = {
  terms: PricedTerm[];
  /** 这几期加起来 */
  totalCents: number;
  /** 单上的总数。null = 这张单还没有总数（他还没打，也还没有明细）。 */
  documentCents: number | null;
  /** 差多少。正数 = 分期比单上多；负数 = 还有一段没有分配。 */
  differenceCents: number | null;
  /** 加得起来吗。总数不知道的时候是 null，不是 false —— 那两件事不一样。 */
  matches: boolean | null;
};

const isPortion = (t: PaymentTerm) => t.portion != null && Number.isFinite(t.portion);

/**
 * 每一期今天等於多少。
 *
 * ⚠️ 总数是 null 的时候，比例那几期算不出来 —— 那时候它们的 cents 是 0，
 * 而 `documentCents` 是 null，画面要照这个讲「还不知道，先填总数」，
 * 不可以印 RM 0。RM 0 是一个数字，而我们没有那个数字。
 */
export function priceSchedule(
  terms: readonly PaymentTerm[],
  documentCents: number | null | undefined,
): PricedSchedule {
  const doc = documentCents != null && Number.isFinite(documentCents) ? documentCents : null;

  const priced: PricedTerm[] = terms.map((t) => {
    if (isPortion(t)) {
      const cents = doc == null ? 0 : Math.round((doc * (t.portion as number)) / 100);
      return { ...t, cents };
    }
    const a = t.amount_cents;
    return { ...t, cents: a != null && Number.isFinite(a) ? a : 0 };
  });

  /* 余数只在「每一期都是比例、加起来正好 100、而且总数知道」的时候才处理。
     少一个条件都不动 —— 那时候差额是一个真的差额，要讲出来不要吸收掉。 */
  const allPortions = terms.length > 0 && terms.every(isPortion);
  const portionSum = terms.reduce((n, t) => n + (isPortion(t) ? (t.portion as number) : 0), 0);
  if (doc != null && allPortions && Math.abs(portionSum - 100) < 1e-9) {
    const sum = priced.reduce((n, t) => n + t.cents, 0);
    const last = priced[priced.length - 1];
    last.cents += doc - sum;
  }

  const totalCents = priced.reduce((n, t) => n + t.cents, 0);
  return {
    terms: priced,
    totalCents,
    documentCents: doc,
    differenceCents: doc == null ? null : totalCents - doc,
    matches: doc == null ? null : totalCents === doc,
  };
}

/**
 * 装修那一行最常写的那三期。
 *
 * ⚠️ 这是一个**建议**，不是一个预设：它只在他按下「照这个填」的时候出现，
 * 不会自己写进他的单。一份他没有同意过的付款办法，印在客人手上那张纸上，
 * 比没有分期表严重得多。
 *
 * 30/40/30 不是我发明的 —— 那是马来西亚装修承包商写在合约上的写法。
 * ⚠️ 而我没有量过它有多普遍：这一行是从这一行的惯例来的，不是从一份统计。
 * 哪一天量了，改这里一个地方。
 */
export const SUGGESTED_TERMS: Record<string, readonly { key: string; portion: number }[]> = {
  renovation: [
    { key: "deposit", portion: 30 },
    { key: "start", portion: 40 },
    { key: "done", portion: 30 },
  ],
  services: [
    { key: "deposit", portion: 50 },
    { key: "done", portion: 50 },
  ],
};

export function suggestedFor(trade: string | null | undefined) {
  return SUGGESTED_TERMS[(trade ?? "").trim()] ?? null;
}
