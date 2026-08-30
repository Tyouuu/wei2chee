/**
 * 三句他真的会讲的话。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * The assistant's three example chips were three fixed strings, and the first
 * one was 「把「客户」改成「病人」」 -- a DENTAL example. Every renovation
 * contractor, aircon technician, kopitiam owner and tuition centre in this
 * product has been shown it. An example that is not about your business does
 * not teach you what the box is for; it teaches you the box is for somebody
 * else.
 *
 * The trade has been on hand the whole time (`TradeProvider`, the same context
 * the photo picker reads). This is the ninth time in this repo that a
 * capability existed and the wire was never connected.
 *
 * ── THE RULE EVERY LINE HERE OBEYS ────────────────────────────────────────
 *
 * Puck's own AI guidance warns against inventing example prompts: made-up ones
 * are vague and, worse, they advertise abilities the product does not have.
 * So every sentence below maps to an operation that exists:
 *
 *   「在表格加一列…」  -> add_table_column
 *   「把流程改成…」    -> set_workflow
 *   「把「客户」改成…」 -> set_table_column
 *
 * If an operation is ever removed, the chips that promise it have to go with
 * it. trade-suggestions.test.ts is what makes that impossible to forget.
 *
 * ── WHY NOT next-intl ─────────────────────────────────────────────────────
 *
 * This is product content that varies along a SECOND axis -- eight trades on
 * top of two languages -- and a message catalogue keyed by
 * `aiSuggest.renovation.2` is a catalogue nobody can read or check. Kept as
 * data, in the shape it actually has, next to a test that checks it.
 * Interface language still decides which column is read (重点 13).
 */

export type TradeSuggestions = { zh: string[]; en: string[] };

/**
 * Keyed by the same eight trades as TRADE_QUERIES in lib/images/stock.ts. A
 * project whose trade is unknown, or one not listed, falls to `other`.
 */
export const TRADE_SUGGESTIONS: Record<string, TradeSuggestions> = {
  renovation: {
    zh: [
      "在表格加一列「负责的师傅」",
      "把流程改成：询问 → 报价 → 订金 → 施工 → 收款",
      "把「客户」改成「屋主」",
    ],
    en: [
      'Add a "Site foreman" column to the table',
      "Change the stages to: Enquiry → Quote → Deposit → Work → Payment",
      'Rename "Client" to "Homeowner"',
    ],
  },
  services: {
    zh: [
      "在表格加一列「上门日期」",
      "把流程改成：来电 → 上门检查 → 报价 → 维修",
      "把「工程」改成「维修单」",
    ],
    en: [
      'Add a "Visit date" column to the table',
      "Change the stages to: Call → Site check → Quote → Repair",
      'Rename "Project" to "Job sheet"',
    ],
  },
  retail: {
    zh: ["在表格加一列「货号」", "把流程改成：下单 → 备货 → 出货 → 收款", "把「客户」改成「会员」"],
    en: [
      'Add a "Item code" column to the table',
      "Change the stages to: Order → Picking → Dispatch → Payment",
      'Rename "Client" to "Member"',
    ],
  },
  fnb: {
    zh: ["在表格加一列「桌号」", "把流程改成：点单 → 出餐 → 结账", "把「工程」改成「订单」"],
    en: [
      'Add a "Table" column to the table',
      "Change the stages to: Order → Served → Bill",
      'Rename "Project" to "Order"',
    ],
  },
  beauty: {
    zh: ["在表格加一列「上次做过什么」", "把流程改成：预约 → 到店 → 服务 → 收款", "把「客户」改成「顾客」"],
    en: [
      'Add a "Last treatment" column to the table',
      "Change the stages to: Booking → Arrived → Treatment → Payment",
      'Rename "Client" to "Guest"',
    ],
  },
  education: {
    zh: ["在表格加一列「班级」", "把流程改成：报名 → 缴费 → 上课", "把「客户」改成「学生」"],
    en: [
      'Add a "Class" column to the table',
      "Change the stages to: Sign up → Payment → Lessons",
      'Rename "Client" to "Student"',
    ],
  },
  wholesale: {
    zh: ["在表格加一列「箱数」", "把流程改成：下单 → 备货 → 出货 → 对账", "把「客户」改成「经销商」"],
    en: [
      'Add a "Cartons" column to the table',
      "Change the stages to: Order → Picking → Dispatch → Reconcile",
      'Rename "Client" to "Dealer"',
    ],
  },
  /* The fallback, and it stays GENERIC ON PURPOSE. Guessing a trade we were
     not told is how 「病人」 reached a renovation contractor in the first
     place. */
  other: {
    zh: ["在表格加一列「负责人」", "把流程改成：询问 → 报价 → 完成 → 收款", "把「客户」改成你自己的叫法"],
    en: [
      'Add an "Owner" column to the table',
      "Change the stages to: Enquiry → Quote → Done → Payment",
      'Rename "Client" to whatever you call them',
    ],
  },
};

/**
 * The chips for this owner, on this page, in the language the editor speaks.
 *
 * `shape` is optional so that a caller which does not know the page still
 * gets the trade's three -- which is what every caller got before, and is
 * right on a pipeline page. It is passed wherever it is known.
 */
export function suggestionsFor(
  trade: string | null | undefined,
  locale: string,
  shape?: string | null,
): string[] {
  const zh = locale.startsWith("zh");
  const set = TRADE_SUGGESTIONS[trade ?? "other"] ?? TRADE_SUGGESTIONS.other;
  const lines = zh ? set.zh : set.en;

  if (!shape) return lines;

  const opener = SHAPE_OPENER[shape];
  const kinds = KINDS_BY_SHAPE[shape] ?? KINDS_DEFAULT;
  const kept = SUGGESTION_KINDS.map((k, i) => (kinds.includes(k) ? lines[i] : null)).filter(
    (s): s is string => !!s,
  );

  /* Three is the ceiling the panel was measured at: a hit-test sweep found
     the third chip already pushing itself out of the scroll viewport, so a
     fourth would be a suggestion nobody can press. The opener goes first
     because it is the one about this page. */
  return [opener ? (zh ? opener.zh : opener.en) : null, ...kept]
    .filter((s): s is string => !!s)
    .slice(0, 3);
}

