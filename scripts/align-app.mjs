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
const kinds = new Set();
const say = (ok, name, detail = "") => {
  kinds.add(name.split(" ")[0]);
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

  /* 🔴 **而「有反应」不等於「到对的地方」。**
     实测 2026-09-03：十套一共 39 个底栏格，只有 21 格有自己的画面 ——
     另外 18 格按下去**退回第一屏**，而上面那一条判它们全是活的
     （画面确实变了嘛）。**一个把你带到错的页面的按钮，比按了没反应更糟。**
     所以再问一次：按完之后，选中的那一格是不是它自己。 */
  const wrong = [];
  for (let i = 1; i <= tabs; i++) {
    await p.click(`${one} .nav button:nth-child(${i})`).catch(() => {});
    await p.waitForTimeout(140);
    const cur = await p.$$eval(`${one} .nav button`, (bs) => bs.findIndex((x) => x.getAttribute("aria-current") === "true")).catch(() => -1);
    if (cur !== i - 1) wrong.push(i);
  }
  await p.click(`${one} .nav button:nth-child(1)`).catch(() => {});
  await p.waitForTimeout(140);
  say(wrong.length === 0, "每一格都有自己的画面（不是退回第一屏）",
    wrong.length ? `第 ${wrong.join("/")} 格没有` : "");

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
    /* ⚠️ 选择器要跟着画面走。逐项复刻那一轮把类名改了（.xfig .n / .sqfig /
       .qbig / .amt2 / .zbig .v3），而这里还在找 .big / .v —— 於是十套全部
       印「没有大数字」。**一把量不到就闭嘴的尺，看起来跟一把量过了的尺一模一样。** */
    const hero = Math.max(...[".big", ".v", ".xfig .n", ".sqfig", ".qbig", ".amt2", ".zbig .v3", ".qlast .v4"]
      .map((q) => px(ph.querySelector(q))));
    const title = Math.max(...[".hd h2", ".b1 h2", ".g1 h2", ".sq1 h2", ".ntitle", ".ktop .brand", ".qtop .qco",
       ".topbar .co2", ".fbar .day", ".zbar .lhs"]
      .map((q) => px(ph.querySelector(q))));

    /* ⑫ 🔴 那个大数字不准换行。招牌那一颗放大到 76px 之后断成「RM / 12,400」——
       一个断成两行的金额读起来是坏掉的，而参考那一页是一行。
       用 getClientRects() 数行盒，不是拿字数去猜。 */
    /* ⚠️ 只判**数字**，不判标题。夜巡的「Taman Desa 3-bedroom refit」跟问答的
       那一句问题**本来就该换行**（参考那两页也是两行）—— 第一版把它们一起算进来，
       报了两个假的错。一个断成两行的金额是坏的，一个断成两行的句子不是。 */
    const wrapped = [".xfig .n", ".sqfig", ".qbig", ".amt2", ".zbig .v3", ".qlast .v4"]
      .map((q) => ph.querySelector(q)).filter(Boolean)
      /* ⚠️ `el.getClientRects()` 回的是**元素的框**，不是**行盒** —— 招牌那一颗
         明明断成两行，它照样回 1，於是这一项一片绿。要行盒得用 Range
         （`align-site` 量墨迹那一轮学到的同一件事）。 */
      .filter((e) => {
        if (parseFloat(getComputedStyle(e).fontSize) < 30) return false;
        const rg = document.createRange(); rg.selectNodeContents(e);
        return rg.getClientRects().length > 1;
      })
      .map((e) => e.textContent.trim().slice(0, 14));

    /* ⑧ 🔴 拿共用的示例数字当道具 */
    const propped = shared.test(ph.innerText);

    /* ⑨ 画面上的中文 —— 系统语言是英文的时候一个都不该有（重点 22d） */
    const cjk = (ph.innerText.match(/[一-鿿]/g) || []).length;

    /* ⑪ 🔴 底栏不准把一个大字切成两半 —— 用眼睛看出来的，读数当时全绿。
       台账的「RM 96,240」正好落在导航条上缘，**被切成上下两半**，
       而一个断掉的数字读起来是坏掉的，不是「还可以往下滚」。
       只判大字（≥20px）：小字被滚动切开是正常的，大字被切开是画面坏了。 */
    const navTop = (() => { const n = ph.querySelector(".nav"); return n ? n.getBoundingClientRect().top : null; })();
    const sliced = [];
    if (navTop != null) ph.querySelectorAll("*").forEach((e) => {
      if (e.closest(".nav")) return;
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      if (parseFloat(getComputedStyle(e).fontSize) < 20) return;
      const r = e.getBoundingClientRect();
      if (r.height < 6) return;
      const cut = r.bottom - navTop;
      if (cut > r.height * 0.25 && cut < r.height * 0.95)
        sliced.push(e.textContent.trim().slice(0, 16));
    });

    /* ⑩ 地色跟主色，从画面上读，不是从档案里读 */
    const canvas = getComputedStyle(ph).backgroundColor;
    const acc = ph.querySelector(".fab,.hdbtn");
    const primary = acc ? getComputedStyle(acc).backgroundColor : null;

    return { small, eaten: [...eaten], gap, low: [...new Set(low)], hero, title, propped, cjk, sliced, wrapped,
      canvas, primary, rows: ph.querySelectorAll(".li").length,
      rowH: (() => { const r = ph.querySelector(".li"); return r ? Math.round(r.getBoundingClientRect().height) : 0; })(),
      radius: Math.round(parseFloat(getComputedStyle(ph.querySelector(".hero,.blk,.list.boxed,.paper") || ph).borderRadius) || 0) };
  }, { one, TAP_MIN, HERO_MIN, VOID_MAX, CONTRAST_MIN, SHARED: SHARED_SAMPLE.source });

  say(m.small.length === 0, `每一颗都 ≥ ${TAP_MIN}px`, m.small.slice(0, 4).join(" · "));
  say(m.eaten.length === 0, "浮动按钮没有吃掉字", m.eaten.slice(0, 3).join(" · "));
  say(m.gap <= VOID_MAX, `清单底下的空 ≤ ${VOID_MAX}px`, `${m.gap}px`);
  say(m.sliced.length === 0, "底栏没有把大字切成两半", m.sliced.slice(0, 3).join(" · "));
  say(m.wrapped.length === 0, "大数字没有断成两行", m.wrapped.join(" · "));
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

