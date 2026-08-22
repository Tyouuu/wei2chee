// Reads every piece of text a customer can see and reports the ones that do
// not have enough contrast against what is actually behind them.
//
//   npm run check:contrast
//
// WHY IT EXISTS. 漆 was the first register whose ground is a colour, and it
// exposed a class of fault that seventeen light registers had hidden: a record
// table with no surface of its own, a page title sitting on the ground rather
// than in a panel, and shadcn's --background/--foreground pair, which is only
// safe while the ground and the panels are the same value.
//
// None of those threw. 146 tests were green through all of them. The only
// thing that found them was reading the pixels, which is what this does --
// walking up to the first ancestor that actually paints something opaque,
// rather than trusting the class that was meant to.
//
// Needs `npm run dev` on :3000 and the renovation demo account.

import { chromium } from "file:///C:/Users/tiany/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "tianyou.demo@formae.test");
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]'); await p.waitForURL(/portal/, { timeout: 40000 });

const AUDIT = () => {
  const lum = (r, g, b2) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b2);
  };
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return null;
    const n = m[1].split(",").map((x) => parseFloat(x));
    return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
  };
  /** The first ancestor that actually paints something opaque. */
  const bgOf = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0.5) return c;
      e = e.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const canvas = document.querySelector("[data-editor-canvas]") ?? document.body;
  const out = [];
  for (const el of canvas.querySelectorAll("*")) {
    if (el.children.length) continue;
    const t = el.textContent?.trim();
    if (!t || t.length > 40) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 4.5) out.push({ t: t.slice(0, 26), ratio: +ratio.toFixed(2), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, size: cs.fontSize });
  }
  return out;
};

for (const [tag, url] of [["quotations", "/zh/portal/quotations"], ["website", "/zh/portal/website"]]) {
  await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(8000);
  const bad = await p.evaluate(AUDIT);
  console.log(`\n=== ${tag}: ${bad.length} text nodes under 4.5:1`);
  for (const x of bad.slice(0, 14)) console.log(`  ${String(x.ratio).padStart(5)}  ${x.size.padStart(6)}  ${x.fg} on ${x.bg}  "${x.t}"`);
}
await b.close();
