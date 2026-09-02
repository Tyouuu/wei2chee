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
     每一个都换成确定不用登入的那一页，而且拍完要用眼睛看拼图。

     2026-09-02 第二轮（老板：`总之不够素材就去帮我去找`）：
     许可跟星数全部用 `gh api` 查过，不是读首页；每一个网址都先打过一次看回几。
     加进来的十二个都是 MIT（tremor 是 Apache-2.0），而且都有活着的 demo。 */

  // ── 已经在用的六个参考（`design-system/register-references.ts` 指着它们）──
  ["arham-crm",       "https://next-shadcn-admin-dashboard.vercel.app/dashboard/crm",        "arhamkhnz · MIT 3.0k"],
  ["shadcn-tasks",    "https://shadcn-admin.netlify.app/tasks",                               "satnaing · MIT 14k"],
  ["antd-workplace",  "https://preview.pro.ant.design/dashboard/workplace",                   "ant-design · MIT 38.7k"],
  ["tabler",          "https://preview.tabler.io/",                                           "tabler · MIT 41.6k"],
  ["tabler-invoice",  "https://preview.tabler.io/invoice.html",                                "tabler · MIT 41.6k"],
  ["tailadmin",       "https://free-demo.tailadmin.com/",                                      "TailAdmin · 免费版"],

  // ── 同一批来源的别的页，抄的时候用得上 ──────────────────────────────────
  ["arham-finance",   "https://next-shadcn-admin-dashboard.vercel.app/dashboard/finance",     "arhamkhnz · MIT"],
  ["arham-default",   "https://next-shadcn-admin-dashboard.vercel.app/dashboard/default",     "arhamkhnz · MIT"],
  ["arham-logistics", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/logistics",   "arhamkhnz · MIT"],
  ["shadcn-admin",    "https://shadcn-admin.netlify.app/",                                     "satnaing · MIT"],
  ["antd-pro",        "https://preview.pro.ant.design/dashboard/analysis",                     "ant-design · MIT"],
  ["tabler-users",    "https://preview.tabler.io/users.html",                                  "tabler · MIT"],

  // ── 🟢 2026-09-02 新找的。Gentelella v4 是这一批里最值钱的：2026 重写、58 页 ──
  /* ⚠️ `gentelella.colorlib.com` 是**行销页不是 demo** —— 任何路径都回 200，
     而且回同一张首页。真的在 preview.colorlib.com 底下。 */
  ["gentelella",      "https://preview.colorlib.com/theme/gentelella/production/index.html",   "ColorlibHQ · MIT 21.5k"],
  ["gentelella-cal",  "https://preview.colorlib.com/theme/gentelella/production/calendar.html","ColorlibHQ · MIT 21.5k"],
  ["gentelella-inv",  "https://preview.colorlib.com/theme/gentelella/production/invoice.html", "ColorlibHQ · MIT 21.5k"],
  ["gentelella-proj", "https://preview.colorlib.com/theme/gentelella/production/project_detail.html", "ColorlibHQ · MIT 21.5k"],
  ["gentelella-kan",  "https://preview.colorlib.com/theme/gentelella/production/kanban.html",  "ColorlibHQ · MIT 21.5k"],
  ["gentelella-ecom", "https://preview.colorlib.com/theme/gentelella/production/e_commerce.html", "ColorlibHQ · MIT 21.5k"],

  ["shadcnstore",     "https://shadcnstore.com/templates/dashboard/shadcn-dashboard-landing-template/dashboard", "shadcnstore · MIT 1.1k"],
  ["admin-one",       "https://justboil.github.io/admin-one-react-tailwind/dashboard",          "justboil · MIT 590"],
  /* ⚠️ 这四个的 demo 站在登入墙后面（都有密码框），实测过不是网址写错：
     Kiranism/next-shadcn-dashboard-starter · devias-io/material-kit-react ·
     Qualiora/shadboard · vercel/nextjs-postgres-nextauth-tailwindcss-template。
     **不留在名单里**，不然这把尺每跑一次就对我叫一次狼 —— 一把天天叫狼的尺
     没有人会看（`check:upstream` 已经栽过同一件）。要看它们只能自己 clone 起来跑。 */
  ["tremor",          "https://dashboard.tremor.so/overview",                                  "tremorlabs · Apache-2.0 516"],
  ["modernize",       "https://modernize-nextjs-free.vercel.app/",                             "adminmart · MIT 425"],
  ["mantine-analytics","https://mantine-analytics-dashboard.netlify.app/dashboard/default",    "design-sparx · MIT 387"],
  ["dashui",          "https://dashui.codescandy.com/next-js-admin-dashboard-template.html",   "codescandy · MIT 178"],
  ["tailadmin-next",  "https://nextjs-demo.tailadmin.com/",                                    "TailAdmin · MIT 2.5k"],

  // ── 旧的那几个，留着当「过时的设计」的对照（[任务 100](../docs/founder-tasks.md)）──
  ["adminlte",        "https://adminlte.io/themes/v3/index.html",                              "ColorlibHQ · MIT 45.6k · 2014 的设计语言"],
  ["notus",           "https://demos.creative-tim.com/notus-nextjs/admin/dashboard",           "Creative Tim · MIT · 2020"],
  ["soft-ui",         "https://demos.creative-tim.com/soft-ui-dashboard-tailwind/pages/dashboard.html", "Creative Tim · MIT · 2021"],
  ["refine",          "https://example.refine.dev/",                                           "refine · MIT 35.6k"],
];

