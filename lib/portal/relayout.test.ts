import { describe, it, expect } from "vitest";
import { relayout, orderFor, ROLE_IDS, KNOWN_ROLES } from "./relayout";
import { buildPageLayout, LAYOUT_SETS, type BusinessContext } from "@/lib/templates/industry-template";
import { mainColumn, walkNodes, type PuckLayout } from "@/lib/portal/layout-ops";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";

/* 🔴 2026-09-04：这份清单本来是**六套风格**，现在是**四种排法**。
   系统收成一套之后（见 lib/portal/system-register.ts），一张工作台长什么样
   不再跟客户挑的风格有关；还会变的只有「你想先看到什么」。
   读的是 LAYOUT_SETS 本人，不是再抄一份 —— 这个仓库栽在第二份手写清单上
   至少六次。 */
const ALL_ARRANGEMENTS = [null, ...Object.keys(LAYOUT_SETS)] as const;

/**
 * 换排法 on a page that is already saved.
 *
 * The bug this covers was invisible in exactly the way this repo keeps being
 * bitten: the buttons wrote the database, lit up, and the page did not move.
 * Nothing threw, nothing logged, and `aria-pressed` said it had worked.
 */

const renovation: BusinessContext = {
  industry: {
    slug: "renovation",
    name_zh: "装修/承包商",
    labels: { customer: "客户", order: "项目", staff: "师傅" },
    default_workflow: ["Customer", "Quotation", "Deposit", "Project"],
    suggested_modules: ["Customer", "Quotation", "Project", "Payment"],
  },
};

const saved = (arrangement: string | null = null) =>
  buildPageLayout(
    "dashboard", renovation, "兴发装修", "zh", undefined, SYSTEM_REGISTER, arrangement,
  ) as unknown as PuckLayout;

/* WALKED, NOT READ OFF THE TOP. A page's blocks are nested -- in a Panel that
   gives a section a surface, or in a Columns that puts two side by side -- so
   the main column holds wrappers and the ids are one or two levels down. The
   first version of this helper read only the top and reported 炉's page as
   four entries with no table on it. */
const ids = (l: PuckLayout) =>
  walkNodes(mainColumn(l)).map((n) => String(n.props?.id ?? ""));
/** Just the top-level entries, for the assertions about ORDER. */
const topIds = (l: PuckLayout) => mainColumn(l).map((n) => String(n.props?.id ?? ""));

describe("the role map stays honest", () => {
  it("has an id for every role a composition can name", () => {
    /* A role added to COMPOSITION_ROLES with no id here would silently mean
       「that block does not move」 -- the same quiet failure the whole file
       exists to remove, one level down. */
    for (const role of KNOWN_ROLES) {
      expect(ROLE_IDS[role as string], `no block id for role "${role}"`).toBeDefined();
    }
  });

  it("names ids the builder actually produces", () => {
    /* THE WHOLE TREE, NOT THE MAIN COLUMN, and the cull is what exposed it.

       `ids()` walks mainColumn because the ORDER assertions below are about
       the main column. This question is different -- 「does the builder ever
       emit this id」 -- and 台账 is a SPLIT register whose aside takes the
       narrow blocks off the front of the stack, so `dashboard-ranking` is
       built and lives outside the column this helper reads.

       It passed for months because some non-split register also emitted
       ranking. On 2026-08-27 the library went from fourteen registers to six,
       台账 became the only one that orders it, and the ruler started reporting
       that nothing builds a block it builds on every renovation dashboard. */
    const anywhere = (arrangement: string | null) =>
      walkNodes((saved(arrangement).content ?? []) as never).map((n) => String(n.props?.id ?? ""));
    const produced = new Set(anywhere("table"));
    // Not every register's page contains every block, so this asserts the
    // reverse: nothing in the map is a name the builder never emits.
    const built = new Set<string>();
    for (const arrangement of ALL_ARRANGEMENTS) {
      for (const id of anywhere(arrangement)) built.add(id);
    }
    expect(produced.size).toBeGreaterThan(2);
    /* Only the roles a composition actually USES. `activity` is in
       COMPOSITION_ROLES and no register asks for it, so no dashboard builds
       it -- asserting on the whole map would fail on a role that is simply
       spare rather than on one that is wrong. */
    const used = new Set<string>();
    for (const arrangement of ALL_ARRANGEMENTS) {
      for (const id of orderFor(arrangement)) used.add(id);
    }
    expect(used.size).toBeGreaterThan(5);
    for (const id of used) {
      expect(built.has(id), `${id} is ordered but no dashboard builds it`).toBe(true);
    }
  });
});

describe("relayout", () => {
  it("puts the table first for 表格先行", () => {
    /* 「表格先行」这四个字就是这颗按钮的全部承诺。以前它靠 orderFor 在执行时
       把两块窄的转到后面才做到；现在那个顺序直接写在排法表里
       （见 DASHBOARD_COMPOSITION 的注解）。两种做法要给同一个答案。 */
    const page = saved();
    const before = ids(page);
    expect(before).toContain("dashboard-recent");

    const after = ids(relayout(page, "table"));
    const wanted = orderFor("table").filter((id) => before.includes(id));
    expect(wanted[0]).toBe("dashboard-recent");
    // The table is the first of the composition's blocks to appear, wherever
    // its wrapper sits.
    expect(after.filter((id) => wanted.includes(id))[0]).toBe(wanted[0]);
  });

  it("keeps every block, adds none", () => {
    for (const arrangement of Object.keys(LAYOUT_SETS)) {
      const page = saved();
      const after = relayout(page, arrangement);
      expect(ids(after).sort(), arrangement).toEqual(ids(page).sort());
    }
  });

  it("leaves a block the customer added at the end rather than in the middle", () => {
    const page = saved();
    const column = mainColumn(page);
    column.push({ type: "NoteField", props: { id: "mine", label: "我加的" } } as never);

    const after = topIds(relayout(page, "table"));
    expect(after).toContain("mine");
    // Unranked blocks sort after everything the composition names, and the
    // sort is stable, so it stays last rather than being shuffled into an
    // argument it was never part of.
    expect(after[after.length - 1]).toBe("mine");
  });

  it("returns the same object when nothing moved", () => {
    // The guard that stops an identical state being pushed onto the undo
    // stack: pressing the arrangement you are already on must not add a step.
    const page = saved("table");
    expect(relayout(page, "table")).toBe(page);
  });

  it("does nothing to a page with one block", () => {
    const thin = { root: {}, content: [{ type: "PageHeader", props: { id: "h" } }] } as PuckLayout;
    expect(relayout(thin, "table")).toBe(thin);
  });
});
