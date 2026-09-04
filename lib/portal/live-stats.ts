import type { SupabaseClient } from "@supabase/supabase-js";
import { countsAsReceived, reversedIds } from "./allocations";
import { ringgit } from "./live-rows";
import { LEDGER_MODULES, PIPELINE_MODULES, DIRECTORY_MODULES } from "./shape-state";

/**
 * The four numbers on the first screen, worked out from his own books.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * 报价单, 收款 and 客户 hold real rows now. The 总览 page does not: it still
 * prints 「本月已确认工程额 RM 71,300 · 进行中的工程 4 个 · 等客户确认 2 份报价」
 * out of lib/templates/copy/samples.*.ts, the same figures for every business
 * in the product. So an owner can write three quotations, open the page he
 * looks at first every morning, and read somebody else's month.
 *
 * That is worse than the tables were before they were real, because a table of
 * samples announces itself -- 陈先生, 李太太, obviously a demonstration -- while
 * a total is just a number and looks like his.
 *
 * ── WHAT IT WILL AND WILL NOT CLAIM ───────────────────────────────────────
 *
 * Every figure here is COUNTED, never inferred. The sample labels promise
 * things this product cannot know:
 *
 *   本月已确认工程额   which stage counts as 「confirmed」 is that business's
 *                     own judgement, and we were never told it
 *   已做未收 超过30天   needs invoicing, which does not exist yet
 *
 * A right number under a wrong label is worse than a sample, so those labels
 * do not survive. What replaces them is the set of things his books can
 * actually answer, and each tile appears only if the module behind it is one
 * this business has:
 *
 *   收款 → 本月收到          sum of money in, this month
 *   收款 → 还没用完的订金     money in that is not applied to any document
 *   报价单/订单/工程 → 在做的  rows not yet at the last stage of HIS workflow
 *   客户 → 客户              how many are on the shelf
 *
 * ── THE ONE JUDGEMENT IT MAKES, AND WHY IT IS SAFE ────────────────────────
 *
 * 「在做的」 reads the LAST stage of this business's own workflow as done, and
 * everything before it as not. That is the same positional rule toneForStage
 * already uses to colour a row, it needs no vocabulary we invented, and it is
 * wrong only for a business whose last stage is not the end -- which would
 * make its own pipeline read backwards on every page, not just this one.
 */

export type StatTone = "good" | "warn" | "bad" | "normal";

export type LiveStat = {
  label: string;
  value: string;
  deltaLabel?: string;
  tone: StatTone;
  spark?: number[];
  /** 上一期那个数字，已经格式化好。只有真的算得出来的那一格才有 ——
   *  没有历史就不给，「RM 0 上个月」是一句查得出来是假的话。 */
  previous?: string;
  /** Which icon belongs beside this figure. The dashboard's four are
   *  positional (ICONS below) because that page's tiles are always the same
   *  four questions in the same order; a page that builds its own tiles --
   *  see live-months.ts -- names its own, or 「笔数」 arrives wearing the
   *  reconciliation mark. */
  icon?: string;
};

export type LiveStats = {
  tiles: LiveStat[];
  /** Six months, oldest first, for the chart under the tiles. */
  trend: { label: string; value: number }[];
  /** What the chart is actually a chart OF, when that differs from what the
   *  block was drawn with. Only the thing that did the counting knows what it
   *  counted: 排名's chart was captioned 「顶级和活跃加起来的人数」 and the
   *  figure is everybody who had a record, 退步中 included. Left undefined --
   *  which is the normal case, and 总览's -- the block keeps its own words. */
  trendTitle?: string;
  trendCaption?: string;
};

const WORDS = {
  zh: {
    received: "本月收到",
    deposits: "还没用完的订金",
    open: (noun: string) => `在做的${noun}`,
    customers: (noun: string) => noun,
    quoted: "本月开出的单",
    vsLast: "vs 上个月",
    count: (n: number) => `${n} 个`,
    month: (m: number) => `${m}月`,
    held: "客户先付的，还没做完",
  },
  en: {
    received: "Received this month",
    deposits: "Deposits not used up",
    open: (noun: string) => `${noun} in progress`,
    customers: (noun: string) => noun,
    quoted: "Issued this month",
    vsLast: "vs last month",
    count: (n: number) => `${n}`,
    month: (m: number) =>
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? "",
    held: "Paid ahead, not yet delivered",
  },
} as const;

