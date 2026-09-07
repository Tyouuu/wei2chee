import { describe, it, expect, vi } from "vitest";
import {
  isRecordModule,
  senFrom,
  splitRecordOps,
  writeRecords,
  keyFor,
  sortCells,
  phoneFrom,
  refuseToWrite,
  refuseToAct,
  actOnRecords,
  rowsAreProjected,
} from "./record-ops";
import { MODULE_CATALOG } from "./module-catalog";
import { parseLayoutOps } from "./layout-ops";
import type { LayoutOp } from "./layout-ops";

const row = (...cells: string[]) => ({ op: "add_table_row", target_id: "t", cells }) as unknown as LayoutOp;
const text = { op: "set_text", target_id: "h", field: "title", value: "报价单" } as unknown as LayoutOp;

describe("isRecordModule", () => {
  it("knows the four whose rows are real", () => {
    for (const k of ["quotations", "orders", "projects", "tasks"]) expect(isRecordModule(k)).toBe(true);
  });

  /* 收款 · 开销 · 佣金 joined them on 2026-08-31 when ledger_entries landed.
     This test named payments as NOT a record module until that day, which was
     true and is the reason it had to change with the table rather than after
     it: an assistant still writing 收款 into the page props would have written
     rows the live-rows projection then erased. */
  it("knows the three whose money is real", () => {
    for (const k of ["payments", "expenses", "commission"]) expect(isRecordModule(k)).toBe(true);
  });

  /* On 客户 or 库存 a table row is still a layout row, and stays one until
     those shapes have tables of their own. Treating them as records early
     would write into a table that does not exist. */
  it("knows the three whose rows are real on the third shape", () => {
    for (const k of ["customers", "suppliers", "staff"]) expect(isRecordModule(k)).toBe(true);
  });

  /* 对账 joined them on 2026-09-02. Its rows are a COMPARISON rather than a
     thing -- one month, one source, what the outside said -- and our own side
     is not in the table at all: it is summed from the ledger by a view every
     time the page is read. */
  it("knows the one whose rows are a comparison", () => {
    expect(isRecordModule("reconciliation")).toBe(true);
  });

  /* 预约 joined them the same day, and it is the last one: after 2026-09-02
     every shape that draws a table has a real table behind it. */
  it("knows the one whose rows are hours", () => {
    expect(isRecordModule("bookings")).toBe(true);
  });

  it("leaves the other modules alone", () => {
    /* 客户 was in this list until 2026-08-31, which is the point: the list is
       derived from SHAPE_STATE, so a shape going live moves its modules out of
       here on its own and this test is what says so out loud. 库存 left on
       2026-09-01, 对账 and 预约 both on 2026-09-02 -- four times, none of
       them remembered, all four reported by this line going red.

       WHAT IS LEFT IS THE TWO THAT WERE NEVER RECORDS. 官网 is the page a
       stranger reads and 总览 asks questions of the other tables without
       holding a row of its own. There is no longer a shape that draws a table
       and has nothing behind it. */
    for (const k of ["website", "dashboard", null, undefined]) {
      expect(isRecordModule(k)).toBe(false);
    }
  });
});

describe("senFrom", () => {
  it("reads what a contractor types", () => {
    expect(senFrom("RM 48,500")).toBe(4_850_000);
    expect(senFrom("48500")).toBe(4_850_000);
    expect(senFrom("RM 1,200.50")).toBe(120_050);
  });

  /* A task has no amount, and 0 would be a claim about the money. */
  it("says nothing when there is no number", () => {
    expect(senFrom("")).toBeUndefined();
    expect(senFrom("待报价")).toBeUndefined();
    expect(senFrom(null)).toBeUndefined();
  });
});

