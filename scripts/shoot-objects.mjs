/* 三个物件的实拍 —— 日程 · 价目 · 流程。
 *
 *   npm run shoot:objects
 *
 * 老板 2026-09-02：`继续 如果不够素材了 就去网上深度研究 肯定有那种freelancer的
 * 网站 还是什么网站是专业 你就可以找到足够的素材 去看看别人是怎样去做的`。
 *
 * ── 为什么是这三个物件，不是「再拍一批后台」───────────────────────────────────
 * 二十根结构轴里，这三根最浅：日程 2 种 · 价目 2 种 · 流程 3 种。
 * **一根只有两种的轴，六套风格里必然有三套共用同一个值** —— 那不是设计懒，
 * 是没有东西可以选，而那正是 `design-doc.test.ts` 那条 8/20 还降不下来的原因。
 *
 * 所以这一支跟 `shoot:admins` 不一样：那一支拍的是**整页**（挑风格用），
 * 这一支拍的是**一个物件的很多种画法**（加深轴用），而且每一张都裁到物件本身。
 *
 * ⚠️ 拍完一定要用眼睛看拼图（[重点 7l](../docs/founder-points.md)）——
 * 下面印出来的读数只能否决（「这两个画法一样」），不能通过。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const SHOTS = [
  // 日程 —— 一天/一週的时段长什么样
  ["day", "gentelella-cal",  "https://preview.colorlib.com/theme/gentelella/production/calendar.html", "Gentelella v4 · MIT 21.5k"],
  ["day", "tabler-cal",      "https://preview.tabler.io/calendar.html",                    "Tabler · MIT 41.6k"],
  ["day", "adminlte-cal",    "https://adminlte.io/themes/v3/pages/calendar.html",          "AdminLTE · MIT 45.6k"],
  ["day", "tailadmin-cal",   "https://nextjs-demo.tailadmin.com/calendar",                 "TailAdmin · MIT"],
  ["day", "fullcalendar",    "https://fullcalendar.io/demos",                              "FullCalendar · MIT 20.6k"],
  // 价目 —— 一份价钱清单长什么样
  ["price", "gentelella-inv", "https://preview.colorlib.com/theme/gentelella/production/invoice.html",   "Gentelella v4 · MIT"],
  ["price", "gentelella-ecom","https://preview.colorlib.com/theme/gentelella/production/e_commerce.html", "Gentelella v4 · MIT"],
  ["price", "tabler-pri",     "https://preview.tabler.io/pricing.html",                    "Tabler · MIT"],
  ["price", "tabler-inv",     "https://preview.tabler.io/invoice.html",                    "Tabler · MIT"],
  // 流程 —— 一单走到哪长什么样
  ["step", "gentelella-wiz",  "https://preview.colorlib.com/theme/gentelella/production/form_wizards.html",   "Gentelella v4 · MIT"],
  ["step", "gentelella-proj", "https://preview.colorlib.com/theme/gentelella/production/project_detail.html", "Gentelella v4 · MIT"],
  ["step", "gentelella-kan",  "https://preview.colorlib.com/theme/gentelella/production/kanban.html",         "Gentelella v4 · MIT"],
  ["step", "tabler-wiz",      "https://preview.tabler.io/wizard.html",                     "Tabler · MIT"],
  ["step", "antd-step",       "https://preview.pro.ant.design/form/step-form",             "Ant Design Pro · MIT 38.7k"],
  ["step", "arham-logi",      "https://next-shadcn-admin-dashboard.vercel.app/dashboard/logistics", "arhamkhnz · MIT"],
];

const OUT = ".screenshots/objects";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
/* 🔴 这一条是第一次跑就抓到的，而且它正是这个仓库栽过好几次的那个坑：
   `gentelella.colorlib.com/<任何路径>` 全部回 200，而回的是**同一张行销首页**。
   五张截图长得完全正常，读数也完全正常 —— 只是五张都一样。
   所以指纹一样就是失败，不是「这几页很像」。 */
const seen = new Map();
for (const [kind, name, url, who] of SHOTS) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(6000);
    const m = await p.evaluate(() => {
      const words = (document.body.innerText.match(/\S+/g) || []).length;
      /* 一个粗但诚实的读数：整页最宽的那几块、圆角、有没有格线。
         判「这两个画法一不一样」要用眼睛，这几个数字只用来挡掉没载入的那几张。 */
      const cells = document.querySelectorAll("td,th").length;
      const svg = document.querySelectorAll("svg").length;
      return { words, cells, svg, h: document.body.scrollHeight,
               login: /sign in|log in|登录|登入|password/i.test(document.body.innerText.slice(0, 600)) };
    });
    await p.screenshot({ path: `${OUT}/${kind}-${name}.jpg`, type: "jpeg", quality: 66 });
    const fp = `${m.h}/${m.cells}/${m.svg}/${m.words}`;
    const twin = seen.get(fp);
    seen.set(fp, twin ?? `${kind}-${name}`);
    const bad = twin
      ? `  🔴 跟 ${twin} 一模一样 —— 多半根本没换页`
      : m.login ? "  ⚠️ 像登入页" : m.words < 60 ? "  ⚠️ 几乎没有字" : "";
    console.log(`${kind.padEnd(6)} ${name.padEnd(17)} ${String(m.h).padStart(6)}px  格 ${String(m.cells).padStart(4)}  图形 ${String(m.svg).padStart(3)}  ${who}${bad}`);
  } catch (e) {
    console.log(`${kind.padEnd(6)} ${name.padEnd(17)} 读不到  ${String(e).slice(0, 46)}`);
  }
  await p.close();
}
await b.close();
console.log(`\n→ ${OUT}/   ⚠️ 现在去用眼睛看，读数只能否决不能通过`);