export type LedgerFact = {
  /* 🔴 `id` 跟 `adjusts_id` 是**必填的，而那是刻意的**。
     一笔冲正长的样子是「另一笔的 adjusts_id 指着它」，所以没有这两栏
     就分不出「收到了」跟「收到过又退回去了」—— 而少了它们的时候，
     算出来的月结**看起来完全正常**。
     写成必填，忘了 select 就是一个编译错误，不是一个静静变大的数字。 */
  id: string;
  adjusts_id: string | null;
  module_key: string;
  direction: string | null;
  amount_cents: number | null;
  allocated_cents: number | null;
  entry_on: string | null;
};

export type PipelineFact = {
  module_key: string;
  amount_cents: number | null;
  stage: string | null;
  issued_on: string | null;
};

/**
 * The year and month a date belongs to IN MALAYSIA.
 *
 * ⚠️ Not `new Date(s).getMonth()`. The server runs on UTC, and a payment
 * entered at 1am on the first of the month in Kuala Lumpur is still the
 * previous month there -- which is exactly the bug 20260831030000 fixed on the
 * database side (today_myt). The same mistake made here would put a receipt in
 * the wrong month of a business's own summary.
 *
 * `entry_on` and `issued_on` are DATE columns, so they arrive as 「2026-08-31」
 * with no zone at all: read the digits, do not parse them into an instant.
 */
export function ymOf(date: string | null | undefined): { y: number; m: number } | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})/.exec(date);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

/** The six months ending with this one, oldest first. */
export function lastSixMonths(now: { y: number; m: number }): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = [];
  for (let back = 5; back >= 0; back -= 1) {
    const idx = now.m - 1 - back;
    out.push({ y: now.y + Math.floor(idx / 12), m: ((((idx % 12) + 12) % 12) + 1) });
  }
  return out;
}

/** Today, in Malaysia, as a plain year and month. */
export function nowInMalaysia(at: Date = new Date()): { y: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  }).format(at);
  const [y, m] = parts.split("-").map(Number);
  return { y, m };
}

