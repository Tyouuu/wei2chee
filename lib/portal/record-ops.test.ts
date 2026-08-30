import { describe, it, expect, vi } from "vitest";
import { isRecordModule, senFrom, splitRecordOps, writeRecords, keyFor } from "./record-ops";
import type { LayoutOp } from "./layout-ops";

const row = (...cells: string[]) => ({ op: "add_table_row", target_id: "t", cells }) as unknown as LayoutOp;
const text = { op: "set_text", target_id: "h", field: "title", value: "报价单" } as unknown as LayoutOp;

describe("isRecordModule", () => {
  it("knows the four whose rows are real", () => {
    for (const k of ["quotations", "orders", "projects", "tasks"]) expect(isRecordModule(k)).toBe(true);
  });

  /* On 客户 or 库存 a table row is still a layout row, and stays one until
     those shapes have tables of their own. Treating them as records early
     would write into a table that does not exist. */
  it("leaves the other modules alone", () => {
    for (const k of ["customers", "payments", "inventory", "website", null, undefined]) {
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
    const ops = [text, row("A")];
    expect(splitRecordOps(ops, "customers").layoutOps).toBe(ops);
    expect(splitRecordOps(ops, "customers").recordOps).toHaveLength(0);
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
