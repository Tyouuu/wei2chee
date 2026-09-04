import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLiveStats, nowInMalaysia } from "./live-stats";
import { buildProfit, signedRinggit, type ProfitFact } from "./profit";
import { ringgit } from "./live-rows";
import { describeOwing, fetchPartyOwing, type OwingRead } from "./debts";
import type { WorkspaceRole } from "./workspace";

/**
 * WHAT THE ASSISTANT MAY SAY ABOUT HIS MONEY.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The four figures on his first screen have been counted from his own books
 * since 2026-09-01. The assistant could not read one of them. So:
 *
 *   he types  「这个月收了多少」
 *   the page  behind the panel says 「本月收到 RM 12,340」
 *   the reply 「我看不到你的数字」
 *
 * That is the sixteenth time in this repository that a capability existed and
 * nothing was wired to it. The line being connected here is the shortest one
 * of the sixteen: the numbers are computed, localised, and already phrased in
 * this business's own nouns. They were simply never handed to the model.
 *
 * ── WHY IT IS NOT TEXT-TO-SQL ─────────────────────────────────────────────
 *
 * The open-source answer to this question is a model that writes the query
 * (vanna 23.8k★ MIT, DB-GPT 19.9k★ MIT, WrenAI 17.5k★ multi-licensed). Read
 * on 2026-09-03 and deliberately not taken, for a reason WrenAI's own
 * comparison table states first: a bare LLM agent "writes SQL for you ✅
 * (often wrong)". Their whole product is the guard rail around that -- dry
 * plan validation, row limits, structured errors -- and everything they built
 * it out of, we would have to build too.
 *
 * We do not need it. This business asks six questions, not six thousand, and
 * six answers can be counted in advance by code that a person has read. A
 * model that picks from six verified figures can be wrong about WHICH figure
 * the question wanted. A model that writes the query can be wrong about the
 * AMOUNT, silently, in a sentence that reads perfectly. Those two failures
 * are not the same size.
 *
 * What IS taken from them, and it is the expensive half of what they learned:
 *
 *   · the definitions live in a reviewable file, not buried in a prompt
 *     (WrenAI's semantic layer -- this file is ours)
 *   · identity flows through every layer, and the read is bounded by the
 *     same row-level rules a person meets (vanna 2.0's headline)
 *   · a row cap, so 「列出全部客户」 cannot return three thousand lines
 *
 * ── THE ONE RULE ──────────────────────────────────────────────────────────
 *
 * Everything below is COUNTED. Nothing is inferred, and the questions we
 * cannot count are named out loud in `gaps` -- because a model told only what
 * it knows will invent across the space between. Naming the hole is what
 * turns 「我不知道」 into 「那一格还没做，因为开销还挂不到某一单工程上」.
 */

/** Localised scaffolding. The FIGURES arrive already localised from
 *  live-stats -- these are only the words around them. */
const WORDS = {
  zh: {
    heading: "这家生意今天的数字（截至 <at>，全部从他自己的书数出来）",
    vsLast: "上个月",
    trend: "近六个月",
    rows: "最近这几笔（他自己的记录，可以直接引）",
    cannot: "答不了的（要老实讲，并说出为什么）",
    none: "他还没有任何记录，所以一个数字都数不出来。",
    unread: "读不到他的数字（这一次的查询失败了）。不要给任何数字，也不要说 0。",
  },
  en: {
    heading: "This business's figures today (as at <at>, all counted from their own books)",
    vsLast: "last month",
    trend: "last six months",
    rows: "The last few records (his own — quote them directly)",
    cannot: "Cannot be answered (say so plainly, and say why)",
    none: "They have no records yet, so nothing can be counted.",
    unread: "Their figures could not be read this time. Give no number, and never say 0.",
  },
} as const;

/**
 * The questions this shape of system cannot answer yet, and the reason.
 *
 * ⚠️ Each line is a REASON, not an apology. 「还没做」 alone teaches the model
 * to say 「我不知道」, which is the answer that makes an owner stop asking.
 * The reason is what lets it say something useful instead.
 *
 * ⚠️ And each line must retire when its gap closes. A stale entry here is the
 * assistant refusing to answer something the product can now do -- which is
 * the same defect as claiming something it cannot, wearing the other face.
 */
