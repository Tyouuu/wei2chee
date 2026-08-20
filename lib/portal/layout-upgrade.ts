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
 *  file needing to hear about it. */
function upgradeNodeList(nodes: unknown[]): unknown[] {
  return nodes.map((n) => (isNode(n) ? upgradeNode(n) : n));
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
