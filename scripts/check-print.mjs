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

import { chromium } from "playwright";

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
  //
  // LET THE BROWSER DO THE COLOUR MATH -- the same lesson check-contrast.mjs
  // learned and this file did not inherit. The first version pulled the numbers
  // out of the string with a regex and treated the first three as r,g,b. The
  // palette layer emits oklch, which COMPUTES to `lab(95.82 0.49 14.97)` -- a
  // near-white cream -- and the regex read it as rgb(96, 0, 15) and reported
  // the customer's page ground as 682,584px2 of solid toner. The page was
  // white; the audit was wrong. A 1x1 canvas resolves any colour space the
  // browser can paint, which is the only definition that matters here.
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  const lum = (s) => {
    if (!s || s === "transparent") return 1;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    ctx.globalCompositeOperation = "copy";
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] / 255 < 0.5) return 1;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(d[0]) + 0.7152 * f(d[1]) + 0.0722 * f(d[2]);
  };

  let darkFill = 0, shadow = 0, biggest = 0;
  const darkest = [];
  for (const el of document.querySelectorAll("*")) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (lum(cs.backgroundColor) < 0.35) {
      darkFill++;
      const r = el.getBoundingClientRect();
      const a = Math.round(r.width * r.height);
      biggest = Math.max(biggest, a);
      darkest.push({ a, cls: (el.className || "").toString().slice(0, 50), bg: cs.backgroundColor, tag: el.tagName });
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
    darkest: darkest.sort((x, y) => y.a - x.a).slice(0, 3),
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
  for (const d of r.darkest) console.log(`    dark ${String(d.a).padStart(9)}px2  ${d.tag}.${d.cls}  ${d.bg}`);
  await p.pdf({ path: `.print-audit-${tag}.pdf`, format: "A4", printBackground: true });
  await p.emulateMedia({ media: "screen" });
}
await b.close();
console.log("\nPDFs written: .print-audit-*.pdf");
