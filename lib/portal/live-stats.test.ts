import { describe, it, expect } from "vitest";
import {
  buildLiveStats,
  withLiveStats,
  ymOf,
  lastSixMonths,
  nowInMalaysia,
  type LedgerFact,
  type PipelineFact,
} from "./live-stats";

const NOW = { y: 2026, m: 8 };
const base = {
  lang: "zh" as const,
  now: NOW,
  modules: ["dashboard", "quotations", "payments", "customers"],
  nouns: { customer: "客户", pipeline: "工程" },
  pipelineModule: "quotations",
  workflow: ["报价", "订金", "施工", "尾款"],
  ledger: [] as LedgerFact[],
  pipeline: [] as PipelineFact[],
  customers: 0,
};

let seq = 0;
const paid = (
  entry_on: string,
  amount: number,
  allocated = amount,
  adjusts_id: string | null = null,
): LedgerFact => ({
  id: `e${++seq}`,
  adjusts_id,
  module_key: "payments",
  direction: "in",
  amount_cents: amount,
  allocated_cents: allocated,
  entry_on,
});
const job = (stage: string, amount = 0, issued_on = "2026-08-10"): PipelineFact => ({
  module_key: "quotations",
  amount_cents: amount,
  stage,
  issued_on,
});

describe("what a month is, in Malaysia", () => {
  /* The same bug 20260831030000 fixed in the database: a receipt entered at
     1am on the first in Kuala Lumpur is still last month on a UTC server, and
     it would land in the wrong month of his own summary. These are DATE
     columns, so the digits are read rather than parsed into an instant. */
  it("reads the digits and does not shift them", () => {
    expect(ymOf("2026-01-01")).toEqual({ y: 2026, m: 1 });
    expect(ymOf("2026-12-31")).toEqual({ y: 2026, m: 12 });
    expect(ymOf(null)).toBeNull();
    expect(ymOf("rubbish")).toBeNull();
  });

  it("walks back over a new year", () => {
    expect(lastSixMonths({ y: 2026, m: 2 })).toEqual([
      { y: 2025, m: 9 },
      { y: 2025, m: 10 },
      { y: 2025, m: 11 },
      { y: 2025, m: 12 },
      { y: 2026, m: 1 },
      { y: 2026, m: 2 },
    ]);
  });

  it("is his month, not the server's", () => {
    // 2026-09-01 00:30 in Kuala Lumpur is 2026-08-31 16:30 UTC.
    expect(nowInMalaysia(new Date("2026-08-31T16:30:00Z"))).toEqual({ y: 2026, m: 9 });
  });
});

describe("buildLiveStats", () => {
  it("leaves the samples alone for a business with nothing in it", () => {
    // 决定 6: an empty business still gets a page that shows what the numbers
    // WILL be. Zeroing it on day one teaches nothing.
    expect(buildLiveStats(base)).toBeNull();
  });

  it("adds up the money that actually arrived this month", () => {
    const out = buildLiveStats({
      ...base,
      ledger: [paid("2026-08-03", 300000), paid("2026-08-20", 150000), paid("2026-07-30", 900000)],
    });
    expect(out?.tiles[0]).toMatchObject({ label: "本月收到", value: "RM 4,500" });
  });

  it("shows what he is holding that is not against anything yet", () => {
    /* 未分摊 -- the deposit. One column answering 任务 61, 67 and 44, and this
       is the first screen it has ever been on. */
    const out = buildLiveStats({
      ...base,
      ledger: [paid("2026-08-03", 300000, 0), paid("2026-08-04", 200000, 200000)],
    });
    expect(out?.tiles[1]).toMatchObject({ label: "还没用完的订金", value: "RM 3,000" });
  });

  it("does not colour a deposit as a problem", () => {
    // Taking a deposit is normal trade. Painting it red is this product
    // telling an owner his own terms are wrong.
    const out = buildLiveStats({ ...base, ledger: [paid("2026-08-03", 300000, 0)] });
    expect(out?.tiles[1].tone).toBe("normal");
  });

  it("counts only the module the tile's own noun is about", () => {
    /* A contractor with 报价单 AND 工程 read 「在做的工程 4 个」 over a list of
       two, because two of the four were quotations. A tile disagreeing with
       the list beside it is the whole reason this page was worth fixing. */
    const out = buildLiveStats({
      ...base,
      modules: ["dashboard", "quotations", "projects", "payments", "customers"],
      pipelineModule: "projects",
      pipeline: [
        job("施工"),
        { module_key: "projects", amount_cents: 0, stage: "施工", issued_on: "2026-08-10" },
      ],
    });
    expect(out?.tiles.find((t) => t.label === "在做的工程")?.value).toBe("1 个");
  });

  it("counts what is still moving by HIS last stage, not by a word we invented", () => {
    const out = buildLiveStats({
      ...base,
      pipeline: [job("施工"), job("报价"), job("尾款"), job("尾款")],
    });
    const open = out?.tiles.find((t) => t.label === "在做的工程");
    expect(open?.value).toBe("2 个");
  });

  it("uses this business's own noun", () => {
    const out = buildLiveStats({
      ...base,
      nouns: { customer: "经销商", pipeline: "订单" },
      pipeline: [job("报价")],
      customers: 3,
    });
    expect(out?.tiles.map((t) => t.label)).toContain("在做的订单");
    expect(out?.tiles.map((t) => t.label)).toContain("经销商");
  });

  it("says nothing about a module this business does not have", () => {
    // A 收款 tile on a system with no 收款 page is a figure about a part of
    // his system that does not exist.
    const out = buildLiveStats({
      ...base,
      modules: ["dashboard", "quotations"],
      pipeline: [job("报价", 4850000)],
    });
    expect(out?.tiles.map((t) => t.label)).not.toContain("本月收到");
    expect(out?.tiles.map((t) => t.label)).not.toContain("客户");
  });

  it("leads with the quotations he wrote when there is no money page at all", () => {
    const out = buildLiveStats({
      ...base,
      modules: ["dashboard", "quotations"],
      pipeline: [job("报价", 4850000, "2026-08-02"), job("报价", 100000, "2026-06-02")],
    });
    expect(out?.tiles[0]).toMatchObject({ label: "本月开出的单", value: "RM 48,500" });
  });

  it("does not put two 「this month」 figures side by side", () => {
    /* With a ledger the first tile already answers 本月 with money that
       actually arrived. A second 本月 beside it invites him to read one as
       the other, and one of them is not cash. */
    const out = buildLiveStats({
      ...base,
      ledger: [paid("2026-08-03", 300000)],
      pipeline: [job("报价", 4850000)],
    });
    expect(out?.tiles.filter((t) => t.label.startsWith("本月"))).toHaveLength(1);
  });

  it("draws six months of what came in, oldest first", () => {
    const out = buildLiveStats({
      ...base,
      ledger: [paid("2026-08-03", 300000), paid("2026-06-03", 100000)],
    });
    expect(out?.trend.map((p) => p.label)).toEqual(["3月", "4月", "5月", "6月", "7月", "8月"]);
    expect(out?.trend.map((p) => p.value)).toEqual([0, 0, 0, 1000, 0, 3000]);
  });

  it("speaks the system's language", () => {
    const out = buildLiveStats({
      ...base,
      lang: "en",
      nouns: { customer: "Clients", pipeline: "Jobs" },
      ledger: [paid("2026-08-03", 300000)],
      customers: 2,
    });
    expect(out?.tiles[0].label).toBe("Received this month");
    expect(out?.tiles.map((t) => t.label)).toContain("Clients");
    expect(out?.trend[5].label).toBe("Aug");
  });
});

