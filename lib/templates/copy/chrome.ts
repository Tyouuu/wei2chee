import type { SystemLang } from "@/lib/system-lang";
import type { IndustryLabels } from "./types";

/**
 * Every phrase the page BUILDERS write directly -- page headings, column
 * headings, placeholders, the caption over a table.
 *
 * Separate from `module-copy.*` on purpose. That file is the vocabulary of one
 * MODULE (对账 / Reconciliation has its own nouns); this one is the vocabulary
 * of the system's furniture, which is the same on every page. Splitting them
 * is what stops "Status" being written in eleven places.
 *
 * Phrases that need one of the trade's nouns are functions, not strings with a
 * placeholder token in them. `${customer} list` and 「${customer}名单」 do not
 * put the noun in the same position, and a template string that assumes they do
 * is how a translation layer starts producing "list 客户".
 */
export type Chrome = {
  /** The rail, identical on every page. */
  rail: {
    notifications: string;
    account: string;
    /** The role under the account chip. The owner is the owner. */
    ownerRole: string;
  };

  /** The two chrome strings on a FilterChips block. Passed rather than
   *  defaulted because that component is server-rendered. */
  filter: { filteredBy: string; clearAll: string };

  /** Column headings shared across pages. */
  col: {
    status: string;
    amount: string;
    progress: string;
    contact: string;
  };

  /** Placeholder business name, per trade, when the owner has not given one.
   *  Obviously not their company, obviously about their company. */
  brand: Record<string, string>;
  brandFallback: string;

  /** The industry noun used when a business has no lead or no industry. */
  fallbackIndustryName: string;
  fallbackLabels: IndustryLabels;

  /** `buildPageLayout`'s default when no owner name is known. */
  defaultBusinessName: string;
  /** A page the customer added that has no title yet. */
  newPage: string;

  dashboard: {
    title: string;
    subtitle: (industryName: string) => string;
    workflowTitle: string;
    recent: (order: string) => string;
    sparkLabel: string;
    /** The chart block that replaced the hero card's sparkline on 2026-08-25.
     *  A first screen with no chart on it was the most visible of the six
     *  differences between ours and eleven competitors' -- see
     *  design-system/components/stat-row.tsx for what was measured. */
    trendTitle: string;
    trendCaption: string;
    /** Six period labels for that chart's x-axis, oldest first, matching
     *  `heroSpark` in the sample files. Relative rather than named months so
     *  they never contradict the date the customer signed up. */
    periods: [string, string, string, string, string, string];
    /** The short list of things to act on today, beside the chart. */
    todoTitle: string;
    todoAction: string;
  };

  customers: {
    title: (customer: string) => string;
    subtitle: (customer: string) => string;
    search: (customer: string) => string;
    caption: (customer: string) => string;
  };

  quotations: {
    title: string;
    subtitle: (customer: string) => string;
    filterKind: string;
    filterValue: string;
    datePlaceholder: string;
    caption: string;
    itemColumn: string;
    amountColumn: string;
  };

  projects: {
    title: (order: string) => string;
    /** Prefix on the AI's own bottleneck, shown as the page subtitle. */
    focus: (bottleneck: string) => string;
    subtitle: (order: string) => string;
    workflow: (order: string) => string;
    staffPlaceholder: (staff: string) => string;
    allStaff: (staff: string) => string;
    caption: (order: string) => string;
  };

  payments: {
    title: string;
    subtitle: (customer: string) => string;
    monthPlaceholder: string;
    caption: string;
    itemColumn: string;
    uploadLabel: string;
    uploadHint: string;
  };

  bookings: {
    title: string;
    subtitle: (staff: string) => string;
    datePlaceholder: string;
    staffPlaceholder: (staff: string) => string;
    allStaff: (staff: string) => string;
    caption: string;
    serviceColumn: string;
    whenColumn: (staff: string) => string;
    priceColumn: string;
  };

  orders: {
    title: (order: string) => string;
    focus: (bottleneck: string) => string;
    subtitle: (order: string) => string;
    workflow: (order: string) => string;
    filterKind: string;
    filterValue: string;
    caption: (order: string) => string;
  };

  shape: {
    monthPlaceholder: string;
    workflow: (title: string) => string;
  };

  custom: {
    subtitle: string;
    columns: { primary: string; secondary: string; amount: string; status: string };
    rows: { primary: string; secondary: string; status: string }[];
  };
};

