import type { Data } from "@puckeditor/core";

/**
 * Turns a business's own context -- its industry, its questionnaire answers,
 * and the AI's analysis of them -- into the five Puck page layouts the
 * customer opens on their first visit to the editor.
 *
 * WHY THIS FILE EXISTS
 *
 * Until 2026-08-20 the customer journey broke in the middle, in the least
 * recoverable place. A visitor answered a questionnaire, an LLM analysed
 * their business, `/api/analyze` wrote a real `analysis_results` row -- and
 * then the account-provisioning trigger created five `project_pages` rows
 * with `layout_json = '{}'`. The customer signed up, picked a style, and
 * landed on a BLANK CANVAS. Everything the product had just demonstrated it
 * understood about their business was discarded at exactly the moment they
 * became a customer. See docs/formae-product-direction.md sections 2-4.
 *
 * This module is the repair. The analysis stops being a report the visitor
 * reads and walks away from, and becomes the first draft of their system --
 * something already built, already using their own words, that they edit
 * rather than assemble from nothing.
 *
 * WHY IT IS CODE AND NOT AN LLM CALL
 *
 * The layouts are BUILT here, deterministically, from data. The LLM is not
 * asked to emit Puck JSON. That is a deliberate architectural choice and it
 * is how B12 and Durable actually work under the "AI builds your site"
 * marketing: hand-designed templates, AI-driven selection and fill. An LLM
 * emitting layout JSON directly fails in ways this product cannot absorb --
 * a hallucinated component name or a malformed props object is not a
 * degraded layout, it is a blank editor for a paying customer. Here, the
 * worst case is a template with generic labels, which is still a working
 * system. See section 4.1 of the direction doc.
 *
 * The AI's real contribution is the CONTENT poured into the shape: the
 * business's own vocabulary (labels), its own workflow stages, and its own
 * summary line. That is what makes the first screen read as "it understood
 * my business" rather than "here is a demo".
 *
 * WHAT DEGRADES GRACEFULLY
 *
 * Every input is optional. No lead (someone who signed up directly, or the
 * demo account) still gets a complete, sensible system from the generic
 * defaults -- never a blank canvas, which is the whole point.
 */

/** `industries.labels` -- the business's own words for its three core nouns. */
export type IndustryLabels = {
  customer: string;
  order: string;
  staff: string;
};

/** The subset of a row from `public.industries` this module needs. */
export type IndustryContext = {
  slug: string;
  name_zh: string;
  labels: IndustryLabels;
  default_workflow: string[];
  suggested_modules: string[];
};

/** The subset of a row from `public.analysis_results` this module can use. */
export type AnalysisContext = {
  summary?: string | null;
  after_workflow?: string[] | null;
  bottlenecks?: { title: string; description: string }[] | null;
};

/** `projects.business_name` / `projects.owner_name` (migration 20260820180000).
 *  Both optional forever: a customer who never opens settings still gets a
 *  complete system, just one labelled with a placeholder. */
export type BusinessIdentity = {
  business_name?: string | null;
  owner_name?: string | null;
};

export type BusinessContext = {
  industry?: IndustryContext | null;
  analysis?: AnalysisContext | null;
  identity?: BusinessIdentity | null;
};

/**
 * Every page type the product knows how to build. A given business gets a
 * SUBSET of these, chosen by its trade -- see PAGES_FOR_INDUSTRY below and its
 * SQL twin `pages_for_industry()` (migration 20260820160000), which is what the
 * signup trigger actually provisions from.
 *
 * The two lists must agree. `industry-template.test.ts` asserts they do, since
 * a page the trigger creates but this module cannot build renders as an empty
 * canvas -- the exact bug this whole file exists to prevent.
 */
export const PAGE_KEYS = [
  "dashboard",
  "customers",
  "quotations",
  "projects",
  "payments",
  "bookings",
  "orders",
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

/**
 * Any page a customer's system can contain: one of the built-in types above,
 * or a custom page they added themselves (`custom_<hex>`, see migration
 * 20260820200000). Deliberately a plain string rather than a widened union --
 * the whole point of a custom page is that this module has never heard of it.
 */
export type PageId = string;

/** A page as the database holds it. `title` is the customer's own name and is
 *  null for built-in types, which take their label from the trade vocabulary. */
export type PageRef = { key: PageId; title?: string | null };

export function isBuiltInPage(key: PageId): key is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(key);
}

/**
 * Which pages each trade gets. Mirrors `pages_for_industry()` in migration
 * 20260820160000 exactly.
 *
 * WHY THE SUBSET MATTERS: every account used to be provisioned with the same
 * five pages regardless of trade, so a salon owner was handed a 「报价单」page
 * they will never send and a 「项目」page for work they do not do, while
 * 「预约」-- the thing their entire business runs on -- did not exist. Applying
 * a customer's own vocabulary to someone else's structure is the most concrete
 * way to contradict the promise that the product understands their business.
 */
