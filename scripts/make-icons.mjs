/**
 * 手机主画面那一格的图标。
 *
 * ── 为什么是产生出来的档案，不是一个会跑的路由 ─────────────────────────
 *
 * `app/apple-icon.tsx` 是 Next 在跑的时候画的，网址在正式环境会带一个杂凑
 * （`/apple-icon?<hash>`）。清单档（manifest）是我们自己写的一份 JSON，
 * 它里面的网址要固定不变 —— 一个会变的网址写进一份被浏览器快取住的清单，
 * 就是某一天图标变成空白而没有人知道为什么。
 *
 * 所以图标是**先画好的档案**，放在 `public/`：
 *   icon-192.png / icon-512.png       一般用途
 *   icon-maskable-512.png             安卓会把图标切成它自己的形状
 *                                     （圆的 · 圆角方的 · 水滴），所以内容
 *                                     要缩在中间八成里，不然「F」会被切掉角
 *
 * ⚠️ 颜色跟形状**照抄 `app/apple-icon.tsx`**，不是另外设计的一版。
 * 两个地方画同一个牌子而长得不一样，是这个仓库栽过六次的那件事。
 *
 * ⚠️ 「F」是画出来的路径，不是打出来的字：一个字型档在这台机器上有、
 * 在别台机器上没有，产生出来的图就会不一样，而没有人会发现。
 *
 * 跑：node scripts/make-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const BG = "#0a1020";
const GLOW = "rgba(34,97,221,0.55)";
const FG = "#7fa8f7";

/** 一个 512×512 的方块。`inset` 是内容要缩在中间多少（0 = 满版）。 */
function svg(inset) {
  const s = 512;
  const k = 1 - inset * 2; // 内容的比例
  // 「F」在 512 里的骨架，先算满版再照 k 缩放，所以两版永远同一个形状。
  const stemW = 52, barTop = 52, barMid = 46;
  const x0 = 186, y0 = 120, w = 154, h = 272;
  const g = (v, origin) => origin + (v - origin) * k;
  const cx = 256, cy = 256;
  const X = (v) => g(v, cx).toFixed(1);
  const Y = (v) => g(v, cy).toFixed(1);
  const W = (v) => (v * k).toFixed(1);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="g" cx="30%" cy="18%" r="60%">
      <stop offset="0%" stop-color="${GLOW}"/>
      <stop offset="72%" stop-color="rgba(10,16,32,0)"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="${BG}"/>
  <rect width="${s}" height="${s}" fill="url(#g)"/>
  <g fill="${FG}">
    <rect x="${X(x0)}" y="${Y(y0)}" width="${W(stemW)}" height="${W(h)}" rx="${W(6)}"/>
    <rect x="${X(x0)}" y="${Y(y0)}" width="${W(w)}" height="${W(barTop)}" rx="${W(6)}"/>
    <rect x="${X(x0)}" y="${Y(y0 + 110)}" width="${W(w - 32)}" height="${W(barMid)}" rx="${W(6)}"/>
  </g>
</svg>`);
}

mkdirSync("public", { recursive: true });
const jobs = [
  ["public/icon-512.png", 512, 0.02],
  ["public/icon-192.png", 192, 0.02],
  // 安卓的安全区是中间 80%：内容缩 10% 才不会被切角。
  ["public/icon-maskable-512.png", 512, 0.12],
];
for (const [out, size, inset] of jobs) {
  await sharp(svg(inset)).resize(size, size).png().toFile(out);
  console.log("→", out, `${size}×${size}`);
}
