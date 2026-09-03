/**
 * 一份名单，两支脚本用（`shoot:clone` 出并排总览，`zoom:clone` 出逐段放大）。
 *
 * ⚠️ **不要在别处再抄一份。** 这个仓库栽在「第二份手写清单」上至少五次
 * （[任务 53](docs/founder-tasks.md) 那六个版段就是）。
 *
 * 参考图有两种来源，而且**必须分开讲**：
 *  · 商店页 —— **行销版**：一句大标题压着一台斜着的手机
 *  · Mobbin —— **真界面**：app 里面真正长的样子
 * 下一个人会去商店找一张根本不存在的图，就是因为这两种没有分开写。
 * （我 2026-09-03 自己就把 `面板` 照商店那张改错过一次。）
 */
import sharp from "sharp";
import fs from "node:fs";

export const OUT = ".screenshots/clone";
const CACHE = `${OUT}/raw`;

export const PAIRS = [
  { reg: "ledger",    zh: "台账", app: "Xero",       id: "com.xero.touch",        pick: 0, crop: [0.17, 0.225, 0.83, 0.96], take: "一个大数字压住整屏" },
  { reg: "hearth",    zh: "炉",   app: "Fresha",     id: "com.fresha.Business",   pick: 4, crop: [0.12, 0.14, 0.88, 0.97], take: "色块日程表" },
  { reg: "counter",   zh: "中台", app: "Zoho Books", id: "com.zoho.books",        pick: 0, crop: [0.11, 0.32, 0.89, 1.00], take: "两格并排＋捷径格子" },
  { reg: "blueprint", zh: "图纸", app: "QuickBooks", id: "com.intuit.quickbooks", pick: 0, crop: [0.13, 0.262, 0.87, 1.00], take: "问候＋提醒条＋帐户卡" },
  { reg: "swiss",     zh: "瑞士", app: "Notion",     id: "notion.id",             pick: 2, crop: [0.14, 0.21, 0.86, 1.00], take: "满幅封面＋段落标题" },
  { reg: "signboard", zh: "招牌", app: "Square",     id: "com.squareup",          pick: 2, crop: [0.185, 0.263, 0.855, 0.99], take: "一屏只有一件事" },
  { reg: "cand7",  zh: "站台",  app: "Klarna",   local: "pf-6.png", crop: [0.00, 0.00, 1.00, 0.96], take: "有色顶区＋彩色圆图标＋四格状态导航" },
  { reg: "cand8",  zh: "早课",  app: "Brilliant", local: "pf-4.png", crop: [0.00, 0.00, 1.00, 0.96], take: "星期圆点＋一张填满的行动卡" },
  { reg: "cand9",  zh: "分店",  app: "Gametime", local: "pf-1.png", crop: [0.00, 0.00, 1.00, 0.96], take: "店名当大标题带⌄＋横滑卡片" },
  { reg: "cand10", zh: "入口墙", app: "Gojek",    local: "pf-2.png", take: "有色顶区＋一整片圆图标墙" },
  { reg: "cand11", zh: "看板",  app: "Trello",   id: "com.trello",            pick: 2, crop: [0.10, 0.30, 0.90, 1.00], take: "一整片有色的栏，白卡叠上面" },
  { reg: "cand12", zh: "夜巡",  app: "Hulu",     local: "pf-7.png", crop: [0.00, 0.00, 1.00, 0.97], take: "深色的地＋满幅主视觉" },
  { reg: "cand13", zh: "货架",  app: "Loyverse", id: "com.loyverse.sale",     pick: 0, crop: [0.09, 0.255, 0.91, 1.00], take: "有色顶栏＋分半动作条＋照片方块" },
  { reg: "cand14", zh: "面板",  app: "Tesla",    local: "pf-tesla.png", take: "深色＋大图＋一整片控制图标" },
  { reg: "cand15", zh: "问答",  app: "Wise",     id: "com.transferwise.android", pick: 2, crop: [0.25, 0.27, 0.76, 0.85], take: "一个问题＋一列选项" },
];

