import { describe, it, expect } from "vitest";
import { puckConfig } from "@/design-system/editor/puck-config";
import {
  applyLayoutOps,
  describeLayout,
  layoutOpsSchema,
  walkNodes,
  REGISTERED_COMPONENTS,
  TEXT_FIELDS_BY_COMPONENT,
  EDITABLE_TEXT_FIELDS,
  PHOTO_BLOCKS,
  findSelector,
  mainColumn,
  ROOT_ZONE,
  type LayoutOp,
  type PuckLayout,
  type PuckNode,
} from "./layout-ops";
import { buildPageLayout } from "@/lib/templates/industry-template";
import { normalizeTable } from "./table-model";

const renovation = {
  industry: {
    slug: "renovation",
    name_zh: "装修/承包商",
    labels: { customer: "客户", order: "项目", staff: "师傅" },
    default_workflow: ["Customer", "Quotation", "Project", "Payment"],
    suggested_modules: [],
  },
};

const page = () =>
  buildPageLayout("dashboard", renovation) as unknown as PuckLayout;

/**
 * 一张**模块页**，给那几条要「页面标题」跟「流程条」的测试用。
 *
 * 🔴 2026-09-04：它们本来全部拿总览当道具。总览照 arhamkhnz 收成三块
 * （四张数字卡 → 图表卡 → 表），**页面标题跟流程条都不在上面了**，
 * 而这几条测试问的从来不是「总览有什么」，是「改一块藏在插槽里的东西改不改得到」。
 * 换一张有那两块的页，题目一个字都没变。
 */
const orders = () => buildPageLayout("orders", renovation) as unknown as PuckLayout;

const ids = (l: PuckLayout) => walkNodes(l.content).map((n) => String(n.props.id));

const tableOf = (l: PuckLayout, id: string) =>
  normalizeTable(walkNodes(l.content).find((n) => n.props.id === id)!.props);

describe("describeLayout", () => {
  it("reaches blocks nested inside the shell's slots", () => {
    const described = describeLayout(page());
    expect(described).toContain("dashboard-stats");
    expect(described).toContain("dashboard-recent");
    expect(described).toContain("dashboard-rail");
  });

  it("names blocks in Chinese, as the customer sees them", () => {
    expect(describeLayout(page())).toContain("记录表格");
  });
});


/**
 * 🔴 模型看得见的那几行 —— 而在 2026-09-07 之前它一行都看不见，
 * 而且到今天为止**一条守卫都没有**（`record=` 在测试里出现零次）。
 *
 * 两件事一起钉住：表格那一边（昨天做的）跟看板那一边（今天做的）。
 * 逐页量出来的读数是：十八页十六页印得出行，**而工程 · 任务两页一行都没有**
 * —— 那两页从 2026-09-02 起只有看板，表格拿掉了（任务 152）。
 */
