/**
 * awwwards —— 老板 2026-08-29: 「你去看看awwards 这个网站先 可以很高的提升你的审美」.
 *
 * Shot rather than described. What is worth taking from a gallery is never the
 * gallery's own look; it is what the WINNERS have in common, and that only
 * shows in the numbers underneath them — how many carry a photograph, how many
 * are dark, what their categories are. 任务 31 measured exactly that on
 * landing.love and the finding (64% Minimal) was worth more than any one site.
 *
 *   npm run shoot:awwwards
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = ".screenshots/awwwards";
mkdirSync(OUT, { recursive: true });
/* ── 他们自己就把作品分成两边 ─────────────────────────────────────────────
   老板 2026-08-29: 「他们肯定有比较现代跟比较传统的做法对吗」. He is right, and
   awwwards' own category list is the proof:

     实验那边   WebGL · 3D · GSAP · Interaction Design · Design Agencies ·
                Portfolio
     生意那边   Restaurant & Hotel · Business & Corporate · E-commerce ·
                Architecture · Photography · Fashion

   The four on the right are OUR trades. A gallery of 6,464 winners is not one
   aesthetic; copying the left half would put a WebGL hero in front of a
   homeowner on a mid-range Android, and the right half is the same craft aimed
   at a business that has customers. */
const PAGES = [
  ["home", "https://www.awwwards.com/"],
  ["sotd", "https://www.awwwards.com/websites/sites_of_the_day/"],
  ["restaurant", "https://www.awwwards.com/websites/hotel-restaurant/"],
  ["business", "https://www.awwwards.com/websites/business-corporate/"],
  ["ecommerce", "https://www.awwwards.com/websites/e-commerce/"],
  ["architecture", "https://www.awwwards.com/websites/architecture/"],
  ["photography", "https://www.awwwards.com/websites/photography/"],
];

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 1100 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
});
for (const [name, url] of PAGES) {
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(5000);
    await p.evaluate(async () => {
      for (let y = 0; y < 4000; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
      window.scrollTo(0, 0);
    });
    await p.waitForTimeout(2000);
    await p.screenshot({ path: `${OUT}/${name}.jpg`, fullPage: false, type: "jpeg", quality: 80 });
    const facts = await p.evaluate(() => ({
      title: document.title.slice(0, 70),
      words: (document.body.innerText || "").trim().split(/\s+/).length,
      imgs: document.querySelectorAll("img").length,
      videos: document.querySelectorAll("video").length,
      text: (document.body.innerText || "").replace(/\n+/g, " · ").slice(0, 700),
    }));
    console.log(`\n== ${name} ==\n${facts.title}\n  ${facts.imgs} img · ${facts.videos} video · ${facts.words} words`);
    console.log("  " + facts.text);
  } catch (e) {
    console.log(name, "FAIL", String(e).slice(0, 110));
  }
  await p.close();
}
await b.close();
