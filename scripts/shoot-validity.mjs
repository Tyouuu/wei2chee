/**
 * 有效期那一格，用眼睛看。
 *
 * 重点 7l：改完 → 跑尺子 → **自己先看图** → 不像就回去改。
 * 122 条真的呼叫全过，843 个单元测试全过，tsc 干净 —— 那些都不告诉我
 * 那一格在画面上长什么样、跟旁边协不协调、手机上按不按得到。
 *
 * 拍四张：报价单新单（有预设 +30 天）· 进货单新单（没有预设，而且字不一样）·
 * 报价单列表 · 390 宽的报价单新单。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/validity";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();

async function login(page) {
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', "tianyou.demo@formae.test");
  await page.fill('input[type="password"]', "FormaeDemo2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
}

const shots = [];
async function shoot(page, path, name) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const h1 = await page.locator("h1").first().innerText().catch(() => "");
  /* 🔴 拍到登入页、拍到错误页、拍到那一页 —— 三张在报告里长得一模一样。
     第一版只问了登入页，於是它对着一张写着「Something broke here.」的
     截图回报「拍到」，而那一页是我五分钟前弄坏的。
     那正是这个仓库被骗过四次的形状：量到的东西不是画面上的东西。 */
  const stuck =
    /log in|sign in|登入/i.test(h1) ||
    /something broke|does not exist|坏了|不存在/i.test(h1);
  const dates = await page.locator('input[type="date"]').count();
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  shots.push({ name, h1, dates, stuck });
  console.log(`${stuck ? "🔴 卡在登入页" : "拍到"}  ${name}  · h1「${h1}」· 日期格 ${dates}`);
}

try {
  const wide = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await login(wide);
  await shoot(wide, "/en/portal/quotations/new", "quote-new");
  /* 这个 demo 帐号没有进货单那一页,所以拿工程单验「同一栏,不同的字」——
     期限 vs 有效期。挑一个它真的有的页面,不是挑一个我希望它有的。 */
  await shoot(wide, "/en/portal/projects/new", "project-new");
  await shoot(wide, "/en/portal/quotations", "quote-list");

  /* 🔴 空的表单看不出分期表对不对。真的填一份：打一个金额、按「照惯例填」，
     然后看右边那张纸上印出来的三期是不是 14,550 / 19,400 / 14,550。 */
  await wide.goto(`${BASE}/en/portal/quotations/new`, { waitUntil: "networkidle", timeout: 180000 });
  /* ⚠️ `label:has-text("Quoted")` 会同时打到「Work quoted」跟「Quoted」，
     而 .first() 挑的是前者 —— 第一版就是这样把金额打进了工程名那一格，
     然后回报「那张纸上没有算出 RM 14,550」，指着一个不存在的产品缺陷。
     用完全相符的字。 */
  const boxFor = (label) =>
    wide.locator("label").filter({ has: wide.getByText(label, { exact: true }) }).locator("input").first();
  await boxFor("Work quoted").fill("Taman Desa kitchen");
  await boxFor("Quoted").fill("48500");
  await wide.getByRole("button", { name: /usual split/i }).click();
  await wide.waitForTimeout(600);
  await wide.screenshot({ path: `${OUT}/quote-filled.png`, fullPage: true });
  const paper = await wide.locator('aside[aria-label="As it prints"]').innerText();
  console.log(`\n那张纸上印的分期：\n${paper.split("\n").filter((l) => /RM|%/.test(l)).join(" | ")}`);
  shots.push({ name: "quote-filled", h1: "filled", dates: 0, stuck: !/14,550/.test(paper) });
  if (!/14,550/.test(paper)) console.log("🔴 那张纸上没有算出 RM 14,550");

  const phone = await b.newPage({ viewport: { width: 390, height: 844 } });
  await login(phone);
  await shoot(phone, "/en/portal/quotations/new", "quote-new-390");
} finally {
  await b.close();
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${shots.length - bad.length} 张拍到 · ${bad.length} 张卡住`);
process.exit(bad.length ? 1 : 0);
