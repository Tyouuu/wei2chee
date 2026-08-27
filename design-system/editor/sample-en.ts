/**
 * The sample content a freshly added block arrives with, in English.
 *
 * ── WHY IT IS SEPARATE FROM labels-en.ts ─────────────────────────────────
 *
 * That file translates Formae's own chrome — block names, field labels, the
 * gallery's headings — and follows the OWNER'S interface language, because
 * Formae speaks to the owner. This one is the CUSTOMER'S content: the words
 * inside the block once it lands on their page. It follows
 * `projects.system_language`, because their system speaks to their customers.
 *
 * The two are genuinely different settings and this is exactly where they come
 * apart: an owner reading the editor in English who runs a Chinese-language
 * business must get 「本月收款」 in the block, and an owner reading the editor in
 * Chinese who runs an English-language business must get "Paid this month".
 * Keying both off one setting is the cross-language fallback the founder ruled
 * out (founder-points.md, point 13).
 *
 * ── WHY IT IS KEYED ON THE CHINESE STRING ────────────────────────────────
 *
 * Same argument as labels-en.ts: puck-config.tsx stays the single source of
 * truth and English is a projection of it, so a block added next month is
 * translated by being registered rather than by somebody remembering. A missing
 * entry falls through to the Chinese — a Chinese word in an English system is a
 * gap you can see; an empty field is a block that looks broken.
 *
 * ── WHY ONLY STRINGS WITH CJK IN THEM ARE LOOKED UP ──────────────────────
 *
 * `defaultProps` is not all content. It also carries ids, hrefs, icon names,
 * colour tokens and variant keys — `iconName: "person"`, `href: "/portal/…"`,
 * `color: "var(--chart-1)"` — and running those through a translation table is
 * how a working block becomes a broken one. Every content string in this file
 * contains at least one Chinese character and none of the structural ones do,
 * so that test separates them exactly and costs one regex.
 */