/* ── 两两之间有几根轴一样 ─────────────────────────────
   🔴 老板 2026-09-03：「有些还是太一样了」。他用眼睛看出来的，
   而当时尺子量不到 —— 那就是尺子缺一项（[重点 24](docs/founder-points.md)）。
   他指的两对：**图纸 vs 瑞士**（都是分区标题＋一列带金额的行）、
   **台账 vs 招牌**（都是大数字 → 按钮 → 清单）。

   ⚠️ 这一项跟 `design-doc.test.ts` 那条「任何两套重叠 ≤ 6/11」是同一个想法，
   只是搬到手机上：手机没有侧栏、几乎没有表格、没有整条分区色带，
   那三根轴换成了**底栏 · 清单行 · 主要动作在哪**。
   它只能**否决**：两套七根重叠 ≥ 5 就是太像；全部不同也可以很难看。 */
/* ⚠️ 加了第八根轴之后**没有把门槛跟着放宽**（4/8 比 4/7 更严）——
   这一根是因为尺子放过了四套糊在一起的才加的，加完顺手放宽等於白加。 */
const MAX_SHARED = 4;

/* ── 第八根轴：**画面上有多少不是白的** ────────────────────────────────
   🔴 老板 2026-09-03 用眼睛看完十五套：`我要的有特点就是眼睛一看就是不一样的`，
   而他指出**四套糊在一起**（图纸 · 瑞士 · 招牌 · 早课）——
   当时那七根轴判它们全部 ≤ 4/7，**一片绿**。

   去量才知道原因：一眼分得出来的那十一套，每一套都有**一大块颜色或一块深色的地**
   （蓝栏 · 黑底 · 绿顶 · 粉顶 · 深色大卡），糊在一起的那四套一块都没有。
   **「一眼不一样」主要来自大面积，而那七根轴一根都没在量面积。**

   量法**照抄 `check:register-colour`**（[任务 39](docs/founder-tasks.md) 用一整天
   换来的那一条：按**面积**算，不是按声明次数）。多问一句「深不深」，
   因为一块近黑的地在眼睛里跟一块颜色是同一件事，在彩度上却是 0。 */
