/**
 * `npm run brief:app` —— 从一张 app 截图量出 **DESIGN BRIEF**，五条带数字。
 *
 * 老板 2026-09-03：`你做的完全就不像啊`。**他讲对了**，而原因不是手艺，
 * 是顺序：我抄的是一句话（「一个大数字」），不是那一页的设计语言。
 * [重点 7k](docs/founder-points.md) 白纸黑字写着这一步不可以跳：
 * **先写 DESIGN BRIEF，五条带数字，跳了就变成「看到布局没看到设计语言」**。
 *
 * ⚠️ 它量的是**一张图**，不是一个网页 —— 手机 app 没有 DOM 可以读
 * （ServiceM8 403 · Jobber 被挡 · Housecall 连线被重置）。所以能量的只有
 * 像素答得出来的那几件，其余印「量不到」，不猜：
 *   版面：手机屏在图里哪一块 · 顶栏多高 · 底栏多高 · 中间分几条横带
 *   颜色：地 · 顶栏 · 底栏 · 白底上的主色（面积排序，只数坐在白底上的）
 *   留白：左右留多少 · 横带之间的缝
 *   字体 / 动效：**量不到**（一张静图给不了）
 *
 * 用法：node scripts/brief-app.mjs .screenshots/clone/ref-ledger.png
 */
import sharp from "sharp";

const FILE = process.argv[2];
if (!FILE) { console.error("用法: node scripts/brief-app.mjs <图>"); process.exit(1); }

function ok(r8, g8, b8) {
  const f = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const r = f(r8), g = f(g8), b = f(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    C: Math.hypot(1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
                  0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s) };
}
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const src = sharp(FILE);
const meta = await src.metadata();
const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, CH = info.channels;
const px = (x, y) => { const i = (y * W + x) * CH; return [data[i], data[i + 1], data[i + 2]]; };

/* ── ① 手机屏在这张图的哪一块 ───────────────────────────────────────────
   商店图是行销版：深色底板、大标题、手机带边框斜放。要量的是**屏幕里面**，
   不是整张海报。找法：一列一列问「这一列有多少比例是亮的」，
   连续够亮的那一段就是屏幕的左右缘；再对行做同一件事。
   ⚠️ 找不到就要讲「量不到」，不要拿整张海报去量然后报一份看起来很正常的读数。 */
const bright = (x, y) => ok(...px(x, y)).L > 0.72;
const colHit = [], rowHit = [];
for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y += 3) if (bright(x, y)) n++; colHit[x] = n / (H / 3); }
for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x += 3) if (bright(x, y)) n++; rowHit[y] = n / (W / 3); }
const span = (arr, lim) => {
  let best = [0, -1], cur = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] >= lim) { if (cur < 0) cur = i; }
    else { if (cur >= 0 && i - cur > best[1] - best[0]) best = [cur, i]; cur = -1; }
  }
  if (cur >= 0 && arr.length - cur > best[1] - best[0]) best = [cur, arr.length];
  return best;
};
const [x0, x1] = span(colHit, 0.45);
const [y0, y1] = span(rowHit, 0.35);
const sw = x1 - x0, sh = y1 - y0;
const found = sw > W * 0.25 && sh > H * 0.3;

console.log(`\nDESIGN BRIEF · ${FILE}`);
console.log(`原图 ${W}×${H}`);
if (!found) { console.log("🔴 找不到手机屏那一块 —— 量不到，不往下猜"); process.exit(1); }
console.log(`屏幕 ${sw}×${sh}  在 x ${x0}–${x1} · y ${y0}–${y1}   （占整张 ${(100*sw*sh/(W*H)).toFixed(0)}%）`);

/* 之后每一个数字都换算成 390px 宽的手机，这样才跟我们那一支比得了。 */
const k = 390 / sw;
const to390 = (v) => Math.round(v * k);

