import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLiveStats } from "./live-stats";

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
    cannot: "答不了的（要老实讲，并说出为什么）",
    none: "他还没有任何记录，所以一个数字都数不出来。",
    unread: "读不到他的数字（这一次的查询失败了）。不要给任何数字，也不要说 0。",
  },
  en: {
    heading: "This business's figures today (as at <at>, all counted from their own books)",
    vsLast: "last month",
    trend: "last six months",
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
  zh: [
    "赚多少 / 某一单的利润 —— 开销今天还挂不到某一单工程上，所以算不出来",
    "某一个客户欠多少 / 某一张单的细节 —— 按客户查那一支还没做",
    "库存还剩多少 —— 这几个数字里不含库存",
    "上面没有的任何数字 —— 不要自己相加减凑一个出来",
  ],
  en: [
    "Profit, on the month or on one job — expenses cannot yet be attached to a job, so it cannot be worked out",
    "What one customer owes, or the detail of one document — the per-customer lookup does not exist yet",
    "Stock on hand — not among these figures",
    "Any figure not listed above — never add or subtract two of them to make a new one",
  ],
} as const;

/** At most this many trend points reach the prompt. Six is what the chart
 *  under the tiles already shows, so the assistant and the picture cannot
 *  disagree about how far back the business can see. */
const TREND_CAP = 6;

export type BusinessFacts = {
  /** Malaysia's date, not the server's. Every figure below is bounded by a
   *  month, and the server runs on UTC -- see nowInMalaysia. */
  asOf: string;
  figures: { label: string; value: string; previous?: string }[];
  trend: { label: string; value: number }[];
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
    return { asOf: malaysianDate(at), figures: [], trend: [], lang, unread: true };
  }
  /* ⚠️ NOT null. A read that succeeded and found nothing is a FACT about
     his month -- 「你还没有任何记录」 -- and it has to reach the model, because
     the alternative is an empty prompt block and a model with no instruction
     not to invent. Reserve null for 「there is no business context at all」,
     which the caller already guards.

     This was a real bug in the first version of this file: returning null here
     meant the 「还没有记录」 sentence below could never be rendered. */
  if (!stats || !stats.tiles.length) {
    return { asOf: malaysianDate(at), figures: [], trend: [], lang, unread: false };
  }

  return {
    asOf: malaysianDate(at),
    figures: stats.tiles.map((t) => ({
      label: t.label,
      value: t.value,
      previous: t.previous,
    })),
    trend: stats.trend.slice(-TREND_CAP),
    lang,
    unread: false,
  };
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
  const gaps = GAPS[facts?.lang ?? "en"];

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

  return [
    w.heading.replace("<at>", facts.asOf),
    ...lines,
    "",
    `${w.cannot}:`,
    ...gaps.map((g) => `- ${g}`),
  ].join("\n");
}

/** Exported for the guard: a gap line that names nothing is an apology, and
 *  an apology teaches the model to stop answering. */
export const BUSINESS_FACT_GAPS = GAPS;
