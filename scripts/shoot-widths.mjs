/**
 * 同一页，三个宽度 —— 外面那几套后台在 iPad 上到底怎么折。
 *
 * ── 为什么要新的一支 ────────────────────────────────────────────────
 *
 *   shoot:admins     六十一张，**每一张都是别人的首页，而且全部拍在 1440**
 *   shoot:pagerefs   按「那一页在问什么」分组 —— 也全部拍在 1440
 *   shoot:appui      手机，而那是**商店里的行销图**不是画面
 *   🔴 这一支         **同一页 × 桌面 / iPad 直立 / 手机**，而且量它折了什么
 *
 * 2026-09-09 数过：这个仓库每一把尺开的浏览器，不是 390 就是 1280 以上 ——
 * **平板那一档一次都没有量过**（101 处量 1440 · 39 处量 390 · 平板 0 处）。
 * 而 iPad 直立 820 正好是「两栏还摆不摆得下」那个决定发生的地方。
 *
 * ⚠️ 它**不判好不好看**（[重点 24]）。它回答的是一句可以复查的话：
 * 「这一页在 820 的时候，侧栏 · 栏数 · 那张表，各自变成什么。」
 *
 * ⚠️ 拍到的是**模板**不是真的产品（Fresha · Xero 的内页在登入后面，
 * [任务 267](../docs/founder-tasks.md) 判过）。模板的长相会收敛成同一张脸
 * （[任务 296]），**而它们的折法是真的**，那正是这一支要的东西。
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const OUT = ".screenshots/widths";
fs.mkdirSync(OUT, { recursive: true });

/* 820 是 iPad 直立（10.9" / Air / Pro 11 是 834）。横放 1180 基本上就是桌面，
   所以不拍 —— 一个跟桌面一样的读数，读的人分不出是「量过了」还是「忘了量」。 */
const WIDTHS = [
  [1400, 1000, "desktop"],
  [820, 1180, "ipad"],
  [390, 844, "phone"],
];

/* 每一个都对得上我们自己的一种页。前八个是他 2026-09-04 挑的那一套，
   后三个是别的家 —— 少了它们，读到的是「那一家怎么折」不是「大家怎么折」。 */
