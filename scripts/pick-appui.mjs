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

const html = `<!doctype html><meta charset="utf-8"><style>
 body{margin:0;background:#0e1113;color:#cfc8ba;font:13px/1.5 system-ui,sans-serif;padding:30px}
 h1{font:700 26px/1.2 system-ui;color:#fff;margin:0 0 6px}
 p.lede{margin:0 0 26px;color:#9a938a;max-width:64ch}
 h2{font:600 14px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;color:#00beb7;
    margin:34px 0 14px;padding-top:14px;border-top:1px solid #232a2e}
 .g{display:grid;grid-template-columns:repeat(2,1fr);gap:22px}
 figure{margin:0}
 img{width:100%;display:block;border-radius:8px;background:#fff}
 figcaption{margin-top:8px}
 figcaption b{color:#fff;font-size:15px;display:block}
 figcaption span{color:#9a938a;font-size:13px}
</style>
<h1>挑一套来抄 —— 手机上怎么摆</h1>
<p class="lede">十五套风格不做，做一套。下面每一句写的是「抄它我们会拿到什么」，
不是它好不好看。指一个就可以。</p>
${GROUPS.map(([title, items]) =>
  `<h2>${title}</h2><div class="g">${items.map(cell).join("")}</div>`).join("")}`;

fs.writeFileSync(`${OUT}/pick.html`, html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1200 } });
await p.goto(pathToFileURL(`${OUT}/pick.html`).href);
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/pick.jpg`, type: "jpeg", quality: 76, fullPage: true });
await p.close();
await b.close();

console.log(`→ ${OUT}/pick.jpg`);
if (missing.length) {
  /* 少一张图跟一张全的表，在报告里长得一模一样。 */
  console.log(`\n🔴 ${missing.length} 张图不在：${missing.join(" ")} —— 先跑 npm run shoot:appui`);
  process.exit(1);
}
