/**
 * 沙龙侧栏读「这家自己有哪几页」——真登入、真资料库、真浏览器。
 *
 * ── 为什么（2026-09-24，任务 414 / 415 第 4 项）───────────────────────────
 *
 * 侧栏原来是写死的十三行，所有人看到一模一样。现在每一行只在这家真的有
 * 它站着的那几页时才画（project_pages，老板本来就能在产品里加页 / 拿掉页），
 * 而收银员不再看到通往钱跟改动历史的那几行。
 *
 * 验：
 *   ① 一个新帐号（默认页：总览·客户·报价单·工程·收款·开销·官网）——没有预约 ·
 *      库存 · 师傅那几页，对应的行就不画
 *   ② 用真的 add_project_page 加 bookings / inventory / staff，重新载入，
 *      行一行一行长出来（套票要「客户 + 预约」两样都有才出现）
 *   ③ 用真的 remove_project_page 拿掉库存，那一行就没了
 *   ④ 站在一个已经被拿掉的页上，那一行还留着（侧栏不会说你不在的地方）
 *   ⑤ 收银员登入：通往钱跟历史的五行不见，一天的活都在，左下角写 Staff
 *   ⑥ 第一次绘制就是对的：关掉 JavaScript 再要一次，行已经在服务器给的 HTML 里
 *      （不是先画满再删）
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/salon-nav-real";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
dropThrowawayOnExit(admin, () => userId);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));

/** 侧栏行 slug → 它的名字（跟 salon-shell.tsx 对得上）。 */
const ROWS = {
  overview: "Overview",
  schedule: "Appointments & Flow",
  register: "Register & Checkout",
  clients: "Clients & Profiles",
  lookbook: "Lookbook & Formulas",
  packages: "Packages & Plans",
  stock: "Salon Stock & Orders",
  stylists: "Stylists & Staff",
  reports: "Reports & Rankings",
  "eod-cash": "End of Day Cash",
  invoices: "Invoices & Terminal",
  tools: "More Tools",
  settings: "Tenant Settings",
};

/** 侧栏里现在画着哪几行（认它们的连结）。 */
const rowsIn = async (page) => {
  const hrefs = await page.locator("aside a[href^='/en/salon-preview/']").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  return Object.keys(ROWS).filter((slug) => hrefs.includes(`/en/salon-preview/${slug}`));
};
// 只看 <aside> 里面：页面本体也有连去库存的「Manage Stock」，那不是侧栏的行。
const rowsInHtml = (html) => {
  const aside = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? "";
  return Object.keys(ROWS).filter((slug) => aside.includes(`href="/en/salon-preview/${slug}"`));
};
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const show = (a) => a.join(", ") || "(none)";

