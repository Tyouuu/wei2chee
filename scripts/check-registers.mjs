// Renders the same page under every register and hashes the SHAPE that came out.
//
//   npm run check:registers
//
// WHY IT EXISTS. The founder, after twenty-two registers and a hundred-odd
// variants: 「我怎么看到还是一样的东西」. He was right, and nothing in the
// product could have told him otherwise -- a register declares its preferences
// in design-doc.ts, and whether any of them REACH a component is a question
// only a browser can answer. Two separate silent failures had made them not:
// Puck's defaultProps filled every appearance prop before render, and the
// resolution hook was written but never called.
//
// Colour is deliberately excluded from the hash. That the paint differs was
// never in doubt; the question is whether the SHAPE does.
//
// Read on the dashboard rather than a record page: a page with four kinds of
// block can only express so many shapes, and chasing a unique hash there pushes
// design decisions around to satisfy a number. The dashboard carries most of
// the component kinds a register has an opinion about.
//
// Needs `npm run dev` on :3000 and the renovation demo account.

import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/* Renders the same page under every register and hashes what came out.
   Two registers that produce the same STRUCTURE hash are two registers that
   look the same, whatever their tokens say. Colour is deliberately excluded --
   we already know the paint differs; the question is whether the SHAPE does. */

/*
  READ, NOT LISTED. The npm script used to name the registers by hand and on
  2026-08-26 it still said 「Large」 and 「Ink」, both cut days earlier, while
  missing 工作室 entirely. STYLE_ORDER is the list the product itself renders
  from, so it is the list this gate measures.
*/
const ALL = (() => {
  const src = readFileSync("app/[locale]/style-picker/style-column.tsx", "utf8");
  const block = src.match(/export const STYLE_ORDER[^=]*=\s*\[([^\]]*)\]/);
  if (!block) throw new Error("STYLE_ORDER not found -- did style-column.tsx move?");
  return [...block[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1][0].toUpperCase() + x[1].slice(1));
})();
const REGISTERS = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "tianyou.demo@formae.test");
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 60000 });

const rows = [];
const missing = [];
for (const reg of REGISTERS) {
  await p.goto("http://localhost:3000/zh/portal/styles", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(4000);
  // data-register, not the card's text. See the same note in
  // shoot-registers.mjs: the cards became live previews of the customer's own
  // pages, so `li > span` is now a line of somebody's dashboard. On 2026-08-26
  // this reported 「0 / 0 -- every register is structurally distinct」, which
  // was true of the empty set and told nobody anything.
  const hit = await p.evaluate((w) => {
    const key = w.toLowerCase();
    const card = document.querySelector(`li[data-register="${key}"]`);
    if (!card) return "miss";
    const btn = card.querySelector(`button[data-register-use="${key}"]`);
    if (!btn) return "active";
    btn.click();
    return "ok";
  }, reg);
  // A register the page does not offer is a FAILURE, not a line of output. The
  // whole point of this gate is that it cannot pass by measuring nothing.
  if (hit === "miss") { console.log(reg, "NOT FOUND"); missing.push(reg); continue; }
  await p.waitForTimeout(3500);
  await p.goto("http://localhost:3000/zh/portal/dashboard", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(6500);
  const shape = await p.evaluate(() => {
    const canvas = document.querySelector("[data-editor-canvas]");
    if (!canvas) return "no-canvas";
    const parts = [];
    for (const el of canvas.querySelectorAll("*")) {
      const c = (el.className || "").toString();
      if (!c) continue;
      // Keep only structural classes: layout, spacing, borders, radius.
      const keep = c
        .split(/\s+/)
        // Arbitrary-value classes count. Most of this codebase's structure is
        // written as `[border-bottom:var(--hairline)...]`, and the first
        // version of this filter dropped every one of them -- which made a
        // ruled page heading and a split one hash identically and reported five
        // registers as colliding when they did not.
        .filter((k) => /^(flex|grid|items-|justify-|gap-|rounded|border|w-|h-|p[xytblr]?-|m[xytblr]?-|text-center|text-left|hidden|absolute|relative|col-span|order-|aspect-|divide-|space-)/.test(k) || (k.startsWith("[") && !/color|background|--color|shadow|font-family/.test(k)))
        .join(" ");
      if (keep) parts.push(el.tagName + ":" + keep);
    }
    return parts.join("|");
  });
  const rail = await p.evaluate(() => {
    const r = document.querySelector("[data-nav]");
    const cs = r ? getComputedStyle(r) : null;
    return r ? `${Math.round(r.getBoundingClientRect().width)}/${r.getAttribute("data-nav")}/${cs?.borderRightWidth}` : "none";
  });
  const h = createHash("sha1").update(shape).digest("hex").slice(0, 10);
  rows.push({ reg, h, len: shape.length, rail });
  console.log(reg.padEnd(11), h, String(shape.length).padStart(6), rail);
}

const byHash = {};
for (const r of rows) (byHash[r.h] ??= []).push(r.reg);
const dupes = Object.values(byHash).filter((g) => g.length > 1);
console.log("\n不同的结构:", Object.keys(byHash).length, "/", rows.length);
if (dupes.length) {
  console.log("结构一模一样的组:");
  for (const g of dupes) console.log("  ", g.join(" = "));
} else {
  console.log("每一套的结构都不同");
}
await b.close();

/*
  A GATE THAT CANNOT PASS BY MEASURING NOTHING.

  Until 2026-08-26 a register the page did not offer printed 「NOT FOUND」 and
  the run carried on. When the matcher broke, all sixteen printed it and the
  script finished with 「0 / 0, every register is structurally distinct」 and
  exit 0. Both halves have to be true now: every register was actually reached,
  and no two of them hashed the same.
*/
if (missing.length) {
  console.log("\n没找到:", missing.join(" "), "-- 这个门本身坏了，不是风格坏了");
}
process.exit(missing.length || dupes.length ? 1 : 0);
