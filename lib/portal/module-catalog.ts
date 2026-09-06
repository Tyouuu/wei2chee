import type { SystemLang } from "@/lib/system-lang";

/**
 * Every kind of page a business's system can be made of.
 *
 * WHY THIS FILE EXISTS
 *
 * Until now the answer to "how many pages does my system have" was a SQL CASE
 * statement over eight industry slugs (`pages_for_industry`), returning four or
 * five pages, forever, regardless of what the business actually did. The AI
 * analysed the business in real detail -- and then had no say whatsoever in what
 * got built from that analysis. Its schema had no field for it.
 *
 * That was measured against a real case rather than argued about. A Master
 * Dealer for SIM top-ups was run through the live analysis three times: the
 * model correctly identified monthly reconciliation, 2% commission calculation
 * and the missing dealer activity ranking as the three things the business runs
 * on. The system it was then handed contained 报价单 and 项目 -- neither of which
 * exists in that business -- and could not contain 对账, 佣金 or 排名, because
 * `project_pages.page_key` was constrained to seven values that did not include
 * them.
 *
 * WHY A CATALOGUE AND NOT FREE-FORM
 *
 * The obvious fix -- let the model name any page it likes -- breaks the one
 * invariant that keeps this product safe: the LLM never emits layout JSON. See
 * the long note at the top of lib/templates/industry-template.ts. A page whose
 * key nothing can build is a blank canvas for a paying customer, which is the
 * exact bug that file exists to prevent.
 *
 * So the model chooses from a fixed list, and the list is the contract. This is
 * how "AI builds your system" actually works at B12 and Durable underneath the
 * marketing: hand-designed archetypes, AI-driven selection and fill. What the
 * model contributes is the part it is genuinely good at -- which of these a
 * particular business needs, what that business calls it, and why.
 *
 * WHY `shape` IS SEPARATE FROM `key`
 *
 * 对账 and 佣金 are different modules to a business owner and the same layout to
 * a renderer: a month picker, a headline figure, a table. Sixteen hand-written
 * builders would be sixteen places for the same bug. Nine shapes carry them,
 * and the vocabulary is what differs -- which is also the honest description of
 * what makes these modules different from each other.
 */

/** The layout an archetype is rendered with. See BUILDERS in
 *  lib/templates/industry-template.ts for what each one lays out. */
export type ModuleShape =
  | "overview"
  | "directory"
  | "pipeline"
  | "ledger"
  | "calendar"
  | "reconcile"
  | "leaderboard"
  | "catalog"
  | "report"
  /** The page the business's own CUSTOMERS see. Not a shell page: no rail, no
   *  in-app chrome, and the one place in the product where a stranger is the
   *  reader. See buildWebsite in industry-template.ts. */
  | "landing";

export type ModuleArchetype = {
  /** Stable identifier. Becomes `project_pages.page_key`, so it can never
   *  change once a customer has a page of this kind. */
  key: string;
  /** The default Chinese noun. The model may override it with the business's
   *  own word -- a Master Dealer says 经销商, a salon says 顾客. */
  label: string;
  /** The same noun in English, which is what a system built in English is
   *  headed with. NOT a translation of `label` at render time: 库存 is "Stock"
   *  on a Malaysian shop floor and "Inventory" only in a textbook, and the
   *  difference is the whole reason this product does not read like imported
   *  software. The model may override this too -- see `label_en` in
   *  lib/openai/analysis-schema.ts. */
  labelEn: string;
  /** What this module is for, in one line. Shown to the model when it chooses,
   *  and to the founder in the console. Written for a business owner, not a
   *  developer. */
  blurb: string;
  shape: ModuleShape;
  /** Modules every system gets regardless of trade. The model is told these are
   *  already included so it does not spend a choice on them. */
  always?: true;
};

/** The archetype's noun in the system's own language. Falls back to the
 *  Chinese label rather than to the key, because a rail item reading
 *  "reconciliation" is worse than one reading 对账. */
export function moduleLabel(
  archetype: Pick<ModuleArchetype, "label" | "labelEn">,
  lang: SystemLang,
): string {
  return lang === "en" ? archetype.labelEn || archetype.label : archetype.label;
}

