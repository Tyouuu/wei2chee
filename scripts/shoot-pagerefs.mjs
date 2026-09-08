/**
 * 一页一批参考 —— 每一种页面，别人现在怎么做。
 *
 *   npm run shoot:pagerefs                     # 全部
 *   GROUP=money,document npm run shoot:pagerefs  # 只走那几组
 *   ONLY=tabler-invoice npm run shoot:pagerefs   # 只补拍那几张（`shootSheet` 自己的）
 *
 * 老板 2026-09-08：`所以你還是沒有去找每一頁的最新設計 去引用別人的`。
 *
 * 🔴 **他讲对了，而且量得出来。** 我们今天手上的参考是六十一张，
 * 而那六十一张**几乎全部是别人的「首页」** —— 六十个产品各一张仪表盘。
 * 真正逐页的只有一套（arhamkhnz 十一页，他 2026-09-04 自己挑的那一套），
 * 而我们有 **18 个模块页 ＋ 21 个工具页**。
 * 所以「找参考」这件事一直是**按产品**做的，从来没有**按页**做过。
 *
 * 这一支反过来：**一个问题一批**。他打开的不是「六十个后台」，
 * 是「**别人的开单页长什么样**」四张摆在一起。
 * （[重点 7m](../docs/founder-points.md)：量要大、摊成一张、他指哪一个就是哪一个。）
 *
 * ⚠️ **每一个网址都先 `curl` 打过一次**（2026-09-08）。
 * 一张停在登入页、或者路径过期回一张壳的截图，
 * **跟一张真的后台在档名跟读数上长得一模一样** —— `shootSheet` 那三条自检
 * （像登入页 · 几乎没有字 · 跟别人一模一样）是被骗过之后才加的。
 *
 * ⚠️ 拿的是**做法**（有哪几块 · 什么顺序 · 什么形状），不是代码也不是内容
 * ——[任务 135](../docs/founder-tasks.md) 逐层判过这条线。
 */
import { shootSheet } from "./lib/shoot-sheet.mjs";

