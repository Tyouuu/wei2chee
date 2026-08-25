/**
 * 拍下每一套版式，拼成一张对照表。
 *
 * WHY THIS IS A SCRIPT AND NOT SOMETHING SOMEBODY DOES BY HAND. The founder's
 * standing rule, said three times and finally with its reason attached:
 * 「用看的 不是量的 你懂吗 审美这种东西都是用看的 客人是用眼睛看的满意了 才会用
 * 我的风格」. check-registers.mjs already proves the sixteen are structurally
 * DIFFERENT; it cannot say whether any of them is GOOD. Only a picture can, and
 * a picture nobody can produce in one command is a picture nobody looks at.
 *
 * So this is the other half of that gate: same login, same page, same viewport,
 * every register in turn, then a contact sheet you can open and judge. It is
 * what the 22 → 16 cull on 2026-08-25 was decided from.
 *
 *   npm run shoot:registers                 # all of them, to .screenshots/
 *   npm run shoot:registers -- Ledger Pop   # just these two
 *
 * Needs `npm run dev` up on :3000 and the demo account seeded, exactly like
 * check-registers.mjs -- the two are meant to be run back to back.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ALL = [
  "Ledger", "Hearth", "Blueprint", "Large", "Stamp", "Swiss", "Soft", "Brut",
  "Glass", "Night", "Signboard", "Lacquer", "Code", "Tile", "Pop",
  "Console", "Counter",
];
const REGISTERS = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "tianyou.demo@formae.test");
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 60000 });

const shot = [];
for (const reg of REGISTERS) {
  await p.goto("http://localhost:3000/zh/portal/styles", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(4000);
  const hit = await p.evaluate((w) => {
    for (const li of document.querySelectorAll("li")) {
      const n = li.querySelector("span")?.textContent?.trim();
      if (n && n.startsWith(w)) {
        const btn = li.querySelector("button");
        if (btn) { btn.click(); return "ok"; }
        return "active";
      }
    }
    return "miss";
  }, reg);
  if (hit === "miss") { console.log(reg.padEnd(11), "NOT FOUND"); continue; }
  await p.waitForTimeout(3500);
  await p.goto("http://localhost:3000/zh/portal/dashboard", { waitUntil: "networkidle", timeout: 120000 });
  // The same settle the structure gate uses. Shorter and the chart has not
  // drawn, which is the one thing on this page a screenshot exists to show.
  await p.waitForTimeout(6500);
  const file = join(OUT, `reg-${reg}.png`);
  await p.screenshot({ path: file });
  shot.push([reg, file]);
  console.log(reg.padEnd(11), file);
}
await b.close();

writeFileSync(
  join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>版式对照 ${new Date().toISOString().slice(0, 10)}</title>
<style>
 body{margin:0;background:#0b0c0f;color:#eae7e0;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif;padding:24px}
 h1{font-size:18px;font-weight:600;margin:0 0 4px}
 p{color:#8e939c;margin:0 0 22px;font-size:13px}
 .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:18px}
 figure{margin:0}
 img{width:100%;display:block;border:1px solid #343945}
 figcaption{font:11px/1.8 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#959ba5;padding-top:7px}
</style>
<h1>版式对照 · ${shot.length} 套</h1>
<p>同一个客户、同一页、1400 × 950、未滚动。拍于 ${new Date().toLocaleString("zh-CN")}。</p>
<div class="g">${shot
    .map(([reg, f]) => `<figure><img src="${f.split(/[\\/]/).pop()}" alt="${reg}"><figcaption>${reg}</figcaption></figure>`)
    .join("")}</div>`,
);
console.log(`\n${shot.length} 张 → ${OUT}/index.html`);
