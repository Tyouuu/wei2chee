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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/*
  THE LIST IS READ, NOT KEPT.

  It used to be a literal array here, and on 2026-08-26 it still named 「Large」
  -- a register cut the day before -- while missing nothing else only by luck.
  A contact sheet that silently skips a register is worse than no contact sheet,
  because you look at fifteen pictures and believe you have seen sixteen.

  STYLE_ORDER is the one list the product itself renders from, so it is the one
  list this reads. Regex rather than an import because this is a .mjs run by
  plain node and that file is TSX behind a CSS module.
*/
const ALL = (() => {
  const src = readFileSync("app/[locale]/style-picker/style-column.tsx", "utf8");
  const block = src.match(/export const STYLE_ORDER[^=]*=\s*\[([^\]]*)\]/);
  if (!block) throw new Error("STYLE_ORDER not found -- did style-column.tsx move?");
  return [...block[1].matchAll(/"([a-z]+)"/g)].map(
    (m) => m[1][0].toUpperCase() + m[1].slice(1),
  );
})();
const REGISTERS = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

/* 🔴 它跑完会把老板的 demo 帐号留在最后拍的那一套上。
   2026-09-02 加的：先记住他本来选的是哪一套，跑完放回去。
   [任务 23d](../docs/founder-tasks.md) 已经替 `eval:browser` 做过同一件事，
   而这一支从来没有 —— **一把每跑一次就悄悄换掉他风格的尺，是有代价的尺。** */
let ORIGINAL = null;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "tianyou.demo@formae.test");
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 60000 });

/* 他本来穿的那一套。读的是画廊上自己标着「在用中」的那一张 —— 跟下面点的
   是同一个来源，所以不会一个读 A 一个写 B。 */
await p.goto("http://localhost:3000/zh/portal/styles", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(3500);
ORIGINAL = await p.evaluate(() => {
  const cards = [...document.querySelectorAll("li[data-register]")];
  const inUse = cards.find((c) => !c.querySelector("button[data-register-use]"));
  return inUse ? inUse.getAttribute("data-register") : null;
});
console.log("本来是", ORIGINAL ?? "(读不到 —— 跑完不会乱放回去)");

const shot = [];
for (const reg of REGISTERS) {
  await p.goto("http://localhost:3000/zh/portal/styles", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(4000);
  // MATCH ON THE WHOLE CARD'S TEXT, NOT ON ITS FIRST <span>.
  //
  // The old version read `li.querySelector("span")` and assumed the first span
  // was the register's name. On 2026-08-25 the tile gained a page reel with a
  // label chip inside it, that chip became the first span, and every register
  // reported NOT FOUND -- a screenshot script that silently shot nothing. The
  // name is still the only place a register's own word appears in the card, so
  // matching the card's text and then pressing its 换成这个 is stable against
  // whatever else the tile grows.
  /*
    MATCH ON THE CARD'S OWN ATTRIBUTE, NOT ON ITS TEXT.

    This read `for (const li of document.querySelectorAll("li"))` and took the
    first whose text contained the register's name. That was right while a card
    was a name over a small hand-drawn table. Since the cards became live
    travelling previews of the customer's real pages, each one contains
    hundreds of <li>s of somebody else's content -- and on 2026-08-26 this
    photographed 台账's dashboard and filed it as reg-Studio.png. A screenshot
    script that files the wrong picture under the right name is worse than one
    that crashes.

    styles-client.tsx now stamps data-register on the card and
    data-register-use on its button. Neither can be imitated by a preview and
    neither moves when the copy does.
  */
  const hit = await p.evaluate((w) => {
    const key = w.toLowerCase();
    const card = document.querySelector(`li[data-register="${key}"]`);
    if (!card) return "miss";
    const btn = card.querySelector(`button[data-register-use="${key}"]`);
    if (!btn) return "active";
    btn.click();
    return "ok";
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
/* 放回去。读不到本来是哪一套就什么都不做 —— 猜一个放回去比不放更糟。 */
if (ORIGINAL) {
  await p.goto("http://localhost:3000/zh/portal/styles", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(3500);
  const back = await p.evaluate((key) => {
    const btn = document.querySelector(`button[data-register-use="${key}"]`);
    if (!btn) return "already";
    btn.click();
    return "ok";
  }, ORIGINAL);
  await p.waitForTimeout(3500);
  console.log("放回", ORIGINAL, back === "ok" ? "" : `(${back})`);
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
