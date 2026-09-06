import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NewRecordForm } from "./new-record-form";
import { RECORD_COPY } from "../record-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    rpc: async () => ({ error: null, data: null }),
  }),
}));

/**
 * 拍一张收据 → 一笔开销：那颗按钮画在对的地方，而它读到的东西真的走得出去。
 *
 * ── 这一条守的两件事 ──────────────────────────────────────────────────────
 *
 * ① **那颗按钮只画在按得动的地方。** 花钱那几页、而且只在新增的时候 ——
 *    一笔已经存下来的钱除了那句话什么都改不了（`update_ledger_words` 不收
 *    金额也不收对方），所以在那上面画一颗会填格子的按钮，
 *    就是一颗做不了事的按钮，而那是这个仓库禁的第一条。
 *
 * ② 🔴 **读到的东西真的送得出去。** 这个仓库最贵的那一类缺陷是
 *    「算出来了、送不到」——`receipt_url` 那一栏从 20260831020000 建表那天
 *    就在，两支写入函式从第一版就收它，而**三个星期零个 TypeScript 传过它**。
 *    ⚠️ 那一半量的是**原始码**不是画面：要在 jsdom 里跑完
 *    「选一张图 → canvas 缩图 → 传上桶 → 打模型」才看得到那两个参数，
 *    而那要一个真的浏览器跟一次真的呼叫（`npm run check:receipt` 在做那件事）。
 *
 * ── 顺带守住的第三件 ──────────────────────────────────────────────────────
 *
 * 那一格日期本身就是一个洞：`add_ledger_entry` 收 `in_entry_on`，而这张表单
 * **从来没有送过它**，所以每一笔开销都是今天。他月底坐下来处理一叠上个月的
 * 收据，三十张全部落在这个月 —— 而 `live-months` 就是照那一栏分月的。
 */

const SRC = readFileSync(
  join(process.cwd(), "app", "[locale]", "portal", "[pageKey]", "new", "new-record-form.tsx"),
  "utf8",
);

const columns = [
  { key: "primary", label: "For", kind: "text" as const },
  { key: "secondary", label: "Supplier", kind: "detail" as const },
  { key: "amount", label: "Amount", kind: "amount" as const },
];

const form = (over: Partial<Parameters<typeof NewRecordForm>[0]> = {}) =>
  renderToStaticMarkup(
    <NewRecordForm
      projectId="p"
      moduleKey="expenses"
      shape="ledger"
      parties={[]}
      columns={columns}
      title="Expenses"
      today="2026-09-07"
      stages={[]}
      backHref="/back"
      copy={RECORD_COPY.en.form}
      {...over}
    />,
  );

describe("拍一张收据", () => {
  it("花钱那一页，新增的时候画得出来", () => {
    expect(form()).toContain("data-receipt-shot");
  });

  it("🔴 收进来的钱那一页不画 —— 没有人拍一张收据来记别人付给他的钱", () => {
    expect(form({ moduleKey: "payments" })).not.toContain("data-receipt-shot");
  });

  it("🔴 已经存下来的那一笔不画 —— 那一页上填不进任何一格", () => {
    const html = form({
      record: {
        id: "e1",
        values: { primary: "水泥", secondary: "建材行", amount: "RM 120.50" },
        archivedAt: null,
      },
    });
    expect(html).not.toContain("data-receipt-shot");
  });

  it("名册那一边一样不画", () => {
    expect(form({ shape: "directory", moduleKey: "customers" })).not.toContain(
      "data-receipt-shot",
    );
  });
});

