import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PAGE_KEYS,
  PAGES_FOR_INDUSTRY,
  buildPageLayout,
  isUngeneratedLayout,
  pagesForIndustry,
  type BusinessContext,
  type PageKey,
} from "./industry-template";
import { puckConfig } from "@/design-system/editor/puck-config";

const renovation: BusinessContext = {
  industry: {
    slug: "renovation",
    name_zh: "装修/承包商",
    labels: { customer: "客户", order: "项目", staff: "师傅" },
    default_workflow: ["Customer", "Quotation", "Approval", "Deposit", "Project", "Final Payment"],
    suggested_modules: ["Customer", "Quotation", "Project", "Payment"],
  },
  analysis: {
    summary: "你的报价到收订金之间拖太久了。",
    after_workflow: ["客户", "报价", "订金", "施工", "尾款"],
    bottlenecks: [{ title: "报价追不动", description: "发出去就没下文" }],
  },
};

type Node = { type: string; props: Record<string, unknown> };

/** A page is one SystemShell wrapping two slots (see buildPageLayout). These
 *  assertions are about what the customer ends up looking at, so they walk into
 *  the slots rather than stopping at the shell. */
function flatten(nodes: Node[]): Node[] {
  return nodes.flatMap((n) => {
    const nested = ["sidebar", "main"].flatMap((slot) =>
      Array.isArray(n.props[slot]) ? flatten(n.props[slot] as Node[]) : [],
    );
    return [n, ...nested];
  });
}

const layoutOf = (ctx: BusinessContext, key: (typeof PAGE_KEYS)[number], locale?: string) =>
  buildPageLayout(key, ctx, "我的生意", locale) as unknown as { content: Node[] };

const contentOf = (ctx: BusinessContext, key: (typeof PAGE_KEYS)[number], locale?: string) =>
  flatten(layoutOf(ctx, key, locale).content);

describe("buildPageLayout", () => {
  it("builds every one of the five pages with real content", () => {
    for (const key of PAGE_KEYS) {
      const content = contentOf(renovation, key);
      expect(content.length, `${key} should not be empty`).toBeGreaterThan(2);
    }
  });

  // The single most important guarantee in this file. A template that names a
  // component the editor does not have renders as a blank slot for a paying
  // customer -- and because the templates are built in code rather than
  // returned by a model, that failure is entirely preventable HERE.
  it("only ever emits components the Puck editor actually has registered", () => {
    const registered = new Set(Object.keys(puckConfig.components));
    for (const key of PAGE_KEYS) {
      for (const node of contentOf(renovation, key)) {
        expect(registered, `${key} uses unregistered component ${node.type}`).toContain(node.type);
      }
    }
  });

  // Puck reserves `id` on every component's props and uses it for selection,
  // drag targets and undo history. Two nodes sharing one id makes the editor
  // select the wrong thing.
  it("gives every component a unique id within its page", () => {
    for (const key of PAGE_KEYS) {
      const ids = contentOf(renovation, key).map((n) => n.props.id);
      expect(new Set(ids).size, `${key} has duplicate ids`).toBe(ids.length);
    }
  });

  it("uses the business's own vocabulary rather than generic nouns", () => {
    const json = JSON.stringify(contentOf(renovation, "projects"));
    // "项目" and "师傅" are this industry's words for order and staff; a
    // template still saying "订单"/"员工" here would mean labels never reached
    // the layout at all.
    expect(json).toContain("项目");
    expect(json).toContain("师傅");
  });

  it("puts the AI's own summary on the first screen the customer sees", () => {
    const header = contentOf(renovation, "dashboard").find((n) => n.type === "PageHeader");
    expect(header?.props.subtitle).toBe("你的报价到收订金之间拖太久了。");
  });

  it("puts the AI's recommended workflow into the pipeline component", () => {
    const strip = contentOf(renovation, "dashboard").find((n) => n.type === "WorkflowStrip");
    const stages = (strip?.props.stages as { label: string }[]).map((s) => s.label);
    expect(stages).toEqual(["客户", "报价", "订金", "施工", "尾款"]);
  });

  it("falls back to the industry's own workflow, translated, with no analysis", () => {
    const noAnalysis: BusinessContext = { industry: renovation.industry, analysis: null };
    const strip = contentOf(noAnalysis, "dashboard").find((n) => n.type === "WorkflowStrip");
    const stages = (strip?.props.stages as { label: string }[]).map((s) => s.label);
    expect(stages).toEqual(["客户", "报价", "确认", "订金", "施工", "尾款"]);
  });

  // The case that matters most for not repeating the original bug: someone who
  // signed up without ever answering the questionnaire must still get a
  // working system, never a blank canvas.
  it("still produces a complete system with no context at all", () => {
    for (const key of PAGE_KEYS) {
      const content = contentOf({}, key);
      expect(content.length, `${key} should not be empty`).toBeGreaterThan(2);
      expect(content.some((n) => n.type === "RecordTable")).toBe(true);
    }
  });

  it("gives every page the same navigation, so the five read as one system", () => {
    for (const key of PAGE_KEYS) {
      const rail = contentOf(renovation, key).find((n) => n.type === "RailNav");
      expect(rail, `${key} has no RailNav`).toBeDefined();
      expect((rail!.props.items as unknown[]).length).toBe(5);
    }
  });

  // RailNav has no `active` prop -- it matches `usePathname()` against each
  // item's href, so a template emitting unprefixed hrefs highlights nothing.
  it("emits locale-prefixed hrefs so the current page highlights", () => {
    const rail = contentOf(renovation, "dashboard", "en").find((n) => n.type === "RailNav");
    const hrefs = (rail!.props.items as { href: string }[]).map((i) => i.href);
    expect(hrefs).toContain("/en/portal/customers");
  });

  // The regression this shell exists to prevent: a full-height RailNav sitting
  // in the same vertical stack as the page content pushes that content a whole
  // screen below the fold.
  it("wraps every page in one shell, with the nav in the sidebar slot", () => {
    for (const key of PAGE_KEYS) {
      const top = layoutOf(renovation, key).content;
      expect(top, key).toHaveLength(1);
      expect(top[0].type).toBe("SystemShell");
      const sidebar = top[0].props.sidebar as Node[];
      expect(sidebar.map((n) => n.type), key).toEqual(["RailNav"]);
      expect((top[0].props.main as Node[]).some((n) => n.type === "RailNav")).toBe(false);
    }
  });
});

