/* 一次拿几十个模版的缩图，摊成一张让他挑。
 *
 * 老板 2026-08-31:「你不是可以找到很多很多设计感的模版吗
 * 然后根据我想要的风格去找那个模版给我」。
 *
 * ⚠️ 关键是**量大**：三个不叫挑（[重点 7m](../docs/founder-points.md)）。
 * 所以不逐个开外站 —— Awwwards 的分类页本身每一张卡就带一张缩图，
 * 一次载入拿二十几个，比一个一个开快三十倍。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const CATS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const OUT = ".screenshots/gallery";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const all = [];

for (const cat of CATS.length ? CATS : ["sites_of_the_day"]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
  await p.goto(`https://www.awwwards.com/websites/${cat}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
  for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(900); }
  const cards = await p.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll("a[href*='/sites/']")) {
      const img = a.querySelector("img") || a.closest("li,article,div")?.querySelector("img");
      const src = img?.currentSrc || img?.src || "";
      if (!src || src.startsWith("data:")) continue;
      const t = (a.closest("li,article,div")?.innerText || "").trim().split("\n")[0].slice(0, 40);
      out.push({ slug: a.href.split("/sites/")[1]?.replace(/\/$/, ""), src, t });
    }
    const seen = new Set();
    return out.filter((x) => x.slug && !seen.has(x.slug) && seen.add(x.slug));
  });
  console.log(`${cat}: ${cards.length} 张`);
  for (const c of cards.slice(0, 14)) {
    const f = `${OUT}/${cat}__${c.slug}.jpg`.replace(/[^\w./\-]/g, "-");
    try {
      const r = await p.request.get(c.src, { timeout: 20000 });
      if (r.ok()) { fs.writeFileSync(f, await r.body()); all.push({ ...c, cat, f }); }
    } catch { /* 拿不到就算了 */ }
  }
  await p.close();
}
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(all, null, 1));
console.log(`\n→ ${OUT}/  共 ${all.length} 张`);
await b.close();
