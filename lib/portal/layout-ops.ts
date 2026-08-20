import { z } from "zod";
import { puckConfig } from "@/design-system/editor/puck-config";
import {
  COLUMN_KINDS,
  KIND_LABELS,
  blankRow,
  newColumnKey,
  normalizeTable,
  upgradeRecordTableProps,
  type TableModel,
} from "./table-model";

/**
 * The edit language an LLM is allowed to speak when a customer asks for a
 * change in plain Chinese ("加一个记录客人生日的地方", "把'客户'改成'病人'").
 *
 * WHY OPERATIONS AND NOT LAYOUT JSON
 *
 * The obvious design -- hand the model the page's Puck JSON and ask for the
 * edited JSON back -- is the one that cannot be made reliable. A single
 * hallucinated component name, a dropped `id`, or a truncated response is not a
 * slightly-wrong page: it is a blank editor for someone who was mid-sentence
 * describing their business. And the failure is silent, because malformed
 * layout JSON still parses as JSON.
 *
 * So the model never writes layout. It emits a short list of OPERATIONS against
 * a strict schema, and this module applies them deterministically. Three things
 * follow from that, all of which matter more than the elegance of the approach:
 *
 *   - every component name the model can utter is an enum drawn from the live
 *     registry, so "add a calendar widget" cannot invent `CalendarWidget`
 *   - every target id is checked against the ids actually on the page, so an
 *     operation aimed at something that does not exist is dropped, not applied
 *     to the wrong thing
 *   - a partial failure is partial: four good operations still land when the
 *     fifth is nonsense, and the customer is told exactly what was skipped
 *
 * This is the same principle lib/templates/industry-template.ts is built on --
 * the model decides, code executes -- applied to the editing half of the
 * product rather than the generation half.
 */

/** Every component the editor actually has. The single source of truth for
 *  what the model is permitted to name.
 *
 *  Widened to a plain string-keyed record: `puckConfig.components` is typed as
 *  an exact object literal (one key per registered component), which is right
 *  for the editor but cannot be indexed by a runtime string like a component
 *  name that arrived from a model. Every such lookup here is already guarded by
 *  a REGISTERED_COMPONENTS membership check or a null test. */
const COMPONENT_CONFIGS = puckConfig.components as Record<
  string,
  { label?: string; defaultProps?: Record<string, unknown> }
>;

export const REGISTERED_COMPONENTS = Object.keys(COMPONENT_CONFIGS);

const STATUS_TONES = ["positive", "warning", "negative", "neutral"] as const;

/** Text-ish fields an edit is allowed to rewrite. Deliberately a fixed list:
 *  it keeps the model away from structural props (`gridId`, `href`, `name`)
 *  where a plausible-looking string quietly breaks behaviour instead of
 *  changing wording. */
export const EDITABLE_TEXT_FIELDS = [
  "title",
  "subtitle",
  "description",
  "label",
  "value",
  "caption",
  "placeholder",
  "hint",
  // The four table-label fields are gone from this list, and deliberately: a
  // table's columns are no longer props, and a `set_text` aimed at
  // `primaryLabel` would now write a prop nothing renders -- an edit that
  // reports success and changes nothing on screen. Renaming a column is
  // `set_table_column`.
  "brandLabel",
  "userName",
  "userRoleLabel",
] as const;