describe("splitRecordOps", () => {
  it("pulls rows out on a pipeline module and leaves everything else", () => {
    const { layoutOps, recordOps } = splitRecordOps([text, row("A"), row("B")], "quotations");
    expect(recordOps).toHaveLength(2);
    expect(layoutOps).toEqual([text]);
  });

  it("touches nothing on a module whose rows are layout", () => {
    /* 官网 now -- and this example has gone stale three times, which is the
       test working rather than the test being wrong. 客户 became a real table
       on 8-31, 库存 on 9-01, 预约 on 9-02. It is 官网's turn precisely
       because it is the only page left whose rows are layout and always will
       be: it is read by strangers and holds nothing of the business's own. */
    const ops = [text, row("A")];
    expect(splitRecordOps(ops, "website").layoutOps).toBe(ops);
    expect(splitRecordOps(ops, "website").recordOps).toHaveLength(0);
    /* 官网那一页照旧一个字都不挡 —— 它没有投影会盖掉那一行。 */
    expect(splitRecordOps(ops, "website").refused).toHaveLength(0);
  });

  /*
    🔴 2026-09-07 量出来的：站在总览那一页讲「加一笔」，那一笔进的是**版面**，
    而助手回报成功 ——

        dashboard  applied:1  skipped:[]
        reports    applied:1  skipped:[]
        ranking    applied:1  skipped:[]

    而那三页上那张表画的是别的页面的行（page.tsx 各跑一次 withLiveRows），
    所以那一笔要嘛被盖掉，要嘛留在画面上当一个不在任何一份记录里的数字。
    这个档案的档头就在描述这个形状，而 2026-08-30 那一次只接了 live 那几页。
  */
  for (const page of ["dashboard", "reports", "ranking"]) {
    it(page + " 上「加一行」要挡下来，而且讲得出为什么", () => {
      const split = splitRecordOps([text, row("陈太太", "RM 3,000")], page);
      /* 🔴 最要紧的一条：它不可以掉进版面。 */
      expect(split.layoutOps).toEqual([text]);
      expect(split.recordOps).toHaveLength(0);
      expect(split.refused).toHaveLength(1);
      expect(split.refused[0].op).toBe("add_table_row");
      /* 一句只会说「不行」的拒绝，是一个比较礼貌的死路。 */
      expect(split.refused[0].reason).toContain("别的页面");
      /* 而它不可以是一句资料库的话。 */
      for (const w of ["pipeline", "module", "rpc", "error"]) {
        expect(split.refused[0].reason.toLowerCase()).not.toContain(w);
      }
    });
  }

  it("目录认不得的一页照旧写进版面 —— 那是它唯一对的做法", () => {
    const ops = [text, row("A")];
    const split = splitRecordOps(ops, "my_own_page");
    expect(split.layoutOps).toBe(ops);
    expect(split.refused).toHaveLength(0);
  });

  it("记录页照旧走真的帐本，一个都不挡", () => {
    const split = splitRecordOps([row("A")], "payments");
    expect(split.recordOps).toHaveLength(1);
    expect(split.refused).toHaveLength(0);
  });
});

describe("rowsAreProjected", () => {
  it("那三页的行来自别的页面，其余每一种都不是", () => {
    /* 目录自己那一份，不是手写的第二张形状表。 */
    const shapes = [...new Set(MODULE_CATALOG.map((m) => m.shape))];
    expect(shapes.length).toBeGreaterThanOrEqual(9);
    const projected = shapes.filter((sh) => rowsAreProjected(sh)).sort();
    expect(projected).toEqual(["leaderboard", "overview", "report"]);
  });
});

describe("writeRecords", () => {
  const client = (rpc: unknown) => ({ rpc }) as never;

  it("calls the SAME rpc the button calls", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    await writeRecords(client(rpc), "p1", "quotations", [row("Taman Desa 三房翻新", "陈先生", "RM 48,500")], "req");
    expect(rpc).toHaveBeenCalledTimes(1);
    // founder-points 23: not a similar action, not a convenient one -- this one.
    expect(rpc.mock.calls[0][0]).toBe("add_pipeline_record");
    const args = rpc.mock.calls[0][1];
    expect(args.in_title).toBe("Taman Desa 三房翻新");
    expect(args.in_party).toBe("陈先生");
    expect(args.in_amount_cents).toBe(4_850_000);
    expect(args.in_idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
  });

  /* The row with no subject is the one an owner cannot read past, so it is
     refused and said out loud rather than written blank. */
  it("refuses a row that does not say what it is", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    const r = await writeRecords(client(rpc), "p1", "quotations", [row("", "陈先生")], "req");
    expect(rpc).not.toHaveBeenCalled();
    expect(r.written).toBe(0);
    expect(r.skipped[0].reason).toContain("这一单是什么");
  });

  it("reports a refusal from the database instead of swallowing it", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: { message: "not your project" } }));
    const r = await writeRecords(client(rpc), "p1", "quotations", [row("A")], "req");
    expect(r.written).toBe(0);
    expect(r.skipped[0].reason).toContain("not your project");
  });

  /* 🔴 THE TWO LIVE SHAPES THAT HAD NO BRANCH.
     Measured with a real signed-in identity on 2026-09-07: both reached
     `add_pipeline_record`, which answered `not a pipeline module: bookings` --
     an English database sentence on his 预约 page, naming a word he has never
     heard, for a page that is not the one it names.

     The assertion is BOTH halves: the wrong RPC is not called at all, AND he
     is told something he can act on. Only checking `written === 0` would have
     passed on the broken version too. */
  it.each([
    ["bookings", "预约那一页"],
    ["reconciliation", "对帐那一页"],
  ])("does not send a %s row to the pipeline rpc", async (moduleKey, sentence) => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    const r = await writeRecords(client(rpc), "p1", moduleKey, [row("陈太太 洗剪吹", "陈太太")], "req");
    expect(rpc).not.toHaveBeenCalled();
    expect(r.written).toBe(0);
    expect(r.skipped[0].reason).toContain(sentence);
    /* And never the database's own words. */
    expect(r.skipped[0].reason).not.toMatch(/pipeline|module|rpc/i);
  });
});