export function buildLiveStats(input: {
  lang: "zh" | "en";
  now: { y: number; m: number };
  /** The page keys this business actually has. A tile for a module it does
   *  not own is a number about a part of its system that does not exist. */
  modules: string[];
  /** This business's own nouns: what it calls a customer, and what it calls
   *  the pipeline module the 「在做的」 tile is about. */
  nouns: { customer: string; pipeline: string };
  /** WHICH pipeline module that noun means -- dashboardRecordModule(), the
   *  same one the 「最近的<工程>」 table below is filled from.
   *
   *  ⚠️ Counting every pipeline module instead was wrong in a way that reads
   *  as right: a contractor with 报价单 AND 工程 saw 「在做的工程 4 个」 while
   *  the list under it showed two, because two of the four were quotations.
   *  A tile and the list beside it disagreeing is the whole reason this page
   *  was worth fixing. */
  pipelineModule: string | null;
  /** This business's own workflow, in order. The last one is done. */
  workflow: string[];
  ledger: LedgerFact[];
  pipeline: PipelineFact[];
  customers: number;
}): LiveStats | null {
  const { lang, now, modules, nouns, workflow } = input;
  const w = WORDS[lang] ?? WORDS.zh;
  const has = (keys: ReadonlySet<string>) => modules.some((k) => keys.has(k));

  /* Nothing at all: the samples stay, and they stay for a reason -- an empty
     business still gets a page that shows what the numbers WILL be. That is
     the founder's decision of 2026-08-30, and it is the same rule the table
     projection follows. */
  if (!input.ledger.length && !input.pipeline.length && !input.customers) return null;

  const months = lastSixMonths(now);
  const inThisMonth = (d: string | null) => {
    const ym = ymOf(d);
    return !!ym && ym.y === now.y && ym.m === now.m;
  };

  /* 🔴 冲正过的不算，两种都不算：自己是冲正的，跟已经被冲正的。
     在这之前「本月收到」把一笔退回去的钱照样算成收入 —— 而画面上
     那张表自己已经把它标成「已冲正」了，也就是同一页两个答案。 */
  const settled = reversedIds(input.ledger);
  const money = input.ledger.filter(
    (e) =>
      (e.direction ?? "in") === "in" &&
      countsAsReceived({ id: e.id, adjusts_id: e.adjusts_id, reversed: settled.has(e.id) }),
  );
  const receivedByMonth = months.map(
    (m) =>
      money
        .filter((e) => {
          const ym = ymOf(e.entry_on);
          return !!ym && ym.y === m.y && ym.m === m.m;
        })
        .reduce((n, e) => n + (e.amount_cents ?? 0), 0) / 100,
  );

  const tiles: LiveStat[] = [];

  if (has(LEDGER_MODULES)) {
    const thisMonth = money
      .filter((e) => inThisMonth(e.entry_on))
      .reduce((n, e) => n + (e.amount_cents ?? 0), 0);
    /* 上个月真的收到多少。`receivedByMonth` 是六个月的实数，
       所以这不是推出来的，是同一份资料的倒数第二格。
       ⚠️ 只有**六个月里真的有两个月**才给 —— 一个刚开张的生意没有上个月，
       而「RM 0 上个月」读起来像一句事实，其实是我们没有资料。 */
    const lastMonth =
      receivedByMonth.length > 1 ? receivedByMonth[receivedByMonth.length - 2] : null;
    tiles.push({
      label: w.received,
      value: ringgit(thisMonth) ?? "RM 0",
      deltaLabel: w.vsLast,
      previous: lastMonth != null ? (ringgit(lastMonth * 100) ?? undefined) : undefined,
      tone: "good",
      spark: receivedByMonth,
    });

    /* 未分摊 -- money taken for work not yet written down against anything.
       It is the number 任务 61, 67 and 44 each asked for separately, and this
       is the first screen it has ever appeared on. */
    const held = money.reduce(
      (n, e) => n + Math.max(0, (e.amount_cents ?? 0) - (e.allocated_cents ?? 0)),
      0,
    );
    tiles.push({
      label: w.deposits,
      value: ringgit(held) ?? "RM 0",
      deltaLabel: w.held,
      /* Not a warning. A deposit is normal, and colouring it red would be this
         product telling an owner his own trading terms are a problem. */
      tone: "normal",
    });
  }

  if (has(PIPELINE_MODULES)) {
    /* Only the module the noun is about -- see pipelineModule. Null means the
       caller could not resolve one, and then every pipeline row is the honest
       answer rather than none. */
    const mine = input.pipelineModule
      ? input.pipeline.filter((r) => r.module_key === input.pipelineModule)
      : input.pipeline;
    const done = workflow.length ? workflow[workflow.length - 1] : null;
    const open = mine.filter((r) => (r.stage ?? "").trim() !== done);
    tiles.push({
      label: w.open(nouns.pipeline),
      value: w.count(open.length),
      tone: open.length ? "warn" : "normal",
    });

    /* Only when there is no ledger: otherwise the first tile already answers
       「本月」 with money that actually arrived, and two 「this month」 figures
       side by side invite him to read one as the other. */
    if (!has(LEDGER_MODULES)) {
      const issued = mine
        .filter((r) => inThisMonth(r.issued_on))
        .reduce((n, r) => n + (r.amount_cents ?? 0), 0);
      tiles.unshift({
        label: w.quoted,
        value: ringgit(issued) ?? "RM 0",
        tone: "good",
      });
    }
  }

  if (has(DIRECTORY_MODULES)) {
    tiles.push({
      label: w.customers(nouns.customer),
      value: w.count(input.customers),
      tone: "normal",
    });
  }

  if (!tiles.length) return null;

  return {
    tiles,
    trend: months.map((m, i) => ({ label: w.month(m.m), value: receivedByMonth[i] })),
  };
}

/**
 * Put them on the page.
 *
 * Same shape as withLiveRows, and the same flag for the same reason: the
 * editor autosaves whatever is on the canvas, so once these numbers are
 * frozen into layout_json a business that later deletes everything would keep
 * reading last month's totals. `live` says the figures were real, so an empty
 * book shows zeroes rather than a memory.
 */
