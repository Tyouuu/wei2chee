/**
 * The words on 加一单 and 改这一单.
 *
 * Kept beside the two pages rather than in the message catalogue because they
 * follow the SYSTEM language -- what the built system speaks to its users --
 * and not the portal locale, which is what Formae speaks to the owner
 * (重点 13). Two different settings, and this is the first of them.
 */
export type RecordFormCopy = {
  save: string;
  saving: string;
  cancel: string;
  required: string;
  requiredName: string;
  failed: string;
  choose: string;
  more: string;
  /* 库存的那一批不是地址跟 email，是补货线、一箱几个、编号。 */
  moreStock: string;
  less: string;
  whatsapp: string;
  phone: string;
  contactPerson: string;
  email: string;
  region: string;
  address: string;
  regNo: string;
  taxId: string;
  note: string;
  archive: string;
  archiving: string;
  unarchive: string;
  archived: string;
  reverse: string;
  reversing: string;
  reverseHint: string;
  reversed: string;
  moneyFixed: string;
  lines: string;
  lineWhat: string;
  lineQty: string;
  lineUnit: string;
  linePrice: string;
  lineAmount: string;
  lineAdd: string;
  lineRemove: string;
  lineTotal: string;
  amountFromLines: string;
  /* 库存. The quantity box exists ONLY when the item is new -- afterwards how
     much is left is the sum of the movements, so an editable box there would
     be a control that lies (the same call the money page made this morning). */
  stockWhere: string;
  stockUnit: string;
  stockOpening: string;
  stockOnHand: string;
  stockDerived: string;
  stockReorder: string;
  stockPackSize: string;
  stockPackUnit: string;
  /* 进货单收货。只在进货单上出现，而且只在它有逐项明细的时候 ——
     一张没有行的单没有东西可以进库存。 */
  receive: string;
  receiving: string;
  receiveHint: string;
  receiveDone: string;
  /* The document preview. Only on the pages that produce a piece of paper
     somebody outside the business reads; a name list and a shelf do not. */
  previewLabel: string;
  previewDate: string;
  previewNoNumber: string;
  /* 对账. Its row is a COMPARISON rather than a thing, so none of its
     boxes come from the table's columns -- see the note in the form. */
  reconPeriod: string;
  reconSource: string;
  reconTheirs: string;
  reconDirection: string;
  reconIn: string;
  reconOut: string;
  reconNet: string;
  reconReference: string;
  reconRequired: string;
  /* 预约. Two instants, who it is for, who is doing it -- none of which
     come from the table's columns. */
  bookDay: string;
  bookFrom: string;
  bookTo: string;
  bookWho: string;
  bookStaff: string;
  bookService: string;
  bookKind: string;
  bookKindBooking: string;
  bookKindBlock: string;
  bookRequired: string;
  bookTaken: string;
  /* 单据上的那个日子。同一栏 `due_on`，三种意思，所以三个字 —— 一张报价单的
     「有效期」跟一张进货单的「预计到货」不是同一句话
     （lib/portal/record-validity.ts）。 */
  validTill: string;
  deadline: string;
  expected: string;
  dateClear: string;
  pastDueValid: string;
  pastDueDeadline: string;
  pastDueExpected: string;
  /* 分期付款表。一份合约条款，不是一张明细 —— 它把同一笔钱切开，
     不会改那张单的总数（20260903020000）。 */
  terms: string;
  termWhat: string;
  termPortion: string;
  termAmount: string;
  termWhen: string;
  termAdd: string;
  termSuggest: string;
  termMismatch: string;
  /* 建议那几期的名字。key 来自 SUGGESTED_TERMS，字在这里 —— 那个档案是
     算术，不该住着两种语言的字。 */
  termDefaults: Record<string, string>;
  /* 一笔钱分摊多张单（20260903030000）。剩下的那一段是订金，不是错 ——
     所以 allocDeposit 是一句平常话，只有 allocOver 是红的。 */
  allocations: string;
  allocDocument: string;
  allocAmount: string;
  allocTerm: string;
  allocWholeDoc: string;
  allocAdd: string;
  allocOwed: string;
  allocDeposit: string;
  allocOver: string;
  allocNoDocs: string;
  /* 单据那一边：这张单收到多少、还欠多少。 */
  received: string;
  stillOwed: string;
  settledAll: string;
  nothingReceived: string;
};

/* 🔴 这个物件里一个函式都不可以有。
 *
 * `copy.form` 是从伺服器那一棵树传给浏览器那个表单的，而函式过不去 ——
 * Next 会丢 "Functions cannot be passed directly to Client Components"，
 * 整页变成「Something broke here.」。
 *
 * 2026-09-03 我在这里加了一个 `daysLeft: (n) => string`（想讲「过了 12 天」，
 * 那确实比「2026-08-22」好读），tsc 干净、843 个单元测试全过、122 条真的
 * 呼叫全过 —— **打开那一页才看到它整页是坏的**（重点 7l）。
 *
 * 外面那一层的 `heading: (page) => string` 是函式没错，但那一个只在伺服器上
 * 用掉。分界就在这一行：跨过去的只能是字串。
 *
 * 要天数的时候，放一个带位置的字串（「过了 {n} 天」），在浏览器那边填。 */