describe("refuseToWrite", () => {
  /* 🔴 THE POINT OF THE SWITCH IS THE COMPILER, NOT THIS TEST. A shape added
     to the catalogue with no branch is a BUILD error (`never`), which is what
     任务 23f gave applyLayoutOps after nine 「说了没做」 of one family --
     verified 2026-09-07 by deleting the calendar arm:
       error TS2322: Type '"calendar"' is not assignable to type 'never'.
     What this test adds is the other direction: that every shape the
     catalogue actually has gets an answer, and that the four writable ones
     stay writable. */
  it("answers for every shape the catalogue has", () => {
    const shapes = new Set(MODULE_CATALOG.map((m) => m.shape));
    expect(shapes.size).toBeGreaterThanOrEqual(9);
    for (const s of shapes) {
      const r = refuseToWrite(s);
      expect(r === null || (typeof r === "string" && r.length > 0)).toBe(true);
    }
  });

  it("lets the four with a business action through", () => {
    for (const s of ["pipeline", "ledger", "directory", "catalog"] as const) {
      expect(refuseToWrite(s)).toBeNull();
    }
  });

  /* 预约 refuses because the operation has no slot for WHEN, not because the
     branch is missing -- so the sentence has to say what to do instead, or it
     is just a politer dead end. */
  it("tells him where to go instead", () => {
    expect(refuseToWrite("calendar")).toContain("预约那一页");
    expect(refuseToWrite("reconcile")).toContain("对帐那一页");
  });

  it("never hands back the database's own words", () => {
    for (const s of new Set(MODULE_CATALOG.map((m) => m.shape))) {
      expect(refuseToWrite(s) ?? "").not.toMatch(/pipeline|module|rpc|error/i);
    }
  });
});

