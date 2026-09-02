/**
 * 每一套后台风格在抄谁 —— 一份，写在代码里。
 *
 * ── 为什么要有这个档案 ────────────────────────────────────────────────────
 * 老板 2026-09-02：`用心去做每一套风格 然后注明起来是什么风格
 * 代码那边就不会排错了`。
 *
 * 在这之前，「台账抄 shadcn 的 Tasks、中台抄 Tabler」只写在
 * [任务 100](../docs/founder-tasks.md) 的一张表里 —— **代码里一个字都没有**。
 * 所以谁都可以在改 `design-doc.ts` 的时候把某一套的偏好挪到别一套身上，
 * 而没有任何东西会红。这个仓库栽在「同一份名单有第二份手抄本」上至少五次
 * （[任务 17](../docs/founder-tasks.md) 的风格名单第四份 · [任务 53](../docs/founder-tasks.md)
 * 的版段 copy · `TEXT_FIELDS_BY_COMPONENT`），这一份就是那个名单的唯一一份。
 *
 * ── 它是什么，不是什么 ────────────────────────────────────────────────────
 * **是**：这一套风格在对齐哪一页、那一页在哪、我们从它那里拿什么。
 * **不是**：一份「照抄清单」。[重点 7c](../docs/founder-points.md) 没有变 ——
 * 换个配色它还是不是另一个设计，这一条仍然是留不留得下来的判准。
 * 抄的是**骨架跟做工**（哪几块 · 什么顺序 · 字级阶梯 · 卡片内距 · 有颜色的面积），
 * 不是代码，也不是颜色。
 *
 * ⚠️ **后台跟官网正好相反**（[任务 77](../docs/founder-tasks.md) 核对过许可）：
 * 客户的官网没有开源可拿，所以那一边整套抄模版；**后台这一边可以直接读 MIT 的代码**。
 *
 * ⚠️ 参考页会改版、会下架。`npm run align:admin` 载不到就算失败，不算通过 ——
 * 一把「量不到就沉默」的尺，跟一把说「你没问题」的尺长得一模一样。
 */

/** 我们六套风格的 key。跟 `STYLE_ORDER` 同一批字，由测试盯着不准漂。 */
export type RegisterKey = "ledger" | "hearth" | "blueprint" | "swiss" | "signboard" | "counter";

export type RegisterReference = {
  /** 这一套风格自己的名字，讲给老板听的。 */
  zh: string;
  /** 抄的那一页叫什么。 */
  reference: string;
  /** 谁做的 + 什么许可。**后台这一边可以拿代码，所以许可要写清楚。** */
  source: string;
  /** 那一页现在在哪。`align:admin` 会真的开它。 */
  url: string;
  /** `.screenshots/admins/` 底下那一张，`npm run shoot:admins` 拍的。 */
  shot: string;
  /**
   * **我们这边要拿哪一页去对。**
   *
   * 🔴 这一栏是 2026-09-02 第一次跑 `align:admin` 之后加的，因为不加就是在
   * 比错东西：台账抄的是一张**只有一张表**的页，而尺子拿我们的**总览**去比它，
   * 於是「一屏几块 2 对 5」被报成差异 —— 那不是我们做错，那是我拿错了页。
   * 对齐要拿**同一种页**去对：一张表的对一张表的，一张单的对一张单的。
   */
  ourPage: string;
  /**
   * 从它那里拿什么 —— **一句讲得出来的东西，不是「参考它的风格」**。
   * 拿不出一句，就代表这一对配得没有理由，那才是要改的地方。
   */
  takes: string;
  /**
   * **故意跟它不一样的地方。**
   *
   * 老板 2026-09-03：`还是差的多`。而六套里有四个红是**我们判过、决定不跟**的：
   * 台账的窄图标栏是它跟另外五套唯一的分别；中台的暗侧栏是「像他们本来在用的
   * 进销存」那句主张的本体，而 Tabler 用的是顶栏。
   *
   * 这几项如果一直红着，那个数字就不再是「还欠几件」，而是
   * 「还欠几件 ＋ 几个已经想清楚的决定」—— 一份读不出来的清单，没有人会看。
   *
   * ⚠️ **它不是消音钮。** 每一条都要写理由，而且守卫会检查那个项目名
   * 真的在尺子的清单里 —— 打错一个字就等於偷偷把一项关掉。
   */
  keeps?: { item: string; why: string }[];
};

