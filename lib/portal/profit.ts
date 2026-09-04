import { countsAsReceived, reversedIds } from "./allocations";
import { ringgit } from "./live-rows";

/**
 * 带正负号的钱。
 *
 * ⚠️ **这是这个产品第一个会是负数的金额。** 在这之前每一笔钱都是正的
 * （方向是另一栏 -- 20260831020000 的设计），所以 `ringgit` 从来没有
 * 想过负号，它吐的是 `RM -300`。
 *
 * 没有去改 `ringgit`：它被几乎每一个画面读，而这里要的只是这一个数字
 * 的写法。一支共用的格式化函式为了一个新用途改掉，是把风险摊到
 * 所有旧画面上换一个字的位置。
 */
export function signedRinggit(cents: number | null | undefined): string | undefined {
  if (cents == null || !Number.isFinite(cents)) return undefined;
  const body = ringgit(Math.abs(cents));
  if (body == null) return undefined;
  return cents < 0 ? `-${body}` : body;
}

/**
 * 「这个月赚多少。」
 *
 * ── 这一支存在的理由 ──────────────────────────────────────────────────────
 *
 * `live-answers.ts` 的 GAPS 里第一行，从写出来那天就是：
 *
 *     「赚多少 / 某一单的利润 —— 开销今天还挂不到某一单工程上，所以算不出来」
 *
 * 那句话现在不成立了（20260904200000 给了开销一个类别跟一个单），所以这一支
 * 就是让那一行退休的东西。而那个档案自己写着为什么它必须退休：
 * **一条过期的「答不了」，是助手拒绝回答一件产品已经做得到的事** ——
 * 跟宣称做了却没做，是同一个缺陷的另一张脸。
 *
 * ── 它算的是收付实现制，不是权责发生制，而这要讲出来 ────────────────────
 *
 * 「赚」在这里 = **这个月真的进来的钱 − 这个月真的花出去的钱**。
 * 不是营收减成本：一张 8 月开的单、10 月才收到的钱，算在 10 月。
 *
 * 那不是偷懒，那是这门生意记帐的方式（也是他的会计拿着银行流水在做的那一张），
 * 而做另一种要一整套借贷分录 —— 代价写在 20260904200000 的档头。
 * ⚠️ 所以画面上那个字要是「赚」/「Profit」这种日常的词，不可以是
 * 「净利」/「Net profit」—— 后者是一个有准确会计定义的词，而我们算的不是它。
 *
 * ── 🔴 冲正过的两边都不算，而这在这一支比在别处更要紧 ──────────────────
 *
 * 一笔冲正的方向跟原本那笔**相反**：冲掉一笔收款，写出来的是一笔 `out`。
 * 所以一支只会 `sum(direction='out')` 的损益表，会把「那笔钱其实没收到」
 * 算成**一笔开销** —— 一次打错，帐上多一笔不存在的成本，而且两边都错。
 *
 * `countsAsReceived` 把两种都挡掉（自己是冲正 · 已经被冲正），
 * 而这里两个方向都用它。
 */

export type ProfitFact = {
  id: string;
  direction: string | null;
  amount_cents: number | null;
  entry_on: string | null;
  category?: string | null;
  adjusts_id?: string | null;
};

export type ProfitSlice = {
  /** 进来的钱 */
  inCents: number;
  /** 出去的钱 */
  outCents: number;
  /** 进来的减出去的。**可以是负数** —— 一个亏钱的月份就是负的，
   *  而把它夹成 0 是替他把一个坏消息藏起来。 */
  profitCents: number;
  /** 笔数（进出都算） */
  count: number;
  /** 钱花在哪，多的在前。**没写类别的归成一组**，而那一组要看得见：
   *  一张有一半躺在「没写」底下的表，才讲得出这张表现在有多准。 */
  byCategory: { name: string | null; cents: number }[];
};

/** 一个月，读成 { y, m }。跟 live-stats 的 ymOf 同一条规矩：
 *  这是一个 DATE 栏位，不是一个瞬间，不准丢给 new Date()。 */
function ymOf(s: string | null | undefined): { y: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(s ?? "");
  return m ? { y: Number(m[1]), m: Number(m[2]) } : null;
}

/**
 * 一段时间里的收、支、赚。
 *
 * `month` 不给就是全部 —— 「这一单一共赚多少」问的就是全部。
 */
export function buildProfit(
  facts: readonly ProfitFact[],
  month?: { y: number; m: number },
): ProfitSlice {
  const dead = reversedIds(facts);
  const live = facts.filter((f) =>
    countsAsReceived({ id: f.id, adjusts_id: f.adjusts_id ?? null, reversed: dead.has(f.id) }),
  );
  const inWindow = month
    ? live.filter((f) => {
        const ym = ymOf(f.entry_on);
        return !!ym && ym.y === month.y && ym.m === month.m;
      })
    : live;

  let inCents = 0;
  let outCents = 0;
  const cats = new Map<string | null, number>();

  for (const f of inWindow) {
    const cents = f.amount_cents ?? 0;
    if ((f.direction ?? "in") === "in") {
      inCents += cents;
    } else {
      outCents += cents;
      const key = (f.category ?? "").trim() || null;
      cats.set(key, (cats.get(key) ?? 0) + cents);
    }
  }

  return {
    inCents,
    outCents,
    profitCents: inCents - outCents,
    count: inWindow.length,
    byCategory: [...cats.entries()]
      .map(([name, cents]) => ({ name, cents }))
      /* 多的在前；一样多的时候按名字，不然同一批资料两次跑出两个顺序。
         「没写」永远排最后，不管它多大 —— 它不是一个类别，它是一个洞。 */
      .sort((a, b) => {
        if (a.name === null) return 1;
        if (b.name === null) return -1;
        return b.cents - a.cents || a.name.localeCompare(b.name);
      }),
  };
}

/**
 * 这一单赚多少。
 *
 * ⚠️ **进来那一边跟出去那一边不是同一个机制，而那是故意的：**
 *
 *   收到多少  ← `ledger_allocations`（一笔钱可以分给好几张单，很精确）
 *   花掉多少  ← `ledger_entries.job_id`（一笔开销挂一张单）
 *
 * 不对称，但它是真的：一笔转帐真的会同时付三张单（那正是分摊存在的理由），
 * 而一张水泥单据在实务上就是为了一个工地。他一车水泥分两个工地的时候，
 * 记两笔 —— 那比让他在一张收据上填两个百分比诚实。
 *
 * ⚠️ 它**只有看得到钱的人算得出来**：`ledger_entries` 的 select 是
 * `sees_money`，所以一个师傅拿回来的是空的 —— 而空的会算成「这一单赚了全额」。
 * 所以画面上那一段对他整段不画，不是画 0（跟「他还欠多少」同一条）。
 */
export function jobProfit(input: {
  /** 这张单真的收到多少（settleDocument 算的） */
  paidCents: number;
  /** 挂在这张单上的开销 */
  costs: readonly ProfitFact[];
}): { paidCents: number; costCents: number; profitCents: number; byCategory: ProfitSlice["byCategory"] } {
  const slice = buildProfit(input.costs);
  return {
    paidCents: input.paidCents,
    costCents: slice.outCents,
    profitCents: input.paidCents - slice.outCents,
    byCategory: slice.byCategory,
  };
}
