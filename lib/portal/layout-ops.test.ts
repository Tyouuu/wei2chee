import { describe, it, expect } from "vitest";
import {
  applyLayoutOps,
  describeLayout,
  layoutOpsSchema,
  walkNodes,
  REGISTERED_COMPONENTS,
  type LayoutOp,
  type PuckLayout,
} from "./layout-ops";
import { buildPageLayout } from "@/lib/templates/industry-template";
import { normalizeTable } from "./table-model";

const page = () =>
  buildPageLayout("dashboard", {
    industry: {
      slug: "renovation",
      name_zh: "装修/承包商",
      labels: { customer: "客户", order: "项目", staff: "师傅" },
      default_workflow: ["Customer", "Quotation", "Project", "Payment"],
      suggested_modules: [],
    },
  }) as unknown as PuckLayout;

const ids = (l: PuckLayout) => walkNodes(l.content).map((n) => String(n.props.id));

const tableOf = (l: PuckLayout, id: string) =>
  normalizeTable(walkNodes(l.content).find((n) => n.props.id === id)!.props);

describe("describeLayout", () => {
  it("reaches blocks nested inside the shell's slots", () => {
    const described = describeLayout(page());
    expect(described).toContain("dashboard-header");
    expect(described).toContain("dashboard-recent");
    expect(described).toContain("dashboard-rail");
  });

  it("names blocks in Chinese, as the customer sees them", () => {
    expect(describeLayout(page())).toContain("记录表格");
  });
});