describe("keyFor", () => {
  /* A retried request must produce the same keys, so the RPC hands back the
     rows it already made instead of writing them twice. */
  it("is the same for the same request and row", () => {
    expect(keyFor("user:加一单", 0)).toBe(keyFor("user:加一单", 0));
  });

  it("differs per row and per request", () => {
    expect(keyFor("a", 0)).not.toBe(keyFor("a", 1));
    expect(keyFor("a", 0)).not.toBe(keyFor("b", 0));
  });

  it("is a uuid Postgres will accept", () => {
    expect(keyFor("a", 0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

/*
  THE COLUMN AN OWNER ADDED FOR HIMSELF.

  「加一栏车牌号」 has worked since add_table_column existed -- the column
  appeared, and every row under it stayed blank for ever, because a cell's
  value had nowhere to live once rows became real. These assert the wire, in
  both directions: the value is sorted into `extra` on the way in, and
  live-rows.test.ts asserts it comes back out onto the page.
*/
describe("sortCells", () => {
  const KEYS = ["primary", "secondary", "amount", "status"];

  it("puts the built-in four where they belong", () => {
    const r = sortCells(["Taman Desa 翻新", "陈先生", "RM 48,500", "已确认"], KEYS);
    expect(r).toMatchObject({ title: "Taman Desa 翻新", party: "陈先生", amount: "RM 48,500", status: "已确认" });
    expect(r.extra).toEqual({});
  });

  it("sends a column this business added to extra, keyed by that column", () => {
    const r = sortCells(["换机油", "WXY 1234", "陈先生", "RM 180"], ["primary", "c1", "secondary", "amount"]);
    expect(r.title).toBe("换机油");
    expect(r.party).toBe("陈先生");
    expect(r.extra).toEqual({ c1: "WXY 1234" });
  });

  /*
    THE CASE THE POSITIONAL VERSION GOT WRONG SILENTLY.

    An owner who puts his own column FIRST used to have its value read as the
    document's title and every later cell shifted one column left -- a row that
    is wrong in every field and raises nothing.
  */
  it("does not shift everything when the owner's column comes first", () => {
    const r = sortCells(["WXY 1234", "换机油", "陈先生"], ["c1", "primary", "secondary"]);
    expect(r.title).toBe("换机油");
    expect(r.party).toBe("陈先生");
    expect(r.extra).toEqual({ c1: "WXY 1234" });
  });

  /* A table whose columns could not be resolved still writes a usable row --
     the built-in four in their default order is what a generated page has. */
  it("falls back to the default order when the columns are unknown", () => {
    const r = sortCells(["装修", "陈先生", "RM 100"], null);
    expect(r).toMatchObject({ title: "装修", party: "陈先生", amount: "RM 100" });
  });

  it("ignores cells past the end of the table", () => {
    const r = sortCells(["装修", "多出来的"], ["primary"]);
    expect(r.title).toBe("装修");
    expect(r.extra).toEqual({});
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   READING A NUMBER OUT OF WHAT HE SAID, AND NOT INVENTING ONE.

   On a directory page the assistant is handed one blob column headed 「联络方式
   / 备注」, and underneath it the table has structured fields -- because
   `whatsapp` has to be something a wa.me link can be built out of rather than
   a line of prose. So a number that is literally in the sentence is lifted.

   The half of this that matters is what must NOT be lifted: every false
   positive becomes a phone number in a customer's system that nobody said.
   ──────────────────────────────────────────────────────────────────────────── */
describe("phoneFrom", () => {
  it("reads the three ways a Malaysian number is written", () => {
    expect(phoneFrom("Taman Desa 013-234 5678")).toBe("013-234 5678");
    expect(phoneFrom("call +60 12-345 6789 lah")).toBe("+60 12-345 6789");
    expect(phoneFrom("0123456789")).toBe("0123456789");
  });

  it("does not read money as a phone number", () => {
    // The whole reason for the leading-0/60 test: 「RM 48,500」 has digits and
    // separators and is not a number anybody can call.
    expect(phoneFrom("欠 RM 48,500 未付")).toBeUndefined();
    expect(phoneFrom("RM 1,234,567.00")).toBeUndefined();
  });

  it("does not read a date as a phone number", () => {
    expect(phoneFrom("上次来 2026-08-31")).toBeUndefined();
  });

  it("does not read something too short or too long", () => {
    expect(phoneFrom("门牌 12-3A")).toBeUndefined();
    expect(phoneFrom("account 0123456789012345")).toBeUndefined();
  });

  it("says nothing when there is nothing", () => {
    expect(phoneFrom("熟客，做了三次")).toBeUndefined();
    expect(phoneFrom("")).toBeUndefined();
    expect(phoneFrom(null)).toBeUndefined();
  });
});

describe("writeRecords on a directory page", () => {
  const client = (rpc: unknown) => ({ rpc }) as never;

  it("calls the SAME rpc the form calls", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    await writeRecords(
      client(rpc),
      "p1",
      "customers",
      [row("陈先生", "Taman Desa · 013-234 5678", "新客户")],
      "req",
      /* The real caller reads these off the page. A customers table is
         三 columns -- 客户 · 联络方式 · 状态 -- not the four a quotation has. */
      () => ["primary", "secondary", "status"],
    );
    // 重点 23 again, on the third shape.
    expect(rpc.mock.calls[0][0]).toBe("add_directory_entry");
    const args = rpc.mock.calls[0][1];
    expect(args.in_name).toBe("陈先生");
    expect(args.in_phone).toBe("013-234 5678");
    expect(args.in_status).toBe("新客户");
  });

  it("keeps the whole line he said, not just the part it understood", async () => {
    // The blob is the owner's own words. Lifting a number out of it must not
    // throw the rest away -- 「Taman Desa」 is where the job is.
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    await writeRecords(client(rpc), "p1", "customers", [row("陈先生", "Taman Desa · 013-234 5678")], "req", () => [
      "primary",
      "secondary",
      "status",
    ]);
    expect(rpc.mock.calls[0][1].in_note).toBe("Taman Desa · 013-234 5678");
  });

  it("never puts a guessed number in the WhatsApp field", async () => {
    /* A wa.me link built from a landline opens on nothing, which is exactly
       the dead control block-rules.ts forbids the assistant to draw. The form
       has its own WhatsApp box, where a person says so. */
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    await writeRecords(client(rpc), "p1", "customers", [row("陈先生", "03-7788 1234")], "req", () => [
      "primary",
      "secondary",
      "status",
    ]);
    expect(rpc.mock.calls[0][1].in_whatsapp).toBeUndefined();
  });

  it("says the row needs a name, not that it needs a document", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    const out = await writeRecords(client(rpc), "p1", "suppliers", [row("", "016-2 2223333")], "req", () => [
      "primary",
      "secondary",
      "amount",
      "status",
    ]);
    expect(rpc).not.toHaveBeenCalled();
    expect(out.skipped[0].reason).toBe("没有写名字");
  });

  it("still writes this business's own columns", async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    await writeRecords(
      client(rpc),
      "p1",
      "customers",
      [row("陈先生", "013-234 5678", "新客户", "会员 88")],
      "req",
      () => ["primary", "secondary", "status", "c1"],
    );
    expect(rpc.mock.calls[0][1].in_extra).toEqual({ c1: "会员 88" });
  });
});

describe("acting on a row that is already there", () => {
  const client = (rpc: unknown) => ({ rpc }) as never;
  const act = (id: string, status: string) =>
    ({ op: "set_record_status", record_id: id, status }) as unknown as LayoutOp;
  const ok = () => vi.fn(async (_n: string, _a: Record<string, unknown>) => ({ data: [{}], error: null }));

  it("peels the action out of the layout operations", () => {
    const split = splitRecordOps([text, row("单"), act("r1", "施工")], "quotations");
    expect(split.layoutOps).toHaveLength(1);
    expect(split.recordOps).toHaveLength(1);
    expect(split.actOps).toHaveLength(1);
  });

  /* 一个不是记录页的页面，行不是记录 —— 三种全部原样留给浏览器，
     而 applyLayoutOps 那一边有一个 case 会讲出来。 */
  it("leaves everything alone on a page whose rows are not records", () => {
    const split = splitRecordOps([act("r1", "施工")], "dashboard");
    expect(split.actOps).toEqual([]);
    expect(split.layoutOps).toHaveLength(1);
  });

  it("calls the SAME rpc the 「客人来了」 button calls", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "bookings", [act("a-1", "done")], []);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("set_appointment_status");
    expect(rpc.mock.calls[0][1]).toEqual({ in_id: "a-1", in_status: "done" });
    expect(r.written).toBe(1);
  });

  it("calls the SAME rpc the stage dropdown calls", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "quotations", [act("q-1", "施工")], ["报价", "施工", "收款"]);
    expect(rpc.mock.calls[0][0]).toBe("update_pipeline_record");
    expect(rpc.mock.calls[0][1]).toEqual({ in_id: "q-1", in_stage: "施工" });
    expect(r.written).toBe(1);
  });

  /* 🔴 update_pipeline_record 对 stage 一个字都不验，所以编出来的那一个会
     真的写进那一行，而那一行会从看板上掉下去（任务 95c）。 */
  it("refuses a stage this page does not use, and never calls the rpc", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "quotations", [act("q-1", "已完成")], ["报价", "施工", "收款"]);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.written).toBe(0);
    expect(r.skipped[0].reason).toContain("报价");
    expect(r.skipped[0].reason).toContain("施工");
  });

  /* 人在那一页看到的是自由文字（`stages.length &&` 才画下拉），所以助手也
     放行。比它在驱动的那个栏位更受限，是 set_text 那条注解讲过不要做的事。 */
  it("does not out-restrict a field a person types freely", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "quotations", [act("q-1", "等他回覆")], []);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(r.written).toBe(1);
  });

  it("refuses a booking state the database does not have", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "bookings", [act("a-1", "来了")], []);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.skipped[0].reason).toContain("no_show");
  });

  /* 🔴 任务 225：那一颗按钮顺手扣一次套票，而画面上会写出来。助手按同一支
     而不讲，就是一次静静少掉的次数，他要到客人下次来才发现。 */
  it("says out loud when a package session went with it", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ status: "done", used_package_id: "p-1", package_name: "洗剪吹十次", sessions_left: 3 }],
      error: null,
    }));
    const r = await actOnRecords(client(rpc), "bookings", [act("a-1", "done")], []);
    expect(r.notes.join("")).toContain("洗剪吹十次");
    expect(r.notes.join("")).toContain("3");
  });

  it("says nothing when no package was touched", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "bookings", [act("a-1", "done")], []);
    expect(r.notes).toEqual([]);
  });

  it.each([
    ["payments", "冲正"],
    ["customers", "名册"],
    ["inventory", "货架"],
    ["reconciliation", "对帐"],
  ])("refuses on %s and says where to go instead", async (moduleKey, sentence) => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), moduleKey, [act("x", "什么")], []);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.skipped[0].reason).toContain(sentence);
  });

  it("turns the database's own sentence into one he can read", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "no such record in your project" } }));
    const r = await actOnRecords(client(rpc), "quotations", [act("nope", "施工")], []);
    expect(r.written).toBe(0);
    expect(r.skipped[0].reason).not.toMatch(/no such record|project/i);
    expect(r.skipped[0].reason).toContain("找不到");
  });

  it("refuses when it did not say which row, or what to", async () => {
    const rpc = ok();
    const a = await actOnRecords(client(rpc), "quotations", [act("", "施工")], []);
    const b = await actOnRecords(client(rpc), "quotations", [act("q-1", "")], []);
    expect(rpc).not.toHaveBeenCalled();
    expect(a.skipped[0].reason).toContain("哪一笔");
    expect(b.skipped[0].reason).toContain("改成什么");
  });
});

