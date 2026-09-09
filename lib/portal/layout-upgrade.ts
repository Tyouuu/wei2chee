import { upgradeRecordTableProps } from "./table-model";
import { DEFAULT_SYSTEM_LANG, type SystemLang } from "@/lib/system-lang";

/**
 * Brings a saved layout up to the current component shapes, on load.
 *
 * WHY ON LOAD AND NOT IN A SQL MIGRATION. `project_pages.layout_json` is opaque
 * JSON written by customers who in some cases have paid for it, and it is the
 * only copy — there is no export, no history behind it. A migration that
 * rewrites every row is one bad assumption away from destroying work that
 * cannot be recovered. Upgrading on read costs one pass over a small tree, is
 * idempotent, and fails safe: if a node is not the shape this expects, it is
 * returned untouched rather than replaced with a default.
 *
 * The old shape then dies out naturally — a customer's next save writes the new
 * one — and nothing in the app has to keep two readers alive for ever.
 *
 * WHY IT MATTERS THAT THE EDITOR SEES THE NEW SHAPE. Puck's fields panel edits
 * exactly the props it is handed. A RecordTable that still carried
 * `primaryLabel`/`rows` would show the customer BOTH the new column editor and
 * a stale row editor writing to a prop nothing renders — two controls, one of
 * which silently does nothing. So the upgrade has to happen before Puck is
 * mounted, not lazily inside the component.
 */

type Node = { type?: string; props?: Record<string, unknown> };

/** 这一趟有没有拿掉过一排按不动的筛选。见 `isDeadFilterRow` 跟
 *  `turnOnRealSegments` —— 拿掉一个控件之后要把会动的那个放回去，
 *  不然那一页只是少了一样东西。单执行绪、一趟一设，`upgradeLayout` 开头归零。 */
let droppedFilterRow = false;

const isNode = (v: unknown): v is Node =>
  typeof v === "object" && v !== null && typeof (v as Node).type === "string";

/** Any prop whose value is an array of nodes is a slot — SystemShell's
 *  `sidebar`/`main` today, and whatever a future component adds without this
 *  file needing to hear about it.
 *
 *  flatMap rather than map since 2026-08-25: one upgrade turns a single node
 *  into two. See splitHeroCard. */
function upgradeNodeList(nodes: unknown[], lang: SystemLang): unknown[] {
  return nodes.flatMap((n) => {
    if (!isNode(n)) return [n];
    if (isDeadFilterRow(n) || isToolbarBuiltRoundOne(n)) {
      droppedFilterRow = true;
      return [];
    }
    return splitHeroCard(upgradeNode(n, lang), lang);
  });
}

/**
 * 一排每一颗都指着 "#" 的筛选 chip —— 拿掉，不升级。
 *
 * 那是 2026-09-05 之前的产生器造的（`industry-template.ts` 的 `filterChips`）：
 * 它同时讲两句不是真的话 ——「已筛选：等回覆」，而底下那张表一行都没少；
 * 那颗 × 按下去什么都不会发生。**一个按不动的控件是缺陷，不是装饰。**
 *
 * ⚠️ 这是这个档案里唯一一个**删东西**的升级，所以门槛写得很窄：
 * **每一颗**的 `removeHref` 都要是 "#"（或空的）才算。有人真的把网址接上去
 * 的那一排 —— 客户自己接的、以后我们接的 —— 一个都不碰。
 * 「他挑过的版面是他的」那条规矩没有被推翻：他从来没有挑过这一排，是我们塞的。
 */
function isDeadFilterRow(node: Node): boolean {
  if (node.type !== "FilterChips") return false;
  const chips = node.props?.chips;
  if (!Array.isArray(chips) || chips.length === 0) return false;
  const dead = (v: unknown) => v === undefined || v === null || v === "" || v === "#";
  return chips.every(
    (c) => typeof c === "object" && c !== null && dead((c as { removeHref?: unknown }).removeHref),
  );
}

