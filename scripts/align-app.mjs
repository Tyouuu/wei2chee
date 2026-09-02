/**
 * `npm run align:app` —— 手机版复刻的尺子。
 *
 * ── 为什么要多一把 ────────────────────────────────────────────────────────
 * 老板 2026-09-03：`我们是不是很有必要造多一把复刻尺子是for这个App页面模版的
 * 复刻啊 现在进度太慢了`。**他讲对了，而且那一轮就是证据**：四套手机骨架做出来
 * 之后，我用眼睛一轮一轮抓到六个错 —— 死按钮 · 圆按钮盖住金额 · 清单底下留 200px
 * 空 · 用了每家公司共用的示例总数 · 12 处对比度 · 再 14 处对比度。
 * **六轮来回，而六个全部量得出来。** 第五套到第十五套要是照那样做，就是六十轮。
 *
 * ── 它跟 `align`（官网）跟 `align:admin`（后台）差在哪 ─────────────────────
 * 那两把的**参考是一个活的网页**，打得开、读得到 DOM。
 * 手机这边没有 —— ServiceM8 的站 403、Jobber 被 Cloudflare 挡、Housecall 连线被重置
 * （2026-09-03 实测）。我们手上只有**商店页的截图**。
 * 所以这把尺分两半：
 *   · **我们这边**：真的开浏览器，390px，量画面上人看得见的东西
 *   · **参考那边**：只从那张 JPG 量得出来的两件 —— **地色** 跟 **白底上的界面主色**
 * 拿不到的就印「量不到」，**不要拿一个猜的数字去凑一份看起来很完整的报告**。
 *
 * ── ⚠️ 它只能否决，不能通过 ──────────────────────────────────────────────
 * [重点 24](docs/founder-points.md)：**眼睛判像不像，尺子判有没有再犯。**
 * 全绿只表示这六件没有再犯。像不像要看 `.screenshots/appui/align-<名字>.jpg`。
 *
 * 用法：
 *   node scripts/align-app.mjs --page <网址或档案> --ref .screenshots/appui/xero.jpg
 *   node scripts/align-app.mjs --page <...> --ref <...> --sel '.phone[data-reg="ledger"]'
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PAGE = arg("--page");
const REF = arg("--ref");
const SEL = arg("--sel", ".phone");
const OUT = arg("--out", ".screenshots/appui");
if (!PAGE) { console.error("用法: node scripts/align-app.mjs --page <网址> [--ref <图>] [--sel <选择器>]"); process.exit(1); }

/* ── 他自己定过的四条通则（2026-09-02 量 16 个专业老板端量出来的） ──────── */
const TAB_MIN = 3, TAB_MAX = 5;   // 底栏几格：16 个里 16 个落在 3–5
const TAP_MIN = 44;               // 拇指按得准的最小边长
const HERO_MIN = 28;              // 「一个大数字」要真的大过页面标题
const VOID_MAX = 160;             // 清单底下留多少空还算正常
const CONTRAST_MIN = 4.5;         // 工地上大太阳底下要读得到

/* 🔴 每一家公司共用的那个示例总数。它出现在画面上，就是拿一个还没修好的洞
   当道具（[任务 94](docs/founder-tasks.md) 点名过）。 */
const SHARED_SAMPLE = /\b71,?300\b/;

