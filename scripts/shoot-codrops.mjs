/**
 * tympanus.net/codrops —— 老板 2026-08-27 发的。
 *
 * Not a gallery and not a template store: Codrops publishes RUNNING
 * experiments with the article that explains them. That is the one kind of
 * source neither lapa (a screenshot) nor Wix (a finished page) can be, and it
 * is the one that answers 「有动效」.
 *
 *   npm run shoot:codrops
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = ".screenshots/codrops";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "https://tympanus.net/codrops/"],
  ["demos", "https://tympanus.net/codrops/category/playground/"],
  ["hub", "https://tympanus.net/codrops/creative-hub/"],
];

const b = await chromium.launch({ headless: false, channel: "chrome" });
let bad = 0;
const found = [];
for (const [name, url] of PAGES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(5000);
    for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 1200); await p.waitForTimeout(500); }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 66, fullPage: true });

    const seen = await p.evaluate(() => document.body.innerText.slice(0, 1200));
    const title = await p.title();
    const blocked = /just a moment|attention required|access denied|verify you are human/i.test(seen + " " + title);
    if (blocked || seen.trim().length < 120) { console.log("BLOCKED", name); bad++; }
    else console.log("ok     ", name.padEnd(8), title.slice(0, 50));

    /* What each article is ABOUT is the thing worth carrying home -- the
       technique, not the picture of it. */
    const items = await p.evaluate(() =>
      [...document.querySelectorAll("article, .post, [class*='card']")]
        .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 20 && t.length < 200)
        .slice(0, 30),
    );
    found.push(...items);
  } catch (e) {
    console.log("FAIL   ", name, String(e).slice(0, 50));
    bad++;
  }
  await p.close();
}
await b.close();
writeFileSync(`${OUT}/titles.json`, JSON.stringify([...new Set(found)], null, 2));
console.log("\n" + [...new Set(found)].length + " 篇");
if (bad) process.exitCode = 1;
