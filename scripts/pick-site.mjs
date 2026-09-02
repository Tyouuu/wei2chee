/* 官网风格的候选筛选 —— 他自己定的两条门槛，第一次真的跑起来。
 *
 * 老板 2026-08-27（[任务 37](docs/founder-tasks.md)）拍板 24 套的时候写下两条：
 *   `不要花哨的颜色` → 整页逐像素转 OKLab，**底色彩度 > 0.06 的淘汰**，
 *                      **主色多於两个的淘汰**
 *   `剔掉不完整的模版` → **段数 < 5 或 图 < 3 的淘汰**
 * 两条都写了一年，一次都没有跑过 —— `.screenshots/awwwards/` 里 16 个外站，
 * 一个都没有过筛。这支脚本就是那两条。
 *
 * ⚠️ **它只能否决，不能通过**（[重点 24](docs/founder-points.md)）。
 * 通过要看 `.screenshots/awwwards/pick.jpg` 那张对照图，用眼睛。
 * 一个 0% 彩度、8 段、10 张图的页面照样可以很难看。
 *
 * ⚠️ **载不到就是失败，不是「这一页很简单」。** 被 Cloudflare 挡、404、
 * 渲染空白，一律判 `读不到` 并且不进候选 —— 这个仓库被「量不到却印一个
 * 漂亮数字」的尺子骗过至少四次（`check:registers` 报 0/0 然后 exit 0 是最贵的
 * 那一次）。
 *
 * 用法：
 *   node scripts/pick-site.mjs https://a.com https://b.com
 *   node scripts/pick-site.mjs --from scratchpad/urls.txt
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const OUT = ".screenshots/awwwards";
const PAGE = 1440;

/* ── 他的四条门槛 ───────────────────────────────────────────────────────── */
const MAX_GROUND_CHROMA = 0.06; // 底色彩度
const MAX_ACCENTS = 2; // 主色几个
const MIN_SECTIONS = 5; // 段数
const MIN_PICTURES = 3; // 大图

/** 一个颜色要占多少面积才算「主色」，不是一颗杂点。 */
const ACCENT_AREA = 2; // %

/* ── 眼睛看不看得出它有颜色 ─────────────────────────────────────────────
   ⚠️ 用 OKLab 的彩度，不是 RGB 的饱和度 —— 跟 `check:register-colour` 同一支
   函式、同一套算法。两把尺用两种彩度，报出来的数字就没办法放在一起讲。 */
function oklab(r8, g8, b8) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = f(r8), g = f(g8), b = f(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    C: Math.hypot(
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ),
  };
}
const srgbToOklabC = (r, g, b) => oklab(r, g, b).C;

/**
 * 底色跟主色，**按面积**算。
 *
 * ⚠️ 「按面积」这三个字是 [任务 39](docs/founder-tasks.md) 用一整天换来的：
 * 那支 skill 按**声明次数**排颜色，於是台账 参考页整页的地 `#45372a`
 * 被判成 content，而一个用了 400 次的边框色排在它前面。**面积骗不了人。**
 */
async function palette(file) {
  const { data, info } = await sharp(file)
    .resize({ width: 300, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const total = info.width * info.height;

  /* 量化成 24 阶一格 —— 太细会把一片渐层拆成几百个「不同的颜色」，
     太粗会把浅灰跟白并成同一格。 */
  const Q = 24;
  const bins = new Map();
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = `${Math.round(r / Q)},${Math.round(g / Q)},${Math.round(b / Q)}`;
    const at = bins.get(key);
    if (at) at.n++;
    else bins.set(key, { n: 1, r, g, b });
  }
  const sorted = [...bins.values()].sort((a, b) => b.n - a.n);
  const ground = sorted[0];
  const accents = sorted.filter(
    (c) => (100 * c.n) / total >= ACCENT_AREA && srgbToOklabC(c.r, c.g, c.b) > MAX_GROUND_CHROMA,
  );
  const g = oklab(ground.r, ground.g, ground.b);
  return {
    groundC: g.C,
    /* ⚠️ 明度也印出来，而且这一栏是必要的不是附送的。
       [任务 100c](docs/founder-tasks.md) 量到 `#001529` 的明度只有 0.191 ——
       眼睛看它跟黑差不了多少，而按彩度算它 16%。**一个深藏青的地跟一个
       桃粉的地可以拿到同一个彩度，而它们不是同一件事。**
       所以彩度负责否决，明度负责让眼睛推翻那个否决。 */
    groundL: g.L,
    groundHex: `#${[ground.r, ground.g, ground.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
    groundPct: (100 * ground.n) / total,
    accents: accents.length,
    accentHex: accents
      .slice(0, 4)
      .map((c) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`),
  };
}

