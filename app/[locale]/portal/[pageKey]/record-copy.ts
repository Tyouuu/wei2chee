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
  /** 「照上次那一张」—— 只在整张明细还空着的时候画（[任务 150]） */
  lineUseLast: string;
  /** 只在他真的有货架的时候画 —— 不然那是一句假话 */
  lineShelfHint: string;
  /** 月结对帐单（[任务 147]）。只在客户那一页、而且只给看得到钱的人 */
  statementHeading: string;
  statementMonth: string;
  statementOn: string;
  statementWhat: string;
  statementCharge: string;
  statementPaid: string;
  statementRunning: string;
  statementOpening: string;
  statementClosing: string;
  statementQuiet: string;
  statementUnread: string;
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
  /** 那张纸上单号那一格的抬头。见 new/document-preview.tsx。 */
  previewNumber: string;
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
  /* 一个客户不只一个地址（20260903060000）。标签是他自己的词，
     不是一个固定选单 —— 跟 stage 跟 status 同一条。 */
  addresses: string;
  addrLabel: string;
  addrLine: string;
  addrRegion: string;
  addrBilling: string;
  addrAdd: string;
  /* 那张单是哪一个工地的。 */
  site: string;
  sitePick: string;
  siteNone: string;
  /* 这个客户的单子。 */
  theirJobs: string;
  theirOwing: string;
  noJobsYet: string;
  /* 工地的照片（20260904010000）。私人的桶，签名的网址 —— 那是他客户家里。 */
  photos: string;
  photoAdd: string;
  photoAdding: string;
  photoCaption: string;
  photoRemove: string;
  photoNone: string;
  photoOnlySaved: string;
  photoTooBig: string;
  /* 谁改了什么（20260904020000）。只画给看得到钱的人 ——
     `rows` 是 null 的意思是「没有问」，不是「没有改过」。 */
  changes: string;
  changesNone: string;
  changeBlank: string;
  /* 把旧的那份 Excel 贴进来（20260904040000）。
     ⚠️ 全部是字串，一个函式都没有 —— 这个物件是从伺服器传给浏览器的，
     而函式过不去（那一句写在这个档案上面，而它是用一个 500 换来的）。
     带数字的那几句用 {n}，画面那一层自己换掉。 */
  importHeaders: string;
  importCopyHeaders: string;
  importPaste: string;
  importPastePlaceholder: string;
  importReadAs: string;
  importUnmatched: string;
  importNoHeaders: string;
  importMoreRows: string;
  importCta: string;
  importRunning: string;
  importDone: string;
  importFailed: string;
  importRowNo: string;
  importLede: string;
  importHeading: string;
  /* 盘点（20260904050000）。差多少是资料库算的，这里只画。 */
  countHeading: string;
  countLede: string;
  countLabel: string;
  countCta: string;
  countRunning: string;
  countSame: string;
  countDiff: string;
  /* 一箱 24 罐（lib/portal/pack-units.ts）。底下存的永远是最小那个单位。 */
  packHowMany: string;
  packLoose: string;
  packThatIs: string;
  /* 并排的时候用的短字。完整那一句留给 aria-label。 */
  packShort: string;
  packLooseShort: string;
  /* 他欠多少、欠多久、额度（20260904060000）。
     ⚠️ 额度是**一句话，不是一道门** —— 超过了照样开得了单。 */
  creditLimit: string;
  owesAlready: string;
  owesDays: string;
  overLimit: string;
  /* 这个客人来过几次、一共多少、上次什么时候。
     ⚠️ **没有积分、没有等级** —— 那是一套他还没有决定的方案，
     而替他发明一套，就是在他的系统里宣布一件他没有讲过的事。 */
  historyHeading: string;
  historyVisits: string;
  historySpent: string;
  historyLast: string;
  historyNone: string;
  /* 哪一间店（20260904100000）。两间以上才出现。 */
  branch: string;
  branchAny: string;
  /* 那笔钱是谁做的，跟他的抽成（20260904120000）。
     ⚠️ 没有师傅的时候一个字都不出现 —— 一人公司占我们客户的大多数。 */
  doneBy: string;
  doneByNone: string;
  /* 这笔钱是干什么的，跟它属於哪一单。 */
  category: string;
  categoryHint: string;
  forJob: string;
  forJobNone: string;
  forJobWhy: string;
  /* 这一单赚多少。 */
  jobSpent: string;
  jobEarned: string;
  jobNoCosts: string;
  jobNoCategory: string;
  jobKeptSoFar: string;
  tiersHeading: string;
  tiersLede: string;
  tiersFrom: string;
  tiersPercent: string;
  tiersAdd: string;
  tiersRemove: string;
  tiersNone: string;
  tiersFirst: string;
  tiersThen: string;
  tiersOnwards: string;
  tiersJoin: string;
  tiersDuplicate: string;
  tiersSaved: string;
  tiersTooMany: string;
  tiersBadPercent: string;
  earnedCommission: string;
  earnedNone: string;
  earnedNotPaid: string;
  earnedDerived: string;
  /* 佣金率的世代（20260905640000）。**这三句一定要画出来**，
     不然他把 2% 改成 3%、按了保存，而这个月那个数字一分都不动 ——
     读起来像功能坏了，而它正是这一整件事在保护的东西。 */
  rateInForce: string;
  rateYoursNow: string;
  rateFromLabel: string;
  rateStartsNext: string;
  rateHistory: string;
  /* 他是自己人还是下游（20260905720000）。**只有下游才讲** ——
     一个员工旁边写「他是员工」是杂讯。 */
  rateKindDownstream: string;
  /* 对完帐，把那个月关起来（20260902020000 + 20260905740000）。
     🔴 关起来之后什么改不了，一定要在他按下去之前讲 —— 那是四个洞里
     唯一一个「收紧」，而收紧会挡到每一条写入路径，
     画面上只看得到「存不了」。 */
  settleHeading: string;
  settleLede: string;
  settleClose: string;
  settleClosed: string;
  settleReopen: string;
  /* 一条发给这个经销商的连结，跟他送进来的那几笔（20260905680000）。 */
  portalHeading: string;
  portalLede: string;
  portalOpen: string;
  portalLink: string;
  portalCopy: string;
  portalCopied: string;
  portalClose: string;
  portalInbox: string;
  portalInboxNone: string;
  portalTurn: string;
  portalDrop: string;
  portalDone: string;
  portalDropped: string;
  portalNowhere: string;
  /* 一条发给客人的连结，跟他答了什么（20260905230000 · 510000）。 */
  shareHeading: string;
  shareLede: string;
  shareOpen: string;
  shareLink: string;
  shareCopy: string;
  shareCopied: string;
  shareStop: string;
  shareNoAnswer: string;
  shareAccepted: string;
  shareChanges: string;
  shareStageHint: string;
  /* 送出去了几趟（20260905500000）。 */
  runHeading: string;
  runLede: string;
  runNone: string;
  runOpen: string;
  runSend: string;
  runHandover: string;
  runSendHint: string;
  runHandoverHint: string;
  runDriver: string;
  runReceivedBy: string;
  runNoGoods: string;
  runSigned: string;
  runNotSigned: string;
  runTakeBack: string;
  runStillOwed: string;
  /* 谁欠我钱那一页的入口（20260905140000）。 */
  owingLink: string;
  /* 套票（20260904190000）。只在客户那一页，而且**师傅也看得到** ——
     他要跟客人讲「你还剩三次」。价钱不在这张表上，所以这不是把钱交出去。 */
  packHeading: string;
  packLede: string;
  packNone: string;
  packLeft: string;
  packUsedUp: string;
  packExpired: string;
  packExpiresOn: string;
  packSoldOn: string;
  packUse: string;
  packUsing: string;
  packUndo: string;
  packPutAway: string;
  packName: string;
  packSessions: string;
  packExpiry: string;
  packSell: string;
  packSelling: string;
  /* 预付余额（20260903030000 算得出来，到 2026-09-04 才有落点）。
     ⚠️ 这是**钱**，只有老板；套票是**次数**，师傅也看得到。两个不同的东西。 */
  creditHeading: string;
  creditLede: string;
  creditNone: string;
  creditFrom: string;
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
      lineUseLast: "照上次那一张",
      lineShelfHint: "在「是什么」打前几个字，你自己的货会出来。",
      statementHeading: "月结对帐单",
      statementMonth: "哪一个月",
      statementOn: "日期",
      statementWhat: "是什么",
      statementCharge: "应收",
      statementPaid: "已付",
      statementRunning: "结余",
      statementOpening: "期初",
      statementClosing: "期末余额",
      statementQuiet: "这个月没有来往。",
      statementUnread: "这一段读不到。",
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
      previewNumber: "单号",
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
      addresses: "地址",
      addrLabel: "叫它什么（工地 · 帐单）",
      addrLine: "地址",
      addrRegion: "区域",
      addrBilling: "帐单寄这里",
      addrAdd: "加一个地址",
      site: "哪一个工地",
      sitePick: "整个客户，不指定工地",
      siteNone: "这个客户还没有第二个地址",
      theirJobs: "他的单子",
      theirOwing: "他还欠",
      noJobsYet: "还没有单子",
      photos: "工地的照片",
      photoAdd: "拍一张 / 传一张",
      photoAdding: "在传…",
      photoCaption: "这一张是什么（可以不写）",
      photoRemove: "删掉这一张",
      photoNone: "这一单还没有照片。",
      photoOnlySaved: "存好这一单，才挂得上照片。",
      photoTooBig: "这张太大了，换一张小一点的",
      changes: "改过什么",
      changesNone: "还没有人改过这一单。",
      changeBlank: "空白",
      importHeading: "把旧的资料搬进来",
      importLede: "从 Excel 圈起来、复製，贴到下面。第一行要是栏名。",
      importHeaders: "第一行要写这几个（顺序随便，少写几个也可以）",
      importCopyHeaders: "复製这一行",
      importPaste: "贴在这里",
      importPastePlaceholder: "从 Excel 复製之后贴上来…",
      importReadAs: "读到 {n} 行。下面是前几行，看看每一栏有没有对：",
      importUnmatched: "这几栏我们认不出来，不会进去：",
      importNoHeaders: "一栏都认不出来 —— 第一行是不是栏名？",
      importMoreRows: "还有 {n} 行没有列出来。",
      importCta: "汇入",
      importRunning: "在汇入…",
      importDone: "进去了 {n} 行。",
      importFailed: "有 {n} 行没进去：",
      importRowNo: "第 {n} 行",
      countHeading: "盘点",
      countLede: "站在架子前面数一次，打进去就好。差多少我们自己算，记成一笔。",
      countLabel: "架上现在有几个",
      countCta: "记下来",
      countRunning: "在记…",
      countSame: "跟系统一样，不用记。",
      countDiff: "会记一笔：{n}",
      packHowMany: "几箱",
      packLoose: "另外几个",
      packThatIs: "也就是",
      packShort: "几箱",
      packLooseShort: "另外几个",
      creditLimit: "最多让他欠多少（可以不填）",
      owesAlready: "他已经欠",
      owesDays: "最老的一笔 {n} 天",
      overLimit: "超过你写的额度",
      historyHeading: "他来过几次",
      historyVisits: "{n} 次",
      historySpent: "一共",
      historyLast: "上一次",
      historyNone: "还没有来过。",
      branch: "哪一间店",
      branchAny: "不分店",
      doneBy: "谁做的",
      doneByNone: "没有指定",
      category: "这笔钱是干什么的",
      /* ⚠️ 提示里那几个词是**例子**，不是预设 —— 打进框里的是他自己的词。
         给一份固定清单，等於逼每一门生意走同一份科目表。 */
      categoryHint: "材料 · 工钱 · 车油 · 租金",
      forJob: "这笔算在哪一单上",
      forJobNone: "不算在任何一单上",
      forJobWhy: "填了，那一单才算得出赚多少。",
      jobSpent: "这一单花掉",
      /* ⚠️ 「赚」不是「毛利」也不是「净利」-- 那两个是有会计定义的词，
         而我们算的是「收到的减挂在它身上的开销」。用日常的字。 */
      jobEarned: "这一单赚",
      jobNoCosts: "还没有开销挂在这一单上，所以算不出它赚多少。在开销那一页记一笔，选这一单。",
      jobNoCategory: "没写类别",
      /* 🔴 看图才看到的：「This job kept RM 6,550」就写在
         「Still owed RM 33,950」底下，而那一行是加粗的、人真正会读的那一行。
         一个承包商看到一张 RM 48,500 的单写着「赚 RM 6,550」，
         会以为这一单几乎没赚 —— 而实际上他只收了三成。 */
      jobKeptSoFar: "这一单还没收齐，所以这是到目前为止的。",
      tiersHeading: "他的抽成",
      tiersLede: "分段算：头一段一个比例，超过的那一段另一个。",
      tiersFrom: "从",
      tiersPercent: "抽 %",
      tiersAdd: "加一档",
      tiersRemove: "拿掉",
      tiersNone: "还没有写抽成，所以他的佣金是零。",
      tiersFirst: "头 {amount} 抽 {percent}",
      tiersThen: "全部抽 {percent}",
      tiersOnwards: "{amount} 以上抽 {percent}",
      tiersJoin: " · ",
      tiersDuplicate: "两档不可以从同一个数字开始。",
      tiersSaved: "存好了",
      tiersTooMany: "最多六档 —— 再多没有人算得清楚自己在第几档。",
      tiersBadPercent: "比例要在 0 到 100 之间。",
      earnedCommission: "这个月的抽成",
      earnedNone: "这个月还没有算在他名下的收款，所以是零。",
      earnedNotPaid: "这只是算给你看的。要付出去，去开销那一页记一笔。",
      earnedDerived: "这一格是收款那边算出来的，改不了。",
      rateInForce: "这个月照 {date} 那一份算。",
      rateYoursNow: "你现在打的这一份算出来是 {amount}。",
      rateFromLabel: "从哪天起",
      rateStartsNext: "现在存，下个月才算。要这个月就算，把日子写成这个月一号。",
      rateHistory: "以前的",
      rateKindDownstream: "下游经销商 —— 不是你的员工。",
      settleHeading: "对完了没有",
      settleLede: "对完了就把这个月关起来。关了之后，这个月这一边的钱改不了 —— 要改就重开、改完再关。",
      settleClose: "把这个月关起来",
      settleClosed: "{date} 关起来了。这个月这一边的钱改不了 —— 要改，先重开这个月。",
      settleReopen: "重开这个月",
      portalHeading: "他自己那条连结",
      portalLede: "发一条连结给他，他就自己讲得出「我要什么」，不用你照他的讯息重打一次。他看得到的只有你的公司名跟他自己送过的那几笔。",
      portalOpen: "开一条连结给他",
      portalLink: "他那条连结",
      portalCopy: "复制",
      portalCopied: "复制好了 —— 贴进 WhatsApp 发给他",
      portalClose: "关掉这条连结",
      portalInbox: "他送进来的",
      portalInboxNone: "他还没有送过东西。",
      portalTurn: "开成一张{page}",
      portalDrop: "丢掉",
      portalDone: "已经开单了 {doc}",
      portalDropped: "丢掉了",
      portalNowhere: "这个系统里还没有一页可以放单。",
      shareHeading: "发给客人看",
      shareLede: "一条连结，他自己在手机上打得开：看得到这一张、按得了同意、也讲得出想改哪里。他看不到你的成本，也看不到他的其他单。",
      shareOpen: "开一条连结给客人",
      shareLink: "客人那条连结",
      shareCopy: "复制",
      shareCopied: "复制好了 —— 贴进 WhatsApp 发给他",
      shareStop: "收回这条连结",
      shareNoAnswer: "他还没有答。",
      shareAccepted: "{name} 在 {date} 按了同意。",
      shareChanges: "{name} 在 {date} 讲了想改的地方。",
      shareStageHint: "这一单走到哪还是你自己决定 —— 他按同意不会把它搬走。",
      runHeading: "送出去了几趟",
      runLede: "一张单可以分几车出。送出去的时候架上自己会少，而客人在他自己那条连结上签收。",
      runNone: "还没有送过。",
      runOpen: "开一趟",
      runSend: "送出去",
      runHandover: "交了",
      runSendHint: "按下去，上面还欠的那几行会照数量出货，架上跟着少。",
      runHandoverHint: "这一单没有货要出，所以这一趟只记「交了」—— 装修交屋、服务做完就是这样。",
      runDriver: "谁去送",
      runReceivedBy: "谁收的",
      runNoGoods: "没有货，只是交了",
      runSigned: "{name} 在 {date} 自己签了",
      runNotSigned: "他还没有自己签",
      runTakeBack: "收起这一趟",
      runStillOwed: "还欠",
      owingLink: "谁欠我钱",
      packHeading: "套票",
      packLede: "卖几次，用一次扣一次。剩几次是数出来的，没有人改得了。",
      packNone: "还没有卖过套票给他。",
      packLeft: "还剩 {n} 次",
      packUsedUp: "用完了",
      packExpired: "过期了",
      packExpiresOn: "到期",
      packSoldOn: "卖出",
      packUse: "用掉一次",
      packUsing: "记着…",
      packUndo: "退回上一次",
      packPutAway: "收起来",
      packName: "叫什么（10 次洗剪吹）",
      packSessions: "几次",
      packExpiry: "到期（可以不填）",
      packSell: "卖一张",
      packSelling: "开着…",
      creditHeading: "他先付了、还没用掉的钱",
      creditLede: "已经收到、还没有分摊给任何一张单的部分。下一张单开出来就可以扣它。",
      creditNone: "没有 —— 他付过的钱都分摊掉了。",
      creditFrom: "来自",
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
      lineUseLast: "Same as last time",
      lineShelfHint: "Start typing in What it is — your own items come up.",
      statementHeading: "Monthly statement",
      statementMonth: "Which month",
      statementOn: "Date",
      statementWhat: "What it is",
      statementCharge: "Charged",
      statementPaid: "Paid",
      statementRunning: "Balance",
      statementOpening: "Brought forward",
      statementClosing: "Closing balance",
      statementQuiet: "Nothing happened this month.",
      statementUnread: "This part could not be read.",
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
      previewNumber: "No.",
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
      addresses: "Addresses",
      addrLabel: "Call it (Site · Billing)",
      addrLine: "Address",
      addrRegion: "Area",
      addrBilling: "Send the paperwork here",
      addrAdd: "Add an address",
      site: "Which site",
      sitePick: "The customer, no particular site",
      siteNone: "This customer has only one address",
      theirJobs: "Their jobs",
      theirOwing: "They still owe",
      noJobsYet: "No jobs yet",
      photos: "Photos on this job",
      photoAdd: "Take or upload a photo",
      photoAdding: "Uploading…",
      photoCaption: "What this shows (optional)",
      photoRemove: "Remove this photo",
      photoNone: "No photos on this job yet.",
      photoOnlySaved: "Save this job first, then photos can be attached.",
      photoTooBig: "That photo is too large — try a smaller one",
      changes: "What was changed",
      changesNone: "Nobody has changed this one yet.",
      changeBlank: "blank",
      importHeading: "Bring the old records in",
      importLede: "Select it in Excel, copy, and paste below. The first row must be the column names.",
      importHeaders: "The first row should have these (any order, and you can leave some out)",
      importCopyHeaders: "Copy this row",
      importPaste: "Paste here",
      importPastePlaceholder: "Copy from Excel and paste it here…",
      importReadAs: "Read {n} rows. Here are the first few — check every column landed where it should:",
      importUnmatched: "These columns were not recognised and will not be brought in:",
      importNoHeaders: "Nothing was recognised — is the first row the column names?",
      importMoreRows: "{n} more rows not shown.",
      importCta: "Bring them in",
      importRunning: "Bringing them in…",
      importDone: "{n} rows are in.",
      importFailed: "{n} rows did not go in:",
      importRowNo: "Row {n}",
      countHeading: "Stocktake",
      countLede: "Count the shelf and type what is there. We work out the difference and record it.",
      countLabel: "How many are on the shelf now",
      countCta: "Record it",
      countRunning: "Recording…",
      countSame: "Same as the system — nothing to record.",
      countDiff: "This will record: {n}",
      packHowMany: "How many packs",
      packLoose: "And how many loose",
      packThatIs: "that is",
      packShort: "Packs",
      packLooseShort: "Loose",
      creditLimit: "Credit limit (optional)",
      owesAlready: "Already owes",
      owesDays: "oldest is {n} days",
      overLimit: "over the limit you set",
      historyHeading: "How often they come",
      historyVisits: "{n} times",
      historySpent: "worth",
      historyLast: "last one",
      historyNone: "Nothing yet.",
      branch: "Which branch",
      branchAny: "No particular branch",
      doneBy: "Who did it",
      doneByNone: "Nobody in particular",
      category: "What this was for",
      categoryHint: "Materials · Labour · Fuel · Rent",
      forJob: "Which job this belongs to",
      forJobNone: "Not against a job",
      forJobWhy: "Fill this in and that job can say what it made.",
      jobSpent: "Spent on this job",
      jobEarned: "This job kept",
      jobNoCosts: "No expenses are filed against this job yet, so it cannot say what it made. Record one on the expenses page and pick this job.",
      jobNoCategory: "Not categorised",
      jobKeptSoFar: "This job is not fully paid yet, so this is what it has kept so far.",
      tiersHeading: "Their commission",
      tiersLede: "Band by band: one rate up to a figure, another above it.",
      tiersFrom: "From",
      tiersPercent: "Rate %",
      tiersAdd: "Add a band",
      tiersRemove: "Remove",
      tiersNone: "No bands yet, so their commission is nil.",
      tiersFirst: "first {amount} at {percent}",
      tiersThen: "{percent} on everything",
      tiersOnwards: "{amount} and above at {percent}",
      tiersJoin: " · ",
      tiersDuplicate: "Two bands cannot start at the same figure.",
      tiersSaved: "Saved",
      tiersTooMany: "Six bands at most. Past that, nobody can follow which one they are in.",
      tiersBadPercent: "The rate has to be between 0 and 100.",
      earnedCommission: "Commission this month",
      earnedNone: "Nil. No money is credited to them this month.",
      earnedNotPaid: "This is worked out for you, not paid. Record it on the expenses page when you pay it.",
      earnedDerived: "Worked out from the payments credited to them. Not typed.",
      rateInForce: "This month is worked out on the rates set from {date}.",
      rateYoursNow: "The bands you have typed would come to {amount}.",
      rateFromLabel: "In force from",
      rateStartsNext: "Saved today, this starts next month. To change this month, set the date to the 1st.",
      rateHistory: "Earlier",
      rateKindDownstream: "A downstream dealer -- not on your payroll.",
      settleHeading: "Signed off",
      settleLede: "Close the month once it agrees. After that, money on this side of the month cannot change -- reopen it, correct it, close it again.",
      settleClose: "Close this month",
      settleClosed: "Closed on {date}. Money on this side of the month cannot change -- reopen it first.",
      settleReopen: "Reopen this month",
      portalHeading: "Their own link",
      portalLede: "Send them a link and they say what they need themselves, instead of you retyping their message. All they see is your business name and what they have sent.",
      portalOpen: "Open a link for them",
      portalLink: "Their link",
      portalCopy: "Copy",
      portalCopied: "Copied -- paste it to them on WhatsApp",
      portalClose: "Close this link",
      portalInbox: "What they have sent",
      portalInboxNone: "They have not sent anything yet.",
      portalTurn: "Open it as {page}",
      portalDrop: "Drop",
      portalDone: "Already opened as {doc}",
      portalDropped: "Dropped",
      portalNowhere: "There is no page in this system that can hold an order yet.",
      shareHeading: "Send it to the customer",
      shareLede: "One link he opens on his own phone: he reads this one, accepts it, or says what he wants changed. He cannot see your costs, and he cannot see his other jobs.",
      shareOpen: "Open a link for the customer",
      shareLink: "The customer's link",
      shareCopy: "Copy",
      shareCopied: "Copied -- paste it to him on WhatsApp",
      shareStop: "Take the link back",
      shareNoAnswer: "He has not answered yet.",
      shareAccepted: "{name} accepted on {date}.",
      shareChanges: "{name} asked for a change on {date}.",
      shareStageHint: "Where this job sits is still your call -- his accepting does not move it.",
      runHeading: "Deliveries",
      runLede: "One job can go out on several lorries. What goes out comes off the shelf, and the customer signs on his own link.",
      runNone: "Nothing has gone out yet.",
      runOpen: "Open a run",
      runSend: "Send it out",
      runHandover: "Handed over",
      runSendHint: "This sends what is still owed above, and the shelf drops by the same amount.",
      runHandoverHint: "Nothing on this job comes off a shelf, so this run just records the handover -- a refit finished, a service done.",
      runDriver: "Who took it",
      runReceivedBy: "Who received it",
      runNoGoods: "no goods, handed over",
      runSigned: "{name} signed for it on {date}",
      runNotSigned: "He has not signed for it himself",
      runTakeBack: "Put this run away",
      runStillOwed: "Still owed",
      owingLink: "Who owes me",
      packHeading: "Packages",
      packLede: "Sold as a number of sessions. One visit, one off the count -- and the count is worked out, not typed.",
      packNone: "No package sold to them yet.",
      packLeft: "{n} left",
      packUsedUp: "Used up",
      packExpired: "Expired",
      packExpiresOn: "Expires",
      packSoldOn: "Sold",
      packUse: "Use one",
      packUsing: "Recording...",
      packUndo: "Undo the last one",
      packPutAway: "Put away",
      packName: "What it is (10 wash and blow)",
      packSessions: "Sessions",
      packExpiry: "Expires (optional)",
      packSell: "Sell one",
      packSelling: "Opening...",
      creditHeading: "Paid, not yet used",
      creditLede: "Money received and not yet put against any document. The next one you raise can draw on it.",
      creditNone: "None -- everything they have paid is accounted for.",
      creditFrom: "From",
    },
  },
};
