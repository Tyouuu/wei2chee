/**
 * 页面上每一条 `#...` 的连结，都要在同一页找得到落点。
 *
 * ── 为什么有这一支（2026-09-05）────────────────────────────────────────────
 *
 * 客户唯一那个上线的官网 `/s/xingfa-reno` 上，**四条连结全部按不动**，
 * 而其中一条是右上角那颗橘色的 **「Ask price」—— 整页唯一的转换按钮**：
 *
 * | 连结 | 画面上写什么 | 那一页有没有那个落点 |
 * |---|---|---|
 * | `#website-services` | Our work | **没有** |
 * | `#website-prices`   | What it costs | **没有** |
 * | `#website-form`     | How to reach us | **没有** |
 * | 🔴 `#enquiry`        | **Ask price** | **从来没有过** |
 *
 * 那四条导航跟页脚各出现一次，所以画面上大约**七个按不动的控件**。
 * 而这个仓库自己禁的第一条就是**不准画一颗按不动的按钮**
 * （任务 15 砍掉过一个搜不到东西的 ⌘K，任务 185 刚清掉一整行假的筛选）。
 *
 * ── 🔴 根因不是四个 bug，是一个形状 ──────────────────────────────────────
 *
 * **段会被拿掉，导航是另外产生的，两边没有对过。**
 *
 *   · `site-composition` 的 `dropBlocks` 会拿掉整段（有几套风格故意不放价目表）
 *   · `publish-projection` 发布的时候还会再拿掉（空的照片框 · 每一行都是
 *     `RM —` 的价目表 —— [任务 19](../../docs/founder-tasks.md#19)，那一条是对的）
 *   · 而 `anchors()` 是**写死的三条**，写在「每一套模板都会出服务、价目、表单」
 *     这个假设上
 *
 * 所以只要有任何一段被拿掉，指向它的连结就变成死的 ——
 * **而画面上完全看不出来，按下去也不会报错，只是什么都不会发生。**
 *
 * ⚠️ 修法**不是列一份名单**（这个仓库栽在手写名单上至少八次：489 个区块名、
 * 九份小标题、九个 uuid…）。是**问这一页自己有哪些落点**，然后把指不到的拿掉。
 *
 * ── 两个呼叫端，一份实作 ──────────────────────────────────────────────────
 *
 * 掉段发生在两个时候（组版 · 发布），所以两边都要跑一次。抄第二份就会漂。
 */
import type { PuckLayout, PuckNode } from "./layout-ops";

/** 这一页上真的存在的每一个 id。 */
function idsIn(nodes: unknown[], into: Set<string>): void {
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue;
    const node = n as PuckNode;
    const id = (node.props as { id?: unknown } | undefined)?.id;
    if (typeof id === "string" && id) into.add(id);
    for (const v of Object.values(node.props ?? {})) {
      if (Array.isArray(v)) idsIn(v, into);
    }
  }
}

/** 一个不可能是真 id 的字串 —— 光秃秃的 `"#"` 用它，好让下面那一段
 *  用同一条路把它当成「指不到」处理。 */
const DEAD = "::dead-anchor::";

/** `"#website-form"` → `"website-form"`；不是页内锚点就回 null。 */
function anchorOf(href: unknown): string | null {
  /* 🔴 光秃秃的 `"#"` 也算 —— 它是一颗按了什么都不会发生的按钮，
     而 `site-hero.tsx` 里有十处 `href={primaryHref || "#"}`：
     少一个 href，画出来就是一颗死按钮。`quick-links` 跟 `rail-nav`
     早就在挡这个字串了，官网那一边没有。 */
  if (href === "#") return DEAD;
  return typeof href === "string" && href.startsWith("#") && href.length > 1
    ? href.slice(1)
    : null;
}

