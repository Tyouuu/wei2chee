import type { Data } from "@puckeditor/core";
import type { TableColumn } from "@/lib/portal/table-model";
import {
  MODULE_BY_KEY,
  MODULE_KEYS,
  defaultModulesForIndustry,
  type ModuleShape,
} from "@/lib/portal/module-catalog";

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
/**
 * Re-exported from the catalogue rather than re-listed here. Two hand-kept
 * lists of the same sixteen strings is two lists that drift, and the drift is
 * silent: a key the trigger writes and this module cannot build renders as a
 * blank canvas for a paying customer. One list, imported.
 */
export const PAGE_KEYS = MODULE_KEYS;
export type PageKey = string;

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
  beauty: defaultModulesForIndustry("beauty"),
  education: defaultModulesForIndustry("education"),
  fnb: defaultModulesForIndustry("fnb"),
  retail: defaultModulesForIndustry("retail"),
  wholesale: defaultModulesForIndustry("wholesale"),
  renovation: defaultModulesForIndustry("renovation"),
  services: defaultModulesForIndustry("services"),
  other: defaultModulesForIndustry("other"),
};

/** The set used for a direct signup, or a trade we have no mapping for. */
export const DEFAULT_PAGE_SET: PageKey[] = defaultModulesForIndustry(null);

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

/**
 * The nav label for each page, in the business's own nouns where one applies.
 *
 * The three trade-vocabulary types answer from `labels` -- a salon's 客户 page
 * is headed 顾客, a tuition centre's 家长. Everything else takes the
 * catalogue's own default, which is the single place those words are written.
 */
