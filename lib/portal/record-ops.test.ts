import { describe, it, expect, vi } from "vitest";
import {
  isRecordModule,
  senFrom,
  splitRecordOps,
  writeRecords,
  keyFor,
  sortCells,
  phoneFrom,
} from "./record-ops";
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

  it("leaves the other modules alone", () => {
    /* 客户 was in this list until 2026-08-31, which is the point: the list is
       derived from SHAPE_STATE, so a shape going live moves its modules out of
       here on its own and this test is what says so out loud. */
    /* 库存 left this list on 2026-09-01, the same way 客户 left it on 8-31 --
       which is the second time this test has said the thing out loud rather
       than needing to be remembered. */
    for (const k of ["bookings", "website", "dashboard", "reconciliation", null, undefined]) {
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
    /* 预约, not 库存 and not 客户: both of those became real tables in turn
       (8-31 and 9-01) and this example went stale each time. That is the test
       working -- the list is derived from SHAPE_STATE, so the example has to
       be a shape that is still a drawing. */
    const ops = [text, row("A")];
    expect(splitRecordOps(ops, "bookings").layoutOps).toBe(ops);
    expect(splitRecordOps(ops, "bookings").recordOps).toHaveLength(0);
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