/* ──────────────────────────────────────────────────────────────────────────
   THE SAME THREE SENTENCES ON EVERY PAGE WAS THE WHOLE PROBLEM.

   A trade's three lines are about a table: add a column, change the stages,
   rename a heading. On 报价单 all three are true. On 收款 the middle one is a
   lie -- a ledger has no stages, its status is read from the money -- and on
   the 官网 page none of them are, because there is no table on it at all.

   Microsoft's HAX Guideline 1 names the two ways this fails and they are
   exactly these: DOMAIN mismatch (the area is not supported) and TASK
   mismatch (the action is not supported), and it says what they cost --
   「disappointment, product abandonment」. An example that cannot work here
   does not teach somebody what the box is for; it teaches them it is broken.

   So the sentences are filtered by the shape of the page, and each shape
   opens with one line that is about THIS page. Every line still maps to an
   operation that exists -- the rule this file already had, and the reason it
   is worth keeping: Puck's own AI guidance warns that invented examples
   advertise abilities a product does not have.
   ────────────────────────────────────────────────────────────────────────── */

/** What each position in a trade's three sentences is about. Positional
 *  because the eight trades were written that way; named here so the filter
 *  below reads, and held in place by trade-suggestions.test.ts. */
export const SUGGESTION_KINDS = ["column", "stages", "rename"] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

/** Which of a trade's sentences can be true on a page of this shape. */
const KINDS_BY_SHAPE: Record<string, SuggestionKind[]> = {
  /* Rows that move through stages -- all three apply. */
  pipeline: ["column", "stages", "rename"],
  /* 「把流程改成…」 is dropped: a ledger row's status comes from the money and
     the allocation (订金 · 已入账 · 冲正), so a stage the owner typed would be
     overruled by the page the moment it rendered. */
  ledger: ["column", "rename"],
  /* 「把流程改成…」 is dropped for the same reason as on a ledger, one step
     further out: a party has no workflow at all. 「新客户」 and 「在职」 are
     words about a person, not steps in anything, so a stage list typed here
     would be a list of things nobody ever moves between. */
  directory: ["column", "rename"],
  /* No table at all. Only the opener, which is about the words on the page. */
  landing: [],
};
const KINDS_DEFAULT: SuggestionKind[] = ["column", "rename"];

/**
 * One line that is about THIS page, and nothing else.
 *
 * `pipeline`, `ledger` and `directory` open with writing a real row, because
 * on those three shapes that is a business record now rather than a drawing --
 * the single biggest thing that changed on 2026-08-31 and the last thing an
 * owner would guess he could say.
 *
 * ⚠️ The other openers are still 「加一列…」, and that is not an oversight: on
 * 库存 and 预约 a table row IS still a drawing, so offering to add one would be
 * offering to write into a page that forgets it.
 */
const SHAPE_OPENER: Record<string, { zh: string; en: string }> = {
  pipeline: {
    zh: "加一单：Taman Desa 三房翻新，陈先生，RM 48,500",
    en: "Add one: Taman Desa 3-room renovation, Mr Tan, RM 48,500",
  },
  ledger: {
    zh: "加一笔：陈先生的订金 RM 3,000，转账",
    en: "Add one: RM 3,000 deposit from Mr Tan, bank transfer",
  },
  landing: {
    zh: "把第一屏那句大标题改成「二十年装修经验」",
    en: 'Change the headline to "Twenty years of renovation work"',
  },
  calendar: { zh: "在表格加一列「几点到」", en: 'Add an "Arrives" column to the table' },
  /* Since 2026-08-31 this writes a real party, so the opener says so. The
     line it replaced -- 「加一列 WhatsApp 号码」 -- is now actively wrong
     advice: the number is a field on the entry, because a wa.me link has to be
     built from a value rather than read out of a table cell (任务 48). */
  directory: {
    zh: "加一个客户：陈先生，013-234 5678",
    en: "Add one: Mr Tan, 013-234 5678",
  },
  catalog: { zh: "在表格加一列「进货价」", en: 'Add a "Cost price" column to the table' },
};

/**
 * WHAT IT WILL NOT DO.
 *
 * Google's PAIR guidance is explicit that onboarding has to say what a system
 * can do AND what it cannot -- and this panel said only the first, which is
 * how an owner ends up asking for a thing three times before deciding the
 * product is broken.
 *
 * ⚠️ Every line here is a rule the assistant actually follows, not a caveat
 * written to sound careful:
 *   · it refuses to invent business facts -- a price it was not told is a
 *     number that would end up in front of that owner's customer
 *   · block-rules.ts stops it adding a control wired to nothing (the reason
 *     the fake ⌘K search box was cut)
 *   · pick_photo is a PROPOSAL: it opens the picker and the owner chooses,
 *     because a stock photo is the one thing on the page that is not his
 */
export const ASSISTANT_LIMITS: { zh: string[]; en: string[] } = {
  zh: [
    "不会替你决定价钱，或填一个你没讲过的数字",
    "不会加一颗按下去没反应的按钮",
    "不会替你挑照片 —— 它把图库开在你面前，你自己挑",
  ],
  en: [
    "Won't decide a price, or fill in a number you didn't give it",
    "Won't add a button that does nothing when pressed",
    "Won't pick your photos — it opens the picker and you choose",
  ],
};
