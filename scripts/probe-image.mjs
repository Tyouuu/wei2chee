/* 从**图**上量一页后台 —— 不读 DOM，只读像素。
 *
 *   node scripts/probe-image.mjs <图档> [更多图档...]
 *
 * ── 为什么要有它 ──────────────────────────────────────────────────────────
 * 老板 2026-09-03：`你不能帮我去反用在图片上 就是利用好我们的尺子
 * 我们的尺子是很有用的`。
 *
 * 他讲对了，而且这一支解掉的正是前一天卡住的那件事：
 * **每一家的 DOM 都不一样，而画面是同一种东西。**
 * `align:admin` 读 DOM 读到过「其他 ×14」（Tabler 的一整排小走势卡）、
 * 「图 0 张」（我们自己画面上明明有柱状图跟圆环）。那不是门槛调不准，
 * 是**同一个视觉物件，在十家的 DOM 里有十种写法**。
 *
 * 官网那把尺（`npm run align`）也读 DOM，所以它读后台会印
 * 「段数 1 · 🔴 这个 DOM 尺子看不懂」—— 试过了，见 align-admin.mjs 的档头。
 *
 * ⚠️ **像素跟 [重点 24](../docs/founder-points.md) 是同一边的**：
 * 客人用眼睛看的是画面，不是 DOM。所以从图上量出来的东西，
 * 比从 DOM 上量出来的更接近「他到底看到什么」。
 *
 * ⚠️ **它一样只能否决，不能通过。** 它答得了「他们六条带、我们三条」，
 * 答不了「好不好看」。
 *
 * ⚠️ **它读不到字。** 一条带里是「一张图」还是「一段字」，像素分得出密度、
 * 分不出意思 —— 所以它跟 DOM 那一支是**互补**，不是替代：
 * 一个答「画面上摆了几块、多大、多满」，一个答「那一块是什么」。
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

/** 量到的宽度。缩到这里再算 —— 一张 1440 的图缩到 900，
 *  一条 1px 的分隔线还在，而算得快十倍。 */
const W = 900;

function oklabC(r8, g8, b8) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = f(r8), g = f(g8), b = f(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return Math.hypot(
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  );
}

