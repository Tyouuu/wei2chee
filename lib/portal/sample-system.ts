/**
 * The one sample system, shown in the three places a visitor meets the product
 * before they have one of their own: the landing page's showroom, the sign-in
 * page's proof panel, and the styles page's comparison.
 *
 * WHY IT IS SHARED. It was copied into each of them, which meant a visitor who
 * read the landing page, signed up, and went looking for what they had just
 * seen found something slightly different — the one moment the product most
 * needs to look like it kept its word.
 *
 * WHY IT TAKES A LOCALE. The copies were hardcoded Chinese, so /en/login and
 * /en showed a Malaysian-Chinese contractor's system in Chinese to a visitor
 * who had explicitly chosen English. That is not a translation gap in a label;
 * it is the product's central demonstration, in the wrong language, on the
 * screen where somebody decides whether to trust it.
 *
 * The trade stays a renovation contractor in both. The language changes; the
 * business does not — the point of the sample is that the system speaks the
 * OWNER's vocabulary, and 「三房翻新」 and "3-bedroom refit" are the same
 * owner saying the same thing to two different readers.
 */

type Lang = "zh" | "en" | (string & {});

const COPY = {
  zh: {
    title: "报价单",
    subtitle: "发给客户的报价，跟进哪些已确认。",
    caption: "报价单列表",
    workflow: "你的业务流程",
    stages: ["客户", "报价", "订金", "施工", "尾款"],
    columns: ["报价内容", "客户", "金额", "状态"],
    rows: [
      ["Taman Desa 三房翻新", "陈先生", "RM 48,500", "已确认"],
      ["Bukit Jalil 厨房改造", "李太太", "RM 22,800", "等确认"],
      ["Cheras 店面装修", "王老板", "RM 96,000", "报价中"],
      ["Ampang 公寓地板", "林小姐", "RM 8,400", "已逾期"],
    ],
  },
  en: {
    title: "Quotations",
    subtitle: "Quotes sent out, and which ones are confirmed.",
    caption: "Quotation list",
    workflow: "Your workflow",
    stages: ["Enquiry", "Quoted", "Deposit", "On site", "Final"],
    columns: ["Item", "Customer", "Amount", "Status"],
    rows: [
      ["Taman Desa 3-bedroom refit", "Mr. Chan", "RM 48,500", "Confirmed"],
      ["Bukit Jalil kitchen", "Mrs. Lee", "RM 22,800", "Awaiting"],
      ["Cheras shopfront", "Mr. Ong", "RM 96,000", "Quoting"],
      ["Ampang condo flooring", "Ms. Lim", "RM 8,400", "Overdue"],
    ],
  },
} as const;

const TONES = ["positive", "warning", "neutral", "negative"] as const;
const COUNTS = [12, 6, 4, 3, 1];

/**
 * @param locale  next-intl's active locale.
 * @param prefix  Puck ids have to be unique per rendered tree; two of these can
 *                be on one page (the styles comparison renders three).
 * @param withWorkflow  The landing page has room for the pipeline strip; the
 *                      sign-in panel does not, and a squeezed five-stage strip
 *                      beside a login form reads as clutter.
 */
export function sampleSystem(locale: Lang, prefix: string, withWorkflow = false) {
  const c = locale === "zh" ? COPY.zh : COPY.en;

  const content: Record<string, unknown>[] = [
    {
      type: "PageHeader",
      props: { id: `${prefix}-h`, title: c.title, subtitle: c.subtitle },
    },
  ];

  if (withWorkflow) {
    content.push({
      type: "WorkflowStrip",
      props: {
        id: `${prefix}-w`,
        title: c.workflow,
        stages: c.stages.map((label, i) => ({ label, count: COUNTS[i] })),
      },
    });
  }

  content.push({
    type: "RecordTable",
    props: {
      id: `${prefix}-t`,
      gridId: `${prefix}-t`,
      caption: c.caption,
      table: {
        columns: [
          { key: "primary", label: c.columns[0], kind: "text" },
          { key: "secondary", label: c.columns[1], kind: "detail" },
          { key: "amount", label: c.columns[2], kind: "amount" },
          { key: "status", label: c.columns[3], kind: "status" },
        ],
        rows: c.rows.map((r, i) => ({
          cells: { primary: r[0], secondary: r[1], amount: r[2], status: r[3] },
          tones: { status: TONES[i] },
        })),
      },
    },
  });

  return { root: {}, content };
}
