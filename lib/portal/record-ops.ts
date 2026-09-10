import type { SupabaseClient } from "@supabase/supabase-js";
import type { LayoutOp } from "./layout-ops";
import type { Skip, SkipCode } from "./skip-codes";
import { defaultDueOn, todayMYT, validityKindOf } from "./record-validity";
import { waLink } from "./wa-link";
import { ringgit } from "./live-rows";

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
export function refuseToWrite(shape: ModuleShape): SkipCode | null {
  switch (shape) {
    /* The four that have a real business action behind them. */
    case "pipeline":
    case "ledger":
    case "directory":
    case "catalog":
      return null;

    case "calendar":
      return "writeCalendar";

    case "reconcile":
      return "writeReconcile";

    /* 总览 · 报表 · 排行 · 官网 never reach here (isRecordModule gates on the
       live shapes), and they are written out anyway because the compiler asks
       for them -- and because the sentence is true if one ever does. */
    case "overview":
    case "report":
    case "leaderboard":
      return "writeAggregated";
    case "landing":
      return "landingPage";

    default: {
      const unhandled: never = shape;
      return "writeUnknown";
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
/**
 * 一段联络方式里的信箱。
 *
 * 🔴 那一格是**一格**（「Taman Desa · 013-234 5678」），而资料库那一边是
 * 两栏。`phoneFrom` 一直在挑电话，而信箱**从来没有人挑** —— 於是
 * 「加一个客户 陈先生 chen@abc.com」建出来的那一行，信箱那一栏是空的，
 * 而人从询价一按变客户的那一条（任务 89）早就分得开。
 * **同一件事三条路，只修了两条。**
 *
 * ⚠️ 只认一个 —— 一格里两个信箱的时候取第一个，跟 `phoneFrom` 同一个做法。
 */
export function emailFrom(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  /* 够用就好：一个 @，两边都不是空白，后面有一个点。发明一个更严的
     正则会挡掉真的信箱，而这里挡掉一个真的比放进一个怪的贵。 */
  const hit = String(text).match(/[^\s<>()（），,;；·]+@[^\s<>()（），,;；·]+\.[A-Za-z]{2,}/);
  return hit ? hit[0].replace(/[.,;。，；]+$/, "") : undefined;
}

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
  refused: Skip[];
};

/**
 * 按在一笔已经在的记录上的那几个动作 —— **一份，不是两份**。
 *
 * 🔴 这里本来是 `splitRecordOps` 里一条十行的 `||` 链。2026-09-09 抽出来，
 * 因为第二个地方要问同一个问题：他站在**他的系统**上讲话的时候，
 * 哪几个动作还成立（route 的 `WORK_OPS`）。
 *
 * ⚠️ 抄一份过去是这个仓库最贵的那一类错：三份同样的 key 清单，
 * 靠变红才找出两份不同步的（重点 27 第 6 步）。所以这一份是唯一一份，
 * 而 `op-lists-agree.test.ts` 就是为这件事在的。
 */
export const ACT_OPS: ReadonlySet<string> = new Set([
  "set_record_status",
  "log_work_day",
  "count_stock",
  "receive_purchase",
  "share_record",
  "unshare_record",
  "add_record_line",
  "reply_to_enquiry",
  "bill_class",
  "take_payment",
  "book_appointment",
  "set_appointment_deposit",
  "claim_booking_party",
  "request_consent",
  "set_follow_up",
  "finish_follow_up",
  "drop_follow_up",
  "reverse_ledger_entry",
]);

/**
 * 他在**他的系统**那一页上讲得动的那几个 —— 做事的全部，改样子的一个都没有。
 *
 * `add_table_row` 在记录页上就是「开一单」（`splitRecordOps` 会把它送去
 * `writeRecords`），所以它在。而它在**非**记录页上写的是版面 ——
 * 那一种由 `SplitOps.refused` 拒绝，跟这里无关。
 */
/**
 * 🔴 一张纸讲得出来的那几件 —— 「核对」那一站拦下来的就是它们。
 *
 * 一张供应商发票 · 一张手写的单 · 一张转帐单 —— 纸上有的东西只有三种：
 * **开一张单**（连它的明细）· **一笔钱** · **往一张单上再加一行**。
 *
 * ⚠️ 「客人来了」「排明天三点」不在里面，而那不是漏掉：
 * 那两件不是从纸上读来的数字，而**要他多按一次的每一下都是成本**
 * （重点 29）。真正会读错的是**没有人讲出口过的那几个数字**。
 */
export const PAPER_ACT_OPS: ReadonlySet<string> = new Set([
  "add_record_line",
  "take_payment",
  "bill_class",
]);

export const WORK_OPS: ReadonlySet<string> = new Set([
  "add_table_row",
  /*
    🔴 `remember` 在这里，而**故意不在 `ACT_OPS` 里**。

    `ACT_OPS` 那几个都要一笔记录（`record_id`），所以 `splitRecordOps` 只在
    记录页上放它们过去。而一条规矩（「合发那家都是三十天」）不属於任何一页 ——
    他在总览上讲，它就该记得住。所以 route 在分流**之前**自己接掉它。

    ⚠️ 少了这一行，他站在自己的系统上讲「记住…」会被当成改设计那一边的动作
    挡下来，而画面上讲的是「那要去设计那一屏改」—— 一句对不上的话。
  */
  "remember",
  ...ACT_OPS,
]);

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
    const refused: Skip[] = [];
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
    else if (ACT_OPS.has(op.op)) actOps.push(op);
    else layoutOps.push(op);
  }
  return { layoutOps, recordOps, actOps, refused: [] };
}

/**
 * 🔴 这一轮真的写进去的那几样 —— **撤销要用**。
 *
 * `kind` 决定撤销走哪一支，而**三种东西撤销的方式本来就不一样**
 * （20260831100000 那份档头自己写着理由）：
 *
 *   一张单    收起来（`set_pipeline_archived`）—— 一张丢掉的单是明年
 *             「上次我们报多少」的答案，而删掉一个号码会让整串号看起来坏了
 *   🔴 一笔钱  **开一笔相反的**（`reverse_ledger_entry`）—— 钱不改也不删。
 *             一个改过而看不出改过的数字，跟一句谎话分不出来
 *   名册一行  收起来（`set_directory_archived`）
 *   一件货    收起来（`set_catalog_archived`）
 *
 * ⚠️ **一个统一的「删掉」在这里是错的，而它错得看不出来。**
 */
export type Made = {
  kind: "pipeline" | "ledger" | "directory" | "catalog";
  id: string;
  /** 他看得懂的那几个字（「Kedai Aman」），印在撤销那一句里。 */
  what: string;
};

/**
 * 🔴 写进去**之前**摊给他看的那一张 —— 「核对」那一站。
 *
 * 它是 `writeRecords` / `actOnRecords` 自己在 `dry` 那一趟产出来的，
 * **不是另外拼一份字**：他按下确定之后跑的是同一段代码、同一批值，
 * 而且那一趟连守卫都照跑（挡下来的东西不会出现在这张纸上）。
 *
 * ⚠️ 两份会漂，而漂掉的那一天他核对的是 501、进去的是 510。
 *
 * 🔴 `kind` 是**代号**不是句子 —— 框那一句话住在 messages/{en,zh}.json。
 * `head` / `sub` / 那几行是**他自己的字跟他自己的数字**，一个字都不翻。
 */