/* 量法：**每一颗像素离纯白有多远**（OKLab 的距离）。

   ⚠️ 第一版只数「彩度 > 0.035」，而它读不到**淡色块** ——
   图纸那张填满的淡蓝卡（#e5eefe）彩度只有 0.02，整屏因此报 4.7%「安静」，
   炉那一整片淡色时间格更惨，报 0.6%。**眼睛明明看得到那几块。**
   离白的距离同时吃三种：饱和的颜色 · 深色的地 · 淡色块 —— 那正好是
   「一眼看得到有东西」的三种来源。 */
const WHITE_FAR = 0.05;
function okl3(r8, g8, b8) {
  const f = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const r = f(r8), g = f(g8), b = f(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s2,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s2,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s2];
}
async function loudArea(buf) {
  const { data, info } = await sharp(buf).resize({ width: 200 }).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels; let far = 0, col = 0, dark = 0, n = 0;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    n++;
    const [L, A, B] = okl3(r, g, b);
    if (Math.hypot(1 - L, A, B) > WHITE_FAR) far++;
    if (Math.hypot(A, B) > 0.035) col++;
    if (0.2126 * r + 0.7152 * g + 0.0722 * b < 110) dark++;
  }
  return { col: (col / n) * 100, dark: (dark / n) * 100, loud: (far / n) * 100 };
}
const loudBand = (v) => v < 14 ? "安静" : v < 30 ? "一块" : v < 55 ? "大片" : "满屏";
/* 🔴 **每一页都要量，不是只量第一屏。**
   实测 2026-09-03：十套的第一屏重叠只有 4/7，翻到**第二页**却是十套里八套
   同一张清单 —— 而这一项当时只看第一屏，所以它一片绿。
   「太一样」发生在第二页，尺子却站在第一页。 */