export function withLiveStats(
  tree: Record<string, unknown>,
  /** `undefined` means WE COULD NOT READ -- leave the page exactly as it is.
   *  `null` means he genuinely has nothing, which is a different sentence and
   *  the only one that zeroes a page whose figures were once real. Collapsing
   *  the two would print RM 0 across his first screen every time a query
   *  failed, which is a lie rather than a degradation. */
  stats: LiveStats | null | undefined,
): Record<string, unknown> {
  if (stats === undefined) return tree;
  const content = (tree as { content?: unknown }).content;
  if (!Array.isArray(content)) return tree;
  const mapped = mapNodes(content, stats);
  if (mapped.every((n, i) => n === content[i])) return tree;
  return { ...tree, content: mapped };
}

const ICONS = ["payments", "reconciliation", "quotations", "customers"];

function mapNodes(nodes: unknown[], stats: LiveStats | null): unknown[] {
  return nodes.map((node) => {
    const n = node as { type?: string; props?: Record<string, unknown> };
    if (!n || typeof n !== "object" || !n.props) return node;

    if (n.type === "StatRow") {
      const tiles = n.props.tiles as { live?: unknown }[] | undefined;
      const wasLive = (n.props as { live?: unknown }).live === true;
      if (!stats) {
        if (!wasLive) return node;
        /* Real once, empty now: zeroes rather than yesterday's totals. The
           labels are kept -- they are still the right questions. */
        const zeroed = (tiles ?? []).map((t) => ({ ...t, value: zeroLike((t as { value?: unknown }).value), spark: undefined, delta: undefined }));
        return { ...n, props: { ...n.props, tiles: zeroed } };
      }
      /* Only as many tiles as this arrangement was built for: 大字 uses two
         because four labels truncate at its type size, and handing it four
         would undo a decision the register made about itself. */
      const room = Math.max(1, (tiles ?? []).length);
      return {
        ...n,
        props: {
          ...n.props,
          live: true,
          tiles: stats.tiles.slice(0, room).map((t, i) => ({
            label: t.label,
            value: t.value,
            deltaLabel: t.deltaLabel ?? "",
            /* ⚠️ 这一行漏掉就等於白做：上一期那个数字算出来了，
               投影不带过去，画面上就什么都不会变 ——
               这个仓库最常犯的那一类。 */
            ...(t.previous ? { previous: t.previous } : {}),
            tone: t.tone,
            ...(t.spark ? { spark: t.spark, delta: deltaOf(t.spark) } : {}),
            iconName: t.icon ?? ICONS[i] ?? "dashboard",
            /* The href each tile carried is kept: it points at the page that
               explains the figure, and which page that is has not changed. */
            href: (tiles?.[i] as { href?: string })?.href,
          })),
        },
      };
    }

    /*
      🔴 HeroCard, AND IT WAS FOUND BY LOOKING RATHER THAN BY ANY ASSERTION.

      A saved page has had its HeroCard split into a StatRow and a TrendChart
      by upgradeLayout, so the two arms below were enough for 总览 -- which is
      always a saved page by the time anybody reads it. A FRESHLY GENERATED
      page still carries the HeroCard itself, and 报表's first screenshot
      showed this business's own months in the table under a headline reading
      「RM 71,300」 -- the sample figure every customer in the product shares.

      That is the worst shape this defect takes (任务 80): a table of samples
      announces itself, a total does not, and two figures that disagree cannot
      both be believed.

      Mapped the same way splitHeroCard maps it, so a page projected before it
      is saved and the same page projected after cannot say different things.
    */
    if (n.type === "HeroCard") {
      const wasLive = (n.props as { live?: unknown }).live === true;
      if (!stats) {
        if (!wasLive) return node;
        const flat = (n.props.stats as { label?: string }[] | undefined) ?? [];
        return {
          ...n,
          props: {
            ...n.props,
            value: zeroLike(n.props.value),
            spark: [],
            stats: flat.map((st) => ({ ...st, value: zeroLike((st as { value?: unknown }).value) })),
          },
        };
      }
      const [head, ...rest] = stats.tiles;
      const keep = (n.props.stats as { href?: string }[] | undefined) ?? [];
      return {
        ...n,
        props: {
          ...n.props,
          live: true,
          label: head.label,
          value: head.value,
          chgSuffix: head.deltaLabel ?? "",
          /* HeroCard draws its sparkline from objects, not numbers -- the same
             shape splitHeroCard reads back. */
          spark: (head.spark ?? []).map((v) => ({ n: v })),
          stats: rest.slice(0, Math.max(1, keep.length)).map((tl, i) => ({
            label: tl.label,
            value: tl.value,
            sub: tl.deltaLabel ?? "",
            tone: tl.tone === "bad" ? "warn" : tl.tone === "warn" ? "caution" : undefined,
            /* The link each stat carried is kept: it points at the page that
               explains the figure, and which page that is has not changed. */
            href: keep[i]?.href,
          })),
        },
      };
    }

    if (n.type === "TrendChart") {
      const wasLive = (n.props as { live?: unknown }).live === true;
      if (!stats) {
        if (!wasLive) return node;
        const flat = (n.props.points as { label: string }[] | undefined) ?? [];
        return { ...n, props: { ...n.props, points: flat.map((p) => ({ label: p.label, value: 0 })) } };
      }
      return {
        ...n,
        props: {
          ...n.props,
          live: true,
          points: stats.trend,
          ...(stats.trendTitle ? { title: stats.trendTitle } : {}),
          ...(stats.trendCaption ? { caption: stats.trendCaption } : {}),
        },
      };
    }

    let changed = false;
    const props: Record<string, unknown> = { ...n.props };
    for (const [key, value] of Object.entries(n.props)) {
      if (Array.isArray(value) && value.some((v) => v && typeof v === "object" && "type" in (v as object))) {
        const sub = mapNodes(value, stats);
        if (sub.some((v, i) => v !== value[i])) {
          props[key] = sub;
          changed = true;
        }
      }
    }
    return changed ? { ...n, props } : node;
  });
}

