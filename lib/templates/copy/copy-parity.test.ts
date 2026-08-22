import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODULE_KEYS, MODULE_CATALOG } from "@/lib/portal/module-catalog";
import { CHROME, INDUSTRY_LABELS_EN, LANDING, _tables } from "./index";

/**
 * The tax on splitting the system's words into one file per language.
 *
 * Every table in this directory exists twice. That is the right shape -- a
 * phrase written for its own language reads better than one translated at
 * render time, and lib/templates/copy/samples.en.ts says why. What it buys is a
 * new failure mode: a trade, a module or a key that exists on one side and not
 * the other, which does not crash and does not fail a type check. It shows up
 * as one page of a customer's system silently in the wrong language, or falling
 * through to the generic set.
 *
 * So the parity is asserted rather than remembered.
 */
describe("the two language tables stay level", () => {
  const { SAMPLES_EN, SAMPLES_ZH, moduleCopyEn, moduleCopyZh } = _tables;

  it("covers the same trades on both sides", () => {
    expect(Object.keys(SAMPLES_EN).sort()).toEqual(Object.keys(SAMPLES_ZH).sort());
  });

  it("covers every trade the database seeds", () => {
    // supabase/seed.sql is the only authority on which trades exist. Reading it
    // rather than re-listing the slugs is what makes a ninth industry a failing
    // test instead of a silent fallback to the generic sample set.
    const seed = readFileSync(
      join(process.cwd(), "supabase", "seed.sql"),
      "utf8",
    );
    const slugs = [...seed.matchAll(/^\('([a-z]+)', '/gm)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(0);

    for (const slug of slugs) {
      // `other` is the one trade with no sample table on purpose: it IS the
      // generic set, and giving it invented records would mean a business that
      // told us nothing gets a page of confidently wrong specifics.
      if (slug !== "other") {
        expect(Object.keys(SAMPLES_ZH), `zh samples missing ${slug}`).toContain(slug);
        expect(Object.keys(SAMPLES_EN), `en samples missing ${slug}`).toContain(slug);
      }
      expect(INDUSTRY_LABELS_EN, `no English nouns for ${slug}`).toHaveProperty(slug);
      expect(LANDING.en.services, `no English services for ${slug}`).toHaveProperty(slug);
      expect(LANDING.zh.services, `no Chinese services for ${slug}`).toHaveProperty(slug);
      expect(LANDING.en.promise, `no English promise for ${slug}`).toHaveProperty(slug);
      expect(LANDING.zh.promise, `no Chinese promise for ${slug}`).toHaveProperty(slug);
      expect(LANDING.en.tradeNoun, `no English trade noun for ${slug}`).toHaveProperty(slug);
      expect(LANDING.en.eyebrowTrade, `no English eyebrow for ${slug}`).toHaveProperty(slug);
      expect(CHROME.en.brand, `no English brand placeholder for ${slug}`).toHaveProperty(slug);
      expect(CHROME.zh.brand, `no Chinese brand placeholder for ${slug}`).toHaveProperty(slug);
    }
  });

  it("fills in the same fields for every module in both languages", () => {
    const labels = { customer: "Customer", order: "Order", staff: "Staff" };
    for (const key of MODULE_KEYS) {
      const en = moduleCopyEn(key, labels);
      const zh = moduleCopyZh(key, labels);
      // Not just the top-level keys: `hero`, `trend`, `upload` and `variance`
      // are what make a ledger page different from a directory page, and one
      // missing on one side is a page that quietly loses its headline figure
      // in one language only.
      expect(Object.keys(en).sort(), `${key} field sets differ`).toEqual(
        Object.keys(zh).sort(),
      );
      expect(Object.keys(en.columns).sort(), `${key} columns differ`).toEqual(
        Object.keys(zh.columns).sort(),
      );
      expect(en.rows.length, `${key} row counts differ`).toBe(zh.rows.length);
      if (en.hero && zh.hero) {
        expect(en.hero.stats.length, `${key} hero stats differ`).toBe(
          zh.hero.stats.length,
        );
      }
      if (en.trend && zh.trend) {
        expect(en.trend.points.length, `${key} trend points differ`).toBe(
          zh.trend.points.length,
        );
      }
    }
  });

  it("gives every archetype an English label", () => {
    for (const archetype of MODULE_CATALOG) {
      expect(archetype.labelEn, `${archetype.key} has no labelEn`).toBeTruthy();
      // The English label must not be the Chinese one copied across, which is
      // what a hurried addition to the catalogue produces.
      expect(/[一-鿿]/.test(archetype.labelEn), `${archetype.key} labelEn is Chinese`).toBe(false);
    }
  });

  it("keeps Chinese out of the English tables entirely", () => {
    // The check that actually catches a half-done translation. One Chinese
    // character anywhere in the English copy is a page that reads as broken to
    // the staff and customers it was switched to English for.
    const han = /[一-鿿]/;
    const labels = { customer: "Customer", order: "Order", staff: "Staff" };

    expect(han.test(JSON.stringify(SAMPLES_EN))).toBe(false);
    expect(han.test(JSON.stringify(CHROME.en))).toBe(false);
    expect(han.test(JSON.stringify(INDUSTRY_LABELS_EN))).toBe(false);
    for (const key of MODULE_KEYS) {
      expect(
        han.test(JSON.stringify(moduleCopyEn(key, labels))),
        `${key} English copy contains Chinese`,
      ).toBe(false);
    }
    // LANDING.en holds functions, which JSON.stringify drops -- so check the
    // data fields by name rather than trusting a stringify of the whole object.
    for (const field of ["services", "promise", "tradeNoun", "eyebrowTrade", "proof", "contact"] as const) {
      expect(
        han.test(JSON.stringify(LANDING.en[field])),
        `LANDING.en.${field} contains Chinese`,
      ).toBe(false);
    }
  });
});
