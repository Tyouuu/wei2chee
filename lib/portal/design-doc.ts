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
      StatRow: "boxed",
      RecordTable: "compact",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "tight",
      TrendChart: "line",
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
      StatRow: "tinted",
      RecordTable: "zebra",
      HeroCard: "full",
      WorkflowStrip: "numbered",
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
      StatRow: "lead",
      RecordTable: "plain",
      HeroCard: "full",
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
  console: {
    mood: "给每天开系统只为了看数字的老板 —— 早上开一次，看四个格子就关掉。白侧栏、灰蓝地、4px 直角、小型大写标签。牺牲的是「读记录」这件事：表格被排在数字后面。",
    facts: "圆角 4px · 边框 1px · 极淡阴影 · 行高 38px · 正文 14px · 标签全大写字距 0.06em · 白侧栏蓝高亮",
    prefer: {
      StatRow: "tinted",
      RecordTable: "compact",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "default",
      Divider: "tight",
      TrendChart: "bar",
      SystemShell: "side-inset-light",
      RailNav: "full",
      InfoRows: "compact",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "four",
      PriceTable: "table",
      SmallStat: "compact",
      ShelfList: "boxed-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "person",
      ShareChart: "donut",
      RecordTableRow: "plain",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "split",
      Panel: "card",
      TabbedPanel: "segment",
    },
    avoid: ["给客人看的页面 —— 这是后台，长得就像后台"],
  },
  counter: {
    mood: "给批发商这种一天要开二十张单的生意，开系统就是在里面做事，不是在里面看事。深蓝侧栏、2px 直角、没有阴影，全库最密的正文。牺牲的是全部的呼吸感 —— 但这正是 Autocount、进销存那一类他们本来就在用的样子。",
    facts: "圆角 2px · 边框 1px · 无阴影 · 行高 34px · 正文 13px · 深蓝 #001529 侧栏 · 选中的一行整条填蓝",
    prefer: {
      StatRow: "boxed",
      RecordTable: "compact",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "outline",
      Divider: "tight",
      TrendChart: "area",
      SystemShell: "side-dark",
      RailNav: "tree",
      InfoRows: "compact",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "five",
      PriceTable: "table",
      SmallStat: "compact",
      ShelfList: "ruled-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "badge",
      ShareChart: "pie",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "ruled",
      Panel: "card",
      TabbedPanel: "underline",
    },
    avoid: ["给客人看的页面", "要有温度的生意"],
  },
  // The two that came from a published brief rather than from this file's own
  // hand -- see design-system/tokens/{swiss,soft}.css for where each came from.
  swiss: {
    mood: "给会计、顾问这种把资料印出来给人看的公司。黑白为主，只有一个红，用在必须被找到的地方；没有卡片，靠线跟留白分区。牺牲的是所有装饰 —— 它在萤幕上很素，但它是全库印在纸上最好看的一套。",
    facts: "全直角 · 边框 1px · 无阴影 · 标签全大写字距 0.12em · 强调色瑞士红",
    prefer: {
      StatRow: "rule",
      RecordTable: "plain",
      HeroCard: "stats",
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
  soft: {
    mood: "给补习中心、教育机构这种要显得温和的生意，开系统的人常常不是老板本人。顶栏、卡片跟页面同一个颜色、只靠一对阴影浮起来。牺牲的是清楚的边界 —— 没有一条线，全靠光影，所以它在便宜的萤幕上会糊。",
    facts: "圆角 18–26px · 无边框 · 一对明暗阴影 · 按钮全圆 · 动画 200ms",
    prefer: {
      StatRow: "tinted",
      RecordTable: "plain",
      HeroCard: "trend",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "secondary",
      Divider: "loose",
      TrendChart: "area",
      SystemShell: "top-light",
      RailNav: "full",
      InfoRows: "comfortable",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "two",
      PriceTable: "cards",
      SmallStat: "detailed",
      ShelfList: "boxed",
      AttachmentList: "tile",
      MarkList: "plain",
      RankList: "person",
      ShareChart: "bars",
      RecordTableRow: "pill",
      PhotoFrame: "square",
      ActionRow: "column",
      ChoiceSelect: "default",
      PageHeader: "stacked",
      Panel: "card",
      TabbedPanel: "segment",
    },
    avoid: ["硬边框", "直角", "高对比的分隔线"],
  },
  brut: {
    mood: "给健身房、理发店、改装厂这种自己就很大声的品牌。3px 黑框、不带模糊的偏移阴影，像盖上去的第二层印。牺牲的是「稳重」—— 一间律师楼绝对不会选它，而它也不该被选。",
    facts: "圆角 12px · 边框 3px 纯黑 · 阴影 4px 4px 0(不模糊) · 字重 800/900 · 行高 50px · 强调色桃红",
    prefer: {
      StatRow: "boxed",
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "numbered",
      ActionButton: "default",
      Tag: "default",
      Divider: "normal",
      TrendChart: "bar",
      SystemShell: "side-inset",
      RailNav: "full",
      InfoRows: "comfortable",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "three",
      PriceTable: "cards",
      SmallStat: "default",
      ShelfList: "boxed",
      AttachmentList: "tile",
      MarkList: "spread",
      RankList: "plain",
      ShareChart: "bars",
      RecordTableRow: "pill",
      PhotoFrame: "square",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "stacked",
      Panel: "card",
      TabbedPanel: "segment",
    },
    avoid: ["细线", "柔和的阴影", "低对比的灰", "渐变"],
  },
  tile: {
    mood: "给茶餐室、娘惹菜这种开在店屋里的餐饮。地上铺娘惹砖，卡片一律平的奶白 —— 图案在地上，不在字底下。牺牲的是中性：它一眼就是马来西亚，所以它只对马来西亚的生意有用。",
    facts: "地上 48px 花砖图 · 底色水泥 #f0e9dd · 卡片平奶白 #fffdf8 · 圆角 6px · 釉绿 #14837a · 角点砖红",
    prefer: {
      StatRow: "boxed",
      RecordTable: "plain",
      HeroCard: "full",
      WorkflowStrip: "numbered",
      ActionButton: "default",
      Tag: "default",
      Divider: "loose",
      TrendChart: "bar",
      SystemShell: "side-centred",
      RailNav: "quiet",
      InfoRows: "comfortable",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "three",
      PriceTable: "cards",
      SmallStat: "default",
      ShelfList: "boxed",
      AttachmentList: "tile",
      MarkList: "plain",
      RankList: "badge",
      ShareChart: "bars",
      RecordTableRow: "avatar",
      PhotoFrame: "square",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "split",
      Panel: "tinted",
      TabbedPanel: "pill",
    },
    avoid: ["把图案铺到卡片上", "第二个图案", "深色的大色块", "细到压在花纹上的字"],
  },
  code: {
    mood: "给卖零件、批货的人 —— 型号、条码、数量。整页等宽字，数字自己就对齐了，不用谁去排。牺牲的是读长句：等宽字读一段说明比读一栏货号累得多。",
    facts: "内文等宽 13px 行高 32px · 标题也是等宽 · 圆角 2px · 边框 1px · 强调色 #0f6fa8 · 冷灰底 #f4f6f7",
    prefer: {
      StatRow: "boxed",
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "tight",
      TrendChart: "bar",
      SystemShell: "side-deep",
      RailNav: "quiet",
      InfoRows: "compact-bare",
      DaySchedule: "bare",
      DateProgress: "bare",
      PeopleBoard: "five",
      PriceTable: "table",
      SmallStat: "compact",
      ShelfList: "ruled-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "badge",
      ShareChart: "bars",
      RecordTableRow: "plain",
      PhotoFrame: "square",
      ActionRow: "row",
      ChoiceSelect: "sm",
      PageHeader: "ruled",
      Panel: "ruled",
      TabbedPanel: "underline",
    },
    avoid: ["圆角", "阴影", "长段落的正文", "比例字体的标题"],
  },
  lacquer: {
    mood: "给中药行、婚宴、礼品这种「红金就是招牌」的生意。整页深牛血漆红，象牙白的板浮在上面，金色只走线不做面。全库唯一一套把颜色放在「地」上的。牺牲的是通用性 —— 换个行业它就太重了。",
    facts: "底色 #6e2019(饱和 0.72) · 卡片象牙 #fdfaf4 · 阴影更深更暖 · 圆角 6px · 无边框 · 按钮同色系 #8c2a20 · 金 #c8952f 只用在线",
    prefer: {
      StatRow: "tinted",
      RecordTable: "plain",
      HeroCard: "solo",
      WorkflowStrip: "timeline",
      ActionButton: "default",
      Tag: "default",
      Divider: "loose",
      TrendChart: "area",
      SystemShell: "side-inset-centred",
      RailNav: "full",
      InfoRows: "comfortable",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "three",
      PriceTable: "cards",
      SmallStat: "detailed",
      ShelfList: "boxed",
      AttachmentList: "tile",
      MarkList: "spread",
      RankList: "badge",
      ShareChart: "donut",
      RecordTableRow: "plain",
      PhotoFrame: "photo",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "centred",
      Panel: "card",
      TabbedPanel: "pill",
    },
    avoid: ["第二个强调色", "把卡片也染成深色", "金色的大色块", "细到看不见的字"],
  },
  signboard: {
    mood: "给店屋零售 —— 有一块实体招牌、客人是看到招牌走进来的。店名用又窄又粗的字排到 46px，底下的内文是普通 15px。全库第一个标题跟内文不同字体的。牺牲的是低调：这一套永远在喊自己的名字。",
    facts: "标题字 Archivo Narrow 46px 字距 -0.03em · 内文 15px · 招牌红 #c8102e · 暖白底 #f7f4ef · 圆角 0 · 无阴影 · 标签全大写",
    prefer: {
      StatRow: "boxed",
      RecordTable: "grid",
      HeroCard: "solo",
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
      ShareChart: "pie",
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
  night: {
    mood: "给排班、监控这种晚上也开着的画面，或者纯粹眼睛怕亮的老板。整页近黑，卡片比页面亮一点点，强调色是会发亮的橘。⚠️ 这一套的主张其实是「暗」，而暗是明度 —— 照重点 7c 它比较像一个配色而不是一套风格。留着是因为配色层现在九套全是浅色，砍掉它等於把「深色模式」整个删掉。要修的是配色层缺一个明度轴，不是这一套。",
    facts: "底色 #0d1117 · 卡片 #161b22 · 边框白色 8% · 正文 #e8edf4 13px · 行高 32px · 圆角 3px · 强调色 #ff7a45",
    prefer: {
      StatRow: "lead",
      // Borders do the separating here exactly as they do in 台账 — on a dark
      // ground a zebra band is a smear, and a shadow has nothing to fall on.
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "row",
      // Outline, because a filled orange button at this luminance is the
      // brightest object on the page and pulls the eye off the work.
      ActionButton: "outline",
      Tag: "outline",
      Divider: "tight",
      TrendChart: "line",
      /*
        NOT side-deep. That tone inverts the rail to --color-paper, which is
        「the ink on a panel」 -- dark on every light register, and on 夜 it is
        #e8edf4. Photographed 2026-08-26: a near-white strip down the left of a
        near-black page, the one pale thing on the screen and the opposite of
        what the tone is for. `deep` assumes the page is light. 夜's own nav
        tokens are already correct, so it uses them.
      */
      SystemShell: "side-float-light",
      RailNav: "compact",
      InfoRows: "compact",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "four",
      PriceTable: "table",
      SmallStat: "compact",
      ShelfList: "ruled-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "badge",
      ShareChart: "donut",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "sm",
      PageHeader: "split",
      Panel: "card",
      TabbedPanel: "pill",
    },
    avoid: ["大面积的浅色块", "纯白的字", "柔和的淡色阴影", "第二个会发亮的颜色"],
  },
  studio: {
    mood: "给顾问、代理这种「系统主要是拿来看一眼」的服务公司 —— 开进来确认一个状态，不是进来打单。底跟卡同一个白，靠 1px 细环分开；主色是黑，颜色只出现在涨跌药丸上；行高 52px。全库唯一一套什么都不并排的。牺牲的是密度 —— 四块堆下来比台账多滚一屏。",
    facts: "圆角 10-14px · 无边框、靠 1px 细环分层 · 行高 52px · 正文 14px · 标签不大写 · 主色是黑",
    prefer: {
      StatRow: "chip",
      RecordTable: "plain",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "secondary",
      Divider: "loose",
      TrendChart: "area",
      SystemShell: "side-float-light-centred",
      RailNav: "action",
      InfoRows: "comfortable",
      DaySchedule: "framed",
      DateProgress: "bare",
      PeopleBoard: "three",
      PriceTable: "cards",
      SmallStat: "detailed",
      ShelfList: "boxed",
      AttachmentList: "row",
      MarkList: "plain",
      RankList: "person",
      ShareChart: "donut",
      RecordTableRow: "avatar",
      PhotoFrame: "photo",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "split",
      Panel: "card",
      TabbedPanel: "underline",
    },
    avoid: ["把行挤到 40px 以下", "全大写的标签", "给标题加底色", "把主色换成有颜色的"],
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
