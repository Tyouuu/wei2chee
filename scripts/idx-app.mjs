/**
 * `node scripts/idx-app.mjs <名字>=<包名> ...`
 * 一个 app 一张**编号索引图** —— 商店里那几张截图，逐张编号摊开。
 *
 * 为什么要它：`shoot-clone-vs.mjs` 的 `pick` 是「取第几张」，
 * 而那个数字**只能用眼睛挑**（[重点 3](docs/founder-points.md)）——
 * 挑真的画着界面的那一张，不是行销大标题那一张。
 * 没有索引图就只能猜，而猜错拍回来是一张行销海报，**读数上跟真的界面长得一样**。
 *
 * ⚠️ 抓不到就是失败，不是「这个 app 很简单」—— 包名猜错时商店回的是错误页。
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const OUT = ".screenshots/clone";
const args = process.argv.slice(2).filter((a) => a.includes("="));
if (!args.length) { console.error("用法: node scripts/idx-app.mjs xero=com.xero.touch ..."); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const bad = [];

for (const arg of args) {
  const [name, id] = arg.split("=");
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  let urls = [];
  try {
    await p.goto(`https://play.google.com/store/apps/details?id=${id}&hl=en`,
      { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(3500);
    urls = await p.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((i) => {
          const r = i.getBoundingClientRect();
          return r.height > r.width * 1.5 && r.height > 150 && r.x + r.width < 1000;
        })
        .map((i) => i.src).filter((s) => s.startsWith("http")));
  } catch (e) { bad.push(`${name} ${String(e.message ?? e).slice(0, 60)}`); }
  await p.close().catch(() => {});

  if (!urls.length) { bad.push(`${name} (${id}) 一张截图都没抓到 —— 包名可能是错的`); continue; }

  const H = 620, GAP = 14, PAD = 16, TOP = 44;
  const shots = [];
  for (const u of urls.slice(0, 10)) {
    const q = await b.newPage();
    try {
      const buf = await q.goto(u.replace(/=[-\w]+$/, "=w1080"), { timeout: 45000 }).then((r) => r.body());
      shots.push(await sharp(buf).resize({ height: H }).png().toBuffer());
    } catch { /* 少一张不算失败，全部少才是 */ }
    await q.close().catch(() => {});
  }
  if (!shots.length) { bad.push(`${name} 图网址拿到了，档案抓不下来`); continue; }

  const metas = await Promise.all(shots.map((s) => sharp(s).metadata()));
  const W = PAD * 2 + metas.reduce((a, m) => a + m.width, 0) + GAP * (shots.length - 1);
  let x = PAD;
  const comp = [];
  let svg = `<svg width="${W}" height="${TOP + H + PAD}" xmlns="http://www.w3.org/2000/svg">`
    + `<text x="${PAD}" y="28" font-family="system-ui" font-size="22" font-weight="700" fill="#111">${name} · ${id} · ${urls.length} 张</text>`;
  shots.forEach((s, i) => {
    comp.push({ input: s, left: x, top: TOP });
    svg += `<text x="${x + 8}" y="${TOP - 6}" font-family="ui-monospace,monospace" font-size="17" font-weight="700" fill="#c2410c">${i}</text>`;
    x += metas[i].width + GAP;
  });
  svg += "</svg>";
  const file = `${OUT}/idx-${name}.jpg`;
  await sharp({ create: { width: W, height: TOP + H + PAD, channels: 3, background: "#ffffff" } })
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...comp]).jpeg({ quality: 84 }).toFile(file);
  console.log(`  ${name.padEnd(12)} ${String(shots.length).padStart(2)} 张  → ${file}`);
}

await b.close();
if (bad.length) { console.log("\n🔴 " + bad.join("\n🔴 ")); process.exit(1); }
