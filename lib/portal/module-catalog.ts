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
  | "report";

export type ModuleArchetype = {
  /** Stable identifier. Becomes `project_pages.page_key`, so it can never
   *  change once a customer has a page of this kind. */
  key: string;
  /** The default Chinese noun. The model may override it with the business's
   *  own word -- a Master Dealer says 经销商, a salon says 顾客. */
  label: string;
  /** What this module is for, in one line. Shown to the model when it chooses,
   *  and to the founder in the console. Written for a business owner, not a
   *  developer. */
  blurb: string;
  shape: ModuleShape;
  /** Modules every system gets regardless of trade. The model is told these are
   *  already included so it does not spend a choice on them. */
  always?: true;
};

export const MODULE_CATALOG: ModuleArchetype[] = [
  // --- The spine every business has -------------------------------------
  {
    key: "dashboard",
    label: "总览",
    blurb: "一页看完今天的生意：关键数字、流程走到哪、要跟进什么。",
    shape: "overview",
    always: true,
  },
  {
    key: "customers",
    label: "客户",
    blurb: "所有客户的名单和联络方式，点进去看这个客户的历史。",
    shape: "directory",
    always: true,
  },
  {
    key: "payments",
    label: "收款",
    blurb: "谁付了、谁还欠着、这个月收了多少，附收据凭证。",
    shape: "ledger",
    always: true,
  },

  // --- Sell-side: how work comes in -------------------------------------
  {
    key: "quotations",
    label: "报价单",
    blurb: "发出去的报价，跟进哪些确认了、哪些还没回。适合先报价再做的生意。",
    shape: "pipeline",
  },
  {
    key: "orders",
    label: "订单",
    blurb: "一张张的订单从下单到出货。适合成交量大、不用逐单报价的生意。",
    shape: "pipeline",
  },
  {
    key: "bookings",
    label: "预约",
    blurb: "今天谁要来、几点、谁接。适合按时间排班接客的生意。",
    shape: "calendar",
  },
  {
    key: "projects",
    label: "项目",
    blurb: "一单工程/案子做到哪一步，进度和里程碑。适合一单做很久的生意。",
    shape: "pipeline",
  },
  {
    key: "tasks",
    label: "任务",
    blurb: "谁负责什么、什么时候要交、做完没有。",
    shape: "pipeline",
  },

  // --- Money-side: the things that were impossible before ---------------
  {
    key: "reconciliation",
    label: "对账",
    blurb: "拿上游/银行/平台出的总数，对系统里的逐笔总额，差多少一眼看到。",
    shape: "reconcile",
  },
  {
    key: "commission",
    label: "佣金",
    blurb: "抽成、分佣、业绩提成，每月自动算出来该拿多少。",
    shape: "ledger",
  },
  {
    key: "expenses",
    label: "开销",
    blurb: "钱花去哪里了，附单据。跟收款对起来才知道真正赚多少。",
    shape: "ledger",
  },
  {
    key: "reports",
    label: "报表",
    blurb: "按月看趋势：营业额、笔数、增长，可以导出给会计或银行。",
    shape: "report",
  },

  // --- Relationship-side ------------------------------------------------
  {
    key: "ranking",
    label: "排名",
    blurb: "谁最活跃、谁在退步，按金额和频率排出等级。适合有下线、代理、业务员的生意。",
    shape: "leaderboard",
  },
  {
    key: "suppliers",
    label: "供应商",
    blurb: "向谁进货、账期多久、这家欠着多少。",
    shape: "directory",
  },
  {
    key: "staff",
    label: "员工",
    blurb: "谁在做什么、业绩多少、薪水怎么算。",
    shape: "directory",
  },

  // --- Stock-side -------------------------------------------------------
  {
    key: "inventory",
    label: "库存",
    blurb: "还有多少货、什么快没了、什么压太久。",
    shape: "catalog",
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
  beauty: ["dashboard", "customers", "bookings", "payments"],
  education: ["dashboard", "customers", "bookings", "payments"],
  fnb: ["dashboard", "customers", "orders", "payments"],
  retail: ["dashboard", "customers", "orders", "inventory", "payments"],
  wholesale: ["dashboard", "customers", "quotations", "orders", "inventory", "payments"],
  renovation: ["dashboard", "customers", "quotations", "projects", "payments"],
  services: ["dashboard", "customers", "quotations", "projects", "payments"],
  other: ["dashboard", "customers", "quotations", "projects", "payments"],
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
    why: "",
  }));
}

/** A module the AI recommended for one business. */
export type RecommendedModule = {
  key: string;
  /** The business's own word for it, e.g. 经销商 rather than 客户. */
  label: string;
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

  const push = (key: string, label?: string, why?: string) => {
    const archetype = MODULE_BY_KEY[key];
    if (!archetype || seen.has(key)) return;
    seen.add(key);
    out.push({
      key,
      label: (label || "").trim() || archetype.label,
      why: (why || "").trim(),
    });
  };

  // The always-on three first, taking the model's wording for them when it
  // offered any -- 经销商 is a better label for `customers` than 客户 is, and
  // that rename is one of the most convincing details in the whole first screen.
  for (const key of ALWAYS_MODULES) {
    const match = list.find(
      (m): m is RecommendedModule => !!m && typeof m === "object" && (m as RecommendedModule).key === key,
    );
    push(key, match?.label, match?.why);
  }

  for (const m of list) {
    if (out.length >= MAX_MODULES) break;
    if (!m || typeof m !== "object") continue;
    const { key, label, why } = m as RecommendedModule;
    if (typeof key === "string") push(key, label, why);
  }

  return out.sort((a, b) => MODULE_KEYS.indexOf(a.key) - MODULE_KEYS.indexOf(b.key));
}