export const layoutOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_text"),
    target_id: z.string().min(1),
    field: z.enum(EDITABLE_TEXT_FIELDS),
    value: z.string().min(1),
  }),
  z.object({
    op: z.literal("add_component"),
    component: z.string().min(1),
    /** Placed after this id, or at the end of the main column when omitted. */
    after_id: z.string().nullable(),
    title: z.string().nullable(),
  }),
  z.object({
    op: z.literal("remove_component"),
    target_id: z.string().min(1),
  }),
  // Cells are positional, aligned to the column list the model is shown, rather
  // than a fixed primary/secondary/amount/status quartet -- a table can now have
  // any columns at all, so there is no fixed set of names to key them by.
  // Everything is nullable and back-filled on apply: a model that omits one cell
  // should produce a row with one blank cell, not a 502 that loses the other
  // eleven operations in the same response.
  z.object({
    op: z.literal("add_table_row"),
    target_id: z.string().min(1),
    cells: z.array(z.string()).max(8).nullable(),
    status_tone: z.enum(STATUS_TONES).nullable(),
  }),
  // THE THREE OPERATIONS THIS PRODUCT WAS MISSING. Until columns became an
  // array (lib/portal/table-model.ts) the assistant had to answer「表格加一列
  // 负责的师傅」with「现有操作不支持」-- not because the model was weak but
  // because the component could not represent the result. These are what make
  // "tell it what you want and the system changes" true of the most-used
  // component in the product.
  z.object({
    op: z.literal("add_table_column"),
    target_id: z.string().min(1),
    column_label: z.string().min(1).max(16),
    column_kind: z.enum(COLUMN_KINDS).nullable(),
  }),
  z.object({
    op: z.literal("remove_table_column"),
    target_id: z.string().min(1),
    column_key: z.string().min(1),
  }),
  z.object({
    op: z.literal("set_table_column"),
    target_id: z.string().min(1),
    column_key: z.string().min(1),
    column_label: z.string().min(1).max(16),
    column_kind: z.enum(COLUMN_KINDS).nullable(),
  }),
  z.object({
    op: z.literal("set_workflow"),
    target_id: z.string().min(1),
    stages: z.array(z.string().min(1)).min(2).max(6),
  }),
]);

export type LayoutOp = z.infer<typeof layoutOpSchema>;

/**
 * A page-level change the assistant is offering to make, but has not made.
 *
 * WHY AN OFFER AND NOT AN OPERATION. Everything in `layoutOpSchema` edits the
 * page in front of the customer and persists NOTHING -- the result goes into
 * Puck's state exactly as a drag would, which is what keeps the paid gate on
 * `save_project_page` meaningful and lets any AI edit be undone with the same
 * button as everything else. Adding or removing a page is a database write
 * (`add_project_page`), so routing it through the same channel would either
 * break that contract or hide an unpaid write behind a chat box.
 *
 * So the assistant answers「帮我加一个员工排班的页面」with a button instead of a
 * refusal. The customer presses it, the RPC runs with their own credentials,
 * and the write is theirs. This is the same division Durable settled on: the
 * conversation proposes structure, the customer confirms it.
 */
export const pageSuggestionSchema = z.object({
  action: z.enum(["add_page", "remove_page", "none"]),
  /** The customer's own name for a new page. */
  page_title: z.string().max(24).nullable(),
  /** A built-in type for `add_page` (so it arrives with real sample data), or
   *  the key of an existing page for `remove_page`. Validated against reality
   *  in the route -- the model is never trusted with a key. */
  page_key: z.string().max(64).nullable(),
});

export type PageSuggestion = z.infer<typeof pageSuggestionSchema>;

export const layoutOpsSchema = z.object({
  operations: z.array(layoutOpSchema).max(12),
  /** One sentence, in the customer's language, describing what was done. Shown
   *  back to them so an edit is never silent. */
  explanation: z.string(),
  suggestion: pageSuggestionSchema.nullable().optional(),
});

export type PuckNode = { type: string; props: Record<string, unknown> };
export type PuckLayout = { root: Record<string, unknown>; content: PuckNode[] };

const SLOT_KEYS = ["sidebar", "main"] as const;

/** Every node on the page, including the ones inside SystemShell's two slots. */
export function walkNodes(nodes: PuckNode[]): PuckNode[] {
  return nodes.flatMap((n) => [
    n,
    ...SLOT_KEYS.flatMap((k) =>
      Array.isArray(n.props?.[k]) ? walkNodes(n.props[k] as PuckNode[]) : [],
    ),
  ]);
}

/**
 * The compact description of the page handed to the model.
 *
 * Not the raw layout: sending the full JSON would spend most of the context on
 * ids, hrefs and sample rows the model must not touch anyway, and every extra
 * field is one more thing for it to "helpfully" rewrite. This is the smallest
 * description that still lets it target the right block.
 */
