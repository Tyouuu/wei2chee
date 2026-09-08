import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatusTone } from "@/lib/templates/copy/types";
import { isPastDue } from "./record-validity";

/**
 * The customer's own rows, put into the page that was going to show samples.
 *
 * ── WHY A PROJECTION AND NOT A COMPONENT THAT FETCHES ─────────────────────
 *
 * A page in this product is a saved Puck tree, and a table's rows are PROPS
 * inside it (see recordTable in lib/templates/industry-template.ts). So there
 * are two places rows could become real: the component could fetch them, or
 * the tree could be rewritten on the way to the browser.
 *
 * The component fetching is wrong here for a reason that has nothing to do
 * with taste: RecordTable is also rendered into the style gallery, the landing
 * page's showroom, hundreds of live thumbnails and the printed page. A
 * component that reaches for a database is a component that cannot be drawn in
 * any of those places. The projection keeps the drawing pure and puts the
 * knowledge where the page is assembled -- which is also where publish
 * projection already lives, so this is the shape this repo already uses.
 *
 * ── HOW THE SAMPLES RETIRE ────────────────────────────────────────────────
 *
 * They do not need a flag, a migration or a state to maintain: this returns
 * the real rows when there are any and leaves the tree untouched when there
 * are none. The first quotation a customer writes replaces the demonstration,
 * and an empty business still gets a page that teaches them what it is for.
 *
 * That is the founder's decision of 2026-08-30 (「留着、标清楚、加第一笔真的就
 * 消失」) implemented by construction rather than by bookkeeping.
 */

import {
  PIPELINE_MODULES,
  LEDGER_MODULES,
  DIRECTORY_MODULES,
  CATALOG_MODULES,
  RECONCILE_MODULES,
  CALENDAR_MODULES,
} from "./shape-state";
import {
  systemLangOf,
  workflowStages,
  type BusinessContext,
} from "@/lib/templates/industry-template";

export type LiveRow = {
  primary: string;
  secondary?: string;
  amount?: string;
  tone: StatusTone;
  status: string;
  /* WHEN, for the one shape whose axis is time.
   *
   * A diary block needs the clock face and a table does not, and squeezing
   * 「09:30」 into `secondary` so both could read it would mean parsing a
   * display string back into a time -- which is how a 「10:00 - Mrs Lee」 row
   * ends up sorted after 「9:30」. Optional, and every other shape leaves it
   * unset. */
  at?: { time: string; endTime?: string };
  /* 谁做的 —— 只有预约那一个形状给得出来。
   *
   * 🔴 它不塞进 `secondary`：一天摊开、一个人一栏的时候，那一栏是**分栏的
   * 依据**，而从一句「Amy · 官网」里把名字切回来，就是 `at` 那一段警告过的
   * 同一件事 —— 把画面上的字反着解析回资料。
   *
   * 一行都没有给的时候，那一根轴自己退回原来那几种画法（`trade-blocks`
   * 的 DaySchedule 判的就是这一句）：一间一个人的店、一张补习课表，
   * 本来就没有「谁做的」这件事。 */
  who?: string;
  /* ── THE TENTH OF THIS BUSINESS THAT IS ONLY THIS BUSINESS ──────────────
   *
   * 「车牌号」 for a workshop, 「染发配方」 for a salon, 「货柜号」 for a
   * wholesaler. Keyed by the COLUMN KEY the owner's own column carries, so a
   * hundred businesses share one table and none of them needs a schema change.
   *
   * Before this existed, `add_table_column` put the column on the page and
   * every row under it was blank forever -- the column was real and its values
   * had nowhere to live. That is the whole reason `extra` was added to both
   * tables, and nothing wrote it. */
  extra?: Record<string, string>;
  /* WHERE THIS ROW LIVES.
   *
   * A record he can write and cannot fix is a record he keeps a second copy
   * of in WhatsApp. The row carries its own address so the first cell can be
   * a link to it -- a LINK and not a control, because this table is drawn in
   * the style gallery, in hundreds of thumbnails and on paper, where there is
   * no session and nothing to click. Inert everywhere else; the writing all
   * happens on the page it points at. */
  href?: string;
};

/** Cell keys the table model owns. Anything else on a row is the owner's own
 *  column and lives in `extra`. Mirrors normalizeTable() in table-model.ts. */
const BUILT_IN_KEYS = new Set(["primary", "secondary", "amount", "status"]);

/** Whatever the business put in `extra`, as strings a table cell can show.
 *  Objects and arrays are dropped rather than stringified: 「[object Object]」
 *  in a customer's own system is worse than an empty cell. */
