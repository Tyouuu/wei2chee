/**
 * lapa.ninja -- 7,303 landing pages, and the one thing it has that
 * landing.love does not: pages cut into SECTIONS.
 *
 * landing.love answers 「它怎么动」. This answers 「一页由哪些区段组成、什么顺序」,
 * which is the axis SITE_COMPOSITION is actually made of.
 *
 *   npm run shoot:lapa
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = ".screenshots/lapa";
mkdirSync(OUT, { recursive: true });

/* THE REAL PATHS, READ OFF THEIR OWN NAV RATHER THAN GUESSED.

   The first run invented /sections/, /sections/header/, /sections/pricing/ and
   five more. Every one of them was a 404 -- and the 404 returns 200 with a
   generic title, so the script printed 「ok」 eight times and saved eight
   pictures of a 404 page. Their word for it is `/elements/`. */
const PAGES = [
  ["home", "https://www.lapa.ninja/"],
  ["elements", "https://www.lapa.ninja/elements/"],
  ["templates", "https://www.lapa.ninja/templates/"],
  ["motion", "https://www.lapa.ninja/motion/"],
  ["cat-business", "https://www.lapa.ninja/category/business/"],
  ["cat-minimal", "https://www.lapa.ninja/category/minimal/"],
  ["cat-food", "https://www.lapa.ninja/category/food-drinks/"],
  ["cat-health", "https://www.lapa.ninja/category/health-fitness/"],
];

let failures = 0;
const b = await chromium.launch({ headless: false, channel: "chrome" });
for (const [name, url] of PAGES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(5000);
    // Lazy images: walk the page so the grid actually has pictures in it.
    for (let i = 0; i < 6; i++) {
      await p.mouse.wheel(0, 900);
      await p.waitForTimeout(700);
    }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}.png` });
    const title = await p.title();
    /* The check the first version did not have. */
    const body = await p.content();
    const blocked = /Attention Required|Just a moment|cf-browser-verification|Access denied/i.test(
      title + body.slice(0, 3000),
    );
    /* Their 404 answers 200 with the site's normal title, so the tell has to
       be the page's own joke -- but only where a READER would see it. The
       first attempt grepped the raw HTML and failed all eight, real pages
       included: that string is in the markup of every page on the site.
       Third ruler in a row today that reported on something other than what
       is on the screen. */
    const seen = await p.evaluate(() => document.body.innerText.slice(0, 1200));
    const missing = /took the wrong landing/i.test(seen);
    if (blocked || missing) {
      console.log(blocked ? "BLOCKED" : "404    ", name.padEnd(12), title.slice(0, 50));
      failures++;
    } else {
      console.log("ok  ", name.padEnd(14), title.slice(0, 60));
    }
  } catch (e) {
    console.log("FAIL", name, String(e).slice(0, 70));
  }
  await p.close();
}
await b.close();
if (failures) {
  console.log(`
${failures} 页被挡住了 —— 拍到的是挑战页，不是他们的网站。`);
  process.exitCode = 1;
}
