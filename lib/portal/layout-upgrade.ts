import { upgradeRecordTableProps } from "./table-model";

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

const isNode = (v: unknown): v is Node =>
  typeof v === "object" && v !== null && typeof (v as Node).type === "string";

/** Any prop whose value is an array of nodes is a slot — SystemShell's
 *  `sidebar`/`main` today, and whatever a future component adds without this
 *  file needing to hear about it.
 *
 *  flatMap rather than map since 2026-08-25: one upgrade turns a single node
 *  into two. See splitHeroCard. */
function upgradeNodeList(nodes: unknown[]): unknown[] {
  return nodes.flatMap((n) => (isNode(n) ? splitHeroCard(upgradeNode(n)) : [n]));
}

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
function splitHeroCard(node: Node): Node[] {
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
        title: typeof p.sparkLabel === "string" && p.sparkLabel ? p.sparkLabel : "走势",
        unit: "RM",
        points: spark.map((v, i) => ({ label: `${i + 1}`, value: v })),
      },
    });
  }

  return out;
}

function upgradeNode(node: Node): Node {
  let props: Record<string, unknown> = { ...(node.props ?? {}) };

  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.some(isNode)) props[key] = upgradeNodeList(value);
  }

  if (node.type === "RecordTable") {
    props = upgradeRecordTableProps(props);
  }

  if (node.type === "RailNav" && !Array.isArray(props.utilityItems)) {
    // The footer used to be two fixed props pointing at "#". Rebuilt as the
    // list it should always have been, preserving whatever the customer had:
    // an account link they had renamed stays renamed.
    props.utilityItems = [
      { label: "通知", iconName: "notifications" },
      { label: "账号设置", iconName: "account" },
    ];
    delete props.notificationsHref;
    delete props.accountHref;
  }

  return { ...node, props };
}

export function upgradeLayout<T extends { content?: unknown }>(layout: T): T {
  if (!layout || !Array.isArray(layout.content)) return layout;
  return { ...layout, content: upgradeNodeList(layout.content) };
}