export const PAGES_FOR_INDUSTRY: Record<string, PageKey[]> = {
  beauty: ["dashboard", "customers", "bookings", "payments"],
  education: ["dashboard", "customers", "bookings", "payments"],
  fnb: ["dashboard", "customers", "orders", "payments"],
  retail: ["dashboard", "customers", "orders", "payments"],
  wholesale: ["dashboard", "customers", "quotations", "orders", "payments"],
  renovation: ["dashboard", "customers", "quotations", "projects", "payments"],
  services: ["dashboard", "customers", "quotations", "projects", "payments"],
  other: ["dashboard", "customers", "quotations", "projects", "payments"],
};

/** The set used for a direct signup, or a trade we have no mapping for. */
export const DEFAULT_PAGE_SET: PageKey[] = [
  "dashboard",
  "customers",
  "quotations",
  "projects",
  "payments",
];

/** Canonical display order for a set of page keys. Uses PAGE_KEYS' own order
 *  rather than a database column, so page ordering cannot depend on whether a
 *  migration has landed yet -- and so a page set is ordered identically
 *  wherever it is read. */
export function sortPageKeys(keys: PageKey[]): PageKey[] {
  return [...keys].sort((a, b) => PAGE_KEYS.indexOf(a) - PAGE_KEYS.indexOf(b));
}

/**
 * Orders a mixed set: built-in pages first in their canonical order, then the
 * customer's own pages in the order they added them.
 *
 * Custom pages go last rather than being interleaved because the built-in run
 * is a designed sequence -- overview, then who you serve, then what you sell
 * them, then the money -- and dropping a new page into the middle of it by
 * accident of creation time would break a reading order the customer never
 * chose. Their own additions accumulate after it, which is also where they
 * expect to find the thing they just made.
 */
export function sortPages(pages: PageRef[]): PageRef[] {
  const rank = (p: PageRef) =>
    isBuiltInPage(p.key) ? PAGE_KEYS.indexOf(p.key) : PAGE_KEYS.length;
  return [...pages].sort((a, b) => rank(a) - rank(b));
}

export function pagesForIndustry(slug?: string | null): PageKey[] {
  return (slug && PAGES_FOR_INDUSTRY[slug]) || DEFAULT_PAGE_SET;
}

/** The label for any page: the customer's own title when they set one (custom
 *  pages always have one), otherwise the trade's own noun for a built-in type. */
export function pageLabel(page: PageRef, labels: IndustryLabels): string {
  const own = page.title?.trim();
  if (own) return own;
  return isBuiltInPage(page.key) ? pageNavLabel(page.key, labels) : "新页面";
}

/** The nav label for each page, in the business's own nouns where one applies. */
export function pageNavLabel(key: PageKey, labels: IndustryLabels): string {
  switch (key) {
    case "dashboard":
      return "总览";
    case "customers":
      return labels.customer;
    case "quotations":
      return "报价单";
    case "projects":
      return labels.order;
    case "orders":
      return labels.order;
    case "bookings":
      return "预约";
    case "payments":
      return "收款";
  }
}

/**
 * The name the rail carries before the customer renames it.
 *
 * It used to be the local part of their signup email -- "tianyou.demo" -- set
 * as both the system's name and the account chip, which is the single most
 * telling detail in a screenshot of somebody's own business system. `industries`
 * has no business-name column and the questionnaire never asks for one, so
 * there is nothing real to put here; inventing one ("陈氏装修") would be worse,
 * because a plausible fake name is one a customer might leave in place.
 *
 * A placeholder in their own trade's words is the honest middle: obviously not
 * their company, obviously about their company, and one click from being
 * corrected. The draft banner above the canvas already tells them everything
 * here is theirs to change.
 */
const BRAND_PLACEHOLDER: Record<string, string> = {
  renovation: "我的装修公司",
  retail: "我的店",
  beauty: "我的沙龙",
  wholesale: "我的贸易公司",
  services: "我的公司",
  fnb: "我的餐厅",
  education: "我的补习中心",
  other: "我的公司",
};

const brandFor = (slug: string) => BRAND_PLACEHOLDER[slug] ?? "我的公司";

/** The name the system calls itself. The customer's own answer wins over every
 *  generated guess -- that is the entire point of asking for it. */
export function displayBusinessName(ctx: BusinessContext): string {
  const own = ctx.identity?.business_name?.trim();
  if (own) return own;
  return brandFor(ctx.industry?.slug ?? FALLBACK_INDUSTRY.slug);
}

/** Who is signed in. Falls back to the caller-supplied label (today the email's
 *  local part) only until the customer tells us their name. */
export function displayOwnerName(ctx: BusinessContext, fallback: string): string {
  return ctx.identity?.owner_name?.trim() || fallback;
}

/** Used whenever a business has no lead, or its lead has no industry. */
const FALLBACK_INDUSTRY: IndustryContext = {
  slug: "other",
  name_zh: "生意",
  labels: { customer: "客户", order: "订单", staff: "员工" },
  default_workflow: ["Customer", "Quotation", "Project", "Payment"],
  suggested_modules: ["Customer", "Project", "Payment"],
};

