/**
 * 换个款式 — the alternative looks a selected block can be swapped to.
 *
 * WHY THIS FILE EXISTS. The founder selected 重点数字卡 in the editor, looked at
 * the panel that appeared, and said: 「我要的是好像 durable 一样…我看到图片 就是
 * 我可以替换的别的款式 然后我点击就可以替换了」. What was there instead was four
 * text inputs and, further down, a couple of dropdowns labelled 轻重 and 大小.
 *
 * The dropdowns are the interesting failure. The choices already existed — the
 * block could ALREADY be five different buttons or four different tags. They
 * were simply written down as words in a `<select>`, so choosing between them
 * meant reading 「主要（实心）」 and imagining it. Durable's version of this
 * screen shows the shapes and you point at one. Same data, same actions; the
 * difference is entirely whether the customer has to hold the result in their
 * head.
 *
 * So most of what follows is not new capability. It is the axis a block already
 * had, restated as something you can look at. Two blocks needed real work
 * first — 重点数字卡 and 业务流程 had no such axis at all, and got one (see
 * `layout` in hero-card.tsx and workflow-strip.tsx).
 *
 * WHY THESE ARE DISPLAY PROPS AND NOT PRESETS THAT DELETE THINGS. The cheap
 * implementation of 「只有数字」 is a preset that clears `stats` and `spark`.
 * Then the customer's three supporting figures are gone, and picking 「全部」
 * again gives them back empty. Every variant here only ever CHANGES props that
 * describe appearance — nothing a customer typed is ever dropped, so the whole
 * row is safe to click through and compare. That is the property that makes it
 * a picker rather than a decision.
 */

export type Variant = {
  /** Stable within a component. Used as the React key and for the active test. */
  id: string;
  label: string;
  /** The appearance props this variant sets. EVERY variant of a component must
   *  name EVERY key on the axis — including the ones it leaves at their
   *  default — or two variants become indistinguishable to `activeVariant`
   *  below and the picker highlights the wrong tile. */
  props: Record<string, unknown>;
};

/** `false` and "the prop was never written" are the same appearance, and Puck
 *  data written before a variant axis existed has the second one. Comparing
 *  them strictly would leave a block with no tile highlighted, which reads as
 *  "none of these is what you have" — wrong, and the one thing a picker must
 *  never say. */
function same(a: unknown, b: unknown) {
  if (a === b) return true;
  if ((a === undefined || a === false) && (b === undefined || b === false)) return true;
  return false;
}

/** Which tile is lit. Returns the first variant whose every prop matches, or
 *  null when the block has been edited into a state no variant describes —
 *  legitimate, and better shown as "nothing selected" than as a wrong guess.
 *
 *  `defaults` is not optional in practice and the reason is worth stating: a
 *  block saved before its variant axis existed has no such key at all, and
 *  every card in every customer's saved portal is such a block. Comparing the
 *  raw prop lit nothing on a card that was plainly 全部. A prop the data does
 *  not carry renders as its default, so that is what it must be compared as. */
export function activeVariant(
  componentType: string,
  props: Record<string, unknown> | undefined,
  defaults: Record<string, unknown> = {},
): Variant | null {
  const list = VARIANTS[componentType];
  if (!list || !props) return null;
  return (
    list.find((v) =>
      Object.entries(v.props).every(([k, val]) => same(props[k] ?? defaults[k], val)),
    ) ?? null
  );
}