const fails = [];
const notes = [];
const say = (ok, name, detail = "") => {
  if (ok) console.log(`  PASS  ${name}${detail ? `  ${detail}` : ""}`);
  else { fails.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

/* ── 参考那一边：只有一张图，所以只量图上量得到的 ─────────────────────── */
function oklab(r8, g8, b8) {
  const f = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const r = f(r8), g = f(g8), b = f(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    C: Math.hypot(1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
                  0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s) };
}
const hexOf = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/**
 * 一张商店截图上的**地**跟**界面主色**。
 *
 * 🔴 主色**不是**「面积最大的有色像素」。第一版那样算，Xero 量出 `#00054f`、
 * QuickBooks 量出 `#000000` —— **那是行销底板的颜色，不是界面的**。
 * 改成只数**坐在白底上**的有色像素（左右 8px 有一边是近白），
 * 那才是「一颗按钮／一个图标画在白色界面上」的样子。
 * ⚠️ 同一个形状的错 [任务 39](docs/founder-tasks.md) 犯过：按声明次数排颜色，
 * 把整页的地判成 content。**面积骗不了人，但要先量对是谁的面积。**
 */
async function refPalette(file) {
  const { data, info } = await sharp(file).resize({ width: 1100, fit: "inside" })
    .raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;
  const at = (x, y) => { const i = (y * W + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
  const isWhite = (x, y) => { if (x < 0 || x >= W) return false; const c = oklab(...at(x, y)); return c.L > 0.93 && c.C < 0.02; };

  const Q = 20, ground = new Map(), brand = new Map();
  let onWhite = 0, total = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const [r, g, b] = at(x, y); total++;
    const key = `${Math.round(r / Q)},${Math.round(g / Q)},${Math.round(b / Q)}`;
    const e = ground.get(key); if (e) e.n++; else ground.set(key, { n: 1, r, g, b });
    if (oklab(r, g, b).C < 0.06) continue;
    if (!(isWhite(x - 8, y) || isWhite(x + 8, y))) continue;
    onWhite++;
    const e2 = brand.get(key); if (e2) e2.n++; else brand.set(key, { n: 1, r, g, b });
  }
  const g0 = [...ground.values()].sort((a, b) => b.n - a.n)[0];
  const b0 = [...brand.values()].sort((a, b) => b.n - a.n)[0];
  return {
    ground: hexOf(g0.r, g0.g, g0.b), groundPct: (100 * g0.n) / total,
    /* 白底上一个有色像素都没有 = 量不到，不是「它没有主色」。 */
    brand: onWhite > 200 && b0 ? hexOf(b0.r, b0.g, b0.b) : null,
    brandPct: onWhite > 200 && b0 ? (100 * b0.n) / onWhite : 0,
  };
}

/* ── 我们这一边 ─────────────────────────────────────────────────────────── */
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
const scriptErrors = [];
p.on("pageerror", (e) => scriptErrors.push(String(e).slice(0, 120)));
await p.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(1200);

const phones = await p.$$eval(SEL, (els) => els.map((e) => e.dataset.reg || e.id || "phone"));
if (!phones.length) { console.error(`🔴 ${SEL} 一个都没找到 —— 载不到就是失败，不是「这一页很简单」`); await b.close(); process.exit(1); }

const ref = REF ? await refPalette(REF) : null;
console.log(`\n手机复刻 · ${phones.length} 支 · 选择器 ${SEL}`);
if (ref) console.log(`参考 ${REF}\n  地 ${ref.ground} ${ref.groundPct.toFixed(0)}%  ·  白底上的主色 ${ref.brand ?? "量不到"}${ref.brand ? ` ${ref.brandPct.toFixed(0)}%` : ""}`);
else console.log("参考  没给 —— 颜色那两项不判，印「量不到」");

for (const reg of phones) {
  const sel = `${SEL}[data-reg="${reg}"]`.replace('[data-reg=""]', "");
  const one = phones.length === 1 ? SEL : sel;
  console.log(`\n──── ${reg}`);

  /* ① 底栏几格 —— 16 个专业老板端全部落在 3–5 */
  const tabs = await p.$$eval(one + " .nav button", (b2) => b2.length).catch(() => 0);
  say(tabs >= TAB_MIN && tabs <= TAB_MAX, "底栏 3–5 格", `${tabs} 格`);

  /* ② 🔴 死按钮 —— 每一格都按一次，画面必须真的变。
     这一条是这一轮最贵的那个错：四支里三支的底栏按了不换页，而读数全绿。
     它跟我们禁止 AI 画的死按钮是同一件事，只是这次是我自己画的。 */
  const dead = [];
  for (let i = 1; i <= tabs; i++) {
    const before = await p.$eval(one + " .body", (e) => e.innerText.slice(0, 80)).catch(() => "");
    const cur = await p.$eval(`${one} .nav button:nth-child(${i})`, (e) => e.getAttribute("aria-current")).catch(() => null);
    await p.click(`${one} .nav button:nth-child(${i})`).catch(() => {});
    await p.waitForTimeout(160);
    const after = await p.$eval(one + " .body", (e) => e.innerText.slice(0, 80)).catch(() => "");
    const nowCur = await p.$eval(`${one} .nav button:nth-child(${i})`, (e) => e.getAttribute("aria-current")).catch(() => null);
    /* 本来就选中的那一格按了不变是对的。变的是「它没被选中，按了还是没反应」。 */
    if (cur !== "true" && before === after && nowCur !== "true") dead.push(i);
  }
  await p.click(`${one} .nav button:nth-child(1)`).catch(() => {});
  await p.waitForTimeout(160);
  say(dead.length === 0, "底栏每一格按了都有反应", dead.length ? `第 ${dead.join("/")} 格是死的` : "");

  const m = await p.evaluate(({ one: s2, TAP_MIN, HERO_MIN, VOID_MAX, CONTRAST_MIN, SHARED }) => {
    const ph = document.querySelector(s2);
    const body = ph.querySelector(".body");
    const shared = new RegExp(SHARED);

    /* ③ 拇指按得准 */
    const small = [...ph.querySelectorAll("button,a,[role=button]")].filter((e) => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < TAP_MIN || r.width < 12);
    }).map((e) => (e.innerText || e.getAttribute("aria-label") || "?").trim().slice(0, 14) + " " + Math.round(e.getBoundingClientRect().height));

    /* ④ 🔴 浮动按钮有没有吃掉字 —— **三个滚动位置都问**。
       第一版只量「滚到底」那一刻，回报 0 个，而停在顶部的时候它压着一行的金额。
       一把只在一种状态下问问题的尺，看不到这个差别，而这个差别就是那个 bug。 */
    const eaten = new Set();
    const fab = ph.querySelector(".fab");
    if (fab) for (const where of ["top", "mid", "bottom"]) {
      body.scrollTop = where === "top" ? 0 : where === "mid" ? body.scrollHeight / 2 : body.scrollHeight;
      const fr = fab.getBoundingClientRect();
      ph.querySelectorAll(".amt,.p1,.pill,.who,.v,.big").forEach((t) => {
        const r = t.getBoundingClientRect();
        if (r.left < fr.right && r.right > fr.left && r.top < fr.bottom && r.bottom > fr.top)
          eaten.add(where + "「" + t.innerText.trim().slice(0, 16) + "」");
      });
    }
    body.scrollTop = 0;

    /* ⑤ 清单底下留多少空 —— 四笔资料撑不满一屏，读起来像没做完 */
    const last = body.lastElementChild;
    const gap = last ? Math.round(body.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom) : 0;

    /* ⑥ 对比度 —— 白底之后这一项才真正咬人 */
    const lum = (c) => { const [r, g, b2] = c.match(/\d+/g).map(Number).map((v) => {
      const s3 = v / 255; return s3 <= 0.03928 ? s3 / 12.92 : ((s3 + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b2; };
    const low = [];
    ph.querySelectorAll("*").forEach((e) => {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      const cs = getComputedStyle(e);
      let el = e, bg = "rgba(0, 0, 0, 0)";
      while (el && bg === "rgba(0, 0, 0, 0)") { bg = getComputedStyle(el).backgroundColor; el = el.parentElement; }
      if (!bg || bg.startsWith("rgba(0, 0, 0, 0")) bg = "rgb(255,255,255)";
      const l1 = lum(cs.color), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < CONTRAST_MIN) low.push(e.textContent.trim().slice(0, 14) + " " + ratio.toFixed(2));
    });

    /* ⑦ 首屏最大的那个字要比页面标题大 —— 「一个大数字」不能比标题小 */
    const px = (e) => (e ? Math.round(parseFloat(getComputedStyle(e).fontSize)) : 0);
    const hero = Math.max(px(ph.querySelector(".big")), px(ph.querySelector(".v")));
    const title = px(ph.querySelector(".hd h2"));

    /* ⑧ 🔴 拿共用的示例数字当道具 */
    const propped = shared.test(ph.innerText);

    /* ⑨ 画面上的中文 —— 系统语言是英文的时候一个都不该有（重点 22d） */
    const cjk = (ph.innerText.match(/[一-鿿]/g) || []).length;

    /* ⑩ 地色跟主色，从画面上读，不是从档案里读 */
    const canvas = getComputedStyle(ph).backgroundColor;
    const acc = ph.querySelector(".fab,.hdbtn");
    const primary = acc ? getComputedStyle(acc).backgroundColor : null;

    return { small, eaten: [...eaten], gap, low: [...new Set(low)], hero, title, propped, cjk,
      canvas, primary, rows: ph.querySelectorAll(".li").length,
      rowH: (() => { const r = ph.querySelector(".li"); return r ? Math.round(r.getBoundingClientRect().height) : 0; })(),
      radius: Math.round(parseFloat(getComputedStyle(ph.querySelector(".hero,.blk,.list.boxed,.paper") || ph).borderRadius) || 0) };
  }, { one, TAP_MIN, HERO_MIN, VOID_MAX, CONTRAST_MIN, SHARED: SHARED_SAMPLE.source });

  say(m.small.length === 0, `每一颗都 ≥ ${TAP_MIN}px`, m.small.slice(0, 4).join(" · "));
  say(m.eaten.length === 0, "浮动按钮没有吃掉字", m.eaten.slice(0, 3).join(" · "));
  say(m.gap <= VOID_MAX, `清单底下的空 ≤ ${VOID_MAX}px`, `${m.gap}px`);
  say(m.low.length === 0, `每一段字都 ≥ ${CONTRAST_MIN}:1`, m.low.slice(0, 4).join(" · "));
  say(!m.propped, "没有拿共用的示例总数当道具", m.propped ? "画面上出现 RM 71,300" : "");
  say(m.cjk === 0, "英文系统里没有中文", m.cjk ? `${m.cjk} 个` : "");
  if (m.hero) say(m.hero > m.title, "最大的数字比页面标题大", `${m.hero}px 对 ${m.title}px`);
  else notes.push(`${reg} 没有大数字 —— 不判这一项（图纸那一套本来就故意不给）`);

  /* 颜色：跟参考比。拿不到参考就印「量不到」，不猜。 */
  if (ref) {
    const toHex = (rgb) => rgb && rgb.startsWith("rgb")
      ? "#" + rgb.match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, "0")).join("") : rgb;
    console.log(`  读数  地 ${toHex(m.canvas)} 对参考 ${ref.ground}  ·  主色 ${toHex(m.primary) ?? "—"} 对参考 ${ref.brand ?? "量不到"}`);
    say(toHex(m.canvas) === ref.ground, "地跟参考一样", `${toHex(m.canvas)} 对 ${ref.ground}`);
  } else {
    console.log("  读数  颜色两项：量不到（没给 --ref）");
  }
  console.log(`  读数  ${m.rows} 行 · 一行 ${m.rowH}px · 圆角 ${m.radius}px`);
}

say(scriptErrors.length === 0, "没有脚本错", scriptErrors.slice(0, 2).join(" · "));

fs.mkdirSync(OUT, { recursive: true });
const shot = `${OUT}/align-app.jpg`;
await p.screenshot({ path: shot, fullPage: true, type: "jpeg", quality: 74 });
await b.close();

console.log(`\n判：${fails.length ? `${fails.length} 项没过` : "六件都没有再犯"}`);
console.log(notes.map((n) => "  ⚪ " + n).join("\n"));
console.log(`⚠️ 全绿只表示**这几件没有再犯**。像不像要用眼睛看 ${shot}。`);
process.exit(fails.length ? 1 : 0);
