/* 一个后台是不是「那个年代」的 —— 量得出来的两组读数。
 *
 * 老板 2026-09-02：「不要把那些很久时代的设计摆上去 替换成一些现在的设计 专业好看的」
 *
 * ⚠️ **「最后一次更新」不是尺。** AdminLTE 上个月还在推新版、45.6k 星，
 * 而它的设计语言是 2014 年的（圆角 4px · Source Sans Pro · 彩色方块统计卡）。
 * **更新的是代码，不是设计。**
 *
 * 所以量两组：
 *   ① GitHub 那边 —— 星 · 最后推 · 许可 · 栈（Bootstrap 还是 Tailwind）
 *   ② 画面上的做工 —— 圆角 · 有阴影的比例 · 用细边的比例 · 用什么字
 *      2024 之后的做法是**细边多、阴影少**；2020 年前反过来。
 *
 * ⚠️ **这把尺量不到的一样，写下来免得下次又去捡**：卡片底色的彩度。
 * 现代那几套用 oklch 宣告颜色，而 getComputedStyle 原样回传 oklch(...)，
 * 拿正则抓数字会读出一堆废话 —— 第一版报 Studio Admin「91% 彩色卡」，
 * 而它整页是白的。那一栏已经拿掉；要用得先经过一次 canvas 转换。
 *
 * ⚠️ 而且它只能拿来**否决**，不能拿来**通过**（[重点 24](../docs/founder-points.md)）。
 * 通过要用眼睛看拼在一起的对照图 —— `npm run shoot:admins` 拍的那一批。
 */
import { chromium } from "playwright";

/** name → [GitHub repo, 活着的 demo 网址] */
const SUBJECTS = [
  ["Studio Admin",    "arhamkhnz/next-shadcn-admin-dashboard",        "https://next-shadcn-admin-dashboard.vercel.app/dashboard/crm"],
  ["Tabler",          "tabler/tabler",                                "https://preview.tabler.io/"],
  ["shadcn-admin",    "satnaing/shadcn-admin",                        "https://shadcn-admin.netlify.app/"],
  ["Ant Design Pro",  "ant-design/ant-design-pro",                    "https://preview.pro.ant.design/dashboard/analysis"],
  ["AdminLTE",        "ColorlibHQ/AdminLTE",                          "https://adminlte.io/themes/v3/index.html"],
  ["TailAdmin",       "TailAdmin/free-nextjs-admin-dashboard",        "https://free-demo.tailadmin.com/"],
  ["Flowbite",        "themesberg/flowbite-admin-dashboard",          "https://flowbite-admin-dashboard.vercel.app/"],
  ["Windmill",        "estevanmaito/windmill-dashboard",              "https://windmill-dashboard.vercel.app/"],
  ["Soft UI",         "creativetimofficial/soft-ui-dashboard-tailwind","https://demos.creative-tim.com/soft-ui-dashboard-tailwind/pages/dashboard.html"],
  ["Notus",           "creativetimofficial/notus-nextjs",             "https://demos.creative-tim.com/notus-nextjs/admin/dashboard"],
  ["Volt",            "themesberg/volt-bootstrap-5-dashboard",        "https://demo.themesberg.com/volt/"],
  ["Mantis",          "codedthemes/mantis-free-react-admin-template", "https://mantisdashboard.io/free/"],
  ["Horizon UI",      "horizon-ui/horizon-tailwind-react",            "https://horizon-ui.com/horizon-tailwind-react/admin/default"],
  ["Kiran starter",   "Kiranism/next-shadcn-dashboard-starter",       "https://next-shadcn-dashboard-starter.vercel.app/dashboard/overview"],
  ["Refine",          "refinedev/refine",                             null],
  ["Art Design Pro",  "Daymychen/art-design-pro",                     null],
  ["vue-pure-admin",  "pure-admin/vue-pure-admin",                    null],
  ["Vben Admin",      "vbenjs/vue-vben-admin",                        null],
];

const GH = { "User-Agent": "formae-era-probe", Accept: "application/vnd.github+json" };