/*
  CHROME THE SAVED TREE NEVER CARRIED.

  Two blocks render words that are not the customer's: FilterChips' 「Filtered
  by」/「Clear all」 and RailNav's footer. Both were once hardcoded Chinese inside
  the component, and both were later given props that industry-template.ts fills
  from the system-language copy table -- so a system generated today is right in
  both languages.

  A system saved BEFORE that is not. The props are absent, the component falls
  back to its own default, and that default is Chinese. Measured on 2026-08-26
  by walking /en/portal: 「筛选条件」 on four pages of an English system, on a
  portal I had already called localised twice. Nothing failed. It just sat
  there, because a missing prop is not an error.

  So the same read-time upgrade that reshapes old tables fills these in. It only
  writes a prop that is ABSENT -- a customer who renamed 「Filtered by」 to
  「Showing」 keeps it, which is the rule the whole file runs on.
*/
const CHROME: Record<SystemLang, { filteredBy: string; clearAll: string; notifications: string; account: string; ask: string }> = {
  en: { filteredBy: "Filtered by", clearAll: "Clear all", notifications: "Notifications", account: "Account", ask: "Ask AI" },
  zh: { filteredBy: "筛选条件", clearAll: "清空全部", notifications: "通知", account: "账号设置", ask: "问 AI" },
};

type HeroStat = { label?: string; value?: string; tone?: string; sub?: string; href?: string };

/**
 * A saved dashboard's HeroCard becomes a StatRow and a TrendChart.
 *
 * WHY A SAVED PAGE HAS TO CHANGE AND NOT JUST THE SEED. buildDashboard stopped
 * emitting HeroCard on 2026-08-25, for reasons written out at that call site:
 * the first screen was three blocks and no chart where eleven competitors'
 * open with ten to fourteen and two to four, and that screen is the entire
 * pitch. But `project_pages.layout_json` is a saved tree. Changing the builder
 * alone would give the new look to people who sign up tomorrow and leave every
 * system that already exists -- including the founder's own preview accounts,
 * the thing he actually looks at -- on the thin page for ever.
 *
 * WHY IT IS SAFE, WHICH IS THE ONLY REASON IT IS ALLOWED IN THIS FILE. Nothing
 * is invented and nothing is dropped: every figure moves across, the tones move
 * across, the links move across, and the sparkline the customer could barely
 * see becomes the chart it was always a miniature of. It only fires on a node
 * that still has HeroCard's exact shape, so it is idempotent -- a second pass
 * finds a StatRow and does nothing.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. The seed also emits a ShelfList of today's
 * follow-ups, and this does not add one. That block needs records this node
 * does not carry, and inventing three plausible rows inside somebody's saved
 * system is exactly the kind of assumption the header of this file refuses to
 * make.
 */
function splitHeroCard(node: Node, lang: SystemLang): Node[] {
  if (node.type !== "HeroCard") return [node];
  const p = node.props ?? {};
  const value = typeof p.value === "string" ? p.value : null;
  if (!value) return [node];

  const stats = Array.isArray(p.stats) ? (p.stats as HeroStat[]) : [];
  const spark = Array.isArray(p.spark)
    ? (p.spark as { n?: number }[]).map((s) => s?.n).filter((n): n is number => typeof n === "number")
    : [];

  const out: Node[] = [
    {
      type: "StatRow",
      props: {
        tiles: [
          {
            label: p.label ?? "",
            value,
            deltaLabel: p.chgSuffix ?? "",
            tone: "good",
            iconName: "payments",
            href: p.href ?? "",
          },
          // HeroCard's vocabulary is "caution" / "warn"; StatRow reads the
          // figure rather than the direction. Same mapping the builder uses.
          ...stats.slice(0, 3).map((st, i) => ({
            label: st.label ?? "",
            value: st.value ?? "",
            deltaLabel: st.sub ?? "",
            tone: st.tone === "warn" ? "bad" : st.tone === "caution" ? "warn" : "normal",
            iconName: ["projects", "quotations", "reconciliation"][i] ?? "dashboard",
            href: st.href ?? "",
          })),
        ],
      },
    },
  ];

  if (spark.length > 1) {
    out.push({
      type: "TrendChart",
      props: {
        // The customer's own label if they gave the sparkline one; otherwise a
        // word in their system's language, not in ours.
        title:
          typeof p.sparkLabel === "string" && p.sparkLabel
            ? p.sparkLabel
            : lang === "zh"
              ? "走势"
              : "Trend",
        unit: "RM",
        points: spark.map((v, i) => ({ label: `${i + 1}`, value: v })),
      },
    });
  }

  return out;
}