const plural = (n: string) => pluralise(n, "en");

const EN: Chrome = {
  filter: { filteredBy: "Filtered by", clearAll: "Clear all" },
  rail: {
    notifications: "Notifications",
    account: "Account settings",
    ownerRole: "Owner",
  },
  col: {
    status: "Status",
    amount: "Amount",
    progress: "Progress",
    contact: "Contact / notes",
  },
  brand: {
    renovation: "My Renovation Co.",
    retail: "My Shop",
    beauty: "My Salon",
    wholesale: "My Trading Co.",
    services: "My Company",
    fnb: "My Restaurant",
    education: "My Tuition Centre",
    other: "My Company",
  },
  brandFallback: "My Company",
  fallbackIndustryName: "business",
  fallbackLabels: { customer: "Customer", order: "Order", staff: "Staff" },
  defaultBusinessName: "My business",
  newPage: "New page",

  dashboard: {
    title: "Overview",
    subtitle: (industryName) =>
      `How a ${industryName} runs, day to day — generated from your trade as a starting point. Every word here is yours to change.`,
    workflowTitle: "Your workflow",
    recent: (order) => `Recent ${plural(order).toLowerCase()}`,
    sparkLabel: "Last six periods",
    trendTitle: "Revenue trend",
    trendCaption: "Last six periods",
    periods: ["−5", "−4", "−3", "−2", "Last", "Now"],
    todoTitle: "To follow up today",
    todoAction: "Open",
  },

  customers: {
    title: (customer) => `${plural(customer)} list`,
    subtitle: (customer) =>
      `Every ${customer.toLowerCase()}, how to reach them, and what you have done together.`,
    search: (customer) => `Search ${customer.toLowerCase()} name or phone`,
    caption: (customer) => plural(customer),
  },

  quotations: {
    title: "Quotations",
    subtitle: (customer) =>
      `Quotes sent to ${plural(customer).toLowerCase()} — which are confirmed, and which have gone quiet.`,
    filterKind: "Status",
    filterValue: "Awaiting reply",
    datePlaceholder: "Quote date",
    caption: "Quotations",
    itemColumn: "Work quoted",
    amountColumn: "Quoted",
  },

  projects: {
    title: (order) => `${order} progress`,
    focus: (bottleneck) => `Watch this: ${bottleneck}`,
    subtitle: (order) => `Where every ${order.toLowerCase()} has got to, on one screen.`,
    workflow: (order) => `${order} workflow`,
    staffPlaceholder: (staff) => `Assigned ${staff.toLowerCase()}`,
    allStaff: (staff) => `All ${staff.toLowerCase()}`,
    caption: (order) => plural(order),
  },

  payments: {
    title: "Payments",
    subtitle: (customer) =>
      `Which ${plural(customer).toLowerCase()} have paid and which still owe — without scrolling back through WhatsApp.`,
    monthPlaceholder: "Pick a month",
    caption: "Payments",
    itemColumn: "For",
    uploadLabel: "Proof of payment",
    uploadHint: "Upload the transfer screenshot or receipt (JPG / PNG / PDF)",
  },

  bookings: {
    title: "Bookings",
    subtitle: (staff) =>
      `Who is coming in today, which ${staff.toLowerCase()} is taking them, and for what.`,
    datePlaceholder: "Pick a date",
    staffPlaceholder: (staff) => `Pick a ${staff.toLowerCase()}`,
    allStaff: (staff) => `All ${staff.toLowerCase()}`,
    caption: "Today",
    serviceColumn: "Service",
    whenColumn: (staff) => `Time / ${staff.toLowerCase()}`,
    priceColumn: "Price",
  },

  orders: {
    title: (order) => plural(order),
    focus: (bottleneck) => `Watch this: ${bottleneck}`,
    subtitle: (order) =>
      `Where every ${order.toLowerCase()} has got to, without asking anyone.`,
    workflow: (order) => `${order} workflow`,
    filterKind: "Status",
    filterValue: "In progress",
    caption: (order) => `${order} detail`,
  },

  shape: {
    monthPlaceholder: "Pick a month",
    workflow: (title) => `${title} workflow`,
  },

  custom: {
    subtitle: "You added this page. Every name and column below can be changed to yours.",
    columns: {
      primary: "Item",
      secondary: "Detail",
      amount: "Amount",
      status: "Status",
    },
    rows: [
      { primary: "Record 001", secondary: "Sample content", status: "Done" },
      { primary: "Record 002", secondary: "Sample content", status: "In progress" },
      { primary: "Record 003", secondary: "Sample content", status: "To do" },
    ],
  },
};

