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

import {
  DIRECTORY_MODULES,
  LIVE_MODULES,
  shapeOfModule,
} from "./shape-state";
import type { ModuleShape } from "./module-catalog";

/**
 * Why a typed row cannot become a record on this shape -- or null when it can.
 *
 * ── 🔴 WHAT THIS REPLACED, AND WHAT IT COST ───────────────────────────────
 *
 * The routing here used to be three `Set.has` questions and an else: ledger,
 * directory, catalog, **and everything else is a pipeline record**. Ten shapes
 * exist and four had a branch, so the two live shapes without one -- 预约 and
 * 对帐 -- reached `add_pipeline_record`, which refuses them. Measured with a
 * real signed-in identity on 2026-09-07, what the owner read was:
 *
 *     not a pipeline module: bookings
 *
 * An English database sentence, on his 预约 page, naming a word he has never
 * heard, for a page that is not the one it names. A salon owner saying 「帮陈
 * 太太排明天三点」 gets that.
 *
 * ── WHY 预约 AND 对帐 REFUSE RATHER THAN WRITE ────────────────────────────
 *
 * 🔴 预约 CANNOT be written from a typed row, and this is a fact about the
 * operation rather than a gap in the code. An appointment needs two instants;
 * a row carries `cells`, and the booking row's clock lives in `at` -- a
 * separate structure the page builds from `starts_at`/`ends_at`. There is no
 * cell holding a time, so writing one means inventing when. 任务 89 measured
 * what that costs: 省他的字，不可以拿「猜」来省. And a guessed time is not a
 * harmless guess here -- appointments collide under a database-level exclusion
 * (20260902030000), so a wrong instant either books the wrong slot or is
 * rejected for overlapping something real.
 *
 * 🔴 对帐 could be parsed back -- period and source ARE in the first cell --
 * but only by inverting `monthText` for two languages, which is a second copy
 * of a formatter that will drift (任务 195 logged that gluing already). And it
 * buys nothing: a reconciliation is typed once a month on its own page, while
 * a mis-read month silently settles the wrong one and 20260906 locks a settled
 * month against further entries. 重点 7d-2: ask what he is really asking, and
 * whether something smaller answers it. Something smaller does -- not handing
 * him a database error.
 *
 * ── WHY A SWITCH AND NOT ANOTHER ELSE ─────────────────────────────────────
 *
 * The `never` in the default is the point. `applyLayoutOps` grew the same
 * guard in 任务 23f after nine 「说了没做」 of one family: a shape added to the
 * catalogue with no branch here is now a BUILD error, not something the owner
 * finds in front of a customer.
 */
export function refuseToWrite(shape: ModuleShape): string | null {
  switch (shape) {
    /* The four that have a real business action behind them. */
    case "pipeline":
    case "ledger":
    case "directory":
    case "catalog":
      return null;

    case "calendar":
      return "预约要写清楚几点到几点，而这里加一行给不了时间 —— 到预约那一页排一个时段";

    case "reconcile":
      return "对帐要一个月份跟上游给的那个总数 —— 到对帐那一页加一笔";

    /* 总览 · 报表 · 排行 · 官网 never reach here (isRecordModule gates on the
       live shapes), and they are written out anyway because the compiler asks
       for them -- and because the sentence is true if one ever does. */
    case "overview":
    case "report":
    case "leaderboard":
      return "这一页的数字是别的页面加起来的，不是打进去的";
    case "landing":
      return "这是给客人看的那一页，不是记录页";

    default: {
      const unhandled: never = shape;
      return `这一页还不能这样加一行：${String(unhandled)}`;
    }
  }
}

