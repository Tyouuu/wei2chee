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
