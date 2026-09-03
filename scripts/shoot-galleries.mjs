/* 设计作品站的实拍 —— 老板 2026-09-03：`我需要你去找更多的素材
 * 就是去到那种freelancer展示自己做的作品的网站去找`。
 *
 * ⚠️ **我之前顶过这件事，理由现在不成立了。** 我说过那些站「只有图，量不了」——
 * 而 9-03 做的 `probe-image.mjs` 就是量图的。**一张 jpg 现在是可用素材。**
 *
 * ⚠️ 它们跟开源后台是两种东西，别混：
 *   开源后台 → 可以读代码、可以拿（许可干净）
 *   作品站   → **只能看**。抄的是「哪几块、怎么排、多密」，
 *              一行代码、一个像素都不能拿（那是别人的著作权作品）
 */
import { chromium } from "playwright";
import fs from "node:fs";

const SITES = [
  ["dribbble",   "https://dribbble.com/search/admin-dashboard"],
  ["behance",    "https://www.behance.net/search/projects/admin%20dashboard%20ui"],
  ["mobbin",     "https://mobbin.com/browse/web/apps"],
  ["saasframe",  "https://www.saasframe.io/"],
  ["uiland",     "https://uiland.design/"],
  ["screenlane", "https://screenlane.com/"],
  ["uisources",  "https://www.uisources.com/"],
  ["godly",      "https://godly.website/websites/dashboard"],
  ["pageflows",  "https://pageflows.com/"],
];

const OUT = ".screenshots/galleries";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [name, url] of SITES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(7000);
    const m = await p.evaluate(() => ({
      words: (document.body.innerText.match(/\S+/g) || []).length,
      /* 够大的图才算作品图 —— 图标跟头像不算。 */
      shots: [...document.querySelectorAll("img")].filter((i) => {
        const r = i.getBoundingClientRect();
        return r.width >= 180 && r.height >= 120;
      }).length,
      title: document.title.slice(0, 50),
      /* 挡爬虫的两种长相：人机验证、要登入。 */
      wall: /verify|are you a human|cloudflare|sign in to continue|log in to continue/i
        .test(document.body.innerText.slice(0, 600)),
    }));
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 62 });
    const note = m.wall ? "  🔴 挡住了" : m.shots < 4 ? "  ⚠️ 几乎没有作品图" : "";
    console.log(`${name.padEnd(12)} 作品图 ${String(m.shots).padStart(3)}  字 ${String(m.words).padStart(5)}  ${m.title}${note}`);
  } catch (e) {
    console.log(`${name.padEnd(12)} 🔴 读不到 ${String(e).slice(0, 44)}`);
  }
  await p.close();
}
await b.close();
console.log(`\n→ ${OUT}/   ⚠️ 用眼睛看，能不能挑得出东西只有眼睛判得了`);
