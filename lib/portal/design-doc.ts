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
    mood: "给装修承包商这种一天要看几十条记录的生意，开系统是为了扫过一整张表。窄图标栏、左边一条钉住的名单、会筛会排的表。牺牲的是花俏 —— 换来的是找得到那一行。",
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
      老板 9-02 把两张图并排：「感觉不像模版的」。那个差别就在这里。

      🔴 **9-03 又换回 boxed，而且理由是我 9-02 自己写错了地方。**
      `chip` 是照 arhamkhnz 量出来的，而 arhamkhnz 就是 **Studio Admin ——
      瑞士的参考，不是台账的**（见 register-references.ts）。
      台账抄的 shadcn-admin，它自己那一页的指标卡是**四张白盒子**，
      涨跌是底下一行安静的字。把那颗药丸装在台账身上，是把瑞士的身份穿到台账上。 */
      StatRow: "boxed",
      /* 扫一整张表的人要找一行，不是往下卷四十行。它的 mood 一字不差写着这件事。 */
      RecordTableTools: "search",
      RecordTable: "compact",
      HeroCard: "stats",
      WorkflowStrip: "ruled",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "tight",
      /* 🔴 line → sum（2026-09-02）。这一套抄的就是 Studio Admin，
      而它那一格图表是**图在左、结论在右**：一个总数、一句话、一张小卡装比例。
      我们本来只有图，读的人要自己从柱子里读出结论。 */
      TrendChart: "sum",
      /* 🔴 deep → light（2026-09-03）。白色那一轮把 `--color-nav-bg` 改成白，
         **而画面上侧栏还是深蓝** —— 因为 `deep` 这一种外壳会把侧栏改用
         `--color-paper` 上色，而台账的 paper 是 #14273d。
         有颜色的面积因此从 0.4% 跳回 13.1%，是这一天最大的一次回退，
         而它一直挂在那里直到我去看那张图。
         **一个被别处覆盖掉的 token，跟一个没改的 token，在档案里长得一模一样。** */
      SystemShell: "split-light",
      /* 🔴 图标栏 → 有字的侧栏（2026-09-03）。shadcn 那一页是 240 宽、有字的侧栏，
         而我一直拿「窄图标栏是台账唯一的分别」当理由留着它。
         **分别应该来自这一页有哪些组件、怎么排，不是来自一条别人没有的侧栏。** */
      RailNav: "full",
      InfoRows: "compact",
      DaySchedule: "ruled",
      DateProgress: "framed",
      PeopleBoard: "five",
      PriceTable: "table",
      SmallStat: "compact",
      ShelfList: "ruled-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "plain",
      ShareChart: "bars",
      /* 图标 + 文字，图标不上色。2026-09-03 放大到两倍才看清楚：
         shadcn Tasks 的状态栏是 🚫 Canceled · ✓ Done，而我们画的是一颗
         有颜色的圆点。台账每天要扫四十行，形状扫得比颜色快，而且印出来还在。 */
      QuickLinks: "rows",
      RecordTableRow: "mark",
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
    facts: "圆角 20px · 无边框、靠阴影分层 · 行高 56px · 正文 15px · 标签不大写",
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
      DaySchedule: "rail",
      DateProgress: "framed",
      PeopleBoard: "three",
      PriceTable: "cards",
      SmallStat: "detailed",
      /* 🔴 boxed → ruled（2026-09-03）。1:1 的裁图上，「今天要跟的」每一行
         **自己带一条框**，而参考那一页（Ant 工作台的「进行中的项目」）
         是一张卡里面几条用细线分开的行。
         而且这一套自己的说明写着「**无边框、靠阴影分层**」——
         量出来 42% 的块带框，一半是这几行造的。**说明跟画面对不上。** */
      ShelfList: "ruled",
      AttachmentList: "tile",
      MarkList: "plain",
      RankList: "person",
      ShareChart: "donut",
      QuickLinks: "chips",
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
      /* 🔴 侧栏 → 顶栏（2026-09-03）。Tabler 的单据页是**顶栏 + 一张居中的纸**，
         而我做成了侧栏。同一个错的另一半。 */
      SystemShell: "top-light-centred",
      RailNav: "full",
      InfoRows: "compact",
      DaySchedule: "framed",
      DateProgress: "framed",
      PeopleBoard: "four",
      PriceTable: "stack",
      SmallStat: "default",
      ShelfList: "boxed-sm",
      AttachmentList: "row",
      MarkList: "ruled",
      RankList: "badge",
      ShareChart: "bars",
      QuickLinks: "tiles",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "split",
      /* card → tinted（2026-09-03）：中台 拿了 card（它的参考是白卡压灰地），
         而这两套本来就是最像的一对。图纸的参考是一张**印出来的单据** ——
         淡底的区块比白卡更接近那张纸。 */
      Panel: "tinted",
      TabbedPanel: "pill",
    },
    avoid: ["极端的密或极端的松"],
  },
  counter: {
    mood: "给批发商这种一天要开二十张单的生意，开系统就是在里面做事，不是在里面看事。暗侧栏、2px 直角、没有阴影，全库最密的正文；开场是一排带小走势的数字卡，图小而多。牺牲的是呼吸感 —— 但这正是 Autocount、进销存那一类他们本来就在用的样子。",
    facts: "圆角 2px · 边框 1px · 无阴影 · 行高 44px · 正文 13px · 中性近黑 #17181a 侧栏 · 选中的一行整条填色",
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
      WorkflowStrip: "track",
      ActionButton: "default",
      Tag: "outline",
      Divider: "tight",
      TrendChart: "area",
      /* 🔴 侧栏 → 顶栏（2026-09-03）。Tabler 的仪表盘是顶栏，不是侧栏。
         「中台要暗侧栏因为像 Autocount」是我写的，参考不是。 */
      SystemShell: "top-light",
      RailNav: "tree",
      /* 台账 也是 compact。去掉线之后它比 台账 更紧 —— 全库最密要在每一个零件上兑现，不是只在行高上。 */
      InfoRows: "compact-bare",
      /* 台账 也是 framed。这一套没有阴影没有圆角，一个带框的日程跟它整页的做法打架。 */
      DaySchedule: "bare",
      DateProgress: "framed",
      PeopleBoard: "five",
      PriceTable: "rows",
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
      /* 🔴 stack → donut（2026-09-03）。组件清单报「缺 圆环」，而 Tabler
         那一页右上角那个 78% 就是**一个中间有洞的环**，不是一条比例条。
         跟招牌那个 `gauge` 不一样：招牌抄的 TailAdmin 是**半圆**，这个是整圈。 */
      ShareChart: "donut",
      QuickLinks: "tiles",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      PageHeader: "ruled",
      /* 🔴 招牌 也是 card。这一套没有阴影、2px 直角 —— 用线分区才是它，卡片是别人的。 */
      /* 🔴 ruled → card（2026-09-03）。像素那把尺把我们这一页读成
         **「一块，1120 宽」**，而 Tabler 那一页是「一行四张、每张 307」。
         根因不是排法，是**块跟地分不开**：`ruled` 只画一条细线，
         於是整页的墨连成一片，眼睛看到的也是一整块板。
         Tabler 的做法正是「白卡压在灰地上，靠地色分开，不是靠阴影」——
         中台的平、密、无阴影全部保住，只是每一块现在有自己的边。 */
      Panel: "card",
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
      /* 🔴 rule → chip（2026-09-03，放大两倍并排之后）。
         Studio Admin 的 CRM 那一页，四个指标是**四张白卡**：标签在上、
         大数字旁边贴一颗涨跌药丸、底下一行「上个月是多少」。
         我们本来是 `rule`（连盒子都没有），所以四个数字直接浮在地上，
         而且两个标签折成两行、四格高度不一样 —— 看起来像还没做完。
         `chip` 这个版式本来就是照这一页量出来的，只是 9-02 装错在台账身上。 */
      StatRow: "chip",
      /* 印在纸上的那一套。一个搜索框印不出来，而这一套的主张就是把印不出来的东西全部拿掉。 */
      /* 🔴 none → search（2026-09-03）。组件清单报「缺 搜索框」——
      Studio Admin 的表格上面有一条筛选框加两个分面，我们那张什么都没有。
      一张四十行的表没有地方打字，是这一页最贵的一个空。 */
      RecordTableTools: "search",
      RecordTable: "plain",
      HeroCard: "stats",
      SiteSteps: "ruled",
      WorkflowStrip: "numbered",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "normal",
      TrendChart: "bar",
      /* 🔴 "side-light-bar"（2026-09-04）：他们的外壳是侧栏 ＋ 一条 48px 的横梁，
         而且内容置中那一条要拿掉 —— 他们的内容是满宽的（`p-6` 之后就到边）。 */
      SystemShell: "side-light-bar",
      /* 🔴 "action" 不是 "quiet"（2026-09-04）。它的参考侧栏顶上是一颗黑色实心的
         Quick Create，而这一套的总览**不画页面标题**（HEADLESS_DASHBOARD），
         所以主要动作只剩这一个家。两件事绑在一起，守卫盯着。 */
      RailNav: "action",
      InfoRows: "compact-bare",
      DaySchedule: "framed",
      DateProgress: "bare",
      PeopleBoard: "four",
      PriceTable: "rows",
      /* 🔴 改成「带上一期」（2026-09-03）。Studio Admin 每一张卡底下都写着
      「$254,200 last month」——**只讲涨了、没讲从多少涨的**是我们跟它最明显的一个差。
      顺带把跟中台重叠的那一根轴分开：两套都加了搜索框之后，它们共用到 7 根，
      而守卫的线是 6。 */
      SmallStat: "detailed",
      ShelfList: "ruled",
      AttachmentList: "row",
      MarkList: "spread",
      RankList: "plain",
      ShareChart: "bars",
      QuickLinks: "rows",
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
      /* 🔴 boxed → iconed（2026-09-03）。TailAdmin 的四张指标卡每一张顶上
         都有一个灰底圆角方块装图标，标签在它下面，数字跟涨跌药丸分列左右。
         我们本来是「标签 → 数字 → 底下一行涨跌」两行，少的那一行正是
         TailAdmin 一眼认得出来的地方。 */
      StatRow: "iconed",
      /* 一块招牌上不会有搜索框。名字跟数字是招牌，其余的小而在下面。 */
      /* 同上：TailAdmin 的顶栏就有一个搜索框，我们那一张表什么都没有。 */
      RecordTableTools: "search",
      RecordTable: "grid",
      HeroCard: "solo",
      SiteSteps: "numbered",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "default",
      Divider: "tight",
      TrendChart: "bar",
      /* 🔴 顶栏 → 侧栏（2026-09-03）。老板：`这个的侧栏的 不是顶栏的…
         你根本就没复刻明白 先把模版照片的组件弄清楚啊`。
         **他讲对了，而且我还替这一条写了「故意不跟」的理由** ——
         那不是判断，那是我没看清楚参考页：TailAdmin 是**侧栏**。
         尺子现在自己会数组件，这一条是它第一次跑就报的「缺 侧栏 · 多 顶栏」。 */
      SystemShell: "side-inset-light",
      RailNav: "quiet",
      InfoRows: "comfortable-bare",
      DaySchedule: "rail",
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
      QuickLinks: "chips",
      RecordTableRow: "pill",
      PhotoFrame: "wide",
      ActionRow: "row",
      ChoiceSelect: "default",
      /* 🔴 centred → split（2026-09-03）。1:1 的裁图上，标题置中之后
         **那颗红色的主要按钮就浮在正中间一条空带上**，看起来像画坏了。
         参考那一页（TailAdmin）的动作在顶栏跟每张卡的头上，一个都不在正中间。
         招牌的身份是**顶栏、大字、颜色少** —— 那三样都不靠置中。
         ⚠️ 这一条是眼睛看到的，尺子十八项没有一项在问「一颗按钮孤不孤单」。 */
      PageHeader: "split",
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