export type Preview = {
  kind: "record" | "payment" | "classBill" | "line";
  /** 这一笔是什么 —— 纸上那几个字。 */
  head: string;
  /** 跟谁 —— 空的就是纸上没写。 */
  sub: string;
  lines: { text: string; amount: string }[];
  /** 那几行加起来，或者这一笔自己的金额。空的表示这一张纸上没有钱。 */
  total: string;
};

export type RecordResult = {
  written: number;
  /** 🔴 真的写进去的那几笔 —— 撤销那一颗按钮读的就是它。 */
  made: Made[];
  /**
   * 🔴 `dry` 那一趟摊出来的东西。**只有 `dry` 的时候才有** ——
   * 一个既写了又回一张「要不要写」的回覆，是这个仓库最贵的那一类谎。
   */
  preview: Preview[];
  skipped: Skip[];
  /**
   * 做成了、而且**非讲不可**的那几句 —— 「那张单上放了六行」。
   *
   * 🔴 一张从纸上抄下来的单，他唯一能拿去跟手上那张纸对一次的东西，
   * 就是助手念回来的那几个数字。写进去而不念出来，等於请他自己再打开一次。
   */
  notes: Skip[];
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
  /**
   * 开帐那一笔在货架流水上写什么。
   *
   * 🔴 **必填，而且故意排在选填那一个前面** —— 一个选填的它，等於「忘了传就
   * 静静写一个空的」，而那正是 2026-09-07 修的这个 bug 的形状。
   * `live-answers.ts` 为「谁在问」写过同一句话：写成有预设，测试里会全绿。
   */
  openingWord: string,
  /** The column keys of the table an op targets, in display order. Null when
   *  the caller cannot resolve it; see sortCells. */
  columnsFor?: (targetId: string) => string[] | null,
  /**
   * 🔴 `dry` = **摊出来给他看，一个字都不写**。
   *
   * 「核对」那一站要的东西，就是这一趟产的：守卫照跑（挡下来的不会出现
   * 在那张纸上）、格子照拆、金额照读 —— 少的只有最后那一次呼叫。
   *
   * ⚠️ 故意长在**同一段代码**里，不另外写一支「预览」：
   * 另写一支就是两份会漂的东西，而漂掉的那一天他核对的是一个数字、
   * 进去的是另一个。
   */
  opts?: { dry?: boolean },
): Promise<RecordResult> {
  const skipped: RecordResult["skipped"] = [];
  const notes: Skip[] = [];
  const made: Made[] = [];
  const preview: Preview[] = [];
  const dry = opts?.dry === true;
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
        reason: DIRECTORY_MODULES.has(moduleKey) ? "noName" : "noSubject",
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
    const refusal: SkipCode | null = shape === null ? "notARecordPage" : refuseToWrite(shape);
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
      if (dry) {
        preview.push({
          kind: "record",
          head: title,
          sub: party,
          lines: [],
          total: ringgit(senFrom(amount) ?? 0) ?? "",
        });
        written += 1;
        continue;
      }
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
        skipped.push({ op: op.op, reason: "dbSaid", vars: { detail: itemErr.message.slice(0, 80) } });
        continue;
      }
      if (item?.id) {
        made.push({ kind: "catalog", id: item.id, what: [title, party].filter(Boolean).join(" · ") });
      }
      const opening = Number(String(amount ?? "").replace(/[^0-9.]/g, ""));
      if (item?.id && Number.isFinite(opening) && opening > 0) {
        /* Its own idempotency key, derived from the item's -- pressing twice
           must not add the opening stock twice. */
        await supabase.rpc("move_stock", {
          in_item_id: item.id,
          in_direction: "in",
          in_qty: opening,
          /* 🔴 跟人按那颗按钮**一模一样**的那个词（new-record-form.tsx 用的是
             `copy.form.stockOpening`）。2026-09-07 之前这里写死中文「开帐」——
             所以一间英文系统的五金店，用讲的开一件货带开帐数量，货架流水上
             留下的是一个中文词，**而且跟他自己按出来的那几笔不是同一个词**。
             重点 23 一字不差：同一个动作两条路，只修了一条。 */
          in_reason: openingWord,
          in_idempotency_key: keyFor(`${requestKey}-open`, i),
        });
      }
      written += 1;
      continue;
    }

    /*
      🔴 那几行 —— 纸上那一张单自己带下来的。

      在这里读出来，因为下面三种页面里只有单据那一种放得下它，
      而另外两种**要讲出来它们没有被留下**（见 layout-ops 那一段）。
    */
    const paperLines = (
      Array.isArray((op as { lines?: unknown }).lines)
        ? ((op as { lines?: unknown }).lines as unknown[])
        : []
    )
      .map((raw) => raw as Record<string, unknown>)
      .filter((l) => String(l?.description ?? "").trim());

    /*
      🔴 摊出来那一趟就停在这里。

      上面每一条守卫都已经跑过（不是记录页 · 没有写这一单是什么 · 这一种
      形状写不了），所以这张纸上只会出现**真的写得进去**的东西。
      一张纸上印着一件其实会被拒绝的事，比没有那张纸更糟。
    */
    if (dry) {
      preview.push({
        kind: "record",
        head: title,
        sub: party,
        lines: paperLines.map((l) => ({
          text: [
            String(l.qty ?? "").trim() && `${String(l.qty).trim()} ×`,
            String(l.description ?? "").trim(),
            String(l.unit ?? "").trim(),
          ]
            .filter(Boolean)
            .join(" "),
          amount: ringgit(amountOfLine(l)) ?? "",
        })),
        /* 有明细就是那几行加起来（资料库也是这样加的）；
           没有明细就是这一行自己那个金额。 */
        total: paperLines.length
          ? ringgit(paperLines.reduce((n, l) => n + amountOfLine(l), 0)) ?? ""
          : ringgit(senFrom(amount) ?? 0) ?? "",
      });
      written += 1;
      continue;
    }

    const { data: opened, error } = directory
      ? await supabase.rpc("add_directory_entry", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_name: title,
          in_phone: phoneFrom(party) ?? "",
          /* 🔴 见 emailFrom 的档头：那一格是一格，而资料库是两栏。 */
          in_email: emailFrom(party) ?? "",
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
          /*
            🔴 有效期 —— 报价单 +30 天，其余留白。

            2026-09-07 之前**只有表单填它**（new-record-form.tsx 用同一支
            `defaultDueOn`），而那一支 RPC 自己不填。所以**助手开的报价单
            永远不会过期**，而人按出来的三十天后会。

            代价不只是少一栏：`nudges_due` 的第一个讯号就是「报价快到期」
            （任务 212）—— 一张永远不过期的单，**整条跟进链跳过它**。
            同一个动作两条路，只修了一条。

            ⚠️ 只有报价单有预设。一张工程单的期限是他跟客人谈出来的日子，
            替他猜一个比留白更糟（record-validity.ts 的档头写着理由）——
            所以这里问的是那一支，不是自己算一个。
          */
          in_due_on: defaultDueOn(validityKindOf(moduleKey), todayMYT()) ?? null,
          in_extra: extra,
          in_idempotency_key: keyFor(requestKey, i),
        });
    if (error) {
      skipped.push({ op: op.op, reason: "dbSaid", vars: { detail: error.message.slice(0, 80) } });
      continue;
    }
    written += 1;

    /* 🔴 撤销要指得出**哪一笔**。三种东西撤销的方式不一样（见 Made）。 */
    const row = (Array.isArray(opened) ? opened[0] : opened) as { id?: string } | null;
    if (row?.id) {
      made.push({
        kind: directory ? "directory" : ledger ? "ledger" : "pipeline",
        id: row.id,
        what: [title, party].filter(Boolean).join(" · "),
      });
    }

    if (!paperLines.length) continue;
    /*
      名册 · 货架 · 收款那三种页面上一行就是一行，没有明细这回事。
      🔴 **讲出来**：一句静静掉了六行金额的成功，比一句失败更贵。
    */
    if (directory || ledger || catalog) {
      notes.push({ op: op.op, reason: "linesNotKept", vars: { count: String(paperLines.length) } });
      continue;
    }
    if (!row?.id) {
      notes.push({ op: op.op, reason: "linesNotKept", vars: { count: String(paperLines.length) } });
      continue;
    }
    /*
      🔴 `set_record_lines` —— **人按「开一张新的」那张表单打的同一支**，
      而且是同样的顺序：先开单，再一次把行放上去（new-record-form.tsx）。

      整批换、不是一行一行加：这一支自己会先 `delete` 再插，所以同一句话
      送两次的结果跟送一次一样。而单上的总额**不在这里算** ——
      `record_lines_total_trg` 会自己加，所以那个数字永远只有一个答案
      （[重点 29] 第 1 种：算出来的最好）。
    */
    const { error: lineErr } = await supabase.rpc("set_record_lines", {
      in_record_id: row.id,
      in_lines: paperLines.map((l) => {
        const qty = Number(String(l.qty ?? "").replace(/[^0-9.]/g, ""));
        return {
          description: String(l.description ?? "").trim(),
          qty: Number.isFinite(qty) && qty > 0 ? String(qty) : "",
          unit: String(l.unit ?? "").trim(),
          unit_price_cents: senFrom(String(l.unit_price ?? "")) ?? "",
          /* 🔴 跟摊给他看那一张读的是**同一支** —— 见 amountOfLine 的档头。 */
          amount_cents: amountOfLine(l),
        };
      }),
    });
    if (lineErr) {
      notes.push({
        op: op.op,
        reason: "linesNotKept",
        vars: { count: String(paperLines.length) },
      });
      continue;
    }
    notes.push({ op: op.op, reason: "linesFromPaper", vars: { count: String(paperLines.length) } });
  }

  return { written, skipped, notes, made, preview };
}