describe("applyLayoutOps", () => {
  it("renames text on a nested block", () => {
    const ops: LayoutOp[] = [
      { op: "set_text", target_id: "dashboard-header", field: "title", value: "我的工地" },
    ];
    const { layout, applied, skipped } = applyLayoutOps(page(), ops);
    expect(applied).toBe(1);
    expect(skipped).toEqual([]);
    const header = walkNodes(layout.content).find((n) => n.props.id === "dashboard-header");
    expect(header!.props.title).toBe("我的工地");
  });

  it("never mutates the layout it was given", () => {
    const original = page();
    const before = JSON.stringify(original);
    applyLayoutOps(original, [
      { op: "set_text", target_id: "dashboard-header", field: "title", value: "变了" },
    ]);
    expect(JSON.stringify(original)).toBe(before);
  });

  // The whole reason the model emits operations instead of layout JSON.
  it("drops an invented component instead of putting an empty block on the page", () => {
    const { layout, applied, skipped } = applyLayoutOps(page(), [
      { op: "add_component", component: "CalendarWidget", after_id: null, title: null },
    ]);
    expect(applied).toBe(0);
    expect(skipped[0].reason).toContain("CalendarWidget");
    expect(ids(layout)).toEqual(ids(page()));
  });

  it("drops an operation aimed at an id that is not on the page", () => {
    const { applied, skipped } = applyLayoutOps(page(), [
      { op: "set_text", target_id: "does-not-exist", field: "title", value: "x" },
    ]);
    expect(applied).toBe(0);
    expect(skipped[0].reason).toContain("does-not-exist");
  });

  // Partial success is the normal case, not an edge case.
  it("applies the good operations even when one in the middle is bad", () => {
    const { layout, applied, skipped } = applyLayoutOps(page(), [
      { op: "set_text", target_id: "dashboard-header", field: "title", value: "一" },
      { op: "set_text", target_id: "nope", field: "title", value: "二" },
      { op: "set_text", target_id: "dashboard-header", field: "subtitle", value: "三" },
    ]);
    expect(applied).toBe(2);
    expect(skipped).toHaveLength(1);
    const header = walkNodes(layout.content).find((n) => n.props.id === "dashboard-header");
    expect(header!.props.subtitle).toBe("三");
  });

  it("adds a real component into the main column, not the sidebar", () => {
    const { layout, applied } = applyLayoutOps(page(), [
      { op: "add_component", component: "RecordTable", after_id: null, title: null },
    ]);
    expect(applied).toBe(1);
    const shell = layout.content.find((n) => n.type === "SystemShell")!;
    expect((shell.props.main as { type: string }[]).filter((n) => n.type === "RecordTable")).toHaveLength(2);
    expect((shell.props.sidebar as { type: string }[]).map((n) => n.type)).toEqual(["RailNav"]);
  });

  it("gives an added component an id that collides with nothing", () => {
    const { layout } = applyLayoutOps(page(), [
      { op: "add_component", component: "HeroCard", after_id: null, title: null },
      { op: "add_component", component: "HeroCard", after_id: null, title: null },
    ]);
    const all = ids(layout);
    expect(new Set(all).size).toBe(all.length);
  });

  it("removes a block by id", () => {
    const { layout, applied } = applyLayoutOps(page(), [
      { op: "remove_component", target_id: "dashboard-stats" },
    ]);
    expect(applied).toBe(1);
    expect(ids(layout)).not.toContain("dashboard-stats");
  });

  // Removing the shell would strand everything inside its two slots.
  it("refuses to remove the page frame", () => {
    const { layout, applied, skipped } = applyLayoutOps(page(), [
      { op: "remove_component", target_id: "dashboard-shell" },
    ]);
    expect(applied).toBe(0);
    expect(skipped[0].reason).toContain("框架");
    expect(layout.content[0].type).toBe("SystemShell");
  });

  it("adds a table row to a real table", () => {
    const { layout, applied } = applyLayoutOps(page(), [
      {
        op: "add_table_row",
        target_id: "dashboard-recent",
        cells: ["新工程", "陈先生", "RM 1,000", "等确认"],
        status_tone: "warning",
      },
    ]);
    expect(applied).toBe(1);
    const last = tableOf(layout, "dashboard-recent").rows.at(-1)!;
    expect(last.cells.primary).toBe("新工程");
    expect(last.cells.status).toBe("等确认");
    expect(last.tones?.status).toBe("warning");
  });

  it("refuses to add a table row to something that is not a table", () => {
    const { applied, skipped } = applyLayoutOps(page(), [
      { op: "add_table_row", target_id: "dashboard-stats", cells: ["x"], status_tone: "neutral" },
    ]);
    expect(applied).toBe(0);
    expect(skipped[0].reason).toContain("不是记录表格");
  });

  // The three operations the assistant used to have to refuse. Each one is only
  // possible because columns became data (lib/portal/table-model.ts).
  it("adds a column and gives every existing row a cell for it", () => {
    const { layout, applied } = applyLayoutOps(page(), [
      {
        op: "add_table_column",
        target_id: "dashboard-recent",
        column_label: "负责的师傅",
        column_kind: "text",
      },
    ]);
    expect(applied).toBe(1);
    const table = tableOf(layout, "dashboard-recent");
    const added = table.columns.at(-1)!;
    expect(added.label).toBe("负责的师傅");
    for (const row of table.rows) expect(row.cells).toHaveProperty(added.key);
  });

  it("renames a column by its key", () => {
    const { layout, applied } = applyLayoutOps(page(), [
      {
        op: "set_table_column",
        target_id: "dashboard-recent",
        column_key: "primary",
        column_label: "工程名称",
        column_kind: null,
      },
    ]);
    expect(applied).toBe(1);
    expect(tableOf(layout, "dashboard-recent").columns[0].label).toBe("工程名称");
  });

  it("removes a column and the cells that belonged to it", () => {
    const before = tableOf(page(), "dashboard-recent");
    const { layout, applied } = applyLayoutOps(page(), [
      { op: "remove_table_column", target_id: "dashboard-recent", column_key: "amount" },
    ]);
    expect(applied).toBe(1);
    const after = tableOf(layout, "dashboard-recent");
    expect(after.columns.map((c) => c.key)).not.toContain("amount");
    expect(after.columns).toHaveLength(before.columns.length - 1);
    for (const row of after.rows) expect(row.cells).not.toHaveProperty("amount");
  });

  it("refuses to remove a column that is not there", () => {
    const { applied, skipped } = applyLayoutOps(page(), [
      { op: "remove_table_column", target_id: "dashboard-recent", column_key: "c9" },
    ]);
    expect(applied).toBe(0);
    expect(skipped[0].reason).toContain("没有");
  });

  // A table with no columns cannot render and cannot be recovered from -- there
  // would be no header row left to add one back through.
  it("refuses to remove the last remaining column", () => {
    let layout = page();
    const keys = tableOf(layout, "dashboard-recent").columns.map((c) => c.key);
    for (const key of keys.slice(0, -1)) {
      layout = applyLayoutOps(layout, [
        { op: "remove_table_column", target_id: "dashboard-recent", column_key: key },
      ]).layout;
    }
    const { applied, skipped } = applyLayoutOps(layout, [
      { op: "remove_table_column", target_id: "dashboard-recent", column_key: keys.at(-1)! },
    ]);
    expect(applied).toBe(0);
    expect(skipped[0].reason).toContain("至少");
  });

  // Saved layouts predate the array shape and are never rewritten in SQL, so an
  // operation has to work on one that has never been re-saved.
  it("operates on a table still saved in the old four-column shape", () => {
    const legacy: PuckLayout = {
      root: {},
      content: [
        {
          type: "RecordTable",
          props: {
            id: "old-table",
            gridId: "old-table",
            caption: "报价单",
            primaryLabel: "客户",
            amountLabel: "金额",
            statusColumnLabel: "状态",
            rows: [{ primary: "陈先生", amount: "RM 500", statusTone: "warning", statusLabel: "待确认" }],
          },
        },
      ],
    };
    const { layout, applied } = applyLayoutOps(legacy, [
      {
        op: "add_table_column",
        target_id: "old-table",
        column_label: "负责的师傅",
        column_kind: "text",
      },
    ]);
    expect(applied).toBe(1);
    const table = tableOf(layout, "old-table");
    expect(table.columns.map((c) => c.label)).toEqual(["客户", "金额", "状态", "负责的师傅"]);
    expect(table.rows[0].cells.primary).toBe("陈先生");
    // The legacy props are gone, so Puck's fields panel cannot show a second,
    // dead editor for them.
    const node = walkNodes(layout.content).find((n) => n.props.id === "old-table")!;
    expect(node.props).not.toHaveProperty("primaryLabel");
    expect(node.props).not.toHaveProperty("rows");
  });

  it("replaces a workflow's stages", () => {
    const { layout, applied } = applyLayoutOps(page(), [
      { op: "set_workflow", target_id: "dashboard-workflow", stages: ["询问", "报价", "施工"] },
    ]);
    expect(applied).toBe(1);
    const strip = walkNodes(layout.content).find((n) => n.props.id === "dashboard-workflow")!;
    expect((strip.props.stages as { label: string }[]).map((s) => s.label)).toEqual([
      "询问",
      "报价",
      "施工",
    ]);
  });
});