const ZH: Chrome = {
  filter: { filteredBy: "筛选条件", clearAll: "清空全部" },
  rail: {
    notifications: "通知",
    account: "账号设置",
    ownerRole: "老板",
  },
  col: {
    status: "状态",
    amount: "金额",
    progress: "进度",
    contact: "联络方式 / 备注",
  },
  brand: {
    renovation: "我的装修公司",
    retail: "我的店",
    beauty: "我的沙龙",
    wholesale: "我的贸易公司",
    services: "我的公司",
    fnb: "我的餐厅",
    education: "我的补习中心",
    other: "我的公司",
  },
  brandFallback: "我的公司",
  fallbackIndustryName: "生意",
  fallbackLabels: { customer: "客户", order: "订单", staff: "员工" },
  defaultBusinessName: "我的生意",
  newPage: "新页面",

  dashboard: {
    title: "业务总览",
    subtitle: (industryName) =>
      `${industryName}的日常运作总览 — 这是根据你的行业自动生成的起点，全部内容都可以改。`,
    workflowTitle: "你的业务流程",
    recent: (order) => `最近的${order}`,
    sparkLabel: "最近六期",
    trendTitle: "收入走势",
    trendCaption: "最近六期",
    periods: ["−5", "−4", "−3", "−2", "上期", "本期"],
    todoTitle: "今天要跟的",
    todoAction: "打开",
  },

  customers: {
    title: (customer) => `${customer}名单`,
    subtitle: (customer) => `所有${customer}的联络方式和往来记录。`,
    search: (customer) => `搜索${customer}姓名或电话`,
    caption: (customer) => `${customer}列表`,
  },

  quotations: {
    title: "报价单",
    subtitle: (customer) => `发给${customer}的报价，跟进哪些已确认、哪些还没回复。`,
    filterKind: "状态",
    filterValue: "等确认",
    datePlaceholder: "报价日期",
    caption: "报价单列表",
    itemColumn: "报价内容",
    amountColumn: "报价金额",
  },

  projects: {
    title: (order) => `${order}进度`,
    focus: (bottleneck) => `重点跟进：${bottleneck}`,
    subtitle: (order) => `每一个${order}走到哪一步，一眼看完。`,
    workflow: (order) => `${order}流程`,
    staffPlaceholder: (staff) => `负责${staff}`,
    allStaff: (staff) => `全部${staff}`,
    caption: (order) => `${order}列表`,
  },

  payments: {
    title: "收款记录",
    subtitle: (customer) => `哪些${customer}已经付了、哪些还欠着，不用再翻 WhatsApp。`,
    monthPlaceholder: "选择月份",
    caption: "收款明细",
    itemColumn: "收款项目",
    uploadLabel: "付款凭证",
    uploadHint: "上传银行转账截图或收据（JPG / PNG / PDF）",
  },

  bookings: {
    title: "预约",
    subtitle: (staff) => `今天谁要来、哪个${staff}接、做什么，一页看完。`,
    datePlaceholder: "选择日期",
    staffPlaceholder: (staff) => `选择${staff}`,
    allStaff: (staff) => `全部${staff}`,
    caption: "今日预约",
    serviceColumn: "服务项目",
    whenColumn: (staff) => `时间 / ${staff}`,
    priceColumn: "价钱",
  },

  orders: {
    title: (order) => `${order}列表`,
    focus: (bottleneck) => `重点跟进：${bottleneck}`,
    subtitle: (order) => `每一张${order}处理到哪一步，不用问人。`,
    workflow: (order) => `${order}流程`,
    filterKind: "状态",
    filterValue: "处理中",
    caption: (order) => `${order}明细`,
  },

  shape: {
    monthPlaceholder: "选择月份",
    workflow: (title) => `${title}流程`,
  },

  custom: {
    subtitle: "这一页是你自己加的。下面的名称和栏位全部可以改成你要的。",
    columns: {
      primary: "项目",
      secondary: "说明",
      amount: "金额",
      status: "状态",
    },
    rows: [
      { primary: "记录 001", secondary: "示例内容", status: "已完成" },
      { primary: "记录 002", secondary: "示例内容", status: "处理中" },
      { primary: "记录 003", secondary: "示例内容", status: "待处理" },
    ],
  },
};

