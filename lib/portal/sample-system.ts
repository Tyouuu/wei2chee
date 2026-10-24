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
 * The trade stays the same in both. The language changes; the business does
 * not — the point of the sample is that the system speaks the OWNER's
 * vocabulary, and the same row reads the same way to two different readers.
 *
 * ── 2026-10 定位收窄（founder-points 重点38）────────────────────────────
 * 这里以前是一间装修承包商（「三房翻新」「Taman Desa」那一批）。Formae
 * 现在只做沙龙这一个行业，而这支是访客决定信不信这个产品的那个画面——
 * 还在讲装修，跟「我们是沙龙系统」这句话直接矛盾。换成一张预约单：
 * 服务项目 · 客人 · 金额 · 状态，四栏结构、五段流程、四行示例、
 * tones 顺序全部照旧（positive/warning/neutral/negative 对应第 1–4 行），
 * 只换了行业的词。
 */

type Lang = "zh" | "en" | (string & {});

const COPY = {
  zh: {
    title: "预约单",
    subtitle: "客人预约的服务，跟进哪些已经确认。",
    caption: "预约列表",
    workflow: "你的今日流程",
    stages: ["咨询", "已预约", "到店", "服务中", "完成"],
    columns: ["服务项目", "客人", "金额", "状态"],
    rows: [
      ["挑染 + 护色", "陈小姐", "RM 280", "已确认"],
      ["凝胶美甲", "黄太太", "RM 80", "等确认"],
      ["角蛋白护理", "法拉小姐", "RM 450", "进行中"],
      ["剪发 + 吹发", "林先生", "RM 60", "未到"],
    ],
  },
  en: {
    title: "Appointments",
    subtitle: "Bookings coming in, and which ones are confirmed.",
    caption: "Appointment list",
    workflow: "Your day",
    stages: ["Enquiry", "Booked", "Arrived", "In service", "Done"],
    columns: ["Service", "Client", "Amount", "Status"],
    rows: [
      ["Balayage + Toner", "Ms. Tan", "RM 280", "Confirmed"],
      ["Gel Manicure", "Mrs. Wong", "RM 80", "Awaiting"],
      ["Keratin Treatment", "Ms. Farah", "RM 450", "In service"],
      ["Haircut & Blow Dry", "Mr. Lim", "RM 60", "No-show"],
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
