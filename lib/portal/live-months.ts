import type { SupabaseClient } from "@supabase/supabase-js";
import { ringgit, type LiveRow } from "./live-rows";
import { buildProfit, signedRinggit, type ProfitFact } from "./profit";
import {
  lastSixMonths,
  nowInMalaysia,
  ymOf,
  type LiveStat,
  type LiveStats,
} from "./live-stats";

/**
 * 报表 and 排名, read from the books he already has.
 *
 * ── WHY THESE TWO ARE ONE FILE ────────────────────────────────────────────
 *
 * The catalogue groups them under a heading it wrote before either was built:
 * 「月底才看的 — 一行资料都不新增」. That is the whole fact about them. They are
 * not shapes waiting for a table; they are QUESTIONS ASKED OF THE OTHER
 * SHAPES' TABLES, and they were listed as 「still drawings」 only because
 * nothing had ever asked.
 *
 * So there is no migration here, no RPC, no 加一单 and no assistant write path
 * -- and there never should be. A 报表 page with its own table would be a
 * second copy of the ledger that can disagree with it, which is the defect
 * this repo has shipped more times than any other.
 *
 * ⚠️ THE OTHER THREE ARE NOT LIKE THESE, and saying so here is the point of
 * this paragraph:
 *
 *   总览        already reads real figures (live-stats.ts) and real rows
 *               (live-rows.ts). Its SHAPE_STATE said `drawn` because that
 *               state machine has two states and this page fits neither --
 *               see the note now beside it.
 *   对账        needs ONE small real table: the outside total (bank, principal,
 *               platform) to compare the books against. Without a statement to
 *               reconcile TO, the page can only show its own sum twice.
 *   预约        needs a real table with time, overlap and prepaid balances. It
 *               is the biggest of the five, and the salon that needs it does
 *               not start until next year (任务 44).
 *
 * ── WHAT EACH ONE COUNTS, STATED BEFORE IT IS COMPUTED ────────────────────
 *
 *   报表   MONEY THAT ARRIVED, by month. Cash in, not accrual revenue -- this
 *          product does not do accounting (任务 71) and must not imply that it
 *          does. The table's own column is headed 营业额, which is what a
 *          business on cash terms means by the word; the headline tile beside
 *          it says 「本月收到」 in as many words, so the definition is ON THE
 *          PAGE and not only in this comment. 任务 80's rule: a right number
 *          under a wrong label is worse than a sample.
 *
 *   排名   THE COUNTERPARTIES, by how much moved through them in 90 days. One
 *          source at a time, never summed: a quotation and the payment against
 *          it are the same money seen twice.
 */

/** One side of a document, as these two pages need to see it. */
export type PartyFact = {
  party: string;
  party_id: string | null;
  amount_cents: number | null;
  on: string | null;
};

export type MonthFact = {
  /* 🔴 必填，同 LedgerFact 的理由：没有这两栏就分不出「收到了」跟
     「收到过又退回去了」，而少了它们算出来的月结看起来完全正常。 */
  id: string;
  adjusts_id: string | null;
  direction: string | null;
  category: string | null;
  amount_cents: number | null;
  entry_on: string | null;
};

