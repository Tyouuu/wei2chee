/**
 * 新版十四页到底包含了什么功能 —— 用示范沙龙真登入，一页一页读出来（任务 425）。
 *
 * 老板：`新版的UI设计是包含了什么功能 我不想要就是还要设计多余的东西 你帮我去弄清楚来`
 *
 * 上一份清单（docs/salon-pages-to-design.md）是按「旧版有哪些页、新版有没有同名页」列的，
 * 不是按「这个功能新版有没有」核的。这一支把新版每一页**整页的字**读出来，
 * 再点开会藏东西的地方（客人档案 · 预约面板 · 设置的分页签 · 各种面板），
 * 拿去按关键字核每一项功能有没有。
 *
 * 用法：npm run dev 开着，然后
 *   DEMO_SALON_PASSWORD=... node scripts/inventory-new-pages.mjs
 * 输出：.screenshots/new-pages/*.png ＋ inventory.json
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
const OUT = ".screenshots/new-pages";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const PAGES = [
  "overview", "schedule", "register", "clients", "lookbook", "packages", "stock",
  "stylists", "reports", "eod-cash", "invoices", "memberships", "audit-log", "settings", "tools",
];

/** all = 读整个 body（滑出来的面板常常画在 main 外面）。 */
const lines = (page, all = false) =>
  page.evaluate((whole) => {
    const root = whole ? document.body : document.querySelector("main") ?? document.body;
    return root.innerText.split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  }, all);
const controls = (page) =>
  page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const txt = (el) => (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
    const uniq = (a) => [...new Set(a.filter(Boolean))];
    return {
      buttons: uniq([...root.querySelectorAll("button,[role=button],[role=tab]")].filter(vis).map(txt)).slice(0, 80),
      links: uniq([...root.querySelectorAll("a[href]")].filter(vis).map((a) => `${txt(a)} → ${a.getAttribute("href")}`)).slice(0, 40),
      fields: uniq([...root.querySelectorAll("input,select,textarea")].filter(vis).map((e) => e.getAttribute("aria-label") || e.getAttribute("placeholder") || e.name || e.type)).slice(0, 40),
    };
  });

/** 点一下，读「多出来的字」，再关掉。 */
async function peek(page, label, click) {
  const before = new Set(await lines(page, true));
  try {
    await click();
    await page.waitForTimeout(600);
    const after = await lines(page, true);
    const extra = after.filter((l) => !before.has(l));
    const ctl = await controls(page);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(250);
    return { label, extra: extra.slice(0, 80), buttons: ctl.buttons.slice(0, 40), fields: ctl.fields.slice(0, 30) };
  } catch (e) {
    return { label, error: String(e.message ?? e).slice(0, 100) };
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/en/login`, { waitUntil: "load", timeout: 180000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !/\/login/.test(u.toString()), { timeout: 180000 });
await page.waitForLoadState("load");

const out = {};
for (const name of PAGES) {
  const rec = { peeks: [] };
  try {
    await page.goto(`${BASE}/en/salon-preview/${name}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(1800);
    rec.lines = await lines(page);
    Object.assign(rec, await controls(page));
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

    if (name === "clients") {
      for (const b of ["Edit Profile", "Book Next", "Redeem Session", "New Client Folio"]) {
        rec.peeks.push(await peek(page, b, () => page.getByRole("button", { name: new RegExp(b, "i") }).first().click({ timeout: 4000 })));
      }
    }
    if (name === "schedule") {
      rec.peeks.push(await peek(page, "click an appointment", () => page.getByText("Michelle Ong").first().click({ timeout: 4000 })));
      rec.peeks.push(await peek(page, "New Appointment", () => page.getByRole("button", { name: /New Appointment/i }).first().click({ timeout: 4000 })));
    }
    if (name === "stylists") {
      rec.peeks.push(await peek(page, "Edit Brackets", () => page.getByRole("button", { name: /Edit Brackets/i }).first().click({ timeout: 4000 })));
      rec.peeks.push(await peek(page, "click a stylist", () => page.getByText("Fara Yusof").first().click({ timeout: 4000 })));
    }
    if (name === "settings") {
      for (const tab of ["Branch Locations", "Team & Access", "Booking & Loyalty", "General"]) {
        rec.peeks.push(await peek(page, `tab ${tab}`, () => page.getByRole("button", { name: new RegExp(tab, "i") }).first().click({ timeout: 4000 })));
      }
    }
    if (name === "stock") {
      rec.peeks.push(await peek(page, "click a stock item", () => page.getByText("20 Vol Developer").first().click({ timeout: 4000 })));
    }
    if (name === "register") {
      rec.peeks.push(await peek(page, "add an item", () => page.locator("button:has-text('+')").first().click({ timeout: 4000 })));
    }
    if (name === "invoices") {
      rec.peeks.push(await peek(page, "click a payment", () => page.getByText("Joanne Wong").first().click({ timeout: 4000 })));
    }
    console.log(`  ok  ${name}: ${rec.lines.length} 行字 · ${rec.buttons.length} 按钮 · ${rec.peeks.length} 处点开`);
  } catch (e) {
    rec.error = String(e.message ?? e).slice(0, 120);
    console.log(`  !!  ${name}: ${rec.error}`);
  }
  out[name] = rec;
}
writeFileSync(`${OUT}/inventory.json`, JSON.stringify(out, null, 2));
await browser.close();
console.log(`\n写好了：${OUT}/inventory.json`);