/** 人眼看得出的明度。用它判「这一格跟地一不一样」，不用 RGB 的距离 ——
 *  `#001529` 跟 `#000000` 的 RGB 距离很小，眼睛却分得出来。 */
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export async function measureImage(input) {
  /* 🔴 原尺寸要在缩之前问。第一版全程用 `info.width`，而那是**缩完之后**的
     900 —— 於是 scale 永远是 1，报出来的每一个像素数都比真的小 1.6 倍
     （Tabler 的卡报 192，实际 307）。一把单位错了的尺，每一个数字都错，
     而它看起来完全正常。 */
  const src = await sharp(input).metadata();
  const { data, info } = await sharp(input)
    .resize({ width: W, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const at = (x, y) => {
    const i = (y * w + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // ── 地是什么颜色 ─────────────────────────────────────────────────────────
  /* 取**出现最多**的那个颜色，量化到 16 一阶。用中位数会在
     「一半白一半深」的页面上给出一个不存在的中间色。 */
  const bins = new Map();
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const [r, g, b] = at(x, y);
      const k = `${r >> 4},${g >> 4},${b >> 4}`;
      bins.set(k, (bins.get(k) || 0) + 1);
    }
  }
  let top = null, topN = 0;
  for (const [k, n] of bins) if (n > topN) { topN = n; top = k; }
  const ground = top.split(",").map((v) => Number(v) * 16 + 8);
  /* 🔴 门槛第一版设 14 阶明度，**整批参考的侧栏全部报 0**。
     查出来：现代那几套后台是**近白的卡片压在近白的地上**
     （TailAdmin 地 #f8f8f8、卡 #fff，只差 7 阶），松的门槛把卡也算成地，
     於是画面上明明一格一格，profile 上是一片平的。
     地是一个**平的**颜色，所以门槛可以设得很紧。 */
  const isGround = (x, y) => {
    const [r, g, b] = at(x, y);
    return (
      Math.abs(lum(r, g, b) - lum(ground[0], ground[1], ground[2])) < 5 &&
      Math.abs(r - ground[0]) < 10 && Math.abs(g - ground[1]) < 10 && Math.abs(b - ground[2]) < 10
    );
  };

  // ── 侧栏：左边有没有一条整页高、颜色跟地不一样的柱 ────────────────────────
  /* 用「这一栏有几成的高度不是地色」来判，不是用一两个取样点 ——
     侧栏上有字有图标，取样点很容易正好落在字上。 */
  const colDiff = [];
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = 0; y < h; y += 3) if (!isGround(x, y)) n++;
    colDiff.push(n / Math.ceil(h / 3));
  }
  let rail = 0;
  /* 从左往右走，只要这一栏「几乎整条都不是地色」就还在侧栏里。
     一断掉就停 —— 内容区里的卡片也不是地色，但它上下都有缝。 */
  while (rail < w * 0.35 && colDiff[rail] > 0.72) rail++;
  if (rail < 12) rail = 0; // 十几个像素的边框不是侧栏
  const railScale = rail ? Math.round(rail * ((src.width || info.width) / w)) : 0;

  // ── 画面被切成几块：把图铺成格子，数连在一起的那几团 ──────────────────────
  /* 🔴 前两版都栽在同一件事上，方向相反：
       松的门槛 → 近白的卡被当成地，整页读成「一片平的」，侧栏全部报 0
       紧的门槛 → jpeg 压缩在卡片边缘留的杂点也算「不是地」，整页读成一条带
     两次都是**拿单一个像素去问一个关于一块区域的问题**。

     改成先把图铺成格子（一格约 12px 见方），**一格投一次票**：
     这一格里过半的像素是地色，它就是地。杂点投不赢一整格，
     而近白的卡片整格都不是地色，投得赢。 */
  /* 🔴 12px 一格太粗。中台那一页四张卡之间的缝是 **14px**，
     一格 12 的时候那道缝常常跟卡片挤在同一格里，投票投给卡 ——
     於是四张卡黏成一块，尺子回报「一块，1120 宽」，而 1:1 的裁图上
     那四张卡明明是分开的。**那个「一块」有一半是我的探针造的。**
     改成 6px 一格：最窄要认得出的缝是 8px 上下，一格必须比它小。 */
  const CELL = Math.max(4, Math.round(6 / ((src.width || info.width) / w || 1)));
  const gw = Math.floor(w / CELL), gh = Math.floor(h / CELL);
  const x0cell = rail ? Math.ceil((rail + 2) / CELL) : 0;
  const cell = new Uint8Array(gw * gh); // 1 = 不是地
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      let n = 0, t = 0;
      for (let y = cy * CELL; y < (cy + 1) * CELL; y += 2)
        for (let x = cx * CELL; x < (cx + 1) * CELL; x += 2) { t++; if (!isGround(x, y)) n++; }
      cell[cy * gw + cx] = n / Math.max(1, t) > 0.5 ? 1 : 0;
    }
  }

  const scale = (src.width || info.width) / w || 1;
  const real = (v) => Math.round(v * scale);

  /* 一条带 = 连着几列格子里都有东西的那几行。用格子数，不用像素数。 */
  const rowHas = [];
  for (let cy = 0; cy < gh; cy++) {
    let n = 0;
    for (let cx = x0cell; cx < gw; cx++) if (cell[cy * gw + cx]) n++;
    rowHas.push(n / Math.max(1, gw - x0cell));
  }
  const bandList = [];
  { let start = -1;
    for (let cy = 0; cy <= gh; cy++) {
      const on = cy < gh && rowHas[cy] > 0.06;
      if (on && start < 0) start = cy;
      if (!on && start >= 0) {
        const hpx = real((cy - start) * CELL);
        if (hpx >= 30) bandList.push({ top: real(start * CELL), h: hpx });
        start = -1;
      }
    }
  }
  const gaps = [];
  for (let i = 1; i < bandList.length; i++)
    gaps.push(bandList[i].top - (bandList[i - 1].top + bandList[i - 1].h));

  /* 块 = 连在一起的一团格子（四邻）。**这才是画面上那一格一格。** */
  const seen = new Uint8Array(gw * gh);
  const blobs = [];
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = x0cell; cx < gw; cx++) {
      const i = cy * gw + cx;
      if (!cell[i] || seen[i]) continue;
      let minx = cx, maxx = cx, miny = cy, maxy = cy, n = 0;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const k = stack.pop();
        const y = (k / gw) | 0, x = k % gw;
        n++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
        const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        for (const [nx, ny] of nb) {
          if (nx < x0cell || ny < 0 || nx >= gw || ny >= gh) continue;
          const kk = ny * gw + nx;
          if (cell[kk] && !seen[kk]) { seen[kk] = 1; stack.push(kk); }
        }
      }
      /* 🔴 太小的是图标跟一行字，不是一块。
         第一版设 3 格宽 × 2 格高（约 36×24px），於是**一个词就算一块** ——
         我们那几页读出「块宽 74」「块宽 87」，而画面上没有 74px 宽的卡。
         一张卡至少一个巴掌大：横过 6 格（约 72px）、上下 3 格，而且要够实。 */
      if (n >= 60 && maxx - minx >= 10 && maxy - miny >= 4)
        blobs.push({ x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 });
    }
  }
  const cards = blobs.length;
  const widths = blobs.map((b) => real(b.w * CELL));
  /* 一行最多几块：把块按上缘分行，同一行的上缘差不过一格。 */
  const byRow = new Map();
  for (const b of blobs) {
    const key = Math.round(b.y / 2);
    byRow.set(key, (byRow.get(key) || 0) + 1);
  }
  const perRowMax = byRow.size ? Math.max(...byRow.values()) : 0;

  // ── 卡是什么颜色、主色是什么 ──────────────────────────────────────────────
  /* 反推要用的两个颜色：
       **卡色** —— 块里面最常见的颜色（不是地色的那一个）
       **主色** —— 整页彩度最高、而且铺得够大的那一个（按钮、图表、强调）
     两个都用「出现最多」而不是平均 —— 平均会给出一个页面上不存在的颜色。 */
  const cardBins = new Map();
  const huedBins = new Map();
  for (const b of blobs) {
    for (let cy = b.y; cy < b.y + b.h; cy++) {
      for (let cx = b.x; cx < b.x + b.w; cx++) {
        const px = cx * CELL + (CELL >> 1), py = cy * CELL + (CELL >> 1);
        if (px >= w || py >= h) continue;
        const [r, g, bb] = at(px, py);
        const k = `${r >> 4},${g >> 4},${bb >> 4}`;
        cardBins.set(k, (cardBins.get(k) || 0) + 1);
      }
    }
  }
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const [r, g, bb] = at(x, y);
      if (oklabC(r, g, bb) > 0.06) {
        const k = `${r >> 4},${g >> 4},${bb >> 4}`;
        huedBins.set(k, (huedBins.get(k) || 0) + 1);
      }
    }
  }
  const pick = (m) => {
    let k = null, n = 0;
    for (const [kk, nn] of m) if (nn > n) { n = nn; k = kk; }
    return k ? k.split(",").map((v) => Number(v) * 16 + 8) : null;
  };
  const hex = (c) => (c ? "#" + c.map((v) => Math.min(255, v).toString(16).padStart(2, "0")).join("") : null);
  const card = pick(cardBins);
  const accent = pick(huedBins);

  // ── 骨架：一行几块、每块多宽多高 ──────────────────────────────────────────
  /* 反推组成要的就是这个：把块按上缘分行，每一行印出几块跟它们的宽。
     「一行四张 307 宽 → 再一张满宽的 → 再一张满宽的很高的」
     就是 Tabler 那一页的骨架，而那句话可以直接翻成我们的组成。 */
  const rowsMap = new Map();
  for (const b of blobs) {
    const key = Math.round(b.y / 2);
    if (!rowsMap.has(key)) rowsMap.set(key, []);
    rowsMap.get(key).push(b);
  }
  const skeleton = [...rowsMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, bs]) => ({
      n: bs.length,
      widths: bs.map((b) => real(b.w * CELL)).sort((a, b) => b - a),
      h: real(Math.max(...bs.map((b) => b.h)) * CELL),
    }));

  // ── 有颜色的面积 ─────────────────────────────────────────────────────────
  let hit = 0, tot = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      tot++;
      const [r, g, b] = at(x, y);
      if (oklabC(r, g, b) > 0.035) hit++;
    }
  }

  const med = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length / 2)]);
  };

  return {
    width: src.width || info.width,
    height: src.height || info.height,
    ground: `rgb(${ground.join(",")})`,
    rail: railScale,
    bands: bandList.length,
    bandHeights: bandList.map((b) => b.h),
    bandMedian: med(bandList.map((b) => b.h)),
    gap: med(gaps),
    cards,
    cardWidth: med(widths),
    /* 一行最多几张 —— 「一行四张卡」是这一类页面最认得出的排法。 */
    perRowMax,
    card: hex(card),
    accent: hex(accent),
    skeleton,
    colour: Math.round((hit / tot) * 1000) / 10,
  };
}