/**
 * 那颗按钮该指哪里。
 *
 * 🔴 **`#enquiry` 从来不存在** —— 询价那一块的 id 是 `website-form`。
 * 它是这四条里最贵的一条：那颗按钮是整页唯一的转换按钮，而它从写出来
 * 那天起按下去什么都不会发生。
 *
 * 🔴 **「预约时段」那一套模版底下没有询价表** —— 有一页在收预约的生意
 * 拿到的是真的挑时段那一块（`website-booking`，见 landing-templates 的
 * `slots`）。所以只认 `website-form` 的话，那一套模版上顶栏 · 页脚 ·
 * 第一屏那三颗按钮会**整颗被拿掉** —— 而那正是这支档案存在要防的事，
 * 只是换了一个方向。
 *
 * ⚠️ 顺序有意义：有询价表就去询价表（那是「问一句话」），
 * 没有才去挑时段（那是「占一个钟头」）。
 */
const ASK_FALLBACKS = ["website-form", "website-booking"] as const;

function pruneNode(node: PuckNode, ids: Set<string>): PuckNode {
  let props = node.props ?? {};
  let changed = false;

  /* 导航跟页脚的那几条。指不到的整条拿掉 —— 一条按不动的连结，
     比少一条连结糟：他会按，而按下去什么都不会发生。 */
  const links = (props as { links?: unknown }).links;
  if (Array.isArray(links)) {
    const kept = links.filter((l) => {
      const a = anchorOf((l as { href?: unknown })?.href);
      return a === null || ids.has(a);
    });
    if (kept.length !== links.length) {
      props = { ...props, links: kept };
      changed = true;
    }
  }

  /* 那几颗按钮。
     🔴 **只有「问价」那一类才回退到询价那一块** —— 那本来就是它要去的地方。
     次要的那几颗（「看作品」「了解更多」）指不到就**整颗拿掉**：
     把一颗写着「看作品」的按钮导到询价表单，是另一种说谎，
     只是比按不动安静一点。实测就撞到这个：兴发那一页上
     「See our work」被我第一版的回退导到了 `#website-form`。 */
  for (const key of ["actionHref", "askHref", "primaryHref", "secondaryHref", "moreHref"] as const) {
    const a = anchorOf((props as Record<string, unknown>)[key]);
    if (a === null || ids.has(a)) continue;
    const label = key === "actionHref" ? "actionLabel"
      : key === "askHref" ? "askLabel"
      : key === "primaryHref" ? "primaryLabel"
      : key === "secondaryHref" ? "secondaryLabel"
      : "moreLabel";
    const isAsk = key === "actionHref" || key === "askHref" || key === "primaryHref";
    const landing = ASK_FALLBACKS.find((f) => ids.has(f));
    if (isAsk && landing) {
      props = { ...props, [key]: `#${landing}` };
    } else {
      props = { ...props, [key]: undefined, [label]: undefined };
    }
    changed = true;
  }

  /* 巢状的插槽（分栏 · 卡片里面的块）。 */
  for (const [k, v] of Object.entries(props)) {
    if (!Array.isArray(v)) continue;
    if (!v.some((x) => x && typeof x === "object" && "type" in (x as object))) continue;
    const next = (v as PuckNode[]).map((n) => pruneNode(n, ids));
    if (next.some((n, i) => n !== v[i])) {
      props = { ...props, [k]: next };
      changed = true;
    }
  }

  return changed ? ({ ...node, props } as PuckNode) : node;
}

/**
 * 把这一页上指不到落点的锚点连结拿掉。
 *
 * ⚠️ 只碰**页内锚点**（`#...`）。外面的网址、`tel:`、`https:` 一个字都不动 ——
 * 它们指的是这一页以外的东西，这里答不了它们通不通。
 */
export function pruneDeadAnchors<T extends { content?: unknown }>(layout: T): T {
  if (!layout || !Array.isArray(layout.content)) return layout;
  const ids = new Set<string>();
  idsIn(layout.content, ids);
  const next = (layout.content as PuckNode[]).map((n) => pruneNode(n, ids));
  if (next.every((n, i) => n === (layout.content as PuckNode[])[i])) return layout;
  return { ...layout, content: next };
}

/** 同一件事，作用在一串节点上（产生器那一边拿到的是节点，不是整个版面）。 */
export function pruneDeadAnchorsIn(nodes: PuckNode[]): PuckNode[] {
  const ids = new Set<string>();
  idsIn(nodes, ids);
  return nodes.map((n) => pruneNode(n, ids));
}

export type { PuckLayout };