describe("withLiveStats", () => {
  const page = (live?: boolean) => ({
    content: [
      {
        type: "SystemShell",
        props: {
          id: "shell",
          main: [
            {
              type: "StatRow",
              props: {
                id: "dashboard-stats",
                ...(live ? { live: true } : {}),
                tiles: [
                  { label: "本月已确认工程额", value: "RM 71,300", href: "/zh/portal/payments" },
                  { label: "进行中的工程", value: "4 个", href: "/zh/portal/projects" },
                  { label: "等客户确认", value: "2 份报价" },
                  { label: "已做未收", value: "RM 31,200" },
                ],
              },
            },
            {
              type: "TrendChart",
              props: {
                id: "dashboard-trend",
                ...(live ? { live: true } : {}),
                points: [{ label: "3月", value: 42000 }],
              },
            },
          ],
        },
      },
    ],
  });
  const statRow = (out: unknown) =>
    (out as { content: { props: { main: { props: Record<string, unknown> }[] } }[] }).content[0].props.main[0]
      .props;
  const trend = (out: unknown) =>
    (out as { content: { props: { main: { props: Record<string, unknown> }[] } }[] }).content[0].props.main[1]
      .props;

  const real = buildLiveStats({
    ...base,
    ledger: [paid("2026-08-03", 300000, 0)],
    pipeline: [job("施工")],
    customers: 2,
  })!;

  it("reaches into the shell's slot", () => {
    // The fifth projection in this repo to need saying: a generated page is
    // one SystemShell whose `main` prop holds the blocks.
    expect((statRow(withLiveStats(page(), real)).tiles as { label: string }[])[0].label).toBe("本月收到");
  });

  it("keeps the link each tile already carried", () => {
    // The figure changed; which page explains it did not.
    const tiles = statRow(withLiveStats(page(), real)).tiles as { href?: string }[];
    expect(tiles[0].href).toBe("/zh/portal/payments");
  });

  it("does not hand four tiles to an arrangement built for two", () => {
    /* 大字 uses two because four labels truncate at its type size. Overruling
       that would undo a decision the register made about itself. */
    const two = page();
    ((two.content[0].props.main[0].props as { tiles: unknown[] }).tiles).length = 2;
    expect((statRow(withLiveStats(two, real)).tiles as unknown[]).length).toBe(2);
  });

  it("leaves the page alone when we could not read his books", () => {
    /* undefined, not null: a failed query must never blank his first screen
       to zero. That would be a lie rather than a degradation. */
    const p = page(true);
    expect(withLiveStats(p, undefined)).toBe(p);
  });

  it("shows zeroes, not last month's totals, once he has deleted everything", () => {
    const out = withLiveStats(page(true), null);
    const tiles = statRow(out).tiles as { label: string; value: string }[];
    expect(tiles.map((t) => t.value)).toEqual(["RM 0", "0 个", "0 份报价", "RM 0"]);
    // The questions are still the right questions.
    expect(tiles[0].label).toBe("本月已确认工程额");
    expect((trend(out).points as { value: number }[])[0].value).toBe(0);
  });

  it("leaves the samples alone on a page that never had real figures", () => {
    const p = page();
    expect(withLiveStats(p, null)).toBe(p);
  });
});