const prints = [];
const loudRead = [];
const pageCount = await p.$$eval(SEL + " .nav button", (b2) => b2.length ? Math.max(...[...new Set(b2.map((x) => x.closest(".phone").querySelectorAll(".nav button").length))]) : 0);
for (let page = 0; page < Math.min(pageCount, 4); page++) {
  if (page) {
    for (const reg of phones) {
      const one2 = phones.length === 1 ? SEL : `${SEL}[data-reg="${reg}"]`;
      await p.click(`${one2} .nav button:nth-child(${page + 1})`).catch(() => {});
    }
    await p.waitForTimeout(220);
  }
  const got = await p.evaluate((sel) =>
  [...document.querySelectorAll(sel)].map((ph) => {
    const has = (q) => !!ph.querySelector(q);
    const body = ph.querySelector(".body");
    const first = [...(body ? body.children : [])].find((e) => e.className);
    /* 🔴 十五套那一轮，五个新的**全部被判成「其他」**，於是两两 7/7 一模一样。
       那不是设计一样，是**尺子不认得新类名**。一把认不得的尺，
       报出来的「一模一样」跟一把量过的尺报出来的长得一样。 */
    const hero =
      has(".tcols") ? "看板栏" : has(".hhero") ? "满幅主视觉"
      : has(".lgrid") ? "照片方块" : has(".dgrid") ? "控制台"
      : has(".wq") ? "一个大问题"
      : has(".cal") ? "日程表" : has(".jwall") ? "图标墙" : has(".kstage") ? "状态导航"
      : has(".bweek") ? "星期圆点" : has(".grail") ? "横滑卡片" : has(".zbento") ? "bento"
      : has(".qacct") ? "问候＋帐户卡" : has(".qdoc") ? "单据"
      : has(".sqfig") ? "左对齐大数字" : has(".xfig") ? "居中大数字"
      : has(".quiet") || has(".npage") ? "安静清单" : "其他";
    const row =
      has(".tcard") ? "堆着的卡" : has(".hposter") ? "海报"
      : has(".ltile") ? "照片方块" : has(".dgrid button") ? "开关"
      : has(".wopt") ? "选项行"
      : has(".fblk") ? "色块" : has(".sqrow") ? "方图标＋两行数字"
      : has(".xrow") ? "圆点＋两栏数字" : has(".nrow") ? "下划线"
      : has(".bcard") ? "作品卡" : has(".kstage .four") ? "四格状态"
      : has(".gitem") ? "卡片" : has(".li.dense") ? "密" : has(".li .av") ? "头像"
      : has(".li .dot") ? "圆点" : has(".qr") ? "方块色标" : "无";
    const act = has(".tadd") ? "加一张" : has(".hbtns") ? "两颗大按钮"
      : has(".lact") ? "分半的动作条" : has(".wnext") ? "满宽药丸"
      : has(".fab") ? "右下浮钮" : has(".sqpair") ? "两颗药丸"
      : has(".wide") ? "满宽按钮" : has(".bcall button") ? "卡里的按钮"
      : has(".hdbtn") ? "标题栏右上" : has(".kstage .all") ? "导航底下" : "无";
    /* ⚠️ 「有色顶区」是一根真的轴 —— Gojek 的绿顶跟 Klarna 的粉顶是它们的身份，
       而第一版的 zone 只问「有没有卡片」，於是一个有色顶区的页面跟一张白纸
       被判成同一种分区。signboard·p2 跟 cand10·p2 就是这样撞到 5/7 的。 */
    /* 深色的地本身就是一根轴 —— 十五套里只有两套是深的，而第一版的 zone
       只问「有没有卡片」，两套深色跟十三套白纸被判成同一种分区。 */
    const darkGround = (() => { const c = getComputedStyle(ph).backgroundColor.match(/\d+/g);
      return c && (0.2126 * +c[0] + 0.7152 * +c[1] + 0.0722 * +c[2]) < 90; })();
    const zone = darkGround ? "深色的地"
      : has(".tcol") ? "有色的栏" : has(".lbar") ? "有色顶栏"
      : has(".jtop") || has(".ktop") || has(".topbar") ? "有色顶区"
      : has(".xcard") || has(".qdoc") || has(".bcard") || has(".qacct") ? "卡片"
      : has(".list.boxed") ? "框起来的清单" : has(".nsec") ? "细线" : "满边";
    const cs = getComputedStyle(first || ph);
    return {
      reg: ph.dataset.reg,
      hero, row, act, zone,
      tabs: ph.querySelectorAll(".nav button").length,
      /* 🔴 第三次瞎：找不到那几个类名就退回**手机框自己**，而框的圆角是 26px ——
         於是十五套里十套一起报 r=26，那一根轴等於没有在量。
         改成读这一套自己宣告的 --rl（那才是它的圆角身份，退不回别人的框）。 */
      radius: Math.round(parseFloat(
        getComputedStyle(ph).getPropertyValue("--rl") ||
        getComputedStyle(ph).getPropertyValue("--r") || "0") || 0),
      /* 🔴 同一种瞎：清单少了八种形状，於是八套一起报 d=0。
         一根量不到就回 0 的轴，跟一根「量过了刚好都一样」的轴长得一模一样。 */
      dense: (() => {
        const r = ph.querySelector(".li,.xrow,.nrow,.sqrow,.q,.fblk,.qr,.tcard,.hposter,"
          + ".ltile,.wopt,.dgrid button,.bcard,.gitem,.kstage .four button,.kdots button,.zbento .zwarn");
        return r ? Math.round(r.getBoundingClientRect().height / 8) * 8 : 0; })(),
    };
  }), SEL);
  /* 量面积：一支手机一张图，缩到 200px 宽再数 —— 数的是比例不是像素数 */
  for (const g of got) {
    const one3 = phones.length === 1 ? SEL : `${SEL}[data-reg="${g.reg}"]`;
    const el = await p.$(one3);
    const a = el ? await loudArea(await el.screenshot({ type: "png" })) : { col: 0, dark: 0, loud: 0 };
    g.loudPct = a.loud; g.colPct = a.col; g.darkPct = a.dark;
    g.loud = loudBand(a.loud);
    if (page === 0) loudRead.push(`  读数  ${g.reg.padEnd(10)} 第一屏不是白的：${a.loud.toFixed(1).padStart(5)}%（颜色 ${a.col.toFixed(1)}% · 深 ${a.dark.toFixed(1)}%）→ ${g.loud}`);
  }
  got.forEach((g) => prints.push({ ...g, reg: g.reg + "·p" + (page + 1) }));
}
/* 回到第一页，不要让下一个跑的人拿到别人翻过的状态 */
for (const reg of phones) {
  const one2 = phones.length === 1 ? SEL : `${SEL}[data-reg="${reg}"]`;
  await p.click(`${one2} .nav button:nth-child(1)`).catch(() => {});
}
await p.waitForTimeout(200);