function extraCells(extra: unknown): Record<string, string> | undefined {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
    if (BUILT_IN_KEYS.has(k)) continue;
    if (v == null) continue;
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

type PipelineRecord = {
  id?: string;
  title: string | null;
  party: string | null;
  amount_cents: number | null;
  stage: string | null;
  /** 有效期 / 期限 / 预计到货 —— 同一栏，三种意思（record-validity.ts）。 */
  due_on?: string | null;
  extra?: unknown;
};

/**
 * Ringgit from sen. Grouped, and without decimals when there are none --
 * 「RM 48,500」 is how a contractor writes it and 「RM 48,500.00」 is how
 * software does.
 */
export function ringgit(cents: number | null | undefined): string | undefined {
  if (cents == null || !Number.isFinite(cents)) return undefined;
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", {
    minimumFractionDigits: whole % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A stage has no severity of its own -- 「等确认」 is not a warning, it is where
 * most of a healthy pipeline sits. So the tone comes from POSITION: the last
 * stage of this business's workflow is done, the first is not started, and
 * everything between is in progress.
 *
 * Falling back to neutral when the stage is not in the list is deliberate. A
 * stage the workflow does not contain is one the customer typed or renamed,
 * and colouring it by guesswork would be inventing a judgement about their
 * business.
 */
export function toneForStage(stage: string, workflow: string[]): StatusTone {
  const i = workflow.findIndex((s) => s === stage);
  if (i < 0) return "neutral";
  if (i === workflow.length - 1) return "positive";
  if (i === 0) return "neutral";
  return "warning";
}

export function rowsFromRecords(
  records: PipelineRecord[],
  workflow: string[],
  href?: (id: string) => string,
  today?: string,
): LiveRow[] {
  return records.map((r) => {
    /* ⚠️ 这一行的日子过了，而它还开着 —— 一张过期的报价单、一张逾期的工程单、
       一张还没到的进货单。**算出来的，不存**：一个存起来的旗子在排程没跑的
       那一天就在说谎（record-validity.ts 的档头写了为什么）。

       为什么让它盖过 toneForStage：`negative` 在这张表上今天没有别的来源
       （toneForStage 只吐 positive / warning / neutral），所以红色只代表
       一件事 —— 这个日子过了。而那是老板扫一整页的时候唯一要先看到的。

       ⚠️ 它现在只有颜色，没有字。要一个「过期」的词，得改 RecordTable，
       而那是风格库那一层（重点 22c），不是这个 session 的地盘。已记进任务档。 */
    const overdue = isPastDue({
      dueOn: r.due_on,
      stage: r.stage,
      workflow,
      today,
    });
    return {
      ...(href && r.id ? { href: href(r.id) } : {}),
      primary: (r.title ?? "").trim() || (r.party ?? "").trim(),
      secondary: (r.party ?? "").trim() || undefined,
      amount: ringgit(r.amount_cents),
      tone: overdue ? ("negative" as const) : toneForStage((r.stage ?? "").trim(), workflow),
      status: (r.stage ?? "").trim(),
      extra: extraCells(r.extra),
    };
  });
}

/* ── THE OTHER SHAPE ────────────────────────────────────────────────────────
 *
 * 收款 · 开销 · 佣金 draw the same RecordTable with the same four column keys,
 * so the projection below is shared and only the row-building differs. A second
 * copy of withLiveRows() for the second shape would be the mistake next_doc_no
 * was deliberately written to avoid.
 */


type LedgerEntry = {
  id: string;
  doc_no: string | null;
  party: string | null;
  direction: string | null;
  amount_cents: number | null;
  allocated_cents: number | null;
  adjusts_id: string | null;
  note: string | null;
  extra?: unknown;
};

/**
 * What a money row says about itself.
 *
 * Every one of these is READ, not judged -- the same rule as toneForStage. A
 * ledger has no opinion to offer beyond what the columns already state:
 *
 *   冲正 / 已冲正   this entry cancels another, or has been cancelled. Marked
 *                  on BOTH so the pair reads as a pair; a corrected figure
 *                  with no visible correction is the thing adjusts_id exists
 *                  to prevent.
 *   订金            money in that is not yet applied to any document. Warning
 *                  is right: it is the row an owner has to do something about.
 *   已入账          money in, fully applied.
 *   已付            money out. Allocation says nothing about an expense --
 *                  buying cement is not "applied" to anything -- so it does
 *                  not claim to.
 */
const LEDGER_WORDS = {
  zh: { reversal: "冲正", reversed: "已冲正", deposit: "订金", applied: "已入账", paid: "已付" },
  en: { reversal: "Reversal", reversed: "Reversed", deposit: "Deposit", applied: "Recorded", paid: "Paid" },
} as const;

/** Which way money normally moves on this page. Mirrors the default inside
 *  add_ledger_entry(); a row going the other way is the exception and is the
 *  only one worth marking. */
function usualDirection(moduleKey: string): "in" | "out" {
  return moduleKey === "payments" ? "in" : "out";
}

export function rowsFromEntries(
  entries: LedgerEntry[],
  moduleKey: string,
  lang: "zh" | "en" = "zh",
  href?: (id: string) => string,
): LiveRow[] {
  const w = LEDGER_WORDS[lang] ?? LEDGER_WORDS.zh;
  const usual = usualDirection(moduleKey);
  const cancelled = new Set(entries.map((e) => e.adjusts_id).filter(Boolean) as string[]);

  return entries.map((e) => {
    const dir = (e.direction ?? usual) === "out" ? "out" : "in";
    const out = dir === "out";
    const against = dir !== usual;
    const amount = ringgit(e.amount_cents);

    let status: string;
    let tone: StatusTone;
    if (e.adjusts_id) {
      status = w.reversal;
      tone = "negative";
    } else if (cancelled.has(e.id)) {
      status = w.reversed;
      tone = "negative";
    } else if (!out && (e.amount_cents ?? 0) > (e.allocated_cents ?? 0)) {
      status = w.deposit;
      tone = "warning";
    } else if (!out) {
      status = w.applied;
      tone = "positive";
    } else {
      status = w.paid;
      tone = "neutral";
    }

    return {
      ...(href && e.id ? { href: href(e.id) } : {}),
      /* What the money was for. The note is the owner's own words; the
         document number is what is printed on the receipt when there are
         none. Never blank -- the first column is the one a person scanning a
         list cannot read past. */
      primary: (e.note ?? "").trim() || (e.doc_no ?? "").trim(),
      secondary: (e.party ?? "").trim() || undefined,
      /* A minus only where the direction is not this page's own. On 收款 that
         marks a reversal; on 开销 every row is out, so nothing is marked and
         the column stays readable. Signing every row on an expenses page
         would be noise, not information. */
      amount: amount && against ? `− ${amount}` : amount,
      tone,
      status,
      extra: extraCells(e.extra),
    };
  });
}

/* ── THE THIRD SHAPE ────────────────────────────────────────────────────────
 *
 * 客户 · 供应商 · 员工. A noun rather than a document, which changes exactly
 * three things about the row it produces -- and each of them is a thing this
 * function deliberately does NOT do:
 *
 *   no amount   Every amount a directory page shows (未付 · 本月业绩 · 累计) is
 *               a sum of OTHER rows. There is no column on directory_entries
 *               to read one from, on purpose: a typed figure is right the day
 *               it is typed and lying the first time money moves. The cell
 *               stays empty until the ledger link can compute it.
 *
 *   no tone     A stage has a position in a workflow, so toneForStage can read
 *               severity off it without judging. 「新客户」 has no position.
 *               Colouring it would be inventing an opinion about somebody
 *               else's customer, which is the same thing toneForStage refuses
 *               to do when a stage is not in the list.
 *
 *   no invented status  A party with no word typed against it shows nothing,
 *               rather than 「活跃」 -- we have not been told that.
 */

type DirectoryEntry = {
  id?: string;
  name: string | null;
  kind: string | null;
  contact_person: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  region: string | null;
  status: string | null;
  note: string | null;
  extra?: unknown;
};

/**
 * The one line under a party's name -- the column the generated page heads
 * 「联络方式 / 备注」 (Contact / notes).
 *
 * It is COMPOSED, not stored, and that is the whole reason directory_entries
 * has structured columns instead of one free-text contact field: `whatsapp`
 * has to be a value code can build a wa.me link out of (任务 48) and send a
 * notification to (任务 59). A blob cannot do that.
 *
 * Order is how this market actually reaches somebody, and it stops at two
 * pieces because the cell is one line on a phone:
 *   · who to ask for, when the party is a company and the name is not a person
 *   · the number -- WhatsApp before the shop line, which is the ordering
 *     vibe-dealer's own 0030 gives for this market
 *   · the email only when there is no number at all, because a row with no way
 *     to reach it is the one an owner has to fix
 */
export function contactLine(e: DirectoryEntry): string | undefined {
  const pieces: string[] = [];
  const person = (e.contact_person ?? "").trim();
  const name = (e.name ?? "").trim();
  if (person && person !== name) pieces.push(person);

  const number = (e.whatsapp ?? "").trim() || (e.phone ?? "").trim();
  if (number) pieces.push(number);
  else {
    const email = (e.email ?? "").trim();
    if (email) pieces.push(email);
  }

  /* Nothing to reach them by and nobody to ask for: fall back to where they
     are, then to the owner's own note. An empty second column reads as a
     broken row, and every one of these is something he typed. */
  if (!pieces.length) {
    const region = (e.region ?? "").trim();
    if (region) pieces.push(region);
    else {
      const note = (e.note ?? "").trim();
      if (note) pieces.push(note.length > 60 ? `${note.slice(0, 60)}…` : note);
    }
  }

  return pieces.length ? pieces.slice(0, 2).join(" · ") : undefined;
}

export function rowsFromParties(
  entries: DirectoryEntry[],
  href?: (id: string) => string,
): LiveRow[] {
  return entries.map((e) => ({
    ...(href && e.id ? { href: href(e.id) } : {}),
    primary: (e.name ?? "").trim(),
    secondary: contactLine(e),
    tone: "neutral" as StatusTone,
    status: (e.status ?? "").trim(),
    extra: extraCells(e.extra),
  }));
}

/** One line of the 库存 page's second column: 「仓库 · 包」. */
function shelfLine(r: StockRow): string {
  return [r.location, r.unit].map((x) => (x ?? "").trim()).filter(Boolean).join(" · ");
}

/** A quantity as a person writes it: 84, not 84.000. */
function qtyText(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

export type StockRow = {
  item_id: string;
  name: string | null;
  unit: string | null;
  location: string | null;
  reorder_at: number | string | null;
  on_hand: number | string | null;
  moves: number | string | null;
};

/**
 * 库存, and it is the first shape whose `amount` column is NOT money.
 *
 * ⚠️ THAT IS THE WHOLE HAZARD HERE. The page's own heading for that column
 * is 「数量」/「Qty」, and every other shape puts ringgit there. A projection
 * that reached for `ringgit()` would print 「RM 84」 against a bag of cement --
 * which is the same class of mistake as 任务 79 ④, where a directory's three
 * columns were read as a pipeline's four and the owner's own word for a
 * customer was dropped as though it were a price.
 *
 * THE STATUS IS COMPUTED, NOT STORED. 「充足」/「快没了」/「没货了」 is a fact about
 * the number beside it, so storing it would create a second thing that can
 * disagree -- and it disagrees silently, because nobody knows by eye that a
 * hardware shop should have 84 bags. An item with no reorder level says
 * nothing rather than guessing one.
 */
export function rowsFromStock(
  items: StockRow[],
  lang: "zh" | "en" = "zh",
  href?: (id: string) => string,
): LiveRow[] {
  const word = {
    zh: { ok: "充足", low: "快没了", none: "没货了" },
    en: { ok: "In stock", low: "Running low", none: "Out of stock" },
  }[lang];

  return items.map((it) => {
    const on = Number(it.on_hand ?? 0);
    const at = it.reorder_at === null || it.reorder_at === undefined ? null : Number(it.reorder_at);
    /* Three states and the middle one only exists when he asked for it. */
    /* 「negative」 and not 「critical」: the four tones this product has are
       positive · warning · negative · neutral, and out-of-stock is the same
       weight as an overdue payment. */
    const tone: StatusTone = on <= 0 ? "negative" : at !== null && on <= at ? "warning" : "positive";
    const status = on <= 0 ? word.none : at !== null && on <= at ? word.low : at !== null ? word.ok : "";

    return {
      ...(href && it.item_id ? { href: href(it.item_id) } : {}),
      primary: (it.name ?? "").trim(),
      secondary: shelfLine(it),
      /* A COUNT, NOT A PRICE. See the warning above. */
      amount: qtyText(on),
      tone,
      status,
    };
  });
}

export type ReconcileRow = {
  id: string;
  period: string;
  source: string | null;
  direction: string | null;
  their_cents: number | string | null;
  ours_cents: number | string | null;
  entries: number | string | null;
  reference: string | null;
  note: string | null;
  settled_at: string | null;
};

/**
 * 对账 — the fifth shape, and the only one whose row is a COMPARISON rather
 * than a thing.
 *
 * The amount column carries THEIR figure, because that is the number the owner
 * is holding a statement of; ours sits beside it in the second column with the
 * count that produced it, so the figure can be checked rather than believed.
 * The status is the gap.
 *
 * ⚠️ THE DIFFERENCE IS NEVER STORED and is not computed here either -- it comes
 * off the view, which sums the ledger every time the page is read. A cached
 * agreement that has stopped being true is worse than no reconciliation at all,
 * which is the same rule 「how much is left is the sum of the movements」 and
 * 「with line items the total is not his to type」 both landed on.
 */
export function rowsFromReconciliations(
  rows: ReconcileRow[],
  lang: "zh" | "en" = "zh",
  href?: (id: string) => string,
): LiveRow[] {
  const word = {
    zh: {
      match: "对得上",
      over: "我们多",
      under: "我们少",
      settled: "结了",
      entries: (n: number) => `${n} 笔`,
    },
    en: {
      match: "Matches",
      over: "We are over",
      under: "We are short",
      settled: "Settled",
      entries: (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`,
    },
  }[lang];

  return rows.map((r) => {
    const theirs = Number(r.their_cents ?? 0);
    const ours = Number(r.ours_cents ?? 0);
    const gap = ours - theirs;
    /* Settled wins over the arithmetic. A month he has looked at and explained
       is closed even when the two figures still differ -- and in this market
       most months end that way rather than at zero. Saying 「we are short」
       about a month he has already accounted for would be the page arguing
       with him. */
    const status = r.settled_at
      ? word.settled
      : gap === 0
        ? word.match
        : gap > 0
          ? `${word.over} ${ringgit(Math.abs(gap))}`
          : `${word.under} ${ringgit(Math.abs(gap))}`;
    const tone: StatusTone = r.settled_at ? "positive" : gap === 0 ? "positive" : "warning";

    return {
      ...(href && r.id ? { href: href(r.id) } : {}),
      /* The month and who gave the figure -- which together ARE the name of
         this row, and the reason it needs no document number. */
      primary: [monthText(r.period, lang), (r.source ?? "").trim()].filter(Boolean).join(" · "),
      /* Our side, and how many entries made it. A total with no count behind it
         is a number he has to take on trust. */
      secondary: [ringgit(ours), word.entries(Number(r.entries ?? 0))].filter(Boolean).join(" · "),
      amount: ringgit(theirs),
      tone,
      status,
    };
  });
}

/** 「2026-08-01」 -> 「2026 年 8 月」 / 「Aug 2026」. Read off the digits, never
 *  through `new Date()`: the server runs UTC and the owner is UTC+8, and a
 *  first-of-month parsed as UTC is the last day of the previous month to him.
 *  The same eight hours today_myt() exists over. */
function monthText(period: string, lang: "zh" | "en"): string {
  const m = /^(\d{4})-(\d{2})/.exec(period ?? "");
  if (!m) return period ?? "";
  const [, y, mm] = m;
  const n = Number(mm);
  if (lang === "en") {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${names[n - 1] ?? mm} ${y}`;
  }
  return `${y} 年 ${n} 月`;
}

export type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  kind: string | null;
  party: string | null;
  service: string | null;
  status: string | null;
  source: string | null;
  note: string | null;
  extra: unknown;
  /* 派给谁 —— `appointments.staff_id` 指着名册上那一行（20260902030000）。
     嵌进同一次查询，不另外打一趟：两趟回来的东西要在这里配对，而配错
     一次就是把一笔预约挂到另一个师傅头上。
     ⚠️ 名册那张表有 RLS，读不到的时候这里回 null —— 那一根轴自己退回
     原来那几种画法，往拒绝的方向坏。 */
  staff?: { name: string | null } | null;
};

/**
 * 预约 — the sixth shape, and the only one a person reads by the clock.
 *
 * The first column is WHAT, not when: the diary block beside it already puts
 * the times down the left, and repeating them in the table's first cell would
 * be the same figure twice on one screen -- which is the reason 印 was cut as a
 * register (任务 17).
 *
 * ⚠️ THE CLOCK IS READ IN MALAYSIA, always. `starts_at` is an instant, the
 * server runs UTC, and a 9am appointment printed off a UTC clock is 5pm to a
 * salon in Klang. Same eight hours as today_myt(), except that here it is not
 * a rounding question -- it is who turns up when.
 */
export function rowsFromAppointments(
  rows: AppointmentRow[],
  lang: "zh" | "en" = "zh",
  href?: (id: string) => string,
): LiveRow[] {
  const word = {
    zh: {
      booked: "已约",
      done: "来了",
      no_show: "没来",
      cancelled: "取消了",
      block: "不接单",
      web: "官网",
    },
    en: {
      booked: "Booked",
      done: "Came",
      no_show: "No show",
      cancelled: "Cancelled",
      block: "Not taking bookings",
      web: "From the website",
    },
  }[lang];

  const clock = (iso: string): string =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));

  return rows.map((r) => {
    const isBlock = r.kind === "block";
    const status = isBlock
      ? word.block
      : r.status === "done"
        ? word.done
        : r.status === "no_show"
          ? word.no_show
          : r.status === "cancelled"
            ? word.cancelled
            : word.booked;
    /* A no-show is the one a salon owner is scanning for; a cancellation is
       already dealt with and is dimmed rather than flagged. */
    const tone: StatusTone = isBlock
      ? "neutral"
      : r.status === "no_show"
        ? "negative"
        : r.status === "cancelled"
          ? "neutral"
          : r.status === "done"
            ? "positive"
            : "warning";

    return {
      ...(href && r.id ? { href: href(r.id) } : {}),
      at: { time: clock(r.starts_at), endTime: clock(r.ends_at) },
      ...((r.staff?.name ?? "").trim() ? { who: (r.staff!.name as string).trim() } : {}),
      /* What it is, then who it is for. A block has no customer, so it leads
         with its own note -- 「Lunch」 -- rather than with an empty name. */
      primary: isBlock
        ? (r.note ?? "").trim() || word.block
        : (r.service ?? "").trim() || (r.party ?? "").trim(),
      secondary: isBlock
        ? ""
        : [(r.party ?? "").trim(), r.source === "website" ? word.web : ""]
            .filter(Boolean)
            .join(" · "),
      tone,
      status,
      /* His own columns, through the one helper the other five use -- a second
         way of turning `extra` into cells is a second set of rules about what
         counts as a string. */
      ...(extraCells(r.extra) ? { extra: extraCells(r.extra) } : {}),
    };
  });
}

/**
 * Rewrite the tables of a page tree to carry `rows`.
 *
 * Only RecordTable, and only its rows: the columns are the customer's own
 * headings, which they may have renamed, and replacing those would undo their
 * work every time they loaded the page.
 *
 * Returns the tree unchanged when there is nothing to put in it, so the caller
 * can apply this unconditionally and an untouched object stays untouched.
 */
export function withLiveRows(
  tree: Record<string, unknown>,
  rows: LiveRow[],
  opts: {
    /**
     * This business has records SOMEWHERE, even if none belong on this page.
     *
     * ⚠️ Without it the 总览 page contradicted itself in the empty direction:
     * a contractor with three quotations and no 工程 yet read 「在做的工程 0」
     * in the tile and 「Quoting RM 96,000」 in the chart beside it, because the
     * chart had never been live and so kept its samples. The tiles knew he had
     * started and the blocks did not.
     *
     * A demonstration is for somebody who has not started. The moment he has,
     * every block on the page owes him the truth -- including 「nothing here
     * yet」.
     */
    businessIsLive?: boolean;
  } = {},
): Record<string, unknown> {
  const content = (tree as { content?: unknown }).content;
  if (!Array.isArray(content)) return tree;
  const mapped = mapNodes(content, rows, opts.businessIsLive === true);
  /* Identity is kept when nothing moved, so a caller can apply this
     unconditionally and an untouched page stays the same object. */
  if (mapped.every((n, i) => n === content[i])) return tree;
  return { ...tree, content: mapped };
}

/**
 * IT IS NEVER AT THE TOP LEVEL.
 *
 * A generated page is one SystemShell whose `main` prop holds the blocks:
 *
 *     SystemShell
 *       sidebar: [RailNav]
 *       main:    [PageHeader, FilterChips, DatePicker, RecordTable]
 *
 * The first version of this walked `tree.content` and stopped, so it found
 * nothing on every page in the product while its unit test -- written against a
 * hand-made flat tree -- passed. That is the fifth time this repo has shipped a
 * projection that never entered a slot; task 19 records the same failure on the
 * published-site projection, in the same words.
 *
 * So it recurses into any prop that holds an array of nodes, which is what a
 * Puck slot is. Nothing here needs to know the slot's name: a projection that
 * lists `["sidebar", "main"]` is the hardcoded version of this bug.
 */
/** A LiveRow in the table model's own shape. The keys are the built-in column
 *  keys from recordTable(); a column the owner added has no value here, which
 *  renders empty rather than wrong. */
function toModelRow(r: LiveRow): { cells: Record<string, string>; tones: Record<string, StatusTone> } {
  /* The owner's own columns first, the built-in four second. Order matters:
     `extra` is free-form jsonb, so a row carrying `{"primary": "…"}` -- from an
     import, or from an owner who named a column badly -- must not be able to
     replace the document's real title. extraCells() already drops the built-in
     keys; this is the second lock on the same door, because the cost of being
     wrong here is a customer's records showing somebody else's text. */
  const cells: Record<string, string> = { ...(r.extra ?? {}) };
  cells.primary = r.primary;
  if (r.secondary) cells.secondary = r.secondary;
  if (r.amount) cells.amount = r.amount;
  cells.status = r.status;
  return { cells, tones: { status: r.tone }, ...(r.href ? { href: r.href } : {}) };
}

function mapNodes(nodes: unknown[], rows: LiveRow[], started = false): unknown[] {
  return nodes.map((node) => {
    const n = node as { type?: string; props?: Record<string, unknown> };
    if (!n || typeof n !== "object" || !n.props) return node;

    /* 🔴 THE DEMONSTRATION'S FILTER CHIP, ONCE THE ROWS ARE REAL.

       Every generated page carries one -- 「FILTERED BY  Status: Running low ×」
       -- and on a page of samples it is honest: it teaches that the table can
       be narrowed. On a page of HIS rows it is a lie in two directions at
       once. It says the list is filtered while showing everything, and its
       × goes to `#`, so pressing it to see 「the rest」 does nothing.

       Seen by opening the stock page, not by any ruler: the tables were right,
       the tones were right, and the line above them said the list was cut down
       to 「Running low」 over three rows that were not.

       Emptied rather than dropped, so the block the owner may have moved or
       renamed stays where he put it -- and it comes back the moment there is a
       real filter to put in it. */
    /* ⚠️ `rows.length > 0 || started`, not `started` alone. `started` means
       「he has records somewhere but none on THIS page」 -- an empty page that
       must not show samples. A page WITH his rows is the ordinary case and the
       one the chip lies on, so both have to be covered. Getting this wrong
       would have left the chip on every page that actually has stock, which is
       every page anybody looks at. */
    if (n.type === "FilterChips" && (rows.length > 0 || started)) {
      const chips = n.props.chips;
      if (Array.isArray(chips) && chips.length) {
        return { ...n, props: { ...n.props, chips: [] } };
      }
      return node;
    }

    if (n.type === "RecordTable") {
      /*
        THE ROWS ARE NOT WHERE THEIR NAME SAYS.

        A generated table's props are { id, gridId, caption, table: { columns,
        rows } } -- the rows live one level down, inside `table`, beside the
        columns they belong to (see recordTable() and lib/portal/table-model.ts).

        The first version wrote props.rows, which the component does not read,
        so every page kept its samples. The unit test passed because its fixture
        put rows at props.rows -- a shape this codebase never produces. That is
        the same "the fixture is not the product" mistake as the slot bug it was
        written to catch, made inside the fix for it.

        Both shapes are handled because a page saved before the table model
        changed can still carry the flat one (see lib/portal/layout-upgrade.ts),
        and a projection that only understood today's shape would quietly skip
        exactly the oldest customers.
      */
      /*
        AND THE ROW SHAPE IS NOT THE SAME IN BOTH PLACES.

        `props.rows` is the legacy flat row -- { primary, secondary, amount,
        status } -- which normalizeTable() converts. `props.table.rows` is the
        model itself: { cells: Record<key, string>, tones: Record<key, tone> },
        keyed by COLUMN KEY so a row keeps its meaning when the owner renames or
        reorders a column.

        Writing the flat shape into the model gave a table with the right number
        of rows and nothing in any cell -- which is how it looked in the browser
        before this line existed.
      */
      const table = n.props.table as { rows?: unknown; columns?: unknown; live?: unknown } | undefined;
      if (table && typeof table === "object") {
        /* ── THE GHOST THIS FLAG EXISTS TO PREVENT ────────────────────────
           The editor autosaves 2.5 seconds after any change, so whatever the
           canvas holds is written into layout_json -- including rows this
           projection put there. They are then FROZEN into the page.

           While the business has records that is invisible: real rows replace
           the frozen ones every render. The day it deletes its last one, the
           projection has nothing to put in and the old behaviour was to leave
           the tree alone -- so the deleted customer came back on screen, and
           the delete looked as though it had failed.

           `live` is the one bit that tells the two cases apart, because once
           frozen a real row and a sample row are the same JSON: rows that were
           ever real are cleared to empty, and a page that has only ever shown
           samples keeps them, which is the founder's decision of 2026-08-30
           (「留着、标清楚、加第一笔真的就消失」) still intact in both directions. */
        if (!rows.length) {
          if (table.live !== true && !started) return node;
          return { ...n, props: { ...n.props, table: { ...table, rows: [] } } };
        }
        return {
          ...n,
          props: { ...n.props, table: { ...table, live: true, rows: rows.map(toModelRow) } },
        };
      }
      if (!rows.length) return node;
      if (Array.isArray(n.props.rows)) {
        return { ...n, props: { ...n.props, rows } };
      }
      return node;
    }

    /* ── THE OTHER THREE BLOCKS DRAWING THE SAME LIST ────────────────────
       The 总览 page's table, its 「今天要跟的」 shelf, its board and its ranking
       are all built from ONE array in industry-template (`sample.records`) --
       four shapes of the same question, which is why they can never disagree
       there. Filling only the table left the first screen reading real totals
       over 陈先生 · 李太太 · 王老板 in the three blocks beside it, which is
       worse than all of them being samples: two things that contradict each
       other cannot both be believed, and the totals are the half he cannot
       check by eye. */
    if (SAME_LIST.has(n.type ?? "")) {
      const wasLive = (n.props as { live?: unknown }).live === true;
      if (!rows.length) {
        if (!wasLive && !started) return node;
        return { ...n, props: { ...n.props, ...emptied(n.type ?? "") } };
      }
      return { ...n, props: { ...n.props, live: true, ...fill(n.type ?? "", n.props, rows) } };
    }

    /* ── THE PANEL BESIDE THE LIST ───────────────────────────────────────
       客户 · 供应商 · 师傅 · 报价单 · 进货单 gained a second column on
       2026-09-02: the list on the left, the one selected on the right. Without
       this arm that panel keeps 陈先生 while the table beside it shows his real
       customers -- the same defect the block above was written to end, one
       screen wide instead of one page.

       ⚠️ KEYED ON THE ID, NOT ON THE TYPE, and that is not a shortcut. InfoRows
       is also how a published website prints the business's OWN phone number,
       address and opening hours, and this projection walks that page too.
       Filling every InfoRows in the tree would replace what a stranger reads
       with the name of one of the owner's customers. Only the node
       industry-template deliberately named `<page>-detail` is a record. */
    if (n.type === "InfoRows" && String((n.props as { id?: unknown }).id ?? "").endsWith("-detail")) {
      const wasLive = (n.props as { live?: unknown }).live === true;
      const shown =
        (n.props.rows as { label?: string; icon?: string; field?: string }[] | undefined) ?? [];
      if (!rows.length) {
        /* Emptied rather than reverted: a business that deleted its last
           customer must not be shown a memory of one. The labels stay -- they
           are the module's nouns, not this record's. */
        if (!wasLive && !started) return node;
        return {
          ...n,
          props: {
            ...n.props,
            heading: "",
            rows: shown.map((r) => ({ ...r, value: "" })),
          },
        };
      }
      /* The FIRST row, because that is what the table shows at the top and a
         panel pointing at something further down would answer a question
         nobody asked. Selecting is a page this product does not have yet --
         see task 81. */
      const first = rows[0];
      /* ⚠️ BY FIELD NAME, NEVER BY POSITION. The first version zipped the
         labels against whichever values happened to be non-empty, so a
         directory row with no status shifted everything up one and the panel
         printed 「Contact / notes: Ang Chee Keong」. It was found by looking at
         the screenshot, not by any assertion -- a label and a value that do
         not correspond are worse than a sample, because a sample announces
         itself and this does not. industry-template stamps each pair with the
         column it came from precisely so this can never be guessed. */
      const of = (field: string | undefined): string => {
        if (field === "primary") return first.primary ?? "";
        if (field === "secondary") return first.secondary ?? "";
        if (field === "amount") return first.amount ?? "";
        if (field === "status") return first.status ?? "";
        return "";
      };
      return {
        ...n,
        props: {
          ...n.props,
          live: true,
          heading: first.primary,
          /* The LABELS the page was built with are kept and only the values
             move. They carry this module's own noun -- 经销商 for a master
             dealer -- and re-deriving them here would be a second vocabulary
             disagreeing with the table one column away. */
          rows: shown.map((r) => ({ ...r, value: of(r.field) })),
        },
      };
    }

    let changed = false;
    const props: Record<string, unknown> = { ...n.props };
    for (const [key, value] of Object.entries(n.props)) {
      if (Array.isArray(value) && value.some((v) => v && typeof v === "object" && "type" in (v as object))) {
        const mapped = mapNodes(value, rows, started);
        if (mapped.some((v, i) => v !== value[i])) {
          props[key] = mapped;
          changed = true;
        }
      }
    }
    return changed ? { ...n, props } : node;
  });
}

/**
 * Has this module EVER held a row, archived ones included?
 *
 * ── WHY THIS QUESTION IS DIFFERENT FROM 「are there rows」 ─────────────────
 *
 * A page with nothing to show is two different situations, and the samples
 * belong to only one of them:
 *
 *   never started   the demonstration teaches what the page is for
 *   put it away     he archived his last quotation, and 陈先生 · 李太太 came
 *                   back on screen -- which reads as 「收起来 deleted my work
 *                   and put the demo back」
 *
 * Seen in a browser on the day 收起来 was built: archive the only record, and
 * the samples returned. Nothing in the projection could tell the two apart,
 * because both arrive as an empty array.
 *
 * Asked only when there is nothing to show, so the ordinary render costs
 * nothing extra.
 */
export async function moduleHasEverHadRows(
  supabase: SupabaseClient,
  projectId: string,
  moduleKey: string,
): Promise<boolean> {
  const table = PIPELINE_MODULES.has(moduleKey)
    ? "pipeline_records"
    : LEDGER_MODULES.has(moduleKey)
      ? "ledger_entries"
      : DIRECTORY_MODULES.has(moduleKey)
        ? "directory_entries"
        : CATALOG_MODULES.has(moduleKey)
          ? "catalog_items"
          : null;
  if (!table) return false;
  try {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("module_key", moduleKey);
    return (count ?? 0) > 0;
  } catch {
    /* Could not ask: leave the page as it is. Blanking a table because a count
       failed is the same lie as blanking the totals -- see withLiveStats. */
    return false;
  }
}

/**
 * Read this module's rows for this project.
 *
 * Through the caller's own session, so RLS is what bounds it -- the policies
 * on pipeline_records are the backstop, not a filter written here. Returns an
 * empty array on any failure: a page that renders its samples is a much better
 * outcome than a page that does not render.
 */
export async function fetchLiveRows(
  supabase: SupabaseClient,
  projectId: string,
  moduleKey: string,
  workflow: string[],
  lang: "zh" | "en" = "zh",
  limit = 50,
  /** Where one row's own page lives. Omitted by callers that draw a table
   *  nobody can click -- the dashboard's 「最近的工程」 points at the module's
   *  own page, not at a row. */
  href?: (id: string) => string,
): Promise<LiveRow[]> {
  try {
    if (PIPELINE_MODULES.has(moduleKey)) {
      const { data, error } = await supabase
        .from("pipeline_records")
        .select("id, title, party, amount_cents, stage, due_on, extra")
        .eq("project_id", projectId)
        .eq("module_key", moduleKey)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error || !data) return [];
      return rowsFromRecords(data as PipelineRecord[], workflow, href);
    }

    if (LEDGER_MODULES.has(moduleKey)) {
      /* `id` and `adjusts_id` are selected for the reversal pairing, not for
         display -- a reversed entry has to be readable AS reversed, and that
         fact lives in the other row. Ordered by the business's own date
         first: an entry keyed in today for last Friday belongs on Friday. */
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("id, doc_no, party, direction, amount_cents, allocated_cents, adjusts_id, note, extra")
        .eq("project_id", projectId)
        .eq("module_key", moduleKey)
        .order("entry_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error || !data) return [];
      return rowsFromEntries(data as LedgerEntry[], moduleKey, lang, href);
    }

    if (CATALOG_MODULES.has(moduleKey)) {
      /* Read from the VIEW, not from the table: how much is left is the sum of
         the movements and there is deliberately no column holding it. The view
         runs as the caller (`security_invoker`), so RLS still bounds it --
         which it did not on the day it shipped, and cost one business four
         rows of another's shelf. See 20260901080000.

         Ordered by name for the same reason a directory is: a shelf is READ
         DOWN, and 「where is the cement」 has an answer only in an order a
         person can scan. */
      const { data, error } = await supabase
        .from("stock_on_hand")
        .select("item_id, name, unit, location, reorder_at, on_hand, moves")
        .eq("project_id", projectId)
        .eq("module_key", moduleKey)
        .order("name", { ascending: true })
        .limit(limit);
      if (error || !data) return [];
      return rowsFromStock(data as StockRow[], lang, href);
    }

    if (DIRECTORY_MODULES.has(moduleKey)) {
      /* Ordered by name and not by when it was added: a directory is READ
         DOWN, and 「where did 陈先生 go」 has an answer only if the list is in
         an order a person can scan. The other two shapes are newest-first
         because a document you just wrote is the one you are looking for.

         Archived parties are off the shelf, not deleted -- the same filter
         pipeline_records uses, and the reason last year's supplier is still
         findable when you need their number again. */
      const { data, error } = await supabase
        .from("directory_entries")
        .select("id, name, kind, contact_person, phone, whatsapp, email, region, status, note, extra")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .eq("module_key", moduleKey)
        .order("name", { ascending: true })
        .limit(limit);
      if (error || !data) return [];
      return rowsFromParties(data as DirectoryEntry[], href);
    }

    if (CALENDAR_MODULES.has(moduleKey)) {
      /* BY THE CLOCK, not by when it was written. A diary is read forwards,
         and 「what is next」 has an answer only in the order it will happen.
         Cancelled rows stay: 「Mrs Lee cancelled」 is information a salon
         reading its day needs, and hiding it makes the gap unexplained. */
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, kind, party, service, status, source, note, extra, staff:staff_id(name)",
        )
        .eq("project_id", projectId)
        .eq("module_key", moduleKey)
        .is("archived_at", null)
        .order("starts_at", { ascending: true })
        .limit(limit);
      if (error || !data) return [];
      /* 🔴 `as unknown as` 不是偷懒 —— 产生出来的型别把嵌进来的那一栏写成
         **阵列**，而实测回来的是**一个物件或者 null**（2026-09-09，真的登入、
         真的排两笔：`{"name":"Amy"}` · `{"name":"Jasmine"}` · `null`）。
         照那个型别写下去，每一笔都读不到名字，而画面上是那一根轴自己
         退回原来那几种画法 —— 不报错，只是永远不分栏。 */
      return rowsFromAppointments(data as unknown as AppointmentRow[], lang, href);
    }

    if (RECONCILE_MODULES.has(moduleKey)) {
      /* THE VIEW, never the table: our own side is summed there and exists in
         no column. `security_invoker` bounds it by RLS -- which stock_on_hand
         did not on the day it shipped, and cost one business four rows of
         another's shelf (20260901080000).

         Newest month first: the one he is holding a statement for is this
         month's. */
      const { data, error } = await supabase
        .from("reconciliation_lines")
        .select("id, period, source, direction, their_cents, ours_cents, entries, reference, note, settled_at")
        .eq("project_id", projectId)
        .eq("module_key", moduleKey)
        .is("archived_at", null)
        .order("period", { ascending: false })
        .limit(limit);
      if (error || !data) return [];
      return rowsFromReconciliations(data as ReconcileRow[], lang, href);
    }

    /* A module of some other shape. Not an error -- 预约 still draws its
       samples, and will until `calendar` has a table of its own. */
    return [];
  } catch {
    return [];
  }
}

/**
 * The tree this business's own rows belong in, ready to render.
 *
 * ── WHY BOTH CALLERS GO THROUGH ONE FUNCTION ──────────────────────────────
 *
 * There are two places a page gets its real rows, and until 2026-08-31 only
 * one of them did:
 *
 *   · the SERVER render (page.tsx), which is how they appear on a reload
 *   · the ASSISTANT'S REPLY, which is how they appear when he says
 *     「加一个客户：陈先生」 and expects to see 陈先生
 *
 * The second one returned the tree the operations were applied to -- and a
 * record is not an operation, it is a row in another table, so the tree came
 * back without it. The reply said 「加了客户陈先生」 over a table that had not
 * moved: the twelfth time this product has claimed a change it did not show.
 *
 * ⚠️ `router.refresh()` was already there and does NOT fix it. Puck owns the
 * canvas state once it is mounted, so a fresh server render does not reach it
 * -- which the route's own comment says out loud about 排法, one paragraph
 * away from assuming records were different.
 *
 * Caught by a browser, not by reading: eval:browser reported 「画面没有动」
 * beside a reply that said 改了 1 处, and the row was in the database the
 * whole time. The write was never the broken half.
 */
export async function withFreshRows(
  supabase: SupabaseClient,
  tree: Record<string, unknown>,
  projectId: string,
  moduleKey: string,
  businessContext: BusinessContext,
): Promise<Record<string, unknown>> {
  const rows = await fetchLiveRows(
    supabase,
    projectId,
    moduleKey,
    workflowStages(businessContext),
    /* 收款 · 开销 · 佣金 need words we supply (订金 · 已冲正 · 已付), unlike a
       pipeline stage which is always the customer's own. They follow the
       SYSTEM language -- what the built system speaks to its users -- not the
       portal locale, which is what Formae speaks to the owner. */
    systemLangOf(businessContext),
  );
  return withLiveRows(tree, rows);
}

/* ──────────────────────────────────────────────────────────────────────────
   FOUR SHAPES OF ONE LIST.

   buildDashboard builds all of these from the same `sample.records`, so they
   are not four blocks with four data sources -- they are four answers to one
   question, and they have to become real together or not at all.
   ────────────────────────────────────────────────────────────────────────── */
const SAME_LIST = new Set(["ShelfList", "TaskBoard", "RankList", "ShareChart", "DaySchedule"]);

function fill(
  type: string,
  props: Record<string, unknown>,
  rows: LiveRow[],
): Record<string, unknown> {
  if (type === "ShelfList") {
    /* Three, because that is what 「今天要跟的」 means -- a list of everything
       is not a list of what to do today. The icon, the button's word and where
       it goes are kept: they are the page's, not this row's. */
    const keep = (props.items as { icon?: string; action?: string; href?: string }[] | undefined)?.[0];
    return {
      items: rows.slice(0, 3).map((r) => ({
        title: r.primary,
        description: r.status || r.secondary || "",
        icon: keep?.icon ?? "work",
        action: keep?.action,
        href: keep?.href,
      })),
    };
  }

  if (type === "TaskBoard") {
    /* A card goes in the column its row is ACTUALLY at, and NO ROW IS EVER
       DROPPED.

       ⚠️ THIS FILTERED, AND THE PICTURE IS WHAT CAUGHT IT. 工程 became a board
       on 2026-09-02, and the first run drew six empty columns above a table
       holding three of the owner's real jobs -- because their stage was not
       one of the columns, so every card was filtered away. Fourteen assertions
       passed: 「his own jobs are on it」 was reading the table underneath.

       The old reasoning was right about one thing and wrong about the other.
       Right: a 尾款 job must never be drawn under 报价 just because there was
       room. Wrong: the remedy is not to delete it. A job that exists and
       appears nowhere is the page telling the owner he has no work.

       So the columns are the union -- the workflow this business declared,
       plus any stage its rows actually carry. Nothing is invented and nothing
       is hidden; a stage that is not in the workflow gets a column named after
       itself, which is the truth about that row.

       A row with an EMPTY stage is a different case and belongs at the start:
       add_pipeline_record sets the first stage of the business's own workflow
       and leaves it blank only when there is no analysed workflow to read, so
       「not started」 is exactly what it means. */
    const declared = (props.stages as { name?: string }[] | undefined)
      ?.map((s) => s.name ?? "")
      .filter(Boolean) ?? [];
    const extra = [
      ...new Set(rows.map((r) => r.status).filter((s) => s && !declared.includes(s))),
    ];
    const columns = [...declared, ...extra];
    return {
      stages: columns.map((name) => ({ name })),
      cards: rows.slice(0, 12).map((r) => ({
        title: r.primary,
        stage: r.status || columns[0] || "",
        /* 金额从这一行搬到卡片自己那一行（2026-09-05）—— 靠右、不断行，
           跟表格那一栏同一条。`note` 剩下的就是对方。 */
        note: r.secondary ?? "",
        amount: r.amount ?? "",
        /* 这一单自己那一页。工程那一页的表格拿掉了，所以卡片是唯一的入口。 */
        href: r.href,
      })),
    };
  }

  if (type === "DaySchedule") {
    /* 预约's diary. The times come off the row rather than out of the props --
       a schedule whose hours are the ones it was drawn with, over somebody
       else's appointments, is the 「real figures over sample names」 defect
       standing on its head. Rows with no time (every other shape) are left
       out rather than stacked at 09:00. */
    return {
      rows: rows
        .filter((r) => r.at?.time)
        .slice(0, 8)
        .map((r) => ({
          time: r.at?.time ?? "",
          endTime: r.at?.endTime ?? "",
          title: r.primary,
          description: [r.secondary, r.status].filter(Boolean).join(" · "),
          /* 一天摊开的时候这一栏就是分栏的依据。没有派人的照样送过去 ——
             那一块把它们放在最后一栏，不是丢掉。 */
          ...(r.who ? { who: r.who, tone: r.tone } : {}),
        })),
    };
  }

  if (type === "RankList") {
    /* Biggest first -- a ranking whose order is 「whatever came back」 is a
       list, not a ranking. Rows with no amount sort last rather than being
       dropped: a job with no figure yet is still one of his. */
    const keep = (props.rows as { href?: string }[] | undefined)?.[0];
    return {
      rows: [...rows]
        .sort((a, b) => senOf(b.amount) - senOf(a.amount))
        .slice(0, 5)
        .map((r) => ({
          name: r.secondary || r.primary,
          sub: r.secondary ? r.primary : r.status,
          amount: r.amount ?? "",
          href: keep?.href,
        })),
    };
  }

  if (type === "ShareChart") {
    /* 「多少钱卡在哪一段」. Grouped by the row's own status, same as the page
       already does, and the colours are left alone -- they are the register's
       ramp and have nothing to do with which rows exist.

       🔴 除非那一块自己讲了要照**对方**归堆（`by: "party"`）。开销那一页
       问的是「钱给了哪几家」，而按状态分在那一页画出来是一整片扇形
       （[任务 194](../../docs/founder-tasks.md) 就是为这个判过「这三页不要圆环」）。
       **而它同时是三种右边那一块里唯一会合并的那一个** ——
       `RankList` 按金额排、取前五、不合并同一个人，所以那个问题只有它答得了。 */
    const byParty = (props as { by?: string }).by === "party";
    const by = new Map<string, number>();
    for (const r of rows) {
      const key = byParty ? r.secondary || r.primary || "—" : r.status || "—";
      by.set(key, (by.get(key) ?? 0) + senOf(r.amount) / 100);
    }
    const old = (props.slices as { color?: string }[] | undefined) ?? [];
    return {
      slices: [...by.entries()].map(([label, value], i) => ({
        label,
        value,
        color: old[i]?.color ?? old[old.length - 1]?.color,
      })),
    };
  }
  return {};
}

/** Real once, empty now. Same rule as the table: zeroes and empty lists rather
 *  than yesterday's rows, because a business that deleted everything must not
 *  be shown a memory of it. */
function emptied(type: string): Record<string, unknown> {
  if (type === "ShelfList") return { items: [] };
  if (type === "DaySchedule") return { rows: [] };
  if (type === "TaskBoard") return { cards: [] };
  if (type === "RankList") return { rows: [] };
  if (type === "ShareChart") return { slices: [] };
  return {};
}

/** 「RM 48,500」 -> 4850000. Only for ordering and totals inside this file; the
 *  string stays the thing that is displayed. */
function senOf(amount: string | undefined): number {
  if (!amount) return 0;
  const m = amount.replace(/[, ]/g, "").match(/\d+(\.\d{1,2})?/);
  return m ? Math.round(Number(m[0]) * 100) : 0;
}
