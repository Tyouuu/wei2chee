/**
 * `npm run shoot:clone` —— **它抄的那一张 · 我们做出来的那一张**，并排。
 *
 * 老板 2026-09-03：`模版照片呢 我要看到对比 我才懂你有没有复刻成功啊`。
 * **他讲对了** —— 我给了六支手机，却没有把它抄的那一张放旁边，那样他判不了。
 * [重点 5b](docs/founder-points.md)：每做完一样都要出 before/after；
 * [重点 24](docs/founder-points.md)：**像不像只有眼睛判得了**，而眼睛要有两张图才判得了。
 *
 * ⚠️ **不是从 `.screenshots/appui/<app>.jpg` 裁的。** 那六张是 1856×656 的横条，
 * 一支手机切出来只有 ~370px 宽，放大就是糊的 —— 而他 2026-09-03 才讲过
 * `太模糊了 我看不到`。这支脚本**去商店抓原图**：Play 商店的图网址结尾带
 * `=w<宽>-h<高>`，把它换成一个大的就拿得到高解析度的原档。
 *
 * ⚠️ **抓不到就要红。** 一张抓不到的参考图，跟一张「这一套很简单」的参考图，
 * 在报告里长得一模一样 —— 这个仓库被那个形状骗过至少四次。
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import { PAIRS, OUT, refShot } from "./clone-pairs.mjs";

const PAGE = process.argv.includes("--page")
  ? process.argv[process.argv.indexOf("--page") + 1]
  : null;
if (!PAGE) { console.error("用法: node scripts/shoot-clone-vs.mjs --page <我们那一页的网址>"); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const bad = [];

/* ── ② 我们那一支 ───────────────────────────────────────────────────── */
const ours = await b.newPage({ viewport: { width: 1760, height: 1250 }, deviceScaleFactor: 3 });
await ours.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
await ours.waitForTimeout(1200);

console.log(`\n复刻对比 · ${PAIRS.length} 套\n`);
const cards = [];

for (const pair of PAIRS) {
  const el = await ours.$(`.phone[data-reg="${pair.reg}"]`);
  if (!el) { bad.push(`我们这边没有 ${pair.reg}`); continue; }
  const mine = await el.screenshot({ type: "png" });
  const ref = await refShot(pair, b, bad);

  const H = 1500;                                   // 两边都拉到同一个高度才比得了
  const mineTall = await sharp(mine).resize({ height: H }).png().toBuffer();
  const mm = await sharp(mineTall).metadata();
  const theirs = ref ? await sharp(ref.buf).resize({ height: H }).png().toBuffer() : null;
  const tm = theirs ? await sharp(theirs).metadata() : { width: mm.width, height: H };

  const GAP = 26, PAD = 26, LABEL = 96;
  const W = PAD * 2 + tm.width + GAP + mm.width;
  const TOT = LABEL + H + PAD;
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg width="${W}" height="${TOT}" xmlns="http://www.w3.org/2000/svg">
    <text x="${PAD}" y="34" font-family="system-ui" font-size="25" font-weight="700" fill="#111">${esc(pair.zh)} ${pair.reg}</text>
    <text x="${PAD}" y="62" font-family="system-ui" font-size="15" fill="#555">抄 ${esc(pair.app)} · 拿的是「${esc(pair.take)}」</text>
    <text x="${PAD}" y="${LABEL - 8}" font-family="ui-monospace,monospace" font-size="14" fill="#777">它 · ${esc(pair.app)}${ref ? ` （第 ${ref.n + 1}/${ref.total} 张 · ${esc(ref.from)}）` : " —— 抓不到"}</text>
    <text x="${PAD + tm.width + GAP}" y="${LABEL - 8}" font-family="ui-monospace,monospace" font-size="14" fill="#777">我们 · ${esc(pair.zh)}</text>
  </svg>`;

  const comp = [{ input: Buffer.from(svg), left: 0, top: 0 },
                { input: mineTall, left: PAD + tm.width + GAP, top: LABEL }];
  if (theirs) comp.push({ input: theirs, left: PAD, top: LABEL });

  const file = `${OUT}/vs-${pair.reg}.jpg`;
  await sharp({ create: { width: W, height: TOT, channels: 3, background: "#f4f4f5" } })
    .composite(comp).jpeg({ quality: 82 }).toFile(file);
  cards.push({ file, reg: pair.reg });
  console.log(`  ${pair.zh.padEnd(3)} ${pair.reg.padEnd(10)} ${pair.app.padEnd(12)} ${ref ? `参考 ${ref.w}×${ref.h}` : "🔴 参考抓不到"}  → ${file}`);
}

await ours.close();
await b.close();

console.log(`\n一套一张，${OUT}/vs-<风格>.jpg`);
if (bad.length) { console.log("\n🔴 " + bad.join("\n🔴 ")); console.log("\n判：抓不到就是失败，不是「这一套很简单」"); process.exit(1); }
console.log(`判：${PAIRS.length} 套的参考都抓到了`);
console.log("⚠️ 这支脚本只负责把两张摆在一起。**像不像是眼睛判的，它不判。**");