/* ⚠️ `--why` 把八根轴逐套印出来。这把尺**瞎过两次**（认不得新类名 → 报「一模一样」），
   而两次都是靠人去读代码才发现的。它肯讲它看到什么，下一次就用不着读代码。 */
if (process.argv.includes("--why")) {
  console.log("──── 尺子看到的八根轴（--why）");
  prints.forEach((x) => console.log(`  ${x.reg.padEnd(14)} hero=${String(x.hero).padEnd(10)} row=${String(x.row).padEnd(12)} act=${String(x.act).padEnd(9)} zone=${String(x.zone).padEnd(8)} tabs=${x.tabs} r=${x.radius} d=${x.dense} loud=${x.loud}`));
}
console.log("──── 第一屏有多少不是白的（这一根是眼睛在看的那一根）");
loudRead.sort().forEach((l) => console.log(l));
console.log("──── 两两之间有几根轴一样（八根：首屏主角 · 清单行 · 主要动作 · 分区 · 底栏 · 圆角 · 密度 · 不是白的面积）");
const pairs = [];
for (let i = 0; i < prints.length; i++) for (let j = i + 1; j < prints.length; j++) {
  const a2 = prints[i], b2 = prints[j];
  /* 只比同一页 —— 拿 A 的第一页去比 B 的第三页没有意义 */
  if (a2.reg.split("·p")[1] !== b2.reg.split("·p")[1]) continue;
  const same = ["hero", "row", "act", "zone", "tabs", "radius", "dense", "loud"].filter((k) => a2[k] === b2[k]);
  if (same.length >= 3) pairs.push({ a: a2.reg, b: b2.reg, n: same.length, same });
}
pairs.sort((x, y) => y.n - x.n);
if (!pairs.length) console.log("  没有任何一对重叠到 3 根");
pairs.slice(0, 8).forEach((x) =>
  console.log(`  ${x.n >= MAX_SHARED + 1 ? "⚠️" : "  "} ${x.a} · ${x.b}  重叠 ${x.n}/8  （${x.same.join(" ")}）`));
const tooAlike = pairs.filter((x) => x.n > MAX_SHARED);
say(tooAlike.length === 0, `任何两套重叠 ≤ ${MAX_SHARED}/8`,
  tooAlike.map((x) => `${x.a}·${x.b} ${x.n}`).join(" · "));

fs.mkdirSync(OUT, { recursive: true });
const shot = `${OUT}/align-app.jpg`;
await p.screenshot({ path: shot, fullPage: true, type: "jpeg", quality: 74 });
await b.close();

console.log(`\n判：${fails.length ? `${fails.length} 项没过` : `${kinds.size} 件都没有再犯`}`);
console.log(notes.map((n) => "  ⚪ " + n).join("\n"));
console.log(`⚠️ 全绿只表示**这几件没有再犯**。像不像要用眼睛看 ${shot}。`);
process.exit(fails.length ? 1 : 0);
