/**
 * 一笔钱分摊多张单 —— 读的时候的那一半。
 *
 * 资料库那一边（20260903030000）管的是「写得进去吗」：分摊不可以超过那笔钱、
 * 不可以超过那张单、别的单上的一期不可以拿来用。
 * 这一支管的是「画出来是多少」：**这张单收到多少、还欠多少、哪一期收过了。**
 *
 * ── 🔴 一条规矩，而且是这一支存在的理由 ──────────────────────────────────
 *
 * **冲正过的钱不算收到。**
 *
 * 钱退回去了，而一张退过款的单如果还印着「已收 RM 10,000」，那不是一个
 * 小误差 —— 那是他照着一个假的数字去决定要不要开工。
 *
 * 两种 entry 都不算：
 *   · 自己是冲正的（`adjusts_id` 有值）
 *   · 已经被冲正的（有另一笔的 `adjusts_id` 指着它）
 *
 * 为什么算在这里而不是存成一栏：那是一个**读的时候**的问题。今天没有被冲正
 * 的一笔，明天可能被冲正，而那一秒钟没有人会回头去改那张单上的「已收」。
 * 跟「库存总数是流水加起来的」「过期是读的时候算的」是同一条判断。
 *
 * ── 分期表怎么接进来 ──────────────────────────────────────────────────────
 *
 * 一笔分摊可以**指定哪一期**（`term_id`），也可以不指定 —— 大部分的钱就是
 * 「付这张单」。所以一张单上的钱分两堆：
 *   · 指名的：那一期自己的已收
 *   · 没指名的：属於这张单，但不属於任何一期
 *
 * ⚠️ 没指名的那一堆**不自动往前面几期填**。听起来很方便，而它会在画面上
 * 造一个他没有讲过的事实：一个只写「收了 RM 20,000」的老板，会看到系统
 * 替他宣布「订金收齐了、动工款也收了一半」。他要指名的时候有地方指名。
 */

/** 一笔钱，只取算得上「收到没有」需要的那几栏。 */
export type LedgerEntryFact = {
  id: string;
  /** 这一笔自己是冲正 */
  adjusts_id?: string | null;
  /** 这一笔已经被冲正掉了 */
  reversed?: boolean;
};

export type AllocationRow = {
  id?: string;
  entry_id: string;
  record_id: string;
  term_id?: string | null;
  amount_cents: number;
};

export type TermSettlement = {
  termId: string;
  /** 这一期今天等於多少（priceSchedule 算出来的） */
  dueCents: number;
  paidCents: number;
  /** 还欠多少。收超过了就是 0，不是负数 —— 多的那一部分属於这张单，不属於这一期。 */
  outstandingCents: number;
  settled: boolean;
};

export type DocumentSettlement = {
  /** 这张单一共收到多少（冲正过的不算） */
  paidCents: number;
  /** 还欠多少。收超过了是 0。 */
  outstandingCents: number;
  /** 有没有真的收过钱 —— 「一分都还没收」跟「收齐了」在画面上讲法不一样。 */
  anyPaid: boolean;
  settled: boolean;
  /** 指名了某一期的那几笔，一期一行。 */
  terms: TermSettlement[];
  /** 没指名任何一期的那一堆。 */
  unassignedCents: number;
};

/**
 * 这一笔钱算不算「真的收到了」。
 *
 * ⚠️ `reversed` 是呼叫的人要查的（哪一笔有另一笔指着它）—— 这一支拿到什么
 * 就信什么，因为它是纯函式。查错了这里看不出来，所以那一段有自己的测试。
 */
export function countsAsReceived(entry: LedgerEntryFact | undefined | null): boolean {
  if (!entry) return false;
  if (entry.adjusts_id) return false;
  if (entry.reversed) return false;
  return true;
}

/**
 * 从一批 entry 算出「哪几笔被冲正了」。
 *
 * 一笔冲正长这样：它自己的 `adjusts_id` 指着被冲正的那一笔。
 */
export function reversedIds(entries: readonly { id: string; adjusts_id?: string | null }[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) if (e.adjusts_id) out.add(e.adjusts_id);
  return out;
}

/**
 * 一张单收到多少、还欠多少。
 *
 * @param dueByTerm 每一期今天等於多少 sen，key 是 term id。
 *                  从 `priceSchedule` 来 —— 比例存的是 30，不是 RM 14,550。
 */
export function settleDocument(input: {
  documentCents: number | null | undefined;
  allocations: readonly AllocationRow[];
  /** 那几笔钱本身，用来判断哪一笔被冲正了 */
  entries: readonly LedgerEntryFact[];
  dueByTerm?: Readonly<Record<string, number>>;
}): DocumentSettlement {
  const byId = new Map(input.entries.map((e) => [e.id, e]));
  const live = input.allocations.filter((a) => countsAsReceived(byId.get(a.entry_id)));

  const paidCents = live.reduce((n, a) => n + (a.amount_cents ?? 0), 0);
  const doc =
    input.documentCents != null && Number.isFinite(input.documentCents)
      ? input.documentCents
      : null;

  const paidByTerm = new Map<string, number>();
  let unassignedCents = 0;
  for (const a of live) {
    if (a.term_id) paidByTerm.set(a.term_id, (paidByTerm.get(a.term_id) ?? 0) + a.amount_cents);
    else unassignedCents += a.amount_cents;
  }

  const terms: TermSettlement[] = Object.entries(input.dueByTerm ?? {}).map(([termId, dueCents]) => {
    const paid = paidByTerm.get(termId) ?? 0;
    return {
      termId,
      dueCents,
      paidCents: paid,
      outstandingCents: Math.max(0, dueCents - paid),
      settled: paid >= dueCents && dueCents > 0,
    };
  });

  /* 🔴 指名了一期、而那一期已经不在分期表里的钱，也要算进这张单的已收。
     `paidCents` 是从 live 直接加的，所以它本来就算进去了 —— 这一句是
     为了让下一个人知道那不是漏掉的。 */

  return {
    paidCents,
    outstandingCents: doc == null ? 0 : Math.max(0, doc - paidCents),
    anyPaid: paidCents > 0,
    settled: doc != null && doc > 0 && paidCents >= doc,
    terms,
    unassignedCents,
  };
}

/**
 * 一笔钱还有多少没分摊出去 —— **那就是订金**。
 *
 * 任务 61 · 67 · 44 三天各自要过一次这个数字，而它一直只是一个减法。
 */
export function unallocatedOf(entry: {
  amount_cents?: number | null;
  allocated_cents?: number | null;
}): number {
  return Math.max(0, (entry.amount_cents ?? 0) - (entry.allocated_cents ?? 0));
}
