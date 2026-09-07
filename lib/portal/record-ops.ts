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

/**
 * 这一页上那张表的行，是从别的页面算出来的吗？
 *
 * 🔴 这一句决定「加一行」该不该被挡下来，而它跟「这一页加不加得了记录」
 * 不是同一个问题 —— `refuseToWrite` 答的是后者。两句都是对着同一个
 * 封闭的形状表逐项写的，少一个就是编译错误。
 *
 * 证据在 `app/[locale]/portal/[pageKey]/page.tsx`：总览（recentOf）·
 * 报表 · 排行 三种都会跑一次 `withLiveRows`，而**官网不会**。
 *
 * ⚠️ 所以官网上「加一行」照旧写进版面，而且那是对的：那一页的价目表
 * 是他自己写的内容，不是他的帐 —— 而既有那条测试（「touches nothing on a
 * module whose rows are layout」）挡了我一次，它是对的。
 */
export function rowsAreProjected(shape: ModuleShape): boolean {
  switch (shape) {
    /* 这三页上那张表画的是别的页面的行 —— 写进版面的那一笔要嘛被盖掉，
       要嘛留在画面上当一个不在任何一份记录里的数字。 */
    case "overview":
    case "report":
    case "leaderboard":
      return true;

    /* 官网那几块是他自己写的内容。 */
    case "landing":
      return false;

    /* 这六种自己有一张真的表，走的是各自的写入函式，到不了这里。 */
    case "pipeline":
    case "ledger":
    case "directory":
    case "catalog":
    case "calendar":
    case "reconcile":
      return false;

    default: {
      const unhandled: never = shape;
      void unhandled;
      return false;
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
  /** 按在一笔已经存在的记录上的动作。跟 recordOps 分开，因为它们走不同的
   *  RPC，而且一个是「多一行」、一个是「动他帐上已经有的那一行」。 */
  actOps: LayoutOp[];
  /**
   * 🔴 在这一页上「加一行」根本不成立 —— 而在 2026-09-07 之前它**看起来成立**。
   *
   * 量出来的（总览 · 报表 · 排行 · 官网四页）：
   *
   *     dashboard  applied:1  skipped:[]   ← 写进了版面，而且回报成功
   *
   * 那一笔进的是**版面的 props**，不是他的帐本 —— 而 live-rows 的投影一有真行
   * 就整个盖掉 `table.rows`。所以那一行要嘛静静消失，要嘛留在画面上当一个
   * 不在任何一份记录里的数字。**这个档案的档头就在描述这个形状**
   * （「erased the moment the live-rows projection replaces the table」），
   * 而 2026-08-30 那一次只把 live 那几页接上了。
   *
   * ⚠️ 而 `refuseToWrite` 那四句话早就写好了，它自己的注解写着
   * 「never reach here」—— 那句话是对的（它们到不了写入那一支），
   * 而它们也**没有被拒绝**。少的不是句子，是把句子接上去。
   *
   * ⚠️ **目录以外的页面不在这里** —— 一个老板自己取名的页面背后没有表、
   * 也没有投影，写进版面本来就是它唯一对的做法。这一栏只收
   * 「目录认得、而它没有一个真的业务动作」的那四种。
   */
  refused: { op: string; reason: string }[];
};

/**
 * Separate the rows that are records from the operations that are layout.
 *
 * Only on a module whose rows are real -- on 客户 or 库存 a table row is still
 * a layout row, and will be until those shapes have tables of their own.
 */
export function splitRecordOps(ops: LayoutOp[], pageKey: string | null | undefined): SplitOps {
  if (!isRecordModule(pageKey)) {
    /* 目录认不得这一页（老板自己取名的），或者官网 -> 它背后没有投影，
       写进版面本来就是它唯一对的做法。 */
    const shape = shapeOfModule(pageKey);
    const reason = shape && rowsAreProjected(shape) ? refuseToWrite(shape) : null;
    if (!reason) return { layoutOps: ops, recordOps: [], actOps: [], refused: [] };
    /* 🔴 目录认得，而它没有一个真的业务动作 —— 见 SplitOps.refused。
       只挡「加一行」：另外两个动作（改状态 · 记一天工）由 applyLayoutOps
       自己拒绝，而它那两句话跟这一页是哪一种无关，已经是对的。 */
    const kept: LayoutOp[] = [];
    const refused: { op: string; reason: string }[] = [];
    for (const op of ops) {
      if (op.op === "add_table_row") refused.push({ op: op.op, reason });
      else kept.push(op);
    }
    return { layoutOps: kept, recordOps: [], actOps: [], refused };
  }
  const layoutOps: LayoutOp[] = [];
  const recordOps: LayoutOp[] = [];
  const actOps: LayoutOp[] = [];
  for (const op of ops) {
    if (op.op === "add_table_row") recordOps.push(op);
    else if (op.op === "set_record_status" || op.op === "log_work_day") actOps.push(op);
    else layoutOps.push(op);
  }
  return { layoutOps, recordOps, actOps, refused: [] };
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

/**
 * 资料库认得的那四个预约状态，一个字都不能多。
 *
 * ⚠️ 这是第四份，而另外三份我没有动（两份在画面那一边、而且正在被改）：
 * `new/appointment-status.tsx` 的 STATES（人按的那四颗）·
 * `(app)/classes/class-desk.tsx` 的点名 · `live-rows.ts` 里两处 `=== "no_show"`。
 * 该收敛成这一份 —— 登记，不动手（重点 20）。
 */
/** 资料库认得的那三种。`log_work_day` 自己 `k not in (...)` 挡着。 */
export const WORK_DAY_KINDS = ["full", "half", "absent"] as const;

export const APPOINTMENT_STATES = ["booked", "done", "no_show", "cancelled"] as const;

/**
 * 为什么这一页的行动不了状态 —— 或者 null，表示动得了。
 *
 * 跟 `refuseToWrite` 同一个形状、同一个理由：先问「这一页是哪个形状」，
 * 再让编译器检查每一个形状都有答案。一条最后一节是猜的 else 链，
 * 2026-09-07 那天把一句资料库的英文放到了他两页上。
 *
 * 每一句拒绝都要讲得出**该去哪里做那件事**。一句只会说「不行」的拒绝，
 * 是一个比较礼貌的死路。
 */
export function refuseToAct(shape: ModuleShape): string | null {
  switch (shape) {
    case "pipeline":
    case "calendar":
      return null;
    case "ledger":
      /* 钱那一栏的状态是从钱算出来的（订金 / 已入账 / 已冲正，live-rows.ts），
         不是设的。而这个 schema 对钱本来就只有一条路：不改、不删，开一张
         相反的。 */
      return "钱记下来就不改了 —— 要更正是开一张冲正，到那一笔上开";
    case "directory":
      return "名册上的人没有状态可以按 —— 要改他的资料，点开他那一页";
    case "catalog":
      /* 「架上几件」是流水加起来的，第十几次同一个判断。设一个状态上去，
         那个数字下一次重算就把它盖掉了。 */
      return "货架上那一栏是数量算出来的 —— 要改架上几件，到货架那一页盘一次";
    case "reconcile":
      return "对帐是把一个月签起来，不是设状态 —— 到对帐那一页签";
    case "overview":
    case "report":
    case "leaderboard":
      return "这一页的行是别的页面加起来的，改不了";
    case "landing":
      return "这是给客人看的那一页，不是记录页";
    default: {
      const unhandled: never = shape;
      return `这一页还不能改状态：${String(unhandled)}`;
    }
  }
}

export type ActResult = RecordResult & {
  /** 顺手发生、而他应该被告知的事。**不是**模型讲的话 —— 是我们做过之后
   *  知道的事实，所以它接在回覆后面而不用再被查一次。 */
  notes: string[];
};

/**
 * 按下那一行自己的按钮 —— 走人按的那一支 RPC。
 *
 * ── 那个值为什么要先验一次 ────────────────────────────────────────────────
 *
 * `update_pipeline_record` 对 stage **一个字都不验**（`left(btrim(...), 60)`），
 * 所以一个编出来的阶段会真的写进那一行，而那一行会从看板上掉下去 ——
 * 任务 95c 量过那件事。人在表单上看到的是一个 `<select>`，所以验一次是
 * 跟那个框**一样严，不是更严**。
 *
 * ⚠️ 而这一页要是**一个阶段都没有宣告**，人的表单就不是下拉是自由文字 ——
 * 那时候助手也放行。比它在驱动的那个栏位更受限，是 set_text 那条注解
 * 明确讲过不要做的事。
 *
 * 预约那一边不看这份清单：它的四个值是资料库自己挡的，一页一页都一样。
 */
export async function actOnRecords(
  supabase: SupabaseClient,
  moduleKey: string,
  ops: LayoutOp[],
  /** 这一页的 `<select>` 里有哪几个 —— 人看到的那一份。空的表示这一页没有
   *  宣告过阶段，那时候人也是自由打字。 */
  allowedStatuses: string[],
): Promise<ActResult> {
  const skipped: RecordResult["skipped"] = [];
  const notes: string[] = [];
  let written = 0;

  const shape = shapeOfModule(moduleKey);
  for (const raw of ops) {
    const op = raw as { op: string; record_id?: unknown; status?: unknown };
    const recordId = String(op.record_id ?? "").trim();
    const status = String(op.status ?? "").trim();

    /*
      ── 记一天工，而它不是「改那一行的一栏」 ──────────────────────────────

      名册上那一行是「阿明」，而这一支写的是「阿明九月七号」—— 另一张表
      （work_days）。所以它跟 set_record_status 分开，一个业务动作一个具名的
      动词（外面那份允许清单就是这个形状）。

      🔴 只在师傅那一页。资料库那一支**没有**检查那个人是不是师傅
      （`log_work_day` 只 select project_id），而算佣金那两支是有查
      `module_key = 'staff'` 的 —— 两边不一致，所以这一层先挡着。
      收紧资料库那一边是「收紧」，要单独做（重点 31），登记。
    */
    if (op.op === "log_work_day") {
      if (moduleKey !== "staff") {
        skipped.push({ op: op.op, reason: "一天工记在师傅那一页，这一页不是名册" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "没有讲是哪一个师傅" });
        continue;
      }
      if (!(WORK_DAY_KINDS as readonly string[]).includes(status)) {
        skipped.push({
          op: op.op,
          reason: `一天工只有这三个：full(整天) · half(半天) · absent(没来)`,
        });
        continue;
      }
      const { data, error } = await supabase.rpc("log_work_day", {
        in_staff_id: recordId,
        in_kind: status,
      });
      if (error) {
        skipped.push({ op: op.op, reason: friendly(error.message) });
        continue;
      }
      written += 1;
      /* 哪一天，是**资料库**算的（today_myt），不是浏览器算的 —— 半夜到早上
         八点那八个钟头两边差一天，而那正好是他补记昨天工的时段。所以把它
         回报的那一天念出来：他看得到记到哪一天去了。 */
      const day = (Array.isArray(data) ? data[0] : data) as { on_date?: unknown } | null;
      if (day?.on_date) notes.push(`记在 ${String(day.on_date)}。`);
      continue;
    }

    const refusal = shape === null ? "这一页不是记录页" : refuseToAct(shape);
    if (refusal) {
      skipped.push({ op: op.op, reason: refusal });
      continue;
    }
    if (!recordId) {
      skipped.push({ op: op.op, reason: "没有讲是哪一笔" });
      continue;
    }
    if (!status) {
      skipped.push({ op: op.op, reason: "没有讲要改成什么" });
      continue;
    }

    if (shape === "calendar") {
      if (!(APPOINTMENT_STATES as readonly string[]).includes(status)) {
        skipped.push({
          op: op.op,
          reason: `预约只有这四个：${APPOINTMENT_STATES.join(" · ")}`,
        });
        continue;
      }
      const { data, error } = await supabase.rpc("set_appointment_status", {
        in_id: recordId,
        in_status: status,
      });
      if (error) {
        skipped.push({ op: op.op, reason: friendly(error.message) });
        continue;
      }
      written += 1;
      /*
        🔴 顺手扣掉的那一次要讲出来。

        任务 225 让「客人来了」同时扣一次套票 —— 那是他按那颗按钮时画面上
        会写出来的事。助手按同一支而不讲，就是一个静静少掉一次的套票，
        而他要到客人下次来才发现。
      */
      const hit = Array.isArray(data) ? data[0] : data;
      const used = hit as { used_package_id?: unknown; package_name?: unknown; sessions_left?: unknown } | null;
      if (used?.used_package_id) {
        notes.push(
          `顺手扣了「${String(used.package_name ?? "套票")}」一次，还剩 ${String(used.sessions_left ?? "?")} 次。`,
        );
      }
      continue;
    }

    /* pipeline —— 唯一剩下的那一个（refuseToAct 已经把其余全部挡掉了）。 */
    if (allowedStatuses.length && !allowedStatuses.includes(status)) {
      skipped.push({
        op: op.op,
        reason: `这一页的状态只有：${allowedStatuses.join(" · ")}`,
      });
      continue;
    }
    const { error } = await supabase.rpc("update_pipeline_record", {
      in_id: recordId,
      in_stage: status,
    });
    if (error) {
      skipped.push({ op: op.op, reason: friendly(error.message) });
      continue;
    }
    written += 1;
  }

  return { written, skipped, notes };
}

/** 资料库讲的那一句，换成他读得懂的。认不出来的原样带出去 —— 编一句
 *  「出了点问题」比一句看不懂的英文更糟：他连拿去问都问不了。 */
function friendly(message: string): string {
  if (/no such record in your project/i.test(message)) return "找不到那一笔（或者它不是这一家的）";
  if (/not a pipeline module/i.test(message)) return "这一页的行不是单据";
  if (/in_status/i.test(message)) return `预约只有这四个：${APPOINTMENT_STATES.join(" · ")}`;
  return message;
}
