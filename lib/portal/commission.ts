/**
 * 阶梯佣金的算术。
 *
 * ── 为什么它在两个地方都写一次 ──────────────────────────────────────────
 *
 * 算钱的那一份在资料库（`staff_earnings`，20260904120000），因为月底那张表
 * 要一次算完一整家的人。这一份在浏览器，因为他**一边打比例一边要看到
 * 这个月会变成多少** —— 而一个要往返一次才更新的数字，他会以为是坏的。
 *
 * 🔴 两份算术就是两个真相，除非它们用同一批断言验。这个档案的测试
 * 每一条都跟 SQL 那一支对过，而 `check:records` 里那几条真的呼叫
 * 是拿同一组数字去问资料库的 —— 两边给不一样的答案，那几条会红。
 *
 * ── 分段算，不是「过了就整笔跳档」──────────────────────────────────────
 *
 * 八千块 · 0–5000 抽一成 · 5000 以上抽一成半：
 *
 *   分段（对的）  5000 × 10% + 3000 × 15% = 500 + 450 = **950**
 *   整笔（错的）  8000 × 15%              =             1200
 *
 * 差 250 块。**差的那 250 块每个月都会有人来吵**，所以它只有一个写法。
 */

/** 一档：从多少开始，抽几成。第一档的 fromCents 是 0。 */
export type Tier = {
  fromCents: number;
  /** 10 = 一成。 */
  percent: number;
};

/**
 * 这些档加起来抽多少。
 *
 * ⚠️ **档没排序也要对** —— 他在画面上是一行一行加的，加完才会去排。
 * ⚠️ **第一档不从 0 开始也要对**：0–3000 那一段就是没有佣金，不是报错。
 *    一个沙龙老板真的会写「做满三千才开始算」。
 */
export function commissionOn(earnedCents: number, tiers: readonly Tier[]): number {
  if (!Number.isFinite(earnedCents) || earnedCents <= 0) return 0;
  const bands = [...tiers]
    .filter((t) => Number.isFinite(t.fromCents) && Number.isFinite(t.percent))
    .sort((a, b) => a.fromCents - b.fromCents);
  if (!bands.length) return 0;

  let total = 0;
  for (let i = 0; i < bands.length; i += 1) {
    const from = Math.max(0, bands[i].fromCents);
    /* 这一档到哪里为止：下一档的起点，没有下一档就是全部。 */
    const to = i + 1 < bands.length ? Math.max(from, bands[i + 1].fromCents) : earnedCents;
    const inBand = Math.min(earnedCents, to) - from;
    if (inBand > 0) total += (inBand * bands[i].percent) / 100;
  }
  /* 分是整数。截掉，不是四舍五入 —— 一笔算出来比讲好的多一分的佣金，
     是我们替他多付的钱，而他不知道。 */
  return Math.trunc(total);
}

/**
 * 一份佣金办法讲不讲得通。**在他保存之前讲，不是让资料库吐一句他读不懂的。**
 *
 * 回一份人话，空阵列＝没问题。
 */
export function tierProblems(
  tiers: readonly Tier[],
  words: { duplicate: string; tooMany: string; badPercent: string },
): string[] {
  const out: string[] = [];
  const seen = new Set<number>();
  for (const t of tiers) {
    if (seen.has(t.fromCents)) {
      out.push(words.duplicate);
      break;
    }
    seen.add(t.fromCents);
  }
  if (tiers.length > 6) out.push(words.tooMany);
  if (tiers.some((t) => t.percent < 0 || t.percent > 100)) out.push(words.badPercent);
  return out;
}

/**
 * 「头 RM 5,000 抽 10%，之后抽 15%」—— 一句他读得懂的话。
 *
 * ⚠️ 回 `null` 而不是空字串：没有档就是**没有这回事**，
 * 而画面拿到空字串会画一行空的说明（`packPhrase` 学过同一条）。
 */
export function tierPhrase(
  tiers: readonly Tier[],
  ringgit: (cents: number) => string,
  words: { first: string; then: string; from: string; join: string },
): string | null {
  const bands = [...tiers].sort((a, b) => a.fromCents - b.fromCents);
  if (!bands.length) return null;
  const parts = bands.map((t, i) => {
    const pct = `${Number(t.percent)}%`;
    if (i === 0 && t.fromCents === 0) {
      const next = bands[1];
      return next
        ? fill(words.first, { amount: ringgit(next.fromCents), percent: pct })
        : fill(words.then, { percent: pct });
    }
    return fill(words.from, { amount: ringgit(t.fromCents), percent: pct });
  });
  return parts.join(words.join);
}

/** `{amount}` / `{percent}` 换掉。字典里只能放字串 —— 一个函式过不了
 *  server → client 那条线（record-copy.ts 的档头）。 */
function fill(shape: string, into: Record<string, string>): string {
  return shape.replace(/\{(\w+)\}/g, (whole, key: string) => into[key] ?? whole);
}