export const CHROME: Record<SystemLang, Chrome> = { en: EN, zh: ZH };

export const chrome = (lang: SystemLang): Chrome => CHROME[lang];

/**
 * The trade's three nouns in English. `industries.labels` holds them in Chinese
 * only, and adding a `labels_en` column would mean touching the two RPCs that
 * project that row -- for eight rows that have not changed since the seed. So
 * the English side lives here, and industry-template.test.ts asserts the keys
 * match supabase/seed.sql.
 *
 * British spelling, because that is what Malaysian business paperwork uses.
 */
export const INDUSTRY_LABELS_EN: Record<string, IndustryLabels> = {
  renovation: { customer: "Client", order: "Project", staff: "Crew" },
  retail: { customer: "Customer", order: "Order", staff: "Staff" },
  beauty: { customer: "Client", order: "Booking", staff: "Stylist" },
  wholesale: { customer: "Customer", order: "Order", staff: "Sales rep" },
  services: { customer: "Client", order: "Project", staff: "Consultant" },
  fnb: { customer: "Customer", order: "Order", staff: "Staff" },
  education: { customer: "Parent", order: "Enrolment", staff: "Teacher" },
  other: { customer: "Customer", order: "Order", staff: "Staff" },
};

/**
 * `industries.default_workflow` is the FOUNDER'S vocabulary, shared with
 * `reference_cases.workflow` and the analysis prompt. Both maps below turn it
 * into the customer's.
 *
 * The English map is the one worth explaining: because the stored values are
 * already English, the first version passed them straight through, and a
 * renovation website printed "Customer" as the first thing that happens after a
 * stranger calls you. It read as a database enum, because it was one. Every
 * entry below is the same stage said the way the person on the other side of it
 * would say it. Caught by looking at the render, not by a test.
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

const STAGE_EN: Record<string, string> = {
  Customer: "Enquiry",
  Quotation: "Quote",
  Approval: "Approved",
  Deposit: "Deposit",
  Project: "Build",
  Milestone: "Progress",
  "Final Payment": "Balance",
  Order: "Order",
  Payment: "Paid",
  Booking: "Booking",
  Service: "Service",
  Enrollment: "Enrolment",
};

export const translateStage = (stage: string, lang: SystemLang): string =>
  lang === "zh" ? (STAGE_ZH[stage] ?? stage) : (STAGE_EN[stage] ?? stage);

/**
 * The plural of one of the trade's nouns, for the places that name a LIST
 * rather than a record: the navigation rail, a table caption.
 *
 * Chinese does not inflect, so this is identity there. English does, and the
 * first render showed why a bare `+ "s"` is not enough: a renovation crew is
 * "Crew", never "Crews", and a shop's people are "Staff", never "Staffs".
 * Collective nouns are the whole exception list.
 */
const COLLECTIVE = new Set(["Staff", "Crew"]);

export function pluralise(noun: string, lang: SystemLang): string {
  if (lang === "zh") return noun;
  const n = noun.trim();
  if (!n || COLLECTIVE.has(n) || n.endsWith("s")) return n;
  return `${n}s`;
}
