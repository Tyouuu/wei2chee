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

const STYLES: Record<StyleName, StyleBrief> = {
  ledger: {
    mood: "一本账簿。密、准、没有装饰。给每天要看几十条记录的人。",
    facts: "圆角 4px · 边框 1px · 无阴影 · 行高 32px · 正文 13px · 标签全大写",
    prefer: {
      RecordTable: "compact",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "tight",
      TrendChart: "line",
    },
    avoid: ["大圆角的卡片", "大段留白", "把一页只放一两块东西"],
  },
  hearth: {
    mood: "一间店的前台。圆、暖、宽松。给客人会看到的页面。",
    facts: "圆角 20px · 无边框、靠阴影分层 · 行高 52px · 正文 15px · 标签不大写",
    prefer: {
      RecordTable: "zebra",
      HeroCard: "full",
      WorkflowStrip: "numbered",
      ActionButton: "default",
      Tag: "secondary",
      Divider: "loose",
      TrendChart: "area",
    },
    avoid: ["硬边框", "把行挤到 32px", "全大写的标签"],
  },
  blueprint: {
    mood: "一份图纸。中性、清楚、不抢眼。什么生意都不会出错的那一套。",
    facts: "圆角 12px · 边框 1px · 淡阴影 · 行高 42px · 正文 14px · 标签不大写",
    prefer: {
      RecordTable: "plain",
      HeroCard: "full",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "default",
      Divider: "normal",
      TrendChart: "bar",
    },
    avoid: ["极端的密或极端的松"],
  },
  bare: {
    mood: "没有框。靠空白和一条线分区,不靠盒子。给东西少、要显得贵的页面。",
    facts: "无边框 · 无阴影 · 卡片没有内距 · 行高 48px · 行距 1.7 · 标签全大写",
    prefer: {
      RecordTable: "plain",
      HeroCard: "flat",
      WorkflowStrip: "numbered",
      ActionButton: "ghost",
      Tag: "outline",
      Divider: "loose",
      TrendChart: "line",
    },
    avoid: ["加边框", "加阴影", "用实心按钮", "把东西装进盒子里"],
  },
  large: {
    mood: "给看不清楚的人。字大、行高、对比强。老板五六十岁、在车上用手机看的时候就选这个。",
    facts: "正文 17px · 行高 56px · 行距 1.75 · 最小的字也有 13px · 强调色对比 7.4:1",
    prefer: {
      RecordTable: "plain",
      HeroCard: "solo",
      WorkflowStrip: "numbered",
      ActionButton: "default",
      Tag: "default",
      Divider: "loose",
      TrendChart: "bar",
    },
    avoid: ["把字缩小", "一行塞很多栏", "用很淡的灰色写重要的字", "紧凑的表格"],
  },
  stamp: {
    mood: "像他们本来就在用的 POS / 会计软件。表头是一条实心色带、白字。",
    facts: "表头实心 · 圆角 4px · 边框 1px · 行高 36px · 标签全大写",
    prefer: {
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "default",
      Divider: "tight",
      TrendChart: "bar",
    },
    avoid: ["大圆角", "把表头做成细线", "大段留白"],
  },
  contract: {
    mood: "像一份印出来要签名的文件。中英文都用衬线,行距宽,几乎没有圆角。",
    facts: "全衬线 · 正文 15px · 行距 1.75 · 圆角 2px · 无阴影 · 强调色几乎退掉",
    prefer: {
      RecordTable: "plain",
      HeroCard: "solo",
      WorkflowStrip: "timeline",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "normal",
      TrendChart: "line",
    },
    avoid: ["鲜艳的按钮", "圆角卡片", "把文字挤在一起"],
  },
  // The two that came from a published brief rather than from this file's own
  // hand -- see design-system/tokens/{swiss,soft}.css for where each came from.
  swiss: {
    mood: "像一张印出来的资料表。黑白为主,只有一个红,用在必须被找到的地方。",
    facts: "全直角 · 边框 1px · 无阴影 · 标签全大写字距 0.12em · 强调色瑞士红",
    prefer: {
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "numbered",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "normal",
      TrendChart: "bar",
    },
    avoid: ["圆角", "阴影", "第二种强调色", "装饰性的图案"],
  },
  soft: {
    mood: "没有边,只有浮起来。卡片跟页面同一个颜色,靠一对阴影分开。摸起来软的那种。",
    facts: "圆角 18–26px · 无边框 · 一对明暗阴影 · 按钮全圆 · 动画 200ms",
    prefer: {
      RecordTable: "plain",
      HeroCard: "trend",
      WorkflowStrip: "row",
      ActionButton: "default",
      Tag: "secondary",
      Divider: "loose",
      TrendChart: "area",
    },
    avoid: ["硬边框", "直角", "高对比的分隔线"],
  },
  brut: {
    mood: "有重量。3px 的黑框、不带模糊的偏移阴影,像盖上去的第二层印。响,但整齐。",
    facts: "圆角 12px · 边框 3px 纯黑 · 阴影 4px 4px 0(不模糊) · 字重 800/900 · 行高 50px · 强调色桃红",
    prefer: {
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "numbered",
      ActionButton: "default",
      Tag: "default",
      Divider: "normal",
      TrendChart: "bar",
    },
    avoid: ["细线", "柔和的阴影", "低对比的灰", "渐变"],
  },
  ink: {
    mood: "留白。一张宣纸,墨色的字,一枚朱红的印。东西不多,每一样都站得开。",
    facts: "内距 40px · 行高 76px · 正文 17px · 圆角 0 · 无阴影 · 宋体 · 强调色朱红 #c41e3a · 底色宣纸 #f5f1e8",
    prefer: {
      // Nothing boxed, nothing banded: at this much padding a gridline is a
      // second structure competing with the space itself.
      RecordTable: "plain",
      // The number alone. A card that already has 40px of air around it does
      // not also need three supporting figures inside it.
      HeroCard: "solo",
      // 竖排, which is both the only workflow layout that survives a narrow
      // column and the one that reads as a scroll rather than as a pipeline.
      WorkflowStrip: "timeline",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "loose",
      TrendChart: "line",
    },
    avoid: ["满版的色块", "圆角", "阴影", "把东西挤在一起", "多过一个强调色"],
  },
  signboard: {
    mood: "招牌那一个。店名用又窄又粗的字排到 46px、字距收紧,下面的价目跟内文是普通的 15px。整套里第一个「标题跟内文不同一个字体」的版式——差别就在这个对比,不在颜色。",
    facts: "标题字 Archivo Narrow 46px 字距 -0.03em · 内文 15px · 招牌红 #c8102e · 暖白底 #f7f4ef · 圆角 0 · 无阴影 · 标签全大写",
    prefer: {
      RecordTable: "grid",
      HeroCard: "solo",
      WorkflowStrip: "row",
      ActionButton: "solid",
      Tag: "solid",
      Divider: "tight",
      TrendChart: "bar",
    },
    avoid: ["圆角", "阴影", "细字的标题", "第二个强调色", "把标题缩到跟内文一样大"],
  },
  kraft: {
    mood: "牛皮纸板。整页是中间调的土黄,不是白纸也不是黑屏;卡片用双线框,像货箱上的标签。字全大写、拉开,像印上去的。",
    facts: "底色牛皮 #c9bca2(亮度 0.55) · 卡片 #dbd0b9 · 双线边框 3px · 圆角 0 · 无阴影 · 正文 13px 行高 32px · 标签全大写字距 0.16em · 强调色 #8c3a1e",
    prefer: {
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "numbered",
      ActionButton: "solid",
      Tag: "solid",
      Divider: "tight",
      TrendChart: "bar",
    },
    avoid: ["圆角", "阴影", "白色的大色块", "细字", "第二个强调色"],
  },
  grain: {
    mood: "摸得到的那一个。纸有颗粒,卡片的颗粒比底还重一点,像一张压在纸上的印刷品。一个平的蓝,不做渐层。",
    facts: "底色暖白 #eeebe3 带噪点 · 卡片 #faf8f2 噪点更重 · 无阴影 · 圆角 0 · 边框 1px · 正文 15px 无衬线 · 一个平色 #2b4bd6",
    prefer: {
      // Rules, because a printed sheet separates columns with rules. A zebra
      // band on a textured ground reads as a smudge.
      RecordTable: "grid",
      HeroCard: "full",
      WorkflowStrip: "numbered",
      // A flat spot colour is either printed or it is not -- so the button is
      // filled, never outlined and never gradient.
      ActionButton: "solid",
      Tag: "solid",
      Divider: "tight",
      TrendChart: "bar",
    },
    avoid: ["阴影", "渐层", "圆角", "第二个强调色", "纯黑的字"],
  },
  night: {
    mood: "关了灯的那一个。整页近黑,卡片比页面亮一点点,左上角一小片很淡的蓝光。强调色是会发亮的橘。",
    facts: "底色 #0d1117 · 卡片 #161b22 · 边框白色 8% · 正文 #e8edf4 13px · 行高 32px · 圆角 3px · 强调色 #ff7a45",
    prefer: {
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
    },
    avoid: ["大面积的浅色块", "纯白的字", "柔和的淡色阴影", "第二个会发亮的颜色"],
  },
  glass: {
    mood: "看得穿的那一个。卡片是半透明的白,底下是三团很淡的颜色,卡片会把底下糊掉——像一块真的玻璃压在纸上。",
    facts: "卡片白 55% 透明 · 背后模糊 20px · 底色三团渐层 · 圆角 18px · 1px 白色亮边 · 阴影往下散不往右偏 · 强调色靛蓝 #4f46e5",
    prefer: {
      // Rules would be a second edge competing with the pane's own lit border,
      // and at 55% white a gridline reads as dirt on the glass.
      RecordTable: "plain",
      // Two panes overlapping is what says "glass"; one number on one pane
      // does not. 数字卡 keeps its supporting figures for that reason.
      HeroCard: "full",
      WorkflowStrip: "row",
      // A filled button on a translucent card is the one solid object in the
      // frame, which is exactly the contrast this register is built on.
      ActionButton: "solid",
      Tag: "soft",
      Divider: "loose",
      TrendChart: "area",
    },
    avoid: ["实心的深色大色块", "照片当底", "把两块玻璃叠在同一个位置", "细到 1px 的正文"],
  },
  docket: {
    mood: "一张真的表格。直角、硬线、像印出来要签名的单据。",
    facts: "圆角 0 · 边框 2px · 无阴影 · 行高 32px · 正文 13px · 标签全大写、字距 0.14em",
    prefer: {
      RecordTable: "grid",
      HeroCard: "stats",
      WorkflowStrip: "row",
      ActionButton: "outline",
      Tag: "outline",
      Divider: "tight",
      TrendChart: "bar",
    },
    avoid: ["圆角", "阴影", "柔和的淡色块"],
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
  return STYLES[style as StyleName]?.prefer ?? {};
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
  const brief = STYLES[style as StyleName];
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