describe("refuseToAct", () => {
  it("answers for every shape in the catalogue", () => {
    for (const m of MODULE_CATALOG) expect(() => refuseToAct(m.shape)).not.toThrow();
  });

  it("lets the two shapes with a status button through", () => {
    expect(refuseToAct("pipeline")).toBeNull();
    expect(refuseToAct("calendar")).toBeNull();
  });

  /* 一句只会说「不行」的拒绝，是一个比较礼貌的死路。 */
  it("names somewhere to go, in his words", () => {
    for (const shape of ["ledger", "directory", "catalog", "reconcile"] as const) {
      const why = refuseToAct(shape);
      expect(why).toBeTruthy();
      expect(why).not.toMatch(/pipeline|module|rpc|error|status/i);
    }
  });
});

/*
  一份**长得跟模型真的会回的一模一样**的回覆，走完整条缝。

  ── 为什么要这一条 ────────────────────────────────────────────────────────

  上面每一条都是拿手打的操作物件测的。而模型回来的不长那样：strict 的结构化
  输出要求**每一个** property 都出现，用不到的是 null —— 所以一个
  set_record_status 会带着 target_id/field/value/cells… 十几个 null 一起到。

  这条缝（模型的 JSON → parseLayoutOps → splitRecordOps → actOps）从来没有
  被走过一次，而它坏掉的样子是「助手回话了，而什么都没发生」——
  这个仓库十一次「说了没做」全部落在这种没有人走过的接缝上。

  不呼叫模型：伪造的回覆，每次结果一样，不花钱（任务 23f 的做法）。
*/
describe("a reply shaped like the model's own, end to end", () => {
  /** strict 结构化输出会送的全部栏位，没用到的是 null。 */
  const asModelSends = (op: string, extra: Record<string, unknown>) => ({
    op,
    target_id: null,
    path: null,
    field: null,
    value: null,
    component: null,
    after_id: null,
    before_id: null,
    title: null,
    column_key: null,
    column_label: null,
    column_kind: null,
    cells: null,
    status_tone: null,
    stages: null,
    record_id: null,
    status: null,
    variant_id: null,
    ...extra,
  });

  it("survives the parser and lands in the action pile", () => {
    const parsed = parseLayoutOps({
      operations: [
        asModelSends("set_record_status", { record_id: "a-1", status: "done" }),
        asModelSends("set_text", { target_id: "h", field: "title", value: "今天" }),
      ],
      explanation: "陈太太标成来了。",
      suggestion: null,
      design: null,
    });
    /* 一条都没有被丢掉 —— 被丢掉会静静地变成「宣称做了而没做」。 */
    expect(parsed.rejected).toEqual([]);
    expect(parsed.operations).toHaveLength(2);

    const split = splitRecordOps(parsed.operations, "bookings");
    expect(split.actOps).toHaveLength(1);
    expect(split.layoutOps).toHaveLength(1);
    expect(split.recordOps).toHaveLength(0);
  });

  it("still reaches the button's own rpc from there", async () => {
    const rpc = vi.fn(async (_n: string, _a: Record<string, unknown>) => ({ data: [{}], error: null }));
    const parsed = parseLayoutOps({
      operations: [asModelSends("set_record_status", { record_id: "a-1", status: "done" })],
      explanation: "好了。",
    });
    const split = splitRecordOps(parsed.operations, "bookings");
    const r = await actOnRecords({ rpc } as never, "bookings", split.actOps, []);
    expect(rpc.mock.calls[0][0]).toBe("set_appointment_status");
    expect(r.written).toBe(1);
  });

  /* 一个模型编出来的编号照样进得了 actOps —— 挡它的不是这里，是那一支 RPC
     用**他自己的登入身分**跑，works_here 决定。写下来，免得下一个人以为
     这一层在验编号。 */
  it("does not pretend to validate the id -- RLS does that", () => {
    const parsed = parseLayoutOps({
      operations: [asModelSends("set_record_status", { record_id: "编的", status: "done" })],
      explanation: "",
    });
    expect(splitRecordOps(parsed.operations, "bookings").actOps).toHaveLength(1);
  });
});

