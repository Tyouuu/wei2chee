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
      title="Payments"
      /* Fixed, never new Date(): a test whose expected output changes at
         midnight in one time zone is a test that fails for a reason nobody can
         reproduce the next morning. */
      today="2026-09-02"
      stages={[]}
      backHref="/back"
      copy={RECORD_COPY.zh.form}
      {...over}
    />,
  );

/**
 * The TABLE-COLUMN boxes, in order, with whether each one is locked.
 *
 * ⚠️ 认的是「这一格是不是这张表自己的一栏」，不是位置。
 * `box()` 画出来的那几格**没有 `aria-label`**（字是旁边一个 `<span>`），
 * 而后来加上去的控件（类别 · 谁做的 · 哪一间店 · 工地）都有。
 *
 * 为什么不按位置数：第一版是「第一格之后全部锁住」，於是
 * 2026-09-04 加了一个**存得进去**的类别框，它就红了。而这条规矩守的
 * 从来不是「只有一格能打字」，是**存不进去的框不准打字**。
 */
const boxes = (html: string) =>
  [...html.matchAll(/<input[^>]*>/g)]
    .filter((m) => !m[0].includes("aria-label"))
    /* ⚠️ 打中的是 `aria-readonly="true"` —— React 把 `readOnly` 原样吐出来，
       小写的比对对不上它。写下来免得下一个人「修」掉它。 */
    .map((m) => m[0].includes("aria-readonly"));

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

  /* ── 这笔钱是干什么的、属於哪一单（20260904200000）────── */
  it("lets him say what the money was for, because that one CAN be saved", () => {
    const html = form({ record, moduleKey: "expenses" });
    const box =
      new RegExp(`<input[^>]*aria-label="${RECORD_COPY.zh.form.category}"[^>]*>`).exec(html)?.[0] ??
      "";
    expect(box).not.toBe("");
    /* 一个画出来却打不了字的框，跟一个打了字存不进去的框，
       是同一个毛病的两张脸。 */
    expect(box).not.toContain("aria-readonly");
  });

  it("does not offer the job picker where money comes IN", () => {
    /* 进来的钱靠分摊回答「这一单收了多少」。再给它一个 job_id，
       同一个问题就有两个答案 —— 资料库那边会拒绝，
       而画一个会被拒绝的控件，比不画糟。 */
    const jobs = [
      { id: "j1", docNo: "QT-2026-0001", title: "翻新", party: "陈先生" },
    ];
    expect(form({ record, moduleKey: "payments", jobs })).not.toContain(
      RECORD_COPY.zh.form.forJob,
    );
    expect(form({ record, moduleKey: "expenses", jobs })).toContain(
      RECORD_COPY.zh.form.forJob,
    );
  });

  it("draws no job picker at all when there is no job to pick", () => {
    /* 一个只有「不算在任何一单上」的下拉是一个假控件。 */
    expect(form({ record, moduleKey: "expenses", jobs: [] })).not.toContain(
      RECORD_COPY.zh.form.forJob,
    );
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

  /* 五格，不是四格：9-03 报价单多了「有效期到」，9-04 又多了工地照片那个
     选档案的格子。数量留着不改成 every()，因为它同时在守另一件事 ——
     **一格消失了这里会红**，而这个仓库掉过太多次「那一格还在、只是没人画」。 */
  it("lets him fix every box, because a quotation is a working document", () => {
    expect(boxes(form({ shape: "pipeline", moduleKey: "quotations", record }))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  /* 有效期那一格。ERPNext 的 Quotation 有 `valid_till`，而我们的 `due_on`
     从建表那天就在、两支 RPC 都收 —— 只是没有人传（第十六次「能力有、线没接」）。 */
  it("asks a quotation how long the price stands", () => {
    const html = form({ shape: "pipeline", moduleKey: "quotations", record });
    expect(html).toContain(RECORD_COPY.zh.form.validTill);
    expect(html).toContain('type="date"');
  });

  it("calls it 预计到货 on a purchase order — the same column is not the same sentence", () => {
    const html = form({ shape: "pipeline", moduleKey: "purchases", record });
    expect(html).toContain(RECORD_COPY.zh.form.expected);
    expect(html).not.toContain(RECORD_COPY.zh.form.validTill);
  });

  /* 一个填了就拿不掉的日子，是我们自己造的死结 —— 手机上的日期控件不一定
     给得了「清掉」这个动作。 */
  it("gives him a way to take the date back off", () => {
    const html = form({
      shape: "pipeline",
      moduleKey: "quotations",
      record: { ...record, dueOn: "2026-10-03" },
    });
    expect(html).toContain("2026-10-03");
    expect(html).toContain(RECORD_COPY.zh.form.dateClear);
  });

  /* 用眼睛看那张图才看到的：右边那张「印出来长这样」当时没有有效期，
     而一张没有印有效期的报价单，是一个永远有效的价钱。
     数字当时全绿 —— 122 条真的呼叫、843 个测试、tsc 干净（重点 7l）。 */
  it("prints the validity on the paper, not just in the form", () => {
    const html = form({
      shape: "pipeline",
      moduleKey: "quotations",
      record: { ...record, dueOn: "2026-10-03" },
    });
    const paper = html.slice(html.indexOf(RECORD_COPY.zh.form.previewLabel));
    expect(paper).toContain("2026-10-03");
  });

  it("does not put a date box on a money page — a receipt has no validity", () => {
    const html = form({ shape: "ledger", moduleKey: "payments", record });
    expect(html).not.toContain(RECORD_COPY.zh.form.validTill);
    expect(html).not.toContain(RECORD_COPY.zh.form.deadline);
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

describe("逐项明细", () => {
  const cols = [
    { key: "primary", label: "Work quoted", kind: "text" as const },
    { key: "secondary", label: "Client", kind: "detail" as const },
    { key: "amount", label: "Quoted", kind: "amount" as const },
  ];
  const quote = (over: Partial<Parameters<typeof NewRecordForm>[0]> = {}) =>
    renderToStaticMarkup(
      <NewRecordForm
        projectId="p"
        moduleKey="quotations"
        shape="pipeline"
        parties={[]}
        columns={cols}
        title="Quotations"
        today="2026-09-02"
        stages={[]}
        backHref="/back"
        copy={RECORD_COPY.zh.form}
        {...over}
      />,
    );
  /* The box holding a given value, whichever order React wrote its attributes
     in. ⚠️ Two earlier versions of this helper matched nothing and returned an
     empty string -- and an empty string CONTAINS nothing, so the negative
     assertions passed vacuously while the positive one failed. A helper that
     can silently match nothing makes half its tests decorative. */
  const boxWith = (html: string, value: string) =>
    [...html.matchAll(/<input[^>]*\/?>/g)].map((m) => m[0]).find((t) => t.includes(`value="${value}"`)) ?? null;

  const withLines = {
    id: "r1",
    values: { primary: "翻新", secondary: "陈先生", amount: "RM 999" },
    archivedAt: null,
    lines: [
      { description: "拆除", qty: "", unit: "", unitPrice: "", amount: "RM 3,000" },
      { description: "油漆", qty: "2.5", unit: "房", unitPrice: "RM 2,000", amount: "RM 5,000" },
    ],
  };

  it("shows the lines' total in the amount box, not what was typed there", () => {
    /* The database recomputes the document's total from its lines on every
       write, so a figure typed above would be replaced between 保存 and the
       page reloading. 「RM 999」 is deliberately wrong in the fixture. */
    const html = quote({ record: withLines });
    expect(html).toContain("RM 8,000");
    expect(html).not.toContain("RM 999");
  });

  it("does not let him type into it", () => {
    // The same rule the money page was locked for this morning: a box that
    // cannot be saved must not accept typing.
    const box = boxWith(quote({ record: withLines }), "RM 8,000");
    expect(box, "no box is showing the lines' total").not.toBeNull();
    expect(box).toContain("readonly");
  });

  it("and leaves it his to type when there are no lines", () => {
    const html = quote({ record: { id: "r1", values: { primary: "翻新", amount: "RM 999" }, archivedAt: null } });
    const box = boxWith(html, "RM 999");
    expect(box, "the typed amount is not on the page").not.toBeNull();
    expect(box).not.toContain("readonly");
  });

  it("says why, so a greyed box is not a mystery", () => {
    expect(quote({ record: withLines })).toContain(RECORD_COPY.zh.form.amountFromLines);
  });

  it("offers no lines on a money page or a person", () => {
    // Money is one entry and a person is not a list of things.
    for (const shape of ["ledger", "directory"] as const) {
      expect(quote({ shape, moduleKey: shape === "ledger" ? "payments" : "customers" }))
        .not.toContain(RECORD_COPY.zh.form.lineAdd);
    }
    expect(quote({})).toContain(RECORD_COPY.zh.form.lineAdd);
  });
});
