import { describe, it, expect } from "vitest";
import { upgradeLayout } from "./layout-upgrade";
import { normalizeTable, upgradeRecordTableProps } from "./table-model";

/**
 * These tests guard the one thing this change could not be allowed to break:
 * layouts customers have already paid for and saved. `project_pages.layout_json`
 * is the only copy of a customer's design, so "the old shape still reads" is not
 * a nicety, it is the acceptance criterion.
 */

const legacyTable = {
  id: "t1",
  gridId: "t1",
  caption: "报价单",
  primaryLabel: "客户",
  secondaryLabel: "工程",
  amountLabel: "金额",
  statusColumnLabel: "状态",
  rows: [
    { primary: "陈先生", secondary: "厨房翻新", amount: "RM 8,500", statusTone: "warning", statusLabel: "待确认" },
    { primary: "林太太", secondary: "浴室", amount: "RM 3,200", statusTone: "positive", statusLabel: "已确认" },
  ],
};

describe("normalizeTable", () => {
  it("reads the legacy four-prop shape into columns and cells", () => {
    const { columns, rows } = normalizeTable(legacyTable);
    expect(columns.map((c) => c.label)).toEqual(["客户", "工程", "金额", "状态"]);
    expect(columns.map((c) => c.kind)).toEqual(["text", "detail", "amount", "status"]);
    expect(rows[0].cells.primary).toBe("陈先生");
    expect(rows[0].cells.status).toBe("待确认");
    expect(rows[0].tones?.status).toBe("warning");
  });

  // The old component decided a column existed by scanning rows for a defined
  // value, so an unused optional column was invisible. Same rule, or a table
  // that showed three columns yesterday shows four today.
  it("omits an optional column that was never labelled or filled in", () => {
    const { columns } = normalizeTable({
      primaryLabel: "客户",
      rows: [{ primary: "陈先生", statusTone: "neutral", statusLabel: "待处理" }],
    });
    expect(columns.map((c) => c.key)).toEqual(["primary", "status"]);
  });

  it("is idempotent -- upgrading twice is upgrading once", () => {
    const once = upgradeRecordTableProps(legacyTable);
    const twice = upgradeRecordTableProps(once);
    expect(twice).toEqual(once);
  });

  it("never returns a table with no columns", () => {
    expect(normalizeTable({}).columns.length).toBeGreaterThan(0);
    expect(normalizeTable({ table: { columns: [], rows: [] } }).columns.length).toBeGreaterThan(0);
  });

  it("drops a column entry that has no key rather than rendering a ghost", () => {
    const { columns } = normalizeTable({
      table: { columns: [{ key: "a", label: "名称", kind: "text" }, { label: "坏的" }], rows: [] },
    });
    expect(columns).toHaveLength(1);
  });
});

describe("upgradeLayout", () => {
  const saved = {
    root: {},
    content: [
      {
        type: "SystemShell",
        props: {
          id: "shell",
          sidebar: [
            {
              type: "RailNav",
              props: { id: "rail", brandLabel: "我的系统", notificationsHref: "#", accountHref: "#", items: [] },
            },
          ],
          main: [{ type: "RecordTable", props: legacyTable }],
        },
      },
    ],
  };

  it("reaches components nested inside a slot", () => {
    const out = upgradeLayout(saved) as typeof saved;
    const table = (out.content[0].props.main as { props: Record<string, unknown> }[])[0].props;
    expect(table).toHaveProperty("table");
    expect(table).not.toHaveProperty("primaryLabel");
    expect(table).not.toHaveProperty("rows");
  });

  it("turns the rail's two hardcoded links into a list the customer owns", () => {
    const out = upgradeLayout(saved, "zh") as typeof saved;
    const rail = (out.content[0].props.sidebar as { props: Record<string, unknown> }[])[0].props;
    expect(rail.utilityItems).toEqual([
      { label: "通知", iconName: "notifications" },
      { label: "账号设置", iconName: "account" },
    ]);
    expect(rail).not.toHaveProperty("notificationsHref");
  });

  // The words the upgrade INVENTS have to be in the system's language, not in
  // whichever one they were first written in. This is the assertion that would
  // have caught 「筛选条件」 sitting on four pages of an English system --
  // measured on 2026-08-26, on a portal already called localised twice.
  it("writes the chrome it invents in the system's own language", () => {
    const en = upgradeLayout(saved, "en") as typeof saved;
    const rail = (en.content[0].props.sidebar as { props: Record<string, unknown> }[])[0].props;
    expect(rail.utilityItems).toEqual([
      { label: "Notifications", iconName: "notifications" },
      { label: "Account", iconName: "account" },
    ]);
  });

  it("fills a saved FilterChips' missing labels, and never overwrites the owner's", () => {
    const page = {
      content: [
        { type: "FilterChips", props: { chips: [], clearAllHref: "#" } },
        { type: "FilterChips", props: { chips: [], clearAllHref: "#", filteredByLabel: "Showing" } },
      ],
    };
    const out = upgradeLayout(page, "en") as typeof page;
    expect(out.content[0].props).toMatchObject({
      filteredByLabel: "Filtered by",
      clearAllLabel: "Clear all",
    });
    expect(out.content[1].props.filteredByLabel).toBe("Showing");
  });

  it("leaves the input untouched", () => {
    const before = JSON.stringify(saved);
    upgradeLayout(saved);
    expect(JSON.stringify(saved)).toBe(before);
  });

  it("passes a layout with no content straight through", () => {
    expect(upgradeLayout({} as { content?: unknown })).toEqual({});
  });
});
