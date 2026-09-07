import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NewRecordForm } from "./new-record-form";
import { RECORD_COPY } from "../record-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
/* 按下保存之后，真正被呼叫的是哪一支。`vi.hoisted` 是因为 `vi.mock`
   的工厂会被提到档案最上面 —— 一个普通的 const 在那一刻还不存在。 */
const calledRpcs = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    rpc: async (name: string) => {
      calledRpcs.push(name);
      return { error: null, data: null };
    },
    /* ⚠️ 明细那几行的挑选清单（`useLineSuggestions`）会去问一次
       `catalog_items` —— 一个只有 `rpc` 的替身，会让那一句抛出去，
       而 vitest 把它算成一个跟这几条断言无关的错误。
       **回零行，然后那一段自己到此为止**：那正是绝大多数生意的情况。 */
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const k of ["select", "eq", "is", "in", "order", "limit"]) {
        chain[k] = () => chain;
      }
      chain.then = (
        ok: (r: { data: unknown[]; error: null }) => unknown,
      ) => ok({ data: [], error: null });
      return chain;
    },
  }),
}));

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
  const record = {
    id: "r1",
    values: { primary: "订金", secondary: "陈先生", amount: "RM 3,000" },
    archivedAt: null,
  };

  it("lets him fix what the payment was FOR", () => {
    expect(boxes(form({ record }))[0]).toBe(false);
  });

  it("does not let him type into what it cannot save", () => {
    // 「陈先生」 and 「RM 3,000」 are shown and locked: he opened the row to see
    // them, and the way to change them is a reversal.
    /* ⚠️ 三格，不是两格：2026-09-07 钱那几页多了一格日期，而它在**存过之后
       一样是锁的** —— `update_ledger_words` 不收 entry_on（钱不改，只开一张
       相反的），所以一格改了存不下去的日期，是同一个说谎的控件。
       这一条守的从来不是「只有几格」，是**存不进去的框不准打字**。 */
    expect(boxes(form({ record })).slice(1)).toEqual([true, true, true]);
  });

  /* ── 这笔钱是干什么的、属於哪一单（20260904200000）────── */
  it("lets him say what the money was for, because that one CAN be saved", () => {
    const html = form({ record, moduleKey: "expenses" });
    const box =
      new RegExp(
        `<input[^>]*aria-label="${RECORD_COPY.zh.form.category}"[^>]*>`,
      ).exec(html)?.[0] ?? "";
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
  const record = {
    id: "r1",
    values: { primary: "翻新", secondary: "陈先生", amount: "RM 48,500" },
    archivedAt: null,
  };

  /* 五格，不是四格：9-03 报价单多了「有效期到」，9-04 又多了工地照片那个
     选档案的格子。数量留着不改成 every()，因为它同时在守另一件事 ——
     **一格消失了这里会红**，而这个仓库掉过太多次「那一格还在、只是没人画」。 */
  it("lets him fix every box, because a quotation is a working document", () => {
    expect(
      boxes(form({ shape: "pipeline", moduleKey: "quotations", record })),
    ).toEqual([false, false, false, false, false]);
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
    const html = form({
      shape: "pipeline",
      moduleKey: "quotations",
      record: { ...record, archivedAt: "2026-08-31" },
    });
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
    [...html.matchAll(/<input[^>]*\/?>/g)]
      .map((m) => m[0])
      .find((t) => t.includes(`value="${value}"`)) ?? null;

  const withLines = {
    id: "r1",
    values: { primary: "翻新", secondary: "陈先生", amount: "RM 999" },
    archivedAt: null,
    lines: [
      {
        description: "拆除",
        qty: "",
        unit: "",
        unitPrice: "",
        amount: "RM 3,000",
        batchCode: "",
      },
      {
        description: "油漆",
        qty: "2.5",
        unit: "房",
        unitPrice: "RM 2,000",
        amount: "RM 5,000",
        batchCode: "",
      },
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
    const html = quote({
      record: {
        id: "r1",
        values: { primary: "翻新", amount: "RM 999" },
        archivedAt: null,
      },
    });
    const box = boxWith(html, "RM 999");
    expect(box, "the typed amount is not on the page").not.toBeNull();
    expect(box).not.toContain("readonly");
  });

  it("says why, so a greyed box is not a mystery", () => {
    expect(quote({ record: withLines })).toContain(
      RECORD_COPY.zh.form.amountFromLines,
    );
  });

  it("offers no lines on a money page or a person", () => {
    // Money is one entry and a person is not a list of things.
    for (const shape of ["ledger", "directory"] as const) {
      expect(
        quote({
          shape,
          moduleKey: shape === "ledger" ? "payments" : "customers",
        }),
      ).not.toContain(RECORD_COPY.zh.form.lineAdd);
    }
    expect(quote({})).toContain(RECORD_COPY.zh.form.lineAdd);
  });
});

/* 短的那几格并排 —— 名字那一格占整行。
 *
 * `align:pages` 2026-09-05 判「开一张单」这一页：**一屏几块 8 对 1**。
 * 并排图看得很清楚：参考那一页（arhamkhnz 的 dashboard/invoice）把成对的
 * 东西摆成一行（发出日期／到期日 · 税／折扣），而我们一栏到底 ——
 * 五个框就占满一屏，明细跟分期表全部要滚下去才看得到。
 *
 * ⚠️ 这一条量的是**哪几格被标成半行**，不是它们画出来多宽：
 * 宽度是容器查询决定的（手机上整张表是 390，`@3xl` 不成立，自己回到一栏），
 * 而在 jsdom 里没有容器宽度可以量 —— 量一个量不到的东西，就是一把
 * 「读数漂亮而画面是坏的」的尺。宽度是用眼睛在 1400 跟 390 各看过一次的。
 */
describe("短的那几格占半行", () => {
  const halves = (html: string) => (html.match(/data-half=""/g) ?? []).length;

  it("金额跟状态都是半行", () => {
    const html = form({
      moduleKey: "quotations",
      shape: "pipeline",
      columns: [
        ...columns,
        { key: "status", label: "Status", kind: "status" as const },
      ],
      stages: ["等回覆", "已确认"],
    });
    /* 金额 · 状态 · 有效期 —— 走单那一页三格都短。 */
    expect(halves(html)).toBe(3);
  });

  it("没有状态那一栏的时候，只有金额", () => {
    /* ⚠️ 状态那一格是**这张表有没有那一栏**决定的，不是有没有流程 ——
       第一版这一条写成「有 stages 就有两格」，而它红了：那份栏位清单里
       根本没有状态。红的是我的期望，不是产品。 */
    /* ⚠️ 两格：金额 ＋ 那一格日期（2026-09-07 加的，钱那几页都有）。 */
    expect(halves(form({ stages: ["等回覆", "已确认"] }))).toBe(2);
  });

  it("名字那一格不是 —— 一个工程的名字要写得下", () => {
    const html = form();
    /* 第一格是名字，而它前面不可以有 data-half。 */
    const upToFirstBox = html.slice(0, html.indexOf("For</span>"));
    expect(upToFirstBox).not.toContain('data-half=""');
  });

  it("一栏都不短的时候，只剩那一格日期", () => {
    /* ⚠️ 从 0 变成 1：钱那几页永远有一格日期，而它是短的那一种。
       这一条量的是**这张表自己那几栏**有没有多标 —— 而它们一格都没有。 */
    expect(
      halves(
        form({
          columns: [{ key: "primary", label: "For", kind: "text" as const }],
          stages: [],
        }),
      ),
    ).toBe(1);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   那句红字贴着它讲的那一格。

   ── 老板 2026-09-06 报的 ──────────────────────────────────────────────────
   「两格的标签几乎一样（For 跟 What this was for），而填错的时候那句红字
   印在整张表最底下，用『第一格』去指最上面那一格。」

   两件都是真的，而且第二件有别人量过的读数：Baymard —— 错误讯息要**贴着
   那一格**，而且讲**要求**不讲**违规**。一张填完 1,400px 高的表，
   把那句话印在最底下，等於要他先读懂一句话，再自己数回去。

   ⚠️ 这一条守的是**位置**，不是那句话写得好不好：那句红字必须跟它讲的
   那个输入框在同一个 `<label>` 里面。
   ───────────────────────────────────────────────────────────────────────── */
describe("填错的时候，那句话在哪里", () => {
  it("红字跟它讲的那一格在同一个 label 里，不在表的最底下", async () => {
    const { render, screen, fireEvent, cleanup } = await import(
      "@testing-library/react"
    );
    const { container } = render(
      <NewRecordForm
        projectId="p"
        moduleKey="quotations"
        shape="pipeline"
        parties={[]}
        columns={columns}
        title="Quotations"
        today="2026-09-02"
        stages={[]}
        backHref="/x"
        copy={RECORD_COPY.en.form}
      />,
    );
    /* 直接送出那张表 —— 那颗「保存」画在页面的抬头上（`PageBar`），
       不在这个组件里面，而这一条要量的是送出去之后那句话落在哪。 */
    const el = container.querySelector("form");
    expect(el, "这个组件应该画一张 form").not.toBeNull();
    fireEvent.submit(el as HTMLFormElement);
    const alert = await screen.findByRole("alert");
    const box = container.querySelector<HTMLInputElement>(
      '[data-field="primary"]',
    ) as HTMLInputElement;
    expect(box, "第一格应该有 data-field").not.toBeNull();
    expect(alert.closest("label")).not.toBeNull();
    expect(alert.closest("label")).toBe(box.closest("label"));
    /* 而且那一格自己讲得出它是坏的 —— 给读屏的人，也给样式。 */
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBe(alert.id);
    cleanup();
  });

  it("那句话不再用位置去指一个格子", () => {
    for (const lang of ["en", "zh"] as const) {
      const c = RECORD_COPY[lang].form;
      for (const s of [c.required, c.requiredName]) {
        expect(s, `${lang}: ${s}`).not.toMatch(/第一(格|栏)|first (field|column|box)/);
      }
    }
  });

  it("同一张表上没有两个几乎一样的标签", () => {
    /* 「For」跟「What this was for」—— 老板报的那一对。
       ⚠️ 量的是**一个装着另一个**：两句完全不同的话不会互相包含，
       而一句是另一句的开头或结尾，读起来就是同一格问了两次。 */
    const c = RECORD_COPY.en.form;
    const money = [columns[0].label, c.category, c.forJob, c.branch, c.doneBy];
    for (let i = 0; i < money.length; i++) {
      for (let j = i + 1; j < money.length; j++) {
        const a = money[i].toLowerCase();
        const b = money[j].toLowerCase();
        expect(
          a.includes(b) || b.includes(a),
          `「${money[i]}」跟「${money[j]}」几乎是同一句`,
        ).toBe(false);
      }
    }
  });
});

/**
 * 🔴 改一件货，走的是改货那一支。
 *
 * ── 这一条守的是什么 ──────────────────────────────────────────────────────
 *
 * 那一段本来是三支各自的早退（预约 · 对帐），底下一个三元
 * （名册 · 钱 · 其余）。而 `catalog` 一支自己的都没有，
 * 於是它掉进「其余」—— `update_pipeline_record`，
 * 而那一支第一句就是照 id 找一张单，找不到就报
 * `no such record in your project`。
 *
 * **所以那不是少一扇门，是一颗坏掉的保存**：一个五金店老板打开一件货、
 * 把卖价改一改、按保存，读到一句资料库的话，而那句话还是假的。
 *
 * ⚠️ 量的是**那个形状**不是这一次：底下第二条走过这个表单编辑得了的
 * 每一种形状，任何一种掉回 `update_pipeline_record` 就红 ——
 * 「修了一个实例，没修那个形状」这个仓库栽过至少八次。
 */
describe("按保存的时候，呼叫的是那个形状自己那一支", () => {
  const saveAs = async (
    shape: "catalog" | "directory" | "ledger" | "pipeline",
    moduleKey: string,
  ) => {
    const { render, fireEvent, cleanup } = await import(
      "@testing-library/react"
    );
    calledRpcs.length = 0;
    const { container } = render(
      <NewRecordForm
        projectId="p"
        moduleKey={moduleKey}
        shape={shape}
        parties={[]}
        columns={columns}
        title={moduleKey}
        today="2026-09-02"
        stages={[]}
        backHref="/back"
        copy={RECORD_COPY.en.form}
        record={{
          id: "row-1",
          values: { primary: "Cement 50kg", unit: "bag" },
          archivedAt: null,
        }}
      />,
    );
    const el = container.querySelector("form");
    expect(el, `${shape}: 那一页上没有表单`).not.toBeNull();
    fireEvent.submit(el as HTMLFormElement);
    await new Promise((r) => setTimeout(r, 0));
    cleanup();
    return [...calledRpcs];
  };

  it("一件货改的是那件货，不是一张不存在的单", async () => {
    const rpcs = await saveAs("catalog", "inventory");
    expect(rpcs, "改一件货没有走 update_catalog_item").toContain(
      "update_catalog_item",
    );
    expect(rpcs, "🔴 一件货掉进了走单那一支").not.toContain(
      "update_pipeline_record",
    );
  });

  it("每一种形状都有自己那一支", async () => {
    /* 走单本来就该走它 —— 其余每一种掉回去就是这一次的那个洞。 */
    const own: Record<string, string> = {
      catalog: "update_catalog_item",
      directory: "update_directory_entry",
      ledger: "update_ledger_words",
      pipeline: "update_pipeline_record",
    };
    const moduleOf: Record<string, string> = {
      catalog: "inventory",
      directory: "customers",
      ledger: "payments",
      pipeline: "quotations",
    };
    for (const shape of Object.keys(own) as (keyof typeof moduleOf)[]) {
      const rpcs = await saveAs(
        shape as "catalog" | "directory" | "ledger" | "pipeline",
        moduleOf[shape],
      );
      expect(rpcs, `${shape}: 走的不是它自己那一支`).toContain(own[shape]);
    }
  });
});
