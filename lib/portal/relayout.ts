import { mainColumn, walkNodes, type PuckLayout, type PuckNode } from "@/lib/portal/layout-ops";
import {
  dashboardComposition,
  COMPOSITION_ROLES,
  LAYOUT_SETS,
  SPLIT_REGISTERS,
  type LayoutSet,
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
  flow: "dashboard-workflow",
  activity: "dashboard-activity",
  progress: "dashboard-progress",
  board: "dashboard-board",
  table: "dashboard-recent",
};

/**
 * The narrow blocks, and the reason this list has to exist here.
 *
 * 台账 and 中台 are SPLIT registers: system-shell.tsx pins a 19rem aside beside
 * the page and fills it by taking narrow blocks OFF THE FRONT of the stack.
 * That is why 台账's composition opens `["todo", "ranking", "table", ...]` --
 * the first two are the aside, and the table is what the page itself opens on.
 *
 * Apply that order literally to a register that has no aside and 「表格先行」
 * puts 今天要跟的 first and the table third. The button would be lying about
 * its own name, which is the same class of defect this file exists to fix.
 *
 * The component names match system-shell.tsx's own NARROW set; the roles are
 * the composition's word for the same three blocks.
 */
const NARROW_ROLES = new Set(["todo", "ranking", "share", "progress"]);

/** Every id a composition can name, in the order it names them. `a|b@half`
 *  puts two blocks side by side; for ORDER, both simply come next. */
export function orderFor(style?: string | null, layout?: string | null): string[] {
  const entries = [...dashboardComposition(style, layout)];

  /* The composition's own register vs the one it is being applied to. A named
     arrangement points at a register (LAYOUT_SETS.table -> ledger); an unnamed
     one IS the register. */
  const source = (layout && LAYOUT_SETS[layout as LayoutSet]) || style || "";
  if (SPLIT_REGISTERS.has(source) && !SPLIT_REGISTERS.has(style ?? "")) {
    const leadIsNarrow = (e: string) =>
      e.split("@")[0].split("|").every((r) => NARROW_ROLES.has(r.trim()));
    let take = 0;
    while (take < entries.length - 1 && leadIsNarrow(entries[take])) take++;
    if (take > 0) entries.push(...entries.splice(0, take));
  }

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
  style?: string | null,
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

  const order = orderFor(style, arrangement);
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