/**
 * `industries.default_workflow` is stored in English (it is the founder's own
 * internal vocabulary, shared with `reference_cases.workflow`). The customer
 * only ever sees Chinese, so stage names are translated here rather than in
 * the database -- keeping the English keys means the seed data, the reference
 * cases and the analysis prompt all still line up on one vocabulary.
 *
 * A stage with no entry falls through to itself rather than being dropped: an
 * untranslated stage name is a small wart, a missing workflow step is a wrong
 * system.
 */
const STAGE_ZH: Record<string, string> = {
  Customer: "客户",
  Quotation: "报价",
  Approval: "确认",
  Deposit: "订金",
  Project: "施工",
  Milestone: "进度",
  "Final Payment": "尾款",
  Order: "订单",
  Payment: "收款",
  Booking: "预约",
  Service: "服务",
  Enrollment: "报名",
};

const translateStage = (stage: string) => STAGE_ZH[stage] ?? stage;

/**
 * The workflow the customer's board columns are built from. The AI's
 * `after_workflow` wins when present -- it is the recommended workflow for
 * THIS business, already in the customer's own language, and putting it on
 * screen is the single most direct way the analysis stops being a discarded
 * report. `default_workflow` is the industry fallback.
 *
 * Capped at six stages: past that the chip row wraps to a third line and
 * stops reading as a pipeline.
 */
function workflowStages(ctx: BusinessContext): string[] {
  const fromAnalysis = ctx.analysis?.after_workflow;
  if (fromAnalysis && fromAnalysis.length > 0) {
    return fromAnalysis.slice(0, 6).map((s) => s.trim()).filter(Boolean);
  }
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  return industry.default_workflow.slice(0, 6).map(translateStage);
}

// ---------------------------------------------------------------------------
// Puck node builders
//
// Puck's `Data` shape is `{ root, content }`, where every entry in `content`
// is `{ type, props }` and every props object needs its own `id` (Puck
// reserves that key internally -- this is why RecordTable's own id prop is
// named `gridId`). Ids are derived from the page key and a running index so
// a regenerated template is byte-identical for the same input, which keeps a
// customer's "unsaved changes" state honest across reloads.
// ---------------------------------------------------------------------------

type PuckNode = { type: string; props: Record<string, unknown> };

const node = (type: string, id: string, props: Record<string, unknown>): PuckNode => ({
  type,
  props: { id, ...props },
});

type StatusTone = "positive" | "warning" | "negative" | "neutral";

/**
 * Sample rows are the part that has to feel like the customer's own business
 * rather than a generic CRM demo. Malaysian-market specifics are deliberate:
 * RM amounts, local naming conventions, and the kind of record each trade
 * actually keeps.
 */
type SampleSet = {
  records: { primary: string; secondary: string; amount: string; tone: StatusTone; status: string }[];
  customers: { primary: string; secondary: string; tone: StatusTone; status: string }[];
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
  heroStats: { label: string; value: string; tone?: "normal" | "caution" | "warn"; sub?: string }[];
  /** Six periods, oldest first. A shape, not a chart -- HeroCard draws it
   *  unlabelled and unaxised. All-zero series draw nothing, which is why no
   *  trade below gets a placeholder run of zeros. */
  heroSpark: number[];
};

