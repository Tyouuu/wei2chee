import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_KEYS } from "@/lib/portal/module-catalog";
import { SALON_NAV, salonRowVisible, type SalonNavContext } from "./salon-nav";

const BEAUTY = ["dashboard", "customers", "bookings", "payments", "expenses", "staff", "inventory", "website"];
const owner = (pageKeys: string[]): SalonNavContext => ({ pageKeys, isOwner: true });
const staff = (pageKeys: string[]): SalonNavContext => ({ pageKeys, isOwner: false });
const shown = (ctx: SalonNavContext | null, active?: string) =>
  Object.keys(SALON_NAV).filter((k) => salonRowVisible(k, ctx, active));

describe("the salon sidebar reads the business's own pages", () => {
  it("the default salon set shows every row to its owner (nothing was lost)", () => {
    expect(shown(owner(BEAUTY))).toHaveLength(Object.keys(SALON_NAV).length);
  });

  it("a page the business does not keep takes its row away, and only its row", () => {
    const noStock = shown(owner(BEAUTY.filter((k) => k !== "inventory")));
    expect(noStock).not.toContain("salon-stock-and-orders");
    expect(noStock).toContain("stylists-and-staff");
    expect(noStock).toHaveLength(Object.keys(SALON_NAV).length - 1);
  });

  it("no bookings page: the schedule goes, but Packages & Plans stays (a monthly fee is still collected)", () => {
    const rows = shown(owner(BEAUTY.filter((k) => k !== "bookings")));
    expect(rows).not.toContain("appointments-and-flow");
    expect(rows).toContain("packages-and-prepaid");
  });

  it("Packages & Plans is one row: it needs customers, and bookings OR payments", () => {
    const rule = SALON_NAV["packages-and-prepaid"];
    expect(rule.needs).toEqual(["customers"]);
    expect(rule.needsAny).toEqual(["bookings", "payments"]);
    // neither a place to use a pass nor a place to collect a fee: nothing to show
    const rows = shown(owner(BEAUTY.filter((k) => k !== "bookings" && k !== "payments")));
    expect(rows).not.toContain("packages-and-prepaid");
    // no clients: no passes to sell
    expect(shown(owner(BEAUTY.filter((k) => k !== "customers")))).not.toContain("packages-and-prepaid");
  });

  it("memberships and the audit log are not sidebar rows any more (they live inside other places)", () => {
    expect(SALON_NAV).not.toHaveProperty("memberships-and-loyalty");
    expect(SALON_NAV).not.toHaveProperty("system-audit-log");
  });

  it("a cashier does not get the rows that lead to money or history", () => {
    const rows = shown(staff(BEAUTY));
    for (const k of ["reports-and-rankings", "end-of-day-cash", "invoices-and-terminal", "tenant-settings"]) {
      expect(rows).not.toContain(k);
    }
    // but the day's work is all still there
    for (const k of ["overview", "appointments-and-flow", "register-and-checkout", "clients-and-profiles", "salon-stock-and-orders", "stylists-and-staff", "packages-and-prepaid"]) {
      expect(rows).toContain(k);
    }
  });

  it("More Tools is for everybody: a cashier and a business with no pages at all still get the door", () => {
    expect(SALON_NAV["more-tools"]).toEqual({ needs: [] });
    expect(shown(staff(BEAUTY))).toContain("more-tools");
    expect(shown(owner(["dashboard"]))).toContain("more-tools");
  });

  it("the row you are standing on is never hidden, even when the rules would hide it", () => {
    const ctx = staff(BEAUTY);
    expect(salonRowVisible("end-of-day-cash", ctx)).toBe(false);
    expect(salonRowVisible("end-of-day-cash", ctx, "end-of-day-cash")).toBe(true);
    const noStock = owner(BEAUTY.filter((k) => k !== "inventory"));
    expect(salonRowVisible("salon-stock-and-orders", noStock, "salon-stock-and-orders")).toBe(true);
  });

  it("with nobody known (a logged-out preview) every row shows, as it always did", () => {
    expect(shown(null)).toHaveLength(Object.keys(SALON_NAV).length);
  });

  it("a row the rules have never heard of stays visible rather than vanishing", () => {
    expect(salonRowVisible("some-new-row", owner([]))).toBe(true);
  });
});

describe("the rules and the sidebar cannot drift apart", () => {
  const shell = readFileSync(join(process.cwd(), "app/[locale]/salon-preview/salon-shell.tsx"), "utf8");
  const shellKeys = [...shell.matchAll(/^\s*\|\s*"([a-z-]+)"\s*;?\s*$/gm)].map((m) => m[1]);

  it("every sidebar row key has a rule, and every rule is for a real row", () => {
    expect(shellKeys.length).toBeGreaterThan(10);
    expect([...shellKeys].sort()).toEqual(Object.keys(SALON_NAV).sort());
  });

  it("every page a rule needs is a real page key of the product", () => {
    for (const [row, rule] of Object.entries(SALON_NAV)) {
      for (const k of rule.needs) {
        expect(MODULE_KEYS, `${row} needs "${k}"`).toContain(k);
      }
    }
  });
});
