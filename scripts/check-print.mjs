// Renders the customer's own pages the way a printer sees them.
//
//   npm run check:print
//
// WHY IT EXISTS. `grep -rn "@media print"` across the whole product returns one
// hit: four lines in Formae's own portal chrome that flatten the paper mount.
// The CUSTOMER'S generated system — the thing that prints the quotation, the
// invoice, the delivery order, and from 2026 the e-Invoice — has none. Twenty-
// one registers for the screen and nothing at all for the sheet.
//
// The four faults this measures are the ones that cannot be seen on a monitor:
//
//   1. NAV ON THE PAGE.      The navigation column prints, so every sheet
//                            carries a menu the person holding it cannot click.
//   2. INK.                  Coloured grounds and dark table heads print as
//                            solid blocks. Most SME printers are mono and low
//                            on toner; a solid head comes out as a grey slab
//                            with white text vanishing inside it.
//   3. HEADS THAT DO NOT REPEAT.  A table that runs past one sheet needs
//                            `thead { display: table-header-group }` or page
//                            two is a column of numbers with no column names.
//   4. ROWS CUT IN HALF.     Without `break-inside: avoid` a row splits across
//                            the fold.
//
// Emulates print media, then measures the DOM under that emulation, because
// print styles that only exist in a stylesheet nobody applied are not styles.

import { chromium } from "file:///C:/Users/tiany/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs";

const AUDIT = () => {
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const navs = [...document.querySelectorAll("nav, aside, [data-rail], [data-nav]")].filter(vis);
  const heads = [...document.querySelectorAll("thead")].filter(vis);
  const headRepeat = heads.filter((h) => getComputedStyle(h).display === "table-header-group").length;
  // Only rows that still exist on the sheet. The insert palette renders its
  // own preview rows OUTSIDE the canvas; those are already gone under print,
  // and counting them made a clean page report 3 of 5.
  const rows = [...document.querySelectorAll("tbody tr")].filter(vis);
  const rowsAvoid = rows.filter((r) => {
    const c = getComputedStyle(r);
    return c.breakInside === "avoid" || c.pageBreakInside === "avoid";
  }).length;

  // Dark fills: anything painting a ground darker than mid grey is toner.
  const lum = (s) => {
    const m = s.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return 1;
    const [r, g, b] = m.map(Number);
    const a = m.length > 3 ? Number(m[3]) : 1;
    if (a < 0.5) return 1;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  let darkFill = 0, shadow = 0, biggest = 0;
  for (const el of document.querySelectorAll("*")) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (lum(cs.backgroundColor) < 0.35) {
      darkFill++;
      const r = el.getBoundingClientRect();
      biggest = Math.max(biggest, Math.round(r.width * r.height));
    }
    if (cs.boxShadow && cs.boxShadow !== "none") shadow++;
  }
  return {
    navs: navs.length,
    tables: heads.length,
    headRepeat,
    rows: rows.length,
    rowsAvoid,
    darkFill,
    biggestDarkPx: biggest,
    shadow,
  };
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "tianyou.demo@formae.test");
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 40000 });

for (const [tag, url] of [["quotations", "/zh/portal/quotations"], ["dashboard", "/zh/portal/dashboard"]]) {
  await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(6000);
  await p.emulateMedia({ media: "print" });
  await p.waitForTimeout(400);
  const r = await p.evaluate(AUDIT);
  console.log(`\n=== ${tag} (print media)`);
  console.log(`  navigation still on the sheet : ${r.navs}`);
  console.log(`  tables                        : ${r.tables}   heads that repeat: ${r.headRepeat}`);
  console.log(`  data rows                     : ${r.rows}   rows that avoid the fold: ${r.rowsAvoid}`);
  console.log(`  dark fills (toner)            : ${r.darkFill}   largest: ${r.biggestDarkPx.toLocaleString()}px2`);
  console.log(`  shadows                       : ${r.shadow}`);
  await p.pdf({ path: `.print-audit-${tag}.pdf`, format: "A4", printBackground: true });
  await p.emulateMedia({ media: "screen" });
}
await b.close();
console.log("\nPDFs written: .print-audit-*.pdf");
