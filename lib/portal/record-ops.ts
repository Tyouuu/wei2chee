import type { SupabaseClient } from "@supabase/supabase-js";
import type { LayoutOp } from "./layout-ops";

/**
 * The assistant's 「加一单」 writes a real row, through the button's own RPC.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * `add_table_row` puts a row into the PAGE -- into the Puck props, beside the
 * samples. That was the only place rows lived until 20260830040000, and it is
 * now the wrong one for four modules: a row written there has no document
 * number, is not in `pipeline_records`, cannot be searched, summed or
 * archived, and is erased the moment the live-rows projection replaces the
 * table (lib/portal/live-rows.ts, shipped a day before this).
 *
 * So a customer asks the assistant for a quotation, sees it appear, saves,
 * writes a real one through the button, and the assistant's is gone. Two paths
 * for one action, and only one of them was repaired -- the shape of every
 * "said it did, did not do it" defect this repo has shipped.
 *
 * ── THE RULE THIS IMPLEMENTS ──────────────────────────────────────────────
 *
 * 「AI 平权」, founder-points 23: the assistant calls the SAME business action
 * a person calls. Not a similar one, not a convenient one -- the same RPC. The
 * permissions, the idempotency key, the document number, the workflow's first
 * stage and whatever auditing arrives later then apply to it for free, because
 * there is only one of them to apply.
 *
 * ── WHY IT RUNS HERE AND NOT IN THE BROWSER ───────────────────────────────
 *
 * Layout operations are applied in the browser: they change an unsaved tree
 * the customer can undo. A business record is not undoable that way -- it is a
 * row in their books. It is written server-side, inside the request that
 * decided to write it, with the customer's own session so RLS still decides.
 */

/** Modules whose rows are real. Mirrors is_pipeline_module() in
 *  20260830040000 and PIPELINE_MODULES in live-rows.ts. */
const PIPELINE_MODULES = new Set(["quotations", "orders", "projects", "tasks"]);

export function isRecordModule(pageKey: string | null | undefined): boolean {
  return !!pageKey && PIPELINE_MODULES.has(pageKey);
}

/** RM 48,500 · 48,500 · 48500.50 -> sen. Undefined when there is no number in
 *  it at all, because a task legitimately has no amount and 0 would be a claim. */
export function senFrom(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const m = String(text).replace(/[, ]/g, "").match(/-?\d+(\.\d{1,2})?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
}

export type SplitOps = {
  /** Operations that still belong to the page. */
  layoutOps: LayoutOp[];
  /** `add_table_row` operations that are business records on this page. */
  recordOps: LayoutOp[];
};

/**
 * Separate the rows that are records from the operations that are layout.
 *
 * Only on a module whose rows are real -- on 客户 or 库存 a table row is still
 * a layout row, and will be until those shapes have tables of their own.
 */
export function splitRecordOps(ops: LayoutOp[], pageKey: string | null | undefined): SplitOps {
  if (!isRecordModule(pageKey)) return { layoutOps: ops, recordOps: [] };
  const layoutOps: LayoutOp[] = [];
  const recordOps: LayoutOp[] = [];
  for (const op of ops) {
    if (op.op === "add_table_row") recordOps.push(op);
    else layoutOps.push(op);
  }
  return { layoutOps, recordOps };
}

export type RecordResult = {
  written: number;
  skipped: { op: string; reason: string }[];
};

/**
 * Write them, through `add_pipeline_record`.
 *
 * The cells arrive in the table's column order -- the same order the button's
 * form fills them in -- so the first is what the row is about, the second who
 * it is with, and the third the money. A cell the model did not send is
 * absent rather than empty.
 *
 * Each row carries its own idempotency key, derived from nothing random: if
 * the customer's connection drops and the browser retries the same sentence,
 * the same key arrives and the same row comes back instead of a second one.
 */
export async function writeRecords(
  supabase: SupabaseClient,
  projectId: string,
  moduleKey: string,
  ops: LayoutOp[],
  /** Stable per request, so a retried request does not duplicate. */
  requestKey: string,
): Promise<RecordResult> {
  const skipped: RecordResult["skipped"] = [];
  let written = 0;

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i] as { op: string; cells?: unknown };
    const cells = Array.isArray(op.cells) ? (op.cells as unknown[]).map((c) => String(c ?? "").trim()) : [];
    const title = cells[0] ?? "";
    if (!title) {
      skipped.push({ op: op.op, reason: "没有写这一单是什么" });
      continue;
    }
    const { error } = await supabase.rpc("add_pipeline_record", {
      in_project_id: projectId,
      in_module_key: moduleKey,
      in_title: title,
      in_party: cells[1] ?? "",
      in_amount_cents: senFrom(cells[2]) ?? null,
      in_idempotency_key: keyFor(requestKey, i),
    });
    if (error) skipped.push({ op: op.op, reason: error.message.slice(0, 80) });
    else written += 1;
  }

  return { written, skipped };
}

/**
 * One key per row per request. A uuid v5 would need a dependency; this builds
 * a valid v4-shaped uuid deterministically from the request key and the row's
 * position, which is all the uniqueness a retry needs -- the same request
 * retried produces the same keys, a different request cannot collide.
 */
export function keyFor(requestKey: string, index: number): string {
  let h = 0x811c9dc5;
  const seed = `${requestKey}:${index}`;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  let a = h;
  const parts: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    a = Math.imul(a ^ (a >>> 15), 0x2545f491) >>> 0;
    parts.push(hex(a));
  }
  const s = parts.join("");
  return [
    s.slice(0, 8),
    s.slice(8, 12),
    `4${s.slice(13, 16)}`,
    ((parseInt(s[16], 16) & 0x3) | 0x8).toString(16) + s.slice(17, 20),
    s.slice(20, 32),
  ].join("-");
}