/**
 * 几段 · 几张大图。
 *
 * ⚠️ 分段规则**逐字照抄 `align-site.mjs` 的 readSections** —— 宽度比的是
 * 「这一层最宽的那个」不是视窗，因为有侧栏／有外壳／有最大宽的页面上，
 * 视窗的 90% 是一个没有任何东西达得到的门槛（[任务 79](docs/founder-tasks.md)
 * 实测 tailark 整页读到 0 段就是这一条）。两边不一样，就等於用两把尺
 * 在量同一件事，而报告把它们当成同一份。
 */
function readPage() {
  let pool = [...document.querySelectorAll("section,div[id^='comp-']")];
  const enough = pool.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.height >= 90 && r.width >= window.innerWidth * 0.9;
  });
  if (enough.length < 3) pool = [...document.body.children];

  const secs = pool
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) };
    })
    .filter((x, _i, all) => x.h >= 90 && x.w >= Math.max(...all.map((y) => y.w)) * 0.9)
    .sort((a, b) => a.top - b.top || b.h - a.h);

  /* 一段包住另一段就并起来，跟 align 同一套。 */
  const kept = [];
  for (const b of secs) {
    if (kept.some((o) => b.top >= o.top && b.top + b.h <= o.top + o.h)) continue;
    kept.push(b);
  }

  /* 大图：跟 align 的 readShots 同一个下限（120×90），不是「任何一个 img」。
     ⚠️ 两个数字用两道门槛，正是 [任务 82](docs/founder-tasks.md) 那次
     「6 张对装下 9 张」的假差异 —— 而我还替它配了一句听起来很有道理的解释。 */
  const pics = [...document.querySelectorAll("img,video,canvas,picture")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width >= 120 && r.height >= 90;
  }).length;

  const words = (document.body.innerText || "").replace(/\s+/g, "").length;
  return { sections: kept.length, pics, words, height: document.body.scrollHeight };
}