describe("这一笔的日期", () => {
  const dateBox = (html: string) =>
    [...html.matchAll(/<input[^>]*>/g)].find((m) =>
      m[0].includes('data-field="entry_on"'),
    )?.[0];

  it("钱那几页都有一格，而且新增的时候填得了", () => {
    const box = dateBox(form());
    expect(box, "钱那一页上没有日期那一格").toBeTruthy();
    expect(box).toContain('type="date"');
    expect(box, "新增的时候它不该是锁的").not.toContain("aria-readonly");
  });

  it("🔴 存过之后锁住 —— 钱不改，只开一张相反的", () => {
    const box = dateBox(
      form({
        record: {
          id: "e1",
          values: { primary: "水泥", secondary: "建材行", amount: "RM 120.50" },
          archivedAt: null,
        },
      }),
    );
    expect(box).toBeTruthy();
    expect(box, "🔴 一格改了存不下去的日期，是一个说谎的控件").toContain(
      "aria-readonly",
    );
  });

  /* 🔴 上面那一条量的是**表单**，而日期是从 `[recordId]/page.tsx` 送进来的
     —— 我故意把那一句读取拿掉试了一次，**上面那一条照样绿**（它自己把
     `entry_on` 塞进 `record.values` 里）。一条量不到东西的断言，
     跟一条真的在守的，在报告里长得一模一样。所以这一条问那一页自己。 */
  it("🔴 那一页真的把 entry_on 读出来", () => {
    const page = readFileSync(
      join(
        process.cwd(),
        "app",
        "[locale]",
        "portal",
        "[pageKey]",
        "[recordId]",
        "page.tsx",
      ),
      "utf8",
    );
    const at = page.indexOf('ctx.shape === "ledger"');
    expect(at, "找不到钱那一段").toBeGreaterThan(0);
    const block = page.slice(at, at + 2000);
    expect(block, "🔴 那一段没有 select entry_on").toContain("entry_on,");
    expect(block, "🔴 select 了却没有放进 values").toMatch(
      /entry_on:\s*\(data as/,
    );
  });

  it("🔴 读得回来 —— 打开一笔上个月的，看到的是上个月", () => {
    const html = form({
      record: {
        id: "e1",
        values: {
          primary: "水泥",
          secondary: "建材行",
          amount: "RM 120.50",
          entry_on: "2026-08-14",
        },
        archivedAt: null,
      },
    });
    expect(dateBox(html), "打开一笔旧的，日期那一格是空的").toContain(
      "2026-08-14",
    );
  });

  it("名册那一边没有这一格", () => {
    expect(
      dateBox(form({ shape: "directory", moduleKey: "customers" })),
    ).toBeUndefined();
  });
});

describe("🔴 读到的东西真的送得出去", () => {
  /** `add_ledger_entry` 那一段的原始码。 */
  const call = (() => {
    const at = SRC.indexOf('rpc("add_ledger_entry"');
    expect(at, "找不到那一支写入").toBeGreaterThan(0);
    return SRC.slice(at, at + 1600);
  })();

  it.each([
    ["in_entry_on", "收据上那个日子"],
    ["in_receipt_url", "那张收据本身"],
  ])("%s 送出去了（%s）", (arg) => {
    expect(
      call,
      `🔴 ${arg} 又从写入那一段掉了 —— 读到了、送不到，见档头`,
    ).toContain(arg);
  });

  /* ⚠️ 空字串要变成 null。一个空字串在 `receipt_url` 那一栏上，
     看起来像「有一张收据，而它在一个空的地方」。 */
  it("没有拍照的时候送的是 null，不是空字串", () => {
    expect(call).toMatch(/in_receipt_url:\s*receiptPath \|\| null/);
    expect(call).toMatch(/in_entry_on:\s*entryOn \|\| null/);
  });

  /* 🔴 读不出来的时候，那张照片照旧要挂上去 —— 一个传上去、没有任何一行
     指着它的档案就是孤儿档，而他明年查帐要拿的正是那一张。 */
  it("读不出来也把路径交出去", () => {
    const shot = readFileSync(
      join(process.cwd(), "app", "[locale]", "portal", "[pageKey]", "new", "receipt-shot.tsx"),
      "utf8",
    );
    const bad = shot.slice(shot.indexOf("if (!res.ok"));
    expect(bad.slice(0, 400)).toContain("onShot(path, null)");
  });
});
