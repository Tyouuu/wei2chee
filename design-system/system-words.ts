import type { SystemLang } from "@/lib/system-lang";

/**
 * The words the COMPONENTS own, as opposed to the words a page is built from.
 *
 * lib/templates/copy/ holds everything the template builder writes: page
 * headings, column headings, sample rows. This file holds the rest -- the
 * strings a component falls back to when nothing was passed in, plus the ones
 * it never exposes as props at all: month names in a date picker, "No results",
 * the aria-label on a close button.
 *
 * They were 61 Chinese literals scattered across twenty component files, which
 * meant a system switched to English still said 「选择月份…」 the moment anyone
 * opened a picker -- and the switch had no way to reach them, because a default
 * parameter cannot read a React context.
 *
 * WHY THE TWO FILES STAY SEPARATE. Template copy is chosen per business and
 * per trade; component copy is the same in every system ever built. Merging
 * them would put "No results" in a table that also decides what a renovation
 * contractor calls their customers.
 */
export type SystemWords = {
  months: string[];
  monthsShort: string[];
  weekdays: string[];
  pickDate: string;
  pickMonth: string;
  pickOne: string;
  search: string;
  noResults: string;
  filteredBy: string;
  clearAll: string;
  prevMonth: string;
  nextMonth: string;
  prevYear: string;
  nextYear: string;
  close: string;
  openMenu: string;
  closeMenu: string;
  notifications: string;
  account: string;
  topNav: string;
  sideNav: string;
  /** Carries its own brackets, because the brackets are part of the language:
   *  an English page set 「（optional）」 in fullwidth CJK parentheses, which is
   *  the kind of half-translation that reads as a machine wrote the page. */
  optional: string;
  uploadPrompt: string;
  dropPrompt: string;
  atMost: (n: number) => string;
  findTag: string;
  photo: string;
  trend: string;
  value: string;
  view: string;
  operationsSystem: string;
  /** The tooltip on a rail item that is real in the finished system but inert
   *  in the preview. Named because it is the one place the product admits, in
   *  the customer's own system, that this is a preview. */
  notYetLive: (feature?: string) => string;
  /** The row count beside a table's heading: 「共 21 条」 / "21 records". The
   *  table's caption used to be an aria-label only -- invisible on screen --
   *  so every table in every register shipped with no heading and no count
   *  while all eleven competitors photographed on 2026-08-25 carry both. */
  /** What the 官网 enquiry form says after the button is pressed. Four
   *  outcomes, all of them things a stranger on a phone has to read. */
  sent: string;
  sendIncomplete: string;
  sendTooMany: string;
  sendFailed: string;
  /** The form is real but this is not the published page, so nothing was
   *  sent. Said out loud rather than faked -- a preview that pretends to
   *  accept an enquiry is the worst thing this product could ship. */
  sendPreviewOnly: string;
  rowCount: (n: number) => string;
  /** The filter segments above a table. Only the first is active in a preview;
   *  the finished system wires them to real queries. */
  filterAll: string;
  /** 表格自己那个搜索框的提示字。只有 `search` 那一档的表格会画它。 */
  tableSearch: string;
  /** 筛到一行都不剩的时候说的话。**空白的表格不会讲话** —— 而一个刚打完字的人
   *  分不出「找不到」跟「坏了」。 */
  tableNoMatch: (q: string) => string;
  empty: string;
  emptyToday: string;
  emptyPeople: string;
  start: string;
  finish: string;
  notStarted: string;
  inProgress: string;
  done: string;
  progress: string;
  choose: string;
  mostPopular: string;
  included: string;
  notIncluded: string;
  free: string;
  up: string;
  down: string;
  showMore: string;
  showLess: string;
  reference: string;
  attendance: string;
  less: string;
  more: string;
  /** The enquiry form on 官网 -- the only component whose defaults a STRANGER
   *  reads, which is why they are here in full rather than left to the page. */
  enquiry: {
    submit: string;
    auto: string;
    /** "Send this and your system opens a {record} — nobody retypes it." */
    arrow: (record: string) => [string, string];
    name: { label: string; placeholder: string };
    phone: { label: string; placeholder: string };
    detail: { label: string; placeholder: string };
  };
};