describe("layoutOpsSchema", () => {
  it("rejects a text field outside the allowed list", () => {
    expect(() =>
      layoutOpsSchema.parse({
        operations: [{ op: "set_text", target_id: "a", field: "gridId", value: "x" }],
        explanation: "",
      }),
    ).toThrow();
  });

  it("rejects a status tone outside the enum", () => {
    expect(() =>
      layoutOpsSchema.parse({
        operations: [
          {
            op: "add_table_row",
            target_id: "a",
            primary: "x",
            secondary: null,
            amount: null,
            status_label: "y",
            status_tone: "urgent",
          },
        ],
        explanation: "",
      }),
    ).toThrow();
  });

  it("caps how much one instruction can change at once", () => {
    const one = { op: "remove_component", target_id: "a" };
    expect(() =>
      layoutOpsSchema.parse({ operations: Array(13).fill(one), explanation: "" }),
    ).toThrow();
  });
});

describe("REGISTERED_COMPONENTS", () => {
  // The enum handed to the model is generated from the live registry, so a
  // component added to the editor is offered to AI editing automatically and
  // one removed stops being offered -- neither needs remembering.
  it("matches what the editor actually has registered", () => {
    expect(REGISTERED_COMPONENTS).toContain("RecordTable");
    expect(REGISTERED_COMPONENTS).toContain("WorkflowStrip");
    expect(REGISTERED_COMPONENTS).not.toContain("CalendarWidget");
  });
});