/** 一组 = 我们的一种页面。名字用**那一页在问什么**，不是用零件的名字。 */
const GROUPS = {
  /* 收款 · 开销 · 佣金 —— 「这个月钱怎么动」 */
  money: [
    ["arham-finance", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/finance", "arhamkhnz · MIT 3.0k"],
    ["mantine-analytics", "https://mantine-analytics-dashboard.netlify.app/dashboard/analytics", "Mantine · MIT"],
    ["tailadmin-home", "https://free-demo.tailadmin.com/", "TailAdmin · 免费版"],
    ["tabler-home", "https://preview.tabler.io/", "tabler · MIT 41.6k"],
  ],

  /* 报价单 · 进货单 —— 「一张给别人读的纸」 */
  document: [
    ["arham-invoice", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/invoice", "arhamkhnz · MIT"],
    ["tabler-invoice", "https://preview.tabler.io/invoice.html", "tabler · MIT"],
    ["mantine-invoices", "https://mantine-analytics-dashboard.netlify.app/apps/invoices", "Mantine · MIT"],
    ["gentelella-inv", "https://preview.colorlib.com/theme/gentelella/production/invoice.html", "ColorlibHQ · MIT 21.5k"],
  ],

  /* 🔴 真的 CRM 的客户记录页。上面那一组（`client`）拍回来全部是
     「我的帐号」那种个人档案 —— 那不是他问的那一件。 */
  crm: [
    ["twenty", "https://demo.twenty.com", "Twenty · 开源 CRM"],
    ["espocrm", "https://demo.espocrm.com", "EspoCRM · 开源"],
    ["vtiger", "https://demo.vtiger.com", "Vtiger · 开源"],
    ["odoo-crm", "https://demo.odoo.com", "Odoo · LGPL"],
  ],

  /* 🔴 打开**一个**客户 —— 「她是谁，她跟我之间发生过什么」。
     他 2026-09-09 讲：`去參考別人的Crm 客戶錄取的頁面是怎麼去弄的啊`
     —— 而我先前拿的是一张**病房监视**的页（up-patient），那不是这一件。
     `people` 那一组是**清单**，这一组是**那一个人自己那一页**，两件事。 */
  client: [
    ["refine-customer", "https://example.admin.refine.dev/customers/show/123", "refine · MIT 35.6k"],
    ["tabler-profile", "https://preview.tabler.io/profile.html", "tabler · MIT 41.6k"],
    ["mantine-profile", "https://mantine-analytics-dashboard.netlify.app/apps/profile", "Mantine · MIT"],
    ["gentelella-profile", "https://preview.colorlib.com/theme/gentelella/production/profile.html", "ColorlibHQ · MIT 21.5k"],
  ],

  /* 客户 · 供应商 · 师傅 —— 「他们是谁，打开一个看」 */
  people: [
    ["arham-users", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/users", "arhamkhnz · MIT"],
    ["tabler-users", "https://preview.tabler.io/users.html", "tabler · MIT"],
    ["refine-customers", "https://example.admin.refine.dev/customers", "refine · MIT 35.6k"],
    ["refine-couriers", "https://example.admin.refine.dev/couriers", "refine · MIT"],
  ],

  /* 库存 · 序号 · 效期 —— 「架上还有几件」 */
  shelf: [
    ["refine-products", "https://example.admin.refine.dev/products", "refine · MIT"],
    ["arham-file-manager", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/file-manager", "arhamkhnz · MIT"],
    ["gentelella-ecom", "https://preview.colorlib.com/theme/gentelella/production/e_commerce.html", "ColorlibHQ · MIT"],
    ["tailadmin-tables", "https://free-demo.tailadmin.com/basic-tables", "TailAdmin · 免费版"],
  ],

  /* 工程 · 任务 —— 「这一件走到哪」 */
  board: [
    ["arham-kanban", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/kanban", "arhamkhnz · MIT"],
    ["arham-tasks", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/tasks", "arhamkhnz · MIT"],
    ["mantine-tasks", "https://mantine-analytics-dashboard.netlify.app/apps/tasks", "Mantine · MIT"],
    ["gentelella-kan", "https://preview.colorlib.com/theme/gentelella/production/kanban.html", "ColorlibHQ · MIT"],
  ],

  /* 预约 · 点名 · 排班 · 出勤 —— 「哪一天，几点，谁」 */
  when: [
    ["arham-productivity", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/productivity", "arhamkhnz · MIT"],
    ["tailadmin-calendar", "https://free-demo.tailadmin.com/calendar", "TailAdmin · 免费版"],
    ["gentelella-cal", "https://preview.colorlib.com/theme/gentelella/production/calendar.html", "ColorlibHQ · MIT"],
    ["mantine-projects", "https://mantine-analytics-dashboard.netlify.app/apps/projects", "Mantine · MIT"],
  ],

  /* 订单 · 送货 —— 「谁要什么，到哪一步」 */
  orders: [
    ["refine-orders", "https://example.admin.refine.dev/orders", "refine · MIT"],
    ["mantine-orders", "https://mantine-analytics-dashboard.netlify.app/apps/orders", "Mantine · MIT"],
    ["arham-logistics", "https://next-shadcn-admin-dashboard.vercel.app/dashboard/logistics", "arhamkhnz · MIT"],
    ["gentelella-proj", "https://preview.colorlib.com/theme/gentelella/production/project_detail.html", "ColorlibHQ · MIT"],
  ],
};

/* 🔴 用 `GROUP` 不用 `ONLY` —— `shootSheet` 自己拿 `ONLY` 筛**站名**，
   两边抢同一个变数的结果是：`ONLY=money` 一组都没走，而它回报「0 组 0 张」。 */
const pick = process.env.GROUP?.split(",").map((x) => x.trim()).filter(Boolean);
const groups = Object.entries(GROUPS).filter(([k]) => !pick?.length || pick.includes(k));

let bad = 0;
/* 🔴 查重跨整轮。第一轮五张 gentelella 全部是它的**行销首页**
   （`gentelella.colorlib.com/<任何路径>` 都回 200 加同一张页 ——
   [任务 103](../docs/founder-tasks.md) 早就写下来了，而我没读就又踩了一次），
   而它们分在五组，**组内不撞**，所以整轮回报「没拍到 0 张」。 */
const seen = new Map();
for (const [name, sites] of groups) {
  console.log(`\n== ${name} · ${sites.length} 张 ==`);
  /* 一组一张拼图 —— 一排四张，宽一点，因为要看的是**一页由哪几块组成**，
     不是它的颜色。 */
  bad += await shootSheet(sites, `.screenshots/pagerefs/${name}`, { perRow: 4, width: 660, seen });
}

console.log(`\n判：${groups.length} 组 · ${groups.reduce((n, [, s]) => n + s.length, 0)} 张 · 没拍到 ${bad} 张`);
console.log(`⚠️ 拼图在 .screenshots/pagerefs/<组>/sheet.jpg —— 用眼睛看，数字判不了这件事。`);