const SAMPLES: Record<string, SampleSet> = {
  renovation: {
    records: [
      { primary: "Taman Desa 三房翻新", secondary: "陈先生", amount: "RM 48,500", tone: "positive", status: "已确认" },
      { primary: "Bukit Jalil 厨房改造", secondary: "李太太", amount: "RM 22,800", tone: "warning", status: "等确认" },
      { primary: "Cheras 店面装修", secondary: "王老板", amount: "RM 96,000", tone: "neutral", status: "报价中" },
    ],
    customers: [
      { primary: "陈先生", secondary: "Taman Desa · 013-2xx xxxx", tone: "positive", status: "施工中" },
      { primary: "李太太", secondary: "Bukit Jalil · 012-3xx xxxx", tone: "warning", status: "待跟进" },
      { primary: "王老板", secondary: "Cheras · 016-8xx xxxx", tone: "neutral", status: "新客户" },
    ],
    heroLabel: "本月已确认工程额",
    heroValue: "RM 71,300",
    heroSuffix: "vs 上个月",
    heroStats: [
      { label: "进行中的工程", value: "4 个" },
      { label: "等客户确认", value: "2 份报价", tone: "caution" },
      { label: "已做未收", value: "RM 31,200", tone: "warn", sub: "超过 30 天" },
    ],
    heroSpark: [42000, 51000, 47500, 58000, 63000, 71300],
  },
  retail: {
    records: [
      { primary: "订单 #10238", secondary: "门店自取", amount: "RM 356", tone: "positive", status: "已付款" },
      { primary: "订单 #10239", secondary: "送货 · Puchong", amount: "RM 1,240", tone: "warning", status: "待发货" },
      { primary: "订单 #10240", secondary: "门店自取", amount: "RM 89", tone: "neutral", status: "新订单" },
    ],
    customers: [
      { primary: "Siti binti Ahmad", secondary: "会员 · 累计 RM 3,420", tone: "positive", status: "活跃" },
      { primary: "陈志明", secondary: "会员 · 累计 RM 780", tone: "neutral", status: "一般" },
      { primary: "Kumar A/L Raj", secondary: "新会员", tone: "warning", status: "待跟进" },
    ],
    heroLabel: "本月销售额",
    heroValue: "RM 18,940",
    heroSuffix: "vs 上个月",
    heroStats: [
      { label: "今日订单", value: "23 单" },
      { label: "待发货", value: "5 单", tone: "caution" },
      { label: "库存告急", value: "3 项", tone: "warn", sub: "低于安全存量" },
    ],
    heroSpark: [14200, 15800, 17100, 16400, 18000, 18940],
  },
  beauty: {
    records: [
      { primary: "面部护理 · 90分钟", secondary: "今天 2:00 PM · Amy", amount: "RM 180", tone: "positive", status: "已确认" },
      { primary: "染发 + 护理", secondary: "今天 4:30 PM · Jasmine", amount: "RM 320", tone: "warning", status: "待确认" },
      { primary: "美甲", secondary: "明天 11:00 AM · Amy", amount: "RM 95", tone: "neutral", status: "已预约" },
    ],
    customers: [
      { primary: "林小姐", secondary: "熟客 · 来过 14 次", tone: "positive", status: "会员" },
      { primary: "Nurul", secondary: "来过 3 次", tone: "neutral", status: "一般" },
      { primary: "张太太", secondary: "第一次到访", tone: "warning", status: "新客" },
    ],
    heroLabel: "本月预约收入",
    heroValue: "RM 12,650",
    heroSuffix: "vs 上个月",
    heroStats: [
      { label: "本周预约", value: "31 个" },
      { label: "待确认", value: "4 个", tone: "caution" },
      { label: "三个月没来", value: "18 位", tone: "warn", sub: "可以做回访" },
    ],
    heroSpark: [9800, 10400, 11200, 10900, 12100, 12650],
  },
  wholesale: {
    records: [
      { primary: "PO-2026-0412", secondary: "隆兴贸易", amount: "RM 24,600", tone: "positive", status: "已出货" },
      { primary: "PO-2026-0413", secondary: "美佳超市", amount: "RM 8,150", tone: "warning", status: "待付款" },
      { primary: "PO-2026-0414", secondary: "新丰商行", amount: "RM 41,900", tone: "neutral", status: "备货中" },
    ],
    customers: [
      { primary: "隆兴贸易", secondary: "月结 30 天 · 业务员 Ah Seng", tone: "positive", status: "正常" },
      { primary: "美佳超市", secondary: "月结 60 天 · 业务员 Mei", tone: "negative", status: "超期" },
      { primary: "新丰商行", secondary: "现金交易", tone: "neutral", status: "正常" },
    ],
    heroLabel: "本月出货总额",
    heroValue: "RM 186,400",
    heroSuffix: "vs 上个月",
    heroStats: [
      { label: "本月出货", value: "62 单" },
      { label: "待付款", value: "RM 43,800", tone: "caution", sub: "月结未到期" },
      { label: "已超期", value: "RM 12,400", tone: "warn", sub: "美佳超市 60 天" },
    ],
    heroSpark: [142000, 158000, 151000, 169000, 177000, 186400],
  },
  services: {
    records: [
      { primary: "品牌顾问项目", secondary: "Alpha Sdn Bhd", amount: "RM 32,000", tone: "positive", status: "进行中" },
      { primary: "系统评估", secondary: "Beta Enterprise", amount: "RM 8,500", tone: "warning", status: "等签约" },
      { primary: "年度维护合约", secondary: "Gamma Holdings", amount: "RM 60,000", tone: "neutral", status: "提案中" },
    ],
    customers: [
      { primary: "Alpha Sdn Bhd", secondary: "顾问 · Kevin", tone: "positive", status: "合作中" },
      { primary: "Beta Enterprise", secondary: "顾问 · Kevin", tone: "warning", status: "跟进中" },
      { primary: "Gamma Holdings", secondary: "顾问 · Shirley", tone: "neutral", status: "潜在" },
    ],
    heroLabel: "本月已签约金额",
    heroValue: "RM 40,500",
    heroSuffix: "vs 上个月",
    heroStats: [
      { label: "进行中项目", value: "6 个" },
      { label: "提案等回复", value: "3 份", tone: "caution" },
      { label: "已做未开票", value: "RM 18,000", tone: "warn" },
    ],
    heroSpark: [28000, 31000, 29500, 36000, 38000, 40500],
  },
  fnb: {
    records: [
      { primary: "3号桌", secondary: "堂食 · 4 位", amount: "RM 128", tone: "positive", status: "已结账" },
      { primary: "外卖 #88", secondary: "Grab · Bangsar", amount: "RM 46", tone: "warning", status: "制作中" },
      { primary: "7号桌", secondary: "堂食 · 2 位", amount: "RM 72", tone: "neutral", status: "点单中" },
    ],
    customers: [
      { primary: "常客 · 陈生", secondary: "每周三固定订位", tone: "positive", status: "熟客" },
      { primary: "Grab Food", secondary: "外送平台", tone: "neutral", status: "渠道" },
      { primary: "公司团餐 · Delta", secondary: "每月一次", tone: "warning", status: "待确认" },
    ],
    heroLabel: "今日营业额",
    heroValue: "RM 3,280",
    heroSuffix: "vs 昨天",
    heroStats: [
      { label: "今日单数", value: "96 单" },
      { label: "外送占比", value: "38%", sub: "Grab + Foodpanda" },
      { label: "食材成本", value: "31%", tone: "caution", sub: "目标 28% 以下" },
    ],
    heroSpark: [2650, 2980, 3120, 2740, 3350, 3280],
  },
  education: {
    records: [
      { primary: "中三数学 · 周二班", secondary: "18 位学生 · 陈老师", amount: "RM 220/月", tone: "positive", status: "开课中" },
      { primary: "小六国文 · 周六班", secondary: "12 位学生 · 林老师", amount: "RM 180/月", tone: "warning", status: "招生中" },
      { primary: "SPM 冲刺班", secondary: "8 位学生 · 黄老师", amount: "RM 400/月", tone: "neutral", status: "筹备中" },
    ],
    customers: [
      { primary: "陈家长 (陈小明)", secondary: "中三 · 数学", tone: "positive", status: "已缴费" },
      { primary: "Puan Aminah (Aiman)", secondary: "小六 · 国文", tone: "warning", status: "待缴费" },
      { primary: "李家长 (李美琪)", secondary: "SPM 冲刺", tone: "neutral", status: "新报名" },
    ],
    heroLabel: "本月学费收入",
    heroValue: "RM 24,600",
    heroSuffix: "vs 上个月",
    heroStats: [
      { label: "在读学生", value: "74 位" },
      { label: "本月待缴费", value: "9 位", tone: "caution", sub: "RM 2,180" },
      { label: "这个月没续班", value: "5 位", tone: "warn" },
    ],
    heroSpark: [19800, 21200, 22400, 23100, 23800, 24600],
  },
};

