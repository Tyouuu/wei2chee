import { describe, it, expect } from "vitest";
import { relayout, orderFor, ROLE_IDS, KNOWN_ROLES } from "./relayout";
import { buildPageLayout, LAYOUT_SETS, type BusinessContext } from "@/lib/templates/industry-template";
import { mainColumn, walkNodes, type PuckLayout } from "@/lib/portal/layout-ops";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";

/* READ, NOT KEPT. Two hand-written copies of the register list stood here for
   about a minute before style-order.test.ts failed the build over them -- the
   sixth time in this repo that a second copy of a list was written, and the
   sixth time the guard caught it. */
const ALL_STYLES = STYLE_ORDER as readonly string[];

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

const saved = (style: string) =>
  buildPageLayout("dashboard", renovation, "兴发装修", "zh", undefined, style) as unknown as PuckLayout;

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
    const produced = new Set(ids(saved("blueprint")));
    // Not every register's page contains every block, so this asserts the
    // reverse: nothing in the map is a name the builder never emits.
    const built = new Set<string>();
    for (const style of ALL_STYLES) {
      for (const id of ids(saved(style))) built.add(id);
    }
    expect(produced.size).toBeGreaterThan(2);
    /* Only the roles a composition actually USES. `activity` is in
       COMPOSITION_ROLES and no register asks for it, so no dashboard builds
       it -- asserting on the whole map would fail on a role that is simply
       spare rather than on one that is wrong. */
    const used = new Set<string>();
    for (const style of ALL_STYLES) {
      for (const id of orderFor(style, null)) used.add(id);
    }
    expect(used.size).toBeGreaterThan(5);
    for (const id of used) {
      expect(built.has(id), `${id} is ordered but no dashboard builds it`).toBe(true);
    }
  });
});

describe("relayout", () => {
  it("puts the table first for 表格先行", () => {
    /* 台账's composition opens with two NARROW blocks because 台账 has a split
       aside that takes them; applied to a register with no aside, a literal
       copy would put 今天要跟的 first and the table third -- a button lying
       about its own name. orderFor rotates them. */
    const page = saved("hearth");
    const before = ids(page);
    expect(before).toContain("dashboard-recent");

    const after = ids(relayout(page, "hearth", "table"));
    const wanted = orderFor("hearth", "table").filter((id) => before.includes(id));
    expect(wanted[0]).toBe("dashboard-recent");
    // The table is the first of the composition's blocks to appear, wherever
    // its wrapper sits.
    expect(after.filter((id) => wanted.includes(id))[0]).toBe(wanted[0]);
  });

  it("keeps every block, adds none", () => {
    for (const arrangement of Object.keys(LAYOUT_SETS)) {
      const page = saved("hearth");
      const after = relayout(page, "hearth", arrangement);
      expect(ids(after).sort(), arrangement).toEqual(ids(page).sort());
    }
  });

  it("leaves a block the customer added at the end rather than in the middle", () => {
    const page = saved("hearth");
    const column = mainColumn(page);
    column.push({ type: "NoteField", props: { id: "mine", label: "我加的" } } as never);

    const after = topIds(relayout(page, "hearth", "table"));
    expect(after).toContain("mine");
    // Unranked blocks sort after everything the composition names, and the
    // sort is stable, so it stays last rather than being shuffled into an
    // argument it was never part of.
    expect(after[after.length - 1]).toBe("mine");
  });

  it("returns the same object when nothing moved", () => {
    // The guard that stops an identical state being pushed onto the undo
    // stack: pressing the arrangement you are already on must not add a step.
    const page = saved("ledger");
    expect(relayout(page, "ledger", "table")).toBe(page);
  });

  it("does nothing to a page with one block", () => {
    const thin = { root: {}, content: [{ type: "PageHeader", props: { id: "h" } }] } as PuckLayout;
    expect(relayout(thin, "ledger", "table")).toBe(thin);
  });
});
