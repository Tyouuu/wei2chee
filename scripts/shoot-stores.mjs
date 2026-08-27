/**
 * 市面上卖 landing page 模板的商店。
 *
 * 老板 2026-08-27: 「现在市场上应该有很多这种卖landing page的template网站 我觉得
 * 大部分我们都可以去参考 提高一下我们平台的审美 我现在看到来 我们还是落后于人家
 * 就是关于设计感这个方面」
 *
 * ── WHY A STORE AND NOT ANOTHER GALLERY ──────────────────────────────────
 *
 * lapa.ninja and landing.love show one screenshot of somebody else's finished
 * site. A store has to SELL a template, so it shows the whole page broken into
 * the sections you are buying -- which is the axis SITE_COMPOSITION is made of
 * and the one a gallery cannot answer.
 *
 * Two shots each: the storefront (how they group and price) and one template's
 * own page (what a finished page is made of).
 *
 *   npm run shoot:stores
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = ".screenshots/stores";
mkdirSync(OUT, { recursive: true });

const SITES = [
  ["framer", "https://www.framer.com/marketplace/templates/"],
  ["framer-business", "https://www.framer.com/marketplace/category/business/"],
  ["webflow", "https://webflow.com/templates"],
  ["webflow-business", "https://webflow.com/templates/category/business-websites"],
  ["tailwindplus", "https://tailwindcss.com/plus/ui-blocks/marketing"],
  ["cruip", "https://cruip.com/"],
  ["themefisher", "https://themefisher.com/"],
  ["squarespace", "https://www.squarespace.com/templates"],
  ["wix", "https://www.wix.com/website/templates/html/business"],
  ["themeforest", "https://themeforest.net/category/site-templates/corporate"],
];

let bad = 0;
const b = await chromium.launch({ headless: false, channel: "chrome" });
for (const [name, url] of SITES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(5500);
    for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, 1100); await p.waitForTimeout(600); }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${name}.png` });

    /* JUDGE BY WHAT A READER SEES, NOT BY THE MARKUP OR THE STATUS.
       Three rulers lied in a row while mining lapa.ninja: a Cloudflare
       challenge screenshotted as 「ok」, a 404 that answers 200 with the site's
       normal title, and a grep of raw HTML that matched a string present on
       every page of the site. innerText is the only one of the four that
       reports what is actually on the screen. */
    const seen = await p.evaluate(() => document.body.innerText.slice(0, 1500));
    /* AND THE TITLE, which is the fourth version of this check today.
       themeforest served a Cloudflare interstitial whose <title> reads 「Just a
       moment...」 and whose innerText does not contain that phrase at all, so
       checking only the body passed it. Four rulers, four different places the
       truth was hiding: the status code, the title, the raw markup, the
       rendered text. The lesson is not 「use innerText」, it is 「a page can
       fail in a place your check does not look」 -- so this looks in two. */
    const title = await p.title();
    const blocked = /just a moment|attention required|access denied|enable javascript|unusual traffic|verify you are human|checking your browser/i.test(
      seen + " " + title,
    );
    const empty = seen.trim().length < 120;
    if (blocked || empty) { console.log(blocked ? "BLOCKED" : "EMPTY  ", name); bad++; }
    else console.log("ok     ", name.padEnd(18), title.slice(0, 52));
  } catch (e) {
    console.log("FAIL   ", name, String(e).slice(0, 60));
    bad++;
  }
  await p.close();
}
await b.close();
if (bad) { console.log(`\n${bad} 个没拍到真的页面。`); process.exitCode = 1; }
