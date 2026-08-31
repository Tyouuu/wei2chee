/* 别人的**同一个画面**长什么样 —— 登入 · 404 · 空状态。
 *
 * 老板 2026-08-31:「然后其他的画面都去找一下」，接在
 * 「只是我们自己的平台罢了 不要选其他的模版」之后 ——
 * 所以拿回来的是**读数**，不是一张要照着排的图（[重点 7m](../docs/founder-points.md)）。
 *
 * ⚠️ Awwwards 没有这一类：它收的是官网跟作品集，不是产品的内页。
 * 登入跟 404 是**公开的**，所以量真的产品；后台跟收件匣要帐号，另外想办法。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const SCREENS = {
  login: [
    ["linear",   "https://linear.app/login"],
    ["notion",   "https://www.notion.so/login"],
    ["vercel",   "https://vercel.com/login"],
    ["cal",      "https://app.cal.com/auth/login"],
    ["supabase", "https://supabase.com/dashboard/sign-in"],
  ],
  notfound: [
    ["linear",   "https://linear.app/nope-not-here"],
    ["stripe",   "https://stripe.com/nope-not-here"],
    ["notion",   "https://www.notion.so/nope-not-here"],
    ["vercel",   "https://vercel.com/nope-not-here"],
    ["figma",    "https://www.figma.com/nope-not-here"],
  ],
};

const OUT = ".screenshots/screens";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();

for (const [kind, list] of Object.entries(SCREENS)) {
  console.log(`\n════ ${kind}`);
  for (const [name, url] of list) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await p.waitForTimeout(2600);
      const m = await p.evaluate(() => {
        const vis = (e) => {
          const r = e.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return false;
          const c = getComputedStyle(e);
          return c.visibility !== "hidden" && c.display !== "none" && Number(c.opacity) > 0.05;
        };
        const ctl = [...document.querySelectorAll("button,a[href],input,select,textarea")].filter(vis);
        const h1 = document.querySelector("h1,h2");
        const cs = h1 && getComputedStyle(h1);
        const bg = getComputedStyle(document.body).backgroundColor;
        return {
          ctl: ctl.length,
          labels: ctl.map((e) => (e.innerText || e.placeholder || e.getAttribute("aria-label") || "").trim())
            .filter(Boolean).slice(0, 7).join(" · ").slice(0, 96),
          words: (document.body.innerText.match(/\S+/g) || []).length,
          h: document.body.scrollHeight, bg,
          head: h1?.innerText?.trim().slice(0, 48) || "",
          headPx: cs ? Math.round(parseFloat(cs.fontSize)) : 0,
          pics: [...document.querySelectorAll("img,svg,video,canvas")].filter((e) => e.getBoundingClientRect().width > 90).length,
        };
      });
      await p.screenshot({ path: `${OUT}/${kind}-${name}.jpg`, type: "jpeg", quality: 74 });
      console.log(`  ${name.padEnd(9)} ${String(m.ctl).padStart(2)}个可按 ${String(m.words).padStart(4)}字 ${String(m.pics).padStart(2)}图 底${m.bg.replace(/\s/g,"")}  标题 ${m.headPx}px「${m.head}」`);
      console.log(`            ${m.labels}`);
    } catch (e) { console.log(`  ${name.padEnd(9)} 读不到 ${String(e).slice(0, 54)}`); }
    await p.close();
  }
}
await b.close();