describe("logging a day on site", () => {
  const client = (rpc: unknown) => ({ rpc }) as never;
  const day = (id: string, status: string) =>
    ({ op: "log_work_day", record_id: id, status }) as unknown as LayoutOp;
  const ok = () =>
    vi.fn(async (_n: string, _a: Record<string, unknown>) => ({
      data: { on_date: "2026-09-07", kind: "full" },
      error: null,
    }));

  it("calls the SAME rpc the attendance page calls", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "staff", [day("s-1", "full")], []);
    expect(rpc.mock.calls[0][0]).toBe("log_work_day");
    expect(rpc.mock.calls[0][1]).toEqual({ in_staff_id: "s-1", in_kind: "full" });
    expect(r.written).toBe(1);
  });

  /* 🔴 资料库那一支只 select project_id —— 它**不查那个人是不是师傅**，
     而算佣金那两支是查的。两边不一致，所以挡在这一层。 */
  it("refuses on any page that is not the staff book", async () => {
    const rpc = ok();
    for (const key of ["customers", "suppliers", "quotations"]) {
      const r = await actOnRecords(client(rpc), key, [day("c-1", "full")], []);
      expect(r.written).toBe(0);
      expect(r.skipped[0].reason).toContain("师傅");
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a kind the database does not have, and lists the three", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "staff", [day("s-1", "整天")], []);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.skipped[0].reason).toContain("half");
    expect(r.skipped[0].reason).toContain("absent");
  });

  /* 哪一天是资料库算的（马来西亚的今天），不是浏览器算的 —— 半夜到早上八点
     两边差一天，而那正好是他补记昨天工的时段。所以要念出来。 */
  it("says which day it went to", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "staff", [day("s-1", "full")], []);
    expect(r.notes.join("")).toContain("2026-09-07");
  });

  it("does not say a day when the rpc did not give one", async () => {
    const rpc = vi.fn(async (_n: string, _a: Record<string, unknown>) => ({ data: null, error: null }));
    const r = await actOnRecords(client(rpc), "staff", [day("s-1", "full")], []);
    expect(r.written).toBe(1);
    expect(r.notes).toEqual([]);
  });

  it("refuses when it did not say who", async () => {
    const rpc = ok();
    const r = await actOnRecords(client(rpc), "staff", [day("", "full")], []);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.skipped[0].reason).toContain("哪一个师傅");
  });
});
