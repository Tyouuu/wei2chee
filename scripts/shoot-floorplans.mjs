/**
 * 别人的「平面图」长什么样 —— 桌台图 · 椅子 · 工位 · 座位 · 今天这条路。
 *
 *   npm run shoot:floorplans
 *   GROUP=room,chair npm run shoot:floorplans
 *
 * 老板 2026-09-08：`然後我覺得你應該去找找這些的模板 因為你的設計可以說是沒有的`。
 *
 * 🔴 **他讲对了，而且这是[重点 7d](../docs/founder-points.md)**：动手之前先去看
 * 别人怎么做。前面那一套八个场景是我自己画的，**一张参考都没找过**。
 *
 * 🔴 **而开源那一边先查过了，是空的**（`gh api` 搜 seat map / floor plan /
 * table layout / seating chart 四组）：最大的一个 **22 颗星**，其余全部
 * 0–5 星、一半没有许可档。跟 [任务 63](../docs/founder-tasks.md) 量到的规律
 * 一模一样 —— **钱 · 排程 · 库存这几块，别人锁得最紧**。
 * 反过来看：如果它随便拿得到，我们每一个对手早就都有了。
 *
 * 所以参考只拿得到**真产品行销页上那几张图**。
 * ⚠️ [任务 267](../docs/founder-tasks.md) 判过：它们的内页在登入后面，
 * 公开拿得到的只有这一种 —— 而那是**它们自己挑出来给人看的那一屏**。
 *
 * 拍法照 `shoot:productshot`：**滚完整页，找出最大的那张产品图，拍它**。
 * `shootSheet` 拍的是视窗那一屏，而每一家把自己的画面放在折叠以下。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const GROUPS = {
  /* 一个厅 —— 我们那 01。四家餐饮 POS 都把桌台图当**主画面**。 */
  room: [
    ["lightspeed", "https://www.lightspeedhq.com/pos/restaurant/floor-plan/", "Lightspeed · 餐饮"],
    ["touchbistro", "https://www.touchbistro.com/features/floor-plan-management/", "TouchBistro · 桌台图"],
    ["square-rest", "https://squareup.com/us/en/point-of-sale/restaurants", "Square · 餐饮"],
    ["storehub", "https://www.storehub.com/en-my/", "StoreHub · 本地"],
  ],

  /* 椅子跟房间 —— 我们那 02。⚠️ [任务 296](../docs/founder-tasks.md) 量过：
     两家最大的沙龙软件**不给椅子图，给一个师傅一栏的日历** ——
     所以这一组要看的是「他们为什么不画椅子」。 */
  chair: [
    ["zenoti", "https://www.zenoti.com/", "Zenoti · 沙龙"],
    ["fresha", "https://www.fresha.com/for-business", "Fresha · 沙龙"],
    ["booksy", "https://booksy.com/biz/en-us/", "Booksy Biz"],
    ["phorest", "https://www.phorest.com/", "Phorest · 沙龙"],
  ],

  /* 工位 —— 我们那 03。车厂那一行的板子。 */
  bay: [
    ["shopmonkey", "https://www.shopmonkey.io/", "Shopmonkey · 车厂"],
    ["tekmetric", "https://www.tekmetric.com/", "Tekmetric · 车厂"],
    ["autoleap", "https://autoleap.com/", "AutoLeap · 车厂"],
  ],

  /* 今天这条路 —— 我们那 06。上门服务那一行。 */
  route: [
    ["jobber", "https://www.getjobber.com/features/scheduling/", "Jobber · 排程"],
    ["housecall", "https://www.housecallpro.com/features/scheduling/", "Housecall Pro"],
    ["workiz", "https://www.workiz.com/features/scheduling/", "Workiz"],
  ],

  /* 货架跟仓 —— 我们那 04 跟 08。 */
  rack: [
    ["sortly", "https://www.sortly.com/", "Sortly · 库存"],
    ["inflow", "https://www.inflowinventory.com/", "inFlow"],
    ["katana", "https://katanamrp.com/", "Katana"],
  ],
};

const OUT = ".screenshots/floorplans";
fs.mkdirSync(OUT, { recursive: true });
const pick = process.env.GROUP?.split(",").map((x) => x.trim()).filter(Boolean);
const groups = Object.entries(GROUPS).filter(([k]) => !pick?.length || pick.includes(k));

const b = await chromium.launch();
let got = 0, miss = 0;
const seen = new Map();

for (const [g, sites] of groups) {
  console.log(`\n== ${g} · ${sites.length} 家 ==`);
  for (const [name, url, who] of sites) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    try {
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await p.waitForTimeout(3200);
      await p.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(2200);

      const hit = await p.evaluate(() => {
        const best = [...document.querySelectorAll("img, video, canvas, picture")]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { el, w: r.width, h: r.height, top: r.top + window.scrollY, area: r.width * r.height };
          })
          .filter((x) => x.w > 420 && x.h > 260 && x.w / x.h > 0.9 && x.w / x.h < 3.2)
          .sort((a, b) => b.area - a.area)[0];
        if (!best) return null;
        best.el.setAttribute("data-shot", "1");
        window.scrollTo(0, Math.max(0, best.top - 110));
        return { w: Math.round(best.w), h: Math.round(best.h) };
      });
      await p.waitForTimeout(1000);

      if (!hit) {
        miss++;
        console.log(`  ${name.padEnd(14)}🔴 找不到产品图`);
      } else {
        /* 🔴 跨整轮查重 —— 一家挡爬虫回同一张错误页，分在两组里就撞不到
           （[任务 302](../docs/founder-tasks.md) 那五张 gentelella 就是这样过关的）。 */
        const fp = `${hit.w}x${hit.h}`;
        const dup = seen.get(fp);
        seen.set(fp, name);
        await p.locator("[data-shot]").first()
          .screenshot({ path: `${OUT}/${g}-${name}.jpg`, type: "jpeg", quality: 80 });
        got++;
        console.log(`  ${name.padEnd(14)}${hit.w}×${hit.h}  ${who}${dup ? `  ⚠️ 跟 ${dup} 一模一样` : ""}`);
      }
    } catch (e) {
      miss++;
      console.log(`  ${name.padEnd(14)}🔴 ${String(e).slice(0, 46)}`);
    }
    await p.close();
  }
}
await b.close();

console.log(`\n判：拍到 ${got} 张 · 没拿到 ${miss} 张`);
console.log(`图在 ${OUT}/ —— ⚠️ 读数只能否决，像不像只有眼睛判得了。`);