const GAPS = {
  zh: {
    /* ⚠️ 「赚多少」2026-09-04 从这里退休了 —— 20260904200000 给了开销一个
       类别跟一个单，所以那个数字现在数得出来，就在下面的 figures 里。
       留下来的是它窄掉之后剩的那一半：**单张的利润页面上看得到，
       而助手还查不了单张**。一条过期的「答不了」，是助手拒绝回答一件
       产品已经做得到的事。 */
    job: "某一单赚多少 —— 那一单自己的页面上写着，而这里查不了单张",
    /* ⚠️ 「某一个客户欠多少」2026-09-05 从这里退休了一半 —— 欠款清单在
       上面了（`party_debts`）。剩下的是**单张**：一张单的逐项、分期、
       分摊，这里还查不了。 */
    doc: "某一张单的细节（逐项 · 分期 · 分摊）—— 单张查询那一支还没做",
    stock: "库存还剩多少 —— 这几个数字里不含库存",
    nothingElse: "上面没有的任何数字 —— 不要自己相加减凑一个出来",
    /* 🔴 只在**没有问到**欠款的时候才出现。有问到的时候它是假的，
       而一条过期的「答不了」跟一句宣称做了却没做，是同一个缺陷的两张脸。 */
    owingUnread:
      "谁欠他钱 —— 这一次没有读到（要嘛他不是老板，要嘛那一支查询失败了）。不要讲「没有人欠你钱」",
  },
  en: {
    job: "What one job made — it is written on that job's own page, but this panel cannot look up a single document",
    doc: "The detail of one document (line items, instalments, allocations) — the single-document lookup does not exist yet",
    stock: "Stock on hand — not among these figures",
    nothingElse:
      "Any figure not listed above — never add or subtract two of them to make a new one",
    owingUnread:
      "Who owes him money — not read this time (either he is not the owner, or that query failed). Never say that nobody owes him",
  },
} as const;

/** 永远成立的那几条。`owingUnread` 不在里面 —— 它跟着这一次的读数走。 */
const ALWAYS_GAPS = ["job", "doc", "stock", "nothingElse"] as const;

/** At most this many trend points reach the prompt. Six is what the chart
 *  under the tiles already shows, so the assistant and the picture cannot
 *  disagree about how far back the business can see. */
const TREND_CAP = 6;

/**
 * At most this many records reach the prompt.
 *
 * WrenAI's row limit, and the reason is his, not ours: 「列出全部客户」 must
 * not come back as three thousand lines in a chat panel. Five is enough to
 * make a total checkable and short enough that the answer stays an answer
 * rather than becoming a report.
 */
const ROW_CAP = 5;

export type BusinessFacts = {
  /** Malaysia's date, not the server's. Every figure below is bounded by a
   *  month, and the server runs on UTC -- see nowInMalaysia. */
  asOf: string;
  figures: { label: string; value: string; previous?: string }[];
  /**
   * The few records behind the figures.
   *
   * A total he cannot open is a total he has to take on trust, and this is
   * the half of vanna's answer worth taking: it returns the number AND the
   * table under it. 「这个月收了 RM 4,321」 is an assertion; 「三笔：陈先生
   * 3,000 · 李太太 1,000 · 王老板 321」 is something he can check against
   * his own memory in two seconds.
   */
  rows: { doc: string; party: string; amount: string; on: string; stage?: string }[];
  trend: { label: string; value: number }[];
  /**
   * 谁欠他钱。
   *
   * 🔴 **三种，不是两种**（见 `lib/portal/debts.ts` 的档头）：
   *   null   没有问 / 读失败  -> 一个字都不要讲，而且 gaps 会多一行
   *   []     问了，没有人欠   -> 可以讲「都收齐了」
   *   [...]  这几个人欠
   *
   * 混掉第一跟第二种，就是对一个师傅讲「没有人欠你钱」，
   * 而他老板的帐上挂着三万。
   */
  owing: OwingRead;
  lang: "zh" | "en";
  /** True when the read itself failed, as opposed to succeeding and finding
   *  nothing. The prompt must say different things about those two, because
   *  「你还没有记录」 is a fact and 「我读不到」 is an outage. */
  unread: boolean;
};

/**
 * Read this business's figures, through the CALLER'S OWN SESSION.
 *
 * ⚠️ The client passed in must be the session client, never the service role.
 * This route holds both, and the difference is not stylistic: a 师傅 added
 * under 员工帐号 cannot see 收款, and the ONLY thing enforcing that is
 * row-level security on his own connection. Hand this the service role and
 * the assistant becomes the one door in the product where a staff account can
 * read the money -- with no error, in a friendly sentence.
 *
 * Returns null when there is nothing to say. The caller then sends no figures
 * at all, which is what makes the assistant answer 「我读不到」 rather than
 * a confident RM 0.
 */
