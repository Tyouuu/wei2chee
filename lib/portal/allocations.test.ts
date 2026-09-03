import { describe, expect, it } from "vitest";
import {
  countsAsReceived,
  reversedIds,
  settleDocument,
  unallocatedOf,
  type AllocationRow,
  type LedgerEntryFact,
} from "./allocations";

const alloc = (over: Partial<AllocationRow> = {}): AllocationRow => ({
  entry_id: "e1",
  record_id: "d1",
  term_id: null,
  amount_cents: 100_000,
  ...over,
});

describe("哪一笔钱算真的收到了", () => {
  it("一笔普通的收款算", () => {
    expect(countsAsReceived({ id: "e1" })).toBe(true);
  });

  it("冲正那一笔自己不算 —— 它是撤销，不是收入", () => {
    expect(countsAsReceived({ id: "e2", adjusts_id: "e1" })).toBe(false);
  });

  it("被冲正掉的那一笔也不算 —— 钱退回去了", () => {
    expect(countsAsReceived({ id: "e1", reversed: true })).toBe(false);
  });

  it("查不到那一笔的时候不算，不是当成收到了", () => {
    expect(countsAsReceived(undefined)).toBe(false);
  });

  it("从一批 entry 认得出哪几笔被冲正了", () => {
    const ids = reversedIds([
      { id: "e1" },
      { id: "e2", adjusts_id: "e1" },
      { id: "e3" },
    ]);
    expect([...ids]).toEqual(["e1"]);
  });
});

describe("一张单收到多少", () => {
  const entries: LedgerEntryFact[] = [{ id: "e1" }, { id: "e2" }];

  it("两笔钱加起来", () => {
    const s = settleDocument({
      documentCents: 1_000_000,
      allocations: [alloc({ amount_cents: 300_000 }), alloc({ entry_id: "e2", amount_cents: 200_000 })],
      entries,
    });
    expect(s.paidCents).toBe(500_000);
    expect(s.outstandingCents).toBe(500_000);
    expect(s.settled).toBe(false);
    expect(s.anyPaid).toBe(true);
  });

  it("收齐了", () => {
    const s = settleDocument({
      documentCents: 1_000_000,
      allocations: [alloc({ amount_cents: 1_000_000 })],
      entries,
    });
    expect(s.settled).toBe(true);
    expect(s.outstandingCents).toBe(0);
  });

  it("🔴 冲正之后，那张单不可以看起来像收过钱", () => {
    const s = settleDocument({
      documentCents: 1_000_000,
      allocations: [alloc({ amount_cents: 1_000_000 })],
      entries: [{ id: "e1", reversed: true }],
    });
    expect(s.paidCents).toBe(0);
    expect(s.anyPaid).toBe(false);
    expect(s.outstandingCents).toBe(1_000_000);
  });

  it("一分都还没收，跟收齐了，是两句不一样的话", () => {
    const s = settleDocument({ documentCents: 1_000_000, allocations: [], entries });
    expect(s.anyPaid).toBe(false);
    expect(s.settled).toBe(false);
    expect(s.outstandingCents).toBe(1_000_000);
  });

  it("单还没有总数的时候，还欠多少是 0 而 settled 是 false —— 不知道就不宣布", () => {
    const s = settleDocument({
      documentCents: null,
      allocations: [alloc({ amount_cents: 300_000 })],
      entries,
    });
    expect(s.paidCents).toBe(300_000);
    expect(s.settled).toBe(false);
    expect(s.outstandingCents).toBe(0);
  });
});

describe("哪一期收过了", () => {
  const entries: LedgerEntryFact[] = [{ id: "e1" }];

  it("指名了那一期，那一期就收了", () => {
    const s = settleDocument({
      documentCents: 4_850_000,
      allocations: [alloc({ term_id: "t1", amount_cents: 1_455_000 })],
      entries,
      dueByTerm: { t1: 1_455_000, t2: 1_940_000, t3: 1_455_000 },
    });
    const t1 = s.terms.find((t) => t.termId === "t1");
    expect(t1?.settled).toBe(true);
    expect(t1?.outstandingCents).toBe(0);
    expect(s.terms.find((t) => t.termId === "t2")?.outstandingCents).toBe(1_940_000);
  });

  it("🔴 没指名的钱不会自己往前面几期填", () => {
    const s = settleDocument({
      documentCents: 4_850_000,
      allocations: [alloc({ term_id: null, amount_cents: 2_000_000 })],
      entries,
      dueByTerm: { t1: 1_455_000, t2: 1_940_000, t3: 1_455_000 },
    });
    expect(s.paidCents).toBe(2_000_000);
    expect(s.unassignedCents).toBe(2_000_000);
    /* 每一期都还是「还没收」—— 他没有讲过那 RM 20,000 是订金。 */
    expect(s.terms.every((t) => t.paidCents === 0)).toBe(true);
  });

  it("一期收超过了，还欠是 0 不是负数", () => {
    const s = settleDocument({
      documentCents: 4_850_000,
      allocations: [alloc({ term_id: "t1", amount_cents: 2_000_000 })],
      entries,
      dueByTerm: { t1: 1_455_000 },
    });
    expect(s.terms[0].outstandingCents).toBe(0);
    expect(s.terms[0].settled).toBe(true);
  });

  it("指名的那一期被冲正了，那一期回到没收", () => {
    const s = settleDocument({
      documentCents: 4_850_000,
      allocations: [alloc({ term_id: "t1", amount_cents: 1_455_000 })],
      entries: [{ id: "e1", reversed: true }],
      dueByTerm: { t1: 1_455_000 },
    });
    expect(s.terms[0].paidCents).toBe(0);
    expect(s.terms[0].settled).toBe(false);
  });

  it("指名了一期、而那一期已经不在分期表里，钱还是算在这张单上", () => {
    const s = settleDocument({
      documentCents: 1_000_000,
      allocations: [alloc({ term_id: "gone", amount_cents: 400_000 })],
      entries,
      dueByTerm: { t1: 1_000_000 },
    });
    expect(s.paidCents).toBe(400_000);
    expect(s.terms[0].paidCents).toBe(0);
  });
});

describe("还没分摊的就是订金", () => {
  it("减出来", () => {
    expect(unallocatedOf({ amount_cents: 2_000_000, allocated_cents: 1_700_000 })).toBe(300_000);
  });

  it("全部分摊掉就是 0", () => {
    expect(unallocatedOf({ amount_cents: 500_000, allocated_cents: 500_000 })).toBe(0);
  });

  it("读不到的时候是 0，不是 NaN", () => {
    expect(unallocatedOf({})).toBe(0);
  });
});
