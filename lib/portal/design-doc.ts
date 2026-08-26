import { PALETTE_BY_KEY } from "./palettes";
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
    mood: "一本账簿。密、准、没有装饰。给每天要看几十条记录的人。",
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
    mood: "一间店的前台。圆、暖、宽松。给客人会看到的页面。",
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
      SystemShell: "side-dark",
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
    mood: "一份图纸。中性、清楚、不抢眼。什么生意都不会出错的那一套。",
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
      SystemShell: "side-dark",
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
    mood: "一整面数字。白侧栏、浅灰地、方角、指标一排排。给每天开系统是为了看数的老板。",
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
      SystemShell: "side-light",
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
    mood: "深蓝侧栏、灰地、2px 直角、没有阴影。他们本来就在用的那种系统。给一天要开二十张单的生意。",
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
      SystemShell: "split-deep",
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
  stamp: {
    mood: "像他们本来就在用的 POS / 会计软件。表头是一条实心色带、白字。",
    facts: "表头实心 · 圆角 4px · 边框 1px · 行高 36px · 标签全大写",
    prefer: {
      StatRow: "boxed",
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "default",
      Divider: "tight",
      TrendChart: "bar",
      SystemShell: "side-dark",
      RailNav: "tree",
      InfoRows: "compact",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "five",
      PriceTable: "table",
      SmallStat: "compact",
      ShelfList: "boxed-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "badge",
      ShareChart: "pie",
      RecordTableRow: "plain",
      PhotoFrame: "photo",
      ActionRow: "row",
      ChoiceSelect: "sm",
      PageHeader: "ruled",
      Panel: "tinted",
      TabbedPanel: "underline",
    },
    avoid: ["大圆角", "把表头做成细线", "大段留白"],
  },
  // The two that came from a published brief rather than from this file's own
  // hand -- see design-system/tokens/{swiss,soft}.css for where each came from.
  swiss: {
    mood: "像一张印出来的资料表。黑白为主,只有一个红,用在必须被找到的地方。",
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
      SystemShell: "side-light",
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
    mood: "没有边,只有浮起来。卡片跟页面同一个颜色,靠一对阴影分开。摸起来软的那种。",
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
    mood: "有重量。3px 的黑框、不带模糊的偏移阴影,像盖上去的第二层印。响,但整齐。",
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
      SystemShell: "side-dark",
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
  pop: {
    mood: "贴纸那一个。26px 大圆角配 2px 纯黑边,阴影是硬的偏移不是模糊。三个饱和色一起用——靛蓝、青绿、琥珀——颜色是装饰,不只是意思。底色是很淡的薄荷绿。",
    facts: "圆角 26px · 边框 2px 纯黑 · 硬偏移阴影 3px · 字重 800 · 正文 15px · 行高 54px · 三个强调色 · 画布 #f3f8ee",
    prefer: {
      StatRow: "tinted",
      RecordTable: "zebra",
      HeroCard: "full",
      WorkflowStrip: "numbered",
      ActionButton: "default",
      // Was "solid" from the day this register shipped, which is not one of
      // Tag's ids (default / secondary / outline / destructive) -- so 波普 has
      // been quietly getting the default tag ever since. Caught by
      // design-doc.test.ts on 2026-08-25, the third form of this same silent
      // failure. "default" IS the filled one, which is what it wanted.
      Tag: "default",
      Divider: "normal",
      TrendChart: "bar",
      SystemShell: "top-light",
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
      RankList: "person",
      ShareChart: "pie",
      RecordTableRow: "pill",
      PhotoFrame: "square",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "split",
      Panel: "card",
      TabbedPanel: "segment",
    },
    avoid: ["细字", "浅灰的边", "把黑边改成灰的", "只用一个颜色"],
  },
  tile: {
    mood: "地上铺花砖。娘惹砖那种四瓣花加角上的小圆点,水泥色的地。卡片一律平的奶白——图案在地上,不在字底下。",
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
      SystemShell: "side-dark",
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
    mood: "每一个字一样宽。整页等宽字,型号、条码、数量自己就对齐了,不用谁去排。密度跟台账一样紧,颜色是印刷蓝。",
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
    mood: "有颜色的地。整页是深牛血漆红,卡片是象牙白的板浮在上面,金色只走线不做面。整套十八个版式,只有这一个把颜色放在「地」上——其他每一个都是白纸配一颗有色的按钮。",
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
      SystemShell: "side-deep",
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
    mood: "招牌那一个。店名用又窄又粗的字排到 46px、字距收紧,下面的价目跟内文是普通的 15px。整套里第一个「标题跟内文不同一个字体」的版式——差别就在这个对比,不在颜色。",
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
    mood: "关了灯的那一个。整页近黑,卡片比页面亮一点点,左上角一小片很淡的蓝光。强调色是会发亮的橘。",
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
      SystemShell: "side-deep",
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
  glass: {
    mood: "看得穿的那一个。卡片是半透明的白,底下是三团很淡的颜色,卡片会把底下糊掉——像一块真的玻璃压在纸上。",
    facts: "卡片白 55% 透明 · 背后模糊 20px · 底色三团渐层 · 圆角 18px · 1px 白色亮边 · 阴影往下散不往右偏 · 强调色靛蓝 #4f46e5",
    prefer: {
      StatRow: "tinted",
      // Rules would be a second edge competing with the pane's own lit border,
      // and at 55% white a gridline reads as dirt on the glass.
      RecordTable: "plain",
      // Two panes overlapping is what says "glass"; one number on one pane
      // does not. 数字卡 keeps its supporting figures for that reason.
      HeroCard: "full",
      WorkflowStrip: "row",
      // A filled button on a translucent card is the one solid object in the
      // frame, which is exactly the contrast this register is built on.
      ActionButton: "default",
      Tag: "default",
      Divider: "loose",
      TrendChart: "area",
      SystemShell: "top-dark",
      RailNav: "compact",
      InfoRows: "comfortable-bare",
      DaySchedule: "bare",
      DateProgress: "framed",
      PeopleBoard: "two",
      PriceTable: "cards",
      SmallStat: "detailed",
      ShelfList: "boxed",
      AttachmentList: "tile",
      MarkList: "plain",
      RankList: "person",
      ShareChart: "donut",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "centred",
      Panel: "card",
      TabbedPanel: "segment",
    },
    avoid: ["实心的深色大色块", "照片当底", "把两块玻璃叠在同一个位置", "细到 1px 的正文"],
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
- 页面上已经有的字就是老板的用词。跟着它写，不要换成你觉得更标准的说法。`;
}
