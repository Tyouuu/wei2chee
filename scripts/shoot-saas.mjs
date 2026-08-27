/**
 * 十六个成熟的产品官网，整页。
 *
 * 老板 2026-08-27: 「我还欠你的三批…就是有些东西是可以结合的」.
 *
 * These were shot once before into scratchpad/ and lost when that directory was
 * cleaned -- which is why they live under .screenshots/ now with everything
 * else. Task 25 has carried them as 「只看不挖」 since 2026-08-27 morning.
 *
 * ⚠️ WHAT THEY ARE AND ARE NOT FOR (task 25's own warning, restated because I
 * broke it once already): these are SaaS products selling to developers. They
 * answer 「一页由哪些区段组成、什么顺序、怎么留白」. They do NOT answer 「多大、
 * 多宽、多密」 -- that comes from the 19 trading Malaysian SME sites, which set
 * a 38px headline where these set 56.
 *
 *   npm run shoot:saas
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = ".screenshots/saas";
mkdirSync(OUT, { recursive: true });

const SITES = [
  ["linear", "https://linear.app"],
  ["stripe", "https://stripe.com"],
  ["attio", "https://attio.com"],
  ["resend", "https://resend.com"],
  ["raycast", "https://www.raycast.com"],
  ["vercel", "https://vercel.com"],
  ["supabase", "https://supabase.com"],
  ["clerk", "https://clerk.com"],
  ["framer", "https://www.framer.com"],
  ["cal", "https://cal.com"],
  ["dub", "https://dub.co"],
  ["lovable", "https://lovable.dev"],
  ["mintlify", "https://mintlify.com"],
  ["polar", "https://polar.sh"],
  ["shadcn", "https://ui.shadcn.com"],
  ["tailwind", "https://tailwindcss.com"],
];

let bad = 0;
const b = await chromium.launch({ headless: false, channel: "chrome" });
for (const [name, url] of SITES) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(5000);
    for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 1200); await p.waitForTimeout(500); }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 62, fullPage: true });

    /* Judged on what a reader sees plus the title -- the fourth version of this
       check, after a Cloudflare page screenshotted as 「ok」, a 404 answering
       200, a grep of markup that matched every page, and an interstitial whose
       only tell was in <title>. */
    const seen = await p.evaluate(() => document.body.innerText.slice(0, 1200));
    const title = await p.title();
    const blocked = /just a moment|attention required|access denied|enable javascript|verify you are human|checking your browser/i.test(seen + " " + title);
    if (blocked || seen.trim().length < 120) { console.log("BLOCKED", name); bad++; }
    else console.log("ok     ", name.padEnd(10), title.slice(0, 46));
  } catch (e) {
    console.log("FAIL   ", name, String(e).slice(0, 50));
    bad++;
  }
  await p.close();
}
await b.close();
if (bad) { console.log(`\n${bad} 个没拍到。`); process.exitCode = 1; }