type RecordCopy = {
  heading: (page: string) => string;
  lede: string;
  editHeading: (page: string) => string;
  editLede: string;
  form: RecordFormCopy;
};

/* Typed as the shape rather than `as const`: two languages of literal types
   are two different types, and the form would only accept whichever one was
   written first. */
export const RECORD_COPY: { zh: RecordCopy; en: RecordCopy } = {
  zh: {
    heading: (page: string) => `加一单 · ${page}`,
    lede: "填好按保存，它就会出现在这一页的表格里。",
    editHeading: (page: string) => `改这一单 · ${page}`,
    editLede: "改完按保存。改的是你自己的记录，不是这一页的样子。",
    form: {
      save: "保存",
      saving: "保存中…",
      cancel: "取消",
      required: "第一栏要填，不然这一单看不出是什么。",
      requiredName: "名字要填，不然这一行找不回来。",
      failed: "没有存进去",
      choose: "选一个",
      more: "还要填地址、email 这些",
      moreStock: "补货线、一箱几个、编号",
      less: "收起来",
      whatsapp: "WhatsApp 号码",
      phone: "电话",
      contactPerson: "找谁",
      email: "Email",
      region: "地区",
      address: "地址",
      regNo: "公司注册号 (SSM)",
      taxId: "税号 (TIN)",
      note: "备注",
      /* ── 三颗只在「改」那一页出现的 ────────────────────────────────
         「收起来」不是删掉：丢掉的那一单，是明年客人回头时「上次我们报多少」
         的答案。「冲正」是钱唯一的改法 —— 开一张相反的，不是把原来那张改掉，
         因为一个没有留下痕迹的更正，跟说谎分不出来。 */
      archive: "收起来",
      archiving: "收起来…",
      unarchive: "放回架上",
      archived: "这一单已经收起来了，不在名单上。",
      reverse: "开一张冲正",
      reversing: "开单中…",
      reverseHint: "钱不能改。打错了就开一张相反的，两张都留着。",
      reversed: "这一笔已经冲正过了。",
      moneyFixed: "金额、日期、对方不能改 —— 那要开一张冲正。",
      /* ── 逐项 ─────────────────────────────────────────────────────
         有明细的时候，上面那格「金额」就不再是他填的 —— 它是这几行加起来的。
         一个存不进去的框不可以给他打字（今天早上钱那一页学到的同一条）。 */
      lines: "逐项",
      lineWhat: "是什么",
      lineQty: "数量",
      lineUnit: "单位",
      linePrice: "单价",
      lineAmount: "金额",
      lineAdd: "加一行",
      lineRemove: "删掉这一行",
      lineTotal: "合计",
      amountFromLines: "有逐项的时候，上面的金额是这几行加起来的。",
      stockWhere: "位置（仓库 · 货车 · 店面）",
      stockUnit: "单位（包 · 箱 · 罐）",
      stockOpening: "现在有多少",
      stockOnHand: "现在有",
      stockDerived: "这个数字是进出加起来的，不在这里改 —— 要改就记一笔进或出。",
      stockReorder: "剩到多少要提醒我",
      stockPackSize: "一大包几个",
      stockPackUnit: "大包叫什么（箱 · 托）",
      receive: "货到了，进库存",
      receiving: "进中…",
      receiveHint: "按下去，这张单上每一行都会变成库存里的一笔进货。之后这张单的行就不能再改了。",
      receiveDone: "这张单的货已经在库存里了。要更正就去库存记一笔进或出。",
      previewLabel: "印出来的样子",
      previewDate: "日期",
      previewNoNumber: "单号要保存了才有 —— 它是系统发的，不是猜的。",
      reconPeriod: "哪一个月",
      reconSource: "谁给的总数",
      reconTheirs: "他们讲多少",
      reconDirection: "他们那个数字是什么",
      reconIn: "收进来的",
      reconOut: "付出去的",
      reconNet: "净额（收减付）",
      reconReference: "他们的单号",
      reconRequired: "要写是谁给的总数，不然这一行看不出在对什么。",
      bookDay: "哪一天",
      bookFrom: "几点开始",
      bookTo: "到几点",
      bookWho: "哪一位客人",
      bookStaff: "谁做",
      bookService: "做什么",
      bookKind: "这一格是",
      bookKindBooking: "客人的预约",
      bookKindBlock: "不接单（休息、请假）",
      bookRequired: "要写是哪一位客人。不接单的时段不用写。",
      bookTaken: "那个时段已经有人了。",
      validTill: "有效期到",
      deadline: "期限",
      expected: "预计到货",
      dateClear: "不设日期",
      pastDueValid: "过期",
      pastDueDeadline: "逾期",
      pastDueExpected: "还没到",
      terms: "分期付款",
      termWhat: "这一期是什么",
      termPortion: "%",
      termAmount: "或写死金额",
      termWhen: "什么时候",
      termAdd: "加一期",
      termSuggest: "照这一行的惯例填",
      termMismatch: "这几期加起来跟单上的总数差",
      termDefaults: { deposit: "订金", start: "动工", done: "完工" },
      allocations: "这笔钱付了哪几张单",
      allocDocument: "选一张单",
      allocAmount: "分多少",
      allocTerm: "哪一期",
      allocWholeDoc: "整张单，不指定哪一期",
      allocAdd: "再分一张",
      allocOwed: "这张单还欠",
      allocDeposit: "还没分摊，先当订金：",
      allocOver: "分超过这笔钱了，多出",
      allocNoDocs: "现在没有还没收齐的单可以分。这笔钱先当订金放着就好。",
      received: "已收",
      stillOwed: "还欠",
      settledAll: "收齐了",
      nothingReceived: "还没收到钱",
    },
  },
  en: {
    heading: (page: string) => `New entry · ${page}`,
    lede: "Fill this in and save. It appears in the table on this page.",
    editHeading: (page: string) => `Edit · ${page}`,
    editLede: "Save when you are done. This changes your record, not the page.",
    form: {
      save: "Save",
      saving: "Saving…",
      cancel: "Cancel",
      required: "The first field is what this entry is about — it cannot be blank.",
      requiredName: "A name is what makes this findable again — it cannot be blank.",
      failed: "Not saved",
      choose: "Choose one",
      more: "Address, email and the rest",
      moreStock: "Reorder level, pack size, code",
      less: "Hide these",
      whatsapp: "WhatsApp",
      phone: "Phone",
      contactPerson: "Ask for",
      email: "Email",
      region: "Area",
      address: "Address",
      regNo: "Company no. (SSM)",
      taxId: "Tax ID (TIN)",
      note: "Notes",
      archive: "Put away",
      archiving: "Putting away…",
      unarchive: "Back on the shelf",
      archived: "This one is put away and is not on the list.",
      reverse: "Write a reversal",
      reversing: "Writing…",
      reverseHint: "Money is not edited. Write the opposite entry and keep both.",
      reversed: "This entry has already been reversed.",
      moneyFixed: "The amount, the date and who it is with cannot be edited — write a reversal.",
      lines: "Line items",
      lineWhat: "What it is",
      lineQty: "Qty",
      lineUnit: "Unit",
      linePrice: "Unit price",
      lineAmount: "Amount",
      lineAdd: "Add a line",
      lineRemove: "Remove this line",
      lineTotal: "Total",
      amountFromLines: "With line items, the amount above is their total.",
      stockWhere: "Where (store · van · shopfront)",
      stockUnit: "Unit (bag · box · can)",
      stockOpening: "How many now",
      stockOnHand: "On hand",
      stockDerived: "This number is the ins and outs added up. Change it by recording a movement, not here.",
      stockReorder: "Tell me when it drops to",
      stockPackSize: "How many in a pack",
      stockPackUnit: "Pack is called (box · pallet)",
      receive: "The goods came in",
      receiving: "Adding…",
      receiveHint: "Every line on this order becomes one stock movement. After that its lines cannot be changed.",
      receiveDone: "The goods on this order are already in your stock. Correct it with a stock movement.",
      previewLabel: "As it prints",
      previewDate: "Date",
      previewNoNumber: "The number is issued when you save — it is not guessed.",
      reconPeriod: "Which month",
      reconSource: "Who gave the figure",
      reconTheirs: "What they say",
      reconDirection: "What their figure is",
      reconIn: "Money in",
      reconOut: "Money out",
      reconNet: "Net (in minus out)",
      reconReference: "Their reference",
      reconRequired: "Say who gave the figure — without it the row is not about anything.",
      bookDay: "Which day",
      bookFrom: "From",
      bookTo: "Until",
      bookWho: "Which customer",
      bookStaff: "Who is doing it",
      bookService: "What for",
      bookKind: "This slot is",
      bookKindBooking: "A customer's booking",
      bookKindBlock: "Not taking bookings (break, leave)",
      bookRequired: "Say which customer. Time off does not need one.",
      bookTaken: "That time is already taken.",
      validTill: "Valid until",
      deadline: "Due",
      expected: "Expected",
      dateClear: "No date",
      pastDueValid: "Expired",
      pastDueDeadline: "Overdue",
      pastDueExpected: "Not arrived",
      terms: "Payment schedule",
      termWhat: "What this stage is",
      termPortion: "%",
      termAmount: "or a set amount",
      termWhen: "When",
      termAdd: "Add a stage",
      termSuggest: "Use the usual split for this trade",
      termMismatch: "These stages do not add up to the document total — off by",
      termDefaults: { deposit: "Deposit", start: "On start", done: "On completion" },
      allocations: "What this money paid for",
      allocDocument: "Pick a document",
      allocAmount: "How much",
      allocTerm: "Which stage",
      allocWholeDoc: "The whole document",
      allocAdd: "Add another document",
      allocOwed: "Still owed on it",
      allocDeposit: "Not applied yet — held as a deposit:",
      allocOver: "That is more than this payment, by",
      allocNoDocs: "Nothing outstanding to apply this to. It stays a deposit.",
      received: "Received",
      stillOwed: "Still owed",
      settledAll: "Paid in full",
      nothingReceived: "Nothing received yet",
    },
  },
};
