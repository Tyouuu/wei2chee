import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { Data } from "@puckeditor/core";
import {
  ALWAYS_MODULES,
  MAX_MODULES,
  MODULE_BY_KEY,
  MODULE_CATALOG,
  MODULE_KEYS,
  catalogForPrompt,
  defaultModulesForIndustry,
  defaultRecommendations,
  normalizeModules,
} from "./module-catalog";
import { buildPageLayout } from "@/lib/templates/industry-template";

const content = (data: Data) => (data as unknown as { content: unknown[] }).content;

describe("the catalogue itself", () => {
  it("has no duplicate keys", () => {
    expect(new Set(MODULE_KEYS).size).toBe(MODULE_KEYS.length);
  });

  it("gives every module a label, a blurb and a shape", () => {
    for (const m of MODULE_CATALOG) {
      expect(m.label.length, m.key).toBeGreaterThan(0);
      expect(m.blurb.length, m.key).toBeGreaterThan(10);
      expect(m.shape.length, m.key).toBeGreaterThan(0);
    }
  });

  /**
   * The one that matters most. A key the provisioning trigger can write but
   * nothing can build renders as a blank canvas for a paying customer -- the
   * single failure the whole templates module exists to prevent. Catching it
   * here rather than in production is the entire reason this file exists.
   */
  it("can build a real page for every key in the catalogue", () => {
    for (const key of MODULE_KEYS) {
      const built = buildPageLayout(key, {}, "我的生意", "zh", [{ key }]);
      expect(content(built).length, `${key} built nothing`).toBeGreaterThan(0);
    }
  });

  it("builds pages that are not all the same generic table", () => {
    // Two different money modules must not produce identical layouts -- if they
    // do, `moduleCopy` is missing an arm and the shape is showing through.
    const a = JSON.stringify(buildPageLayout("reconciliation", {}, "x", "zh", [{ key: "reconciliation" }]));
    const b = JSON.stringify(buildPageLayout("commission", {}, "x", "zh", [{ key: "commission" }]));
    expect(a).not.toEqual(b);
    expect(a).toContain("对账");
    expect(b).toContain("佣金");
  });

  it("names the always-on three and no others", () => {
    expect(ALWAYS_MODULES).toEqual(["dashboard", "customers", "payments"]);
  });

  it("puts both the free and the choosable modules in the prompt", () => {
    const prompt = catalogForPrompt();
    for (const key of MODULE_KEYS) expect(prompt, key).toContain(key);
    expect(prompt).toContain("ALREADY INCLUDED");
    expect(prompt).toContain("CHOOSE FROM");
  });
});

describe("normalizeModules", () => {
  it("always returns the three every system gets, even from an empty answer", () => {
    const out = normalizeModules([]);
    expect(out.map((m) => m.key)).toEqual(["dashboard", "customers", "payments"]);
  });

  it("drops keys that are not in the catalogue", () => {
    const out = normalizeModules([{ key: "crm", label: "CRM", why: "x" }]);
    expect(out.map((m) => m.key)).not.toContain("crm");
  });

  it("collapses duplicates", () => {
    const out = normalizeModules([
      { key: "reports", label: "报表", why: "a" },
      { key: "reports", label: "月报", why: "b" },
    ]);
    expect(out.filter((m) => m.key === "reports")).toHaveLength(1);
  });

  it("caps the set, because a system with eleven pages on day one gets closed", () => {
    const out = normalizeModules(MODULE_KEYS.map((key) => ({ key, label: "x", why: "y" })));
    expect(out.length).toBeLessThanOrEqual(MAX_MODULES);
  });

  it("keeps the business's own noun for an always-on module", () => {
    // The whole point: a SIM-card master dealer's `customers` page is 经销商.
    const out = normalizeModules([{ key: "customers", label: "经销商", why: "只跟经销商做" }]);
    expect(out.find((m) => m.key === "customers")?.label).toBe("经销商");
  });

  it("falls back to the catalogue label when the model gave none", () => {
    const out = normalizeModules([{ key: "ranking", label: "  ", why: "" }]);
    expect(out.find((m) => m.key === "ranking")?.label).toBe(MODULE_BY_KEY.ranking.label);
  });

  it("returns catalogue order regardless of the order the model listed them", () => {
    const out = normalizeModules([
      { key: "inventory", label: "库存", why: "a" },
      { key: "quotations", label: "报价", why: "b" },
    ]);
    const rank = out.map((m) => MODULE_KEYS.indexOf(m.key));
    expect(rank).toEqual([...rank].sort((x, y) => x - y));
  });

  it("survives the shapes a model actually gets wrong", () => {
    expect(() => normalizeModules(null)).not.toThrow();
    expect(() => normalizeModules("reports")).not.toThrow();
    expect(() => normalizeModules([null, 7, { nope: true }])).not.toThrow();
    expect(normalizeModules([null, 7]).length).toBe(ALWAYS_MODULES.length);
  });
});

describe("the default sets, which are the floor when nothing was analysed", () => {
  it("gives an unknown trade the general-purpose set", () => {
    expect(defaultModulesForIndustry("no-such-trade")).toEqual(defaultModulesForIndustry(null));
  });

  it("always includes the always-on three", () => {
    for (const slug of ["beauty", "retail", "wholesale", "renovation", null]) {
      const set = defaultModulesForIndustry(slug);
      for (const key of ALWAYS_MODULES) expect(set, `${slug}`).toContain(key);
    }
  });

  it("names every default module in the catalogue", () => {
    for (const slug of Object.keys({ beauty: 1, education: 1, fnb: 1, retail: 1, wholesale: 1, renovation: 1, services: 1, other: 1 })) {
      for (const key of defaultModulesForIndustry(slug)) {
        expect(MODULE_KEYS, `${slug} wants unknown module ${key}`).toContain(key);
      }
    }
  });

  it("gives no reason for a fallback recommendation, rather than inventing one", () => {
    for (const m of defaultRecommendations("renovation")) expect(m.why).toBe("");
  });
});

/**
 * The catalogue exists in two languages -- TypeScript here and SQL in the
 * migration the signup trigger runs -- and nothing forces them to agree. They
 * have to, because the trigger writes `page_key` values the check constraint
 * has to accept and this module has to be able to build.
 */
describe("the SQL mirror", () => {
  const dir = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .find((f) => readFileSync(join(dir, f), "utf8").includes("function public.module_rank"))!;
  const sql = readFileSync(join(dir, file), "utf8");

  it("orders modules the same way in SQL as in TypeScript", () => {
    const arr = sql.slice(sql.indexOf("function public.module_rank"));
    const body = arr.slice(arr.indexOf("array["), arr.indexOf("]", arr.indexOf("array[")));
    const keys = [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(keys).toEqual(MODULE_KEYS);
  });

  it("lets the check constraint accept every key the catalogue can produce", () => {
    const check = sql.slice(sql.indexOf("project_pages_page_key_check"), sql.indexOf("module_rank"));
    for (const key of MODULE_KEYS) expect(check, `constraint rejects ${key}`).toContain(`'${key}'`);
  });

  it("lets a customer add every module type back after deleting it", () => {
    const add = sql.slice(sql.indexOf("function public.add_project_page"));
    for (const key of MODULE_KEYS) expect(add, `cannot re-add ${key}`).toContain(`'${key}'`);
  });
});