const WORDS = {
  zh: {
    received: "本月收到",
    entries: "笔数",
    average: "平均一笔",
    vsLast: "vs 上个月",
    cash: "钱真的进来的那一天算",
    count: (n: number) => `${n} 笔`,
    monthRow: (y: number, m: number) => `${y} 年 ${m} 月`,
    month: (m: number) => `${m}月`,
    up: "增长",
    down: "下滑",
    spent: "本月花掉",
    commissionOut: "本月佣金",
    earned: "本月赚",
    /* ⚠️ 「赚」不是「净利」。我们算的是收付实现制 -- 这个月真的进来的钱减
       真的花出去的钱 -- 而「净利」是一个有准确会计定义的词，指的不是它。
       用日常的字，是为了不宣称一件我们没有做到的事。 */
    earnedHow: "收到的减花掉的",
    noSpend: "还没记过开销",
    biggest: (name: string, amount: string) => `最大一笔：${name} ${amount}`,
    uncategorised: "没写类别",
    flat: "持平",
    none: "上个月没有",
    top: "顶级",
    active: "活跃",
    slipping: "退步中",
    activeCount: "有来往的",
    window: "近 90 天",
    trendTitle: "每个月有来往的人数",
    trendCaption: "一个月里有过记录的不同对象，不分等级。",
    daysAgo: (n: number) => (n <= 0 ? "今天" : `${n} 天前`),
  },
  en: {
    received: "Received this month",
    entries: "Entries",
    average: "Average entry",
    vsLast: "vs last month",
    cash: "Counted on the day the money arrived",
    count: (n: number) => `${n}`,
    monthRow: (y: number, m: number) =>
      `${MONTHS_EN[m - 1] ?? m} ${y}`,
    month: (m: number) => SHORT_EN[m - 1] ?? "",
    up: "Up",
    down: "Down",
    spent: "Spent this month",
    commissionOut: "Commission this month",
    earned: "Kept this month",
    earnedHow: "What came in, less what went out",
    noSpend: "No expenses recorded yet",
    biggest: (name: string, amount: string) => `Biggest: ${name} ${amount}`,
    uncategorised: "Not categorised",
    flat: "Flat",
    none: "Nothing last month",
    top: "Top",
    active: "Active",
    slipping: "Slipping",
    activeCount: "Dealt with",
    window: "Last 90 days",
    trendTitle: "People you dealt with each month",
    trendCaption: "How many different counterparties had a record that month, whatever their tier.",
    daysAgo: (n: number) => (n <= 0 ? "Today" : `${n}d ago`),
  },
} as const;

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthLang = keyof typeof WORDS;

/* ──────────────────────────────────────────────────────────────────────────
   报表 -- 按月看趋势
   ────────────────────────────────────────────────────────────────────────── */