export const MODULE_CATALOG: ModuleArchetype[
  // --- 一进来先看到的 -------------------------------------------------------------
] = [
  {
    key: "dashboard",
    label: "总览",
    labelEn: "Overview",
    blurb: "一页看完今天的生意：关键数字、流程走到哪、要跟进什么。",
    shape: "overview",
    always: true,
  },
  // --- 活儿从进来到做完 ------------------------------------------------------------

  {
    key: "quotations",
    label: "报价单",
    labelEn: "Quotations",
    blurb: "发出去的报价，跟进哪些确认了、哪些还没回。适合先报价再做的生意。",
    shape: "pipeline",
  },
  {
    key: "bookings",
    label: "预约",
    labelEn: "Bookings",
    blurb: "今天谁要来、几点、谁接。适合按时间排班接客的生意。",
    shape: "calendar",
  },
  {
    key: "orders",
    label: "订单",
    labelEn: "Orders",
    blurb: "一张张的订单从下单到出货。适合成交量大、不用逐单报价的生意。",
    shape: "pipeline",
  },
  {
    key: "projects",
    label: "项目",
    labelEn: "Projects",
    blurb: "一单工程/案子做到哪一步，进度和里程碑。适合一单做很久的生意。",
    shape: "pipeline",
  },
  {
    key: "tasks",
    label: "任务",
    labelEn: "Tasks",
    blurb: "谁负责什么、什么时候要交、做完没有。",
    shape: "pipeline",
  },
  // --- 钱进钱出 ----------------------------------------------------------------
  {
    /* 进货单. The eighteenth, and it needs no new shape: a purchase order is a
       document with a counterparty, an amount and a stage -- the definition of
       `pipeline`. 任务 67 measured six real systems and said so before it was
       built: 「pipeline 做完之后采购单几乎是白捡的」.

       ⚠️ IT BUYS RATHER THAN SELLS, and that is the one thing about it that is
       not like its four siblings. Its counterparty is a 供应商, not a 客户 --
       see directory_side() in 20260831110000, which exists because the same
       person can legitimately be both and the money would otherwise be filed
       against the wrong side. */
    key: "purchases",
    label: "进货单",
    labelEn: "Purchase orders",
    blurb: "向供应商订的货：订了什么、多少钱、到了没有、付了没有。",
    shape: "pipeline",
  },

  {
    key: "payments",
    label: "收款",
    labelEn: "Payments",
    blurb: "谁付了、谁还欠着、这个月收了多少，附收据凭证。",
    shape: "ledger",
    always: true,
  },
  {
    key: "expenses",
    label: "开销",
    labelEn: "Expenses",
    blurb: "钱花去哪里了，附单据。跟收款对起来才知道真正赚多少。",
    shape: "ledger",
  },
  {
    key: "commission",
    label: "佣金",
    labelEn: "Commission",
    blurb: "抽成、分佣、业绩提成，每月自动算出来该拿多少。",
    shape: "ledger",
  },
  // --- 名词 — 被上面每一件事指到的东西 ---------------------------------------------------
  {
    key: "customers",
    label: "客户",
    labelEn: "Customers",
    blurb: "所有客户的名单和联络方式，点进去看这个客户的历史。",
    shape: "directory",
    always: true,
  },
  {
    key: "suppliers",
    label: "供应商",
    labelEn: "Suppliers",
    blurb: "向谁进货、账期多久、这家欠着多少。",
    shape: "directory",
  },
  {
    key: "staff",
    label: "员工",
    labelEn: "Staff",
    blurb: "谁在做什么、业绩多少、薪水怎么算。",
    shape: "directory",
  },

  {
    key: "inventory",
    label: "库存",
    labelEn: "Stock",
    blurb: "还有多少货、什么快没了、什么压太久。",
    shape: "catalog",
  },
  // --- 月底才看的 — 一行资料都不新增 ----------------------------------------------------

  {
    key: "reconciliation",
    label: "对账",
    labelEn: "Reconciliation",
    blurb: "拿上游/银行/平台出的总数，对系统里的逐笔总额，差多少一眼看到。",
    shape: "reconcile",
  },
  {
    key: "reports",
    label: "报表",
    labelEn: "Reports",
    blurb: "按月看趋势：营业额、笔数、增长，可以导出给会计或银行。",
    shape: "report",
  },

  {
    key: "ranking",
    label: "排名",
    labelEn: "Ranking",
    blurb: "谁最活跃、谁在退步，按金额和频率排出等级。适合有下线、代理、业务员的生意。",
    shape: "leaderboard",
  },
  // --- 唯一一页给陌生人看的 ----------------------------------------------------------

  // Last on purpose. Every key above is somewhere the OWNER works; this is the
  // only one a stranger reads, so it sits at the end of the rail rather than
  // in the middle of the day's work -- and appending it leaves the reading
  // order of every system built before today exactly as it was (`sortPages`
  // sorts by this array's own index).
  {
    key: "website",
    label: "官网",
    labelEn: "Website",
    blurb:
      "客人在外面看到的那一页：你做什么、做过什么、怎么找你。上面的询价表格填了，直接变成系统里的一张单。",
    shape: "landing",
    always: true,
  },
];

