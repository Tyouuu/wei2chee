/**
 * 登入示范沙龙，把 14 页各拍一张（默认打线上真站）。
 *
 *   DEMO_SALON_PASSWORD=... node scripts/shoot-salon-demo.mjs              # 打线上
 *   DEMO_SALON_PASSWORD=... BASE=http://localhost:3000 node scripts/shoot-salon-demo.mjs
 *
 * 只读、不写任何资料。拍到 `.screenshots/salon-demo/<页>.png`，
 * 并把每一页的「打得开吗 · 有没有错误字 · 主标题 · 有没有控制台错误」印出来。
 * 数字全绿不等於好看 —— 拍完要用眼睛一张一张看（重点 7l）。
 */
import { mkdirSync, rmSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "https://wei2chee.vercel.app";
const EMAIL = process.env.DEMO_SALON_EMAIL ?? "salon.demo@formae.test";
const PASSWORD = process.env.DEMO_SALON_PASSWORD;
if (!PASSWORD) { console.error("要 DEMO_SALON_PASSWORD"); process.exit(2); }
const WIDTH = Number(process.env.WIDTH ?? 1500);
const OUT = ".screenshots/salon-demo";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const PAGES = ["overview", "schedule", "register", "clients", "lookbook", "packages", "memberships", "stock", "stylists", "reports", "eod-cash", "invoices", "audit-log", "settings"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`); });

await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 120000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/portal|salon-preview/, { timeout: 120000 });
console.log(`登入 OK → ${page.url()}`);

let bad = 0;
for (const p of PAGES) {
  errors.length = 0;
  const t0 = Date.now();
  // 收银台没有 h1（它是一台收银机，不是一页文章）。下面读 h1 时 Playwright 会为一个
  // 不存在的元素等满 30 秒，收银台因此显示 35 秒 —— 真的打开只要 3 秒左右（各种顺序都量过）。
  // 所以读 h1 一律给一个短的 timeout。
  const res = await page.goto(`${BASE}/en/salon-preview/${p}`, { waitUntil: "load", timeout: 120000 }).catch((e) => ({ status: () => `ERR ${e.message}` }));
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText().catch(() => "");
  const h1 = await page.locator("h1").first().innerText({ timeout: 1500 }).catch(() => "(没有 h1)");
  const rows = await page.locator("aside nav a").count();
  const broken = /Application error|Something went wrong|This page could not be found|Unhandled Runtime Error/i.test(body);
  const login = /\/login/.test(page.url());
  await page.screenshot({ path: `${OUT}/${p}.png`, fullPage: true });
  const flag = broken || login || errors.length ? "🔴" : "  ";
  if (broken || login || errors.length) bad++;
  console.log(`${flag} ${p.padEnd(12)} ${String(res.status()).padEnd(4)} ${((Date.now() - t0) / 1000).toFixed(1)}s  侧栏 ${rows} 行  「${h1.replace(/\s+/g, " ").slice(0, 46)}」${errors.length ? "  " + errors.slice(0, 2).join(" | ") : ""}${login ? "  被踢回登入" : ""}${broken ? "  页上有错误字" : ""}`);
}
await browser.close();
console.log(`\n${bad ? `🔴 ${bad} 页有问题` : "14 页都打得开"} → ${OUT}/（现在去用眼睛看）`);
process.exit(bad ? 1 : 0);