/* ── 跑 ─────────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const fromAt = argv.indexOf("--from");
const urls =
  fromAt >= 0
    ? fs.readFileSync(argv[fromAt + 1], "utf8").split("\n").map((l) => l.trim()).filter((l) => /^https?:/.test(l))
    : argv.filter((a) => /^https?:/.test(a));

if (!urls.length) {
  console.error("用法: node scripts/pick-site.mjs <网址...>  |  --from <档案>");
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const kept = [];
const cut = [];
const unread = [];

console.log(`\n官网候选筛选 · ${urls.length} 个`);
console.log(`门槛：底色彩度 ≤ ${MAX_GROUND_CHROMA} · 主色 ≤ ${MAX_ACCENTS} · 段数 ≥ ${MIN_SECTIONS} · 大图 ≥ ${MIN_PICTURES}\n`);

for (const url of urls) {
  const host = url.replace(/^https?:\/\/(www\.)?/, "").replace(/[^a-z0-9]/gi, "-").slice(0, 30);
  const file = `${OUT}/cand-${host}.jpg`;
  const p = await b.newPage({ viewport: { width: PAGE, height: 1000 } });
  try {
    const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = resp?.status() ?? 0;
    if (status >= 400) throw new Error(`回 ${status}`);
    await p.waitForTimeout(3500);
    /* 滚一遍，把懒载入的图叫出来 —— 不滚就量到一页只有 1 张图，
       然后照 `大图 < 3` 把一个好页面砍掉。 */
    for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 1400); await p.waitForTimeout(320); }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(600);

    const m = await p.evaluate(readPage);
    /* 🔴 一页只有几十个字，不是「这一页很简单」，是**没载到**。
       Cloudflare 的挑战页、cookie 墙、一个还在转的骨架，全部长这样。 */
    if (m.words < 200) throw new Error(`整页只有 ${m.words} 个字 —— 没载到`);

    await p.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 60 });
    const c = await palette(file);

    const why = [];
    if (c.groundC > MAX_GROUND_CHROMA)
      why.push(
        c.groundL < 0.35
          ? `底色有颜色 ${c.groundC.toFixed(3)} —— ⚠️ 但它是深色底（明度 ${c.groundL.toFixed(2)}），用眼睛复核`
          : `底色太花 ${c.groundC.toFixed(3)}`,
      );
    if (c.accents > MAX_ACCENTS) why.push(`主色 ${c.accents} 个`);
    if (m.sections < MIN_SECTIONS) why.push(`只有 ${m.sections} 段`);
    if (m.pics < MIN_PICTURES) why.push(`只有 ${m.pics} 张图`);

    const row =
      `${host.padEnd(32)} ${String(m.sections).padStart(2)}段 ${String(m.pics).padStart(2)}图 ` +
      `${String(m.height).padStart(6)}px  地 ${c.groundHex} 彩 ${c.groundC.toFixed(3)} 明 ${c.groundL.toFixed(2)} ${c.groundPct.toFixed(0)}%  ` +
      `主色 ${c.accents}${c.accentHex.length ? ` ${c.accentHex.join(" ")}` : ""}`;

    if (why.length) { cut.push({ url, row, why, file }); console.log(`  砍  ${row}\n        ← ${why.join(" · ")}`); }
    else { kept.push({ url, row, file }); console.log(`  留  ${row}`); }
  } catch (e) {
    unread.push({ url, why: String(e.message ?? e).slice(0, 60) });
    console.log(`  ⚠️ 读不到  ${host.padEnd(32)} ${String(e.message ?? e).slice(0, 60)}`);
  }
  await p.close();
}
await b.close();

/* 留下来的拼成一张，一排一个 —— 缩图看不出来的东西，1:1 上一眼就看到，
   而他 2026-09-03 讲过 `太模糊了 我看不到`。 */
if (kept.length) {
  const W = 900;
  const tiles = [];
  for (const k of kept) {
    const buf = await sharp(k.file).resize({ width: W, fit: "inside" }).jpeg({ quality: 62 }).toBuffer();
    tiles.push({ buf, meta: await sharp(buf).metadata(), name: k.url });
  }
  const H = tiles.reduce((a, t) => a + t.meta.height + 8, 0);
  if (H > 20000) {
    console.log(`\n  ⚠️ 留下 ${kept.length} 个，拼起来 ${H}px 太高 —— 分开看 cand-*.jpg，不拼总表`);
  } else {
    let y = 0;
    const comp = tiles.map((t) => { const at = { input: t.buf, left: 0, top: y }; y += t.meta.height + 8; return at; });
    await sharp({ create: { width: W, height: H, channels: 3, background: "#111" } })
      .composite(comp).jpeg({ quality: 62 }).toFile(`${OUT}/pick.jpg`);
    console.log(`\n  → ${OUT}/pick.jpg  （${kept.length} 个，${W}×${H}）`);
  }
}

console.log(`\n判：留 ${kept.length} · 砍 ${cut.length} · 读不到 ${unread.length}`);
console.log(`⚠️ 「留」只表示它没有踩到那四条。够不够格是用眼睛看 pick.jpg 决定的。`);
fs.writeFileSync(
  `${OUT}/pick.json`,
  JSON.stringify({ at: new Date().toISOString(), kept, cut, unread }, null, 2),
);
