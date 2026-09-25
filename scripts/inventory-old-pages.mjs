/**
 * 旧版里每一页真的有什么 —— 用示范沙龙的真登入、真资料，一页一页读出来（任务 424）。
 *
 * 老板：`然后看看旧版的还有什么是saloon老板还需要的页面 我一次过设计完给你`
 *
 * 他要一次画完新版，所以他手上要有一份「旧版每一页上到底有哪些块、哪些按钮」。
 * 这一支不判对错，只**读**：每一页的大标题 · 小标题 · 按钮 · 输入框 · 连结，
 * 加一张整页截图。清单是从画面读出来的，不是凭印象写的。
 *
 * 用法：npm run dev 开着，然后
 *   DEMO_SALON_PASSWORD=... node scripts/inventory-old-pages.mjs
 * 输出：.screenshots/old-pages/*.png ＋ inventory.json
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.DEMO_SALON_EMAIL ?? "salon.demo@formae.test";
const PASSWORD = process.env.DEMO_SALON_PASSWORD;
if (!PASSWORD) {
  console.error("要 DEMO_SALON_PASSWORD");
  process.exit(2);
}
const OUT = ".screenshots/old-pages";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/** name → 路径；pick 是「先开列表页，再点里面第一条指向详情的连结」。 */
const PAGES = [
  // 旧侧栏里「你的工具」那一组
  { name: "today", path: "/en/portal/today" },
  { name: "owing", path: "/en/portal/owing" },
  { name: "no-shows", path: "/en/portal/no-shows" },
  { name: "reviews", path: "/en/portal/reviews" },
  { name: "consent", path: "/en/portal/consent" },
  { name: "treatments", path: "/en/portal/treatments" },
  { name: "walkin", path: "/en/portal/walkin" },
  { name: "enquiries", path: "/en/portal/enquiries" },
  { name: "books", path: "/en/portal/books" },
  { name: "tax", path: "/en/portal/tax" },
  { name: "attendance", path: "/en/portal/attendance" },
  { name: "rota", path: "/en/portal/rota" },
  { name: "payroll", path: "/en/portal/payroll" },
  { name: "payables", path: "/en/portal/payables" },
  { name: "branches", path: "/en/portal/branches" },
  { name: "rooms", path: "/en/portal/rooms" },
  { name: "transfers", path: "/en/portal/transfers" },
  { name: "expiry", path: "/en/portal/expiry" },
  { name: "classes", path: "/en/portal/classes" },
  { name: "account", path: "/en/portal/account" },
  // 旧的「页」（每个行业开箱的那几页）
  { name: "expenses-list", path: "/en/portal/expenses" },
  { name: "payments-list", path: "/en/portal/payments" },
  { name: "customers-list", path: "/en/portal/customers" },
  { name: "bookings-list", path: "/en/portal/bookings" },
  { name: "staff-list", path: "/en/portal/staff" },
  { name: "inventory-list", path: "/en/portal/inventory" },
  // 四种详情页：先开列表，再点第一条
  { name: "customer-detail", path: "/en/portal/customers", pick: /\/portal\/customers\/[0-9a-f-]{36}/ },
  { name: "booking-detail", path: "/en/portal/bookings", pick: /\/portal\/bookings\/[0-9a-f-]{36}/ },
  { name: "staff-detail", path: "/en/portal/staff", pick: /\/portal\/staff\/[0-9a-f-]{36}/ },
  { name: "inventory-detail", path: "/en/portal/inventory", pick: /\/portal\/inventory\/[0-9a-f-]{36}/ },
  { name: "payment-detail", path: "/en/portal/payments", pick: /\/portal\/payments\/[0-9a-f-]{36}/ },
];

/** 一次读完一页上看得见的东西。 */
const READ = () => {
  const root = document.querySelector("main") ?? document.body;
  const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const txt = (el) => (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  return {
    h1: uniq([...root.querySelectorAll("h1")].filter(vis).map(txt)),
    heads: uniq([...root.querySelectorAll("h2,h3")].filter(vis).map(txt)).slice(0, 30),
    buttons: uniq([...root.querySelectorAll("button,[role=button]")].filter(vis).map(txt)).slice(0, 40),
    links: uniq([...root.querySelectorAll("a[href]")].filter(vis).map((a) => `${txt(a)} → ${a.getAttribute("href")}`)).slice(0, 25),
    fields: uniq(
      [...root.querySelectorAll("input,select,textarea")]
        .filter(vis)
        .map((e) => e.getAttribute("aria-label") || e.getAttribute("placeholder") || e.name || e.type),
    ).slice(0, 25),
    chars: root.innerText.length,
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/en/login`, { waitUntil: "load", timeout: 180000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !/\/login/.test(u.toString()), { timeout: 180000 });
await page.waitForLoadState("load");

const out = [];
for (const p of PAGES) {
  const rec = { name: p.name, asked: p.path };
  try {
    await page.goto(`${BASE}${p.path}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(1200);
    if (p.pick) {
      const href = await page.evaluate((src) => {
        const re = new RegExp(src);
        const a = [...document.querySelectorAll("a[href]")].find((x) => re.test(x.getAttribute("href") ?? ""));
        return a ? a.getAttribute("href") : null;
      }, p.pick.source);
      rec.pickedFrom = p.path;
      if (!href) {
        rec.note = "列表里没有可点进去的一条";
        out.push(rec);
        console.log(`  --  ${p.name}: ${rec.note}`);
        continue;
      }
      await page.goto(`${BASE}${href}`, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(1200);
    }
    rec.url = page.url().replace(BASE, "");
    rec.title = await page.title();
    rec.read = await page.evaluate(READ);
    // 详情页把一部分收在第二个分页签里 —— 点开再读一次
    const tab = page.getByRole("button", { name: /Account & activity/i }).first();
    if (await tab.count()) {
      await tab.click().catch(() => {});
      await page.waitForTimeout(400);
      rec.tab2 = await page.evaluate(READ);
      await page.getByRole("button", { name: /^Overview$/i }).first().click().catch(() => {});
    }
    await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: true });
    console.log(`  ok  ${p.name}: ${rec.url}  h1=${JSON.stringify(rec.read.h1)}  ${rec.read.heads.length} 小标题 · ${rec.read.buttons.length} 按钮`);
  } catch (e) {
    rec.error = String(e.message ?? e).slice(0, 120);
    console.log(`  !!  ${p.name}: ${rec.error}`);
  }
  out.push(rec);
}
writeFileSync(`${OUT}/inventory.json`, JSON.stringify(out, null, 2));
await browser.close();
console.log(`\n写好了：${OUT}/inventory.json（${out.length} 页）`);
