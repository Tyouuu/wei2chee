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
    /** Section headings for the navigation, used only once a business has
     *  enough pages for sections to be organisation rather than overhead --
     *  see railNav() in industry-template.ts for where that line is drawn. */
    groups: {
      daily: string;
      work: string;
      books: string;
      reports: string;
      publicFacing: string;
    };
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
    /**
     * 🔴 这两句本来写死「最近六期」，而 2026-09-03 示例的期数改成十二之后
     * **画面上画着十二根柱子，底下写着六期** —— 一句查得出来是假的话，
     * 而且它长在客人会拿去给他自己客人看的那一页上。
     *
     * 🔴 第一版改成了**函式**，而这份 copy 会从伺服器传进浏览器的组件里 ——
     * `Functions cannot be passed directly to Client Components`，
     * 整个风格画廊变成空白，一张卡都不剩。这个仓库栽在同一条上至少三次
     * （见 puck-config-client 档头的 BLOCKS / BLOCK_COPY）。
     *
     * 所以留字串，里面放一个 `{n}` —— 期数在产生页面的时候填进去，
     * 那一步是在伺服器上跑的，出来的还是一个字串。
     */
    trendCaption: string;
    /** Six period labels for that chart's x-axis, oldest first, matching
     *  `heroSpark` in the sample files. Relative rather than named months so
     *  they never contradict the date the customer signed up. */
    periods: [string, string, string, string, string, string];
    /** The short list of things to act on today, beside the chart. */
    todoTitle: string;
    todoAction: string;
    /** The segments above the recent-records table. "All" is added by the
     *  component itself, in the system's language. */
    recentFilters: [string, string];
    /** The one action an owner opens the system to take. A real link into
     *  their own sell-side page -- see buildDashboard. */
    primaryAction: (sellSide: string) => string;
    /** The heading over the ranked list some registers open with instead of a
     *  chart. Ranked by value this year, from the same records. */
    rankingTitle: string;
    /** 占比块的标题 —— 问的是「钱卡在哪一段」,不是「这个月多少」。 */
    shareTitle: string;
    /**
     * 分页签上的三个词。
     *
     * 抄的是 TailAdmin 的 Statistics 卡跟 Ant 的图表卡：一张卡三个页签，
     * 换一个角度看同一笔钱。**三个页签里放的必须是三件不同的事** ——
     * 三张一样的图配三个不同的名字，是这个仓库禁掉过的那种谎。
     * 所以是走势 / 占比 / 流程，三个问题各问一次。
     *
     * ⚠️ 页签上的字要**短**。上面那几个标题（「钱卡在哪一段」）是卡片的标题，
     * 塞进页签会换行。
     */
    tabTrend: string;
    tabShare: string;
    tabFlow: string;
    /**
     * 一排小格子上的三个标签。
     *
     * 🔴 第一版拿的是指标排那三个数字，於是 1:1 的裁图上**同一页把同一组数字
     * 印了两遍**。那正是「印」那一套风格被砍掉的理由（同一行印两次同一个数字），
     * 而我在补零件的时候又做了一次。
     *
     * 所以这三个必须问**别的问题**：一共几个客户、最大的一单、平均一单 ——
     * 三个都是从同一份记录算出来的，而三个都不是上面那一排。
     */
    /** 卡片头上右边那句「看全部」。参考六页全部有，我们六套一个都没有。 */
    seeAll: string;
    /** 问候带底下那行小字。`{n}` 是今天要跟的单数，由产生页面的那一步填。 */
    greetSub: string;
    /** 「快捷入口」那张卡的标题。 */
    quickTitle: string;
    tileCount: string;
    tileBiggest: string;
    tileAverage: string;
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

  /**
   * 钱那三页共用的几句 —— 收款 · 开销 · 佣金。
   *
   * 出处：arhamkhnz 的 `finance` 那一页右上角「Income sources」。
   * 那不是一张排行榜（谁排第几），是**「这一份有多大」**：
   * 一个老板看排行是要挑人打电话，看比例条是要知道钱集中在谁身上。
   */
  money: {
    /**
     * 那一栏比例条的标题。
     *
     * 🔴 **它讲的是「最大的几笔」，不是「谁拿走最多」。** 第一版写的是
     * 「钱给了谁」，而那一块画出来是**一笔一笔**（`live-rows.ts` 的 RankList
     * 按金额排、取前五，不合并同一个人）—— 於是同一家「Chin Hin Cement」
     * 在同一栏里出现两次，18% 一次、10% 一次。
     * 那两笔都是真的，**错的是标题**：一句承诺了合并的话配一份没合并的清单。
     * （[任务 80](../../docs/founder-tasks.md)：对的数字配错的标签，比空白更糟。）
     */
    topPaid: string;
    topSpent: string;
    topEarned: string;
    /** 收款那张图自己的标题。开销跟佣金用它们 copy 里的那一句。 */
    trendTitle: string;
    /**
     * 那张图底下那句说明。
     *
     * 🔴 **里面不准有数字。** 第一版用的是总览那一句「最近 {n} 期」，
     * 填的是**示例**那份点数（12），而真资料那边只有 6 个月 ——
     * 於是画面上写着「Last 12 periods」，图上六根。
     * 投影只换点不换那句话，所以那句话必须对**任何**点数都成立。
     */
    trendCaption: string;
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

  /**
   * The words the four NON-TABLE page kinds need.
   *
   * Measured 2026-09-02: seventeen backstage modules produced fourteen page
   * skeletons and sixteen of them were the same sentence -- a heading, one or
   * two filter controls, and the same table. That is not a shortage of
   * components (there are eighty-seven); it is one arrangement wearing
   * fourteen coats, which is exactly what 重点 7a rules out.
   *
   * Deliberately small. Every other string these pages need is already the
   * module's own noun -- the detail panel labels its rows with the SAME column
   * headings the table uses, so a master dealer's page says 经销商 in both
   * places without a word being added here.
   */
  pageKind: {
    /** The board's own columns are the trade's workflow, so it needs no title. */
    detailFallback: string;
    documentHeading: (title: string) => string;
    documentTermsHeading: string;
    documentTerms: string;
    documentSign: string;
    documentDate: string;
    /** 🔴 进货单那张纸上的字，跟报价单不是同一段。
     *
     *  在 2026-09-05 之前两张纸印的是同一段，於是一张给建材行的
     *  水泥进货单上印着 **「报价 30 天内有效。签名并收到订金后开工。」**
     *  —— 那是**我们卖东西**的条款，印在**我们买东西**的单上，
     *  讲给供应商听。整段没有一句是对的。
     *
     *  ⚠️ 而这一段刻意**不发明任何事实**：不写送到哪里、不写几时要、
     *  不写付款条件 —— 那三样是关於这一单的宣称，我们不知道。
     *  留下的是每一个买东西的人都成立的那一句：**照单点收**。 */
    buyingTerms: string;
    /** 收货的人签，不是客人签。见 buyingTerms。 */
    buyingSign: string;
    dayHeading: string;
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
    groups: {
      daily: "Day to day",
      work: "The work",
      books: "The books",
      reports: "Numbers",
      publicFacing: "Public",
    },
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
    sparkLabel: "Last {n} periods",
    trendTitle: "Revenue trend",
    trendCaption: "Last {n} periods",
    periods: ["−5", "−4", "−3", "−2", "Last", "Now"],
    todoTitle: "To follow up today",
    todoAction: "Open",
    recentFilters: ["In progress", "Awaiting payment"],
    /* 🔴 **一张，不是一批。** 送进来的永远是侧栏上那个字（一张清单的名字），
       而这颗按钮开的是一笔 —— 不砍的话，一间补习中心的总览上写着
       **「+ New class sessions」**（2026-09-09 三个行业拍出来都中）。 */
    primaryAction: (sellSide) => `New ${singularise(sellSide, "en").toLowerCase()}`,
    rankingTitle: "Who is worth the most",
    shareTitle: "Where the money is sitting",
    tabTrend: "Trend",
    tabShare: "Share",
    tabFlow: "Stages",
    seeAll: "See all",
    greetSub: "{n} to follow up today",
    quickTitle: "Jump to",
    tileCount: "On the books",
    tileBiggest: "Biggest one",
    tileAverage: "Average one",
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

  money: {
    topPaid: "Biggest receipts",
    topSpent: "Biggest spends",
    topEarned: "Biggest commissions",
    trendTitle: "Received, month by month",
    trendCaption: "Each bar is one month.",
  },

  bookings: {
    title: "Bookings",
    /* 送进来的是「Stylists」「Therapists」—— 侧栏上那一页的名字。
       这三句讲的都是**一个人**，所以砍掉那个 s；
       底下 allStaff（「All stylists」）照旧是复数，那一句讲的是全部。 */
    subtitle: (staff) =>
      `Who is coming in today, which ${singularise(staff, "en").toLowerCase()} is taking them, and for what.`,
    datePlaceholder: "Pick a date",
    staffPlaceholder: (staff) => `Pick a ${singularise(staff, "en").toLowerCase()}`,
    allStaff: (staff) => `All ${staff.toLowerCase()}`,
    caption: "Today",
    serviceColumn: "Service",
    whenColumn: (staff) => `Time / ${singularise(staff, "en").toLowerCase()}`,
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

  pageKind: {
    detailFallback: "Details",
    documentHeading: (title) => `${title} — as it prints`,
    documentTermsHeading: "Terms",
    /* Deliberately about HOW the business works and not about money owed to
       anyone: this paragraph is printed on a document a stranger reads, and a
       default that invents a payment term would be us making a commitment on
       the owner's behalf. */
    documentTerms:
      "Quoted prices hold for 30 days. Work starts once this is signed and the deposit is received. Anything added later is quoted separately.",
    documentSign: "Signature",
    documentDate: "Date",
    buyingTerms:
      "Quantities and prices as listed above. Goods are checked against this order on arrival — tell us at once if anything does not match.",
    buyingSign: "Received by",
    dayHeading: "Today",
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
    groups: {
      daily: "日常",
      work: "工程",
      books: "账目",
      reports: "看数",
      publicFacing: "对外",
    },
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
    sparkLabel: "最近 {n} 期",
    trendTitle: "收入走势",
    trendCaption: "最近 {n} 期",
    periods: ["−5", "−4", "−3", "−2", "上期", "本期"],
    todoTitle: "今天要跟的",
    todoAction: "打开",
    recentFilters: ["进行中", "待收款"],
    primaryAction: (sellSide) => `新增${sellSide}`,
    rankingTitle: "最大的几个客户",
    shareTitle: "钱卡在哪一段",
    tabTrend: "走势",
    tabShare: "占比",
    tabFlow: "流程",
    seeAll: "看全部",
    greetSub: "今天要跟 {n} 单",
    quickTitle: "快捷入口",
    tileCount: "手上一共",
    tileBiggest: "最大的一单",
    tileAverage: "平均一单",
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

  money: {
    topPaid: "收到最大的几笔",
    topSpent: "花掉最大的几笔",
    topEarned: "最大的几笔佣金",
    trendTitle: "逐月收到",
    trendCaption: "一根就是一个月。",
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

  pageKind: {
    detailFallback: "详情",
    documentHeading: (title) => `${title} — 印出来的样子`,
    documentTermsHeading: "条款",
    documentTerms:
      "报价 30 天内有效。签名并收到订金后开工。之后另外加的项目另外报价。",
    documentSign: "签名",
    documentDate: "日期",
    buyingTerms:
      "数量和金额以本单为准。到货时照单点收，数量或规格不对请当场告知。",
    buyingSign: "收货签名",
    dayHeading: "今天",
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

/**
 * 反过来那一支：**一个**。
 *
 * 侧栏上那几个字全部是一张清单的名字 —— 「Appointments」「Class sessions」
 * 「Fee bills」。而画面上有几个位子要的是**一笔**：
 * 那颗新增的按钮（开一张，不是开一批）、「哪个师傅接」、「挑一个师傅」。
 *
 * 🔴 少了这一支，那几个位子印的是清单的名字，於是拍出来是
 * **「+ New appointments」「+ New class sessions」「which stylists is taking
 * them」** —— 三句话在三个行业的每一页上，而它们是同一个洞。
 *
 * ⚠️ 跟 pluralise 共用同一份集合名词（Staff · Crew 两个方向都不动），
 * 而且刻意**只砍看得懂的那几种**：ss（Business）· us（Status）·
 * is（Analysis）一个字都不碰 —— 砍错一个字，比留着一个复数难看得多。
 */
export function singularise(noun: string, lang: SystemLang): string {
  if (lang === "zh") return noun;
  const n = noun.trim();
  if (!n || COLLECTIVE.has(n) || !n.endsWith("s")) return n;
  if (/(?:ss|us|is)$/.test(n)) return n;
  if (/[^aeiou]ies$/.test(n)) return `${n.slice(0, -3)}y`;
  if (/(?:sse|she|che|xe|ze)s$/.test(n)) return n.slice(0, -2);
  return n.slice(0, -1);
}