export function buildMonthlyReport(input: {
  lang: MonthLang;
  now: { y: number; m: number };
  ledger: MonthFact[];
}): { stats: LiveStats; rows: LiveRow[] } | null {
  const w = WORDS[input.lang] ?? WORDS.zh;
  if (!input.ledger.length) return null;

  /* 🔴 冲正过的不算 -- 而在这一页它比在别处更要紧，因为这一页整栏都是钱。
     一笔退回去的收款在这之前照样算成营业额。 */
  const dead = new Set(input.ledger.map((e) => e.adjusts_id).filter(Boolean) as string[]);
  const live = input.ledger.filter((e) => !e.adjusts_id && !dead.has(e.id));
  const income = live.filter((e) => (e.direction ?? "in") === "in");

  /* The same six the chart draws, so the last bar and the first row of the
     table are the same month. Two spans would let them disagree.

     ⚠️ SEVEN ARE COUNTED AND SIX ARE SHOWN. The first version had nothing to
     compare its oldest row against and printed 「第一个月」 -- a claim about
     this business it had no way to check, since the month before it simply had
     not been fetched. A page that invents a fact to fill a column is the
     failure this whole directory is written against. */
  const months = lastSixMonths(input.now);
  const months7 = [before(months[0]), ...months];

  const totals = months7.map((m) => {
    const rows = income.filter((e) => {
      const ym = ymOf(e.entry_on);
      return !!ym && ym.y === m.y && ym.m === m.m;
    });
    return {
      ...m,
      cents: rows.reduce((n, e) => n + (e.amount_cents ?? 0), 0),
      count: rows.length,
    };
  });

  /* Newest first: the month he is in is the month he opened the page for. The
     seventh is dropped here -- it was only ever the thing the oldest row is
     measured against. */
  const shown = totals.slice(1);
  const rows: LiveRow[] = shown
    .map((t, i) => ({ t, prev: totals[i] }))
    .reverse()
    .map(({ t, prev }) => {
      const delta =
        prev.cents === 0 ? null : Math.round(((t.cents - prev.cents) / prev.cents) * 1000) / 10;
      return {
        primary: w.monthRow(t.y, t.m),
        secondary: w.count(t.count),
        amount: ringgit(t.cents) ?? "RM 0",
        /* A quiet month is not a warning on its own -- a new business has
           several, and colouring them red would be this product telling him
           his own first months were a problem. Only a real fall is marked. */
        tone:
          delta == null ? "neutral" : delta > 0 ? "positive" : delta < 0 ? "warning" : "neutral",
        /* 「上个月没有」 rather than 「持平」. Nothing against nothing is not
           level pegging, and RM 3,200 against nothing is certainly not. */
        status: delta == null ? w.none : delta > 0 ? w.up : delta < 0 ? w.down : w.flat,
      };
    });

  const thisMonth = shown[shown.length - 1];
  const spark = shown.map((t) => t.cents / 100);

  const tiles: LiveStat[] = [
    {
      label: w.received,
      value: ringgit(thisMonth.cents) ?? "RM 0",
      deltaLabel: w.vsLast,
      tone: "good",
      spark,
      icon: "payments",
    },
    {
      label: w.entries,
      value: w.count(thisMonth.count),
      /* The definition, on the page. See the header. */
      deltaLabel: w.cash,
      tone: "normal",
      icon: "reconciliation",
    },
  ];

  /* ⚠️ 「平均一笔」拿掉了，位子让给「花掉」跟「赚」。
     一个承包商一个月三笔收款，那个平均数几乎不讲任何事；而「赚多少」
     是他打开这一页的那个问题。四格已经是一行放得下的上限，
     所以这是一个取舍，不是一次顺手删除。 */

  /* ── 花掉多少，跟赚多少 ────────────────────────────────────────────────
     这两格是 20260904200000 那一整支的目的：`live-answers` 的 GAPS 第一行
     从写出来那天就是「赚多少 -- 算不出来」，而这里是它算得出来的地方。 */
  const spend = buildProfit(input.ledger as unknown as ProfitFact[], {
    y: thisMonth.y,
    m: thisMonth.m,
  });
  /* 这一家有没有**记过**开销 -- 不是这个月有没有，是这几个月里有没有。 */
  const everSpent = live.some((e) => (e.direction ?? "in") === "out");
  const top = spend.byCategory[0];

  tiles.push({
    label: w.spent,
    value: ringgit(spend.outCents) ?? "RM 0",
    /* 类别的分布，塞在这一格的副标里 -- 一整块「钱花在哪」要动版面，
       而版面是别人的地盘。最大的那一笔已经答掉他八成的问题。 */
    deltaLabel: everSpent
      ? top
        ? w.biggest(top.name ?? w.uncategorised, ringgit(top.cents) ?? "RM 0")
        : undefined
      : w.noSpend,
    tone: "normal",
    icon: "expenses",
  });

  /* 🔴 他从来没记过一笔开销的时候，**不画这一格**。
     那时候「赚」会等於「收到」，而那是这一页在宣称一件它不知道的事 --
     他的成本我们一个字都没有。等他记了第一笔，这一格自己出现。 */
  if (everSpent) {
    tiles.push({
      label: w.earned,
      /* 亏钱的月份是负的，不夹成 0 -- 夹了就是替他把坏消息藏起来，
         而那正是他打开这一页要看的那一件。 */
      value: signedRinggit(spend.profitCents) ?? "RM 0",
      /* 定义写在画面上，不是只写在这份注解里（任务 80）。 */
      deltaLabel: w.earnedHow,
      tone: spend.profitCents < 0 ? "warn" : "good",
      icon: "reports",
    });
  }

  return {
    stats: { tiles, trend: shown.map((t) => ({ label: w.month(t.m), value: t.cents / 100 })) },
    rows,
  };
}

/** The month before this one. Only ever used to give the oldest displayed row
 *  something real to be compared against. */
function before(m: { y: number; m: number }): { y: number; m: number } {
  return m.m === 1 ? { y: m.y - 1, m: 12 } : { y: m.y, m: m.m - 1 };
}

/* ──────────────────────────────────────────────────────────────────────────
   排名 -- 谁最活跃、谁在退步
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Days between two plain dates, read as digits.
 *
 * ⚠️ NOT `new Date(a) - new Date(b)`. Same reason as ymOf: these are DATE
 * columns arriving as 「2026-08-31」 with no zone, and the server runs on UTC.
 * Parsing them into instants makes 「9 天前」 read 「10 天前」 for anyone opening
 * the page before 8am in Kuala Lumpur.
 */