const OUT = ".screenshots/admins";
fs.mkdirSync(OUT, { recursive: true });
/* 🔴 两张读数一模一样 = 多半根本没换页。`gentelella.colorlib.com` 就是这样骗过
   一次：每一个路径都回 200，回的是同一张行销首页，五张截图长得完全正常。 */
const seen = new Map();
let bad = 0;
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
      /* ⚠️ 第一版只看头 600 个字里有没有「sign in」，於是**侧栏上一个
         「Sign In」的选单项**就把一张好好的后台判成登入页（mantine · soft-ui
         两张都被冤枉过）。一张登入页真正的特徵是**整页只有那一件事**：
         字少，而且画面上有一个密码框。 */
      looksLikeLogin:
        !!document.querySelector('input[type="password"]') ||
        ((document.body.innerText.match(/\S+/g) || []).length < 120 &&
          /sign in|log in|登录|登入/i.test(document.body.innerText.slice(0, 400))),
      words: (document.body.innerText.match(/\S+/g) || []).length,
    }));
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 62 });
    const fp = `${m.h}/${m.cards}/${m.words}`;
    const twin = seen.get(fp);
    seen.set(fp, twin ?? name);
    const note = twin
      ? `  🔴 跟 ${twin} 一模一样 —— 多半没换页`
      : m.looksLikeLogin ? "  🔴 像登入页" : m.words < 60 ? "  🔴 几乎没有字" : "";
    if (note) bad++;
    console.log(`${name.padEnd(17)} ${String(m.h).padStart(6)}px  卡片 ${String(m.cards).padStart(3)}  字 ${String(m.words).padStart(4)}  ${repo}${note}`);
  } catch (e) {
    bad++;
    console.log(`${name.padEnd(17)} 🔴 读不到  ${String(e).slice(0, 48)}`);
  }
  await p.close();
}
await b.close();
/* 摊成一张，他一眼看得完。
 * [重点 7m](../docs/founder-points.md)：「他要的是**挑**，三个不叫挑」——
 * 三十张分成三十个档案也不叫挑，那叫三十次开档案。 */
{
  const { createRequire } = await import("node:module");
  const sharp = createRequire(import.meta.url)("sharp");
  const W = 420, PER_ROW = 5, LABEL = 26;
  const tiles = [];
  for (const [name, , repo] of SITES) {
    const f = `${OUT}/${name}.jpg`;
    if (!fs.existsSync(f)) continue;
    /* 只取第一屏 —— 一张 7000px 高的页缩到 420 宽就是一条看不见的线。
       挑风格看的是**打开的那一眼**。 */
    const img = await sharp(f).resize({ width: W }).toBuffer();
    const h = Math.min((await sharp(img).metadata()).height, 300);
    const top = await sharp(img).extract({ left: 0, top: 0, width: W, height: h }).toBuffer();
    const label = Buffer.from(
      `<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#0b0d13"/>` +
        `<text x="6" y="17" font-family="monospace" font-size="12" fill="#00beb7">${name}</text>` +
        `<text x="${W - 6}" y="17" text-anchor="end" font-family="monospace" font-size="10" fill="#6c7686">` +
        `${repo.replace(/[<>&]/g, "")}</text></svg>`,
    );
    tiles.push(
      await sharp({ create: { width: W, height: h + LABEL, channels: 3, background: "#0b0d13" } })
        .composite([{ input: top, top: 0, left: 0 }, { input: label, top: h, left: 0 }])
        .png()
        .toBuffer(),
    );
  }
  const rows = Math.ceil(tiles.length / PER_ROW);
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const rowH = [];
  for (let r = 0; r < rows; r++)
    rowH.push(Math.max(...metas.slice(r * PER_ROW, (r + 1) * PER_ROW).map((m) => m.height)));
  const G = 8;
  const sheetW = PER_ROW * W + (PER_ROW + 1) * G;
  const sheetH = rowH.reduce((a, c) => a + c + G, G);
  const comp = [];
  let y = G;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < PER_ROW; c++) {
      const i = r * PER_ROW + c;
      if (i >= tiles.length) break;
      comp.push({ input: tiles[i], left: G + c * (W + G), top: y });
    }
    y += rowH[r] + G;
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#0b0d13" } })
    .composite(comp)
    .jpeg({ quality: 72 })
    .toFile(`${OUT}/sheet.jpg`);
  console.log(`\n${tiles.length} 张摊成一张 → ${OUT}/sheet.jpg`);
}

console.log(`\n→ ${OUT}/   ⚠️ 现在去用眼睛看拼图，读数只能否决`);
if (bad) {
  /* **拍坏了要红。** 一张拍到登入页的截图，跟一张正常的截图，在报告里
     长得一模一样 —— 这个仓库被这件事骗过至少四次。 */
  console.log(`\n🔴 ${bad} 张没拍到。`);
  process.exit(1);
}
