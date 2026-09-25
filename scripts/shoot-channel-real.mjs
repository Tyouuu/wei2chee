/**
 * 平台 ↔ 产品的通道 —— 真登入、真资料库、真浏览器（任务 421）。
 *
 * 老板：`你要去接好我们平台跟产品的通道`。
 *
 * 量七件事，每一件都对着一个沙龙帐号（行业 beauty）跟一个别的帐号（没有行业）：
 *
 *   ① 登入落在哪：沙龙 → 产品；别的 → 平台首页；带 next → next 赢
 *   ② 平台首页：沙龙有「打开你的系统」那张卡，点了进产品；别的没有
 *   ③ 旧系统的侧栏：沙龙顶上多一行「Open your system」，「Customers」点了去新版；别的照旧
 *   ④ 产品的侧栏：多一行「More Tools」，点了进那一页
 *   ⑤ More Tools 里每一张卡按他有哪几页出现（没有预约页就没有疗程 · 同意书 · 放飞机 …）
 *   ⑥ 点一张卡进旧系统，再点那一行回到产品（一个来回）
 *   ⑦ 师傅（员工）登入：一样落在产品，More Tools 里没有老板的那几张
 *   ⑧ OAuth 回来的那条路（/auth/callback）：跟密码登入同一个落点
 *
 * 用法：npm run dev 开着，然后 node scripts/shoot-channel-real.mjs
 */
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
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
const OUT = ".screenshots/channel-real";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const mkClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const users = [];
const leads = [];
dropThrowawayOnExit(admin, () => users);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));
const stamp = Date.now();

async function person(tag, { industry }) {
  const email = `chan-${tag}-${stamp}@formae.test`;
  const password = `Ch-${tag}-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  users.push(data.user.id);
  if (industry) {
    const { data: ind } = await admin.from("industries").select("id").eq("slug", industry).single();
    const { data: lead, error: le } = await admin.from("leads").insert({ industry_id: ind.id, language: "en", answers: {} }).select("id").single();
    if (le) throw new Error(`lead ${tag}: ${le.message}`);
    leads.push(lead.id);
    await admin.from("accounts").update({ lead_id: lead.id }).eq("id", data.user.id);
  }
  const client = mkClient();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn ${tag}: ${e2.message}`);
  return { id: data.user.id, email, password, client };
}

