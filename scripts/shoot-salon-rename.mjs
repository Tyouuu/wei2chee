/**
 * 新版侧栏读客户自己改过的字了 —— 真登入、真资料库、真浏览器（任务 426）。
 *
 * 老板问「没有让沙龙老板一定会选择我的特点」，查出来的一个真退步：旧版侧栏
 * 的字从 `project_pages.title` 读，客户（或助手替她）改过名字，侧栏会跟着变；
 * 新版 Stitch 设计换上之后，这条线断了——字全部写死在代码里，每一家看到的
 * 都一模一样，跟对手给所有客户同一套 Customers/Staff/Bookings 是同一个问题。
 *
 * 验三件：
 *   ① 改过名字的那一行（customers → Members）—— 侧栏显示新名字，不是默认字
 *   ② 中文名字一样接得住（bookings → 预约）
 *   ③ 没改过的那一行（overview）—— 照旧显示默认字，没有被殃及
 *
 * 用法：npm run dev 开着，然后 node scripts/shoot-salon-rename.mjs
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
const OUT = ".screenshots/salon-rename";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let userId = null;
let leadId = null;
dropThrowawayOnExit(admin, () => userId);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));
const stamp = Date.now();

const email = `salon-rename-${stamp}@formae.test`;
const password = `Rn-${stamp}-x!`;
const { data: created, error: e1 } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (e1) throw new Error(`createUser: ${e1.message}`);
userId = created.user.id;
const { data: ind } = await admin.from("industries").select("id").eq("slug", "beauty").single();
const { data: lead, error: le } = await admin.from("leads").insert({ industry_id: ind.id, language: "en", answers: {} }).select("id").single();
if (le) throw new Error(`lead: ${le.message}`);
leadId = lead.id;
await admin.from("accounts").update({ lead_id: leadId }).eq("id", userId);

const { error: e2 } = await api.auth.signInWithPassword({ email, password });
if (e2) throw new Error(`signIn: ${e2.message}`);

// 加一页预约（默认 beauty 页里就有客户，预约要自己加），再改两页的名字，
// 模拟老板讲两句自己的生意之后系统跟着变的样子。
const rAdd = await api.rpc("add_project_page", { requested_key: "bookings", new_title: "" });
if (rAdd.error) throw new Error(`add bookings: ${rAdd.error.message}`);
const r1 = await api.rpc("rename_project_page", { target_key: "customers", new_title: "Members" });
if (r1.error) throw new Error(`rename customers: ${r1.error.message}`);
const r2 = await api.rpc("rename_project_page", { target_key: "bookings", new_title: "预约" });
if (r2.error) throw new Error(`rename bookings: ${r2.error.message}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/en/login`, { waitUntil: "load", timeout: 120000 });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/salon-preview|\/portal/, { timeout: 120000 });
await page.waitForLoadState("load");
await page.goto(`${BASE}/en/salon-preview/overview`, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(1500);

const railText = await page.locator("aside").innerText();
check("🔴 改过名字的客户页那一行显示「Members」，不是写死的「Clients & Profiles」", /Members/.test(railText), railText);
check("🔴 中文名字接得住：预约那一行显示「预约」，不是写死的「Appointments & Flow」", /预约/.test(railText), railText);
check("没改过名字的总览那一行照旧显示默认字「Overview」", /Overview/.test(railText), railText);
check("旧的默认字不再出现（客户 · 预约那两行）", !/Clients & Profiles/.test(railText) && !/Appointments & Flow/.test(railText), railText);

await page.screenshot({ path: `${OUT}/renamed-sidebar.png` });
await ctx.close();
await browser.close();

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) process.exit(1);
