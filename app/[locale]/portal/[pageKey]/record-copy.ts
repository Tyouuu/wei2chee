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
};

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
    },
  },
};
