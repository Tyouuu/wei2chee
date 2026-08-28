import { describe, expect, it } from "vitest";
import { isNotAPhotographOfABusiness, similarQuery } from "@/lib/images/photo-words";
import { TRADE_QUERIES, TRADE_QUERY } from "@/lib/images/stock";

/**
 * 这两条规则是量出来的，不是想出来的 —— 所以测试也拿量到的那些字串来考。
 *
 * Every string below is a REAL `tags` or `alt` value pulled from Pixabay or
 * Pexels on 2026-08-28, not something invented to make a rule look good. The
 * rule was cut to fit these, and if somebody widens it later these are what
 * says whether the widening cost more than it bought.
 */

describe("isNotAPhotographOfABusiness", () => {
  /* The classes it exists to remove: a render, a swatch, a toy, a cut-out, and
     an image whose own uploader declared it generated. */
  it.each([
    ["template, tile, floor, wood tile, wood, structure, pattern", "a tiling template"],
    ["planer, wood planer, carpenter, tool, wood, isolated", "a tool cut out on white"],
    ["ai generated, hair salon, hairdresser, haircut, woman, model", "declared AI"],
    ["miniature, stores, building, model, architecture, street", "a model village"],
    ["thailand, statuette, figurine, buddha", "figurines"],
    ["houseoffanusta, interior design, wall, mockup", "a mockup"],
    ["pallet, goods, cargo, 3d render, wood", "a 3d render"],
  ])("removes %s (%s)", (tags) => {
    expect(isNotAPhotographOfABusiness(tags)).toBe(true);
  });

  /**
   * The far more important half. A filter that quietly eats a real
   * contractor's photograph is worse than no filter, and the first draft of
   * this rule did exactly that twice.
   *
   * 「rendering」 is the one that nearly shipped: in this trade CEMENT RENDERING
   * IS A JOB, so the word sits on precisely the plasterer's photographs a
   * renovation contractor most wants to find. It cost two computer-generated
   * pallets out of 1,186 results to give the word up.
   *
   * The SEO words are the other half. Pixabay uploaders write 「background」 and
   * 「wallpaper」 for search traffic, and 52 more photographs carry them —
   * roughly half of those are real: a mechanic lifting an engine, two women in
   * a coffee shop, a painter with a scraper. That is why the list stops where
   * it does and is not a general blocklist.
   */
  it.each([
    ["cement rendering, wall, plaster, contractor", "rendering is a real trade word"],
    ["toyota, showroom, car, dealership", "toy is inside Toyota"],
    ["hair salon, interior, background, wallpaper", "SEO words on a real salon"],
    ["mechanic, car, garage, auto shop, wallpaper", "SEO words on a real workshop"],
    ["floor, ceramic, tile, flooring, interior, home, design", "the green mosaic SWATCH — no rule catches it"],
    ["handyman, construction site, workers, force, characters", "the plastic figurines — no rule catches it either"],
    ["", "nothing at all"],
  ])("keeps %s (%s)", (tags) => {
    expect(isNotAPhotographOfABusiness(tags)).toBe(false);
  });
});

describe("similarQuery", () => {
  /* PEXELS writes sentences, and English puts the head noun at the END of a
     phrase — so a caption is cut at its first comma or preposition and read
     from the back. */
  it.each([
    ["A construction worker lays tiles in an indoor renovation project", "construction worker lays tiles"],
    ["Detailed view of gloved hand aligning tiles with levelers and spacers", "gloved hand aligning tiles"],
    ["A technician skillfully repairing an outdoor air conditioner unit", "outdoor air conditioner unit"],
    ["Wide view of an organized industrial warehouse with tall shelves", "wide organized industrial warehouse"],
  ])("reads a Pexels caption from its subject: %s", (alt, expected) => {
    expect(similarQuery(alt, "pexels")).toBe(expected);
  });

  it("cuts a caption where it stops describing the subject", () => {
    /* The first version took the FRONT of this and produced 「renovating room
       ladder applying」, which was photographed returning apple trees, an olive
       grove and a makeup artist — 「applying」 belongs to as many makeup
       photographs as building ones. */
    expect(similarQuery("Two men renovating a room, one on a ladder applying plaster", "pexels"))
      .toBe("renovating room");
  });

  it("reads a Pixabay tag list from the front, where its uploader put the subject", () => {
    // Pixabay repeats its own tags for weight: 「curry, curry, curry, curry」.
    expect(similarQuery("curry, malay, asian, food, plate, restaurant, curry, curry", "pixabay"))
      .toBe("curry malay asian food");
    expect(similarQuery("paint, interior paint, paint bucket, plastering, colour, wall", "pixabay"))
      .toBe("paint interior bucket plastering");
  });

  it("gives nothing back when there is nothing to seed with", () => {
    // The button is not rendered in this case — a control that does nothing
    // when pressed is worse than one that is not there.
    expect(similarQuery("a the of on", "pexels")).toBe("");
    expect(similarQuery(undefined, "pixabay")).toBe("");
  });
});

describe("the words each trade opens with", () => {
  /* The opening word decides the whole grid, so the two facts that make that
     true are held here: the trade lists exist for every trade the picker can
     be handed, and the opening guess really is the first of them. */
  it("offers four candidates for every trade, and opens with the first", () => {
    for (const [trade, list] of Object.entries(TRADE_QUERIES)) {
      expect(list, trade).toHaveLength(4);
      expect(new Set(list).size, `${trade} repeats a word`).toBe(4);
      expect(TRADE_QUERY[trade], trade).toBe(list[0]);
    }
  });

  /**
   * The measured failures, kept as a guard.
   *
   * Each of these was the opening word for its trade until 2026-08-28, and
   * each one was photographed doing something specific and wrong: 「stock」 is
   * inventory AND the share market, so a wholesaler was shown a price chart;
   * 「tiles floor installation」 is a materials-photography subject, so a
   * renovator was shown four fluorescent mosaic swatches. Nothing stops the
   * next person reinstating them from a desk except a test that remembers.
   */
  it.each([
    ["wholesale", "warehouse shelves stock", "「stock」 also means the share market"],
    ["renovation", "tiles floor installation", "returns mosaic SWATCHES, not rooms"],
    ["other", "small business shop", "returns a miniature model village"],
  ])("%s no longer opens with 「%s」 — %s", (trade, retired) => {
    expect(TRADE_QUERIES[trade][0]).not.toBe(retired);
  });
});