/** 「RM 71,300」 -> 「RM 0」; 「4 个」 -> 「0 个」. The unit is his, the figure
 *  is not true any more. */
function zeroLike(value: unknown): string {
  const s = String(value ?? "");
  /* No \s in the class: 「4 个」 would give 「0个」, losing the space this
     language puts before its measure word. */
  return s.replace(/[\d][\d,.]*/, "0").trim() || "0";
}

/** The change between the last two periods, as a percentage. Mirrors
 *  headlineDelta in industry-template so the tile and the chart under it
 *  cannot disagree. */
function deltaOf(spark: number[]): number | undefined {
  if (spark.length < 2) return undefined;
  const [prev, last] = [spark[spark.length - 2], spark[spark.length - 1]];
  if (!prev) return undefined;
  return Math.round(((last - prev) / prev) * 1000) / 10;
}

/**
 * Read the figures for this project.
 *
 * Through the caller's own session, so RLS bounds it. Returns null on any
 * failure: a first screen showing its samples is a much better outcome than a
 * first screen that does not render.
 */
export async function fetchLiveStats(
  supabase: SupabaseClient,
  projectId: string,
  modules: string[],
  nouns: { customer: string; pipeline: string },
  pipelineModule: string | null,
  workflow: string[],
  lang: "zh" | "en" = "zh",
  at: Date = new Date(),
): Promise<LiveStats | null | undefined> {
  try {
    const [ledger, pipeline, customers] = await Promise.all([
      supabase
        .from("ledger_entries")
        .select("id, adjusts_id, module_key, direction, amount_cents, allocated_cents, entry_on")
        .eq("project_id", projectId),
      supabase
        .from("pipeline_records")
        .select("module_key, amount_cents, stage, issued_on")
        .eq("project_id", projectId)
        .is("archived_at", null),
      supabase
        .from("directory_entries")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .is("archived_at", null),
    ]);

    return buildLiveStats({
      lang,
      now: nowInMalaysia(at),
      modules,
      nouns,
      pipelineModule,
      workflow,
      ledger: (ledger.data as LedgerFact[]) ?? [],
      pipeline: (pipeline.data as PipelineFact[]) ?? [],
      customers: customers.count ?? 0,
    });
  } catch {
    /* Undefined, not null: see withLiveStats. A failed read must leave his
       first screen alone, never blank it to zero. */
    return undefined;
  }
}
