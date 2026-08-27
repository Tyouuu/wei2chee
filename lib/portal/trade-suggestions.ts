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

/** The three chips for this owner, in the language the editor is speaking. */
export function suggestionsFor(trade: string | null | undefined, locale: string): string[] {
  const set = TRADE_SUGGESTIONS[trade ?? "other"] ?? TRADE_SUGGESTIONS.other;
  return locale.startsWith("zh") ? set.zh : set.en;
}
