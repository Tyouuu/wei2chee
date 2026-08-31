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
    },
  },
};
