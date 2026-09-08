/**
 * 设计师做给老板挑的那种稿 —— 不是真产品的行销页。
 *
 *   npm run shoot:concepts
 *   ONLY=room-behance npm run shoot:concepts
 *
 * 老板 2026-09-08：`就是不一定要去拿真的產品 有哪些freelancer會做出來給老闆去選的`。
 *
 * 🔴 **我先前顶过一次这一条，而他讲了两次 —— 照他的。**
 * 我那时的理由（一张图 · 没有 DOM · 没有许可 · 没有真资料撑着版面）
 * 对**抄代码**是对的，对**看设计**不成立：他要的正好是
 * 「设计师会画成什么样子」，而那只有在这几个地方看得到。
 *
 * 🔴 **哪几家进得去是量出来的，而第一次量法是错的。**
 * curl 打过去 Behance 跟 Figma 都回 **200**，我照那个把它们排进名单 ——
 * 拍回来 **0 张图**。用真的浏览器再打一次：**Behance 400 · Figma 403**。
 * ⚠️ **`curl` 回 200 不等於进得去** —— 那几家认得出无头浏览器，
 * 而一份「200」跟一份「进得去」在报告里长得一模一样。
 * 这跟这个仓库栽过五次的形状是同一个：量到的东西不是画面上的东西。
 *
 * 用真的浏览器量出来的（2026-09-08）：
 *   ✅ Pinterest 24 · Mobbin 76 · Freebies UI 30 · Godly 61 · Refero 36 · SaaS Interface 34
 *   🔴 Dribbble 连线被重置 · Behance 400 · Figma 403 · Lapa 被 Cloudflare 挡 ·
 *      ui8 403 · uplabs 0 张图 · uistore 404
 *   —— **这四家不要下一轮再试一次。**
 *
 * 拍法跟 `shoot:floorplans` 不一样：**那一批要的是一张产品图，
 * 这一批要的是一整片格子** —— 他要挑，所以拍的是搜索结果那一屏。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const PAGES = [
  /* 一个厅 —— 我们那 01 */
  ["room", "https://www.pinterest.com/search/pins/?q=restaurant%20pos%20table%20floor%20plan%20ui", "餐饮桌台图"],
  /* 椅子 · 预约 —— 我们那 02 */
  ["chair", "https://www.pinterest.com/search/pins/?q=salon%20booking%20app%20dashboard%20ui", "沙龙预约"],
  /* 工位 —— 我们那 03 */
  ["bay", "https://www.pinterest.com/search/pins/?q=car%20repair%20workshop%20dashboard%20ui", "车厂"],
  /* 座位 · 点名 —— 我们那 07 */
  ["seat", "https://www.pinterest.com/search/pins/?q=seat%20map%20booking%20ui%20design", "座位图"],
  /* 今天这条路 —— 我们那 06 */
  ["route", "https://www.pinterest.com/search/pins/?q=field%20service%20route%20schedule%20app%20ui", "上门排程"],
  /* 货架 · 仓 —— 我们那 04 · 08 */
  ["rack", "https://www.pinterest.com/search/pins/?q=warehouse%20inventory%20dashboard%20ui", "库存"],

  /* 🔴 沙龙 · 老板那一端（他 2026-09-08：`先找saloon的`）。
     ⚠️ 第一次搜 `salon booking app dashboard` 回来的**几乎全部是客人那一端**
     （粉色 · 照片 · Book Appointment），老板那一端只有两张 —— **搜错词了**。
     老板要的是「现在店里长什么样」，所以词要带 staff / schedule / management。 */
  ["salon-staff", "https://www.pinterest.com/search/pins/?q=salon%20staff%20schedule%20calendar%20software", "沙龙 · 师傅排班"],
  ["salon-mgmt", "https://www.pinterest.com/search/pins/?q=salon%20management%20software%20dashboard%20admin", "沙龙 · 老板后台"],
  ["salon-day", "https://www.pinterest.com/search/pins/?q=appointment%20calendar%20day%20view%20staff%20columns%20ui", "一天 · 一个师傅一栏"],
  ["salon-chair", "https://www.pinterest.com/search/pins/?q=barbershop%20chair%20station%20management%20ui", "理发 · 椅子跟工位"],

  /* 三家还进得去的画廊 —— 给他看「设计师会画到什么程度」 */
  ["gallery-saas", "https://saasinterface.com/", "SaaS Interface · 真后台截图库"],
  ["gallery-mobbin", "https://mobbin.com/explore/web/screens", "Mobbin · 真的画面"],
  ["gallery-free", "https://freebiesui.com/category/freebies/dashboard/", "Freebies UI · 免费稿"],
];