const EN: SystemWords = {
  months: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  monthsShort: [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ],
  weekdays: ["S", "M", "T", "W", "T", "F", "S"],
  pickDate: "Pick a date",
  pickMonth: "Pick a month",
  pickOne: "Choose…",
  search: "Search…",
  noResults: "Nothing found.",
  filteredBy: "Filtered by",
  clearAll: "Clear all",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  prevYear: "Previous year",
  nextYear: "Next year",
  close: "Close",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  notifications: "Notifications",
  account: "Account settings",
  topNav: "Top navigation",
  sideNav: "Side navigation",
  optional: "(optional)",
  uploadPrompt: "Click to upload a file or photo",
  dropPrompt: "Drop photos here, or click to choose",
  atMost: (n) => `Up to ${n}`,
  findTag: "Find a tag…",
  photo: "Photo",
  trend: "Trend",
  value: "Value",
  view: "Open →",
  operationsSystem: "Operations",
  notYetLive: (feature) =>
    feature
      ? `${feature} — part of your system. It switches on once the system is built.`
      : "Part of your system. It switches on once the system is built.",
  sent: "Got it — we will come back to you.",
  sendIncomplete: "A name and a way to reach you, please.",
  sendTooMany: "A lot has come in just now. Try again in a minute.",
  sendFailed: "That did not go through. Try again, or message us directly.",
  sendPreviewOnly: "This is the preview — nothing was sent. On your live site it becomes a row in your system.",
  rowCount: (n) => `${n} record${n === 1 ? "" : "s"}`,
  filterAll: "All",
  tableSearch: "Filter these rows…",
  tableNoMatch: (q) => `No rows match “${q}”.`,
  empty: "Nothing here yet",
  emptyToday: "Nothing booked today",
  emptyPeople: "Nobody added yet",
  start: "Start",
  finish: "Finish",
  notStarted: "Not started",
  inProgress: "In progress",
  done: "Done",
  progress: "Progress",
  choose: "Choose this",
  mostPopular: "Most chosen",
  included: "Included",
  notIncluded: "Not included",
  free: "Free",
  up: "Up",
  down: "Down",
  showMore: "Show all",
  showLess: "Show less",
  reference: "Reference",
  attendance: "Attendance this year",
  less: "Less",
  more: "More",
  enquiry: {
    submit: "Send",
    auto: "automatic",
    arrow: (record) => [
      "Send this and your system opens a ",
      `${record} — nobody has to retype it.`,
    ],
    name: { label: "Your name", placeholder: "Mr Tan" },
    phone: { label: "Phone / WhatsApp", placeholder: "012-345 6789" },
    detail: {
      label: "What do you need?",
      placeholder: "3-room renovation, roughly how much?",
    },
  },
};

const ZH: SystemWords = {
  months: [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ],
  monthsShort: [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
  ],
  weekdays: ["日", "一", "二", "三", "四", "五", "六"],
  pickDate: "选择日期",
  pickMonth: "选择月份…",
  pickOne: "请选择…",
  search: "搜索…",
  noResults: "没有找到结果。",
  filteredBy: "筛选条件",
  clearAll: "清空全部",
  prevMonth: "上个月",
  nextMonth: "下个月",
  prevYear: "上一年",
  nextYear: "下一年",
  close: "关闭",
  openMenu: "打开菜单",
  closeMenu: "关闭菜单",
  notifications: "通知",
  account: "账号设置",
  topNav: "顶部导航",
  sideNav: "侧边导航",
  optional: "（可选）",
  uploadPrompt: "点击上传文件或照片",
  dropPrompt: "拖照片进来，或者点一下选",
  atMost: (n) => `最多 ${n} 张`,
  findTag: "找标签…",
  photo: "照片",
  trend: "趋势",
  value: "数值",
  view: "查看 →",
  operationsSystem: "营运系统",
  notYetLive: (feature) =>
    feature
      ? `${feature} — 这是你系统里的功能，系统建好后会启用`
      : "这是你系统里的功能，系统建好后会启用",
  sent: "收到了 —— 我们会回你。",
  sendIncomplete: "留个称呼和联络方式就可以。",
  sendTooMany: "刚才进来的有点多，等一分钟再试。",
  sendFailed: "没送出去。再试一次，或者直接找我们。",
  sendPreviewOnly: "这是预览 —— 没有真的送出。上线之后，这一按会在你的系统里开一行。",
  rowCount: (n) => `共 ${n} 条`,
  filterAll: "全部",
  tableSearch: "在这些记录里找…",
  tableNoMatch: (q) => `没有配得上「${q}」的记录。`,
  empty: "还没有资料",
  emptyToday: "今天没有安排",
  emptyPeople: "还没有加人",
  start: "开始",
  finish: "完成",
  notStarted: "还没开工",
  inProgress: "进行中",
  done: "已完成",
  progress: "进度",
  choose: "选这个",
  mostPopular: "最多人选",
  included: "包含",
  notIncluded: "不包含",
  free: "免费",
  up: "升",
  down: "跌",
  showMore: "看全部",
  showLess: "收起来",
  reference: "编号",
  attendance: "今年出勤",
  less: "少",
  more: "多",
  enquiry: {
    submit: "送出",
    auto: "自动",
    arrow: (record) => ["填完送出 → 你的系统会开一张", `${record}，不用有人转抄。`],
    name: { label: "怎么称呼", placeholder: "陈先生" },
    phone: { label: "电话 / WhatsApp", placeholder: "012-345 6789" },
    detail: { label: "想做什么", placeholder: "三房翻新，想问大概多少" },
  },
};

export const SYSTEM_WORDS: Record<SystemLang, SystemWords> = { en: EN, zh: ZH };
