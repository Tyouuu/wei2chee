import { mainColumn, walkNodes, type PuckLayout, type PuckNode } from "@/lib/portal/layout-ops";
import {
  dashboardComposition,
  COMPOSITION_ROLES,
} from "@/lib/templates/industry-template";

/**
 * 换排法，在一个已经保存过的页面上。
 *
 * ── THE BUG THIS FIXES ────────────────────────────────────────────────────
 *
 * 排法 writes `projects.layout` and the page is regenerated on read -- until
 * the customer saves once, after which the layout is theirs and generation
 * stops. That is the correct rule. What was missing is what the five buttons
 * do AFTER that point: they wrote the column, lit up (`aria-pressed`), and the
 * page did not move. A control that reports success and changes nothing is
 * worse than a disabled one, because the owner believes it.
 *
 * ── WHY NOT REGENERATE ────────────────────────────────────────────────────
 *
 * Because regenerating throws away every word the customer typed, every column
 * they added and every row they edited. The bug is annoying; that would be
 * data loss. The other session hit the same wall on the AI side the same day
 * and reached the same answer: MOVE THE REAL BLOCKS.
 *
 * ── HOW THE ORDER IS DECIDED ──────────────────────────────────────────────
 *
 * `dashboardComposition` already answers 「which blocks, in what order」 for a
 * register or a named 排法. Its entries are ROLES (`stats4`, `trend|todo`,
 * `share|flow@wide-right`), and a saved page's blocks carry ids. This maps one
 * to the other and sorts; anything the composition does not name keeps its
 * relative place at the end, so a block the customer ADDED is never dropped or
 * shuffled into the middle of an argument it was not part of.
 *
 * Nothing is added and nothing is removed. Same argument composeSite makes for
 * the website: a dashboard composition may omit a block because dashboard
 * blocks are generated, but a SAVED page's blocks are the customer's.
 */

/** Composition role -> the id the dashboard builder gives that block.
 *
 *  Derived by hand from industry-template.ts and asserted in relayout.test.ts
 *  against COMPOSITION_ROLES, because a role added there with no id here would
 *  silently mean 「that block does not move」 -- which is the same shape of
 *  quiet failure this file exists to remove. */
const ROLE_ID: Record<string, string> = {
  stats4: "dashboard-stats",
  stats2: "dashboard-stats",
  hero: "dashboard-hero",
  trend: "dashboard-trend",
  todo: "dashboard-today",
  ranking: "dashboard-ranking",
  share: "dashboard-share",
  /* 2026-09-03 加的两个拼法。id 要跟 industry-template 里 node(...) 的第二个
     参数一字不差 —— 对不上的时候「换排法」会搬不动这一块，而画面上什么都不会讲。 */
  target: "dashboard-target",
  tabbed: "dashboard-tabbed",
  tiles: "dashboard-tiles",
  greet: "dashboard-greet",
  quick: "dashboard-quick",
  flow: "dashboard-workflow",
  activity: "dashboard-activity",
  progress: "dashboard-progress",
  board: "dashboard-board",
  table: "dashboard-recent",
};

/** Every id a composition can name, in the order it names them. `a|b@half`
 *  puts two blocks side by side; for ORDER, both simply come next. */
export function orderFor(layout?: string | null): string[] {
  /* 🔴 2026-09-04：这里本来还有一段重排 —— 一个为**分栏侧栏**写的排法，
     被套到一套不分栏的风格上时，要把开头那几块窄的推到最后，不然它们会
     变成整页宽的横带。

     那一段拿掉了，而且不是因为它错：系统收成一套之后
     （[任务 138](../../docs/founder-tasks.md)），排法不再指向别人的风格，
     而「表格先行」那一行现在**本来就是摊平写的**。执行时替它重排，
     跟写在纸上是同一个结果 —— 而写在纸上看得见。 */
  const entries = [...dashboardComposition(layout)];

  const ids: string[] = [];
  for (const entry of entries) {
    for (const role of entry.split("@")[0].split("|")) {
      const id = ROLE_ID[role.trim()];
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Exported for the test that keeps ROLE_ID honest. */
export const ROLE_IDS = ROLE_ID;
export const KNOWN_ROLES = COMPOSITION_ROLES;

const idOf = (n: PuckNode): string => String(n.props?.id ?? "");

/**
 * The first composition-known id ANYWHERE inside a top-level entry.
 *
 * A page's blocks are not a flat list. Since 2026-08-25 the dashboard nests
 * them -- in a `Panel` that gives a section a surface, or in a `Columns` that
 * puts two side by side -- so the thing sitting in the main column is often a
 * wrapper and the id the composition names is one or two levels down.
 *
 * Ranking the wrappers by their own id ranked nothing: relayout.test.ts caught
 * it on the first run, with 炉's page reporting four entries and no
 * `dashboard-recent` at all. Which is the same blindness that hid the table
 * from the AI, and is why layout-ops grew `walkNodes` in the first place.
 */
function rankOf(node: PuckNode, rank: Map<string, number>): number {
  let best = Number.MAX_SAFE_INTEGER;
  for (const n of walkNodes([node])) {
    const r = rank.get(idOf(n));
    if (r !== undefined && r < best) best = r;
  }
  return best;
}

/**
 * The page's blocks, in the arrangement's order. Returns the SAME array
 * identity when nothing moved, so a caller can skip a re-render.
 */
export function relayout(
  layoutData: PuckLayout,
  arrangement?: string | null,
): PuckLayout {
  /* THE BLOCKS ARE IN THE SHELL'S `main` SLOT, NOT AT THE TOP LEVEL.
     A dashboard is one SystemShell holding a rail and a page, so
     `layout.content` is a single node. Reordering that array would reorder
     nothing and report success -- the same failure this file exists to fix,
     one level up. `mainColumn` is layout-ops' own answer, imported rather than
     copied. */
  const content = mainColumn(layoutData);
  if (!content || content.length < 2) return layoutData;

  const order = orderFor(arrangement);
  if (!order.length) return layoutData;

  /* The shell and the page header do not move. A dashboard is one SystemShell
     holding the rail and the page, and 排法 is an argument about the blocks
     inside it -- not about whether the navigation comes first. */
  const rank = new Map(order.map((id, i) => [id, i]));
  const known = (n: PuckNode) => rankOf(n, rank) !== Number.MAX_SAFE_INTEGER;
  if (content.filter(known).length < 2) return layoutData;

  const first = content.findIndex(known);
  const last = content.length - 1 - [...content].reverse().findIndex(known);

  const middle = content.slice(first, last + 1);
  const sorted = [...middle]
    .map((node, i) => ({ node, i }))
    .sort((a, b) => {
      const ra = rankOf(a.node, rank);
      const rb = rankOf(b.node, rank);
      return ra === rb ? a.i - b.i : ra - rb;
    })
    .map((x) => x.node);

  const unchanged = sorted.every((n, i) => n === middle[i]);
  if (unchanged) return layoutData;

  const next = [...content.slice(0, first), ...sorted, ...content.slice(last + 1)];

  /* Rebuilt rather than mutated: Puck compares by identity to decide what to
     re-render, and an in-place splice on the slot array leaves the shell node
     looking unchanged. */
  const shellIndex = (layoutData.content ?? []).findIndex((n) => n.type === "SystemShell");
  if (shellIndex < 0) return { ...layoutData, content: next };
  const shell = layoutData.content[shellIndex];
  const rebuilt = [...layoutData.content];
  rebuilt[shellIndex] = { ...shell, props: { ...shell.props, main: next } };
  return { ...layoutData, content: rebuilt };
}
