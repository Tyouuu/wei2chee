/**
 * 那张产品图本身 —— 不是行销页的第一屏。
 *
 *   npm run shoot:productshot
 *   ONLY=linear,attio npm run shoot:productshot
 *
 * 老板 2026-09-08：`我要知道外面的人都是怎麼去做 怎麼去提升的`。
 *
 * 🔴 `shoot:products` 拍出来是**四张行销第一屏**（一句大标题加一颗按钮）——
 * `shootSheet` 拍的是**视窗那一屏**，而每一个产品把自己的画面放在折叠以下。
 * 那一批的读数（13312px · 字 1557）看起来完全正常，**而它答不了他问的那一句**。
 * 这跟 [任务 87](../docs/founder-tasks.md) 那次是同一个形状：
 * 整页截图拍不到滚出来的东西，而我把拍不到当成了「那里是空的」。
 *
 * 所以这一支只做一件事：**在那一页上找出最大的那张产品图，把它拍下来。**
 * 那是他们自己挑出来给人看的那一屏 —— 也就是他们认为最能代表自己的那一屏。
 *
 * ⚠️ 它拿不到的：登入后面的内页 · 会动的那几段。
 * [任务 267](../docs/founder-tasks.md) 判过：真的画面公开只拿得到这一种。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const SITES = [
  ["attio", "https://attio.com", "Attio · CRM"],
  ["folk", "https://www.folk.app", "folk · CRM"],
  ["pipedrive", "https://www.pipedrive.com", "Pipedrive · CRM"],
  ["twenty", "https://twenty.com", "Twenty · 开源 CRM"],
  ["ramp", "https://ramp.com", "Ramp · 钱"],
  ["mercury", "https://mercury.com", "Mercury · 钱"],
  ["qonto", "https://qonto.com/en", "Qonto · 钱"],
  ["housecall", "https://www.housecallpro.com", "Housecall Pro · 上门服务"],
  ["fresha", "https://www.fresha.com", "Fresha · 沙龙"],
  ["servicetitan", "https://www.servicetitan.com", "ServiceTitan · 上门服务"],
  ["loyverse", "https://loyverse.com", "Loyverse · 收银"],
  ["linear", "https://linear.app", "Linear"],
  ["notion", "https://www.notion.com", "Notion"],
  ["stripe", "https://stripe.com", "Stripe"],

  /* 🔴 产品**里面**的 AI 助手长什么样。老板 2026-09-08：
     `然後產品的ai 助手應該要怎麼去設計啊 這些全部都是要去找的`。
     ⚠️ 这几张也是行销页上的产品图 —— 拿的是**它摆在哪、怎么进场、
     做完之后画面上留下什么**，不是它答得准不准。 */
  ["ai-notion", "https://www.notion.com/product/ai", "Notion AI"],
  ["ai-linear", "https://linear.app/agents", "Linear · Agents"],
  ["ai-attio", "https://attio.com/product/ai", "Attio AI"],
  ["ai-intercom", "https://www.intercom.com/fin", "Intercom Fin"],
];

const OUT = ".screenshots/productshot";
fs.mkdirSync(OUT, { recursive: true });
const PICK = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((x) => x.trim())) : null;

const b = await chromium.launch();
const rows = [];
for (const [name, url, who] of SITES) {
  if (PICK && !PICK.has(name)) continue;
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(3500);

    /* 一路滚到底再滚回来 —— 懒载入的图不滚过去不会出现，
       而一张还没载入的 `<img>` 量出来是 0×0，会被下面那道门槛丢掉。 */
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    });
    await p.waitForTimeout(2500);

    /* 🔴 「最大的那一张」要按**画出来的面积**挑，不是按档案大小 ——
       一张 4000px 宽的背景图缩到 200px 之后不是这一页的主角。
       而且要**不是 logo**：宽高比太极端的（细长的横幅 · 方形的图标）丢掉。 */
    const hit = await p.evaluate(() => {
      const best = [...document.querySelectorAll("img, video, canvas, picture")]
        .map((el) => {
          const r = el.getBoundingClientRect();
          const top = r.top + window.scrollY;
          return { el, w: r.width, h: r.height, top, area: r.width * r.height };
        })
        .filter((x) => x.w > 420 && x.h > 260 && x.w / x.h > 0.9 && x.w / x.h < 3.2)
        .sort((a, b) => b.area - a.area)[0];
      if (!best) return null;
      best.el.setAttribute("data-shot", "1");
      window.scrollTo(0, Math.max(0, best.top - 120));
      return { w: Math.round(best.w), h: Math.round(best.h), top: Math.round(best.top) };
    });
    await p.waitForTimeout(1200);

    if (!hit) {
      rows.push({ name, who, note: "🔴 这一页上找不到一张够大的产品图" });
      console.log(`  ${name.padEnd(14)}🔴 找不到产品图`);
    } else {
      await p.locator("[data-shot]").first().screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 78 });
      rows.push({ name, who, ...hit });
      console.log(`  ${name.padEnd(14)}${hit.w}×${hit.h}  ${who}`);
    }
  } catch (e) {
    rows.push({ name, who, note: `🔴 ${String(e).slice(0, 50)}` });
    console.log(`  ${name.padEnd(14)}🔴 ${String(e).slice(0, 50)}`);
  }
  await p.close();
}
await b.close();

const bad = rows.filter((r) => r.note).length;
console.log(`\n判：${rows.length} 个 · 拍到 ${rows.length - bad} 张产品图 · ${bad} 个没有`);
console.log(`图在 ${OUT}/ —— ⚠️ 读数只能否决，好不好看要用眼睛看。`);
