import { describe, expect, it } from "vitest";
import { applyLayoutOps } from "@/lib/portal/layout-ops";
import { BLOCK_COPY } from "@/components/blocks";
import type { PuckLayout } from "@/lib/portal/layout-ops";

/**
 * `set_copy` is the op that lets the editor's AI reach the 216 sections pulled
 * from the @7Ovr registry.
 *
 * It cannot be guarded the way `set_text` is. That one validates against a
 * fixed whitelist of prop names — `title`, `subtitle`, `label` — because this
 * repo wrote the blocks and knows their props. These sections were written by
 * somebody else, and their keys are whatever each one happens to carry:
 * `tiers`, `faqs`, `stats`, `chartConfig`. So the guard is a different shape,
 * and this file is what holds it in place:
 *
 *   1. only ever writes into `copy`, never into another prop
 *   2. only ever onto a path the section's OWN defaults already have as a
 *      string — a hallucinated path changes nothing
 *   3. only on a SiteBlock
 *   4. never mutates the defaults object every un-edited copy of that section
 *      is still reading from
 */

const page = (props: Record<string, unknown>): PuckLayout => ({
  root: {},
  content: [{ type: "SiteBlock", props: { id: "s1", ...props } }],
});

describe("set_copy", () => {
  it("writes the customer's words onto a real path", () => {
    const { layout, applied, skipped } = applyLayoutOps(page({ block: "pricing-1" }), [
      { op: "set_copy", target_id: "s1", path: "tiers.0.name", value: "基本配套" },
    ]);
    expect(applied).toBe(1);
    const copy = layout.content[0].props.copy as { tiers: { name: string }[] };
    expect(copy.tiers[0].name).toBe("基本配套");
  });

  it("keeps the rest of the section's own words", () => {
    const { layout } = applyLayoutOps(page({ block: "pricing-1" }), [
      { op: "set_copy", target_id: "s1", path: "tiers.0.name", value: "基本配套" },
    ]);
    const copy = layout.content[0].props.copy as { tiers: { name: string }[] };
    // Everything the section shipped with is still there; only one field moved.
    expect(copy.tiers.length).toBe(BLOCK_COPY["pricing-1"].tiers ? (BLOCK_COPY["pricing-1"].tiers as unknown[]).length : 0);
    expect(copy.tiers[1].name).toBe((BLOCK_COPY["pricing-1"].tiers as { name: string }[])[1].name);
  });

  it("refuses a path the section does not have", () => {
    const { layout, applied, skipped } = applyLayoutOps(page({ block: "pricing-1" }), [
      { op: "set_copy", target_id: "s1", path: "tiers.0.discountPercentage", value: "20" },
    ]);
    expect(applied).toBe(0);
    expect(skipped[0].op).toBe("set_copy");
    expect(layout.content[0].props.copy).toBeUndefined();
  });

  it("refuses a path that exists but is not a string", () => {
    // `tiers` itself is an array. Overwriting it with a sentence would render
    // nothing and report success, which is the worst of both.
    const { applied } = applyLayoutOps(page({ block: "pricing-1" }), [
      { op: "set_copy", target_id: "s1", path: "tiers", value: "我的价钱" },
    ]);
    expect(applied).toBe(0);
  });

  it("refuses a block that carries no copy", () => {
    const { applied } = applyLayoutOps(page({ block: "no-such-section" }), [
      { op: "set_copy", target_id: "s1", path: "tiers.0.name", value: "x" },
    ]);
    expect(applied).toBe(0);
  });

  it("refuses a node that is not a 官网版段", () => {
    const layout: PuckLayout = {
      root: {},
      content: [{ type: "PageHeader", props: { id: "h1", title: "Hi" } }],
    };
    const { applied } = applyLayoutOps(layout, [
      { op: "set_copy", target_id: "h1", path: "tiers.0.name", value: "x" },
    ]);
    expect(applied).toBe(0);
  });

  it("never mutates the defaults every other copy of that section reads", () => {
    const before = JSON.stringify(BLOCK_COPY["pricing-1"]);
    applyLayoutOps(page({ block: "pricing-1" }), [
      { op: "set_copy", target_id: "s1", path: "tiers.0.name", value: "改过的" },
    ]);
    expect(JSON.stringify(BLOCK_COPY["pricing-1"])).toBe(before);
  });

  it("accumulates across two edits to the same section", () => {
    const first = applyLayoutOps(page({ block: "pricing-1" }), [
      { op: "set_copy", target_id: "s1", path: "tiers.0.name", value: "基本" },
    ]);
    const second = applyLayoutOps(first.layout, [
      { op: "set_copy", target_id: "s1", path: "tiers.1.name", value: "全屋" },
    ]);
    const copy = second.layout.content[0].props.copy as { tiers: { name: string }[] };
    expect(copy.tiers[0].name).toBe("基本");
    expect(copy.tiers[1].name).toBe("全屋");
  });
});