let browser;
try {
  const stamp = Date.now();
  const email = `nav-${stamp}@formae.test`;
  const password = `Nv-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;

  const pagesNow = async () =>
    ((await admin.from("project_pages").select("page_key").eq("project_id", pid)).data ?? []).map((r) => r.page_key);

  browser = await chromium.launch();
  const ownerCtx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
  const page = await ownerCtx.newPage();
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  const open = async (slug) => {
    await page.goto(`${BASE}/en/salon-preview/${slug}`, { waitUntil: "networkidle", timeout: 180000 });
    return rowsIn(page);
  };

  // ═══ ① 新帐号：默认页里没有预约 · 库存 · 师傅 ═══
  console.log("\n① 新帐号的默认页");
  const base = await pagesNow();
  console.log(`   这一家现在有：${show(base)}`);
  check("前提：新帐号没有 bookings / inventory / staff 三页（不然这一段没有意义）",
    !base.includes("bookings") && !base.includes("inventory") && !base.includes("staff"), show(base));
  const first = await open("overview");
  check("🔴 侧栏没有画预约 · 库存 · 师傅这三行（这家没有它们站着的页）",
    !first.includes("schedule") && !first.includes("stock") && !first.includes("stylists"), show(first));
  check("🔴 套票 · 会员是一行：有客户 ＋ 收款页就在（会员费靠收款，不靠预约）",
    first.includes("packages"), show(first));
  check("总览 · 收银 · 客户 · 作品集 · 套票会员 · 报表 · 收工 · 发票 · 设置九行都在（老板 + 有这些页）",
    same(first, ["overview", "register", "clients", "lookbook", "packages", "reports", "eod-cash", "invoices", "tools", "settings"]), show(first));
  check("🔴 侧栏上没有单独的「Memberships」「System Audit Log」两行（合并进去 / 搬进设置了）",
    (await page.locator("aside nav a[href='/en/salon-preview/audit-log']").count()) === 0
      && (await page.locator("aside nav a[href='/en/salon-preview/memberships']").count()) === 0);
  await page.screenshot({ path: `${OUT}/1-default.png` });

  // ═══ ② 一样一样加页，行一行一行长出来 ═══
  console.log("\n② 加页");
  const add = async (k) => {
    const r = await api.rpc("add_project_page", { requested_key: k, new_title: "" });
    if (r.error) throw new Error(`add_project_page ${k}: ${r.error.message}`);
  };
  await add("bookings");
  let rows = await open("overview");
  check("🔴 加了 bookings：预约那一行出现了，套票会员那一行原样（本来就在）",
    rows.includes("schedule") && rows.includes("packages"), show(rows));
  check("库存跟师傅还没有（没加它们）", !rows.includes("stock") && !rows.includes("stylists"), show(rows));

  await add("inventory");
  rows = await open("overview");
  check("🔴 加了 inventory：库存那一行出现了", rows.includes("stock") && !rows.includes("stylists"), show(rows));

  await add("staff");
  rows = await open("overview");
  check("🔴 加了 staff：师傅那一行出现了，十三行齐了", same(rows, Object.keys(ROWS)), show(rows));
  await page.screenshot({ path: `${OUT}/2-full.png` });

  // ═══ ③ 拿掉库存 ═══
  console.log("\n③ 拿掉页");
  const rm = await api.rpc("remove_project_page", { target_page_key: "inventory" });
  if (rm.error) throw new Error(`remove_project_page: ${rm.error.message}`);
  rows = await open("overview");
  check("🔴 拿掉 inventory：库存那一行没了，别的十二行原样", !rows.includes("stock") && rows.length === 12, show(rows));
  await page.screenshot({ path: `${OUT}/3-no-stock.png` });

  // ═══ ④ 站在被拿掉的页上：那一行留着 ═══
  console.log("\n④ 站在被拿掉的页上");
  rows = await open("stock");
  check("🔴 直接打开已经拿掉的库存页：侧栏还留着「Salon Stock & Orders」那一行（不说你不在的地方）",
    rows.includes("stock"), show(rows));
  const activeCount = await page.locator("aside a[href='/en/salon-preview/stock']").count();
  check("而且只画一次，不是两行", activeCount === 1, String(activeCount));
  rows = await open("overview");
  check("回到总览，它又没了", !rows.includes("stock"), show(rows));

  // ═══ ⑥ 第一次绘制就对：不开 JavaScript ═══
  console.log("\n⑥ 第一次绘制");
  const state = await ownerCtx.storageState();
  const noJs = await browser.newContext({ storageState: state, javaScriptEnabled: false, viewport: { width: 1700, height: 1000 } });
  const noJsPage = await noJs.newPage();
  const res = await noJsPage.goto(`${BASE}/en/salon-preview/overview`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const html = await res.text();
  const ssrRows = rowsInHtml(html);
  check("🔴 关掉 JavaScript 要一次：服务器给的 HTML 里已经是这一家的十二行（不是先画满十三行再删）",
    same(ssrRows, Object.keys(ROWS).filter((s) => s !== "stock")), show(ssrRows));
  check("🔴 服务器给的 HTML 里，侧栏左下角已经写着 Owner",
    /Owner/.test(html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? ""));
  await noJs.close();

  // 把库存加回来，给收银员那一段用满十三行
  await add("inventory");

  // ═══ ⑤ 收银员 ═══
  console.log("\n⑤ 收银员登入");
  const staffEmail = `nav-staff-${stamp}@formae.test`;
  const staffPassword = `Ns-${stamp}-x!`;
  const { data: staffUser, error: staffMkErr } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  });
  if (staffMkErr) throw new Error(`createUser staff: ${staffMkErr.message}`);
  const memberAdd = await api.rpc("add_project_member", { in_email: staffEmail });
  if (memberAdd.error) throw new Error(`add_project_member: ${memberAdd.error.message}`);

  const staffPage = await (await browser.newContext({ viewport: { width: 1700, height: 1000 } })).newPage();
  await staffPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await staffPage.fill('input[type="email"]', staffEmail);
  await staffPage.fill('input[type="password"]', staffPassword);
  await staffPage.click('button[type="submit"]');
  await staffPage.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await staffPage.goto(`${BASE}/en/salon-preview/overview`, { waitUntil: "networkidle", timeout: 180000 });
  const staffRows = await rowsIn(staffPage);
  const moneyRows = ["reports", "eod-cash", "invoices", "settings"];
  check("🔴 收银员看不到通往钱跟设置的四行（报表 · 收工 · 发票 · 设置）",
    moneyRows.every((s) => !staffRows.includes(s)), show(staffRows));
  check("一天的活都还在：总览 · 预约 · 收银 · 客户 · 作品集 · 套票会员 · 库存 · 师傅 · 更多工具",
    same(staffRows, ["overview", "schedule", "register", "clients", "lookbook", "packages", "stock", "stylists", "tools"]), show(staffRows));
  const staffBody = await staffPage.locator("aside").first().innerText();
  check("左下角写的是 Staff，不是 Owner", /Staff/.test(staffBody) && !/Owner/.test(staffBody), staffBody.slice(-80));
  await staffPage.screenshot({ path: `${OUT}/4-staff.png` });

  // 收银员站在一个 owner-only 页上：那一行也留着
  await staffPage.goto(`${BASE}/en/salon-preview/eod-cash`, { waitUntil: "networkidle", timeout: 180000 });
  const staffOnEod = await rowsIn(staffPage);
  check("🔴 收银员直接打开收工页（会被挡下来）：侧栏还是画着那一行，不假装他不在那里", staffOnEod.includes("eod-cash"), show(staffOnEod));
  await staffPage.goto(`${BASE}/en/salon-preview/packages`, { waitUntil: "networkidle", timeout: 180000 });
  // Memberships 整页退场了（founder-tasks 任务426 简化案）：PrepaidTabs 永远
  // 只有一个 tab，谁都看不到分页，不分老板还是收银员。这一条照旧成立，
  // 只是理由换了 —— 以前是「分页会画但收银员看不到」，现在是「谁都没有分页」。
  check("🔴 收银员打开套票那一页：没有分页（Memberships 已经退场，不是只对收银员藏起来）",
    (await staffPage.locator("nav[aria-label='Packages and memberships']").count()) === 0);
  admin.auth.admin.deleteUser(staffUser.user.id).catch(() => {});
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
