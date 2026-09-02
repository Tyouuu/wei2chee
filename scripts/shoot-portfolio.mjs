/**
 * `npm run shoot:portfolio` —— 去设计师／作品站捞**手机画面**，摊成一张给他挑。
 *
 * 老板 2026-09-03：`我需要你去找更多的素材 就是去到那种freelancer展示自己做的作品的
 * 网站去找 我相信那边有很好的模版`。
 *
 * ⚠️ **我顶过一句，然后照做了。** 我先前建议不去 Dribbble / Behance，理由是那边给的是
 * 一张图、没有 DOM、没有许可。他明确要去 —— 那就去，但把分工写清楚：
 *   **真的 app（Xero / Fresha / Zoho…）给「结构」** —— 它们扛过真资料、真拇指、真内容量
 *   **作品站给「特点」** —— 概念稿不受真资料约束，所以敢做，但照抄结构会在真资料上塌
 * 两边都拿，各拿各的那一半（[重点 7h](docs/founder-points.md)：一个来源留一点，不要推翻）。
 *
 * ⚠️ **探过路才写进名单的**（2026-09-03 实测）：
 *   Dribbble **连线被重置** · Behance **400** · Figma Community / UI8 / lapa **403** ·
 *   uplabs / uigarage **404**
 *   而 `uisources` · `screensdesign` · `designvault` **三个站字数一模一样 14983** ——
 *   **那不是巧合，是同一张错误页**。三个站回同一份读数，正是这个仓库被骗过四次的那个形状。
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const OUT = ".screenshots/portfolio";
const N = process.argv.includes("--n") ? Number(process.argv[process.argv.indexOf("--n") + 1]) || 12 : 12;

/* 只留探得通、而且真的有手机形状的图的。数字是实测那一轮量到的。 */
const SITES = [
  { key: "mobbin-ios",  url: "https://mobbin.com/browse/ios/apps",     note: "app 里面的真画面（不是商店行销版）" },
  { key: "mobbin-and",  url: "https://mobbin.com/browse/android/apps", note: "同上，安卓" },
  { key: "scrnshts",    url: "https://scrnshts.club/",                 note: "挑过的 App Store 截图" },
  { key: "uimovement",  url: "https://uimovement.com/",                note: "设计师投的稿" },
  { key: "nicelydone",  url: "https://nicelydone.club/apps",           note: "产品的画面" },
];

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const bad = [];
const sheets = [];

for (const site of SITES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
  let urls = [];
  try {
    const r = await p.goto(site.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    if ((r?.status() ?? 0) >= 400) throw new Error(`回 ${r.status()}`);
    await p.waitForTimeout(4000);
    /* 滚几次把懒载入的叫出来 */
    for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(650); }
    urls = await p.evaluate(() =>
      [...document.querySelectorAll("img")]
        /* 手机形状：高是宽的 1.5 倍以上，而且够大。
           ⚠️ 1.5 不是随手写的 —— app 的**图标**是 1:1，用「比较高」会把整墙图标收进来。 */
        .filter((i) => { const r2 = i.getBoundingClientRect();
          return r2.height > r2.width * 1.5 && r2.height > 180 && r2.width > 90; })
        .map((i) => i.currentSrc || i.src)
        .filter((s) => s && s.startsWith("http")));
  } catch (e) { bad.push(`${site.key} ${String(e.message ?? e).slice(0, 44)}`); }
  await p.close();

  urls = [...new Set(urls)].slice(0, N);
  if (urls.length < 4) { bad.push(`${site.key} 只捞到 ${urls.length} 张 —— 当成没捞到`); continue; }

  const tiles = [];
  for (const u of urls) {
    try {
      const q = await b.newPage();
      const buf = await q.goto(u, { timeout: 30000 }).then((r) => r.body());
      await q.close();
      const m = await sharp(buf).metadata();
      if (!m.width || m.width < 120) continue;
      tiles.push(await sharp(buf).resize({ height: 560 }).jpeg({ quality: 76 }).toBuffer());
    } catch { /* 单张抓不到就跳过，不算整站失败 */ }
  }
  if (tiles.length < 4) { bad.push(`${site.key} 图抓得到网址但下载不到（${tiles.length} 张）`); continue; }

  const ms = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const GAP = 10, TOP = 54;
  const W = ms.reduce((a, m) => a + m.width + GAP, GAP);
  const H = 560 + TOP + GAP;
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = [`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`,
    `<text x="${GAP}" y="24" font-family="system-ui" font-size="19" font-weight="700" fill="#fff">${esc(site.key)}</text>`,
    `<text x="${GAP}" y="44" font-family="system-ui" font-size="13" fill="#9aa3ab">${esc(site.note)} · ${tiles.length} 张</text>`];
  let x = GAP;
  const comp = tiles.map((t, i) => { const at = { input: t, left: x, top: TOP }; x += ms[i].width + GAP; return at; });
  svg.push("</svg>");
  comp.push({ input: Buffer.from(svg.join("")), left: 0, top: 0 });
  const file = `${OUT}/${site.key}.jpg`;
  await sharp({ create: { width: W, height: H, channels: 3, background: "#111" } })
    .composite(comp).jpeg({ quality: 76 }).toFile(file);
  sheets.push({ file, n: tiles.length, w: W, h: H });
  console.log(`  ${site.key.padEnd(13)} ${String(tiles.length).padStart(2)} 张  ${W}×${H}  → ${file}`);
}
await b.close();

if (bad.length) console.log("\n🔴 " + bad.join("\n🔴 "));
console.log(`\n${sheets.length} 张对照图在 ${OUT}/`);
console.log("⚠️ 这些是**特点**的来源，不是**结构**的来源 —— 结构照抄概念稿会在真资料上塌。");
if (!sheets.length) process.exit(1);