/* CLI：量一张或多张，印成一行一张。 */
if (process.argv[1] && process.argv[1].endsWith("probe-image.mjs")) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("用法: node scripts/probe-image.mjs <图档> [更多图档...]");
    process.exit(1);
  }
  console.log(
    "档案".padEnd(24) + "地".padEnd(20) + "侧栏".padStart(5) + "带".padStart(4) +
      "带中位".padStart(8) + "缝".padStart(5) + "卡".padStart(4) + "一行".padStart(5) +
      "卡宽".padStart(6) + "有颜色".padStart(8),
  );
  for (const f of files) {
    try {
      const m = await measureImage(f);
      const name = f.split(/[\\/]/).pop().replace(/\.(jpg|png)$/, "");
      console.log(
        name.padEnd(24) +
          String(m.ground).padEnd(20) +
          String(m.rail).padStart(5) +
          String(m.bands).padStart(4) +
          String(m.bandMedian ?? "—").padStart(8) +
          String(m.gap ?? "—").padStart(5) +
          String(m.cards).padStart(4) +
          String(m.perRowMax).padStart(5) +
          String(m.cardWidth ?? "—").padStart(6) +
          (m.colour + "%").padStart(8),
      );
    } catch (e) {
      console.log(f.padEnd(24) + "🔴 读不到 " + String(e).slice(0, 40));
    }
  }
}
