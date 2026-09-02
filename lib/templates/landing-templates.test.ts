import { describe, it, expect } from "vitest";
import { LANDING_TEMPLATES, landingTemplateFor } from "./landing-templates";
import { ALL_LANDINGS } from "./all-landings";

/**
 * WHICH 官网版面 A BUSINESS ACTUALLY OPENS ON.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * `landingTemplateFor` scans the templates in declaration order and returns the
 * first whose `trades` contains the slug. That is a reasonable-looking rule
 * that quietly killed a template: 上门报价 declared `services` and was declared
 * first, so 明码标价 -- written on 2026-08-31 from five of the nineteen Malaysian
 * SME sites in docs/market-references.json, three of which put the price in
 * their own URL -- was unreachable from the day it shipped. It had a gallery
 * card, a blurb in two languages and a full build function, and no business
 * could ever land on it.
 *
 * That is this repository's signature defect in its template layer: the
 * capability exists, the wire does not. It has now been counted seventeen
 * times. What stops the eighteenth is not remembering -- it is this.
 *
 * ── WHAT IS ASSERTED, AND WHY EACH ONE ────────────────────────────────────
 *
 * A trade may claim exactly ONE template, so declaration order can never
 * decide anything. Every trade the product sells to resolves to a template
 * that really is its own rather than to the fallback by accident. And every
 * template is either somebody's default or has an EMPTY `trades`, which is the
 * one legible way to say 「offered, never defaulted」 -- 一页名片 has no enquiry
 * form, and 官网 → 询价 → 报价单 is the arrow the monthly fee is sold on, so it
 * must never be a default. An empty array with a comment beside it is a
 * decision; an empty array that nothing checks is an oversight nobody can tell
 * apart from a decision.
 */

/** The eight the questionnaire can produce. Written out rather than imported
 *  from the industries table because that table is data and this is the
 *  product's own promise: a business in any of these opens on a page built for
 *  its kind of sale. */
const TRADES = [
  "renovation",
  "services",
  "other",
  "beauty",
  "education",
  "fnb",
  "retail",
  "wholesale",
] as const;

describe("which landing template a trade opens on", () => {
  it("never lets two templates claim the same trade", () => {
    const seen = new Map<string, string>();
    for (const tpl of LANDING_TEMPLATES) {
      for (const trade of tpl.trades) {
        expect(
          seen.get(trade),
          `${trade} is claimed by both ${seen.get(trade)} and ${tpl.key}; ` +
            `declaration order would silently pick one and kill the other`,
        ).toBeUndefined();
        seen.set(trade, tpl.key);
      }
    }
  });

  it("gives every trade a template that actually declares it", () => {
    for (const trade of TRADES) {
      const hit = landingTemplateFor(trade);
      expect(
        hit.trades.includes(trade),
        `${trade} resolved to ${hit.key}, which does not claim it -- it fell ` +
          `through to the fallback, so nothing was built for this trade`,
      ).toBe(true);
    }
  });

  it("leaves no template that nobody can reach and nobody meant to be optional", () => {
    /* Reached BY RESOLUTION, not by reading the array: that is the whole point.
       A template with a trade in its list that resolution never returns is the
       exact failure 明码标价 shipped with. */
    const reached = new Set(TRADES.map((t) => landingTemplateFor(t).key));
    for (const tpl of LANDING_TEMPLATES) {
      if (reached.has(tpl.key)) continue;
      expect(
        tpl.trades,
        `${tpl.key} is nobody's default. If that is deliberate its trades must ` +
          `be empty (gallery-only); a non-empty list that never resolves is dead code`,
      ).toEqual([]);
    }
  });

  it("still offers the gallery-only ones somewhere a customer can find them", () => {
    /* 「Not a default」 must not slide into 「not offered」. The two that carry an
       empty trades list are still cards in 模板库, which is what makes the empty
       array a choice rather than a deletion. */
    const reached = new Set(TRADES.map((t) => landingTemplateFor(t).key));
    const optional = LANDING_TEMPLATES.filter((t) => !reached.has(t.key));
    expect(optional.length, "expected the two written as gallery-only").toBe(2);
    for (const tpl of optional) {
      expect(
        ALL_LANDINGS.some((t) => t.key === tpl.key),
        `${tpl.key} is neither a default nor in the gallery, so nothing can reach it`,
      ).toBe(true);
    }
  });

  it("falls back to 上门报价 for a trade it has never heard of", () => {
    /* The safest wrong answer, and it has to keep being reachable: a lead with
       a null industry is a real state, and the alternative is a page with no
       shape at all. */
    expect(landingTemplateFor(null).key).toBe("quote");
    expect(landingTemplateFor("aquaculture").key).toBe("quote");
  });
});