/** Fast lookup by key. */
export const MODULE_BY_KEY: Record<string, ModuleArchetype> = Object.fromEntries(
  MODULE_CATALOG.map((m) => [m.key, m]),
);

/** Every valid key, in catalogue order -- which is also the order pages are
 *  displayed in, so the reading order of a system is designed here rather than
 *  falling out of whatever order Postgres returns rows in. */
export const MODULE_KEYS = MODULE_CATALOG.map((m) => m.key);

/** The three every system gets. The model is told not to spend choices on them
 *  and the provisioning trigger adds them whether or not the model complied. */
export const ALWAYS_MODULES = MODULE_CATALOG.filter((m) => m.always).map((m) => m.key);

/** The ones the model actually chooses between. */
export const OPTIONAL_MODULES = MODULE_CATALOG.filter((m) => !m.always);

/**
 * The catalogue as the model sees it.
 *
 * Deliberately not JSON. A model choosing from a list reads a list better than
 * it reads a serialized object, and every token spent on braces is a token not
 * spent on the business. The `always` three are named separately rather than
 * being filtered out silently, because a model told "you already have 收款"
 * stops trying to add it -- one told nothing adds it and wastes a slot.
 */
export function catalogForPrompt(): string {
  const line = (m: ModuleArchetype) => `- ${m.key} (${m.label}): ${m.blurb}`;
  return [
    "ALREADY INCLUDED in every system -- do not choose these, they are free:",
    ...MODULE_CATALOG.filter((m) => m.always).map(line),
    "",
    "CHOOSE FROM (pick only what this business genuinely runs on):",
    ...OPTIONAL_MODULES.map(line),
  ].join("\n");
}

/**
 * What each seeded trade gets when there is no AI recommendation to go on --
 * a direct signup with no questionnaire, or an analysis that fell back.
 *
 * This is the OLD behaviour, preserved deliberately rather than deleted. It is
 * the honest answer when nothing was analysed: the trade's standard shape,
 * which is right often enough to be a working system and never claims to be
 * more than that. What changed is that it is now the floor rather than the
 * ceiling.
 */
export const DEFAULT_MODULES_FOR_INDUSTRY: Record<string, string[]> = {
  beauty: ["dashboard", "customers", "bookings", "payments", "website"],
  /*
    A tuition centre bills. `walk:tuition` walked the default set on
    2026-09-06 and could not open a single fee bill: `party_debts` counts
    pipeline rows minus what has been allocated against them, so with no
    pipeline page at all, "who has not paid this month" is not a hard
    question, it is an unanswerable one -- and that is the question the
    owner of a tuition centre asks.

    `orders` rather than `quotations`: nobody quotes a parent. The catalogue
    describes orders as the shape for a business that does not price each job
    separately, which is a monthly fee exactly.

    The salon above keeps no billing page on purpose -- `walk:salon` runs its
    whole money half through packages and counter payments, and a page it
    never opens is a page it has to skip past.
  */
  education: ["dashboard", "customers", "bookings", "orders", "payments", "website"],
  fnb: ["dashboard", "customers", "orders", "payments", "website"],
  retail: ["dashboard", "customers", "orders", "inventory", "payments", "website"],
  wholesale: ["dashboard", "customers", "quotations", "orders", "inventory", "payments", "website"],
  renovation: ["dashboard", "customers", "quotations", "projects", "payments", "website"],
  services: ["dashboard", "customers", "quotations", "projects", "payments", "website"],
  other: ["dashboard", "customers", "quotations", "projects", "payments", "website"],
};