/**
 * One key per row per request. A uuid v5 would need a dependency; this builds
 * a valid v4-shaped uuid deterministically from the request key and the row's
 * position, which is all the uniqueness a retry needs -- the same request
 * retried produces the same keys, a different request cannot collide.
 */
/**
 * 一行明细上的钱 —— **纸上印的那个数字优先**，抄不到才 数量 × 单价。
 *
 * 🔴 摊出来那一张跟真的写进去那一段，读的必须是**同一条规矩**：
 * 两边各算一次，就是他核对的是一个数字、进去的是另一个。
 */
export function amountOfLine(l: Record<string, unknown>): number {
  const qty = Number(String(l.qty ?? "").replace(/[^0-9.]/g, ""));
  const unitPrice = senFrom(String(l.unit_price ?? ""));
  const printed = senFrom(String(l.amount ?? ""));
  const worked =
    Number.isFinite(qty) && qty > 0 && unitPrice !== undefined
      ? Math.round(qty * unitPrice)
      : undefined;
  return printed ?? worked ?? 0;
}

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
/**
 * 🔴 一个马来西亚的日子跟一个钟点，变成一个确定的时刻。
 *
 * 马来西亚**永远是 UTC+8，没有日光节约** —— 所以这一句不是估算，
 * 是一个换算。写死 `+08:00` 而不是靠伺服器的时区：伺服器跑在 UTC，
 * 而 `new Date("2026-09-11T15:00")` 在那里读出来是**晚上十一点**。
 *
 * ⚠️ 浏览器那一边（`new-record-form.tsx`）故意用**当地时区**读同一串字，
 * 而那也是对的：那一台机器就在她店里。这里在伺服器上，所以要讲死。
 */