const PAGES = [
  ["overview", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/default", "arhamkhnz", "总览"],
  ["money", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/finance", "arhamkhnz", "收款 · 开销 · 佣金"],
  ["list", "https://shadcn-admin.netlify.app/tasks", "satnaing", "报价单等清单"],
  ["people", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/users", "arhamkhnz", "客户 · 供应商 · 师傅"],
  ["document", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/invoice", "arhamkhnz", "开一张单"],
  ["board", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/kanban", "arhamkhnz", "工程 · 任务"],
  ["cards", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/file-manager", "arhamkhnz", "库存"],
  ["calendar", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/productivity", "arhamkhnz", "预约 · 排班"],
  ["tabler", "https://preview.tabler.io/", "tabler 41.6k", "另一家"],
  ["antd", "https://preview.pro.ant.design/dashboard/analysis", "ant-design 38.7k", "另一家"],
  ["tailadmin", "https://free-demo.tailadmin.com/", "TailAdmin", "另一家"],
];

const PICK = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((x) => x.trim())) : null;

/* 量的东西全部是「折了什么」，一个都不是「好不好看」。 */
const PROBE = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const boxes = [...document.querySelectorAll("*")].map((e) => [e, e.getBoundingClientRect()]);

  /* 侧栏：贴着左边、比视窗高一大截、而且窄。收起来变图标条也算，只是宽度变小。 */
  const rail = boxes
    .filter(
      ([e, r]) =>
        r.left <= 6 &&
        r.right > 8 &&
        r.width >= 40 &&
        r.width <= 380 &&
        r.height >= vh * 0.7 &&
        (e.checkVisibility ? e.checkVisibility() : true),
    )
    .sort((a, b) => b[1].height - a[1].height)[0];

  /* 底栏：贴着下缘、几乎满宽、矮，而且是钉住的 —— 一个跟着内容滚的页脚不算。 */
  const bottom = boxes.find(([e, r]) => {
    const pos = getComputedStyle(e).position;
    return (
      (pos === "fixed" || pos === "sticky") &&
      r.bottom >= vh - 6 &&
      r.height > 30 &&
      r.height <= 110 &&
      r.width >= vw * 0.9
    );
  });

  /* 主区：`<main>` 优先；没有就取「不是侧栏、面积最大、而且有两个以上孩子」的那一块。 */
  let main = document.querySelector("main");
  if (!main) {
    const railW = rail ? rail[1].width : 0;
    main = boxes
      .filter(([e, r]) => r.left >= railW - 8 && r.width > vw * 0.5 && r.height > 200 && e.children.length >= 2)
      .sort((a, b) => b[1].width * b[1].height - a[1].width * a[1].height)
      .map(([e]) => e)[0];
  }

  /* 栏数：主区的直接孩子里，同一条横带上最多摆得下几个。
     一栏到底 = 1；并排两块 = 2。这就是 820 上那个决定。 */
  /* First try returned 1 for every page at every width — `main` usually holds
     one wrapper, so its own children never sit side by side. A reading that is
     the same number for eleven different pictures is not measuring anything.
     Ask instead: anywhere inside the main region, what is the largest number of
     blocks that share a horizontal band? That is the question 820 decides. */
  let cols = 0;
  if (main) {
    for (const el of [main, ...main.querySelectorAll("*")]) {
      const kids = [...el.children]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 120 && r.height > 70 && r.top < vh * 1.8 && r.bottom > 0);
      if (kids.length < 2) continue;
      const bands = [];
      for (const r of kids) {
        const bnd = bands.find((x) => Math.abs(x.top - r.top) < 24);
        if (bnd) bnd.n += 1;
        else bands.push({ top: r.top, n: 1 });
      }
      cols = Math.max(cols, ...bands.map((bnd) => bnd.n));
    }
  }

  /* 那张表：还在不在、要不要横着推、还是整个不见了（换成一行一笔）。 */
  const tables = [...document.querySelectorAll("table")].filter((t) => {
    const r = t.getBoundingClientRect();
    return r.width > 100 && r.height > 60;
  });
  let table = "none";
  if (tables.length) {
    const t = tables[0];
    let scroller = t.parentElement;
    let pushes = false;
    for (let i = 0; i < 4 && scroller; i += 1) {
      if (scroller.scrollWidth > scroller.clientWidth + 2) pushes = true;
      scroller = scroller.parentElement;
    }
    const cells = t.querySelectorAll("thead th, thead td").length;
    table = `${cells} cols${pushes ? " · pushes" : ""}`;
  }

  const px = (el) => (el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : 0);
  const biggest = boxes
    .map(([e]) => e)
    .filter((e) => e.children.length === 0 && (e.textContent ?? "").trim().length > 0)
    .reduce((a, e) => (px(e) > px(a) ? e : a), document.body);

  return {
    rail: rail ? Math.round(rail[1].width) : 0,
    bottom: bottom ? Math.round(bottom[1].height) : 0,
    cols,
    table,
    pad: main ? Math.round(main.getBoundingClientRect().left + parseFloat(getComputedStyle(main).paddingLeft || 0)) : 0,
    body: px(document.body),
    top: px(biggest),
    sideways: Math.max(0, document.documentElement.scrollWidth - vw),
    height: document.documentElement.scrollHeight,
  };
};

const rows = [];
const b = await chromium.launch();

for (const [name, url, who, maps] of PAGES) {
  if (PICK && !PICK.has(name)) continue;
  for (const [w, h, tag] of WIDTHS) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    let m = null;
    try {
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(6000);
      await p.screenshot({ path: `${OUT}/${name}-${tag}.png` });
      m = await p.evaluate(PROBE);
    } catch (e) {
      m = { failed: String(e).slice(0, 60) };
    }
    await p.close();
    rows.push({ name, who, maps, tag, w, ...m });
  }
}
await b.close();

/* 一页一张拼图：桌面 · iPad · 手机 并排，按同一个高度缩，肉眼一次看得完。 */
const LABEL = 26;
for (const [name, , who, maps] of PAGES) {
  if (PICK && !PICK.has(name)) continue;
  const parts = [];
  for (const [w, , tag] of WIDTHS) {
    const f = `${OUT}/${name}-${tag}.png`;
    if (!fs.existsSync(f)) continue;
    const H = 900;
    const meta = await sharp(f).metadata();
    const scale = H / Math.min(meta.height, 1400);
    const img = await sharp(f)
      .extract({ left: 0, top: 0, width: meta.width, height: Math.min(meta.height, 1400) })
      .resize({ width: Math.round(meta.width * scale) })
      .toBuffer();
    const iw = Math.round(meta.width * scale);
    const cap = Buffer.from(
      `<svg width="${iw}" height="${LABEL}"><rect width="100%" height="100%" fill="#0b0d13"/>` +
        `<text x="8" y="18" font-family="monospace" font-size="13" fill="#e6e8ee">${tag} · ${w}px</text></svg>`,
    );
    parts.push(
      await sharp({ create: { width: iw, height: H + LABEL, channels: 3, background: "#0b0d13" } })
        .composite([
          { input: cap, top: 0, left: 0 },
          { input: img, top: LABEL, left: 0 },
        ])
        .png()
        .toBuffer(),
    );
  }
  if (!parts.length) continue;
  const metas = await Promise.all(parts.map((p) => sharp(p).metadata()));
  const gap = 14;
  const sheetW = metas.reduce((a, m) => a + m.width, 0) + gap * (metas.length + 1);
  const sheetH = Math.max(...metas.map((m) => m.height)) + gap * 2;
  let x = gap;
  const layers = parts.map((p, i) => {
    const at = { input: p, top: gap, left: x };
    x += metas[i].width + gap;
    return at;
  });
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#0b0d13" } })
    .composite(layers)
    .toFile(`${OUT}/${name}-sheet.jpg`);
  console.log(`sheet  ${name.padEnd(10)} ${maps.padEnd(20)} ${who}`);
}

console.log("\n== what the same page does at three widths ==");
console.log("  page       width  rail  cols  bottom  table              pad  body/top  sideways");
for (const r of rows) {
  if (r.failed) {
    console.log(`  ${r.name.padEnd(11)}${String(r.w).padStart(5)}  ${r.failed}`);
    continue;
  }
  console.log(
    `  ${r.name.padEnd(11)}${String(r.w).padStart(5)}` +
      `${String(r.rail || "-").padStart(6)}${String(r.cols).padStart(6)}` +
      `${String(r.bottom || "-").padStart(8)}  ${String(r.table).padEnd(18)}` +
      `${String(r.pad).padStart(4)}${String(r.body + "/" + r.top).padStart(10)}` +
      `${String(r.sideways || "-").padStart(10)}`,
  );
}

fs.writeFileSync(`${OUT}/_readings.json`, JSON.stringify(rows, null, 2));
console.log(`\n${OUT}/_readings.json`);
