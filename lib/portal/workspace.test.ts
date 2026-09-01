import { describe, it, expect } from "vitest";
import { canOpenModule, hideMoneyFromRail } from "./workspace";
import { MODULE_BY_KEY } from "./module-catalog";
import { modulesOfShape } from "./shape-state";

/**
 * 谁看得到钱 — the presentation half, guarded.
 *
 * The enforcement is RLS (`sees_money()`), proven against the live database by
 * `npm run check:staff`. These are the two pure functions that decide what a
 * 师傅 is OFFERED, and they exist because an empty 收款 page is a worse answer
 * than an absent one: it says 「the boss has taken no money」 rather than
 * 「this is not yours to see」.
 */

describe("canOpenModule", () => {
  it("keeps every money module away from a 师傅", () => {
    /* ⚠️ Read from the catalogue's own shape, never from a list written here.
       佣金 was added to the ledger shape after 收款 and 开销, and a second
       hand-kept list is how this repository has gone stale four times: the
       register list, the palette list, the page list and the text-field list.
       A money module catalogued next month fails this test on the day it is
       catalogued, which is the point. */
    const money = modulesOfShape("ledger");
    expect(money.length).toBeGreaterThan(0);
    for (const key of money) {
      expect(canOpenModule("staff", key), key).toBe(false);
      expect(canOpenModule("owner", key), key).toBe(true);
    }
  });

  it("lets him open the work", () => {
    for (const key of [...modulesOfShape("pipeline"), ...modulesOfShape("directory")]) {
      expect(canOpenModule("staff", key), key).toBe(true);
    }
  });

  it("refuses nothing the owner asks for", () => {
    for (const key of Object.keys(MODULE_BY_KEY)) {
      expect(canOpenModule("owner", key), key).toBe(true);
    }
  });

  it("does not refuse a page it has never heard of", () => {
    /* A page the owner added himself has no catalogue entry and no shape. It
       is not money, so it is his supervisor's to open -- refusing by default
       would hide a page from the person it was added for. */
    expect(canOpenModule("staff", "my-own-page")).toBe(true);
  });
});

describe("hideMoneyFromRail", () => {
  const tree = {
    content: [
      {
        type: "RailNav",
        props: {
          brandLabel: "兴发装修工程",
          items: [
            { label: "Overview", href: "/en/portal/dashboard" },
            { label: "Quotations", href: "/en/portal/quotations" },
            { label: "Payments", href: "/en/portal/payments" },
            { label: "Clients", href: "/en/portal/customers" },
            { label: "Notifications" },
          ],
        },
      },
      { type: "RecordTable", props: { rows: [{ cells: { primary: "Mr Tan" } }] } },
    ],
    root: {},
  };

  const railOf = (t: typeof tree) =>
    (t.content[0].props.items ?? []).map((i: { href?: string }) => i.href);

  it("takes the money rows out for a 师傅", () => {
    const out = hideMoneyFromRail(tree, "staff");
    expect(railOf(out)).toEqual([
      "/en/portal/dashboard",
      "/en/portal/quotations",
      "/en/portal/customers",
      undefined,
    ]);
  });

  it("keeps a row that has no href at all", () => {
    /* 通知 and 账号设置 are written into every rail deliberately WITHOUT one --
       they are part of the system the owner is designing, not links. Dropping
       them would silently redesign his page. */
    const out = hideMoneyFromRail(tree, "staff");
    expect(out.content[0].props.items).toHaveLength(4);
  });

  it("changes nothing at all for the owner", () => {
    expect(hideMoneyFromRail(tree, "owner")).toBe(tree);
  });

  it("leaves the rest of the page exactly as it was", () => {
    const out = hideMoneyFromRail(tree, "staff");
    expect(out.content[1]).toEqual(tree.content[0 + 1]);
    expect(out.content[0].props.brandLabel).toBe("兴发装修工程");
  });

  it("does not mutate the tree it was given", () => {
    const before = JSON.stringify(tree);
    hideMoneyFromRail(tree, "staff");
    expect(JSON.stringify(tree)).toBe(before);
  });

  it("reaches a rail nested inside a zone", () => {
    /* A saved page keeps its blocks under `zones`, not in `content`. Walking
       only the top level would have left every SAVED page's rail untouched --
       which is every page the owner has actually worked on. */
    const nested = { content: [], zones: { "shell:main": [tree.content[0]] }, root: {} };
    const out = hideMoneyFromRail(nested, "staff") as typeof nested & {
      zones: { "shell:main": { props: { items: { href?: string }[] } }[] };
    };
    expect(out.zones["shell:main"][0].props.items.map((i) => i.href)).not.toContain(
      "/en/portal/payments",
    );
  });
});