const GENERIC_SAMPLE: SampleSet = {
  records: [
    { primary: "记录 001", secondary: "示例内容", amount: "RM 1,200", tone: "positive", status: "已完成" },
    { primary: "记录 002", secondary: "示例内容", amount: "RM 850", tone: "warning", status: "处理中" },
    { primary: "记录 003", secondary: "示例内容", amount: "RM 3,400", tone: "neutral", status: "待处理" },
  ],
  customers: [
    { primary: "客户 A", secondary: "示例联络方式", tone: "positive", status: "活跃" },
    { primary: "客户 B", secondary: "示例联络方式", tone: "warning", status: "待跟进" },
    { primary: "客户 C", secondary: "示例联络方式", tone: "neutral", status: "新客户" },
  ],
  heroLabel: "本月总额",
  heroValue: "RM 5,450",
  heroSuffix: "vs 上个月",
  heroStats: [
    { label: "进行中", value: "4 项" },
    { label: "等处理", value: "2 项", tone: "caution" },
    { label: "要跟进", value: "1 项", tone: "warn" },
  ],
  heroSpark: [3800, 4200, 4600, 4400, 5100, 5450],
};

const sampleFor = (slug: string) => SAMPLES[slug] ?? GENERIC_SAMPLE;

/**
 * The left rail. Identical across all five pages on purpose: it is the one
 * element that makes the five pages read as ONE system rather than five
 * disconnected canvases, which was a real complaint about the first version
 * of the editor. Labels use the business's own nouns.
 */
function railNav(
  labels: IndustryLabels,
  brandLabel: string,
  businessName: string,
  activePage: PageId,
  locale: string,
  pages: PageRef[],
): PuckNode {
  // RailNav derives its own active state from `usePathname()` and each item's
  // href -- there is no `active` prop. The hrefs therefore have to match the
  // real route shape INCLUDING next-intl's locale prefix (`/zh/portal/...`),
  // or every page renders with nothing highlighted, which makes the nav read
  // as decoration rather than as the customer's own system.
  //
  // The items come from the business's OWN page set, not a fixed five: a salon
  // whose account has no `quotations` page must not be shown a nav link to one.
  return node("RailNav", `${activePage}-rail`, {
    brandLabel: brandLabel,
    brandHref: `/${locale}/portal/dashboard`,
    // `group` is required by RailItem and drives RailNav's collapsible
    // sections. One empty-named group keeps every item in a single uncollapsed
    // list, which is right at this size -- grouping four or five things into
    // named sections is overhead, not organisation.
    // `iconName` is the page key itself: RAIL_ICONS (rail-icons.tsx) is keyed
    // by these exact names, so a rail item and its icon can never drift apart,
    // and a page type added here without an icon degrades to a text-only row
    // rather than crashing.
    // A custom page has no entry in RAIL_ICONS, so `railIcon` returns null and
    // the row renders text-only -- the degradation the icon registry was built
    // to have, now actually exercised.
    items: pages.map((page) => ({
      label: pageLabel(page, labels),
      href: `/${locale}/portal/${page.key}`,
      group: "",
      iconName: page.key,
    })),
    // "#", not the dashboard route. RailNav marks an item as the current page
    // by comparing its href against the live pathname, so pointing these two at
    // /portal/dashboard lit up THREE items at once on the dashboard -- 总览,
    // 通知 and 账号设置 all rendered as "you are here". It also promised a
    // destination that does not exist and would have dumped the customer back
    // where they started.
    //
    // These belong in the rail regardless: the customer is looking at a preview
    // of the system they are designing, and a real one has notifications and
    // account settings. Same "#" every other sample link in this file uses.
    notificationsHref: "#",
    accountHref: "#",
    // The account chip identifies the PERSON, so the email local part belongs
    // here and only here -- it is the one place in the system where "who am I
    // signed in as" is the question being answered.
    userName: businessName,
    userRoleLabel: "老板",
  });
}

