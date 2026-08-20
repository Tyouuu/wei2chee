import type { StatusTone } from "@/design-system/components/status-dot";

/**
 * Gallery samples — the props a component is SHOWN with in the library, which
 * are not the props it is CREATED with in the editor.
 *
 * The two want opposite things. `defaultProps` is a starting point for editing:
 * one placeholder row, optional fields left empty, generic labels, so a
 * customer who drags a table gets something obviously theirs to fill in. A
 * gallery card has to answer "what is this for", and a table with a single row
 * reading "示例记录 #1" answers it badly — it shows the mechanism and hides the
 * purpose.
 *
 * So these are the same components carrying a renovation contractor's real
 * vocabulary, matching the demo account and the industry templates. Only
 * components whose defaults genuinely under-sell them are listed; everything
 * else shows its defaults, because for those the default IS a fair sample.
 */
export const LIBRARY_SAMPLES: Record<string, Record<string, unknown>> = {
  RecordTable: {
    caption: "报价单列表",
    table: {
      columns: [
        { key: "primary", label: "报价内容", kind: "text" },
        { key: "secondary", label: "客户", kind: "detail" },
        { key: "amount", label: "金额", kind: "amount" },
        { key: "status", label: "状态", kind: "status" },
      ],
      rows: [
        {
          cells: { primary: "Taman Desa 三房翻新", secondary: "陈先生", amount: "RM 48,500", status: "已确认" },
          tones: { status: "positive" as StatusTone },
        },
        {
          cells: { primary: "Bukit Jalil 厨房改造", secondary: "李太太", amount: "RM 22,800", status: "等确认" },
          tones: { status: "warning" as StatusTone },
        },
        {
          cells: { primary: "Cheras 店面装修", secondary: "王老板", amount: "RM 96,000", status: "报价中" },
          tones: { status: "neutral" as StatusTone },
        },
      ],
    },
  },

  HeroCard: {
    label: "本月待收工程款",
    value: "RM 71,300",
    chgSuffix: "比上个月",
    sparkLabel: "近六个月",
    spark: [{ n: 42 }, { n: 51 }, { n: 47 }, { n: 63 }, { n: 58 }, { n: 71 }],
    stats: [
      { label: "已确认", value: "3 个", href: "#", tone: "normal", sub: "RM 48,500" },
      { label: "等回复", value: "2 个", href: "#", tone: "caution", sub: "RM 22,800" },
    ],
  },

  WorkflowStrip: {
    title: "装修工程流程",
    stages: [
      { label: "询问", count: "5", tone: "normal" },
      { label: "上门量", count: "3", tone: "normal" },
      { label: "报价", count: "4", tone: "attention" },
      { label: "施工", count: "2", tone: "normal" },
      { label: "收尾款", count: "1", tone: "normal" },
    ],
  },

  PageHeader: {
    title: "报价单",
    subtitle: "发给客户的报价，跟进哪些已确认、哪些还没回复。",
  },

  EmptyState: {
    variant: "empty",
    title: "还没有报价单",
    description: "第一次上门量了尺寸之后，从这里开一张。",
  },

  FilterChips: {
    chips: [
      { label: "状态", value: "等确认", removeHref: "#" },
      { label: "客户", value: "陈先生", removeHref: "#" },
    ],
    clearAllHref: "#",
  },

  Listbox: {
    name: "status",
    defaultValue: "quoting",
    placeholder: "选择状态",
    options: [
      { label: "报价中", value: "quoting" },
      { label: "等确认", value: "waiting" },
      { label: "已确认", value: "confirmed" },
      { label: "施工中", value: "building" },
    ],
  },

  Combobox: {
    name: "customer",
    value: "陈先生",
    placeholder: "搜索客户",
    options: [
      { label: "陈先生 · Taman Desa", value: "chen" },
      { label: "李太太 · Bukit Jalil", value: "lee" },
      { label: "王老板 · Cheras", value: "wong" },
    ],
  },

  TextAutocomplete: {
    name: "material",
    placeholder: "输入材料名称",
    suggestions: [{ value: "石膏板" }, { value: "防水漆" }, { value: "云石台面" }],
  },

  FileUploadField: {
    label: "收据 / 单据",
    hint: "拍张照片或上传 PDF，付款记录会连着这一笔。",
    accept: "image/*,.pdf",
  },

  DatePicker: { name: "quote-date", placeholder: "报价日期", allowClear: true },
  MonthPicker: { name: "period", placeholder: "结算月份", allowClear: true },
  StatusDot: { tone: "warning", label: "等客户确认" },
  Avatar: { name: "陈老板" },
};