/* ── ② 横带：一行一行看颜色，颜色跳一次就是一条界 ───────────────────── */
const rowColour = [];
for (let y = y0; y < y1; y++) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let x = x0 + Math.round(sw * 0.06); x < x1 - Math.round(sw * 0.06); x += 4) { const c = px(x, y); r += c[0]; g += c[1]; b += c[2]; n++; }
  rowColour.push([r / n, g / n, b / n]);
}
const bands = [];
let start = 0;
for (let i = 1; i < rowColour.length; i++) {
  const d = Math.abs(rowColour[i][0] - rowColour[start][0]) + Math.abs(rowColour[i][1] - rowColour[start][1]) + Math.abs(rowColour[i][2] - rowColour[start][2]);
  if (d > 26) { if (i - start > sh * 0.012) bands.push({ from: start, to: i, c: rowColour[start] }); start = i; }
}
bands.push({ from: start, to: rowColour.length, c: rowColour[start] });

const ground = (() => {
  const Q = 12, bins = new Map();
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const [r, g, b] = px(x, y);
    const key = `${Math.round(r / Q)},${Math.round(g / Q)},${Math.round(b / Q)}`;
    const e = bins.get(key); if (e) e.n++; else bins.set(key, { n: 1, r, g, b });
  }
  const t = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  return { hex: hex(t.r, t.g, t.b), pct: 0 };
})();

console.log(`\n【颜色】`);
console.log(`  地          ${ground.hex}`);
console.log(`  顶部那一带  ${hex(...bands[0].c)}  高 ${to390(bands[0].to - bands[0].from)}px`);
const last = bands[bands.length - 1];
console.log(`  底部那一带  ${hex(...last.c)}  高 ${to390(last.to - last.from)}px`);

/* 白底上的主色 —— 跟 align:app 同一支算法 */
{
  const isW = (x, y) => { if (x < x0 || x >= x1) return false; const c = ok(...px(x, y)); return c.L > 0.9 && c.C < 0.03; };
  const Q = 18, bins = new Map(); let n = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const [r, g, b] = px(x, y); if (ok(r, g, b).C < 0.06) continue;
    if (!(isW(x - 10, y) || isW(x + 10, y))) continue;
    n++; const key = `${Math.round(r / Q)},${Math.round(g / Q)},${Math.round(b / Q)}`;
    const e = bins.get(key); if (e) e.n++; else bins.set(key, { n: 1, r, g, b });
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n).slice(0, 3);
  console.log(`  白底上的主色 ${n > 150 ? top.map((c) => hex(c.r, c.g, c.b) + " " + (100 * c.n / n).toFixed(0) + "%").join("  ") : "量不到"}`);
}

console.log(`\n【版面】换算成 390px 宽的手机`);
console.log(`  一共 ${bands.length} 条横带`);
bands.forEach((b2, i) => {
  const h = to390(b2.to - b2.from);
  if (h < 6) return;
  console.log(`    带${String(i + 1).padStart(2)}  高 ${String(h).padStart(4)}px  ${hex(...b2.c)}`);
});

/* ── ③ 留白：左右第一个不是地色的像素在哪 ──────────────────────────── */
{
  const mid = Math.round((y0 + y1) / 2);
  const gc = px(x0 + Math.round(sw / 2), y0 + Math.round(sh * 0.5));
  const near = (c) => Math.abs(c[0] - gc[0]) + Math.abs(c[1] - gc[1]) + Math.abs(c[2] - gc[2]) < 40;
  let L = 0, R = 0;
  for (let x = x0; x < x1; x++) { if (!near(px(x, mid))) break; L++; }
  for (let x = x1 - 1; x > x0; x--) { if (!near(px(x, mid))) break; R++; }
  console.log(`\n【留白】`);
  console.log(`  左右边距    左 ${to390(L)}px · 右 ${to390(R)}px  （拿中间那一行量的）`);
}

console.log(`\n【字体】  量不到 —— 一张静图看不出字体档名字`);
console.log(`【动效】  量不到 —— 静图就是没有`);
console.log(`\n⚠️ 它只给数字。**像不像是眼睛判的，它不判。**`);
