/**
 * 钱那三页 —— 收款 · 开销 · 佣金 —— 不可以再是同一张脸。
 *
 * ── 为什么有这一支（2026-09-05）────────────────────────────────────────────
 *
 * 十七页里六页长得一模一样（月份 → 一个大数字 → 一张表），而钱那三页是其中
 * 最像的一组。老板指着它讲了两次：`我不要一直都是同个组件` · `这一点很重要`。
 *
 * 🔴 而其中最贵的一条不是「不好看」，是**算好了没画**：
 * `buildLedgerHeadline`（lib/portal/live-months.ts）从写出来那天就在算
 * **六个月的走势**，投影 `withLiveStats` 也把它送到页面上了 ——
 * 而这三页从来没有一个 `TrendChart` 接得住它。算好、送到、丢掉。
 * 这个仓库第二十一次「能力有、线没接」。
 *
 * 所以这一支守三件，三件都是「它到底是不是另一个东西」：
 *   ① 那张图要在（不然那份算好的走势又被丢掉一次）
 *   ② 那个数字区要是**一个矩形切成格**，不是一张大卡
 *   ③ 要有一条**比例条**（钱集中在谁身上），那是参考那一页右上角那一块
 *
 * ⚠️ 它量的是**产生器**，不是浏览器。它答不了「画出来好不好看」——
 * 那只有眼睛答得了（[重点 24]）。它只答：**这几块有没有在页面上。**
 */
import { describe, expect, it } from "vitest";
import {
  PAGES_FOR_INDUSTRY,
  buildPageLayout,
  type BusinessContext,
  type PageKey,
} from "./industry-template";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";

/** 钱那三页。收款自己有一支 `buildPayments`，另外两页走 `buildFromShape` ——
 *  **两条路，一张脸**，所以三页都要问一次。 */
const MONEY: PageKey[] = ["payments", "expenses", "commission"] as PageKey[];

/* 🔴 两种语言都要走。栏名是**一页一份、每种语言各一份**手写的，
   而 2026-09-08 佣金那一页两份都写反了 —— 一把只走中文的尺，
   看不到只错在英文那一半的下一次。 */
const LANGS = ["zh", "en"] as const;

function pageNodes(slug: string, keys: string[], key: PageKey, lang: "zh" | "en"): PuckNode[] {
  const ctx: BusinessContext = {
    /* 🔴 块里的字跟**系统语言**走（`ctx.lang`），不是跟 `buildPageLayout`
       第四个参数走 —— 那一个是 locale（Formae 的介面语言）。
       我第一版只传了后者，於是两轮拿到的是同一份英文，
       **中文那一份从来没有被走过**，而 2026-09-08 那个 bug 两份都有。 */
    lang,
    industry: {
      slug,
      name_zh: slug,
      labels: { customer: "客户", order: "单", staff: "师傅" },
      default_workflow: [],
      suggested_modules: [],
    },
  };
  const layout = buildPageLayout(
    key,
    ctx,
    "兴发",
    lang,
    keys.map((k) => ({ key: k })),
  ) as unknown as { content: PuckNode[] };
  return [...walkNodes(layout.content)];
}

/** 每一个行业里，真的开了钱那几页的那些。 */
const CASES: { where: string; key: PageKey; nodes: PuckNode[]; lang: "zh" | "en" }[] = [];
for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
  for (const key of MONEY) {
    /* 🔴 **不筛掉开局没有的那两页。**
       这一档叫「钱那三页」，而 `expenses` 跟 `commission` **不在任何一个
       行业的开局清单里**（八个行业开局都是 总览·客户·单据·收款·官网）——
       所以在 2026-09-08 之前，`CASES` 里永远只有 `payments` 一页，
       而底下那条叫「三页用的是同一支骨架」的断言，比的是一个只有一个元素的
       阵列，**永远为真**。整档六条守的是一页。

       他自己加得出那两页（AI 加、或者「加一页」那个对话框），
       所以这里把三页都摆进他的页面清单再产生一次 —— 那正是他真的会看到的样子。 */
    const all = keys.includes(key) ? keys : [...keys, key];
    for (const lang of LANGS) {
      CASES.push({ where: `${slug}/${key}·${lang}`, key, lang, nodes: pageNodes(slug, all, key, lang) });
    }
  }
}

const typesOf = (nodes: PuckNode[]) => nodes.map((n) => n.type);

