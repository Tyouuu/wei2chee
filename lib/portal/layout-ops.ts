import { z } from "zod";
import { puckConfig } from "@/design-system/editor/puck-config";

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
  "primaryLabel",
  "secondaryLabel",
  "amountLabel",
  "statusColumnLabel",
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
  z.object({
    op: z.literal("add_table_row"),
    target_id: z.string().min(1),
    primary: z.string().min(1),
    secondary: z.string().nullable(),
    amount: z.string().nullable(),
    status_label: z.string().min(1),
    status_tone: z.enum(STATUS_TONES),
  }),
  z.object({
    op: z.literal("set_workflow"),
    target_id: z.string().min(1),
    stages: z.array(z.string().min(1)).min(2).max(6),
  }),
]);

export type LayoutOp = z.infer<typeof layoutOpSchema>;

export const layoutOpsSchema = z.object({
  operations: z.array(layoutOpSchema).max(12),
  /** One sentence, in the customer's language, describing what was done. Shown
   *  back to them so an edit is never silent. */
  explanation: z.string(),
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
      return `- id=${id} type=${n.type} (${label})${texts ? " " + texts : ""}`;
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
        const node = findNode(layout.content, op.target_id);
        if (!node || node.type !== "RecordTable") {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        const rows = Array.isArray(node.props.rows) ? (node.props.rows as unknown[]) : [];
        rows.push({
          primary: op.primary,
          secondary: op.secondary ?? undefined,
          amount: op.amount ?? undefined,
          statusTone: op.status_tone,
          statusLabel: op.status_label,
        });
        node.props.rows = rows;
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