export function isRecordModule(pageKey: string | null | undefined): boolean {
  return !!pageKey && LIVE_MODULES.has(pageKey);
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

/**
 * A phone number that is already in the sentence, or nothing.
 *
 * ── WHY THIS READS AND DOES NOT GUESS ─────────────────────────────────────
 *
 * On a directory page the assistant is handed the page's columns, and the
 * second one is headed 「联络方式 / 备注」 -- one blob. Underneath it the table
 * has structured columns, because `whatsapp` has to be something a wa.me link
 * can be built out of (任务 48) rather than a line of prose.
 *
 * So 「加一个客户：陈先生，Taman Desa 013-2345678」 has to end up with the
 * number in a column. Taking a number that is LITERALLY IN THE TEXT is
 * reading; deciding it is a mobile, or that the customer is in Selangor,
 * would be inventing. Only the first is done here, and the whole blob is kept
 * in `note` regardless, so nothing the owner said is thrown away.
 *
 * ⚠️ IT LANDS IN `phone`, NEVER IN `whatsapp`. In this market the number
 * somebody gives you usually IS their WhatsApp -- but "usually" builds a
 * wa.me link that opens on nothing for the rest, which is precisely the dead
 * control block-rules.ts forbids the assistant to draw. The form has its own
 * WhatsApp box, where a person says so.
 */
export function phoneFrom(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  /* A run of the characters a Malaysian number is written with. 「+60 12-345
     6789」, 「012-345 6789」 and 「0123456789」 are all correct and all three
     occur. */
  const runs = String(text).match(/\+?[\d][\d\s().-]{7,17}\d/g);
  if (!runs) return undefined;
  for (const run of runs) {
    const digits = run.replace(/\D/g, "");
    /* 9 to 12 digits, starting 0 or 60. Below that it is a house number or a
       price; above it, an account number. The prefix test is what keeps
       「RM 48,500」 and 「2026-08-31」 out. */
    if (digits.length < 9 || digits.length > 12) continue;
    if (!/^(0|60)/.test(digits)) continue;
    return run.trim();
  }
  return undefined;
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
/** Cell keys the table model owns. Everything else on a table is a column the
 *  owner added, and its value belongs in `extra`. Mirrors BUILT_IN_KEYS in
 *  live-rows.ts, which reads back what this writes. */
const BUILT_IN_KEYS = new Set(["primary", "secondary", "amount", "status"]);

/**
 * One row's cells, sorted into the columns the record table owns and the ones
 * this business added for itself.
 *
 * ── WHY THIS IS NOT POSITIONAL ANY MORE ───────────────────────────────────
 *
 * It was: cells[0] was the title, [1] the party, [2] the money. That is true
 * of a table nobody has touched, and false the moment an owner adds 「车牌号」
 * in front of the amount or removes the 说明 column -- and adding columns is a
 * thing both the fields panel and the assistant can already do.
 *
 * Worse, the surplus went nowhere. A workshop owner asking for 「加一栏车牌
 * 号」 got the column, and every row under it stayed blank forever, because
 * the value had no place to live. `extra` is that place; this is the wire.
 */
export function sortCells(
  cells: string[],
  columnKeys: string[] | null,
): { title: string; party: string; amount?: string; status?: string; extra: Record<string, string> } {
  const extra: Record<string, string> = {};
  /* ── THE LAST RESORT, AND WHY IT IS THIS ONE ─────────────────────────────
     No columns known: a target id that resolves to no table at all. The real
     caller reads the page's own columns, and since 2026-08-31 falls back to
     the page's first record table before ever reaching here.

     The four built-in columns in recordTable()'s own order. ⚠️ It is WRONG on
     a three-column table -- 客户 · 联络方式 · 状态 has no `amount`, so 「新客户」
     is read as an amount and dropped, because add_directory_entry has nothing
     to put an amount in.

     Dropping is the failure that was chosen. Deriving the keys from how many
     cells arrived instead shifts everything: the model sends three cells to a
     four-column quotations table all the time, and 「RM 48,500」 would be
     written as the stage. One lost cell beats a row that is wrong in every
     column, and the caller's fallback is what keeps either from happening. */
  const keys = columnKeys ?? ["primary", "secondary", "amount", "status"];
  const by: Record<string, string> = {};
  cells.forEach((value, i) => {
    const key = keys[i];
    if (!key || !value) return;
    if (BUILT_IN_KEYS.has(key)) by[key] = value;
    else extra[key] = value;
  });
  return {
    title: by.primary ?? "",
    party: by.secondary ?? "",
    amount: by.amount,
    status: by.status,
    extra,
  };
}

export async function writeRecords(
  supabase: SupabaseClient,
  projectId: string,
  moduleKey: string,
  ops: LayoutOp[],
  /** Stable per request, so a retried request does not duplicate. */
  requestKey: string,
  /** The column keys of the table an op targets, in display order. Null when
   *  the caller cannot resolve it; see sortCells. */
  columnsFor?: (targetId: string) => string[] | null,
): Promise<RecordResult> {
  const skipped: RecordResult["skipped"] = [];
  let written = 0;

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i] as { op: string; cells?: unknown; target_id?: unknown };
    const cells = Array.isArray(op.cells) ? (op.cells as unknown[]).map((c) => String(c ?? "").trim()) : [];
    const keys = columnsFor?.(String(op.target_id ?? "")) ?? null;
    const { title, party, amount, status, extra } = sortCells(cells, keys);
    if (!title) {
      /* A directory row is a name, not a document -- 「没有写这一单是什么」 on
         a customer page is a sentence about the wrong product. */
      skipped.push({
        op: op.op,
        reason: DIRECTORY_MODULES.has(moduleKey) ? "没有写名字" : "没有写这一单是什么",
      });
      continue;
    }

    /* ── SAME COLUMNS, DIFFERENT BUSINESS ACTION ──────────────────────────
       Both shapes draw the same four-column table, so the cells arrive the
       same way; what they MEAN is decided by the page. A payment has no
       stage and a quotation has no direction, and each shape's own RPC is
       what knows that -- which is the whole point of 「AI 平权」: the
       assistant calls the button's action, not a convenient one of its own.

       ⚠️ An entry with no document is money the owner has not yet applied to
       anything, which is exactly what a deposit is. The assistant does NOT
       guess which quotation 「收了陈先生三千」 belongs to -- guessing wrong
       silently moves money against the wrong job. It lands unallocated, which
       renders as 订金, which is both true and the row he can act on. */
    /* 🔴 ASK WHAT SHAPE THIS PAGE IS, then let the compiler check that every
       shape has an answer -- see refuseToWrite. Asking `Set.has` three times
       and falling through on the fourth is what put a raw database sentence in
       front of the owner on two of his pages. */
    const shape = shapeOfModule(moduleKey);
    const refusal = shape === null ? "这一页不是记录页" : refuseToWrite(shape);
    if (refusal) {
      skipped.push({ op: op.op, reason: refusal });
      continue;
    }

    const ledger = shape === "ledger";
    const directory = shape === "directory";
    const catalog = shape === "catalog";

    /* ── A NOUN IS NOT A DOCUMENT ─────────────────────────────────────────
       The cells arrive the same way on all three shapes because all three
       draw the same table. What differs is what the second one MEANS: on a
       pipeline it is who the job is with, on a ledger who the money is with,
       and on a directory it is the whole contact line -- which is a view over
       structured columns rather than a column itself.

       So the blob is kept whole in `note`, and a number inside it is lifted
       into `phone` (see phoneFrom). Nothing is discarded and nothing is
       decided that the owner did not say. */
    /* 库存, AND IT TAKES TWO WRITES.

       A row typed on the stock page -- 「水泥 50kg | 仓库 · 包 | 84」 -- means
       「I have 84 bags」, and 84 is not a column: how much is left is the sum of
       the movements (20260901070000). So the item is created and an opening
       movement is written after it, which is exactly what ERPNext's own
       `opening_stock` field does on Item.

       ⚠️ THE STATUS CELL IS IGNORED ON PURPOSE. 「充足」 is computed from the
       quantity and the reorder level; storing what the model typed would give
       the page two answers that can disagree, and this is the one shape where
       nobody can tell by eye which is right.

       ⚠️ AND THE SECOND CELL IS SPLIT ON THE PAGE'S OWN SEPARATOR. The column
       is headed 「位置 / 单位」 and rendered as 「仓库 · 包」, so reading it back
       the same way is not guessing. One value alone goes to `location`,
       because that is the half the heading names first -- and both are boxes
       on the item's own form, so a wrong guess costs one correction rather
       than a lost fact. */
    if (catalog) {
      const [locPart, unitPart] = (party || "").split("·").map((x) => x.trim());
      const { data: item, error: itemErr } = await supabase.rpc("add_catalog_item", {
        in_project_id: projectId,
        in_module_key: moduleKey,
        in_name: title,
        in_location: locPart ?? "",
        in_unit: unitPart ?? "",
        in_note: status ?? "",
        in_extra: extra,
        in_idempotency_key: keyFor(requestKey, i),
      });
      if (itemErr) {
        skipped.push({ op: op.op, reason: itemErr.message.slice(0, 80) });
        continue;
      }
      const opening = Number(String(amount ?? "").replace(/[^0-9.]/g, ""));
      if (item?.id && Number.isFinite(opening) && opening > 0) {
        /* Its own idempotency key, derived from the item's -- pressing twice
           must not add the opening stock twice. */
        await supabase.rpc("move_stock", {
          in_item_id: item.id,
          in_direction: "in",
          in_qty: opening,
          in_reason: "开帐",
          in_idempotency_key: keyFor(`${requestKey}-open`, i),
        });
      }
      written += 1;
      continue;
    }

    const { error } = directory
      ? await supabase.rpc("add_directory_entry", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_name: title,
          in_phone: phoneFrom(party) ?? "",
          in_status: status ?? "",
          in_note: party,
          in_extra: extra,
          in_idempotency_key: keyFor(requestKey, i),
        })
      : ledger
      ? await supabase.rpc("add_ledger_entry", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_amount_cents: senFrom(amount) ?? 0,
          in_party: party,
          in_note: title,
          in_extra: extra,
          in_idempotency_key: keyFor(requestKey, i),
        })
      : await supabase.rpc("add_pipeline_record", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_title: title,
          in_party: party,
          in_amount_cents: senFrom(amount) ?? null,
          /* The customer's own word for where it is stuck. Dropped until now,
             which meant 「加一单，已确认的」 quietly started at the first stage
             -- the RPC still falls back to that when this is blank. */
          in_stage: status ?? null,
          in_extra: extra,
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