describe("钱那三页照 finance 抄的骨架", () => {
  it("这几页真的存在，不然下面每一条都是在量空气", () => {
    expect(CASES.length).toBeGreaterThan(0);
  });

  it("🔴 每一页都画那张走势图 —— 那份资料早就算好了", () => {
    const missing = CASES.filter((c) => !typesOf(c.nodes).includes("TrendChart"));
    expect(
      missing.map((m) => m.where),
      "buildLedgerHeadline 在算六个月的走势，而这几页没有地方接住它",
    ).toEqual([]);
  });

  it("数字区是一个矩形切成格，不是一张大卡", () => {
    for (const c of CASES) {
      const stat = c.nodes.find((n) => n.type === "StatRow");
      expect(stat, `${c.where} 没有 StatRow`).toBeTruthy();
      expect(
        (stat!.props as { layout?: string }).layout,
        `${c.where} 的数字区不是 quad`,
      ).toBe("quad");
      /* 那张「一个大数字」的卡要走 —— 它就是三页长得一样的那个原因。 */
      expect(typesOf(c.nodes), `${c.where} 还留着 HeroCard`).not.toContain("HeroCard");
    }
  });

  it("有一条比例条 —— 钱集中在谁身上", () => {
    for (const c of CASES) {
      const rank = c.nodes.find((n) => n.type === "RankList");
      expect(rank, `${c.where} 没有 RankList`).toBeTruthy();
      expect((rank!.props as { shape?: string }).shape, `${c.where} 不是 bars`).toBe("bars");
      /* 标题要是这一页自己的问题（谁付得最多 · 钱给了谁 · 谁抽得最多），
         不是一句通用的「排行」。它住在外面那张卡上 —— 参考那一页两块都是卡，
         一边有卡一边没有，读起来像其中一块还没做完。 */
      const card = c.nodes.find(
        (n) => n.type === "Panel" && String((n.props as { id?: unknown }).id ?? "").endsWith("-top-card"),
      );
      expect(card, `${c.where} 的比例条没有装进一张卡`).toBeTruthy();
      expect(String((card!.props as { title?: string }).title ?? "").length).toBeGreaterThan(1);
    }
  });

  it("🔴 那两格数字只给填得满的格数 —— 多给一格，他记下第一笔之后就少一格", () => {
    for (const c of CASES) {
      const stat = c.nodes.find((n) => n.type === "StatRow");
      const tiles = (stat!.props as { tiles?: unknown[] }).tiles ?? [];
      /* `buildLedgerHeadline` 今天回两个事实。`withLiveStats` 是
         `stats.tiles.slice(0, 这里的格数)` —— 给四格只填得了两格，
         就是一个「有资料之后自己缩水」的画面。 */
      expect(tiles.length, `${c.where} 的格数`).toBe(2);
    }
  });

  it("三页用的是同一支骨架，不是三份手抄", () => {
    const shapes = CASES.map((c) =>
      typesOf(c.nodes).filter((t) =>
        ["StatRow", "TrendChart", "RankList", "RecordTable"].includes(t),
      ).join(">"),
    );
    expect(new Set(shapes).size, `三页画出来的骨架不一样：${[...new Set(shapes)].join(" | ")}`).toBe(1);
  });

  /* ───────────────────────────────────────────────────────────────────────
     🔴 一个栏名不可以在一页当第一栏、在另一页当第二栏。

     2026-09-08 拍到的：佣金那一页的表头写着 **Paid to | Basis**，
     而底下印的是 **「Setapak office partition — crew share」| 「Painting team」**
     —— 两栏都在骗人，而且那一页最要紧的那一栏（谁拿了这笔钱）挂在
     一个写着「怎么算的」的标题底下。

     根因：`live-rows.ts` 的 ledger 投影**三页共用一份**（`primary` 是
     他自己打的备注 · `secondary` 是对方），而栏名是**一页一页手写的**，
     佣金那一页写反了。收款（For | Client）跟开销（Expense | Paid to）是对的。

     [任务 80](../../docs/founder-tasks.md)：**对的数字配错的标签，比空白更糟**
     —— 一桌示例会自己招认，一个挂错标题的数字不会。

     ⚠️ **这一条不手写任何名单**（这个仓库栽在「第二份手写清单」上至少八次）：
     它拿三页自己的栏名互相比。`Paid to` 在开销是第二栏、在佣金是第一栏 ——
     那个撞名本身就是那个 bug。

     🔴 **而它只抓得到「撞名」，抓不到「对调」本身 —— 实测过。**
     故意只弄坏中文那一份（`结算对象 | 计算方式`）它**不红**：
     中文的开销是 `开销项目 | 付给谁`，两边没有一个字撞上。
     英文那一次红得了，是因为 `Paid to` 刚好同时是开销的第二栏。
     → **它只能否决**（[重点 24](../../docs/founder-points.md)）。
     一页栏名对不对得上底下那几行，最后还是要打开那一页用眼睛看。 */
  it("🔴 钱那三页的栏名，不可以一页当第一栏、另一页当第二栏", () => {
    const firsts = new Map<string, string[]>();
    const seconds = new Map<string, string[]>();
    /* 按语言分开比 —— 中文的「结算对象」跟英文的 `Paid to` 不是同一个字，
       混在一起比，两边都撞不到。 */
    for (const c of CASES) {
      const table = c.nodes.find((n) => n.type === "RecordTable");
      /* 🔴 栏位住在 `props.table.columns`，不是 `props.columns` ——
         我第一版读错地方，拿到空阵列，於是**弄坏它照样全绿**
         （这个 session 第五次踩到「一条什么都没保护的守卫」）。
         `?? []` 会把这个错静静吞掉，所以这里读不到就直接红。 */
      const cols = (table!.props as { table?: { columns?: { key: string; label: string }[] } })
        .table?.columns;
      expect(cols, `${c.where} 的表读不到栏位 —— 这一条在量空气`).toBeTruthy();
      /* 位置是投影自己定的（live-rows.ts：primary 是备注 · secondary 是对方），
         所以照 key 找，不照顺序。 */
      const a = cols!.find((x) => x.key === "primary");
      const b = cols!.find((x) => x.key === "secondary");
      const tag = (l: string) => `${c.lang}:${l}`;
      if (a) (firsts.get(tag(a.label)) ?? firsts.set(tag(a.label), []).get(tag(a.label))!).push(c.where);
      if (b) (seconds.get(tag(b.label)) ?? seconds.set(tag(b.label), []).get(tag(b.label))!).push(c.where);
    }
    const clash = [...firsts.keys()].filter((label) => seconds.has(label));
    expect(
      clash,
      clash
        .map(
          (l) =>
            `「${l}」在 ${firsts.get(l)!.join("·")} 是第一栏，` +
            `在 ${seconds.get(l)!.join("·")} 是第二栏 —— 两页里有一页的表头在骗人`,
        )
        .join("；"),
    ).toEqual([]);
  });
});