function recordTable(
  id: string,
  caption: string,
  labels: { primary: string; secondary?: string; amount?: string; status?: string },
  rows: { primary: string; secondary?: string; amount?: string; tone: StatusTone; status: string }[],
): PuckNode {
  return node("RecordTable", id, {
    gridId: id,
    caption,
    primaryLabel: labels.primary,
    secondaryLabel: labels.secondary,
    amountLabel: labels.amount,
    statusColumnLabel: labels.status ?? "状态",
    rows: rows.map((r) => ({
      primary: r.primary,
      secondary: r.secondary,
      amount: r.amount,
      statusTone: r.tone,
      statusLabel: r.status,
    })),
  });
}

function filterChips(id: string, kind: string, values: string[]): PuckNode {
  // FilterChip is {label, value, removeHref}: it shows what is CURRENTLY
  // narrowing a list, each chip removable. That is a different thing from a
  // pipeline -- workflow stages go to WorkflowStrip below, not here, because
  // six stages rendered as six removable chips read as six applied filters.
  return node("FilterChips", id, {
    chips: values.map((value) => ({ label: kind, value, removeHref: "#" })),
    clearAllHref: "#",
  });
}

function workflowStrip(id: string, title: string, stages: string[], attentionAt = 0): PuckNode {
  return node("WorkflowStrip", id, {
    title,
    stages: stages.map((label, i) => ({
      label,
      // The stage the AI flagged as the bottleneck is marked, so the analysis
      // shows up as a highlighted step in the customer's own pipeline rather
      // than as prose they have to re-read.
      tone: i === attentionAt ? "attention" : "normal",
    })),
  });
}

// ---------------------------------------------------------------------------
// The five page templates
// ---------------------------------------------------------------------------

function buildDashboard(ctx: BusinessContext, name: string, locale: string, pages: PageRef[]): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const brand = displayBusinessName(ctx);
  const { labels } = industry;
  const sample = sampleFor(industry.slug);

  // The AI's own one-line summary of this business, on the first screen the
  // customer sees after signing up. This single line is the clearest possible
  // signal that the questionnaire was not a form that went nowhere.
  const subtitle =
    ctx.analysis?.summary?.trim() ||
    `${industry.name_zh}的日常运作总览 — 这是根据你的行业自动生成的起点，全部内容都可以改。`;

  return [
    railNav(labels, brand, name, "dashboard", locale, pages),
    node("PageHeader", "dashboard-header", { title: "业务总览", subtitle }),
    node("HeroCard", "dashboard-hero", {
      label: sample.heroLabel,
      value: sample.heroValue,
      href: `/${locale}/portal/payments`,
      chgSuffix: sample.heroSuffix,
      // Every supporting stat links back into the system rather than nowhere:
      // the number a business owner reacts to ("RM 31,200 已做未收") should be
      // the thing that takes them to the page where they act on it.
      stats: sample.heroStats.map((st) => ({ ...st, href: `/${locale}/portal/payments` })),
      spark: sample.heroSpark.map((n) => ({ n })),
      sparkLabel: "最近六期",
    }),
    workflowStrip("dashboard-workflow", "你的业务流程", workflowStages(ctx)),
    recordTable(
      "dashboard-recent",
      `最近的${labels.order}`,
      { primary: labels.order, secondary: labels.customer, amount: "金额", status: "状态" },
      sample.records,
    ),
  ];
}

function buildCustomers(ctx: BusinessContext, name: string, locale: string, pages: PageRef[]): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const brand = displayBusinessName(ctx);
  const { labels } = industry;
  const sample = sampleFor(industry.slug);

  return [
    railNav(labels, brand, name, "customers", locale, pages),
    node("PageHeader", "customers-header", {
      title: `${labels.customer}名单`,
      subtitle: `所有${labels.customer}的联络方式和往来记录。`,
    }),
    node("TextAutocomplete", "customers-search", {
      name: "customer-search",
      placeholder: `搜索${labels.customer}姓名或电话`,
      suggestions: sample.customers.map((c) => ({ value: c.primary })),
    }),
    recordTable(
      "customers-list",
      `${labels.customer}列表`,
      { primary: labels.customer, secondary: "联络方式 / 备注", status: "状态" },
      sample.customers,
    ),
  ];
}

