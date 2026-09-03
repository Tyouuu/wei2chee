/**
 * `npm run zoom:clone` —— **一页一页放大**：它那一张 · 我们那一张，切成三段并排。
 *
 * 老板 2026-09-03：`一页一页放大来优化 尽量复刻到完善 就是我要的质量跟细节`。
 *
 * ⚠️ **为什么不是把 `vs-*.jpg` 拉大**：那张总览一支手机高 1500，
 * 缩到能一眼看完的时候，16px 的字画出来只剩 6px。
 * **放大一张小图不会长出细节**（[任务 107p](docs/founder-tasks.md) 那次
 * 他就说 `太模糊了 我看不到`）—— 要在切的时候就保住像素。
 *
 * 量法：**两边都拉到同一个宽**。手机上每一样东西都是相对 390px 的画布量的，
 * 所以同宽才比得了「这个字占多少」「这条缝多宽」。
 * 不是同高 —— 同高会让两支不同长宽比的手机在横向上失真。
 *
 * 用法：node scripts/zoom-clone.mjs --page <网址> [--only ledger,swiss] [--bands 3] [--refresh]
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import { PAIRS, OUT, refShot } from "./clone-pairs.mjs";

const arg = (k, d) => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d;
const PAGE = arg("--page");
if (!PAGE) { console.error("用法: node scripts/zoom-clone.mjs --page <我们那一页的网址>"); process.exit(1); }
const ONLY = arg("--only", "").split(",").filter(Boolean);
const BANDS = Number(arg("--bands", 3));
const REFRESH = process.argv.includes("--refresh");

const W = 820, GAP = 22, PAD = 22, HEAD = 78;
const list = ONLY.length ? PAIRS.filter((p) => ONLY.includes(p.reg)) : PAIRS;
fs.mkdirSync(`${OUT}/zoom`, { recursive: true });

const b = await chromium.launch();
const bad = [];
const ours = await b.newPage({ viewport: { width: 1760, height: 1250 }, deviceScaleFactor: 3 });
await ours.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
await ours.waitForTimeout(1200);

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
console.log(`\n逐段放大 · ${list.length} 套 × ${BANDS} 段\n`);

for (const pair of list) {
  const el = await ours.$(`.phone[data-reg="${pair.reg}"]`);
  if (!el) { bad.push(`我们这边没有 ${pair.reg}`); continue; }
  const ref = await refShot(pair, b, bad, { refresh: REFRESH });
  if (!ref) continue;

  const mine = await sharp(await el.screenshot({ type: "png" })).resize({ width: W }).png().toBuffer();
  const them = await sharp(ref.buf).resize({ width: W }).png().toBuffer();
  const mh = (await sharp(mine).metadata()).height;
  const th = (await sharp(them).metadata()).height;

  const files = [];
  for (let i = 0; i < BANDS; i++) {
    /* 每一边按**自己的高**切，所以第 i 段永远是「这一支的第 i 段」，
       不是「同一个 y」—— 两支高度不同，同一个 y 指的不是同一个地方。 */
    const cut = (H) => {
      const top = Math.round((H * i) / BANDS);
      const bot = Math.round((H * (i + 1)) / BANDS);
      return { top, height: Math.max(1, bot - top) };
    };
    const cm = cut(mh), ct = cut(th);
    const bandH = Math.max(cm.height, ct.height);
    const mineB = await sharp(mine).extract({ left: 0, width: W, ...cm }).png().toBuffer();
    const themB = await sharp(them).extract({ left: 0, width: W, ...ct }).png().toBuffer();

    const TOTW = PAD * 2 + W * 2 + GAP;
    const TOTH = HEAD + bandH + PAD;
    const svg = `<svg width="${TOTW}" height="${TOTH}" xmlns="http://www.w3.org/2000/svg">
      <text x="${PAD}" y="30" font-family="system-ui" font-size="23" font-weight="700" fill="#111">${esc(pair.zh)} ${pair.reg} · 第 ${i + 1}/${BANDS} 段</text>
      <text x="${PAD}" y="53" font-family="system-ui" font-size="14" fill="#555">抄 ${esc(pair.app)} · 拿的是「${esc(pair.take)}」· ${esc(ref.from)}</text>
      <text x="${PAD}" y="${HEAD - 8}" font-family="ui-monospace,monospace" font-size="13" fill="#777">它 · ${esc(pair.app)}</text>
      <text x="${PAD + W + GAP}" y="${HEAD - 8}" font-family="ui-monospace,monospace" font-size="13" fill="#777">我们 · ${esc(pair.zh)}</text>
    </svg>`;
    const f = `${OUT}/zoom/${pair.reg}-${i + 1}.jpg`;
    await sharp({ create: { width: TOTW, height: TOTH, channels: 3, background: "#f4f4f5" } })
      .composite([{ input: Buffer.from(svg), left: 0, top: 0 },
                  { input: themB, left: PAD, top: HEAD },
                  { input: mineB, left: PAD + W + GAP, top: HEAD }])
      .jpeg({ quality: 88 }).toFile(f);
    files.push(f);
  }
  console.log(`  ${pair.zh.padEnd(3)} ${pair.reg.padEnd(10)} 它 ${ref.w}×${ref.h} → ${files.length} 段`);
}

await ours.close();
await b.close();
console.log(`\n${OUT}/zoom/<风格>-<第几段>.jpg`);
if (bad.length) { console.log("\n🔴 " + bad.join("\n🔴 ")); process.exit(1); }
console.log("⚠️ 它只负责切。**像不像是眼睛判的。**");