describe("isUngeneratedLayout", () => {
  it("treats the trigger's empty default as never generated", () => {
    expect(isUngeneratedLayout({})).toBe(true);
    expect(isUngeneratedLayout(null)).toBe(true);
  });

  // A customer who deliberately deleted every block has a page with an EMPTY
  // content array. Regenerating the template over that would silently undo
  // their deletion on every reload.
  it("treats a deliberately emptied page as already generated", () => {
    expect(isUngeneratedLayout({ root: {}, content: [] })).toBe(false);
  });
});

/**
 * Pages are provisioned per industry by a SQL function the signup trigger calls
 * (`pages_for_industry`, migration 20260820160000), while this module builds
 * their CONTENT from a TypeScript copy of the same mapping. Two copies of one
 * decision, in two languages, that nothing forces to agree.
 *
 * The failure is silent and bad: a page the trigger creates but this module
 * cannot build renders as an empty canvas for a paying customer -- the exact
 * bug the whole templates module exists to prevent. So the SQL is parsed and
 * compared here.
 */
describe("per-industry page sets", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "20260820160000_pages_per_industry.sql"),
    "utf8",
  );

  /** Pulls `when 'slug' then array['a','b']` pairs out of the SQL function. */
  function sqlMapping(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    const re = /when\s+'([a-z]+)'\s+then\s+array\[([^\]]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      out[m[1]] = m[2].split(",").map((v) => v.trim().replace(/'/g, ""));
    }
    return out;
  }

  it("extracts a non-trivial mapping from the migration", () => {
    // Guards the regex itself: if it ever stopped matching, the comparison
    // below would pass vacuously against an empty object.
    expect(Object.keys(sqlMapping()).length).toBeGreaterThanOrEqual(5);
  });

  it("agrees with the SQL function the signup trigger actually uses", () => {
    for (const [slug, keys] of Object.entries(sqlMapping())) {
      expect(PAGES_FOR_INDUSTRY[slug], `mapping for ${slug}`).toEqual(keys);
    }
  });

  it("falls back to the general set for an unknown or missing industry", () => {
    expect(pagesForIndustry("no-such-trade")).toEqual(pagesForIndustry(null));
    expect(pagesForIndustry(undefined)).toContain("dashboard");
  });

  it("can build every page it claims a trade should have", () => {
    for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
      for (const key of keys) {
        expect(PAGE_KEYS, `${slug} wants unbuildable page ${key}`).toContain(key);
        const built = buildPageLayout(key, { industry: { ...renovation.industry!, slug } });
        const content = (built as unknown as { content: Node[] }).content;
        expect(content.length, `${slug}/${key}`).toBeGreaterThan(0);
      }
    }
  });

  // A salon shown a link to a 报价单 page its account does not have is a 404
  // waiting to happen, and reads as the product not knowing its own shape.
  it("never links the nav to a page the business does not have", () => {
    for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
      const ctx: BusinessContext = { industry: { ...renovation.industry!, slug } };
      const rail = contentOf(ctx, keys[0]).find((n) => n.type === "RailNav");
      const linked = (rail!.props.items as { href: string }[]).map(
        (i) => i.href.split("/").pop() as PageKey,
      );
      expect(linked.sort(), slug).toEqual([...keys].sort());
    }
  });

  it("gives appointment-led trades a bookings page and no quotations page", () => {
    for (const slug of ["beauty", "education"]) {
      expect(PAGES_FOR_INDUSTRY[slug]).toContain("bookings");
      expect(PAGES_FOR_INDUSTRY[slug]).not.toContain("quotations");
      expect(PAGES_FOR_INDUSTRY[slug]).not.toContain("projects");
    }
  });

  it("gives transaction-led trades an orders page and no projects page", () => {
    for (const slug of ["retail", "fnb"]) {
      expect(PAGES_FOR_INDUSTRY[slug]).toContain("orders");
      expect(PAGES_FOR_INDUSTRY[slug]).not.toContain("projects");
    }
  });
});