function buildQuotations(ctx: BusinessContext, name: string, locale: string, pages: PageRef[]): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const brand = displayBusinessName(ctx);
  const { labels } = industry;
  const sample = sampleFor(industry.slug);

  return [
    railNav(labels, brand, name, "quotations", locale, pages),
    node("PageHeader", "quotations-header", {
      title: "报价单",
      subtitle: `发给${labels.customer}的报价，跟进哪些已确认、哪些还没回复。`,
    }),
    filterChips("quotations-filters", "状态", ["等确认"]),
    node("DatePicker", "quotations-date", {
      name: "quotation-date",
      placeholder: "报价日期",
      allowClear: true,
    }),
    recordTable(
      "quotations-list",
      "报价单列表",
      { primary: "报价内容", secondary: labels.customer, amount: "报价金额", status: "状态" },
      sample.records,
    ),
  ];
}

function buildProjects(ctx: BusinessContext, name: string, locale: string, pages: PageRef[]): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const brand = displayBusinessName(ctx);
  const { labels } = industry;
  const sample = sampleFor(industry.slug);

  return [
    railNav(labels, brand, name, "projects", locale, pages),
    node("PageHeader", "projects-header", {
      title: `${labels.order}进度`,
      // The bottleneck the AI actually identified, named on the page whose job
      // is to fix it -- so the analysis shows up as working software rather
      // than as a paragraph the visitor read once and closed.
      subtitle: ctx.analysis?.bottlenecks?.[0]?.title
        ? `重点跟进：${ctx.analysis.bottlenecks[0].title}`
        : `每一个${labels.order}走到哪一步，一眼看完。`,
    }),
    workflowStrip("projects-workflow", `${labels.order}流程`, workflowStages(ctx), 1),
    node("Listbox", "projects-staff", {
      name: "assigned-staff",
      placeholder: `负责${labels.staff}`,
      options: [
        { label: `全部${labels.staff}`, value: "all" },
        { label: `${labels.staff} A`, value: "a" },
        { label: `${labels.staff} B`, value: "b" },
      ],
    }),
    recordTable(
      "projects-list",
      `${labels.order}列表`,
      { primary: labels.order, secondary: labels.customer, amount: "金额", status: "进度" },
      sample.records,
    ),
  ];
}

function buildPayments(ctx: BusinessContext, name: string, locale: string, pages: PageRef[]): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const brand = displayBusinessName(ctx);
  const { labels } = industry;
  const sample = sampleFor(industry.slug);

  return [
    railNav(labels, brand, name, "payments", locale, pages),
    node("PageHeader", "payments-header", {
      title: "收款记录",
      subtitle: `哪些${labels.customer}已经付了、哪些还欠着，不用再翻 WhatsApp。`,
    }),
    node("MonthPicker", "payments-month", {
      name: "payment-month",
      placeholder: "选择月份",
      allowClear: true,
    }),
    node("HeroCard", "payments-hero", {
      label: sample.heroLabel,
      value: sample.heroValue,
      href: `/${locale}/portal/payments`,
      chgSuffix: sample.heroSuffix,
      // Every supporting stat links back into the system rather than nowhere:
      // the number a business owner reacts to ("RM 31,200 已做未收") should be
      // the thing that takes them to the page where they act on it.
      stats: sample.heroStats.map((st) => ({ ...st, href: `/${locale}/portal/payments` })),
      spark: sample.heroSpark.map((n) => ({ n })),
      sparkLabel: "最近六期",
    }),
    recordTable(
      "payments-list",
      "收款明细",
      { primary: "收款项目", secondary: labels.customer, amount: "金额", status: "状态" },
      sample.records,
    ),
    // Receipt upload is the single most-requested thing from Malaysian SMEs
    // that currently run payment tracking through WhatsApp screenshots.
    node("FileUploadField", "payments-receipt", {
      label: "付款凭证",
      hint: "上传银行转账截图或收据（JPG / PNG / PDF）",
      name: "receipt",
      accept: "image/*,application/pdf",
    }),
  ];
}

/**
 * The appointment book. Beauty and education businesses run their whole day off
 * this page, and neither of them has a quotation to send -- which is why they
 * get this page instead of `quotations`, not as well as it.
 */
function buildBookings(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const brand = displayBusinessName(ctx);
  const { labels } = industry;
  const sample = sampleFor(industry.slug);

  return [
    railNav(labels, brand, name, "bookings", locale, pages),
    node("PageHeader", "bookings-header", {
      title: "预约",
      subtitle: `今天谁要来、哪个${labels.staff}接、做什么，一页看完。`,
    }),
    node("DatePicker", "bookings-date", {
      name: "booking-date",
      placeholder: "选择日期",
      allowClear: true,
    }),
    node("Listbox", "bookings-staff", {
      name: "booking-staff",
      placeholder: `选择${labels.staff}`,
      options: [
        { label: `全部${labels.staff}`, value: "all" },
        { label: `${labels.staff} A`, value: "a" },
        { label: `${labels.staff} B`, value: "b" },
      ],
    }),
    recordTable(
      "bookings-list",
      "今日预约",
      { primary: "服务项目", secondary: `时间 / ${labels.staff}`, amount: "价钱", status: "状态" },
      sample.records,
    ),
  ];
}

/**
 * The order list. Retail, F&B and wholesale all run on many small transactions
 * rather than quoted jobs, so this replaces `projects` for them (and sits
 * alongside `quotations` for wholesale, which quotes first and then fulfils).
 */