export const SAMPLE_EN: Record<string, string> = {
  // ── 客户与人 · people ──────────────────────────────────────────────────
  陈先生: "Mr Tan",
  李太太: "Mrs Lee",
  黄先生: "Mr Wong",
  王老板: "Mr Ong",
  陈师傅: "Ah Chan",
  林师傅: "Ah Lim",
  黄师傅: "Ah Wong",
  我: "Me",
  客户: "Client",
  新客户: "New client",
  本月新客户: "New clients this month",
  熟客: "Regular",
  介绍来的: "Referred",
  客户标签: "Client tags",
  客户资料: "Client details",
  联络人: "Contact",
  我们的师傅: "Our people",

  // ── 工程 · jobs ────────────────────────────────────────────────────────
  "Taman Desa 三房翻新": "Taman Desa 3-room reno",
  "Bukit Jalil 厨房改造": "Bukit Jalil kitchen",
  "Cheras 店面装修": "Cheras shoplot fitout",
  "Taman Desa 量尺": "Taman Desa site visit",
  "Bukit Jalil 施工": "Bukit Jalil build",
  "陈先生 · 三房翻新": "Mr Tan · 3-room reno",
  "李太太 · 厨房": "Mrs Lee · kitchen",
  "黄先生 · 店面": "Mr Wong · shoplot",
  "陈先生 · RM 48,500": "Mr Tan · RM 48,500",
  "李太太 · RM 22,800": "Mrs Lee · RM 22,800",
  "王老板 · RM 96,000": "Mr Ong · RM 96,000",
  工程进度: "Job progress",
  已确认工程: "Confirmed jobs",
  小工程: "Small job",
  全屋: "Whole house",
  整间屋翻新: "Whole-house renovation",
  施工照片: "Site photos",
  施工前: "Before",
  放一张工地照片: "Add a site photo",
  "工地照片.zip": "site-photos.zip",
  "拖施工照片进来,或者点一下选": "Drag site photos in, or tap to choose",
  今天的安排: "Today's schedule",
  今天要跟的: "To follow up today",
  今年出勤: "Attendance this year",
  排期: "Schedule",
  业务流程: "Workflow",
  "订金、施工中、完工": "Deposit, in progress, done",

  // ── 状态 · statuses ───────────────────────────────────────────────────
  已确认: "Confirmed",
  已报价: "Quoted",
  已完工: "Completed",
  施工中: "In progress",
  进行中: "In progress",
  报价中: "Quoting",
  等回复: "Awaiting reply",
  待回复报价: "Quotes awaiting reply",
  待处理: "To do",
  收尾: "Finishing",
  完成: "Done",
  完成度: "Progress",
  跟进: "Follow up",
  急单: "Rush",
  新: "New",
  全部: "All",
  状态: "Status",
  "这一单的状态": "Status of this job",
  "还没上门量尺": "No site visit yet",

  // ── 钱 · money ────────────────────────────────────────────────────────
  报价: "Quote",
  报价单: "Quotation",
  报价单号: "Quotation no.",
  "报价单 QT-2026-0142.pdf": "quotation-QT-2026-0142.pdf",
  发出报价: "Send the quote",
  "报价已发,等回复": "Quote sent, awaiting reply",
  "报价单可以直接 WhatsApp 出去了": "The quotation is ready to send on WhatsApp",
  报价包含什么: "What the quote includes",
  收款: "Payments",
  每月收款: "Monthly takings",
  本月营收: "Revenue this month",
  "已经收到的工程款，按月看。": "Job payments received, month by month.",
  做完未收款: "Done, not yet paid",
  订金未收: "Deposit not received",
  "订金收据.pdf": "deposit-receipt.pdf",
  尾款到期前三天: "Three days before the balance is due",
  拖数: "Overdue",
  催款: "Chase payment",
  超过30天: "Over 30 days",
  "超过 30 天": "Over 30 days",
  付款方式: "Payment method",
  现金: "Cash",
  转账: "Transfer",
  支票: "Cheque",
  金额: "Amount",
  收费: "Fee",
  起: "from",
  一次过: "One payment",
  分三期: "Three stages",
  做完一次付清: "Paid in full on completion",
  "订金 50%,施工完成后付清尾款。": "50% deposit, balance on completion.",
  完工后: "On completion",
  比上月: "vs last month",
  上个月: "last month",
  "vs 上个月": "last month",
  本周新开1单: "1 new job this week",
  "本周新开 1 单": "1 new job this week",
  "本月佣金已经出了,记得去看。": "This month's commission is ready — go and check it.",
  钱卡在哪一段: "Where the money is sitting",
  谁最有价值: "Who is worth the most",

  // ── 工种 · trades ─────────────────────────────────────────────────────
  木工: "Carpentry",
  水电: "Plumbing & wiring",
  泥水: "Masonry",
  拆除与清运: "Demolition & clearing",
  "水电改位（另计）": "Moving pipes & wiring (extra)",
  家具与电器: "Furniture & appliances",
  含材料: "Materials included",
  不勾就是只算工钱: "Leave unticked for labour only",
  保修: "Warranty",
  "水电一年保修,木工六个月。": "One year on plumbing and wiring, six months on carpentry.",
  "免费上门量尺、报价单、一次修改": "Free site visit, a quotation, one revision",
  "免费上门量尺、3D 图、无限次修改、一年保修":
    "Free site visit, 3D drawings, unlimited revisions, one year of warranty",
  "施工范围包括拆除旧橱柜、水电改位、防水、贴砖、天花板与油漆。不包括家具、电器与窗帘。工期以实际现场情况为准,如遇管理层批准延误,完工日期顺延。":
    "The work covers stripping out the old cabinets, moving pipes and wiring, waterproofing, tiling, ceiling and paint. It does not cover furniture, appliances or curtains. The schedule follows site conditions; if management approval is delayed, the finish date moves with it.",
  我们做什么: "What we do",

  // ── 表单与介面 · form and UI text ─────────────────────────────────────
  标题: "Title",
  名称: "Name",
  说明: "Description",
  示例说明: "Example description",
  "示例记录 #1": "Sample record #1",
  记录列表: "Records",
  日期: "Date",
  电话: "Phone",
  地址: "Address",
  备注: "Notes",
  写给自己看的: "Just for you",
  "写你想提醒同事的事。": "Anything you want your people to see.",
  基本: "Basic",
  总览: "Overview",
  我的系统: "My system",
  账号设置: "Account settings",
  通知: "Notifications",
  提醒: "Reminder",
  自动发提醒: "Send reminders automatically",
  确认: "Confirm",
  取消: "Cancel",
  保存: "Save",
  存草稿: "Save draft",
  新增: "Add",
  删掉: "Delete",
  送出: "Send",
  "搜索…": "Search…",
  "请选择…": "Choose…",
  "找标签…": "Find a tag…",
  选择日期: "Pick a date",
  选择月份: "Pick a month",
  上传附件: "Upload a file",
  "PDF 或图片，最大 10MB": "PDF or image, up to 10MB",
  最多6张: "Up to 6 photos",
  "最多 6 张": "Up to 6 photos",
  最久一张3天: "Oldest 3 days",
  "最久一张 3 天": "Oldest 3 days",
  还没有内容: "Nothing here yet",
  这一区: "This section",
  这一单的文件: "Files on this job",
  询价中: "Enquiries",
  留个电话我们回你: "Leave a number and we'll get back to you",
  "留个电话，我们回你": "Leave a number and we'll get back to you",
  "WhatsApp 问价": "Ask on WhatsApp",
  问详情: "Ask about it",
  "12 位客户评过": "12 clients have rated us",
  "2.1 MB · 8月18日": "2.1 MB · 18 Aug",
  "14 张 · 8月20日": "14 photos · 20 Aug",
  "480 KB · 8月21日": "480 KB · 21 Aug",

  // ── 月份 · months ─────────────────────────────────────────────────────
  "3月": "Mar",
  "4月": "Apr",
  "5月": "May",
  "6月": "Jun",
  "7月": "Jul",
  "8月": "Aug",

  // ── 整段成品 (design-system/components/assembled.tsx) ─────────────────
  // Content, not chrome: these follow projects.system_language, because they
  // are what the block SAYS on the customer's page.
  新客户登记: "New client",
  "填一次,以后开单、发报价都用得上。": "Fill this in once — quotes and invoices reuse it.",
  客户名字: "Client name",
  "电话 / WhatsApp": "Phone / WhatsApp",
  怎么找到我们: "How they found us",
  要做什么: "What they need",
  三房翻新: "3-room renovation",
  加进来: "Add client",
  "这一单": "This job",
  "RM 48,500 · 已确认": "RM 48,500 · confirmed",
  上门量尺: "Site measure",
  "8月18日 · 已完成": "18 Aug · done",
  "WhatsApp 联络": "WhatsApp them",
  "陈先生 · 012-345 6789": "Mr Tan · 012-345 6789",
  "订金已收 50%": "50% deposit received",
  木工进场: "Carpentry started",
  报价条款: "Quotation terms",
  "施工范围包括拆除旧橱柜、水电改位、防水、贴砖、天花板与油漆。不包括家具、电器与窗帘。订金 50%,施工完成后付清尾款。水电一年保修,木工六个月。工期以实际现场情况为准,如遇管理层批准延误,完工日期顺延。":
    "Scope covers stripping the old cabinetry, relocating wiring and plumbing, waterproofing, tiling, ceiling and paint. Furniture, appliances and curtains are not included. 50% deposit, balance on completion. One year on wiring and plumbing, six months on carpentry. Timeline follows site conditions; approved delays push the completion date back accordingly.",
  客户签名: "Client signature",
  本月对账: "This month",
  "比上月 +13.2%": "+13.2% vs last month",
  "3 单本周收尾": "3 finishing this week",
  "数字来自你自己的记录,改一笔这里就跟着变。":
    "These come from your own records — change one and this follows.",

  // ── 组件库's own samples (app/[locale]/portal/(app)/library/samples.ts) ──
  // Content, so these follow system_language. Found by walking LIBRARY_SAMPLES
  // for CJK strings with no entry here rather than by reading the screenshot:
  // the audit reports only the first eighteen per page.
  报价单列表: "Quotations",
  报价内容: "What was quoted",
  等确认: "Awaiting confirmation",
  本月待收工程款: "Owed to you this month",
  比上个月: "vs last month",
  近六个月: "Last six months",
  "3 个": "3",
  "2 个": "2",
  装修工程流程: "Job workflow",
  询问: "Enquiry",
  上门量: "Site measure",
  施工: "Build",
  收尾款: "Final payment",
  "发给客户的报价，跟进哪些已确认、哪些还没回复。":
    "Quotes you have sent — which are confirmed, and which have gone quiet.",
  还没有报价单: "No quotations yet",
  "第一次上门量了尺寸之后，从这里开一张。":
    "After the first site measure, start one here.",
  选择状态: "Status",
  搜索客户: "Search clients",
  "陈先生 · Taman Desa": "Mr Tan · Taman Desa",
  "李太太 · Bukit Jalil": "Mrs Lee · Bukit Jalil",
  "王老板 · Cheras": "Mr Wong · Cheras",
  输入材料名称: "Material name",
  石膏板: "Plasterboard",
  防水漆: "Waterproof paint",
  云石台面: "Marble countertop",
  "收据 / 单据": "Receipt / invoice",
  "拍张照片或上传 PDF，付款记录会连着这一笔。":
    "Snap a photo or upload a PDF — the payment record links to it.",
  "有 2 张报价单超过 7 天没回复": "2 quotations have gone 7 days without a reply",
  "陈先生的 Taman Desa 三房翻新、王老板的 Cheras 店面装修。要不要今天跟一下？":
    "Mr Tan's Taman Desa 3-room reno and Mr Wong's Cheras shoplot fitout. Follow up today?",
  "Taman Desa 三房翻新 · 工程进度": "Taman Desa 3-room reno · progress",
  报价日期: "Quote date",
  结算月份: "Month",
  等客户确认: "Awaiting the client",
  陈老板: "Mr Tan",
  筛选条件: "Filtered by",
  清空全部: "Clear all",

  /* 官网顶栏 / 页脚 default brand, added with those two blocks on
     2026-08-27 and missed by their English projection -- check:en found it
     the same day, which is the ruler doing exactly its job. `chrome.ts`
     already carries "My Company" for the generated path; this is the one a
     block picks up when the owner drags it in by hand. */
  "我的公司": "My Company",
};

/**
 * ONLY STRINGS WITH CJK IN THEM.
 *
 * `defaultProps` is not all content: it also carries ids, hrefs, icon names,
 * colour tokens and variant keys — `iconName: "person"`, `color: "var(--chart-1)"`,
 * `href: "/portal/…"` — and running those through a translation table is how a
 * working block becomes a broken one. Every content string above contains at
 * least one Chinese character and none of the structural ones do, so this test
 * separates them exactly and costs one regex.
 */
const HAS_CJK = /[一-鿿]/;

/** Deep-translates a block's sample content. Returns the value untouched when
 *  the system speaks Chinese, which is the config's own language. */
export function sampleProps<T>(value: T, systemLang: string): T {
  if (systemLang === "zh") return value;
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === "string") {
    return HAS_CJK.test(value) ? (SAMPLE_EN[value] ?? value) : value;
  }
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v)]),
    );
  }
  return value;
}
