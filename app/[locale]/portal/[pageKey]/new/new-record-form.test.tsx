import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NewRecordForm } from "./new-record-form";
import { RECORD_COPY } from "../record-copy";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ rpc: async () => ({ error: null }) }) }));

/**
 * A box he can type in has to be a box that saves.
 *
 * ── THE DEFECT THIS HOLDS SHUT ────────────────────────────────────────────
 *
 * 改这一单 on a money page shows what the payment says -- 「陈先生」,
 * 「RM 3,000」 -- because he opened the row to look at it. But
 * update_ledger_words does not accept either of them: money is corrected by
 * writing an opposite entry, never by a rewrite (migration 20260831100000).
 *
 * The first version left both boxes editable under a line explaining that they
 * could not be changed. So he could type a new amount, press 保存, and nothing
 * would happen -- a control that lies about what it does, which is exactly
 * what block-rules.ts forbids the ASSISTANT to draw and which we had drawn by
 * hand.
 *
 * ⚠️ Found by looking at the screenshot. Fifty assertions against the real
 * database and 540 unit tests were green at the time; none of them can see a
 * box that accepts typing and discards it.
 */
const columns = [
  { key: "primary", label: "For", kind: "text" as const },
  { key: "secondary", label: "Client", kind: "detail" as const },
  { key: "amount", label: "Amount", kind: "amount" as const },
];

const form = (over: Partial<Parameters<typeof NewRecordForm>[0]> = {}) =>
  renderToStaticMarkup(
    <NewRecordForm
      projectId="p"
      moduleKey="payments"
      shape="ledger"
      parties={[]}
      columns={columns}
      stages={[]}
      backHref="/back"
      copy={RECORD_COPY.zh.form}
      {...over}
    />,
  );

/** The inputs, in order, with whether each one is locked. */
const boxes = (html: string) =>
  [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0].includes("readonly"));

describe("改这一单, on a money page", () => {
  const record = { id: "r1", values: { primary: "订金", secondary: "陈先生", amount: "RM 3,000" }, archivedAt: null };

  it("lets him fix what the payment was FOR", () => {
    expect(boxes(form({ record }))[0]).toBe(false);
  });

  it("does not let him type into what it cannot save", () => {
    // 「陈先生」 and 「RM 3,000」 are shown and locked: he opened the row to see
    // them, and the way to change them is a reversal.
    expect(boxes(form({ record })).slice(1)).toEqual([true, true]);
  });

  it("says why, next to the boxes it locked", () => {
    expect(form({ record })).toContain(RECORD_COPY.zh.form.moneyFixed);
  });

  it("offers the reversal, which is the way money IS corrected", () => {
    expect(form({ record })).toContain(RECORD_COPY.zh.form.reverse);
  });

  it("refuses a second reversal rather than pretending", () => {
    const html = form({ record: { ...record, reversed: true } });
    expect(html).toContain(RECORD_COPY.zh.form.reversed);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*已经冲正/);
  });
});

describe("改这一单, on a document page", () => {
  const record = { id: "r1", values: { primary: "翻新", secondary: "陈先生", amount: "RM 48,500" }, archivedAt: null };

  it("lets him fix every box, because a quotation is a working document", () => {
    expect(boxes(form({ shape: "pipeline", moduleKey: "quotations", record }))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("offers 收起来 and never a delete", () => {
    const html = form({ shape: "pipeline", moduleKey: "quotations", record });
    expect(html).toContain(RECORD_COPY.zh.form.archive);
    expect(html).not.toContain("删除");
  });

  it("offers to put it back when it is already away", () => {
    const html = form({ shape: "pipeline", moduleKey: "quotations", record: { ...record, archivedAt: "2026-08-31" } });
    expect(html).toContain(RECORD_COPY.zh.form.unarchive);
  });
});

describe("加一单 is the same component with nothing to fix", () => {
  it("locks nothing and offers no correction", () => {
    const html = form({});
    expect(boxes(html).some(Boolean)).toBe(false);
    expect(html).not.toContain(RECORD_COPY.zh.form.reverse);
    expect(html).not.toContain(RECORD_COPY.zh.form.archive);
  });
});
