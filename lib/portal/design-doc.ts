/*
  FROM THE GENERATED DATA, NOT FROM palettes.ts.

  This module turns a register and a palette into a paragraph of ENGLISH for
  the assistant to read. It needs the palette's name and nothing else -- yet it
  was importing from palettes.ts, which builds a class-name map at module scope
  out of a CSS module, so a text file dragged the whole stylesheet chain behind
  it. Any script without a bundler died on `styles.ledger` before reaching a
  single line of this file, which is how scripts/eval-editor.mjs found it.

  The generated rows are the same data one hop earlier and carry no CSS.
*/
import { PALETTE_ROWS } from "./palettes.generated";

const PALETTE_BY_KEY = Object.fromEntries(PALETTE_ROWS.map((p) => [p.key, p]));

/**
 * Palettes whose GROUND is dark, derived rather than listed.
 *
 * WHY THIS IS A FUNCTION AND NOT A SENTENCE IN THE PROMPT.
 *
 * The prompt said 「亮度属于风格，永远不属于配色」 for about three hours, and it
 * was true when it was written: measured across all twelve palettes the ground
 * ran oklch L 0.938 to 1.000, every one near-white, so 「换成藏青，整体暗一点」
 * promised a change the owner would never see. Then 深夜 shipped at L 0.18 and
 * that sentence started refusing the right answer instead.
 *
 * A hard-coded fact about the data outlives the data. This repo has now paid
 * for that five times in one day -- variant preferences pointing at renamed
 * variants, a register list three days stale, 45 preferences defaultProps was
 * beating, a screenshot script's own copy of the register names, and that
 * sentence. Derived from `dots[0]` at call time, tomorrow's dark palette is
 * simply in the answer, and nobody has to remember this file exists.
 */