function upgradeNode(node: Node, lang: SystemLang): Node {
  let props: Record<string, unknown> = { ...(node.props ?? {}) };

  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.some(isNode)) props[key] = upgradeNodeList(value, lang);
  }

  if (node.type === "RecordTable") {
    props = upgradeRecordTableProps(props);
  }

  if (node.type === "FilterChips") {
    if (typeof props.filteredByLabel !== "string") props.filteredByLabel = CHROME[lang].filteredBy;
    if (typeof props.clearAllLabel !== "string") props.clearAllLabel = CHROME[lang].clearAll;
  }

  /* 🔴 「跟它讲话」那一行 —— 2026-09-09 加进侧栏的。
     少了这一段，**只有今天之后新开的帐号看得到那个入口**：
     已经保存过的客户，他们那棵树里没有这个属性，於是这个产品的招牌承诺
     在他们的系统上一个字都不画。那正是这个仓库犯过十八次的
     「能力有、线没接」，而这个档案存在的理由就是接这一类线。
     ⚠️ 照这个档案自己的规矩：**只填不存在的**，他改过的名字留着。 */
  if (node.type === "RailNav" && typeof props.askLabel !== "string") {
    props.askLabel = CHROME[lang].ask;
  }

  if (node.type === "RailNav" && !Array.isArray(props.utilityItems)) {
    // The footer used to be two fixed props pointing at "#". Rebuilt as the
    // list it should always have been, preserving whatever the customer had:
    // an account link they had renamed stays renamed.
    props.utilityItems = [
      { label: CHROME[lang].notifications, iconName: "notifications" },
      { label: CHROME[lang].account, iconName: "account" },
    ];
    delete props.notificationsHref;
    delete props.accountHref;
  }

  return { ...node, props };
}

/**
 * 那一整条工具条 —— 连它旁边那个选日期的一起拿掉。
 *
 * 2026-09-03 那一轮把「筛选条一行 · 日期一行 · 表格自己的搜索又一行」併成
 * 一条 `Columns`，想要的是参考页那种**一行**工具条。做出来的两半都是空的：
 * 左边那颗筛选按不动（见 `isDeadFilterRow`），右边那个选日期的**挑完
 * 一个日子，七行还是七行、网址一个字都没变**（2026-09-05 在真的浏览器里量的）。
 *
 * 只拿掉左边那一半，会在那一页上留一个空格子。而它想要的那条工具条现在
 * 就在那张表自己身上（一个会筛的框 ＋ 一排从行里算出来的分段），所以整条
 * 拿掉，不是补一半。
 *
 * ⚠️ 门槛写得窄：**要真的装着一排按不动的筛选**才算。一条有人接过网址的
 * 工具条一个都不碰。
 */
function isToolbarBuiltRoundOne(node: Node): boolean {
  if (node.type !== "Columns") return false;
  for (const v of Object.values(node.props ?? {})) {
    if (Array.isArray(v) && v.some((c) => isNode(c) && isDeadFilterRow(c))) return true;
  }
  return false;
}

/**
 * 把「会筛的那一排」接到刚刚少了一排假筛选的那一页上。
 *
 * `isDeadFilterRow` 拿掉的是一句印上去的话；不补一句真的，那一页就只是
 * 少了一样东西 —— 而少的那一样正好是老板在一张七行的表上要用的。
 *
 * 补的不是另一排刻死的字：`segments: true` 只是叫那张表**自己从它手上的行
 * 里算**它真的有的那几种状态（`record-table.tsx` 的 `autoSegments`）。
 * 算不出来就不画（没有状态栏 · 只有一种 · 每一种都只有一行 —— 那一排会
 * 变成这张表的第二份拷贝）。所以它讲不了谎，也不用有人回来更新它。
 *
 * ⚠️ **有人明确挑过的那一排（`filters`）赢** —— 总览那一张是挑过的。
 * 这里只碰没有 `filters` 的表。
 */
function turnOnRealSegments(nodes: unknown[]): unknown[] {
  return nodes.map((n) => {
    if (!isNode(n)) return n;
    const props: Record<string, unknown> = { ...(n.props ?? {}) };
    for (const [k, v] of Object.entries(props)) {
      if (Array.isArray(v) && v.some(isNode)) props[k] = turnOnRealSegments(v);
    }
    if (n.type === "RecordTable" && !Array.isArray(props.filters)) props.segments = true;
    return { ...n, props };
  });
}

export function upgradeLayout<T extends { content?: unknown }>(
  layout: T,
  /** `projects.system_language` -- the language the customer's SYSTEM speaks,
   *  not the locale their portal is in. Defaults to the same value every other
   *  reader defaults to, so a caller that has not got it to hand degrades to
   *  what the system would have said anyway. */
  lang: SystemLang = DEFAULT_SYSTEM_LANG,
): T {
  if (!layout || !Array.isArray(layout.content)) return layout;
  droppedFilterRow = false;
  const content = upgradeNodeList(layout.content, lang);
  /* 拿掉那一排的页面，把会筛的那一排接上 —— 见下面。 */
  return { ...layout, content: droppedFilterRow ? turnOnRealSegments(content) : content };
}