/** 画面上的做工。在浏览器里跑，读的是实际生效的样式，不是解析 CSS 文本。 */
const CRAFT = function () {
  const px = (s) => parseFloat(s) || 0;
  const vw = innerWidth, vh = innerHeight;
  /* 「卡片」= 有底色或边框或阴影、面积够大、又不是整页那个容器。 */
  const cards = [...document.querySelectorAll("div,section,article,li")].filter((e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 120 || r.height < 70) return false;
    if (r.width > vw * 0.92 && r.height > vh * 0.8) return false;
    if (r.top > vh * 1.6) return false;
    const c = getComputedStyle(e);
    const hasBg = c.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor);
    return hasBg || px(c.borderTopWidth) > 0 || (c.boxShadow && c.boxShadow !== "none");
  });
  const n = Math.max(cards.length, 1);
  const shadowed = cards.filter((e) => {
    const s = getComputedStyle(e).boxShadow;
    return s && s !== "none";
  });
  const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
  return {
    cards: cards.length,
    radius: +med(cards.map((e) => px(getComputedStyle(e).borderTopLeftRadius))).toFixed(1),
    shadowPct: Math.round((shadowed.length / n) * 100),
    borderPct: Math.round((cards.filter((e) => px(getComputedStyle(e).borderTopWidth) > 0).length / n) * 100),
    font: getComputedStyle(document.body).fontFamily.split(",")[0].replace(/["']/g, ""),
  };
};

const rows = [];
for (const [name, repo, url] of SUBJECTS) {
  const row = { name, repo, url, stars: "?", pushed: "?", licence: "?", stack: "", craft: null, note: "" };
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: GH });
    if (r.ok) {
      const d = await r.json();
      row.stars = (d.stargazers_count / 1000).toFixed(1) + "k";
      row.pushed = (d.pushed_at || "").slice(0, 7);
      row.licence = d.license?.spdx_id ?? "—";
      const t = await fetch(`https://api.github.com/repos/${repo}/topics`, { headers: GH })
        .then((x) => (x.ok ? x.json() : { names: [] }))
        .catch(() => ({ names: [] }));
      row.stack = (t.names || []).filter((x) => /tailwind|bootstrap|shadcn|material|antd/.test(x)).join(" ") || (d.language ?? "");
    } else row.note = `GitHub ${r.status}`;
  } catch (e) {
    row.note = String(e).slice(0, 40);
  }
  rows.push(row);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
for (const row of rows) {
  if (!row.url) continue;
  try {
    await page.goto(row.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3200);
    /* ⚠️ 一张 404、一张登入页、一个暂停的部署，都会存成一张看起来很正常的图。
       字数是最便宜的那道关（`shoot:admins` 那次十二个里有六个是假的）。 */
    const words = await page.evaluate(() => (document.body.innerText.match(/\S+/g) || []).length);
    if (words < 60) {
      row.note = `载不到（${words} 个字）`;
      continue;
    }
    row.craft = await page.evaluate(CRAFT);
  } catch (e) {
    row.note = `打不开：${String(e).slice(0, 40)}`;
  }
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log("\n" + pad("名字", 17) + pad("★", 7) + pad("最后推", 9) + pad("许可", 9) + "栈");
for (const r of [...rows].sort((a, b) => (b.pushed || "").localeCompare(a.pushed || "")))
  console.log(pad(r.name, 17) + pad(r.stars, 7) + pad(r.pushed, 9) + pad(r.licence, 9) + r.stack);

console.log("\n" + pad("名字", 17) + pad("卡片", 6) + pad("圆角", 7) + pad("有阴影", 8) + pad("用细边", 8) + "字");
for (const r of rows) {
  if (!r.craft) {
    if (r.url) console.log(pad(r.name, 17) + (r.note || "—"));
    continue;
  }
  const c = r.craft;
  console.log(
    pad(r.name, 17) + pad(c.cards, 6) + pad(c.radius, 7) +
    pad(c.shadowPct + "%", 8) + pad(c.borderPct + "%", 8) + c.font,
  );
}
console.log("\n⚠️ 这些数字只能否决，不能通过。通过要看 `npm run shoot:admins` 拍的对照图。");