describe("模型看得见的那几行", () => {
  const withCards = (cards: Record<string, unknown>[]) => {
    const l = buildPageLayout("projects", renovation) as unknown as PuckLayout;
    const board = walkNodes(l.content).find((n) => n.type === "TaskBoard")!;
    board.props.cards = cards;
    return describeLayout(l);
  };

  it("看板那两页真的用看板装记录 —— 这一条是那个洞本身", () => {
    const l = buildPageLayout("projects", renovation) as unknown as PuckLayout;
    const types = walkNodes(l.content).map((n) => n.type);
    expect(types).toContain("TaskBoard");
    /* 表格是它以前的第二条路。拿掉了，所以卡片是唯一的入口 —— 也就是
       看板不印行的时候，那一页对模型来说是空的。 */
    expect(types).not.toContain("RecordTable");
  });

  it("看板上的卡片印得出来", () => {
    expect(withCards([{ title: "Taman Desa 三房翻新", stage: "施工", note: "陈先生" }])).toContain(
      "Taman Desa 三房翻新",
    );
  });

  it("一张真的卡有把手，一张示例没有", () => {
    const text = withCards([
      {
        title: "真的那一单",
        stage: "施工",
        href: "/en/portal/projects/3f2b1a9c-1111-4222-8333-444455556666",
      },
      { title: "示例那一张", stage: "报价" },
    ]);
    expect(text).toContain("record=3f2b1a9c-1111-4222-8333-444455556666");
    /* 认不出编号的照样印出来（他看得见它），只是动不了 —— 往拒绝的方向坏。 */
    expect(text).toContain("示例那一张");
    expect(text).toMatch(/（示例，动不了）[^|\]]*示例那一张/);
  });

  it("每一张卡讲得出自己现在在哪一栏", () => {
    /* `set_record_status` 改的就是这个。少了它，模型看不出一张卡已经在
       它该在的地方，而一次没有必要的改动照样会写进那本「谁改的」帐。 */
    expect(withCards([{ title: "一单", stage: "施工" }])).toContain('stage="施工"');
  });

  it("🔴 不印看板自己那几栏的名字", () => {
    /* 看板的栏是「宣告的流程 ＋ 那几行真正在的阶段」的联集，比
       `stagesForModule` 那一份宽；而 route 已经拿那一份告诉模型
       「只能用这里面的」。在旁边再印一份更宽的，就是同一个问题两个答案。 */
    const text = withCards([{ title: "一单", stage: "自己打的一个阶段" }]);
    expect(text).not.toMatch(/stages=\[|栏=\[|columns=\[[^\]]*自己打的一个阶段/);
  });

  it("表格那一边照旧印得出行跟把手", () => {
    const l = buildPageLayout("quotations", renovation) as unknown as PuckLayout;
    const table = walkNodes(l.content).find((n) => n.type === "RecordTable")!;
    /* 行住在 `props.table.rows`，不是 `props.rows` —— 后者是那四个旧栏位
       的时代留下来的，`normalizeTable` 只有在没有 `table` 的时候才去读它。 */
    (table.props.table as { rows: unknown[] }).rows = [
      { href: "/en/portal/quotations/9a8b7c6d-5555-4666-8777-888899990000", cells: {} },
    ];
    expect(describeLayout(l)).toContain("record=9a8b7c6d-5555-4666-8777-888899990000");
  });
});

describe("applyLayoutOps", () => {
  it("renames text on a nested block", () => {
    const ops: LayoutOp[] = [
      { op: "set_text", target_id: "orders-header", field: "title", value: "我的工地" },
    ];
    const { layout, applied, skipped } = applyLayoutOps(orders(), ops);
    expect(applied).toBe(1);
    expect(skipped).toEqual([]);
    const header = walkNodes(layout.content).find((n) => n.props.id === "orders-header");
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
    expect(skipped[0].reason).toBe("noSuchComponent");
    expect(skipped[0].vars?.name).toBe("CalendarWidget");
    expect(ids(layout)).toEqual(ids(page()));
  });

  it("drops an operation aimed at an id that is not on the page", () => {
    const { applied, skipped } = applyLayoutOps(page(), [
      { op: "set_text", target_id: "does-not-exist", field: "title", value: "x" },
    ]);
    expect(applied).toBe(0);
    expect(skipped[0].reason).toBe("notFound");
    expect(skipped[0].vars?.id).toBe("does-not-exist");
  });

  // Partial success is the normal case, not an edge case.
  it("applies the good operations even when one in the middle is bad", () => {
    const { layout, applied, skipped } = applyLayoutOps(orders(), [
      { op: "set_text", target_id: "orders-header", field: "title", value: "一" },
      { op: "set_text", target_id: "nope", field: "title", value: "二" },
      { op: "set_text", target_id: "orders-header", field: "subtitle", value: "三" },
    ]);
    expect(applied).toBe(2);
    expect(skipped).toHaveLength(1);
    const header = walkNodes(layout.content).find((n) => n.props.id === "orders-header");
    expect(header!.props.subtitle).toBe("三");
  });

  it("adds a real component into the main column, not the sidebar", () => {
    const { layout, applied } = applyLayoutOps(page(), [
      { op: "add_component", component: "RecordTable", after_id: null, title: null },
    ]);
    expect(applied).toBe(1);
    const shell = layout.content.find((n) => n.type === "SystemShell")!;
    // Counted THROUGH the slots, not across the top of `main`: the dashboard's
    // own table lives inside a Panel now, so a flat filter here would see the
    // newly added one, miss the one already there, and pass just as happily if
    // the op had dropped it in the wrong place.
    const inMain = walkNodes(shell.props.main as PuckNode[]);
    expect(inMain.filter((n) => n.type === "RecordTable")).toHaveLength(2);
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
    expect(skipped[0].reason).toBe("frameNoDelete");
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
    expect(skipped[0].reason).toBe("notRecordTable");
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
    expect(skipped[0].reason).toBe("noSuchColumn");
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
    expect(skipped[0].reason).toBe("minOneColumn");
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
    const { layout, applied } = applyLayoutOps(orders(), [
      { op: "set_workflow", target_id: "orders-workflow", stages: ["询问", "报价", "施工"] },
    ]);
    expect(applied).toBe(1);
    const strip = walkNodes(layout.content).find((n) => n.props.id === "orders-workflow")!;
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

describe("move_component", () => {
  /*
    The operation the assistant did not have, audited on 2026-08-26 against
    「很方便可以調整完一切的東西 用Ai Agent的輔助」. Ten operations, none of which
    moved anything -- so 「把表格搬到上面」 could only be answered by deleting the
    block and adding a new one, which throws away every edit the owner had made
    to it, silently.
  */
  const page = () =>
    ({
      root: {},
      content: [
        {
          type: "SystemShell",
          props: {
            id: "shell",
            sidebar: [{ type: "RailNav", props: { id: "rail" } }],
            main: [
              { type: "PageHeader", props: { id: "head", title: "Overview" } },
              { type: "StatRow", props: { id: "stats" } },
              { type: "RecordTable", props: { id: "table" } },
            ],
          },
        },
      ],
    }) as unknown as PuckLayout;

  const mainIds = (l: PuckLayout) =>
    (((l.content[0] as unknown as { props: { main?: { props: { id: string } }[] } }).props
      .main ?? [])).map((n) => n.props.id);

  it("puts a block in front of another one", () => {
    const out = applyLayoutOps(page(), [
      { op: "move_component", target_id: "table", before_id: "stats" },
    ]);
    expect(out.applied).toBe(1);
    expect(mainIds(out.layout)).toEqual(["head", "table", "stats"]);
  });

  it("sends it to the end when before_id is null", () => {
    const out = applyLayoutOps(page(), [
      { op: "move_component", target_id: "head", before_id: null },
    ]);
    expect(mainIds(out.layout)).toEqual(["stats", "table", "head"]);
  });

  it("lands in the right place when moving DOWN the column", () => {
    /*
      The case that catches lift-then-place done in the wrong order. Removing
      the node shifts every index behind it, so a destination computed BEFORE
      the removal is one place off for every downward move -- and only for
      downward moves, which is why it survives a test that only moves up.
    */
    const out = applyLayoutOps(page(), [
      { op: "move_component", target_id: "head", before_id: "table" },
    ]);
    expect(mainIds(out.layout)).toEqual(["stats", "head", "table"]);
  });

  it("refuses to move the page frame", () => {
    const out = applyLayoutOps(page(), [
      { op: "move_component", target_id: "shell", before_id: null },
    ]);
    expect(out.applied).toBe(0);
    expect(out.skipped[0].reason).toBe("frameNoMove");
  });

  it("drops an id that is not on the page instead of emptying the column", () => {
    const out = applyLayoutOps(page(), [
      { op: "move_component", target_id: "nope", before_id: "stats" },
    ]);
    expect(out.applied).toBe(0);
    expect(mainIds(out.layout)).toEqual(["head", "stats", "table"]);
  });
});

describe("PHOTO_BLOCKS", () => {
  /*
    The assistant could not reach a picture at all before this: the picker
    existed, it uploaded to the customer's own storage, it even knew this
    trade's search words -- and nothing told the model which blocks have
    somewhere to put one. An empty list here means 「第一屏换一张工地的照片」
    silently goes back to having no answer, which is exactly how it shipped.
  */
  it("finds the blocks that own a picture slot", () => {
    expect(PHOTO_BLOCKS.length).toBeGreaterThan(0);
    expect(PHOTO_BLOCKS).toContain("SiteHero");
  });

  it("only names blocks that are registered", () => {
    for (const name of PHOTO_BLOCKS) {
      expect(REGISTERED_COMPONENTS).toContain(name);
    }
  });

  /*
    SiteTeam keeps a photo per person inside an array. Offering to open "the
    picture on SiteTeam" would not tell the customer WHICH person is being
    changed, so it is deliberately not a top-level slot and must not appear.
  */
  it("leaves per-item photos out", () => {
    expect(PHOTO_BLOCKS).not.toContain("SiteTeam");
  });
});

describe("findSelector", () => {
  const page = buildPageLayout("dashboard", {}, "我", "zh", [], "ledger", null) as unknown as PuckLayout;

  /*
    An offer to open a picture slot has to select that block, and selecting the
    WRONG one is not a near miss -- the customer would replace a picture he
    never meant to touch. So this returns null rather than falling back to the
    root, and these two cases are the difference.
  */
  it("finds a block nested inside a slot, with its zone", () => {
    const nested = walkNodes(page.content).find((n) => n.type !== "SystemShell");
    expect(nested).toBeTruthy();
    const sel = findSelector(page.content, String(nested!.props.id));
    expect(sel).not.toBeNull();
    expect(typeof sel!.index).toBe("number");
    // Everything on a dashboard lives inside the shell's slots, so the zone is
    // never the root one -- if it were, the panel would open on the shell.
    expect(sel!.zone).not.toBe(ROOT_ZONE);
    expect(sel!.zone).toContain(":");
  });

  it("returns null for an id that is not on the page", () => {
    expect(findSelector(page.content, "no-such-block")).toBeNull();
  });
});

describe("move_component into a wrapped page", () => {
  /*
    THE BUG THIS FILE WAS WRITTEN TO CATCH.

    Blocks are not all top-level. Since 2026-08-25 the dashboard wraps them in
    `Panel` (slot `body`) and puts pairs side by side in `Columns`, so on most
    registers the thing the customer names is nested one or two levels down.

    move_component resolved `before_id` with `mainColumn(...).findIndex(...)`,
    which only ever sees the top level -- and when that returned -1 it PUSHED
    THE BLOCK TO THE END. So 「把表格搬到收款进度上面」 answered with 「已把表格
    移到上面了」 while the table travelled to the bottom of the page. Not a
    missed edit: a wrong one, reported as done.

    Found by the other session hitting the identical bug in the click path and
    saying so, not by reading this code.
  */
  const nestedPage = () => {
    const page = buildPageLayout("dashboard", {}, "我", "zh", [], "hearth", null) as unknown as PuckLayout;
    return page;
  };

  it("the fixture really does nest its blocks", () => {
    const page = nestedPage();
    const top = mainColumn(page).map((n) => String(n.props?.id ?? ""));
    const all = walkNodes(page.content).map((n) => String(n.props?.id ?? ""));
    // If this ever stops being true the test below proves nothing, so assert it.
    expect(all.length).toBeGreaterThan(top.length);
  });

  it("moves a block IN FRONT OF a nested target, not to the end", () => {
    const page = nestedPage();
    const ids = walkNodes(page.content)
      .filter((n) => n.type !== "SystemShell" && n.type !== "RailNav")
      .map((n) => String(n.props?.id ?? ""));
    const topIds = new Set(mainColumn(page).map((n) => String(n.props?.id ?? "")));
    // A target that is NOT at the top level -- the case that was broken.
    const nestedTarget = ids.find((id) => id && !topIds.has(id));
    const mover = ids.find((id) => id && id !== nestedTarget);
    expect(nestedTarget).toBeTruthy();
    expect(mover).toBeTruthy();

    const out = applyLayoutOps(page, [
      { op: "move_component", target_id: mover!, before_id: nestedTarget! },
    ] as LayoutOp[]);

    expect(out.applied).toBe(1);
    expect(out.skipped).toEqual([]);

    // The mover must sit immediately before the target, wherever the target
    // lives. Walking order is document order, so adjacency is checkable.
    const order = walkNodes(out.layout.content).map((n) => String(n.props?.id ?? ""));
    expect(order.indexOf(mover!)).toBe(order.indexOf(nestedTarget!) - 1);
  });

  it("adds a block beside a nested anchor, not at the top level", () => {
    const page = nestedPage();
    const topIds = new Set(mainColumn(page).map((n) => String(n.props?.id ?? "")));
    const nestedAnchor = walkNodes(page.content)
      .map((n) => String(n.props?.id ?? ""))
      .find((id) => id && !topIds.has(id));
    expect(nestedAnchor).toBeTruthy();

    const out = applyLayoutOps(page, [
      { op: "add_component", component: "Progress", after_id: nestedAnchor! },
    ] as LayoutOp[]);
    expect(out.applied).toBe(1);

    const added = walkNodes(out.layout.content).find((n) => n.type === "Progress");
    expect(added).toBeTruthy();

    /*
      The assertion that matters: it must NOT have landed in the shell's top
      level. The anchor lives inside a wrapper, so a block placed correctly is
      inside that wrapper too -- and the old code's answer was the bottom of
      the main column, which is exactly what this rules out.
    */
    const topLevelNow = mainColumn(out.layout).map((n) => String(n.props?.id ?? ""));
    expect(topLevelNow).not.toContain(String(added!.props.id));
  });

  it("refuses rather than guessing when before_id is not on the page", () => {
    const page = nestedPage();
    const mover = String(mainColumn(page)[0]?.props?.id ?? "");
    const out = applyLayoutOps(page, [
      { op: "move_component", target_id: mover, before_id: "no-such-block" },
    ] as LayoutOp[]);
    // Silently landing it at the end is how the original bug read as success.
    expect(out.applied).toBe(0);
    expect(out.skipped.length).toBe(1);
  });
});

describe("set_text only writes fields the block actually has", () => {
  /*
    THE ELEVENTH 「说了没做」.

    EDITABLE_TEXT_FIELDS is one global list; the fields are per component. So
    「把第一屏那句大标题改成 X」 wrote `title` onto a SiteHero -- a prop that
    component does not declare and nothing renders -- and came back 「改了 1 处」.
    Found by pressing it in a browser on 2026-08-27; every unit test here
    passed throughout, because they were written against blocks whose text
    really is in `title`.
  */
  it("refuses a field the component does not declare, and says so", () => {
    const layout = {
      content: [{ type: "SiteHero", props: { id: "hero", headline: "兴发装修" } }],
      root: {},
    } as unknown as PuckLayout;
    const r = applyLayoutOps(layout, [
      { op: "set_text", target_id: "hero", field: "title", value: "二十年" },
    ] as never);
    expect(r.applied).toBe(0);
    expect(r.skipped).toHaveLength(1);
    // The refusal has to reach the customer -- a silent drop is what this was
    // already doing, and is indistinguishable from the bug.
    expect(r.skipped[0].reason).toBe("noSuchField");
    expect(r.skipped[0].vars?.field).toBe("title");
  });

  it("still writes the field the block really has", () => {
    const layout = {
      content: [{ type: "SiteHero", props: { id: "hero", headline: "兴发装修" } }],
      root: {},
    } as unknown as PuckLayout;
    const r = applyLayoutOps(layout, [
      { op: "set_text", target_id: "hero", field: "headline", value: "二十年装修经验" },
    ] as never);
    expect(r.applied).toBe(1);
    const hero = (r.layout.content as { props: Record<string, unknown> }[])[0];
    expect(hero.props.headline).toBe("二十年装修经验");
  });
});

describe("every block with words has words the assistant can reach", () => {
  /*
    THE GUARD THAT MAKES THE DERIVATION WORTH HAVING.

    The list used to be eleven names written by hand, and on 2026-08-27 the
    measurement was: 31 components had visible text and NOT ONE reachable field
    -- EnquiryForm among them, the only block on the public site that produces
    money. 「用讲的改」 did nothing on any of them, and looked like it worked
    because the model wrote an undeclared prop and the applier said 「改了」.

    Deriving the list fixes today. This fails the day somebody ships a block
    whose text the assistant cannot name, which is the part that keeps.
  */
  it("no component has visible text and no reachable field", () => {
    const stranded = Object.entries(TEXT_FIELDS_BY_COMPONENT)
      .filter(([name]) => REGISTERED_COMPONENTS.includes(name))
      .filter(([, fields]) => fields.length === 0)
      .map(([name]) => name);
    // A block with NO text fields at all is fine -- a chart, a divider, a
    // photo frame. This only catches text that exists and cannot be spoken to.
    const configs = puckConfig.components as unknown as Record<
      string,
      { fields?: Record<string, { type?: string }> }
    >;
    const withTextButUnreachable = stranded.filter((name) =>
      Object.values(configs[name]?.fields ?? {}).some(
        (f) => f?.type === "text" || f?.type === "textarea",
      ),
    );
    /*
      NAMED, NOT TOLERATED. PayQr's only text input is `data` -- the payload
      encoded into the QR square. There is nothing on that block for a person
      to reword, so it is not stranded, it is finished. Written as a list so
      the NEXT block that arrives with unreachable words fails this test rather
      than joining a silent tolerance.
    */
    const NO_WORDS_ON_PURPOSE = ["PayQr"];
    expect(withTextButUnreachable).toEqual(NO_WORDS_ON_PURPOSE);
  });

  it("reaches the public site's own words, which is where this was found", () => {
    // The h1 on the page the owner sends to people, and the form that is the
    // only thing on it that produces money.
    expect(TEXT_FIELDS_BY_COMPONENT.SiteHero).toContain("headline");
    expect(TEXT_FIELDS_BY_COMPONENT.EnquiryForm).toContain("heading");
    expect(TEXT_FIELDS_BY_COMPONENT.EnquiryForm).toContain("submitLabel");
  });

  it("does not offer a link target as if it were a sentence", () => {
    // 「按钮改成联络我们」 must rewrite the LABEL, never the href beside it.
    expect(TEXT_FIELDS_BY_COMPONENT.SiteCta).toContain("primaryLabel");
    expect(TEXT_FIELDS_BY_COMPONENT.SiteCta).not.toContain("primaryHref");
    expect(EDITABLE_TEXT_FIELDS).not.toContain("href");
  });
});