function buildOrders(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const brand = displayBusinessName(ctx);
  const { labels } = industry;
  const sample = sampleFor(industry.slug);

  return [
    railNav(labels, brand, name, "orders", locale, pages),
    node("PageHeader", "orders-header", {
      title: `${labels.order}列表`,
      subtitle: ctx.analysis?.bottlenecks?.[0]?.title
        ? `重点跟进：${ctx.analysis.bottlenecks[0].title}`
        : `每一张${labels.order}处理到哪一步，不用问人。`,
    }),
    workflowStrip("orders-workflow", `${labels.order}流程`, workflowStages(ctx), 1),
    filterChips("orders-filters", "状态", ["处理中"]),
    recordTable(
      "orders-list",
      `${labels.order}明细`,
      { primary: labels.order, secondary: labels.customer, amount: "金额", status: "状态" },
      sample.records,
    ),
  ];
}

const BUILDERS: Record<
  PageKey,
  (ctx: BusinessContext, name: string, locale: string, pages: PageRef[]) => PuckNode[]
> = {
  dashboard: buildDashboard,
  customers: buildCustomers,
  quotations: buildQuotations,
  projects: buildProjects,
  payments: buildPayments,
  bookings: buildBookings,
  orders: buildOrders,
};

/**
 * The one entry point. Returns a complete Puck `Data` for one page of one
 * business's system.
 *
 * `businessName` is only ever cosmetic (the rail's brand label and the account
 * chip), so an account with nothing better to use falls back to a neutral word
 * rather than showing a raw email address in the customer's own product.
 */
/**
 * A page the customer invented.
 *
 * It gets a real starting point rather than an empty canvas, for exactly the
 * reason this whole file exists: a blank page handed to a business owner who
 * was promised a system is the failure this module was written to repair, and
 * it does not stop being that failure because THEY asked for the page.
 *
 * What it cannot do is guess the business meaning of "员工排班" -- so it lays
 * out the shape every operational page in this product shares (a heading, a
 * record table with four generic columns, three sample rows) using their own
 * title, and leaves the naming to them or to the assistant. That is a page
 * they edit, which is the whole workflow.
 */
function buildCustomPage(
  title: string,
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
  pageId: PageId,
): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const { labels } = industry;
  const brand = displayBusinessName(ctx);

  return [
    railNav(labels, brand, name, pageId, locale, pages),
    node("PageHeader", `${pageId}-header`, {
      title,
      subtitle: `这一页是你自己加的。下面的名称和栏位全部可以改成你要的。`,
    }),
    recordTable(
      `${pageId}-table`,
      title,
      { primary: "项目", secondary: "说明", amount: "金额", status: "状态" },
      [
        { primary: "记录 001", secondary: "示例内容", amount: "RM 0", tone: "positive", status: "已完成" },
        { primary: "记录 002", secondary: "示例内容", amount: "RM 0", tone: "warning", status: "处理中" },
        { primary: "记录 003", secondary: "示例内容", amount: "RM 0", tone: "neutral", status: "待处理" },
      ],
    ),
  ];
}

export function buildPageLayout(
  pageKey: PageId,
  ctx: BusinessContext,
  businessName = "我的生意",
  locale = "zh",
  /** The business's actual page set, so the rail links only to pages it has.
   *  Defaults to the trade's standard set when the caller does not know it. */
  pages?: PageRef[],
): Data {
  const refs: PageRef[] =
    pages ?? pagesForIndustry(ctx.industry?.slug).map((key) => ({ key }));
  const labels = (ctx.industry ?? FALLBACK_INDUSTRY).labels;
  const self = refs.find((p) => p.key === pageKey);

  const [rail, ...rest] = isBuiltInPage(pageKey)
    ? BUILDERS[pageKey](ctx, businessName, locale, refs)
    : buildCustomPage(
        pageLabel(self ?? { key: pageKey }, labels),
        ctx,
        businessName,
        locale,
        refs,
        pageKey,
      );

  // The page is ONE SystemShell holding two slots, not a flat stack. Puck's
  // canvas stacks its `content` vertically, so a flat list put the full-height
  // RailNav above everything else and pushed the actual page a screen below
  // the fold -- confirmed in a real browser, not reasoned about (see
  // system-shell.tsx for the measurements). Both slots stay editable: a
  // customer can still drag blocks into either column.
  return {
    root: {},
    content: [
      node("SystemShell", `${pageKey}-shell`, {
        sidebar: [rail],
        main: rest,
      }),
    ],
  } as unknown as Data;
}

/**
 * True when a `project_pages.layout_json` has never been written to -- the
 * signup trigger creates all five rows as `'{}'`, and a customer who has saved
 * a page has a `content` array (possibly empty, if they deleted everything --
 * which is why this checks for the KEY, not for a non-empty array. Treating a
 * deliberately-emptied page as "never generated" would resurrect the template
 * every time they reloaded, silently undoing their deletion).
 */
export function isUngeneratedLayout(layout: unknown): boolean {
  if (!layout || typeof layout !== "object") return true;
  return !("content" in (layout as Record<string, unknown>));
}
