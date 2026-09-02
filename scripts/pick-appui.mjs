/* 挑一套来抄 —— 摊成一张，他指哪一个就是哪一个。
 *
 *   npm run pick:appui        （吃 shoot:appui 已经拍好的图，不重拍）
 *
 * 老板 2026-09-02：`都还没选模版` → `去挑这个 我们做一套吧`。
 * **他讲对了：我上一轮跳过了挑模版那一步，直接拿四条去量自己。**
 * [重点 7m](../docs/founder-points.md)：量要大、摊成一张、他指哪一个就是哪一个。
 *
 * ⚠️ 只放**老板自己每天要用**的那几个。消费者那几个（Shopee · Lazada · Boost）
 * 跟画廊不放进来 —— 那不是我们要抄的东西，摆进来只是多几个要跳过的
 * （[重点 12](../docs/founder-points.md)）。
 *
 * ⚠️ 一组一张，一排一个，而且 shoot:appui 那一轮就要两倍解析度。
 * 第一版两个一排、一倍拍，每一张手机只剩 ~150px —— 老板 2026-09-03：
 * 「太模糊了 我看不到」。**一张他判不了的对照图，跟没有那张图一样**
 * （[重点 3](../docs/founder-points.md)）。放大一张小图不会长出细节，
 * 要在拍的时候就多拿像素；而一张 9000px 高的总表打开来会被缩到塑屏幕，
 * 那跟模糊是同一件事。
 */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

const OUT = ".screenshots/appui";

/* 每一句写的是「抄它，我们会拿到什么」，不是它有多好看。 */
const GROUPS = [
  ["承包商 · 上门服务 —— 他最大的那个市场", [
    ["servicem8", "ServiceM8", "五张就是我们的走单：排程 · 工单 · 打卡 · 拍工地照 · 历史"],
    ["jobber", "Jobber", "同一行，多了报价跟收款；画面比较满"],
    ["housecall", "Housecall Pro", "同一行，深蓝＋大字，先讲卖点再给画面"],
  ]],
  ["沙龙 · 预约 —— 他手上那一单", [
    ["fresha", "Fresha for business", "深底＋粉彩卡；预约表长在第一屏"],
    ["booksy", "Booksy Biz", "一整片日历格子当主角"],
  ]],
  ["记帐 · 开单", [
    ["xero", "Xero", "一个大数字＋一条走势，其余全部收起来"],
    ["quickbooks", "QuickBooks", "拍收据 → 变成一行；开单可以在外面做"],
    ["zohobooks", "Zoho Books", "白底＋一个品牌色，最安静的一套"],
  ]],
  ["走单 · 看板 · 模块", [
    ["odoo", "Odoo", "手机首页是一格一格的模块图标 —— 跟我们十八个模块同一个形状"],
    ["monday", "monday", "彩色状态条，一眼看得出哪一单卡住"],
    ["trello", "Trello", "看板，最简单的那一种"],
    ["notion", "Notion", "近白、留白多、插画带路"],
  ]],
  ["收钱 · POS", [
    ["square", "Square", "一颗大按钮＋金额，收钱那一刻只有一件事"],
    ["loyverse", "Loyverse", "商品格子＋左右分栏，最密"],
    ["shopify", "Shopify", "店主端：订单、货、店，三格分页"],
  ]],
];

const missing = [];
const cell = ([f, name, why]) => {
  const p = `${OUT}/${f}.jpg`;
  if (!fs.existsSync(p)) { missing.push(f); return ""; }
  return `<figure><img src="${pathToFileURL(p).href}">
    <figcaption><b>${name}</b><span>${why}</span></figcaption></figure>`;
};

const STYLE = `<style>
 body{margin:0;background:#0e1113;color:#cfc8ba;font:13px/1.5 system-ui,sans-serif;padding:26px}
 h2{font:700 21px/1.2 system-ui;color:#fff;margin:0 0 4px}
 p.lede{margin:0 0 20px;color:#9a938a}
 .g{display:grid;grid-template-columns:1fr;gap:24px}
 figure{margin:0}
 img{width:100%;display:block;border-radius:8px;background:#fff}
 figcaption{margin-top:8px}
 figcaption b{color:#fff;font-size:16px;display:block}
 figcaption span{color:#9a938a;font-size:14px}
</style>`;

const b = await chromium.launch();
const made = [];
for (let i = 0; i < GROUPS.length; i++) {
  const [title, items] = GROUPS[i];
  const file = `${OUT}/pick-${i + 1}.jpg`;
  const html = `<!doctype html><meta charset="utf-8">${STYLE}
    <h2>${title}</h2>
    <p class="lede">每一句写的是「抄它我们会拿到什么」，不是它好不好看。</p>
    <div class="g">${items.map(cell).join("")}</div>`;
  fs.writeFileSync(`${OUT}/pick-${i + 1}.html`, html);
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  await p.goto(pathToFileURL(`${OUT}/pick-${i + 1}.html`).href);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: file, type: "jpeg", quality: 90, fullPage: true });
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.close();
  made.push(file);
  /* 一张太高的图，打开来会被缩到塞满萤幕，结果跟模糊一样判不了。 */
  console.log(`${file}  ${h}px  ${title}${h > 4200 ? "  !! 太高" : ""}`);
}
await b.close();

console.log(`\n→ ${made.length} 张，一组一张，打开就看得清`);
if (missing.length) {
  console.log(`\n!! ${missing.length} 张图不在：${missing.join(" ")} —— 先跑 npm run shoot:appui`);
  process.exit(1);
}
