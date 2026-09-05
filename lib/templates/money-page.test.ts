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

function pageNodes(slug: string, keys: string[], key: PageKey): PuckNode[] {
  const ctx: BusinessContext = {
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
    "zh",
    keys.map((k) => ({ key: k })),
  ) as unknown as { content: PuckNode[] };
  return [...walkNodes(layout.content)];
}

/** 每一个行业里，真的开了钱那几页的那些。 */
const CASES: { where: string; key: PageKey; nodes: PuckNode[] }[] = [];
for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
  for (const key of MONEY) {
    if (!keys.includes(key)) continue;
    CASES.push({ where: `${slug}/${key}`, key, nodes: pageNodes(slug, keys, key) });
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
});