let browser;
try {
  const salon = await person("salon", { industry: "beauty" });
  const other = await person("other", { industry: null });
  const dropDone = async () => {
    for (const id of users.splice(0)) await dropThrowaway(admin, id);
    for (const id of leads.splice(0)) await admin.from("leads").delete().eq("id", id);
  };

  browser = await chromium.launch();
  const login = async (who, next = null) => {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/en/login${next ? `?next=${encodeURIComponent(next)}` : ""}`, { waitUntil: "load", timeout: 180000 });
    await page.fill('input[type="email"]', who.email);
    await page.fill('input[type="password"]', who.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !/\/login/.test(u.toString()), { timeout: 180000 });
    await page.waitForLoadState("load");
    return { ctx, page };
  };
  const path = (page) => page.url().replace(BASE, "").replace(/\?.*$/, "");

  // ═══ ① 登入落在哪 ═══
  console.log("\n① 登入落在哪");
  let s = await login(salon);
  check("🔴 沙龙帐号登入：落在产品（/en/salon-preview/overview）", /\/en\/salon-preview\/overview$/.test(path(s.page)), path(s.page));
  await s.page.screenshot({ path: `${OUT}/1-salon-lands.png` });
  await s.ctx.close();
  let o = await login(other);
  check("🔴 没有行业的帐号登入：还是平台首页（/en/portal），跟以前一模一样", /\/en\/portal$/.test(path(o.page)), path(o.page));
  await o.ctx.close();
  let n = await login(salon, "/en/portal/today");
  check("🔴 链接里带了 next：沙龙帐号也听 next（落在 /en/portal/today）", /\/en\/portal\/today$/.test(path(n.page)), path(n.page));
  await n.ctx.close();

  // ═══ ② 平台首页 ═══
  console.log("\n② 平台首页");
  s = await login(salon);
  await s.page.goto(`${BASE}/en/portal`, { waitUntil: "load", timeout: 180000 });
  const card = s.page.getByTestId("home-open-product");
  // 一张卡不在，要记成一条红，不是让整支脚本崩掉 —— 后面几件事互相独立，还得接着量。
  await card.waitFor({ timeout: 15000 }).catch(() => {});
  check("🔴 沙龙帐号的平台首页有「打开你的系统」那张卡", (await card.count()) === 1);
  await s.page.screenshot({ path: `${OUT}/2-platform-home-salon.png` });
  if (await card.count()) {
    await card.click();
    await s.page.waitForURL(/salon-preview\/overview/, { timeout: 60000 }).catch(() => {});
  }
  check("🔴 点了那张卡：进产品总览", /salon-preview\/overview$/.test(path(s.page)), path(s.page));
  o = await login(other);
  await o.page.goto(`${BASE}/en/portal`, { waitUntil: "load", timeout: 180000 });
  await o.page.waitForTimeout(1500);
  check("没有行业的帐号：那张卡整张不画", (await o.page.getByTestId("home-open-product").count()) === 0);

  // ═══ ③ 旧系统的侧栏 ═══
  console.log("\n③ 旧系统的侧栏");
  await s.page.goto(`${BASE}/en/portal/today`, { waitUntil: "load", timeout: 180000 });
  const railOpen = s.page.locator("aside a", { hasText: "Open your system" });
  await railOpen.first().waitFor({ timeout: 15000 }).catch(() => {});
  check("🔴 沙龙帐号：旧系统侧栏顶上有一行「Open your system」，指向产品总览",
    (await railOpen.count()) === 1 && (await railOpen.first().getAttribute("href")) === "/en/salon-preview/overview",
    (await railOpen.count()) ? await railOpen.first().getAttribute("href") : "没有这一行");
  // 按连结地址认，不按名字认：沙龙会把「Customers」改叫「Clients」，名字不可靠。
  const railHrefs = async (page) => page.locator("aside nav a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const sHrefs = await railHrefs(s.page);
  check("🔴 沙龙帐号：旧侧栏里的总览 · 客户 · 收款三行点了去新版（overview · clients · invoices），一行都不是旧地址",
    ["/en/salon-preview/overview", "/en/salon-preview/clients", "/en/salon-preview/invoices"].every((h) => sHrefs.includes(h))
      && !["/en/portal/dashboard", "/en/portal/customers", "/en/portal/payments"].some((h) => sHrefs.includes(h)), sHrefs.join(" "));
  // 新版是唯一的 UI 版本（任务 424）：沙龙的旧侧栏不列报价单 · 工程（沙龙的页里本来没有），也没有「加一页」
  check("🔴 沙龙帐号：旧侧栏不列「报价单」「工程」（这个帐号是按通用页开出来的，带着它们）",
    !sHrefs.some((h) => /\/portal\/(quotations|projects)$/.test(h ?? "")), sHrefs.join(" "));
  check("🔴 沙龙帐号：旧侧栏没有「+」加一页（那个菜单给的是旧模块库）", (await s.page.locator("aside button[aria-label='+ Add a page']").count()) === 0);
  await s.page.screenshot({ path: `${OUT}/3-old-shell-salon.png` });
  await o.page.goto(`${BASE}/en/portal/today`, { waitUntil: "load", timeout: 180000 });
  await o.page.waitForTimeout(1500);
  const oHrefs = await railHrefs(o.page);
  check("🔴 没有行业的帐号：旧侧栏照旧列「报价单」「工程」，也照旧有「+」加一页（别的行业一个字不动）",
    oHrefs.some((h) => h?.endsWith("/portal/quotations")) && oHrefs.some((h) => h?.endsWith("/portal/projects"))
      && (await o.page.locator("aside button[aria-label='+ Add a page']").count()) === 1, oHrefs.join(" "));
  check("🔴 没有行业的帐号：旧侧栏没有「Open your system」，客户那一行照旧去 /en/portal/customers，没有一行被改去新版",
    (await o.page.locator("aside a", { hasText: "Open your system" }).count()) === 0
      && oHrefs.includes("/en/portal/customers") && !oHrefs.some((h) => h?.includes("/salon-preview/")), oHrefs.join(" "));
  await o.ctx.close();

  // ═══ ④⑤ 产品的侧栏 · More Tools ═══
  console.log("\n④ ⑤ 产品的侧栏 · More Tools");
  await s.page.goto(`${BASE}/en/salon-preview/overview`, { waitUntil: "load", timeout: 180000 });
  const more = s.page.locator("aside nav a[href='/en/salon-preview/tools']");
  check("🔴 产品侧栏有「More Tools」这一行", (await more.count()) === 1);
  await more.click();
  await s.page.waitForURL(/salon-preview\/tools/, { timeout: 60000 });
  await s.page.getByRole("heading", { name: "More Tools" }).waitFor({ timeout: 60000 });
  const tools = async () => (await s.page.locator("[data-testid^='tool-']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").slice(5)))).sort();
  let now = await tools();
  check("🔴 一个新帐号（没有预约页、没有师傅页）：没有疗程 · 同意书 · 放飞机 · 评价 · 走单轮位",
    !["treatments", "consent", "no-shows", "reviews", "walkin"].some((k) => now.includes(k)), now.join(","));
  check("而每个帐号都有的在：今天要跟的 · 谁欠钱 · 官网 · 平台", ["today", "owing", "website", "platform"].every((k) => now.includes(k)), now.join(","));
  await s.page.screenshot({ path: `${OUT}/4-tools-fresh.png`, fullPage: true });
  for (const k of ["bookings", "staff"]) await salon.client.rpc("add_project_page", { requested_key: k, new_title: "" });
  await s.page.reload({ waitUntil: "load" });
  await s.page.getByRole("heading", { name: "More Tools" }).waitFor({ timeout: 60000 });
  now = await tools();
  check("🔴 加了预约页 ＋ 师傅页：疗程 · 同意书 · 放飞机 · 评价 · 走单轮位一起出现",
    ["treatments", "consent", "no-shows", "reviews", "walkin"].every((k) => now.includes(k)), now.join(","));
  await s.page.screenshot({ path: `${OUT}/5-tools-full.png`, fullPage: true });
  check("侧栏上「More Tools」那一行亮着", (await s.page.locator("aside nav a[href='/en/salon-preview/tools']").first().getAttribute("class"))?.includes("bg-[#000000]") ?? false);

  // ═══ ⑥ 一个来回 ═══
  console.log("\n⑥ 点一张卡进旧系统，再点那一行回来");
  await s.page.getByTestId("tool-consent").click();
  await s.page.waitForURL(/\/en\/portal\/consent/, { timeout: 120000 });
  check("🔴 点「Consent forms」：落在旧系统的同意书页", /\/en\/portal\/consent$/.test(path(s.page)), path(s.page));
  await s.page.locator("aside a", { hasText: "Open your system" }).first().waitFor({ timeout: 60000 });
  await s.page.screenshot({ path: `${OUT}/6-consent-in-classic.png` });
  await s.page.locator("aside a", { hasText: "Open your system" }).first().click();
  await s.page.waitForURL(/salon-preview\/overview/, { timeout: 120000 });
  check("🔴 点那一行「Open your system」：回到产品总览", /salon-preview\/overview$/.test(path(s.page)), path(s.page));
  // 旧侧栏里「班级」是补习中心的页，沙龙（加了预约页之后）也不该出现 —— 把每一组都展开再量
  // 一次只展开一组（openTools 是单值），所以一组一组展开、每展开一组就收一次连结，最后合起来看
  await s.page.goto(`${BASE}/en/portal/consent`, { waitUntil: "load", timeout: 180000 });
  await s.page.locator("aside nav a", { hasText: "Home" }).first().waitFor({ timeout: 60000 }).catch(() => {});
  const groupBtns = s.page.locator("aside nav button[aria-expanded]");
  const openedHrefs = new Set(await railHrefs(s.page));
  for (let i = 0; i < (await groupBtns.count()); i++) {
    const b = groupBtns.nth(i);
    if ((await b.getAttribute("aria-expanded")) === "false") await b.click().catch(() => {});
    await s.page.waitForTimeout(150);
    for (const h of await railHrefs(s.page)) openedHrefs.add(h);
  }
  check("🔴 沙龙帐号（有预约页）：旧侧栏一组一组展开之后，没有「班级」（补习的页）；而「谁欠钱」这类沙龙的工具是有的（证明真的展开过）",
    ![...openedHrefs].some((h) => h?.endsWith("/portal/classes")) && [...openedHrefs].some((h) => h?.endsWith("/portal/owing")), [...openedHrefs].join(" "));
  await s.page.goto(`${BASE}/en/salon-preview/tools`, { waitUntil: "load", timeout: 180000 });
  await s.page.goto(`${BASE}/en/salon-preview/tools`, { waitUntil: "load" });
  await s.page.getByTestId("tool-platform").click();
  await s.page.waitForURL(/salon-preview\/setup/, { timeout: 120000 });
  check("「Setup & delivery」那张卡：进新版的 Setup & Delivery 页（不是旧的深色平台首页）", /salon-preview\/setup$/.test(path(s.page)), path(s.page));
  await s.page.getByTestId("home-open-product").waitFor({ timeout: 30000 }).catch(() => {});
  check("🔴 那一页：五步交付条 ＋ 进系统的入口；没有旧页面缩略图 · 「Open and edit」 · 「Add a page」",
    (await s.page.getByTestId("setup-stages").locator("li").count()) === 5
      && (await s.page.getByTestId("home-open-product").count()) === 1
      && (await s.page.getByText(/Open and edit|Generated draft|Add a page/).count()) === 0);
  await s.page.screenshot({ path: `${OUT}/6b-setup-page.png` });
  await s.page.goto(`${BASE}/en/portal`, { waitUntil: "load", timeout: 180000 });
  await s.page.waitForURL(/salon-preview\/setup/, { timeout: 60000 }).catch(() => {});
  check("🔴 沙龙帐号直接打开平台首页 /en/portal：转到新版的 Setup & Delivery，不再是旧的深色首页", /salon-preview\/setup$/.test(path(s.page)), path(s.page));
  await s.ctx.close();

  // ═══ ⑦ 师傅 ═══
  console.log("\n⑦ 师傅（员工）");
  const crew = await person("crew", { industry: null });
  const add = await salon.client.rpc("add_project_member", { in_email: crew.email });
  if (add.error) throw new Error(`add member: ${add.error.message}`);
  // 师傅自己那一个帐号是空壳，不该指着任何行业；他进的是老板那家店
  const c = await login(crew);
  check("🔴 师傅登入：落在老板那家店的产品（他进的是沙龙）", /\/en\/salon-preview\/overview$/.test(path(c.page)), path(c.page));
  await c.page.goto(`${BASE}/en/salon-preview/tools`, { waitUntil: "load", timeout: 180000 });
  await c.page.getByRole("heading", { name: "More Tools" }).waitFor({ timeout: 60000 });
  const crewTools = (await c.page.locator("[data-testid^='tool-']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").slice(5)))).sort();
  check("🔴 师傅：没有老板的那几张（谁欠钱 · 官网 · 询价 · 平台），日常的都在",
    !["owing", "website", "enquiries", "platform"].some((k) => crewTools.includes(k)) && ["today", "treatments", "consent", "no-shows", "walkin"].every((k) => crewTools.includes(k)), crewTools.join(","));
  await c.page.screenshot({ path: `${OUT}/7-tools-staff.png`, fullPage: true });
  await c.ctx.close();

  // ═══ ⑧ OAuth 回来那一条路 ═══
  console.log("\n⑧ /auth/callback（Google 登入回来走的那一条）");
  const viaCallback = async (who, extra = "") => {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: who.email });
    if (error) throw new Error(`generateLink: ${error.message}`);
    const hash = data.properties.hashed_token;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/auth/callback?token_hash=${hash}&type=magiclink${extra}`, { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(1500);
    const at = path(page);
    await ctx.close();
    return at;
  };
  const cbSalon = await viaCallback(salon);
  check("🔴 沙龙帐号走回调：落在产品", /\/en\/salon-preview\/overview$/.test(cbSalon), cbSalon);
  const cbOther = await viaCallback(other);
  check("没有行业的帐号走回调：还是 /en/portal", /\/en\/portal$/.test(cbOther), cbOther);
  const cbNext = await viaCallback(salon, "&next=/portal/today");
  check("🔴 回调带了 next：沙龙帐号也听 next", /\/en\/portal\/today$/.test(cbNext), cbNext);

  await dropDone();
} finally {
  if (browser) await browser.close();
  for (const id of users.splice(0)) await dropThrowaway(admin, id);
  for (const id of leads.splice(0)) await admin.from("leads").delete().eq("id", id);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