export function darkPalettes(): string[] {
  return PALETTE_ROWS.filter((p) => {
    const l = /oklch\(\s*([0-9.]+)/.exec(p.dots?.[0] ?? "")?.[1];
    return l !== undefined && parseFloat(l) < 0.5;
  }).map((p) => p.key);
}
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * The customer's design language, written down for the AI assistant.
 *
 * WHY THIS EXISTS. The assistant could already add blocks, rename columns and
 * rewrite text, and it did all of it blind: `/api/portal/edit`'s system prompt
 * describes the page's BLOCKS and says nothing whatsoever about the customer's
 * 版式 or 配色. So an owner on Docket — square corners, 2px rules, uppercase
 * labels, a paper-form register — who asked for a new table got the same
 * default 「一行一条」 as an owner on Hearth, whose whole page is 20px radii and
 * soft shadows. Five style sets exist precisely so those two systems do not
 * look alike, and the one part of the product that generates layout could not
 * see them.
 *
 * THE FORMAT IS BORROWED; THE CONTENT IS NOT. VoltAgent's awesome-design-md
 * (MIT, 109k stars) collects 73 DESIGN.md files — one per famous brand — for
 * exactly this purpose: a plain-text design brief an agent reads before it
 * writes UI. Its section skeleton is good and is followed loosely here. Its
 * CONTENT is Stripe's and Linear's trade dress and is not usable: the MIT
 * licence covers the repository's text, not the brands it describes.
 *
 * AND IT IS NOT A NEW STYLE. The founder's first question on hearing this was
 * 「不是有很多个风格了？」 — no. There are still five 版式 and eleven 配色. This
 * file adds no axis and invents no value; every fact below is read off the
 * token files, and every recommendation is a choice among variants that already
 * exist in design-system/editor/variants.ts. It is a translation of a decision
 * the customer already made, into a form the model can act on.
 *
 * KEPT SHORT ON PURPOSE. A dump of 120 tokens would cost more than it earns —
 * the model does not emit colours or pixel values, it emits operations. What
 * changes its output is knowing which VARIANT belongs in this register, so
 * that is what most of the document is.
 */

type StyleBrief = {
  /** One line the model can reason from. */
  mood: string;
  /** Measured off design-system/tokens/<style>.css. Present so the model can
   *  tell "this is a tight register" from "this is a roomy one" without being
   *  told in adjectives it might over-apply. */
  facts: string;
  /** The variant that belongs in this register, per block. Ids come from
   *  variants.ts; a wrong one is dropped by set_variant rather than applied. */
  prefer: Record<string, string>;
  avoid: string[];
};

/** Exported for design-doc.test.ts, which asserts that every preference in here
 *  names a variant that exists. `prefer` is a Record<string, string>, so a
 *  typo is invisible to TypeScript and silently means "no opinion". */
export const STYLE_BRIEFS: Record<StyleName, StyleBrief> = {
  ledger: {
    mood: "给装修承包商这种一天要看几十条记录的生意，开系统是为了扫过一整张表。32px 的行、4px 的角、没有阴影。牺牲的是宽松 —— 一屏塞得下最多的行，代价是它不好看，它好用。",
    facts: "圆角 4px · 边框 1px · 无阴影 · 行高 32px · 正文 13px · 标签全大写",
    prefer: {
      EnquiryForm: "split",
      /* 抄自 Wix wh-newel, section by section. See site-composition.ts. */
      SiteWoven: "band",
      SiteStory: "banded",
      SiteFeatures: "listed",
      SiteGallery: "mosaic",
      SiteTestimonials: "celled",
      SiteSteps: "numbered",
      SiteTeam: "row",
      SiteCreds: "strip",
      /* 🔴 从 boxed 换成 chip（2026-09-02）。
      `chip` 是 8-26 照 arhamkhnz 那套量出来做的 —— 涨跌做成一颗药丸贴在数字
      旁边，解释的话另起一行。**做出来之后六套没有一套选它。**
      老板 9-02 把两张图并排：「感觉不像模版的」。那个差别就在这里。 */
      StatRow: "chip",
      /* 扫一整张表的人要找一行，不是往下卷四十行。它的 mood 一字不差写着这件事。 */
      RecordTableTools: "search",
      RecordTable: "compact",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "tight",
      /* 🔴 line → sum（2026-09-02）。这一套抄的就是 Studio Admin，
      而它那一格图表是**图在左、结论在右**：一个总数、一句话、一张小卡装比例。
      我们本来只有图，读的人要自己从柱子里读出结论。 */
      TrendChart: "sum",
      SystemShell: "split-deep",
      RailNav: "compact",
      InfoRows: "compact",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "five",
      PriceTable: "table",
      SmallStat: "compact",
      ShelfList: "ruled-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "plain",
      ShareChart: "bars",
      RecordTableRow: "plain",
      PhotoFrame: "photo",
      ActionRow: "row",
      ChoiceSelect: "sm",
      PageHeader: "ruled",
      Panel: "ruled",
      TabbedPanel: "underline",
    },
    avoid: ["大圆角的卡片", "大段留白", "把一页只放一两块东西"],
  },
  hearth: {
    mood: "给美容院、沙龙这种前台就是店面的生意，开系统是在客人面前。52px 的行、20px 的圆角、靠阴影分层。牺牲的是密度 —— 一屏少放三分之一的行，换一个客人看到不会皱眉的画面。",
    facts: "圆角 20px · 无边框、靠阴影分层 · 行高 52px · 正文 15px · 标签不大写",
    prefer: {
      EnquiryForm: "split",
      SiteFeatures: "iconed",
      SiteCta: "panel",
      /* 头像在上, no rating -- the shape the page this register copies whole
         uses for its seventh section. 満図 is the register whose argument is
         the picture, so its reviews lead with a face. */
      SiteTestimonials: "ruled",
      SiteTeam: "cards",
      SiteGallery: "bento",
      SiteStory: "side",
      SiteCreds: "rating",
      StatRow: "tinted",
      /* 在客人面前开的画面。分段够了，多一个输入框是多一个要解释的东西。 */
      RecordTableTools: "chips",
      RecordTable: "zebra",
      HeroCard: "full",
      /* 竖排 —— their second section is a heading and three items STACKED, at
         663px the second-largest thing on the page. A horizontal strip of four
         numbered chips came to 155px and read as a caption. */
      SiteSteps: "carded",
      WorkflowStrip: "timeline",
      ActionButton: "default",
      Tag: "secondary",
      Divider: "loose",
      TrendChart: "area",
      SystemShell: "side-float",
      RailNav: "full",
      InfoRows: "comfortable",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "three",
      PriceTable: "cards",
      SmallStat: "detailed",
      ShelfList: "boxed",
      AttachmentList: "tile",
      MarkList: "plain",
      RankList: "person",
      ShareChart: "donut",
      RecordTableRow: "avatar",
      PhotoFrame: "photo",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "split",
      Panel: "card",
      TabbedPanel: "pill",
    },
    avoid: ["硬边框", "把行挤到 32px", "全大写的标签"],
  },
  blueprint: {
    mood: "给还讲不清楚自己是什么行业的老板，开系统是第一次。中性、12px 圆角、一条细边、什么都不抢。它不是最好看的一套，它是最不会出错的一套 —— 牺牲个性换零风险，所以「其他」这一栏给它。",
    facts: "圆角 12px · 边框 1px · 淡阴影 · 行高 42px · 正文 14px · 标签不大写",
    prefer: {
      EnquiryForm: "split",
      SiteFeatures: "plates",
      SiteCta: "rule",
      SiteTeam: "cards",
      SiteGallery: "grid",
      SiteStory: "side",
      SiteCreds: "badges",
      StatRow: "lead",
      /* 最不会出错的那一套 —— 最普通的安排就是它的主张。 */
      RecordTableTools: "chips",
      RecordTable: "plain",
      HeroCard: "full",
      SiteSteps: "across",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "default",
      Divider: "normal",
      TrendChart: "bar",
      SystemShell: "side-light",
      RailNav: "full",
      InfoRows: "compact",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "four",
      PriceTable: "table",
      SmallStat: "default",
      ShelfList: "boxed-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "badge",
      ShareChart: "bars",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "split",
      Panel: "card",
      TabbedPanel: "pill",
    },
    avoid: ["极端的密或极端的松"],
  },
  counter: {
    mood: "给批发商这种一天要开二十张单的生意，开系统就是在里面做事，不是在里面看事。深蓝侧栏、2px 直角、没有阴影，全库最密的正文。牺牲的是全部的呼吸感 —— 但这正是 Autocount、进销存那一类他们本来就在用的样子。",
    facts: "圆角 2px · 边框 1px · 无阴影 · 行高 34px · 正文 13px · 深蓝 #001529 侧栏 · 选中的一行整条填蓝",
    prefer: {
      EnquiryForm: "card",
      SiteFeatures: "menu",
      SiteTeam: "row",
      SiteGallery: "pair",
      SiteWoven: "scatter",
      SiteStory: "stack",
      SiteCreds: "strip",
      StatRow: "boxed",
      /* 全库最密的一套，一屏最多行 —— 密度让「找」变得更必要，不是更不必要。 */
      RecordTableTools: "search",
      /* 🔴 台账 也是 compact，而这两套本来就最像。这一套要**画格线** —— 它的主张是「像他们本来在用的进销存」，而那种画面就是一张有格子的表，照着纸对得上。 */
      RecordTable: "grid",
      /* 台账 也是 stats。这一套的大数字卡是**整块**的，不是四个小格 —— 一个开二十张单的人一天只盯一个总数。 */
      HeroCard: "full",
      SiteSteps: "across",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "outline",
      Divider: "tight",
      TrendChart: "area",
      SystemShell: "side-dark",
      RailNav: "tree",
      /* 台账 也是 compact。去掉线之后它比 台账 更紧 —— 全库最密要在每一个零件上兑现，不是只在行高上。 */
      InfoRows: "compact-bare",
      /* 台账 也是 framed。这一套没有阴影没有圆角，一个带框的日程跟它整页的做法打架。 */
      DaySchedule: "bare",
      DateProgress: "framed",
      PeopleBoard: "five",
      PriceTable: "table",
      /* 台账 也是 compact。小数字在这一套不是主角（主角是那张表），所以它反而不用挤。 */
      SmallStat: "default",
      /* 台账 也是 ruled-sm。它的清单用格子，因为它的表已经全是线了，再来一份线就分不出哪一块是哪一块。 */
      ShelfList: "boxed-sm",
      AttachmentList: "row",
      /* 台账 也是 ruled。 */
      /* 招牌 也是 spread。 */
      MarkList: "ruled",
      RankList: "badge",
      /* 🔴 pie → stack（2026-09-02）。一个圆饼在一张最密的表旁边是一块浪费掉的
      正方形；一条堆叠条只吃一行高，而它回答的是同一个问题。
      Ant Design Pro 的列表页用的就是这个。 */
      ShareChart: "stack",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "ruled",
      /* 🔴 招牌 也是 card。这一套没有阴影、2px 直角 —— 用线分区才是它，卡片是别人的。 */
      Panel: "ruled",
      /* 台账 也是 underline。分段按钮是 Autocount 那一类真正在用的样子。 */
      /* 招牌 也是 segment，而分段按钮在最密的一屏里比一条下划线高。 */
      TabbedPanel: "underline",
    },
    avoid: ["给客人看的页面", "要有温度的生意"],
  },
  // The two that came from a published brief rather than from this file's own
  // hand -- see design-system/tokens/{swiss,soft}.css for where each came from.
  swiss: {
    mood: "给会计、顾问这种把资料印出来给人看的公司。黑白为主，连图表的柱子都是墨色；唯一的颜色是一个靛蓝，只出现在必须被按到的地方。没有卡片，靠线跟留白分区。牺牲的是所有装饰 —— 它在萤幕上很素，但它是全库印在纸上最好看的一套。",
    facts: "全直角 · 边框 1px · 无阴影 · 标签全大写字距 0.12em · 强调色瑞士红",
    prefer: {
      SiteGallery: "grid",
      SiteFeatures: "photoed",
      SiteCta: "rule",
      SiteTeam: "plain",
      SiteStory: "side",
      SiteCreds: "logos",
      EnquiryForm: "split",
      SiteTestimonials: "stagger",
      StatRow: "rule",
      /* 印在纸上的那一套。一个搜索框印不出来，而这一套的主张就是把印不出来的东西全部拿掉。 */
      RecordTableTools: "none",
      RecordTable: "plain",
      HeroCard: "stats",
      SiteSteps: "ruled",
      WorkflowStrip: "numbered",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "normal",
      TrendChart: "bar",
      SystemShell: "side-light-centred",
      RailNav: "quiet",
      InfoRows: "compact-bare",
      DaySchedule: "bare",
      DateProgress: "bare",
      PeopleBoard: "four",
      PriceTable: "table",
      SmallStat: "default",
      ShelfList: "ruled",
      AttachmentList: "row",
      MarkList: "spread",
      RankList: "plain",
      ShareChart: "bars",
      RecordTableRow: "pill",
      PhotoFrame: "square",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "ruled",
      Panel: "plain",
      TabbedPanel: "underline",
    },
    avoid: ["圆角", "阴影", "第二种强调色", "装饰性的图案"],
  },
  signboard: {
    mood: "给店屋零售 —— 有一块实体招牌、客人是看到招牌走进来的。店名用又窄又粗的字排到 46px，底下的内文是普通 15px。全库第一个标题跟内文不同字体的。牺牲的是低调：这一套永远在喊自己的名字。",
    facts: "标题字 Archivo Narrow 46px 字距 -0.03em · 内文 15px · 招牌红 #c8102e · 暖白底 #f7f4ef · 圆角 0 · 无阴影 · 标签全大写",
    prefer: {
      EnquiryForm: "split",
      SiteWoven: "columns",
      SiteFeatures: "menu",
      SiteCta: "panel",
      SiteTeam: "row",
      SiteGallery: "bento",
      SiteStory: "centre",
      SiteCreds: "rating",
      StatRow: "boxed",
      /* 一块招牌上不会有搜索框。名字跟数字是招牌，其余的小而在下面。 */
      RecordTableTools: "none",
      RecordTable: "grid",
      HeroCard: "solo",
      SiteSteps: "numbered",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "default",
      Divider: "tight",
      TrendChart: "bar",
      SystemShell: "top-dark",
      RailNav: "quiet",
      InfoRows: "comfortable-bare",
      DaySchedule: "bare",
      DateProgress: "framed",
      PeopleBoard: "three",
      PriceTable: "cards",
      SmallStat: "detailed",
      ShelfList: "boxed",
      AttachmentList: "tile",
      MarkList: "spread",
      RankList: "badge",
      /* 🔴 pie → donut（2026-09-02）。中台 也是 pie，两套撞在同一个物件上；
      而这一套要的是**一个大到当招牌用的圆**，中间空着放数字 ——
      TailAdmin 那一页整页就靠一个大圆环撑起来。实心圆做不到那件事。 */
      /* 🔴 donut → gauge（2026-09-02）。抄的是 TailAdmin：那一页整个靠一个
      半圆表撑起来，而这一套的主张就是「一个大到当招牌用的数字」。
      圆环还是一个圆，半圆表是一根**指针指到哪里**——招牌要的是后面那件事。 */
      ShareChart: "gauge",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "centred",
      Panel: "card",
      TabbedPanel: "segment",
    },
    avoid: ["圆角", "阴影", "细字的标题", "第二个强调色", "把标题缩到跟内文一样大"],
  },
};

/**
 * The same preferences the brief describes, for code rather than for the model.
 *
 * `add_component` applies these directly (see layout-ops.ts) because the model
 * cannot target a block it has just created -- the id is minted inside that
 * module. The brief still names them so the model can EXPLAIN a look when
 * asked, and so it does not fight a default it cannot see.
 */
export function preferredVariants(style: string | null | undefined): Record<string, string> {
  return STYLE_BRIEFS[style as StyleName]?.prefer ?? {};
}

/**
 * Builds the brief. Returns null for a project with no style yet — a customer
 * who has not reached 风格选择 has no design language to describe, and an
 * invented one would be worse than none.
 */
/** Every register the product currently has, read off the briefs rather than
 *  listed again -- one more copy of this list is one more chance for the
 *  assistant to offer a register that was cut yesterday. */
const STYLE_ORDER_FOR_DOC = Object.keys(STYLE_BRIEFS) as StyleName[];

export function buildDesignDoc(
  style: string | null | undefined,
  palette: string | null | undefined,
): string | null {
  const brief = STYLE_BRIEFS[style as StyleName];
  if (!brief) return null;

  const p = palette ? PALETTE_BY_KEY[palette] : undefined;
  const prefer = Object.entries(brief.prefer)
    .map(([type, id]) => `${type}=${id}`)
    .join(" ");

  return `## 这个客户的设计语言

版式：${style}　—　${brief.mood}
量出来的：${brief.facts}
配色：${p ? `${p.label}（${p.blurb}）` : "还没选，用版式自己的颜色"}

### 这个版式的默认款式（你不用动手，加进去就是这样）
${prefer}

### 不要做
${brief.avoid.map((a) => `- ${a}`).join("\n")}

### 规矩
- 版式和配色是老板自己选的。**不要主动去改**，除非他明确要求。
- 上面那一行是新块自动带的款式，你不需要再去设一次，也不要把整页重新排。
- 老板明确要求换某一块的款式时，才用 set_variant，目标要是页面上已经有的 id。
- 页面上已经有的字就是老板的用词。跟着它写，不要换成你觉得更标准的说法。

### 可以换成哪一套（老板明确讲要换的时候，填 \`design.style\`，不是发操作）
${STYLE_ORDER_FOR_DOC.map((k) => `- \`${k}\` ${STYLE_BRIEFS[k].mood}`).join("\n")}

### 可以换成哪一个配色（填 \`design.palette\`；\`none\` ＝ 用回版式自己的颜色）
${PALETTE_ROWS.map((p) => `- \`${p.key}\` ${p.label}：${p.blurb}`).join("\n")}`;
}
