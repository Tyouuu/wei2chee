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
import { shootSheet } from "./lib/shoot-sheet.mjs";

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

  /* 🔴 2026-09-04 老板挑了这一套当我们系统唯一的样子，所以它**全部十一页**都要拍。
     ⚠️ 而这一轮抓到一件：`arham-invoice` / `arham-kanban` 两张旧截图是
     **「Page not found」**，我一度把它们算进「十二张死掉的模板」里回报给他。
     去打才知道**部署活得好好的**（仓库 2026-09-03 还在推，首页回 200）——
     是它把路径从 `/pages/*` 搬到了 `/dashboard/*`。
     **一张 404 的截图，跟一个真的停掉的模板，在档名跟读数上长得一模一样**，
     而分辨的方法只有一个：去打那个网址看它回几。
     这两页从来没有任何脚本管过，所以网址过期了三个月没有人知道 —— 现在管了。 */
  ["arham-invoice",    "https://next-shadcn-admin-dashboard.vercel.app/dashboard/invoice",                   "arhamkhnz · MIT"],
  ["arham-kanban",     "https://next-shadcn-admin-dashboard.vercel.app/dashboard/kanban",                    "arhamkhnz · MIT"],
  ["arham-tasks",      "https://next-shadcn-admin-dashboard.vercel.app/dashboard/tasks",                     "arhamkhnz · MIT"],
  ["arham-users",      "https://next-shadcn-admin-dashboard.vercel.app/dashboard/users",                     "arhamkhnz · MIT"],
  ["arham-academy",    "https://next-shadcn-admin-dashboard.vercel.app/dashboard/academy",                   "arhamkhnz · MIT"],
  ["arham-e-commerce", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/e-commerce",                "arhamkhnz · MIT"],
  ["arham-analytics",  "https://next-shadcn-admin-dashboard.vercel.app/dashboard/analytics",                 "arhamkhnz · MIT"],
  ["arham-productivity","https://next-shadcn-admin-dashboard.vercel.app/dashboard/productivity",              "arhamkhnz · MIT"],
  ["arham-infrastructure","https://next-shadcn-admin-dashboard.vercel.app/dashboard/infrastructure",            "arhamkhnz · MIT"],
  ["arham-file-manager","https://next-shadcn-admin-dashboard.vercel.app/dashboard/file-manager",              "arhamkhnz · MIT"],
  ["arham-patient-monitoring","https://next-shadcn-admin-dashboard.vercel.app/dashboard/patient-monitoring",        "arhamkhnz · MIT"],
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
  /* 2026-09-08 第三轮（老板：`最好是要有模板的 要研究的啦`）。
     来源是 adminlte.io 那份 28 个的清单，**每一个网址先 curl 过一次**：
     horizon 的 boilerplate 回 402（要钱），所以不在里面。
     ⚠️ 回 200 不等於拍到东西 —— 底下那三条自检（像登入页 · 几乎没有字 ·
     跟别人一模一样）就是为这件事在的。 */
  ["halolight",        "https://halolight.h7ml.cn",                            "halolight · MIT"],
  ["shadcn-vue-admin", "https://shadcn-vue-admin.netlify.app/",                "Whbbit1999 · MIT"],
  ["ecommerce-admin",  "https://ecommerce-admin-board.vercel.app/",            "taiwo-adewale · MIT"],
  ["naveenda",         "https://shadcn-nextjs-dashboard.vercel.app",           "NaveenDA · MIT"],
  ["t3-template",      "https://t3-app-template.vercel.app",                   "gaofubin · MIT"],
  ["shadboard",        "https://shadboard.vercel.app",                         "Qualiora · MIT"],
  ["shadcnuikit",      "https://free.shadcnuikit.com/",                        "bundui · 商用授权 · 只看"],
  ["tw-admin-free",    "https://next-free.tailwind-admin.com/",                "Tailwind-Admin · MIT"],
];

const bad = await shootSheet(SITES, ".screenshots/admins");
if (bad) process.exit(1);