export function daysBetween(from: string, to: string): number {
  const at = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  };
  const a = at(from);
  const b = at(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function buildRanking(input: {
  lang: MonthLang;
  /** Today in Malaysia as 「2026-09-01」. Passed in rather than read here, so
   *  the same input always produces the same page. */
  today: string;
  now: { y: number; m: number };
  /** Whichever ONE source this business has rows in -- see fetchMonthlyPage.
   *  Summing a quotation and the payment against it counts money twice. */
  facts: PartyFact[];
  window?: number;
}): { stats: LiveStats; rows: LiveRow[] } | null {
  const w = WORDS[input.lang] ?? WORDS.zh;
  if (!input.facts.length) return null;
  const span = input.window ?? 90;
  const half = Math.round(span / 2);

  /* ⚠️ GROUPED BY id WHERE THERE IS ONE, BY NAME WHERE THERE IS NOT, AND THAT
     IS THE OPPOSITE CALL FROM convert_enquiry ON PURPOSE.
     20260901060000 refuses to file a NEW record against an existing person by
     name, because two 陈先生 with different numbers are two men. Nothing is
     filed here and nothing is written -- and a ranking that split one dealer
     into two rows because half his receipts predate his customer record would
     be answering a question nobody asked. The two rules look like a
     contradiction and are not, so it is said out loud. */
  type Group = { name: string; recent: number; earlier: number; last: string | null };
  const by = new Map<string, Group>();

  for (const f of input.facts) {
    const name = (f.party ?? "").trim();
    const key = f.party_id ?? name.toLowerCase();
    /* A document with nobody on it belongs to no row on a ranking of people. */
    if (!key || !name) continue;
    const age = f.on ? daysBetween(f.on, input.today) : Number.POSITIVE_INFINITY;
    const g = by.get(key) ?? { name, recent: 0, earlier: 0, last: null };
    g.name = name;
    if (age <= half) g.recent += f.amount_cents ?? 0;
    else if (age <= span) g.earlier += f.amount_cents ?? 0;
    if (age <= span && f.on && (!g.last || f.on > g.last)) g.last = f.on;
    by.set(key, g);
  }

  const groups = [...by.values()]
    .filter((g) => g.last !== null)
    .sort((a, b) => b.recent + b.earlier - (a.recent + a.earlier));
  if (!groups.length) return null;

  /* 顶级 is the top fifth, and THAT is the one judgement on this page --
     「top」 has to mean something under a column headed 等级. Everything else is
     measured: 退步中 means the recent half is smaller than the half before it
     AND the half before it was not zero, so a brand-new counterparty is never
     marked as declining from nothing. */
  const topN = Math.max(1, Math.ceil(groups.length / 5));

  const slippingOf = (g: Group) => g.earlier > 0 && g.recent < g.earlier;

  const rows: LiveRow[] = groups.map((g, i) => ({
    primary: g.name,
    secondary: g.last ? w.daysAgo(daysBetween(g.last, input.today)) : "",
    amount: ringgit(g.recent + g.earlier) ?? "RM 0",
    tone: slippingOf(g) ? "warning" : "positive",
    status: slippingOf(g) ? w.slipping : i < topN ? w.top : w.active,
  }));

  /* 「活跃人数变化」 -- exactly what the chart's own caption says, counted:
     how many different counterparties had anything at all in each month. */
  const trend = lastSixMonths(input.now).map((m) => {
    const seen = new Set<string>();
    for (const f of input.facts) {
      const ym = ymOf(f.on);
      if (!ym || ym.y !== m.y || ym.m !== m.m) continue;
      const name = (f.party ?? "").trim();
      const key = f.party_id ?? name.toLowerCase();
      if (key && name) seen.add(key);
    }
    return { label: w.month(m.m), value: seen.size };
  });

  const slipping = groups.filter(slippingOf).length;
  const tiles: LiveStat[] = [
    {
      label: w.activeCount,
      value: String(groups.length),
      deltaLabel: w.window,
      tone: "normal",
      spark: trend.map((t) => t.value),
      icon: "customers",
    },
    {
      label: w.slipping,
      value: String(slipping),
      tone: slipping > 0 ? "warn" : "normal",
      icon: "reconciliation",
    },
  ];

  return {
    /* ⚠️ IT RENAMES ITS OWN CHART, AND HAS TO.
       The block was drawn with the caption 「顶级和活跃加起来的人数」, and this
       counts everybody who had a record -- 退步中 included. A tier is worked
       out over the whole 90 days, so it cannot be re-decided month by month
       and that caption cannot be made true. Only the thing that did the
       counting knows what was counted, so it says so. 任务 80: a right number
       under a wrong label is worse than a sample. */
    stats: { tiles, trend, trendTitle: w.trendTitle, trendCaption: w.trendCaption },
    rows,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   READING
   ────────────────────────────────────────────────────────────────────────── */

/** 「2026-09-01」 in Kuala Lumpur. */
export function todayInMalaysia(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** 「2026-09-01」＋「18:27」，一次算完——预约那一页跟客户页的
 *  「Upcoming Booking」原本各自 `new Intl.DateTimeFormat(...)` 一次，
 *  这里抽成一支，两边读同一个答案（[重点 31]：加，不是重打第二份）。
 *  见 `[recordId]/page.tsx` 的 `parts()`，同一段逻辑搬过来的。 */
export function dayAndTimeInMalaysia(iso: string): {
  day: string;
  time: string;
} {
  const got = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const at = (type: string) => got.find((x) => x.type === type)?.value ?? "";
  /* 24-hour, and Intl says 「24」 for midnight in some locales where a time
     input wants 「00」. */
  const hour = at("hour") === "24" ? "00" : at("hour");
  return {
    day: `${at("year")}-${at("month")}-${at("day")}`,
    time: `${hour}:${at("minute")}`,
  };
}

/**
 * Read one of the two month-end pages for this project.
 *
 * Through the caller's own session, so RLS bounds it.
 *
 * `undefined` on failure and `null` for 「he genuinely has nothing」 -- the same
 * two-value contract withLiveStats already relies on, because collapsing them
 * prints zeroes across a page every time a query fails, and a lie is worse
 * than a demonstration.
 */
/**
 * 收款 · 开销 · 佣金那三页顶上的那个数字。
 *
 * ── 🔴 为什么非做不可 ─────────────────────────────────────────────────────
 *
 * `npm run shoot:phone` 2026-09-05 对着真的产品跑：**收款那一页顶上印着
 * `RM 71,300`** —— 那是 `sample-system.ts` 里每一家公司共用的那个示例总数。
 * 底下那张表早就是他自己的行了（8-31 起），而**头上那个数字还是别人的**。
 *
 * 一桌示例会自己招认（陈先生、李太太）；**一个总数只是一个数字，看起来就是他的**。
 * 总览那一页 2026-08-31 就是为了这一句修的 —— 而收款 · 开销 · 佣金三页
 * 从那天起被记在「还欠」里（[任务 94](../../docs/founder-tasks.md)），没有人回来接。
 *
 * ⚠️ 而它还连着第二件：手机那四条通则里「一个大数字当主角」那一条，
 * **唯一过关的一页就是收款，而它过关靠的正是这个假数字**。
 * 一条靠另一条的洞才过关的检查，等於没过。
 *
 * ── 它故意比 `buildMonthlyReport` 少 ──────────────────────────────────────
 *
 * 报表那一页要答「赚多少」，所以它两个方向都读、还要分类别。
 * 这三页各自只讲**自己那一个模块**的一件事：这个月进来（或出去）多少、几笔。
 * 「还没用完的订金」故意不放 —— 总览已经有那一格，
 * 同一个数字在两页各算一次，就是两份会漂移的真相。
 */
export function buildLedgerHeadline(input: {
  lang: MonthLang;
  now: { y: number; m: number };
  moduleKey: string;
  ledger: MonthFact[];
}): LiveStats | null {
  const w = WORDS[input.lang] ?? WORDS.zh;
  if (!input.ledger.length) return null;

  /* 冲正过的不算 —— 跟报表那一页同一条规矩，同一段程式的形状。
     一笔退回去的收款在这之前照样算进这个月。 */
  const dead = new Set(input.ledger.map((e) => e.adjusts_id).filter(Boolean) as string[]);
  const live = input.ledger.filter((e) => !e.adjusts_id && !dead.has(e.id));
  if (!live.length) return null;

  const months = lastSixMonths(input.now);
  const totals = months.map((m) => {
    const rows = live.filter((e) => {
      const ym = ymOf(e.entry_on);
      return !!ym && ym.y === m.y && ym.m === m.m;
    });
    return { ...m, cents: rows.reduce((n, e) => n + (e.amount_cents ?? 0), 0), count: rows.length };
  });
  const thisMonth = totals[totals.length - 1];

  /* 每一页用它自己的动词。佣金不用「花掉」—— 它确实是出去的钱，
     但一个老板不会把发给师傅的抽成叫「开销」。 */
  const label =
    input.moduleKey === "payments" ? w.received
    : input.moduleKey === "commission" ? w.commissionOut
    : w.spent;

  return {
    tiles: [
      {
        label,
        value: ringgit(thisMonth.cents) ?? "RM 0",
        deltaLabel: w.vsLast,
        tone: input.moduleKey === "payments" ? "good" : "normal",
        spark: totals.map((t) => t.cents / 100),
        icon: "payments",
      },
      {
        label: w.entries,
        value: w.count(thisMonth.count),
        deltaLabel: w.cash,
        tone: "normal",
        icon: "reconciliation",
      },
    ],
    trend: totals.map((t) => ({ label: w.month(t.m), value: Math.round(t.cents / 100) })),
  };
}

/**
 * 读那三页的那一个数字。
 *
 * ⚠️ `undefined` 是「读不到」，页面原样不动；`null` 才是「他真的还没有」。
 * 两个合成一个，就是每一次查询失败都在他的第一屏印 RM 0 —— 那是说谎，不是降级。
 */
export async function fetchLedgerHeadline(
  supabase: SupabaseClient,
  projectId: string,
  moduleKey: string,
  lang: MonthLang = "zh",
  at: Date = new Date(),
): Promise<LiveStats | null | undefined> {
  try {
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("id, adjusts_id, direction, category, amount_cents, entry_on")
      .eq("project_id", projectId)
      /* 只读这一页自己那个模块 —— 收款那一页不该把开销算进去。 */
      .eq("module_key", moduleKey);
    if (error) return undefined;
    return buildLedgerHeadline({
      lang,
      now: nowInMalaysia(at),
      moduleKey,
      ledger: (data ?? []) as MonthFact[],
    });
  } catch {
    return undefined;
  }
}

export async function fetchMonthlyPage(
  supabase: SupabaseClient,
  projectId: string,
  shape: "report" | "leaderboard",
  lang: MonthLang = "zh",
  at: Date = new Date(),
): Promise<{ stats: LiveStats; rows: LiveRow[] } | null | undefined> {
  const now = nowInMalaysia(at);
  try {
    if (shape === "report") {
      /* 🔴 两个方向都读，不再只读 in：这一页现在要答「赚多少」，
         而少了 out 那一半它只答得出「收多少」。 */
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("id, adjusts_id, direction, category, amount_cents, entry_on")
        .eq("project_id", projectId);
      if (error) return undefined;
      return buildMonthlyReport({ lang, now, ledger: (data ?? []) as MonthFact[] });
    }

    /* ONE SOURCE, NOT BOTH. The ledger first, because money that arrived is a
       harder fact than money that was quoted; the pipeline only when there is
       no ledger to read, so a business that quotes here and is paid elsewhere
       still gets a ranking rather than an empty page. */
    const ledger = await supabase
      .from("ledger_entries")
      .select("id, adjusts_id, party, party_id, amount_cents, entry_on")
      .eq("project_id", projectId)
      .eq("direction", "in");
    if (ledger.error) return undefined;

    /* 一笔自己是冲正的 in（退款的反向）不算 -- 一个客户不该因为一笔
       退回去的钱排在第一。
       ⚠️ 「已经被冲正」在这里查不到，因为冲正一笔收款写出来的是一笔 out，
       而这个查询只读 in。写下来，不要假装这一行做完了整件事。 */
    let facts: PartyFact[] = (ledger.data ?? [])
      .filter((r) => !(r as { adjusts_id?: string | null }).adjusts_id)
      .map((r) => ({
      party: (r as { party?: string }).party ?? "",
      party_id: (r as { party_id?: string | null }).party_id ?? null,
      amount_cents: (r as { amount_cents?: number | null }).amount_cents ?? null,
      on: (r as { entry_on?: string | null }).entry_on ?? null,
    }));

    if (!facts.length) {
      const pipeline = await supabase
        .from("pipeline_records")
        .select("party, party_id, amount_cents, issued_on")
        .eq("project_id", projectId)
        .is("archived_at", null);
      if (pipeline.error) return undefined;
      facts = (pipeline.data ?? []).map((r) => ({
        party: (r as { party?: string }).party ?? "",
        party_id: (r as { party_id?: string | null }).party_id ?? null,
        amount_cents: (r as { amount_cents?: number | null }).amount_cents ?? null,
        on: (r as { issued_on?: string | null }).issued_on ?? null,
      }));
    }

    return buildRanking({ lang, now, today: todayInMalaysia(at), facts });
  } catch {
    return undefined;
  }
}
