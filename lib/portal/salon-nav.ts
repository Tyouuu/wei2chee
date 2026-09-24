/**
 * Which rows of the salon sidebar a given business gets to see (Task 414/415).
 *
 * The sidebar used to be thirteen hard-coded rows shown to everybody. A small
 * salon that never keeps stock, or a cashier who cannot see the day's money,
 * still saw every one of them, and a row that opens onto an empty page reads
 * as "the boss has taken no money" rather than "this is not yours to see"
 * (workspace.ts says the same about the money pages).
 *
 * The choice of pages already exists in the product: every business has a set
 * of pages (project_pages, defaulted per industry) that its owner can add to
 * and take away from. So this does not invent a second list to keep in step;
 * each row just says which of those pages it stands on, and shows itself only
 * when the business has them. Take the stock page away and the Stock row goes;
 * add it back and it returns.
 *
 * Rows that have no page of their own hang on the page they belong to:
 *   - Packages needs customers AND bookings (a pass is sold to a client and
 *     used up at a booking; a business with no bookings has nothing to use one
 *     on)
 *   - Memberships needs customers AND payments (a monthly fee is collected)
 *   - the Lookbook needs the website (a portfolio is something you show)
 *
 * `ownerOnly` rows are the ones that read money or the change history. Their
 * pages already refuse a cashier, but a row that leads to "only the owner can
 * see this" is a dead end, so it is not drawn for one.
 *
 * The row that is open right now is always kept, so the sidebar never claims
 * you are somewhere it does not list.
 */

export type SalonNavRule = {
  /** Page keys the business must have (all of them). Empty = no page needed. */
  needs: readonly string[];
  /** Hidden from a cashier / staff login. */
  ownerOnly?: boolean;
};

/** Keyed by the sidebar row's key (salon-shell.tsx `SalonNavKey`). */
export const SALON_NAV: Record<string, SalonNavRule> = {
  overview: { needs: ["dashboard"] },
  "appointments-and-flow": { needs: ["bookings"] },
  "register-and-checkout": { needs: ["payments"] },
  "clients-and-profiles": { needs: ["customers"] },
  "lookbook-and-formulas": { needs: ["website"] },
  "packages-and-prepaid": { needs: ["customers", "bookings"] },
  "memberships-and-loyalty": { needs: ["customers", "payments"], ownerOnly: true },
  "salon-stock-and-orders": { needs: ["inventory"] },
  "stylists-and-staff": { needs: ["staff"] },
  "reports-and-rankings": { needs: ["payments"], ownerOnly: true },
  "end-of-day-cash": { needs: ["payments"], ownerOnly: true },
  "invoices-and-terminal": { needs: ["payments"], ownerOnly: true },
  "system-audit-log": { needs: [], ownerOnly: true },
};

export type SalonNavContext = {
  pageKeys: readonly string[];
  isOwner: boolean;
};

/**
 * Should this row be drawn?
 * `ctx` null means we do not know who is looking (a logged-out preview): show
 * everything, exactly as the sidebar always did.
 */
export function salonRowVisible(
  key: string,
  ctx: SalonNavContext | null,
  activeKey?: string,
): boolean {
  if (key === activeKey) return true;
  if (!ctx) return true;
  const rule = SALON_NAV[key];
  // A row this file has never heard of stays visible rather than vanishing.
  if (!rule) return true;
  if (rule.ownerOnly && !ctx.isOwner) return false;
  return rule.needs.every((k) => ctx.pageKeys.includes(k));
}