export function describeLayout(layout: PuckLayout): string {
  return walkNodes(layout.content ?? [])
    .map((n) => {
      const id = String(n.props?.id ?? "");
      const label = COMPONENT_CONFIGS[n.type]?.label ?? n.type;
      const texts = EDITABLE_TEXT_FIELDS.filter(
        (f) => typeof n.props?.[f] === "string" && n.props[f],
      )
        .map((f) => `${f}="${n.props[f]}"`)
        .join(" ");

      // A table's columns have to be listed, or the model cannot target one:
      // `column_key` is a stable identifier ("primary", "c3") that appears
      // nowhere on screen, so it can only come from here. Listed in display
      // order, which is also the order `add_table_row`'s cells are read in.
      let extra = "";
      if (n.type === "RecordTable") {
        const cols = normalizeTable(n.props ?? {})
          .columns.map((c) => `${c.key}:"${c.label}"(${KIND_LABELS[c.kind]})`)
          .join(" ");
        extra = ` columns=[${cols}]`;
      }

      return `- id=${id} type=${n.type} (${label})${texts ? " " + texts : ""}${extra}`;
    })
    .join("\n");
}

/** Deep clone that survives the plain-JSON shape a Puck layout always has. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function findNode(nodes: PuckNode[], id: string): PuckNode | null {
  for (const n of nodes) {
    if (String(n.props?.id) === id) return n;
    for (const k of SLOT_KEYS) {
      if (Array.isArray(n.props?.[k])) {
        const hit = findNode(n.props[k] as PuckNode[], id);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/** Removes by id, wherever it lives. Returns true if something was removed. */
function removeNode(nodes: PuckNode[], id: string): boolean {
  const i = nodes.findIndex((n) => String(n.props?.id) === id);
  if (i !== -1) {
    nodes.splice(i, 1);
    return true;
  }
  for (const n of nodes) {
    for (const k of SLOT_KEYS) {
      if (Array.isArray(n.props?.[k]) && removeNode(n.props[k] as PuckNode[], id)) return true;
    }
  }
  return false;
}

/**
 * The live `{columns, rows}` of a RecordTable, or null if the id is not one.
 *
 * Upgrades the node's props as a side effect, so an operation aimed at a table
 * still saved in the legacy four-prop shape works on the same data the editor
 * shows -- and hands back the SAME object that now sits in `props.table`, so
 * the caller mutates the layout by mutating what it is given.
 */
function tableOf(layout: PuckLayout, id: string): TableModel | null {
  const node = findNode(layout.content, id);
  if (!node || node.type !== "RecordTable") return null;
  node.props = upgradeRecordTableProps(node.props);
  return node.props.table as TableModel;
}

/** The list a new block should join: the shell's main column when there is a
 *  shell, otherwise the top level. Never the sidebar -- "add a table" meaning
 *  "put a table in the nav rail" is never what was asked. */
function mainColumn(layout: PuckLayout): PuckNode[] {
  const shell = layout.content?.find((n) => n.type === "SystemShell");
  if (shell && Array.isArray(shell.props?.main)) return shell.props.main as PuckNode[];
  return layout.content;
}

export type ApplyResult = {
  layout: PuckLayout;
  applied: number;
  /** Operations that could not be applied, each with a plain reason. Surfaced
   *  to the customer rather than swallowed: an edit that silently does nothing
   *  is worse than one that says what it could not do. */
  skipped: { op: string; reason: string }[];
};