export function malaysianInstant(day: string, clock: string): string | null {
  const [h, m] = clock.split(":");
  const hh = String(h ?? "").padStart(2, "0");
  const t = Date.parse(`${day}T${hh}:${m}:00+08:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** 那个时刻在她店里是几点。念回去给她听用的。 */
export function clockOf(iso: string): string {
  const d = new Date(Date.parse(iso) + 8 * 3600 * 1000);
  return d.toISOString().slice(11, 16);
}

/**
 * 🔴 她上一次做这一样，做了多久（分钟）—— 抄不到就 null。
 *
 * [重点 29] 第 2 种：**从她自己以前的东西挑**。这个产品里没有任何地方
 * 记着一个服务做多久，所以唯一诚实的来源就是她自己排过的那几笔。
 *
 * ⚠️ 先找**同一样服务**，找不到才退回「她最近一笔」；两样都没有就回 null，
 * 而呼叫端会去问她一句。**不准回一个 60** —— 一个预设的长度看起来
 * 跟她自己的习惯一模一样，而它会静静占掉别人的位子。
 */
async function lastLength(
  supabase: SupabaseClient,
  moduleKey: string,
  service: string,
): Promise<number | null> {
  const pick = async (withService: boolean) => {
    let q = supabase
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("module_key", moduleKey)
      .is("archived_at", null)
      .order("starts_at", { ascending: false })
      .limit(1);
    if (withService) q = q.ilike("service", service);
    const { data } = await q;
    const row = ((data ?? []) as { starts_at?: string; ends_at?: string }[])[0];
    if (!row?.starts_at || !row?.ends_at) return null;
    const mins = Math.round(
      (Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60_000,
    );
    /* 十分钟到八个钟头之外的，不是一个可以照抄的习惯。 */
    return mins >= 10 && mins <= 480 ? mins : null;
  };
  return (service ? await pick(true) : null) ?? (await pick(false));
}

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
export function refuseToAct(shape: ModuleShape): SkipCode | null {
  switch (shape) {
    case "pipeline":
    case "calendar":
      return null;
    case "ledger":
      /* 钱那一栏的状态是从钱算出来的（订金 / 已入账 / 已冲正，live-rows.ts），
         不是设的。而这个 schema 对钱本来就只有一条路：不改、不删，开一张
         相反的。 */
      return "actLedger";
    case "directory":
      return "actDirectory";
    case "catalog":
      /* 「架上几件」是流水加起来的，第十几次同一个判断。设一个状态上去，
         那个数字下一次重算就把它盖掉了。 */
      return "actCatalog";
    case "reconcile":
      return "actReconcile";
    case "overview":
    case "report":
    case "leaderboard":
      return "actAggregated";
    case "landing":
      return "landingPage";
    default: {
      const unhandled: never = shape;
      return "actUnknown";
    }
  }
}

export type ActResult = RecordResult & {
  /** 顺手发生、而他应该被告知的事。**不是**模型讲的话 —— 是我们做过之后
   *  知道的事实，所以它接在回覆后面而不用再被查一次。
   *
   * 🔴 跟 skipped 一样是**代号**，词住在 messages/{en,zh}.json ——
   * 2026-09-07 之前这两句是写死的中文，而它们印在他眼前跟那几句拒绝
   * 同一个地方。见 skip-codes.ts 的档头。 */
  notes: Skip[];
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
  /**
   * 这个站对外的网址，给客人那条连结用。
   *
   * 🔴 **必填** —— 一个有预设的它，会在忘了传的时候给出一条贴进 WhatsApp
   * 打不开的相对网址，而那正是这一支要买的那一件事。来源只有一个：
   * `lib/site-url.ts` 的 `SITE_URL`（记录页那一边用的也是它）。
   */
  origin: string,
  /**
   * 这一家自己的编号，跟他这套系统有哪几页。
   *
   * 🔴 两样都是 `take_payment` 要的：一笔钱要写进**他的收款页**，
   * 而**他不一定有那一页**（每一门生意开的页不一样）。没有那一页还硬写，
   * 就是在一个他看不到的地方留下一笔钱 —— 比不写更糟。
   */
  projectId: string,
  pages: string[],
  /** 🔴 摊出来给他看，一个字都不写。见 writeRecords 上同一格的档头。 */
  opts?: { dry?: boolean },
): Promise<ActResult> {
  const skipped: RecordResult["skipped"] = [];
  const notes: Skip[] = [];
  const made: Made[] = [];
  const preview: Preview[] = [];
  const dry = opts?.dry === true;
  let written = 0;

  const shape = shapeOfModule(moduleKey);
  for (const raw of ops) {
    const op = raw as {
      op: string;
      record_id?: unknown;
      status?: unknown;
      counted?: unknown;
      what?: unknown;
    };
    const recordId = String(op.record_id ?? "").trim();
    const status = String(op.status ?? "").trim();

    /*
      🔴 摊出来那一趟只走得了纸上讲得出来的那几件（`PAPER_ACT_OPS`）。

      route 只会把那几件送进来，所以这一句今天挡不到任何东西 ——
      而它在这里，是因为**以后一定会多一个动词**，而那一天它会静静
      从这一趟里掉出去：既没有摊给他看，也没有写进去，而画面上跟成功
      一模一样。这个仓库栽过的正是这一种。
    */
    if (dry && !PAPER_ACT_OPS.has(op.op)) {
      skipped.push({ op: op.op, reason: "notFromPaper" });
      continue;
    }

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
    /*
      ── 盘点 ──────────────────────────────────────────────────────────

      「水泥数出来 84」。两样都是他讲的：哪一件货 · 数出来几个。

      🔴 差几个**不在这里算** —— `count_stock` 自己读现在有多少再写差额，
      而那是两个人同时盘点的时候唯一挡得住的地方（任务 123）。
      在这里算一次，就是同一个问题两个答案。

      ⚠️ 那一支自己还挡着：两间店以上没讲哪一间要拒绝（任务 148）·
      有批号／序号的货在货品那一层拒绝（任务 160 · 211）·
      那个「盘点」的词跟着系统语言走。**一条都不用在这里重写。**
    */
    /*
      ── 收货 ──────────────────────────────────────────────────────────

      「货到了」。人按那颗按钮送的也只有那一张单的编号，所以这里一样 ——
      几件进货架由资料库照那张单自己的逐项算。

      🔴 而它回的四个数字**非讲不可**：进了几行 · 开了几件新货 ·
      几行不够 · 几行多了。「叫了一百到了九十」正是他要在罗厘还没走的
      时候知道的那一件（任务 149 · 151）—— 助手收了货而不讲，
      那个差额要到月底对帐才现形。
    */
    /*
      ── 发一条连结给客人 / 收回 ────────────────────────────────────────

      🔴 **那一条网址非讲不可**。助手开了而不给，他就没有东西可以贴进
      WhatsApp —— 而[重点 9c] 量过：换掉这套系统的代价里第二深的一层，
      就是「他的客人手上有一条连结」。开了不给，等於没开。

      ⚠️ 只在单据上（报价单 · 订单 · 工程）。一张进货单是给供应商的，
      而钱那几页跟名册没有一张给客人看的纸。
    */
    /*
      ── 那件事做完了 / 不跟了 ──────────────────────────────────────────

      🔴 那两支收的是**下一步自己的编号**，而助手看得到的是**那一单**。
      所以先问一次再动手 —— 「先读到那一笔，才动得了它」。
      一单只有一个下一步（唯一索引 20260905800000），所以不会挑错。

      ⚠️ 两颗分开，不合成一颗：「做完了」跟「不跟了」是两句不同的话 ——
      任务 207 立过：只给一颗，他会拿它去关掉一件其实没有做的事，
      而那本帐从此在说谎。
    */
    /*
      ── 写下一步 ──────────────────────────────────────────────────────
      🔴 没有日子这一格 —— 资料库自己排在今天（`coalesce(…, today_myt())`），
      而那件事**要讲出来**：他说「下个礼拜再跟」而它落在今天那一份清单上，
      是他看得见、一下就挪得掉的；发明一个日子是他看不见的。
    */
    /*
      一张单上多一行 —— 「三包水泥加两片板」。

      🔴 走 `append_record_line`（**只加不删**），不走整批换那一支 ——
      助手看不到一张单上现在有哪几行，整批换会静静抹掉它看不见的。
      见 layout-ops.ts 那一段注解。

      ⚠️ 那一支自己挡着：不是这一家的单拒绝 · 没写字拒绝 · 一张单最多
      200 行 · 指到别人家货品拒绝 · **插完把总额重算一次**。
      一条都不用在这里重写。

      ⚠️ 只在**单据那几页**（pipeline）。明细挂在 `pipeline_records`
      上，而钱那几页 · 名册 · 货架 · 预约 都不是单据。
    */
    if (op.op === "add_record_line") {
      if (shape !== "pipeline") {
        skipped.push({ op: op.op, reason: "notPipeline" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const raw = op as unknown as {
        description?: unknown;
        qty?: unknown;
        unit?: unknown;
        unit_price?: unknown;
      };
      const description = String(raw.description ?? "").trim();
      if (!description) {
        skipped.push({ op: op.op, reason: "noLineSaid" });
        continue;
      }
      /* 数量：没讲就是 null。**不要填 1** —— 一行写着「1」而他没讲过，
         是一个看起来完整而实际上是编的数字。 */
      const qtyText = String(raw.qty ?? "").replace(/[^0-9.]/g, "");
      const qty = qtyText ? Number(qtyText) : null;
      if (dry) {
        /* 这一支的金额是**资料库乘出来**的（数量 × 单价），所以摊出来那一张
           上面也只讲得出那两个数字 —— 在这里自己乘一次，就是同一个数字
           两个答案，而两个答案会在他改数量的那天分家。 */
        preview.push({
          kind: "line",
          head: description,
          sub: [qtyText && `${qtyText} ×`, String(raw.unit ?? "").trim()].filter(Boolean).join(" "),
          lines: [],
          total: ringgit(senFrom(String(raw.unit_price ?? "")) ?? 0) ?? "",
        });
        written += 1;
        continue;
      }
      const { error: lineErr } = await supabase.rpc("append_record_line", {
        in_record_id: recordId,
        in_description: description,
        in_qty: Number.isFinite(qty as number) ? qty : null,
        in_unit: String(raw.unit ?? "").trim(),
        in_unit_price_cents: senFrom(String(raw.unit_price ?? "")) ?? null,
        /* 金额不传 —— 那一支自己 `数量 × 单价`。传一个进去就是
           同一个数字两个答案，而两个答案会在他改数量的那天分家。 */
        in_amount_cents: null,
        in_item_id: null,
        in_note: "",
      });
      if (lineErr) {
        skipped.push({
          op: op.op,
          reason: "dbSaid",
          vars: { detail: lineErr.message.slice(0, 80) },
        });
        continue;
      }
      written += 1;
      continue;
    }

    /*
      🔴 回一封官网上进来的询价 —— **写好，一句都不送出去**。

      这一支是这份档案里**唯一一个什么都不写**的动作，而那是它存在的理由：
      外面 2026 那一整类助手的形状就是「起草 · 停在那里 · 等人看过才送」，
      而[重点 32] 里老板自己讲过他最怕机器人对他的客人讲话。

      ⚠️ **不标 `done`**。他还没按送出 —— 标了就是在帐上写一件没发生的事。

      ⚠️ 那一封的号码**不从模型那里拿** —— 模型只给编号，
      号码我们自己去读。一个背得出来的号码就是一条发给另一个人的训息。
    */
    /*
      🔴 一句话开全班的学费单。

      走 `bill_class` —— **不拆成十次「加一单」**。那一支自己做四件
      这里做不了的事：每个学生自己的价钱 · 同一个月按两次不会开两张 ·
      不收钱的那几个跳过**而且数出来** · 一张单一把钥匙。

      🔴 开在**他现在站着的那一页**（`moduleKey`）—— 不是模型挑的。
      让模型讲一个页面名字，就是让它替他挑一本帐簿。

      ⚠️ 那一支回的四个数字**非讲不可**：开了几张 · 几张是上次开过的 ·
      几个不用交 · 总共多少。一间十个学生的补习中心开出八张单，
      第九第十去了哪里要讲得出来—— 不讲就是静静少了两笔钱。
    */
    /*
      🔴 收一笔钱，挂在那一张单上。

      走 `add_ledger_entry` —— **人按那颗按钮的同一支**（[重点 23]）。
      挂上 `in_against_id` 之后，那一支自己做三件事：
      从那张单读出客户是谁 · 把这笔钱分摊到那一单 · 方向由收款页决定。
      一个字都不用在这里重写。

      🔴 **还欠多少要念出来。** 他收订金的下一个念头就是这个数字，
      而它是资料库算的（`amount_cents - allocated_cents`）——
      在这里自己减一次，就是同一个数字两个答案。
    */
    /*
      🔴 排一笔预约 —— 一间沙龙每天按最多次的那一件。

      走 `add_appointment` —— 人按那颗按钮的同一支。那一支自己挡着：
      不是这一家拒绝 · 不是预约页拒绝 · 没有时间拒绝 · 结束早过开始拒绝 ·
      一笔预约要讲给谁 · **撞到别人的时段整笔挡掉**（两条排他约束，
      而它讲得出是撞到人还是撞到房）。一条都不用在这里重写。

      ── 🔴 那两个时刻是这里算的，不是模型算的 ────────────────────

      马来西亚永远是 UTC+8，没有日光节约 —— 所以 `2026-09-11T15:00+08:00`
      是一个**确定的时刻**，不是一个推测。让模型自己算 UTC，
      是把一个时区错误放进一笔会撞位子的记录里。

      ── 「做到几点」抄她自己以前那一笔 ──────────────────────────────────

      她讲「排明天三点」，不会讲「三点到四点」。而这个产品里没有任何
      地方记着一个服务做多久。所以照 [重点 29] 第 2 种：**从她自己
      以前同样的服务抄那个长度**。抄不到就问一句 —— 不编。
    */
    /*
      🔴 这一单要先收订金。

      走 `set_appointment_deposit` —— 人按那颗按钮的同一支，而它挡的是
      `works_here`：叫客人先付订金的是柜台，而柜台在一间沙龙里
      就是那个美发师自己。

      🔴 **`null` 跟 `0` 在这里不是同一件事**，所以不可以拿
      `senFrom(...) ?? null` 一句带过：`senFrom("0")` 回的是 0 而
      `senFrom("")` 回的是 undefined，两个都会掉进 `?? null` ——
      於是「讲好了不收她的」跟「这一单不用订金」写进去变成同一句话。
      她要到客人站在柜台前面才发现。
    */
    if (op.op === "set_appointment_deposit") {
      if (shape !== "calendar") {
        skipped.push({ op: op.op, reason: "notBookingPage" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const said = String((op as unknown as { amount?: unknown }).amount ?? "").trim();
      /* 她没有讲数字 = 这一单不用订金（null）。讲了 0 = 讲好了不收。 */
      const cents = said ? senFrom(said) : undefined;
      if (said && cents === undefined) {
        skipped.push({ op: op.op, reason: "noAmountSaid" });
        continue;
      }
      const { error: depErr } = await supabase.rpc("set_appointment_deposit", {
        in_id: recordId,
        in_amount_cents: said ? cents : null,
      });
      if (depErr) {
        skipped.push({
          op: op.op,
          reason: "dbSaid",
          vars: { detail: depErr.message.slice(0, 80) },
        });
        continue;
      }
      notes.push({
        op: op.op,
        reason: said ? "depositAsked" : "depositDropped",
        vars: { amount: ringgit(cents ?? 0) ?? "RM 0" },
      });
      written += 1;
      continue;
    }

    if (op.op === "claim_booking_party") {
      if (shape !== "calendar") {
        skipped.push({ op: op.op, reason: "notBookingPage" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      /* 🔴 按第二下 —— `claim_booking_party` 自己是幂等的：已经认过的
         那一笔，它静静把同一个人还回来，不开第二个。所以这里不用先查。 */
      const { data: claimed, error: claimErr } = await supabase.rpc(
        "claim_booking_party",
        { in_appointment_id: recordId },
      );
      if (claimErr) {
        skipped.push({
          op: op.op,
          reason: "dbSaid",
          vars: { detail: claimErr.message.slice(0, 80) },
        });
        continue;
      }
      const person = (Array.isArray(claimed) ? claimed[0] : claimed) as
        | { id?: string; name?: string }
        | null;
      if (person?.id) {
        made.push({
          kind: "directory",
          id: person.id,
          what: String(person.name ?? "").trim(),
        });
      }
      notes.push({
        op: op.op,
        reason: "bookingClaimed",
        vars: { who: String(person?.name ?? "").trim() },
      });
      written += 1;
      continue;
    }

    if (op.op === "request_consent") {
      if (shape !== "directory") {
        skipped.push({ op: op.op, reason: "notCustomerPage" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const formSaid = String((op as unknown as { form_id?: unknown }).form_id ?? "").trim();
      if (!formSaid) {
        skipped.push({ op: op.op, reason: "noFormSaid" });
        continue;
      }
      /*
        🔴 闭集：这里再对一次她自己的范本清单，不信模型抄对了。
        跟 book_appointment 挑师傅同一条纪律 —— 一个编出来的编号，
        就当作她没有讲清楚是哪一份，不要送去撞资料库自己那句错误。
      */
      const { data: form } = await supabase
        .from("consent_forms")
        .select("id, name")
        .eq("project_id", projectId)
        .eq("id", formSaid)
        .is("archived_at", null)
        .maybeSingle();
      if (!form?.id) {
        skipped.push({ op: op.op, reason: "noFormSaid" });
        continue;
      }
      const { error: sendErr } = await supabase.rpc("request_consent", {
        in_party_id: recordId,
        in_form_id: form.id,
      });
      if (sendErr) {
        skipped.push({
          op: op.op,
          reason: "dbSaid",
          vars: { detail: sendErr.message.slice(0, 80) },
        });
        continue;
      }
      notes.push({
        op: op.op,
        reason: "consentSent",
        vars: { form: String(form.name ?? "").trim() },
      });
      written += 1;
      continue;
    }

    if (op.op === "book_appointment") {
      if (shape !== "calendar") {
        skipped.push({ op: op.op, reason: "notBookingPage" });
        continue;
      }
      const raw = op as unknown as {
        party?: unknown;
        day?: unknown;
        from?: unknown;
        to?: unknown;
        service?: unknown;
        staff?: unknown;
        contact?: unknown;
      };
      const day = String(raw.day ?? "").trim();
      const from = String(raw.from ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{1,2}:\d{2}$/.test(from)) {
        skipped.push({ op: op.op, reason: "noWhenSaid" });
        continue;
      }
      const party = String(raw.party ?? "").trim();
      const service = String(raw.service ?? "").trim();
      const startsAt = malaysianInstant(day, from);
      if (!startsAt) {
        skipped.push({ op: op.op, reason: "noWhenSaid" });
        continue;
      }

      /* 她讲了几点结束就用她的；没讲就去她自己的簿子里抄一次。 */
      const to = String(raw.to ?? "").trim();
      let endsAt = /^\d{1,2}:\d{2}$/.test(to) ? malaysianInstant(day, to) : null;
      let how: "said" | "before" = "said";
      if (!endsAt) {
        const mins = await lastLength(supabase, moduleKey, service);
        if (!mins) {
          skipped.push({ op: op.op, reason: "noEndSaid" });
          continue;
        }
        endsAt = new Date(Date.parse(startsAt) + mins * 60_000).toISOString();
        how = "before";
      }

      /*
        🔴 哪一位做 —— 而这里**只收她自己名单上的编号**。

        那一支 RPC 对 `in_staff_id` **一个字都不验**（房间跟班级它验，
        师傅它没有 —— 20260909020000）。所以一个编出来的编号会真的写进去，
        而那一笔预约会挂在一个不存在、或者别人家的人身上。
        收紧资料库那一边是「收紧」，要单独做（[重点 31]）—— 登记在[任务 339]。

        这里挡的方法是**闭集**：上面那份清单是从她自己的名册读出来的，
        模型只能抄一个下来。抄错一个不在清单上的，就当作她没有讲。
      */
      const saidStaff = String(raw.staff ?? "").trim();
      const { data: mine } = saidStaff
        ? await supabase
            .from("directory_entries")
            .select("id")
            .eq("project_id", projectId)
            .eq("module_key", "staff")
            .eq("id", saidStaff)
            .maybeSingle()
        : { data: null };
      const staffId = (mine as { id?: string } | null)?.id ?? null;

      /* 🔴 柜台自己打进来的号码，落在跟官网订位那条路
         一样的格子上 —— 见 layout-ops.ts 里 `contact` 的档头。 */
      const contact = String(raw.contact ?? "").trim().slice(0, 40);
      const { error: bookErr } = await supabase.rpc("add_appointment", {
        in_project_id: projectId,
        in_module_key: moduleKey,
        in_starts_at: startsAt,
        in_ends_at: endsAt,
        in_party: party,
        in_service: service,
        in_staff_id: staffId,
        /* 没有人名就是**挡住这段时间**（午休 · 她去看牙医）——
           那一支自己认得这两种（`kind`），而它对 block 不要求人名。 */
        in_kind: party ? "booking" : "block",
        in_extra: contact ? { contact } : {},
        in_idempotency_key: keyFor(`${projectId}:${startsAt}:${party}`, 0),
      });
      if (bookErr) {
        /*
          🔴 撞到了，而她没有讲是哪一位做 —— 那一句要讲得出**怎么办**。

          排他的键是 `coalesce(staff_id, project_id)`，所以不指人的时候
          整间店同一时段只排得下一笔。一句笼统的「那个时间已经有人了」
          会让一间四个发型师的沙龙以为自己排满了 —— 而她只是没讲是谁做。
        */
        const clash = /already taken/i.test(bookErr.message ?? "");
        skipped.push(
          clash && !staffId
            ? { op: op.op, reason: "whoIsDoingIt" }
            : {
                op: op.op,
                reason: "dbSaid",
                vars: { detail: bookErr.message.slice(0, 80) },
              },
        );
        continue;
      }
      notes.push({
        op: op.op,
        reason: "appointmentBooked",
        vars: {
          who: party || service || "",
          when: `${day} ${from}\u2013${clockOf(endsAt)}`,
          how,
        },
      });
      written += 1;
      continue;
    }

    if (op.op === "take_payment") {
      if (shape !== "pipeline") {
        skipped.push({ op: op.op, reason: "notPipeline" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const raw = op as unknown as { amount?: unknown; method?: unknown };
      const cents = senFrom(String(raw.amount ?? ""));
      if (!cents || cents <= 0) {
        skipped.push({ op: op.op, reason: "noAmountSaid" });
        continue;
      }
      /* 🔴 他的收款页。`payments` 是目录里那一个，而**方向就是它决定的**
         （20260906060000：`case in_module_key when 'payments' then 'in'`）。
         他没开那一页就讲出来，不要静静写去别的地方。 */
      if (!pages.includes("payments")) {
        skipped.push({ op: op.op, reason: "noMoneyPage" });
        continue;
      }
      if (dry) {
        preview.push({
          kind: "payment",
          head: ringgit(cents) ?? "",
          sub: String(raw.method ?? "").trim(),
          lines: [],
          total: ringgit(cents) ?? "",
        });
        written += 1;
        continue;
      }
      const { data: entry, error: payErr } = await supabase.rpc("add_ledger_entry", {
        in_project_id: projectId,
        in_module_key: "payments",
        in_amount_cents: cents,
        /* 挂在那一张单上 —— 客户跟分摊由资料库自己接。 */
        in_against_id: recordId,
        in_method: String(raw.method ?? "").trim(),
        in_idempotency_key: keyFor(`${projectId}:${recordId}:${cents}`, 0),
      });
      if (payErr) {
        skipped.push({
          op: op.op,
          reason: "dbSaid",
          vars: { detail: payErr.message.slice(0, 80) },
        });
        continue;
      }
      /* 🔴 撤销一笔钱**不是删掉它**，是开一笔相反的 —— 见 Made 的档头。 */
      const takenRow = (Array.isArray(entry) ? entry[0] : entry) as { id?: string } | null;
      if (takenRow?.id) {
        made.push({ kind: "ledger", id: takenRow.id, what: ringgit(cents) ?? "" });
      }
      /*
        还欠多少 —— 这一段第一版是错的，而错法值得写下来。

        🔴 我读的是 `pipeline_records.allocated_cents` —— **那一栏不在那张表上**，
        它在钱那张表上（那边的 `amount - allocated` 算的是「这一笔钱还有多少
        没分出去」= 订金余额，20260831020000）。两个不存在的栏位相减得 0，
        于是它对着一张 RM 2,500 的单收了 RM 1,000 之后讲「还欠 RM 0」——
        **一个自信而错的数字，比一句「我算不出来」贵得多**，
        而他会照那一句停止追剩下的 RM 1,500。
        （2026-09-09 `check:work-ai` 第 ⑭ 段抳出来的。）

        真的那一份在 `ledger_allocations`（record_id ＋ amount_cents）——
        跟 `settleDocument` 读的是同一份。
      */
      const { data: doc } = await supabase
        .from("pipeline_records")
        .select("amount_cents")
        .eq("id", recordId)
        .maybeSingle();
      const { data: paidRows } = await supabase
        .from("ledger_allocations")
        .select("amount_cents")
        .eq("record_id", recordId);
      const paid = ((paidRows ?? []) as { amount_cents?: number }[]).reduce(
        (n, a) => n + Number(a.amount_cents ?? 0),
        0,
      );
      const owed =
        Number((doc as { amount_cents?: number } | null)?.amount_cents ?? 0) - paid;
      notes.push({
        op: op.op,
        reason: "paymentTaken",
        vars: {
          amount: ringgit(cents) ?? "RM 0",
          left: ringgit(Math.max(0, owed)) ?? "RM 0",
        },
      });
      written += 1;
      continue;
    }

    if (op.op === "bill_class") {
      const raw = op as unknown as {
        group_id?: unknown;
        amount?: unknown;
        period?: unknown;
      };
      const groupId = String(raw.group_id ?? "").trim();
      if (!groupId) {
        skipped.push({ op: op.op, reason: "noClassSaid" });
        continue;
      }
      const cents = senFrom(String(raw.amount ?? ""));
      if (!cents || cents <= 0) {
        skipped.push({ op: op.op, reason: "noFeeSaid" });
        continue;
      }
      if (dry) {
        /* ⚠️ 开得出几张要那一支自己数（谁不用交 · 谁上个月开过了），
           所以这一张纸上讲得出来的只有**每一个人多少钱**。
           在这里替他数一个出来，就是一个他核对不了的数字。 */
        preview.push({
          kind: "classBill",
          head: ringgit(cents) ?? "",
          sub: String(raw.period ?? "").trim(),
          lines: [],
          total: "",
        });
        written += 1;
        continue;
      }
      const { data: billed, error: billErr } = await supabase.rpc("bill_class", {
        in_group_id: groupId,
        /* 他现在站着的那一页。 */
        in_module_key: moduleKey,
        in_amount_cents: cents,
        in_period: String(raw.period ?? "").trim() || null,
      });
      if (billErr) {
        skipped.push({
          op: op.op,
          reason: "dbSaid",
          vars: { detail: billErr.message.slice(0, 80) },
        });
        continue;
      }
      const r = ((billed ?? []) as {
        made?: number;
        again?: number;
        free?: number;
        total_cents?: number;
        period?: string;
      }[])[0];
      notes.push({
        op: op.op,
        reason: "classBilled",
        vars: {
          made: String(r?.made ?? 0),
          again: String(r?.again ?? 0),
          free: String(r?.free ?? 0),
          /* `ringgit` 对空回 undefined（它不编一个 0 出来）——
             而这一句要有一个数字，所以这里自己兵底。 */
          total: ringgit(Number(r?.total_cents ?? 0)) ?? "RM 0",
          period: String(r?.period ?? ""),
        },
      });
      written += Number(r?.made ?? 0);
      continue;
    }

    if (op.op === "reply_to_enquiry") {
      const raw = op as unknown as { enquiry_id?: unknown; message?: unknown };
      const enquiryId = String(raw.enquiry_id ?? "").trim();
      const message = String(raw.message ?? "").trim();
      if (!enquiryId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      if (!message) {
        skipped.push({ op: op.op, reason: "noMessageSaid" });
        continue;
      }
      /* 同一支 `my_site_enquiries` —— 询价那一页读的也是它，
         而它自己只给老板（`account_id = auth.uid()`）。 */
      const { data: mine, error: readErr } = await supabase.rpc("my_site_enquiries");
      if (readErr) {
        skipped.push({
          op: op.op,
          reason: "dbSaid",
          vars: { detail: readErr.message.slice(0, 80) },
        });
        continue;
      }
      const hit = ((mine ?? []) as { id?: string; name?: string; contact?: string }[]).find(
        (r) => String(r.id ?? "") === enquiryId,
      );
      if (!hit) {
        skipped.push({ op: op.op, reason: "noSuchEnquiry" });
        continue;
      }
      const link = waLink(hit.contact, message);
      if (!link) {
        /* 客人留的可能是一个邮箱，或者一支填一半的号码。
           把他留的那一串字原样念出来，他自己就知道该怎么办。 */
        skipped.push({
          op: op.op,
          reason: "noWayToReach",
          vars: { contact: String(hit.contact ?? "").slice(0, 60) },
        });
        continue;
      }
      notes.push({
        op: op.op,
        reason: "replyDrafted",
        vars: { name: String(hit.name ?? "").slice(0, 60), link },
      });
      /* 🔴 **不算 written**。什么都没写进去，而 `written` 会打开
         `refetch`（重新读一遍页面）—— 一次什么都没变的重读。 */
      continue;
    }

    if (op.op === "set_follow_up") {
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const what = String(op.what ?? "").trim();
      if (!what) {
        skipped.push({ op: op.op, reason: "noStepSaid" });
        continue;
      }
      /* 下一步挂在一张**单**上（那一支自己 `select … from pipeline_records`）。
         别的页照样讲得出「这一页的行不是单据」，而不是一句资料库的英文。 */
      if (shape !== "pipeline") {
        skipped.push({ op: op.op, reason: "notPipeline" });
        continue;
      }
      const { error } = await supabase.rpc("set_follow_up", {
        in_record_id: recordId,
        in_what: what,
      });
      if (error) {
        skipped.push({ op: op.op, ...friendly(error.message) });
        continue;
      }
      written += 1;
      notes.push({ op: op.op, reason: "followUpSet", vars: { what } });
      continue;
    }

    if (op.op === "finish_follow_up" || op.op === "drop_follow_up") {
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const { data: found } = await supabase.rpc("follow_up_of", {
        in_record_id: recordId,
      });
      const fu = (Array.isArray(found) ? found[0] : found) as
        | { id?: unknown; what?: unknown }
        | null;
      const fuId = String(fu?.id ?? "").trim();
      if (!fuId) {
        skipped.push({ op: op.op, reason: "noFollowUp" });
        continue;
      }
      const { error } = await supabase.rpc(op.op, { in_id: fuId });
      if (error) {
        skipped.push({ op: op.op, ...friendly(error.message) });
        continue;
      }
      written += 1;
      notes.push({
        op: op.op,
        reason: op.op === "finish_follow_up" ? "followUpDone" : "followUpDropped",
        vars: { what: String(fu?.what ?? "") },
      });
      continue;
    }

    /*
      ── 冲正 ──────────────────────────────────────────────────────────

      🔴 钱不改也不删（任务 77）：开一张相反的，两张都留着。所以讲出来的
      是「多开了一张」，不是「改掉了」—— 而 refuseToAct 那一句拒绝
      （「要更正是开一张冲正」）指的就是这一支。
    */
    if (op.op === "reverse_ledger_entry") {
      if (shape !== "ledger") {
        skipped.push({ op: op.op, reason: "notMoneyPage" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const { data, error } = await supabase.rpc("reverse_ledger_entry", {
        in_entry_id: recordId,
      });
      if (error) {
        skipped.push({ op: op.op, ...friendly(error.message) });
        continue;
      }
      written += 1;
      const made = (Array.isArray(data) ? data[0] : data) as {
        amount_cents?: unknown;
      } | null;
      const sen = Number(made?.amount_cents ?? 0);
      notes.push({
        op: op.op,
        reason: "entryReversed",
        vars: { amount: sen ? (Math.abs(sen) / 100).toFixed(2) : "?" },
      });
      continue;
    }

    if (op.op === "share_record" || op.op === "unshare_record") {
      if (shape !== "pipeline" || moduleKey === "purchases") {
        skipped.push({ op: op.op, reason: "notShareable" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const { data, error } = await supabase.rpc(op.op, { in_record_id: recordId });
      if (error) {
        skipped.push({ op: op.op, ...friendly(error.message) });
        continue;
      }
      written += 1;
      if (op.op === "unshare_record") {
        notes.push({ op: op.op, reason: "shareClosed" });
        continue;
      }
      const row = (Array.isArray(data) ? data[0] : data) as { share_ref?: unknown } | null;
      const ref = String(row?.share_ref ?? "").trim();
      notes.push(
        ref
          ? { op: op.op, reason: "shareOpened", vars: { link: `${origin}/r/${ref}` } }
          /* 开了而读不回门牌 —— 讲实话，不要给他一条断掉的连结。 */
          : { op: op.op, reason: "dbSaid", vars: { detail: "no share link came back" } },
      );
      continue;
    }

    if (op.op === "receive_purchase") {
      if (moduleKey !== "purchases") {
        skipped.push({ op: op.op, reason: "notPurchasePage" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const { data, error } = await supabase.rpc("receive_purchase", {
        in_record_id: recordId,
      });
      if (error) {
        skipped.push({ op: op.op, ...friendly(error.message) });
        continue;
      }
      const hit = (Array.isArray(data) ? data[0] : data) as
        | { moved?: unknown; created?: unknown; short?: unknown; over?: unknown }
        | null;
      const moved = Number(hit?.moved ?? 0);
      const created = Number(hit?.created ?? 0);
      const short = Number(hit?.short ?? 0);
      const over = Number(hit?.over ?? 0);
      if (moved > 0) written += 1;
      notes.push(
        moved > 0
          ? { op: op.op, reason: "goodsReceived", vars: { moved: String(moved) } }
          : { op: op.op, reason: "goodsNothing" },
      );
      if (created > 0) {
        notes.push({ op: op.op, reason: "goodsNew", vars: { created: String(created) } });
      }
      if (short > 0 || over > 0) {
        notes.push({
          op: op.op,
          reason: "goodsMismatch",
          vars: { short: String(short), over: String(over) },
        });
      }
      continue;
    }

    if (op.op === "count_stock") {
      if (shape !== "catalog") {
        skipped.push({ op: op.op, reason: "notShelfPage" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noRecordSaid" });
        continue;
      }
      const said = String(op.counted ?? "").trim();
      if (!said) {
        skipped.push({ op: op.op, reason: "noCountSaid" });
        continue;
      }
      /*
        🔴 0 是一个真的答案（数完发现没有了），而「很多」不是。

        第一版是 `Number(said.replace(/[^0-9.]/g, ""))` —— 而「很多」洗完是
        空字串，`Number("")` 是 **0**，於是**一句「很多」会把架上清成零**。
        守卫第一次跑就抓到它。所以先要求里面真的有一个数字。
      */
      const digits = said.replace(/[^0-9.]/g, "");
      const counted = /[0-9]/.test(digits) ? Number(digits) : NaN;
      if (!Number.isFinite(counted) || counted < 0) {
        skipped.push({ op: op.op, reason: "countNotANumber", vars: { said } });
        continue;
      }
      const { data, error } = await supabase.rpc("count_stock", {
        in_item_id: recordId,
        in_counted: counted,
        /* 那个词由资料库照 system_language 挑 —— 跟人按那颗按钮同一条
           （stocktake.tsx 也不传）。 */
      });
      if (error) {
        skipped.push({ op: op.op, ...friendly(error.message) });
        continue;
      }
      const hit = (Array.isArray(data) ? data[0] : data) as
        | { before?: unknown; counted?: unknown; moved?: unknown }
        | null;
      const moved = Number(hit?.moved ?? 0);
      if (moved === 0) {
        /* 🔴 一样就什么都不记（一笔 0 的流水是他帐上一行没有发生过的事）——
           而那要讲出来，不然他不知道刚才那一句到底做了什么。 */
        notes.push({ op: op.op, reason: "stockSame", vars: { counted: String(counted) } });
        continue;
      }
      written += 1;
      notes.push({
        op: op.op,
        reason: "stockCounted",
        vars: {
          before: String(hit?.before ?? "?"),
          counted: String(counted),
          moved: (moved > 0 ? "+" : "") + String(moved),
        },
      });
      continue;
    }

    if (op.op === "log_work_day") {
      if (moduleKey !== "staff") {
        skipped.push({ op: op.op, reason: "dayNotStaffPage" });
        continue;
      }
      if (!recordId) {
        skipped.push({ op: op.op, reason: "noStaffSaid" });
        continue;
      }
      if (!(WORK_DAY_KINDS as readonly string[]).includes(status)) {
        skipped.push({
          op: op.op,
          reason: "dayKinds",
        });
        continue;
      }
      const { data, error } = await supabase.rpc("log_work_day", {
        in_staff_id: recordId,
        in_kind: status,
      });
      if (error) {
        skipped.push({ op: op.op, ...friendly(error.message) });
        continue;
      }
      written += 1;
      /* 哪一天，是**资料库**算的（today_myt），不是浏览器算的 —— 半夜到早上
         八点那八个钟头两边差一天，而那正好是他补记昨天工的时段。所以把它
         回报的那一天念出来：他看得到记到哪一天去了。 */
      const day = (Array.isArray(data) ? data[0] : data) as { on_date?: unknown } | null;
      if (day?.on_date) notes.push({ op: op.op, reason: "dayLogged", vars: { on: String(day.on_date) } });
      continue;
    }

    const refusal: SkipCode | null = shape === null ? "notARecordPage" : refuseToAct(shape);
    if (refusal) {
      skipped.push({ op: op.op, reason: refusal });
      continue;
    }
    if (!recordId) {
      skipped.push({ op: op.op, reason: "noRecordSaid" });
      continue;
    }
    if (!status) {
      skipped.push({ op: op.op, reason: "noStatusSaid" });
      continue;
    }

    if (shape === "calendar") {
      if (!(APPOINTMENT_STATES as readonly string[]).includes(status)) {
        skipped.push({
          op: op.op,
          reason: "apptStates",
          vars: { list: APPOINTMENT_STATES.join(" · ") },
        });
        continue;
      }
      const { data, error } = await supabase.rpc("set_appointment_status", {
        in_id: recordId,
        in_status: status,
      });
      if (error) {
        skipped.push({ op: op.op, ...friendly(error.message) });
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
        notes.push({
          op: op.op,
          reason: "packageUsed",
          vars: {
            name: String(used.package_name ?? ""),
            left: String(used.sessions_left ?? "?"),
          },
        });
      }
      continue;
    }

    /* pipeline —— 唯一剩下的那一个（refuseToAct 已经把其余全部挡掉了）。 */
    if (allowedStatuses.length && !allowedStatuses.includes(status)) {
      skipped.push({
        op: op.op,
        reason: "pageStates",
          vars: { list: allowedStatuses.join(" · ") },
      });
      continue;
    }
    const { error } = await supabase.rpc("update_pipeline_record", {
      in_id: recordId,
      in_stage: status,
    });
    if (error) {
      skipped.push({ op: op.op, ...friendly(error.message) });
      continue;
    }
    written += 1;
  }

  return { written, skipped, notes, made, preview };
}

/** 资料库讲的那一句，换成他读得懂的。认不出来的原样带出去 —— 编一句
 *  「出了点问题」比一句看不懂的英文更糟：他连拿去问都问不了。 */
function friendly(message: string): { reason: SkipCode; vars?: Record<string, string> } {
  if (/no such record in your project/i.test(message)) return { reason: "noSuchRow" };
  if (/not a pipeline module/i.test(message)) return { reason: "notPipeline" };
  if (/in_status/i.test(message))
    return { reason: "apptStates", vars: { list: APPOINTMENT_STATES.join(" · ") } };
  /* 🔴 认不得的那一句是资料库自己讲的，而且它讲英文 —— 包一层，至少让他
     知道那不是我们在跟他讲话。 */
  return { reason: "dbSaid", vars: { detail: message.slice(0, 80) } };
}