/**
 * 抓那一张参考。**抓到就存下来** —— 逐段放大要跑很多次，
 * 每一次都去商店重抓，是在赌他们今天没有改版、没有挡我们。
 * ⚠️ 存下来的另一半好处：`--refresh` 才会重抓，所以
 * 「他们改版了」跟「今天没抓好」分得开（[任务 83](docs/founder-tasks.md) 的教训）。
 */
export async function refShot(pair, browser, bad, { refresh = false } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const cache = `${CACHE}/${pair.reg}.png`;
  const meta = `${CACHE}/${pair.reg}.json`;

  if (!refresh && fs.existsSync(cache) && fs.existsSync(meta)) {
    const m = JSON.parse(fs.readFileSync(meta, "utf8"));
    return { ...m, buf: fs.readFileSync(cache) };
  }

  let got = null;
  if (pair.local) {
    const f = `${OUT}/${pair.local}`;
    if (!fs.existsSync(f)) { bad.push(`${pair.app} 本地参考不见了：${f}`); return null; }
    const buf = fs.readFileSync(f);
    const md = await sharp(buf).metadata();
    if (!md.width || md.width < 300) { bad.push(`${pair.app} 本地参考只有 ${md.width}px 宽`); return null; }
    got = { buf, n: Number(pair.local.replace(/\D/g, "")) - 1, total: 7, w: md.width, h: md.height, from: "Mobbin 收的真界面" };
  } else {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    try {
      await p.goto(`https://play.google.com/store/apps/details?id=${pair.id}&hl=en`,
        { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(3500);
      const urls = await p.evaluate(() =>
        [...document.querySelectorAll("img")]
          .filter((i) => { const r = i.getBoundingClientRect();
            return r.height > r.width * 1.5 && r.height > 150 && r.x + r.width < 1000; })
          .map((i) => i.src).filter((s) => s.startsWith("http")));
      await p.close();
      if (!urls.length) { bad.push(`${pair.app} 一张手机截图都没抓到`); return null; }
      const n = Math.min(pair.pick, urls.length - 1);
      const big = urls[n].replace(/=[-\w]+$/, "=w1080");
      const q = await browser.newPage();
      const buf = await q.goto(big, { timeout: 45000 }).then((r) => r.body());
      await q.close();
      const md = await sharp(buf).metadata();
      if (!md.width || md.width < 400) { bad.push(`${pair.app} 抓到的图只有 ${md.width}px 宽 —— 太小`); return null; }
      got = { buf, n, total: urls.length, w: md.width, h: md.height, from: "商店页（行销版）" };
    } catch (e) {
      await p.close().catch(() => {});
      bad.push(`${pair.app} ${String(e.message ?? e).slice(0, 50)}`);
      return null;
    }
  }
  /* ── 裁掉海报，只留屏幕 ───────────────────────────────────────────────
     商店页给的是**行销版**：一句大标题压着一台手机。拿整张去比，
     第一段比到的是他们的标题对我们的画面 —— 那不是复刻，那是对错行。
     ⚠️ **这几个框是用眼睛挑的，不是算出来的。** 自动找屏幕十五张只中一张
     （亮度法对深色画面瞎，对本来就是纯屏幕的又整张都算）——
     一把十五次错十四次的尺，比没有尺更糟。
     ⚠️ Mobbin 那几张要裁掉底下那条「curated by Mobbin」。 */
  if (pair.crop) {
    const [fx0, fy0, fx1, fy1] = pair.crop;
    const left = Math.round(got.w * fx0), top = Math.round(got.h * fy0);
    const width = Math.round(got.w * (fx1 - fx0)), height = Math.round(got.h * (fy1 - fy0));
    got.buf = await sharp(got.buf).extract({ left, top, width, height }).png().toBuffer();
    got.w = width; got.h = height;
  }

  fs.writeFileSync(cache, got.buf);
  const { buf, ...rest } = got;
  fs.writeFileSync(meta, JSON.stringify(rest));
  return got;
}