export const REGISTER_REFERENCES: Record<RegisterKey, RegisterReference> = {
  /* 装修承包商每天开的那一页：一天扫四十行，要的是找到其中一行。 */
  ledger: {
    zh: "台账",
    reference: "shadcn-admin · Tasks",
    source: "satnaing/shadcn-admin · MIT · ★14k",
    url: "https://shadcn-admin.netlify.app/tasks",
    shot: "shadcn-tasks.jpg",
    takes:
      "整页只有三件事：标题 → 一条会筛的工具条 → 一张长表。" +
      "工具条本身就是那个设计，不是表格上面的装饰。",
    /* 他们那一页是一张表，所以拿我们的报价单去对，不是总览 */
    ourPage: "/en/portal/quotations",
    keeps: [
      { item: "侧栏宽", why: "窄图标栏是台账跟另外五套唯一的分别。改成 240 就跟瑞士、炉长一样了" },
    ],
  },

  /* 沙龙老板开系统的那一刻，客人就站在他旁边。 */
  hearth: {
    zh: "炉",
    reference: "Ant Design Pro · 工作台",
    source: "ant-design/ant-design-pro · MIT · ★38.7k",
    url: "https://preview.pro.ant.design/dashboard/workplace",
    shot: "antd-workplace.jpg",
    takes:
      "开场不是钱，是「今天要做什么」：一句问候、在做的几件、常用的入口。" +
      "数字退到下面去。",
    /* 他们那一页是工作台，对我们的总览 */
    ourPage: "/en/portal/dashboard",
  },

  /* 还讲不清自己做哪一行的老板，最不会出错的那一套。 */
  blueprint: {
    zh: "图纸",
    reference: "Tabler · Invoice",
    source: "tabler/tabler · MIT · ★41.6k",
    url: "https://preview.tabler.io/invoice.html",
    shot: "tabler-invoice.jpg",
    takes:
      "一张可以直接印出来给客人的纸：抬头、逐项、金额靠右、底下一条合计。" +
      "整页零个彩色方块。",
    /* 他们那一页是一张单据，我们的报价单右边就是那张可以印的纸 */
    ourPage: "/en/portal/quotations",
    keeps: [
      { item: "外框", why: "Tabler 那一页用顶栏，而图纸给的是「还讲不清自己做哪一行」的老板 —— 侧栏把每一页摊在他眼前，顶栏要他先记得去哪一个下拉里找" },
      { item: "侧栏宽", why: "他们那一页根本没有侧栏（顶栏 56px），两个数字量的不是同一个东西" },
    ],
  },

  /* 印出来给人看的那一套。一张纸是一栏的。 */
  swiss: {
    zh: "瑞士",
    reference: "Studio Admin · CRM",
    source: "arhamkhnz/next-shadcn-admin-dashboard · MIT · ★3.0k",
    url: "https://next-shadcn-admin-dashboard.vercel.app/dashboard/crm",
    shot: "arham-crm.jpg",
    takes:
      "每一个数字底下都带着「上个月是多少」，图表卡自己讲结论。" +
      "字级阶梯十级，而整页最大的东西是一个数字不是一个词。",
    /* 他们那一页是数字加图表的总览 */
    ourPage: "/en/portal/dashboard",
  },

  /* 店名跟数字就是招牌。 */
  signboard: {
    zh: "招牌",
    reference: "TailAdmin",
    source: "TailAdmin/free-nextjs-admin-dashboard · MIT · ★2.5k",
    url: "https://free-demo.tailadmin.com/",
    shot: "tailadmin.jpg",
    takes: "一个大圆环加一条曲线，颜色少、字大。顶栏不是侧栏。",
    /* 同上 */
    ourPage: "/en/portal/dashboard",
    keeps: [
      { item: "外框", why: "招牌的身份就是顶栏：店名跟数字挂在最上面一条上，那是招牌本身。TailAdmin 用侧栏" },
      { item: "侧栏宽", why: "外框本来就不一样：他们侧栏我们顶栏，一个横的一个竖的，宽度对不起来" },
    ],
  },

  /* 在里面做事，不是在里面看事。少掉的全部让给行数。 */
  counter: {
    zh: "中台",
    reference: "Tabler · 仪表盘",
    source: "tabler/tabler · MIT · ★41.6k",
    url: "https://preview.tabler.io/",
    shot: "tabler.jpg",
    takes:
      "全库最密的一格：小走势图排成一行，一屏塞完。" +
      "细边到处都是（100% 的卡片有边），阴影几乎没有。",
    /* 同上 */
    ourPage: "/en/portal/dashboard",
    keeps: [
      { item: "外框", why: "Tabler 用顶栏，而中台的主张一字不差是「像 Autocount、进销存那一类他们本来就在用的样子」——那一类全部是暗侧栏" },
      { item: "侧栏宽", why: "外框本来就不一样：他们侧栏我们顶栏，一个横的一个竖的，宽度对不起来" },
    ],
  },
};

/** 有没有替这一套声明过参考。`align:admin` 跟守卫都问它。 */
export function referenceFor(register: string): RegisterReference | null {
  return (REGISTER_REFERENCES as Record<string, RegisterReference>)[register] ?? null;
}