const OUT = ".screenshots/concepts";
fs.mkdirSync(OUT, { recursive: true });
const PICK = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((x) => x.trim())) : null;

const b = await chromium.launch();
let got = 0, miss = 0;
const seen = new Map();

for (const [name, url, who] of PAGES) {
  if (PICK && !PICK.has(name)) continue;
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.6 });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 50000 });
    await p.waitForTimeout(4500);
    /* 懒载入的缩图不滚过去不会出现，而一张还没载入的图拍出来是空白格子。 */
    /* 🔴 `DEEP=2` 就往下看第二屏（老板 2026-09-08：`再往下看看`）——
       第一屏永远是最热门那几张，而往下才是没有被抄烂的那几张。 */
    const deep = Number(process.env.DEEP || 0);
    const stop = 3000 + deep * 2400;
    await p.evaluate(async (to) => {
      for (let y = 0; y < to; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 300));
      }
    }, stop + 1400);
    await p.evaluate((y) => window.scrollTo(0, y), deep ? stop - 900 : 260);
    await p.waitForTimeout(2800);

    /* 🔴 把盖住画面的东西拿掉 —— Pinterest 会弹一整片登入墙压在格子上面，
       而一张被弹层盖住中间的截图，跟一张拍坏了的截图长得一模一样。
       判准不写死是谁：**钉住的、而且盖掉视窗四分之一以上的**就拿掉。 */
    await p.keyboard.press("Escape").catch(() => {});
    await p.evaluate(() => {
      const vw = innerWidth * innerHeight;
      for (const el of document.querySelectorAll("body *")) {
        const st = getComputedStyle(el);
        if (st.position !== "fixed" && st.position !== "sticky") continue;
        const r = el.getBoundingClientRect();
        if (r.width * r.height > vw * 0.25) el.remove();
      }
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    });
    await p.waitForTimeout(900);

    const read = await p.evaluate(() => ({
      words: (document.body.innerText || "").trim().length,
      imgs: [...document.images].filter((i) => i.width > 140 && i.height > 90).length,
    }));

    /* 🔴 三条自检，照 `shootSheet` 那一套（[任务 302](../docs/founder-tasks.md)
       那五张 gentelella 就是靠它们才该被抓到的）：
       几乎没有图 = 没载到 · 跟别人一模一样 = 同一张错误页。 */
    if (read.imgs < 6) {
      miss++;
      console.log(`  ${name.padEnd(15)}🔴 只有 ${read.imgs} 张图 —— 多半没载到`);
    } else {
      const fp = `${read.words}/${read.imgs}`;
      const dup = seen.get(fp);
      seen.set(fp, name);
      await p.screenshot({ path: `${OUT}/${name}${deep ? "-d" + deep : ""}.jpg`, type: "jpeg", quality: 72,
        clip: { x: 0, y: 0, width: 1440, height: 1000 } });
      got++;
      console.log(`  ${name.padEnd(15)}${String(read.imgs).padStart(3)} 张图 · ${read.words} 个字  ${who}${dup ? `  ⚠️ 跟 ${dup} 一模一样` : ""}`);
    }
  } catch (e) {
    miss++;
    console.log(`  ${name.padEnd(15)}🔴 ${String(e).slice(0, 46)}`);
  }
  await p.close();
}
await b.close();

console.log(`\n判：拍到 ${got} 张 · 没拿到 ${miss} 张`);
console.log(`图在 ${OUT}/ —— ⚠️ 读数只能否决，好不好看只有眼睛判得了。`);