export async function fetchBusinessFacts(
  supabase: SupabaseClient,
  projectId: string,
  modules: string[],
  nouns: { customer: string; pipeline: string },
  pipelineModule: string | null,
  workflow: string[],
  /**
   * 谁在问。
   *
   * ⚠️ **必填，而且没有预设**。写成「预设 owner」在测试里会全绿，
   * 而在一个师傅面前会把他老板的欠款清单念出来；写成「零行就是没有人欠」
   * 会在同一个人面前说谎。两个都是这一行避掉的。
   */
  role: WorkspaceRole,
  lang: "zh" | "en" = "en",
  at: Date = new Date(),
): Promise<BusinessFacts | null> {
  const stats = await fetchLiveStats(
    supabase,
    projectId,
    modules,
    nouns,
    pipelineModule,
    workflow,
    lang,
    at,
  );

  /* Three outcomes, and they are not the same thing:
       undefined  the read threw            -> say we could not read
       null       nothing worth showing     -> say he has no records yet
       LiveStats  figures                   -> hand them over
     Collapsing the first two is how a product ends up telling an owner his
     month is empty because a query timed out. */
  if (stats === undefined) {
    return {
      asOf: malaysianDate(at),
      figures: [],
      rows: [],
      trend: [],
      owing: null,
      lang,
      unread: true,
    };
  }
  /* ⚠️ NOT null. A read that succeeded and found nothing is a FACT about
     his month -- 「你还没有任何记录」 -- and it has to reach the model, because
     the alternative is an empty prompt block and a model with no instruction
     not to invent. Reserve null for 「there is no business context at all」,
     which the caller already guards.

     This was a real bug in the first version of this file: returning null here
     meant the 「还没有记录」 sentence below could never be rendered. */
  if (!stats || !stats.tiles.length) {
    return {
      asOf: malaysianDate(at),
      figures: [],
      rows: [],
      trend: [],
      owing: null,
      lang,
      unread: false,
    };
  }

  return {
    asOf: malaysianDate(at),
    figures: [
      ...stats.tiles.map((t) => ({
        label: t.label,
        value: t.value,
        previous: t.previous,
      })),
      ...(await fetchProfit(supabase, projectId, lang, at)),
    ],
    rows: await fetchRecentRows(supabase, projectId),
    trend: stats.trend.slice(-TREND_CAP),
    owing: await fetchPartyOwing(supabase, projectId, role, lang),
    lang,
    unread: false,
  };
}

/**
 * 花掉多少、赚多少 -- 这个月。
 *
 * 🔴 这两个数字是 `live-answers` 存在过的最长的一条缝：GAPS 的第一行从
 * 这个档案写出来那天就是「赚多少 -- 算不出来」，而 20260904200000 之后
 * 它算得出来了。这一支就是让那一行退休的东西。
 *
 * ⚠️ 一份定义，不是两份。它呼叫 `buildProfit`，跟 `报表` 那一页画那两格
 * 用的是同一支 -- 不然助手讲的数字跟他画面上那一格会不一样，
 * 而那是这个仓库最贵的一种错。
 *
 * ⚠️ 走**呼叫者自己的连线**（跟这个档案其余每一个读一样）：
 * `ledger_entries` 是 sees_money，所以一个师傅拿回来的是空的 --
 * 而空的会算成「这个月赚了全额」。所以读不到就一格都不给，不是给 0。
 *
 * ⚠️ 他从来没记过开销的时候**不给「赚」那一格**，跟 `报表` 同一条：
 * 那时候「赚」等於「收到」，而那是宣称一件我们不知道的事。
 */
async function fetchProfit(
  supabase: SupabaseClient,
  projectId: string,
  lang: "zh" | "en",
  at: Date,
): Promise<BusinessFacts["figures"]> {
  try {
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("id, direction, amount_cents, entry_on, category, adjusts_id")
      .eq("project_id", projectId);
    if (error || !data?.length) return [];

    const now = nowInMalaysia(at);
    const slice = buildProfit(data as unknown as ProfitFact[], now);
    const everSpent = (data as { direction?: string | null }[]).some(
      (e) => (e.direction ?? "in") === "out",
    );
    if (!everSpent) return [];

    const w =
      lang === "en"
        ? { spent: "Spent this month", earned: "Kept this month", on: "Biggest" }
        : { spent: "本月花掉", earned: "本月赚", on: "最大一笔" };
    const top = slice.byCategory[0];
    return [
      {
        label: w.spent,
        value: ringgit(slice.outCents) ?? "RM 0",
        previous: top
          ? `${w.on}: ${top.name ?? (lang === "en" ? "not categorised" : "没写类别")} ${ringgit(top.cents) ?? ""}`
          : undefined,
      },
      { label: w.earned, value: signedRinggit(slice.profitCents) ?? "RM 0" },
    ];
  } catch {
    /* 读不到就一格都不给。给一个 0 出去，助手会照着讲。 */
    return [];
  }
}

/**
 * The last few records, so a total can be opened rather than believed.
 *
 * ⚠️ Its own query rather than a second return value out of fetchLiveStats:
 * that function's job is the four tiles and it is read by the page every
 * time anybody opens the dashboard. Widening it to carry rows it does not
 * draw would make every page load pay for a panel nobody has opened.
 *
 * ⚠️ Failure is silent and returns nothing. The figures are the answer; the
 * rows are the receipt. A missing receipt must not cost him the answer.
 */