export const DEFAULT_MODULE_SET = DEFAULT_MODULES_FOR_INDUSTRY.other;

export function defaultModulesForIndustry(slug?: string | null): string[] {
  return (slug && DEFAULT_MODULES_FOR_INDUSTRY[slug]) || DEFAULT_MODULE_SET;
}

/** The default set expressed as recommendations, for the fallback path -- so
 *  every consumer downstream reads one shape whether or not a model ran. */
export function defaultRecommendations(slug?: string | null): RecommendedModule[] {
  return defaultModulesForIndustry(slug).map((key) => ({
    key,
    label: MODULE_BY_KEY[key]?.label ?? key,
    label_en: MODULE_BY_KEY[key]?.labelEn ?? key,
    why: "",
  }));
}

/** A module the AI recommended for one business. */
export type RecommendedModule = {
  key: string;
  /** The business's own word for it, e.g. 经销商 rather than 客户. */
  label: string;
  /** The same word in English, e.g. Dealers rather than Customers. This is
   *  what the page is actually HEADED in a system built in English, which is
   *  the default -- so a missing one costs the business its own vocabulary on
   *  every page. Falls back to the archetype label.
   *
   *  Snake_case, unlike `ModuleArchetype.labelEn` next to it, and deliberately:
   *  this type is the WIRE shape -- what the model returns and what lands in
   *  `analysis_results.modules` -- and the rest of that payload is snake_case.
   *  The catalogue is ours and reads as TypeScript; this is theirs. */
  label_en: string;
  /** One line, in the owner's language, on why THIS business needs it. */
  why: string;
};

/**
 * Turns whatever the model returned into a page set that is guaranteed
 * buildable: unknown keys dropped, duplicates collapsed, the always-on three
 * guaranteed present, capped, and sorted into catalogue order.
 *
 * Every one of those is a real failure mode rather than defensive habit. A
 * strict JSON schema stops the model inventing a KEY, but nothing stops it
 * returning 收款 twice, or returning eleven modules because the business
 * genuinely could use eleven -- and a customer opening a system with eleven
 * pages on day one is a customer who closes it.
 */
export const MAX_MODULES = 8;

export function normalizeModules(raw: unknown): RecommendedModule[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: RecommendedModule[] = [];

  const push = (
    key: string,
    label?: string,
    labelEn?: string,
    why?: string,
  ) => {
    const archetype = MODULE_BY_KEY[key];
    if (!archetype || seen.has(key)) return;
    seen.add(key);
    out.push({
      key,
      label: (label || "").trim() || archetype.label,
      label_en: (labelEn || "").trim() || archetype.labelEn,
      why: (why || "").trim(),
    });
  };

  // The always-on three first, taking the model's wording for them when it
  // offered any -- 经销商 is a better label for `customers` than 客户 is, and
  // that rename is one of the most convincing details in the whole first screen.
  for (const key of ALWAYS_MODULES) {
    const match = list.find(
      (m): m is RecommendedModule =>
        !!m && typeof m === "object" && (m as RecommendedModule).key === key,
    );
    push(key, match?.label, match?.label_en, match?.why);
  }

  for (const m of list) {
    if (out.length >= MAX_MODULES) break;
    if (!m || typeof m !== "object") continue;
    const { key, label, label_en, why } = m as RecommendedModule;
    if (typeof key === "string") push(key, label, label_en, why);
  }

  return out.sort((a, b) => MODULE_KEYS.indexOf(a.key) - MODULE_KEYS.indexOf(b.key));
}
