/**
 * The shapes every copy table in this directory fills in.
 *
 * Lifted out of industry-template.ts when the system gained a second language:
 * one type, two tables (`*.zh.ts` and `*.en.ts`), so a phrase that exists in
 * one language and not the other is a compile error rather than a page that
 * renders half in English.
 */

/** `industries.labels` -- the business's own words for its three core nouns.
 *  Chinese comes from the database row; English comes from INDUSTRY_LABELS_EN
 *  in chrome.ts. */
export type IndustryLabels = {
  customer: string;
  order: string;
  staff: string;
};

export type StatusTone = "positive" | "warning" | "negative" | "neutral";

/**
 * Sample rows are the part that has to feel like the customer's own business
 * rather than a generic CRM demo. Malaysian-market specifics are deliberate:
 * RM amounts, local naming conventions, and the kind of record each trade
 * actually keeps.
 */
export type SampleSet = {
  records: {
    primary: string;
    secondary: string;
    amount: string;
    tone: StatusTone;
    status: string;
    /* 谁做的 —— 只有预约那一种页面用得上（一天摊开、一个人一栏）。
       ⚠️ 选填，而且一行都没有给的时候那一页自己退回原来那几种画法：
       一间一个人的店、一张补习课表，本来就没有这件事。 */
    who?: string;
  }[];
  customers: {
    primary: string;
    secondary: string;
    tone: StatusTone;
    status: string;
  }[];
  /**
   * What this trade keeps on a shelf.
   *
   * Separate from `records` because the two answer different questions: a
   * salon's records are appointments, its stock is colour tubes. Until this
   * existed the Stock page fell through to `moduleCopy`'s generic rows, so a
   * salon owner shown their own system read 「Item A · Store 1 · carton」 on the
   * one page whose whole subject is the thing they buy every month -- while the
   * page next to it correctly said 「Colour + treatment」.
   *
   * Units are the point, not decoration: a wholesaler buys by the carton and
   * sells by the piece, and a stock page that cannot say which is a stock page
   * that is wrong for them.
   */
  stock: {
    primary: string;
    secondary: string;
    amount: string;
    tone: StatusTone;
    status: string;
  }[];
  heroLabel: string;
  heroValue: string;
  /** What the headline figure is measured against -- "vs 上个月", "vs 昨天". */
  heroSuffix: string;
  /** The three supporting figures under the headline. Three, not four, and
   *  not equal-sized peers: see the HeroCard registration in puck-config.tsx
   *  for why this product does not copy B12's row-of-tiles dashboard. Each is
   *  chosen to be the number the trade ACTUALLY worries about -- for a
   *  contractor that is money already spent and not yet billed, not a vanity
   *  count of projects. */
  heroStats: {
    label: string;
    value: string;
    tone?: "normal" | "caution" | "warn";
    sub?: string;
  }[];
  /** Six periods, oldest first. A shape, not a chart -- HeroCard draws it
   *  unlabelled and unaxised. All-zero series draw nothing, which is why no
   *  trade below gets a placeholder run of zeros. */
  heroSpark: number[];
};

export type ModuleCopy = {
  title: string;
  subtitle: string;
  /** Column headings, in this module's own nouns. */
  columns: {
    primary: string;
    secondary?: string;
    amount?: string;
    status?: string;
    /** 「怎么算」，不是「算出来多少」——今天只有 staff 那一种用它。
     *  见 industry-template.ts 的 KindCols 跟旁边那一段注解。 */
    commission?: string;
  };
  /** Three rows. Sample data is what makes a first screen legible -- an empty
   *  table teaches a customer nothing about what the page is for. */
  rows: {
    primary: string;
    secondary?: string;
    amount?: string;
    tone: StatusTone;
    status: string;
    commission?: string;
  }[];
  /** Ledger / report / reconcile shapes only. */
  hero?: {
    label: string;
    value: string;
    suffix: string;
    stats: {
      label: string;
      value: string;
      tone?: "normal" | "caution" | "warn";
      sub?: string;
    }[];
  };
  /** Report / leaderboard shapes only. Six periods, oldest first. */
  trend?: {
    title: string;
    caption: string;
    /** 「图 + 结论」那一栏里，大数字底下那一句。**跟 `caption` 是两句话** ——
     *  卡头讲这张图是什么，这一句讲那个总数是什么。见 trend-chart.tsx。 */
    summary?: string;
    unit: string;
    points: { label: string; value: number }[];
  };
  /** Directory / catalog shapes: what the search box says. */
  searchPlaceholder?: string;
  /* `filter` 拿掉了（2026-09-05）。它讲的是「这张清单已经被这样筛过了」，
     而没有任何东西真的筛过 —— 见 industry-template.ts 里 `filterChips` 那一段。
     那件事现在由表格自己那一排分段做，而那一排是从行里算的，不写在 copy 里。 */
  /** Ledger shape: what the upload field is for. Omitted where a module has no
   *  paperwork -- 佣金 is calculated, not evidenced. */
  upload?: { label: string; hint: string };
  /** Reconcile shape: the line that states the variance. */
  variance?: { title: string; description: string };
};