export function applyLayoutOps(input: PuckLayout, ops: LayoutOp[]): ApplyResult {
  const layout = clone(input);
  const skipped: ApplyResult["skipped"] = [];
  let applied = 0;

  // Suffixed so a block added twice in one conversation cannot collide with
  // an existing id -- Puck uses id for selection and undo, and a duplicate
  // makes the editor select the wrong thing.
  let added = 0;
  const newId = (type: string) => `ai-${type.toLowerCase()}-${Date.now()}-${added++}`;

  for (const op of ops) {
    switch (op.op) {
      case "set_text": {
        const node = findNode(layout.content, op.target_id);
        if (!node) {
          skipped.push({ op: op.op, reason: `找不到 ${op.target_id}` });
          break;
        }
        node.props[op.field] = op.value;
        applied++;
        break;
      }

      case "add_component": {
        // The enum check that makes a hallucinated component name a no-op
        // rather than an empty slot on a paying customer's page.
        if (!REGISTERED_COMPONENTS.includes(op.component)) {
          skipped.push({ op: op.op, reason: `没有这个组件：${op.component}` });
          break;
        }
        const config = COMPONENT_CONFIGS[op.component];
        const node: PuckNode = {
          type: op.component,
          props: { ...clone(config.defaultProps ?? {}), id: newId(op.component) },
        };
        if (op.title && typeof node.props.title === "string") node.props.title = op.title;

        const column = mainColumn(layout);
        const at = op.after_id ? column.findIndex((n) => String(n.props?.id) === op.after_id) : -1;
        if (at === -1) column.push(node);
        else column.splice(at + 1, 0, node);
        applied++;
        break;
      }

      case "remove_component": {
        // The shell is the page's frame, not content. Removing it would strand
        // everything inside its two slots -- an instruction the model should
        // never be able to carry out by accident.
        const node = findNode(layout.content, op.target_id);
        if (node?.type === "SystemShell") {
          skipped.push({ op: op.op, reason: "页面框架不能删除" });
          break;
        }
        if (!removeNode(layout.content, op.target_id)) {
          skipped.push({ op: op.op, reason: `找不到 ${op.target_id}` });
          break;
        }
        applied++;
        break;
      }

      case "add_table_row": {
        const table = tableOf(layout, op.target_id);
        if (!table) {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        const row = blankRow(table.columns);
        // Positional: cells[i] belongs to columns[i], which is the order the
        // model was shown. Extra cells are dropped and missing ones stay blank
        // rather than shifting every value one column left.
        (op.cells ?? []).forEach((value, i) => {
          const col = table.columns[i];
          if (col) row.cells[col.key] = value;
        });
        for (const col of table.columns) {
          if (col.kind === "status") {
            row.tones = { ...(row.tones ?? {}), [col.key]: op.status_tone ?? "neutral" };
          }
        }
        table.rows.push(row);
        applied++;
        break;
      }

      case "add_table_column": {
        const table = tableOf(layout, op.target_id);
        if (!table) {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        // Same ceiling the fields panel enforces (table-field.tsx). Stated in
        // both places on purpose: the customer's own limit should not depend on
        // which of the two ways they add a column.
        if (table.columns.length >= 8) {
          skipped.push({ op: op.op, reason: "表格最多八列" });
          break;
        }
        const key = newColumnKey(table.columns);
        table.columns.push({ key, label: op.column_label, kind: op.column_kind ?? "text" });
        for (const row of table.rows) row.cells[key] = "";
        applied++;
        break;
      }

      case "remove_table_column": {
        const table = tableOf(layout, op.target_id);
        if (!table) {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        const at = table.columns.findIndex((c) => c.key === op.column_key);
        if (at === -1) {
          skipped.push({ op: op.op, reason: `表格里没有 ${op.column_key} 这一列` });
          break;
        }
        // A table with no columns cannot be rendered and cannot be recovered
        // from -- there would be no header to add one back through.
        if (table.columns.length <= 1) {
          skipped.push({ op: op.op, reason: "表格至少要有一列" });
          break;
        }
        table.columns.splice(at, 1);
        for (const row of table.rows) {
          delete row.cells[op.column_key];
          if (row.tones) delete row.tones[op.column_key];
        }
        applied++;
        break;
      }

      case "set_table_column": {
        const table = tableOf(layout, op.target_id);
        if (!table) {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        const col = table.columns.find((c) => c.key === op.column_key);
        if (!col) {
          skipped.push({ op: op.op, reason: `表格里没有 ${op.column_key} 这一列` });
          break;
        }
        col.label = op.column_label;
        if (op.column_kind) col.kind = op.column_kind;
        applied++;
        break;
      }

      case "set_workflow": {
        const node = findNode(layout.content, op.target_id);
        if (!node || node.type !== "WorkflowStrip") {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是业务流程` });
          break;
        }
        node.props.stages = op.stages.map((label) => ({ label, tone: "normal" }));
        applied++;
        break;
      }
    }
  }

  return { layout, applied, skipped };
}
