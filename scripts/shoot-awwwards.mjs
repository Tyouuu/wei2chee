/* Awwwards 的得奖站，按**我们的画面**分类去挖，逐个量。
 *
 * 老板 2026-08-31:「就是每一个UI/UX都去上网深度研究 怎么才是最适配 最好看
 * 最user friendly的」·「反正awwwards这个网站里面有很多优秀得奖的网站」。
 *
 * ⚠️ 挑的是**分类**不是品味：header-design 对我们的第一屏，animation /
 * scrolling 对他要的动效，ui-design 对 portal。29 个分类是从站上读的，不是猜的。
 * 每一个站量：段数 · 整页高 · 大图 · h1 · 动的是什么 · 时长 · 滚动进场几块。
 */
import { chromium } from "playwright";
import fs from "node:fs";

/* ⚠️ `--n 4` 的那个 **4** 也不是分类。
   第一版只滤掉 `--` 开头的，於是 4 被当成一个分类名去爬
   `awwwards.com/websites/4/` —— 它**没有回 404，回了一页别的东西**，
   报告里就多出一段「════ 4 （31 个提名）」，里面是匹克球拍跟一家行销公司。
   一个不存在的分类印出一份看起来很正常的读数，是这个仓库最常见的那种谎。 */
const argv = process.argv.slice(2);
const nAt = argv.indexOf("--n");
const N = nAt >= 0 ? Number(argv[nAt + 1]) || 4 : 4;
const CATS = argv.filter((a, i) => !a.startsWith("--") && i !== nAt + 1);
if (!CATS.length) { console.error("用法: node scripts/shoot-awwwards.mjs header-design animation [--n 4]"); process.exit(1); }

const OUT = ".screenshots/awwwards";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();

for (const cat of CATS) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(`https://www.awwwards.com/websites/${cat}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(4000);
  const slugs = await p.evaluate(() => [...new Set([...document.querySelectorAll("a[href*='/sites/']")]
    .map((a) => a.href).filter((h) => /awwwards\.com\/sites\//.test(h)))]);
  await p.close();
  console.log(`\n════ ${cat}  （${slugs.length} 个提名）`);

  for (const s of slugs.slice(0, N)) {
    const q = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    let url = "", title = "";
    try {
      await q.goto(s, { waitUntil: "domcontentloaded", timeout: 90000 });
      await q.waitForTimeout(2000);
      ({ url, title } = await q.evaluate(() => {
        const a = [...document.querySelectorAll("a")].find((x) => /visit|website/i.test(x.innerText) && x.href.startsWith("http") && !x.href.includes("awwwards"));
        return { url: a?.href || "", title: document.querySelector("h1")?.innerText?.trim() || "" };
      }));
    } catch { /* 提名页读不到 */ }
    await q.close();
    if (!url) { console.log(`  ${s.split("/").pop()}  ← 拿不到网址`); continue; }

    const r = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await r.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      await r.waitForTimeout(3000);
      const before = await r.evaluate(() => [...document.querySelectorAll("body *")].slice(0, 800)
        .map((e) => { const c = getComputedStyle(e); return c.opacity + "|" + c.transform; }));
      for (let i = 0; i < 5; i++) { await r.mouse.wheel(0, 1300); await r.waitForTimeout(450); }
      const m = await r.evaluate((bef) => {
        const now = [...document.querySelectorAll("body *")].slice(0, 800)
          .map((e) => { const c = getComputedStyle(e); return c.opacity + "|" + c.transform; });
        let ch = 0; for (let i = 0; i < Math.min(bef.length, now.length); i++) if (bef[i] !== now[i]) ch++;
        const dur = new Map(), props = new Map();
        for (const e of document.querySelectorAll("*")) {
          const c = getComputedStyle(e);
          for (const d of (c.transitionDuration || "").split(",").map((x) => x.trim()))
            if (d && d !== "0s") dur.set(d, (dur.get(d) || 0) + 1);
          for (const q2 of (c.transitionProperty || "").split(",").map((x) => x.trim()))
            if (q2 && q2 !== "all" && q2 !== "none") props.set(q2, (props.get(q2) || 0) + 1);
        }
        const top = (mm, n = 3) => [...mm.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, n).map(([k, v]) => `${k}×${v}`).join(" ");
        const h1 = document.querySelector("h1"); const cs = h1 && getComputedStyle(h1);
        return { ch, n: now.length, dur: top(dur), props: top(props, 4),
          h: document.body.scrollHeight, h1px: cs ? Math.round(parseFloat(cs.fontSize)) : 0,
          fam: cs ? cs.fontFamily.split(",")[0].replace(/["']/g, "") : "",
          pics: [...document.querySelectorAll("img,video,canvas")].filter((e) => e.getBoundingClientRect().width > 200).length,
          webgl: !!document.querySelector("canvas") };
      }, before);
      const name = `${cat}-${url.replace(/^https?:\/\/(www\.)?/, "").replace(/[^a-z0-9]/gi, "-").slice(0, 26)}`;
      await r.screenshot({ path: `${OUT}/${name}.jpg`, fullPage: true, type: "jpeg", quality: 58 });
      console.log(`  ${title.slice(0, 34).padEnd(35)} ${String(m.h).padStart(6)}px ${String(m.pics).padStart(3)}图 h1 ${String(m.h1px).padStart(3)}px ${m.fam.slice(0,16).padEnd(17)}`);
      console.log(`      滚动进场 ${m.ch}/${m.n}   时长 ${m.dur}   动 ${m.props}${m.webgl ? "   ⚠️ canvas/WebGL" : ""}`);
      console.log(`      ${url}`);
    } catch (e) { console.log(`  ${url}  读不到 ${String(e).slice(0, 50)}`); }
    await r.close();
  }
}
await b.close();
