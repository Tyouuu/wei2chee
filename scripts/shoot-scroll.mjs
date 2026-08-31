/* 滚动逐格拍 —— 给「滚到哪里才出现什么」的页面用。
 *
 * 老板 2026-08-31:「你拍的不完全 因為他們是滑動 然後又有新的畫面 你完全沒拍到」。
 *
 * ⚠️ 他讲对了，而这跟今天修了一整天的那类错是同一个：
 * **整页截图（fullPage）拍的是静止状态**。Chromium 拍 fullPage 的时候会把视窗
 * 撑成整页高，於是 scroll-driven 的东西一个都不触发 —— 拍回来一大片黑，
 * 而那不是留白，是没拍到。
 *
 * 这里改成：真的视窗、真的滚、每一格拍一张，最后拼成一张联络表。
 *   node scripts/shoot-scroll.mjs <网址> <名字> [--frames 16] [--w 1440]
 */
import { chromium } from "playwright";
import fs from "node:fs";

const [url, name] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!url || !name) { console.error("用法: node scripts/shoot-scroll.mjs <网址> <名字> [--frames 16] [--w 1440]"); process.exit(1); }
const N = Number(process.argv[process.argv.indexOf("--frames") + 1]) || 16;
const W = Number(process.argv[process.argv.indexOf("--w") + 1]) || 1440;
const H = W < 500 ? 844 : 900;

const OUT = `.screenshots/scroll/${name}`;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(2500);

/* 先滚一遍到底，让所有懒载入的东西进来，再回到顶端从头拍 ——
   不这样做，前几格拍到的是「还没准备好」的画面。 */
const total = await p.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 900) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
  window.scrollTo(0, 0);
  return document.body.scrollHeight;
});
await p.waitForTimeout(1500);

const step = Math.max(1, Math.floor((total - H) / (N - 1)));
for (let i = 0; i < N; i++) {
  const y = i * step;
  await p.evaluate((yy) => window.scrollTo(0, yy), y);
  /* 等它把这一格该出现的东西画出来。scroll-driven 的东西通常挂在 rAF 上，
     两帧不够 —— 量过 consider.digital 的 SVG 要 ~600ms 才画完一段。 */
  await p.waitForTimeout(750);
  await p.screenshot({ path: `${OUT}/${String(i).padStart(2, "0")}.jpg`, type: "jpeg", quality: 72 });
}
console.log(`${OUT}/  ${N} 格 · 整页 ${total}px · 视窗 ${W}×${H}`);
await b.close();