export const VARIANTS: Record<string, Variant[]> = {
  // ---------------------------------------------------------------- 数字卡
  // The block the founder had selected when he asked for this. Five looks off
  // one axis plus the frame: the same figure alone, with its trend, with its
  // breakdown, with both, and unboxed.
  HeroCard: [
    { id: "full", label: "全部", props: { layout: "full", flat: false } },
    { id: "solo", label: "只有数字", props: { layout: "solo", flat: false } },
    { id: "trend", label: "数字 + 走势", props: { layout: "trend", flat: false } },
    { id: "stats", label: "数字 + 细项", props: { layout: "stats", flat: false } },
    { id: "flat", label: "不要框", props: { layout: "full", flat: true } },
  ],

  // ---------------------------------------------------------------- 官网大标题
  // The most consequential picker on the whole website page: it is the first
  // screen, and these four are genuinely different pages rather than four
  // spacings of the same one.
  SiteHero: [
    { id: "left", label: "左对齐", props: { layout: "left" } },
    { id: "band", label: "整片底色", props: { layout: "band" } },
    { id: "center", label: "置中", props: { layout: "center" } },
    { id: "plain", label: "只有一句话", props: { layout: "plain" } },
    // The one that puts a FIGURE on the right. It is listed last because
    // switching TO it needs a `figure` prop to have something to draw --
    // without one it renders exactly like 左对齐 rather than breaking.
    { id: "split", label: "左字右图", props: { layout: "split" } },
  ],

  // ---------------------------------------------------------------- 询价表格
  EnquiryForm: [
    { id: "card", label: "一个框", props: { look: "card" } },
    { id: "plain", label: "不要框", props: { look: "plain" } },
    { id: "split", label: "左右分", props: { look: "split" } },
  ],

  // ---------------------------------------------------------------- 业务流程
  // 竖排 is the one that matters and it is a phone fix: five renovation stages
  // wrap the horizontal strip into three ragged rows on a 390px screen.
  WorkflowStrip: [
    { id: "row", label: "横排箭头", props: { layout: "row" } },
    { id: "timeline", label: "竖排时间线", props: { layout: "timeline" } },
    { id: "numbered", label: "大编号", props: { layout: "numbered" } },
  ],

  // ---------------------------------------------------------------- 记录表格
  // The block a contractor opens first, because it is the one holding their
  // jobs. Four looks they already read fluently off a spreadsheet.
  RecordTable: [
    { id: "plain", label: "一行一条", props: { look: "plain" } },
    { id: "compact", label: "紧凑（一页看更多）", props: { look: "compact" } },
    { id: "zebra", label: "隔行底色", props: { look: "zebra" } },
    { id: "grid", label: "有格线", props: { look: "grid" } },
  ],

  // ---------------------------------------------------------------- 分栏
  Columns: [
    { id: "half", label: "对半分", props: { layout: "half" } },
    { id: "wide-left", label: "左边宽", props: { layout: "wide-left" } },
    { id: "wide-right", label: "右边宽", props: { layout: "wide-right" } },
    { id: "thirds", label: "三栏", props: { layout: "thirds" } },
  ],

  // ---------------------------------------------------------------- 页面框架
  // The single highest-leverage picker in the editor: it is the only control
  // that changes what the WHOLE system looks like, and until now it was two
  // radio groups whose combined effect you could not see without trying all
  // four.
  SystemShell: [
    { id: "side-dark", label: "左边 · 跟配色", props: { nav: "side", navTone: "dark" } },
    { id: "side-deep", label: "左边 · 深色", props: { nav: "side", navTone: "deep" } },
    { id: "side-light", label: "左边 · 白底", props: { nav: "side", navTone: "light" } },
    { id: "top-dark", label: "顶部 · 跟配色", props: { nav: "top", navTone: "dark" } },
    { id: "top-deep", label: "顶部 · 深色", props: { nav: "top", navTone: "deep" } },
    { id: "top-light", label: "顶部 · 白底", props: { nav: "top", navTone: "light" } },
  ],

  // ------------------------------------------------- 已经有轴、却接不到的六个
  //
  // None of these needed a line of component code. Every one already carried an
  // appearance prop -- InfoRows has had `variant` and `framed` since it was
  // written, PriceTable has had `layout`, PeopleBoard has had `columns` -- and
  // none of them was in this file, so none of them appeared in 换个款式 and no
  // register could express a preference for one.
  //
  // Measured before this: 14 of 57 components had a variant axis here and 7 had
  // a register preference. The capability-to-reachability gap was the whole
  // problem, not a shortage of capability.
  InfoRows: [
    { id: "comfortable", label: "宽松 · 有框", props: { variant: "comfortable", framed: true } },
    { id: "comfortable-bare", label: "宽松 · 不要框", props: { variant: "comfortable", framed: false } },
    { id: "compact", label: "紧凑 · 有框", props: { variant: "compact", framed: true } },
    { id: "compact-bare", label: "紧凑 · 不要框", props: { variant: "compact", framed: false } },
  ],

  DaySchedule: [
    { id: "framed", label: "有框", props: { framed: true } },
    { id: "bare", label: "不要框", props: { framed: false } },
  ],

  DateProgress: [
    { id: "framed", label: "有框", props: { framed: true } },
    { id: "bare", label: "不要框", props: { framed: false } },
  ],

  PeopleBoard: [
    { id: "two", label: "两栏（大头像）", props: { columns: 2 } },
    { id: "three", label: "三栏", props: { columns: 3 } },
    { id: "four", label: "四栏", props: { columns: 4 } },
    { id: "five", label: "五栏（人多）", props: { columns: 5 } },
  ],

  PriceTable: [
    { id: "cards", label: "一个方案一张卡", props: { layout: "cards" } },
    { id: "table", label: "并排比较表", props: { layout: "table" } },
  ],

  // ------------------------------------------------------------- 指标排
  //
  // The axis is the CONTAINER, not the content. A register with no shadows must
  // not be handed a raised tile and one with no borders must not be handed a
  // boxed one -- which is why 「没有盒子」 is a real choice here rather than a
  // weaker version of 「有框」.
  StatRow: [
    { id: "tinted", label: "有底色图案", props: { layout: "tinted" } },
    { id: "boxed", label: "有框", props: { layout: "boxed" } },
    { id: "rule", label: "没有盒子", props: { layout: "rule" } },
    { id: "lead", label: "第一个最大", props: { layout: "lead" } },
  ],

  SmallStat: [
    { id: "default", label: "一般", props: { variant: "default" } },
    { id: "compact", label: "紧凑", props: { variant: "compact" } },
    { id: "detailed", label: "带说明", props: { variant: "detailed" } },
  ],

  // ---------------------------------------------------------------- 标签页
  //
  // A tab strip is one of the few controls a customer reads as "this software's
  // house style" before reading any content, and it had exactly one look.
  TabbedPanel: [
    { id: "pill", label: "药丸", props: { look: "pill" } },
    { id: "underline", label: "底线", props: { look: "underline" } },
    { id: "segment", label: "分段控制", props: { look: "segment" } },
    { id: "plain", label: "只有字", props: { look: "plain" } },
  ],

  // ------------------------------------------------ 页面标题 · 卡片分区
  //
  // The first thing on every page, and the container everything else sits in.
  // Both had no alternative look until 2026-08-23 -- so whatever a register
  // said, every page opened with the same left/right heading and every section
  // was the same shadcn Card with a header. Between them they are most of the
  // reason twenty-two registers still read as one design.
  PageHeader: [
    { id: "split", label: "标题左 · 按钮右", props: { layout: "split" } },
    { id: "stacked", label: "按钮放下面", props: { layout: "stacked" } },
    { id: "centred", label: "置中", props: { layout: "centred" } },
    { id: "ruled", label: "下面一条线", props: { layout: "ruled" } },
  ],

  Panel: [
    { id: "card", label: "一张卡", props: { look: "card" } },
    { id: "tinted", label: "标题带底色", props: { look: "tinted" } },
    { id: "plain", label: "不要框", props: { look: "plain" } },
    { id: "ruled", label: "标题下一条线", props: { look: "ruled" } },
  ],

  // ---------------------------------------------- 从别人的 dashboard 组出来的
  //
  // Registered WITH an axis on day one, deliberately. 43 of the previous 57
  // components had none, which is why twenty-two registers still read as one
  // design -- a register can only differ where a component offers it a choice.
  ShelfList: [
    { id: "boxed", label: "每项一个框", props: { size: "default", separated: false } },
    { id: "boxed-sm", label: "每项一个框 · 紧凑", props: { size: "sm", separated: false } },
    { id: "ruled", label: "一条线分开", props: { size: "default", separated: true } },
    { id: "ruled-sm", label: "一条线分开 · 紧凑", props: { size: "sm", separated: true } },
  ],

  AttachmentList: [
    { id: "row", label: "一行一个", props: { orientation: "horizontal" } },
    { id: "tile", label: "并排小方块", props: { orientation: "vertical" } },
  ],

  MarkList: [
    { id: "plain", label: "只有字", props: { rule: "default" } },
    { id: "ruled", label: "每条下面一条线", props: { rule: "border" } },
    { id: "spread", label: "线拉到两边", props: { rule: "separator" } },
  ],

  PhotoFrame: [
    { id: "photo", label: "相片 4:3", props: { ratio: "photo" } },
    { id: "wide", label: "宽 16:9", props: { ratio: "wide" } },
    { id: "square", label: "正方", props: { ratio: "square" } },
  ],

  ActionRow: [
    { id: "row", label: "横排", props: { orientation: "horizontal" } },
    { id: "column", label: "直排（手机）", props: { orientation: "vertical" } },
  ],

  ChoiceSelect: [
    { id: "default", label: "一般", props: { size: "default" } },
    { id: "sm", label: "紧凑", props: { size: "sm" } },
  ],

  // ---------------------------------------------------------------- 侧栏
  //
  // WHY THIS WAS MISSING, AND WHY IT IS THE MOST EXPENSIVE THING THAT WAS.
  //
  // Measured 2026-08-23: of the 57 components in 组件库, 14 had a variant axis
  // and 7 had a register preference. The other 43 had no alternative look at
  // all -- and that 43 included RailNav and Panel, which are the two largest
  // surfaces on every single page. So a customer switching between 21 registers
  // watched the small things change (tags, dividers, charts) while the sidebar
  // and the panels stayed identical, which is exactly why it read as 「还是
  // 一样的东西」.
  //
  // RailNav had carried three real densities since it was written. They were
  // reachable only by editing the prop by hand: not in this file, so not in
  // 换个款式, and not in any register's `prefer`. The capability existed and
  // nothing could reach it.
  RailNav: [
    { id: "full", label: "完整（图标 + 分组）", props: { variant: "full" } },
    { id: "compact", label: "只有图标", props: { variant: "compact" } },
    { id: "quiet", label: "只有文字", props: { variant: "quiet" } },
  ],

  // ---------------------------------------------------------------- 按钮
  ActionButton: [
    { id: "default", label: "主要", props: { variant: "default" } },
    { id: "secondary", label: "次要", props: { variant: "secondary" } },
    { id: "outline", label: "描边", props: { variant: "outline" } },
    { id: "ghost", label: "很淡", props: { variant: "ghost" } },
    { id: "destructive", label: "危险", props: { variant: "destructive" } },
  ],

  // ---------------------------------------------------------------- 标记
  Tag: [
    { id: "default", label: "实心", props: { variant: "default" } },
    { id: "secondary", label: "淡色", props: { variant: "secondary" } },
    { id: "outline", label: "描边", props: { variant: "outline" } },
    { id: "destructive", label: "警示", props: { variant: "destructive" } },
  ],

  // ---------------------------------------------------------------- 状态标记
  StatusDot: [
    { id: "positive", label: "好", props: { tone: "positive" } },
    { id: "warning", label: "留意", props: { tone: "warning" } },
    { id: "negative", label: "不好", props: { tone: "negative" } },
    { id: "neutral", label: "普通", props: { tone: "neutral" } },
  ],

  // ---------------------------------------------------------------- 趋势图
  TrendChart: [
    { id: "bar", label: "柱状", props: { kind: "bar" } },
    { id: "line", label: "折线", props: { kind: "line" } },
    { id: "area", label: "面积", props: { kind: "area" } },
  ],

  // ---------------------------------------------------------------- 提醒条
  Alert: [
    { id: "default", label: "一般提醒", props: { variant: "default" } },
    { id: "destructive", label: "警告", props: { variant: "destructive" } },
  ],

  // ---------------------------------------------------------------- 空状态
  EmptyState: [
    { id: "empty", label: "还没有资料", props: { variant: "empty" } },
    { id: "filtered", label: "筛选后没有", props: { variant: "filtered" } },
    { id: "cleared", label: "全部做完了", props: { variant: "cleared" } },
  ],

  // ---------------------------------------------------------------- 分隔线
  Divider: [
    { id: "tight", label: "靠近", props: { spacing: "tight" } },
    { id: "normal", label: "正常", props: { spacing: "normal" } },
    { id: "loose", label: "拉开", props: { spacing: "loose" } },
  ],
};
