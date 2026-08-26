/**
 * 选了英文，画面上还剩几个中文字。
 *
 * WHY THIS IS A SCRIPT. The founder said 「用英文 不要用華語」, I heard it as "talk
 * to me in English", and he corrected it: 「不是這個英文 是我的平台裡面用英文」. When I
 * finally walked /en/portal by hand on 2026-08-26 there were 386 Chinese
 * strings across eight pages -- on a portal I had already called localised,
 * twice. The reason it survived that long is that nothing FAILS when a Chinese
 * literal renders under an English locale. It just sits there.
 *
 * So this is the gate. It walks the portal in English and counts the CJK.
 *
 * ── WHAT IT DELIBERATELY DOES NOT COUNT ───────────────────────────────────
 *
 * The customer's OWN words. 兴发装修工程, 陈老板, and a real enquiry that reads
 * 「陈先生（真实测试）· 厨房翻新，想问大概多少钱」 are a business's name, an owner's
 * name, and a sentence a human being actually typed. Translating those is not
 * localisation, it is falsifying someone's data. They are matched by
 * OWN_WORDS below and excluded, and anything excluded is PRINTED, so the
 * exclusion list stays something you look at rather than something that hides
 * the count.
 *
 *   npm run check:en            # every page
 *   npm run check:en -- spec    # just this one
 *
 * Needs `npm run dev` on :3000 and the demo account seeded.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const PAGES = [
  ["home", "/en/portal"],
  ["library", "/en/portal/library"],
  ["sections", "/en/portal/sections"],
  ["templates", "/en/portal/templates"],
  ["styles", "/en/portal/styles"],
  ["spec", "/en/portal/spec"],
  ["enquiries", "/en/portal/enquiries"],
  ["account", "/en/portal/account"],
];

/* The customer's own data. Their name, their people, their words. A single
   character is the avatar monogram cut from one of them. */
const OWN_WORDS = [
  /兴发装修工程/, /陈老板/, /陈先生/, /陈太太/, /李先生/,
  /真实测试/, /厨房翻新/, /想问大概多少钱/,
  /Taman/, /装修/,
  /^[一-鿿]$/,
];

/* The one Chinese string that is CORRECT on an English page: the language
   switcher, which names the other language in that language. An English button
   reading 「Chinese」 tells a Chinese reader nothing about what they will get. */
const BY_DESIGN = [/^中文$/];

const only = process.argv.slice(2);
const wanted = only.length ? PAGES.filter(([n]) => only.includes(n)) : PAGES;

mkdirSync(".screenshots/en", { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto("http://localhost:3000/en/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "tianyou.demo@formae.test");
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 60000 });

const report = {};
let total = 0;

for (const [name, path] of wanted) {
  await p.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle", timeout: 120000 });
  // The spec page writes its prose with a model call; the libraries render a
  // few hundred live previews. Neither is finished at networkidle.
  await p.waitForTimeout(name === "spec" ? 9000 : 5000);

  // Text NODES, not innerText: a node is the smallest thing a single literal
  // can be, so the count lands on strings rather than on paragraphs.
  const found = await p.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const s = (n.textContent || "").trim();
      if (!s || !/[\u4e00-\u9fff]/.test(s)) continue;
      const el = n.parentElement;
      if (el && getComputedStyle(el).display === "none") continue;
      out.push(s);
    }
    return out;
  });

  const keep = (s) => OWN_WORDS.some((r) => r.test(s)) || BY_DESIGN.some((r) => r.test(s));
  const own = found.filter(keep);
  const bad = found.filter((s) => !keep(s));
  report[name] = { chinese: bad.length, theirs: own.length, strings: [...new Set(bad)] };
  total += bad.length;

  await p.screenshot({ path: `.screenshots/en/en-${name}.png`, fullPage: true });
  console.log(
    String(bad.length).padStart(4),
    name.padEnd(11),
    own.length ? `(${own.length} of the customer's own, kept)` : "",
  );
  for (const s of [...new Set(bad)].slice(0, 12)) console.log("       ·", s.slice(0, 60));
}

writeFileSync(".screenshots/en/report.json", JSON.stringify(report, null, 2));
await b.close();
console.log("\n", total, "Chinese strings on the English portal");
process.exit(total === 0 ? 0 : 1);