export function pageNavLabel(key: PageKey, labels: IndustryLabels): string {
  switch (key) {
    case "customers":
      return labels.customer;
    case "projects":
    case "orders":
      return labels.order;
    case "staff":
      return labels.staff;
    default:
      return MODULE_BY_KEY[key]?.label ?? "新页面";
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
    // These two used to be `notificationsHref: "#"` / `accountHref: "#"` --
    // real links that went nowhere, and that the customer could neither rename
    // nor remove. They belong in the rail (the customer is looking at a preview
    // of the system they are designing, and a real one has notifications and
    // account settings), but as a LIST they own: a wholesaler who wants a 客服
    // row adds one, a one-person business who does not want notifications
    // deletes it. With no href, RailNav renders them as non-navigating rows
    // instead of dead links.
    utilityItems: [
      { label: "通知", iconName: "notifications" },
      { label: "账号设置", iconName: "account" },
    ],
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
  // Columns are an array, not four props -- see lib/portal/table-model.ts. The
  // built-in keys are deliberately the old prop names, so a generated table and
  // an upgraded saved one are the same object and nothing downstream has to
  // know which it is looking at.
  const columns: TableColumn[] = [{ key: "primary", label: labels.primary, kind: "text" }];
  if (labels.secondary) columns.push({ key: "secondary", label: labels.secondary, kind: "detail" });
  if (labels.amount) columns.push({ key: "amount", label: labels.amount, kind: "amount" });
  columns.push({ key: "status", label: labels.status ?? "状态", kind: "status" });

  return node("RecordTable", id, {
    gridId: id,
    caption,
    table: {
      columns,
      rows: rows.map((r) => ({
        cells: {
          primary: r.primary,
          secondary: r.secondary ?? "",
          amount: r.amount ?? "",
          status: r.status,
        },
        tones: { status: r.tone },
      })),
    },
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
  const labels = labelsFromPages(industry.labels, pages);
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
  const labels = labelsFromPages(industry.labels, pages);
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
  const labels = labelsFromPages(industry.labels, pages);
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
  const labels = labelsFromPages(industry.labels, pages);
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
  const labels = labelsFromPages(industry.labels, pages);
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
  const labels = labelsFromPages(industry.labels, pages);
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
  const labels = labelsFromPages(industry.labels, pages);
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

// ---------------------------------------------------------------------------
// The shape builders
// ---------------------------------------------------------------------------
//
// The seven templates above were written one per page type, back when there
// were seven page types. The catalogue is sixteen now
// (lib/portal/module-catalog.ts), and 对账 and 佣金 are different modules to a
// business owner and the same layout to a renderer: a month picker, a headline
// figure, a table. Nine more hand-written builders would be nine more places
// for the same bug.
//
// So the new archetypes are carried by SHAPE, and what differs between two
// modules sharing a shape is their vocabulary -- which is also the honest
// description of what actually makes them different. The seven originals are
// left exactly as they were: they are the pages every customer sees first, they
// have per-trade sample data the generic path cannot reproduce, and rewriting
// working templates to prove a point is how a refactor breaks a product.

/** The words one module is written in. Everything a shape needs to stop
 *  reading as a generic table with a different heading on it. */
type ModuleCopy = {
  title: string;
  subtitle: string;
  /** Column headings, in this module's own nouns. */
  columns: { primary: string; secondary?: string; amount?: string; status?: string };
  /** Three rows. Sample data is what makes a first screen legible -- an empty
   *  table teaches a customer nothing about what the page is for. */
  rows: { primary: string; secondary?: string; amount?: string; tone: StatusTone; status: string }[];
  /** Ledger / report / reconcile shapes only. */
  hero?: {
    label: string;
    value: string;
    suffix: string;
    stats: { label: string; value: string; tone?: "normal" | "caution" | "warn"; sub?: string }[];
  };
  /** Report / leaderboard shapes only. Six periods, oldest first. */
  trend?: { title: string; caption: string; unit: string; points: { label: string; value: number }[] };
  /** Directory / catalog shapes: what the search box says. */
  searchPlaceholder?: string;
  /** Catalog / leaderboard / pipeline shapes: the filter already applied. */
  filter?: { kind: string; value: string };
  /** Ledger shape: what the upload field is for. Omitted where a module has no
   *  paperwork -- 佣金 is calculated, not evidenced. */
  upload?: { label: string; hint: string };
  /** Reconcile shape: the line that states the variance. */
  variance?: { title: string; description: string };
};

/**
 * The vocabulary for each archetype the shape builders serve.
 *
 * Written in the trade's own words -- 尾款, 师傅, 上游, 账期 -- because the whole
 * claim this product makes is that the system arrives already speaking the
 * customer's language. A table headed "Item / Value / Status" is a demo; one
 * headed 「上游对账单 / 系统总额 / 差异」 is their month-end.
 *
 * `labels` carries the trade's three nouns, so a module reads correctly whether
 * the business calls its counterparties 客户, 顾客 or 经销商.
 */
function moduleCopy(key: PageId, labels: IndustryLabels): ModuleCopy {
  switch (key) {
    case "reconciliation":
      return {
        title: "月度对账",
        subtitle: "上游给的总数，对系统里逐笔加起来的总数。差多少，差在哪一笔。",
        columns: { primary: "对账项目", secondary: "参考号", amount: "金额", status: "结果" },
        rows: [
          { primary: "系统逐笔总额", secondary: "本月 128 笔", amount: "RM 246,800", tone: "positive", status: "已核对" },
          { primary: "上游对账单总额", secondary: "对方出的数字", amount: "RM 246,800", tone: "positive", status: "对得上" },
          { primary: "待查差异", secondary: "REF-2026-0817", amount: "RM 0", tone: "neutral", status: "无差异" },
        ],
        hero: {
          label: "本月差异",
          value: "RM 0",
          suffix: "系统 vs 上游",
          stats: [
            { label: "系统总额", value: "RM 246,800", sub: "128 笔" },
            { label: "上游总额", value: "RM 246,800", sub: "对方出" },
            { label: "待查", value: "0 笔" },
          ],
        },
        variance: {
          title: "这个月对得上",
          description: "系统总额和上游对账单一致。有差异的时候，这里会列出要查的那几笔参考号。",
        },
      };

    case "commission":
      return {
        title: "佣金结算",
        subtitle: "这个月该拿多少，系统按每一笔自动算出来，不用再开 Excel。",
        columns: { primary: "结算对象", secondary: "计算方式", amount: "佣金", status: "状态" },
        rows: [
          { primary: `${labels.customer} A`, secondary: "成交额 × 2%", amount: "RM 1,240", tone: "positive", status: "已结" },
          { primary: `${labels.customer} B`, secondary: "成交额 × 2%", amount: "RM 860", tone: "warning", status: "待结" },
          { primary: `${labels.customer} C`, secondary: "成交额 × 2%", amount: "RM 415", tone: "neutral", status: "计算中" },
        ],
        hero: {
          label: "本月佣金",
          value: "RM 2,515",
          suffix: "比上个月",
          stats: [
            { label: "已结", value: "RM 1,240" },
            { label: "待结", value: "RM 860", tone: "caution" },
            { label: "计算中", value: "RM 415" },
          ],
        },
      };

    case "expenses":
      return {
        title: "开销记录",
        subtitle: "钱花去哪里了，每一笔附单据。跟收款对起来才知道真正赚多少。",
        columns: { primary: "开销项目", secondary: "付给谁", amount: "金额", status: "状态" },
        rows: [
          { primary: "材料采购", secondary: "建材行", amount: "RM 8,400", tone: "positive", status: "已付" },
          { primary: `${labels.staff}工资`, secondary: "本月", amount: "RM 12,000", tone: "positive", status: "已付" },
          { primary: "车油 / 过路费", secondary: "待报销", amount: "RM 640", tone: "warning", status: "待付" },
        ],
        hero: {
          label: "本月开销",
          value: "RM 21,040",
          suffix: "比上个月",
          stats: [
            { label: "已付", value: "RM 20,400" },
            { label: "待付", value: "RM 640", tone: "caution" },
            { label: "没单据", value: "1 笔", tone: "warn" },
          ],
        },
        upload: { label: "单据 / 发票", hint: "拍张照片或上传 PDF，这笔开销就有凭证了" },
      };

    case "reports":
      return {
        title: "月度报表",
        subtitle: "按月看趋势。要给会计、给银行、给自己看，都从这里导出。",
        columns: { primary: "月份", secondary: "笔数", amount: "营业额", status: "对比上月" },
        rows: [
          { primary: "2026 年 8 月", secondary: "128 笔", amount: "RM 71,300", tone: "positive", status: "增长" },
          { primary: "2026 年 7 月", secondary: "104 笔", amount: "RM 58,000", tone: "warning", status: "下滑" },
          { primary: "2026 年 6 月", secondary: "117 笔", amount: "RM 63,000", tone: "positive", status: "增长" },
        ],
        hero: {
          label: "本月营业额",
          value: "RM 71,300",
          suffix: "比上个月",
          stats: [
            { label: "笔数", value: "128 笔" },
            { label: "平均单价", value: "RM 557" },
            { label: "增长", value: "23%" },
          ],
        },
        trend: {
          title: "近六个月营业额",
          caption: "每一根是一个月的总额。",
          unit: "RM",
          points: [
            { label: "3月", value: 42000 },
            { label: "4月", value: 51000 },
            { label: "5月", value: 47000 },
            { label: "6月", value: 63000 },
            { label: "7月", value: 58000 },
            { label: "8月", value: 71300 },
          ],
        },
      };

    case "ranking":
      return {
        title: "活跃度排名",
        subtitle: "谁最努力、谁在退步。按金额、频率、最近有没有动，自动排等级。",
        columns: { primary: labels.customer, secondary: "最近一次", amount: "近 90 天", status: "等级" },
        rows: [
          { primary: `${labels.customer} A`, secondary: "2 天前", amount: "RM 48,500", tone: "positive", status: "顶级" },
          { primary: `${labels.customer} B`, secondary: "9 天前", amount: "RM 22,800", tone: "positive", status: "活跃" },
          { primary: `${labels.customer} C`, secondary: "41 天前", amount: "RM 3,200", tone: "warning", status: "退步中" },
        ],
        filter: { kind: "时间窗口", value: "近 90 天" },
        trend: {
          title: "活跃人数变化",
          caption: "顶级和活跃加起来的人数，按月看。",
          unit: "",
          points: [
            { label: "3月", value: 12 },
            { label: "4月", value: 14 },
            { label: "5月", value: 13 },
            { label: "6月", value: 17 },
            { label: "7月", value: 19 },
            { label: "8月", value: 23 },
          ],
        },
      };

    case "suppliers":
      return {
        title: "供应商",
        subtitle: "向谁进货、账期多久、这家还欠着多少。",
        columns: { primary: "供应商", secondary: "联络方式 / 账期", amount: "未付", status: "状态" },
        rows: [
          { primary: "建材行 A", secondary: "016-2xx xxxx · 30 天", amount: "RM 8,400", tone: "warning", status: "有欠款" },
          { primary: "五金店 B", secondary: "012-3xx xxxx · 现金", amount: "RM 0", tone: "positive", status: "已结清" },
          { primary: "云石厂 C", secondary: "018-8xx xxxx · 60 天", amount: "RM 15,200", tone: "neutral", status: "未到期" },
        ],
        searchPlaceholder: "搜索供应商",
      };

    case "staff":
      return {
        title: labels.staff,
        subtitle: "谁在做什么、这个月做了多少、工资怎么算。",
        columns: { primary: labels.staff, secondary: "负责", amount: "本月业绩", status: "状态" },
        rows: [
          { primary: `${labels.staff} A`, secondary: "3 单在做", amount: "RM 48,500", tone: "positive", status: "在职" },
          { primary: `${labels.staff} B`, secondary: "1 单在做", amount: "RM 22,800", tone: "positive", status: "在职" },
          { primary: `${labels.staff} C`, secondary: "休假中", amount: "RM 0", tone: "neutral", status: "请假" },
        ],
        searchPlaceholder: `搜索${labels.staff}`,
      };

    case "inventory":
      return {
        title: "库存",
        subtitle: "还有多少货、什么快没了、什么压太久没动。",
        columns: { primary: "货品", secondary: "位置 / 单位", amount: "数量", status: "状态" },
        rows: [
          { primary: "货品 A", secondary: "仓库一 · 箱", amount: "128", tone: "positive", status: "充足" },
          { primary: "货品 B", secondary: "仓库一 · 件", amount: "9", tone: "warning", status: "快没了" },
          { primary: "货品 C", secondary: "仓库二 · 箱", amount: "340", tone: "neutral", status: "压太久" },
        ],
        searchPlaceholder: "搜索货品名称或编号",
        filter: { kind: "状态", value: "快没了" },
      };

    case "tasks":
      return {
        title: "任务",
        subtitle: "谁负责什么、什么时候要交、做完没有。",
        columns: { primary: "任务", secondary: `负责${labels.staff}`, amount: "限期", status: "状态" },
        rows: [
          { primary: "上门量尺寸", secondary: `${labels.staff} A`, amount: "8月22", tone: "warning", status: "今天" },
          { primary: "出报价单", secondary: `${labels.staff} B`, amount: "8月24", tone: "neutral", status: "待办" },
          { primary: "订材料", secondary: `${labels.staff} A`, amount: "8月19", tone: "positive", status: "已完成" },
        ],
        filter: { kind: "状态", value: "待办" },
      };

    default:
      // Unreachable for catalogue keys -- every one of them is cased above and
      // industry-template.test.ts asserts it. Kept as a working page rather than
      // a throw: a customer's own system is the wrong place to discover a
      // missing switch arm.
      return {
        title: "新模块",
        subtitle: "下面的名称和栏位全部可以改成你要的。",
        columns: { primary: "项目", secondary: "说明", amount: "金额", status: "状态" },
        rows: [
          { primary: "记录 001", secondary: "示例内容", amount: "RM 0", tone: "positive", status: "已完成" },
          { primary: "记录 002", secondary: "示例内容", amount: "RM 0", tone: "warning", status: "处理中" },
          { primary: "记录 003", secondary: "示例内容", amount: "RM 0", tone: "neutral", status: "待处理" },
        ],
      };
  }
}

function heroNode(id: string, locale: string, copy: ModuleCopy): PuckNode[] {
  if (!copy.hero) return [];
  return [
    node("HeroCard", `${id}-hero`, {
      label: copy.hero.label,
      value: copy.hero.value,
      href: `/${locale}/portal/dashboard`,
      chgSuffix: copy.hero.suffix,
      stats: copy.hero.stats.map((st) => ({ ...st, href: `/${locale}/portal/dashboard` })),
      // No sparkline: HeroCard draws an all-zero series as nothing, and these
      // modules carry their trend in a real chart below rather than as a shape
      // behind the number.
      spark: [],
      sparkLabel: "",
    }),
  ];
}

function trendNode(id: string, copy: ModuleCopy): PuckNode[] {
  if (!copy.trend) return [];
  return [
    node("TrendChart", `${id}-trend`, {
      title: copy.trend.title,
      caption: copy.trend.caption,
      kind: "bar",
      unit: copy.trend.unit,
      points: copy.trend.points,
    }),
  ];
}

/**
 * Builds any archetype the seven originals do not cover.
 *
 * The shape decides the furniture around the table; `moduleCopy` decides every
 * word in it. A module whose shape needs a piece of furniture its copy does not
 * fill in simply does not get that piece -- 佣金 has no upload field, because
 * commission is calculated rather than evidenced, and an empty upload box on
 * that page would be furniture pretending to be a feature.
 */
function buildFromShape(
  shape: ModuleShape,
  pageKey: PageId,
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
  ownTitle?: string | null,
): PuckNode[] {
  const industry = ctx.industry ?? FALLBACK_INDUSTRY;
  const labels = labelsFromPages(industry.labels, pages);
  const brand = displayBusinessName(ctx);
  const copy = moduleCopy(pageKey, labels);
  // The customer's own noun wins over the archetype's default: the AI renames
  // `customers` to 经销商 for a master dealer, and the page heading has to agree
  // with the rail or the system reads as two products bolted together.
  const title = ownTitle?.trim() || copy.title;

  const head: PuckNode[] = [
    railNav(labels, brand, name, pageKey, locale, pages),
    node("PageHeader", `${pageKey}-header`, { title, subtitle: copy.subtitle }),
  ];

  const search = copy.searchPlaceholder
    ? [
        node("Combobox", `${pageKey}-search`, {
          name: `${pageKey}-search`,
          value: "",
          placeholder: copy.searchPlaceholder,
          options: copy.rows.map((r, i) => ({ label: r.primary, value: `row-${i}` })),
        }),
      ]
    : [];

  const filter = copy.filter
    ? [filterChips(`${pageKey}-filters`, copy.filter.kind, [copy.filter.value])]
    : [];

  const month = [
    node("MonthPicker", `${pageKey}-month`, {
      name: `${pageKey}-month`,
      placeholder: "选择月份",
      allowClear: true,
    }),
  ];

  const table = [recordTable(`${pageKey}-table`, title, copy.columns, copy.rows)];

  const upload = copy.upload
    ? [
        node("FileUploadField", `${pageKey}-upload`, {
          label: copy.upload.label,
          hint: copy.upload.hint,
          name: `${pageKey}-file`,
          accept: "image/*,application/pdf",
        }),
      ]
    : [];

  switch (shape) {
    case "directory":
      return [...head, ...search, ...table];

    case "catalog":
      return [...head, ...search, ...filter, ...table];

    case "pipeline":
      return [
        ...head,
        workflowStrip(`${pageKey}-workflow`, `${title}流程`, workflowStages(ctx), 1),
        ...filter,
        ...table,
      ];

    case "ledger":
      return [...head, ...month, ...heroNode(pageKey, locale, copy), ...table, ...upload];

    case "report":
      return [
        ...head,
        ...month,
        ...heroNode(pageKey, locale, copy),
        ...trendNode(pageKey, copy),
        ...table,
      ];

    case "leaderboard":
      return [...head, ...filter, ...trendNode(pageKey, copy), ...table];

    case "reconcile":
      return [
        ...head,
        ...month,
        ...heroNode(pageKey, locale, copy),
        // The variance statement is an Alert rather than a paragraph because
        // 「对得上 / 对不上」 is a STATE, and a state the owner checks once a
        // month should be readable without being read. It is the one place in
        // the system where the answer IS the whole page.
        ...(copy.variance
          ? [
              node("Alert", `${pageKey}-variance`, {
                variant: "default",
                title: copy.variance.title,
                description: copy.variance.description,
              }),
            ]
          : []),
        ...table,
      ];

    default:
      return [...head, ...table];
  }
}

/**
 * The seven originals, each hand-written against its trade's own sample data.
 * Everything else in the catalogue is carried by `buildFromShape` above.
 *
 * Deliberately a partial map rather than a complete one: a key being absent
 * here is the signal that it is shape-built, so adding a module to the
 * catalogue needs no edit in this file at all -- only a `moduleCopy` arm.
 */
const BUILDERS: Record<
  string,
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
  const labels = labelsFromPages(industry.labels, pages);
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

/**
 * The trade's three nouns, overridden by what THIS business calls them.
 *
 * The AI now returns a label per module (lib/portal/module-catalog.ts) and the
 * signup trigger stores it as `project_pages.title`, so a SIM-card master
 * dealer's customers page is titled 经销商. Without this, that rename reached
 * the rail and the page heading and stopped there: the ranking table two pages
 * over was still headed 客户, because `moduleCopy` read the industry row.
 *
 * Caught in a real browser rather than reasoned about -- the rail said 经销商
 * and the table under it said 客户 A / 客户 B, in the same screenshot. A system
 * that calls the same thing two names in two places is one a business owner
 * stops trusting, and it is the exact failure the trade-vocabulary work exists
 * to prevent.
 *
 * Only the three nouns that ARE vocabulary get overridden. 对账 and 佣金 are
 * page names, not nouns other pages refer to, so a rename there changes that
 * page's heading and nothing else -- which is right.
 */
function labelsFromPages(base: IndustryLabels, refs: PageRef[]): IndustryLabels {
  const titleOf = (key: string) => refs.find((p) => p.key === key)?.title?.trim() || undefined;
  return {
    customer: titleOf("customers") ?? base.customer,
    staff: titleOf("staff") ?? base.staff,
    // Whichever of the two order-shaped pages this business actually has. A
    // wholesaler has both; `orders` wins because it is the one their day runs on.
    order: titleOf("orders") ?? titleOf("projects") ?? base.order,
  };
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
  const labels = labelsFromPages((ctx.industry ?? FALLBACK_INDUSTRY).labels, refs);
  const self = refs.find((p) => p.key === pageKey);

  // Three ways a page gets built, in order of how much is known about it:
  // one of the seven hand-written templates, a catalogue archetype rendered by
  // its shape, or -- for a page the customer invented -- the generic starting
  // point. None of them is a blank canvas, which is the whole point of the
  // file.
  const archetype = MODULE_BY_KEY[pageKey];
  const [rail, ...rest] = BUILDERS[pageKey]
    ? BUILDERS[pageKey](ctx, businessName, locale, refs)
    : archetype
      ? buildFromShape(
          archetype.shape as ModuleShape,
          pageKey,
          ctx,
          businessName,
          locale,
          refs,
          self?.title,
        )
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