async function fetchRecentRows(
  supabase: SupabaseClient,
  projectId: string,
): Promise<BusinessFacts["rows"]> {
  try {
    const [ledger, pipeline] = await Promise.all([
      supabase
        .from("ledger_entries")
        .select("doc_no, party, amount_cents, entry_on, direction")
        .eq("project_id", projectId)
        .order("entry_on", { ascending: false })
        .limit(ROW_CAP),
      supabase
        .from("pipeline_records")
        .select("doc_no, party, amount_cents, issued_on, stage")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("issued_on", { ascending: false })
        .limit(ROW_CAP),
    ]);

    const money = (c: number | null) =>
      typeof c === "number" ? `RM ${(c / 100).toLocaleString("en-MY")}` : "";

    return [
      ...((ledger.data ?? []) as Record<string, unknown>[]).map((r) => ({
        doc: String(r.doc_no ?? ""),
        party: String(r.party ?? ""),
        /* Direction rather than a sign: 「out」 on a receipt line is a refund,
           and printing it as a negative is how a reader mistakes it for a
           mistyped amount. The ledger itself made this choice first. */
        amount: `${money(r.amount_cents as number)}${r.direction === "out" ? " (out)" : ""}`,
        on: String(r.entry_on ?? ""),
      })),
      ...((pipeline.data ?? []) as Record<string, unknown>[]).map((r) => ({
        doc: String(r.doc_no ?? ""),
        party: String(r.party ?? ""),
        amount: money(r.amount_cents as number),
        on: String(r.issued_on ?? ""),
        stage: String(r.stage ?? "") || undefined,
      })),
    ];
  } catch {
    return [];
  }
}

/** Malaysia's calendar date. Not toISOString(): at 8am in Kuala Lumpur the
 *  server's UTC clock still reads yesterday, and this string is what the
 *  assistant will quote as 「截至今天」. */
function malaysianDate(at: Date): string {
  const shifted = new Date(at.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The block that goes into the prompt.
 *
 * ⚠️ Goes with the VOLATILE half of the message, beside the page listing --
 * never above the catalogue. These numbers change the moment he records a
 * payment, and a provider cache is a prefix match: putting them high strands
 * every fixed token behind them, which is the 75% -> 97% lesson already paid
 * for once in this route.
 */
export function renderBusinessFacts(facts: BusinessFacts | null): string {
  const w = WORDS[facts?.lang ?? "en"];
  const g = GAPS[facts?.lang ?? "en"];

  if (!facts) return "";
  if (facts.unread) return w.unread;

  if (!facts.figures.length) return w.none;

  const lines = facts.figures.map((f) => {
    const was = f.previous ? ` (${w.vsLast} ${f.previous})` : "";
    return `- ${f.label}: ${f.value}${was}`;
  });

  if (facts.trend.length) {
    lines.push(`- ${w.trend}: ${facts.trend.map((p) => `${p.label} ${p.value}`).join(" · ")}`);
  }

  /* The receipt under the total. Capped upstream; capped again here so a
     future caller cannot widen it by accident. */
  const receipt = facts.rows.length
    ? [
        "",
        `${w.rows}:`,
        ...facts.rows
          .slice(0, ROW_CAP * 2)
          .map((r) =>
            `- ${[r.doc, r.party, r.amount, r.on, r.stage].filter(Boolean).join(" · ")}`,
          ),
      ]
    : [];

  /* 谁欠他钱。**空阵列跟 null 在这里就分开了** —— 见 `debts.ts` 的档头。 */
  const owing = describeOwing(facts.owing, facts.lang);

  /* 🔴 这一次答不了的，跟永远答不了的，放在同一段但来源不同。
     `owingUnread` 只在没有读到欠款的时候出现 —— 读到了还留着它，
     就是助手拒绝回答一件它手上已经有答案的事。 */
  const gaps = [
    ...ALWAYS_GAPS.map((k) => g[k]),
    ...(facts.owing == null ? [g.owingUnread] : []),
  ];

  return [
    w.heading.replace("<at>", facts.asOf),
    ...lines,
    ...(owing.length ? ["", ...owing] : []),
    ...receipt,
    "",
    `${w.cannot}:`,
    ...gaps.map((line) => `- ${line}`),
  ].join("\n");
}

/** Exported for the guard: a gap line that names nothing is an apology, and
 *  an apology teaches the model to stop answering. */
export const BUSINESS_FACT_GAPS = GAPS;

/** Exported for the guard: which of them are always true, and which one only
 *  appears when this particular read came back empty-handed. */
export const BUSINESS_FACT_ALWAYS_GAPS = ALWAYS_GAPS;
