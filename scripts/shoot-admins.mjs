/* 后台模板的实拍 —— 一次拿一批，摊成一张给老板挑。
 *
 *   npm run shoot:admins
 *
 * 老板 2026-09-02：`就是我觉得可以再去找更多这种后台模板的参考 我们直接复刻成风格
 * 然后选几套来复刻作为我们的后台system的UI`。
 *
 * ⚠️ [重点 7m](../docs/founder-points.md)：**量要大**——「他要的是挑，三个不叫挑」。
 * ⚠️ [任务 77](../docs/founder-tasks.md) 查过许可：**后台跟官网相反**，
 * 官网没有开源可拿（所以才抄模版），后台这一边可以直接拿 MIT 的代码。
 * 每一个都记它的星数跟许可，挑的时候要看得到。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const SITES = [
  /* ⚠️ 第一轮十二个只有六个拍到真的后台：kiran / pure-admin / art-design 停在登入页，
     vben 是空的，horizon 的部署暂停了，tabler-crm 那个网址 404。
     **一个停在登入页的截图，长得跟一张正常的截图一模一样** —— 所以下面
     每一个都换成确定不用登入的那一页，而且拍完要用眼睛看拼图。 */
  ["arham-crm",       "https://next-shadcn-admin-dashboard.vercel.app/dashboard/crm",        "arhamkhnz · MIT"],
  ["arham-finance",   "https://next-shadcn-admin-dashboard.vercel.app/dashboard/finance",    "arhamkhnz · MIT"],
  ["arham-default",   "https://next-shadcn-admin-dashboard.vercel.app/dashboard/default",    "arhamkhnz · MIT"],
  ["arham-invoice",   "https://next-shadcn-admin-dashboard.vercel.app/pages/invoice",        "arhamkhnz · MIT"],
  ["arham-kanban",    "https://next-shadcn-admin-dashboard.vercel.app/pages/kanban",         "arhamkhnz · MIT"],
  ["arham-logistics", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/logistics",  "arhamkhnz · MIT"],
  ["tabler",          "https://preview.tabler.io/",                                           "tabler · MIT 41.5k"],
  ["tabler-invoice",  "https://preview.tabler.io/invoice.html",                                "tabler · MIT 41.5k"],
  ["tabler-users",    "https://preview.tabler.io/users.html",                                  "tabler · MIT 41.5k"],
  ["shadcn-admin",    "https://shadcn-admin.netlify.app/",                                     "satnaing · MIT 14k"],
  ["shadcn-tasks",    "https://shadcn-admin.netlify.app/tasks",                                "satnaing · MIT 14k"],
  ["antd-pro",        "https://preview.pro.ant.design/dashboard/analysis",                     "ant-design · MIT 38.7k"],
  ["antd-workplace",  "https://preview.pro.ant.design/dashboard/workplace",                    "ant-design · MIT 38.7k"],
  ["adminlte",        "https://adminlte.io/themes/v3/index.html",                              "ColorlibHQ · MIT 45.5k"],
  ["tailadmin",       "https://free-demo.tailadmin.com/",                                      "TailAdmin · 免费版"],
  ["flowbite",        "https://flowbite-admin-dashboard.vercel.app/",                          "Flowbite · MIT"],
  ["windmill",        "https://windmill-dashboard.vercel.app/",                                "Windmill · MIT"],
  ["soft-ui",         "https://demos.creative-tim.com/soft-ui-dashboard-tailwind/pages/dashboard.html", "Creative Tim · MIT"],
  ["notus",           "https://demos.creative-tim.com/notus-nextjs/admin/dashboard",           "Creative Tim · MIT"],
  ["volt",            "https://demo.themesberg.com/volt/",                                     "Themesberg · MIT"],
  ["mantis",          "https://mantisdashboard.io/free/",                                      "CodedThemes · MIT"],
  ["refine",          "https://example.refine.dev/",                                           "refine · MIT 35.6k"],
];

const OUT = ".screenshots/admins";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [name, url, repo] of SITES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(6500);
    /* 逐像素量一下：地是什么颜色、最大一块占多少、有颜色的面积多少。
       那是老板讲「专业感」时真正在看的东西（见 kit.tsx 的 SplitCard 档头）。 */
    const m = await p.evaluate(() => ({
      h: document.body.scrollHeight,
      cards: [...document.querySelectorAll("div,section,article")].filter((e) => {
        const c = getComputedStyle(e); const r = e.getBoundingClientRect();
        return r.width > 140 && r.height > 80 && parseFloat(c.borderRadius) > 2 &&
          (c.boxShadow !== "none" || parseFloat(c.borderTopWidth) > 0);
      }).length,
      bg: getComputedStyle(document.body).backgroundColor,
      title: document.title.slice(0, 40),
      /* 停在登入页、或者整页几乎没有字，都算没拍到。 */
      looksLikeLogin: /sign in|log in|登录|登入|password/i.test(document.body.innerText.slice(0, 600)),
      words: (document.body.innerText.match(/\S+/g) || []).length,
    }));
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 62 });
    const bad = m.looksLikeLogin ? "  ⚠️ 像登入页" : m.words < 60 ? "  ⚠️ 几乎没有字" : "";
    console.log(`${name.padEnd(15)} ${String(m.h).padStart(6)}px  卡片 ${String(m.cards).padStart(3)}  字 ${String(m.words).padStart(4)}  ${repo}${bad}`);
  } catch (e) {
    console.log(`${name.padEnd(15)} 读不到  ${String(e).slice(0, 48)}`);
  }
  await p.close();
}
await b.close();
console.log(`\n→ ${OUT}/`);
