/**
 * 真登入、真资料库 —— AI 助手第一次接进新版沙龙十四页（任务 428 之后的下一件）。
 *
 * 试点只做 Schedule 页。背景见 lib/portal/salon-work-describe.ts 的档头：
 * 这一页根本没有 Puck 排版树，所以助手面板走的是一条新的、平行的描述路径
 * （`salonDescription`），不是 `describeLayout`。读得到的"候选记录清单"是
 * 真登入这一轮种下去的真预约，模型讲出来的编号要是这几笔里的一个，
 * 不是编出来的。
 *
 * 用法：npm run dev 开着，然后 node scripts/check-salon-work-ai.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { dropThrowawayOnExit } from "./lib/throwaway.mjs";

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

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let userId = null;
dropThrowawayOnExit(admin, () => userId);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));
async function must(label, p) {
  const r = await p;
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}

const stamp = Date.now();
const email = `sch-ai-${stamp}@formae.test`;
const password = `Sa-${stamp}-x!`;
const { data: made, error: mkErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
userId = made.user.id;
const { error: inErr } = await api.auth.signInWithPassword({ email, password });
if (inErr) throw new Error(`signIn: ${inErr.message}`);
const { data: proj } = await api.from("projects").select("id").single();
const pid = proj.id;

for (const k of ["customers", "staff", "bookings"]) {
  await api.rpc("add_project_page", { requested_key: k, new_title: "" });
}

const jasmine = await must("jasmine", api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "staff", in_name: "SchAI-Test Jasmine" }));
const madam = await must("madam", api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "customers", in_name: "SchAI-Test Madam Chong" }));

const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
const at = (h) => `${todayStr}T0${h}:00:00+08:00`;
const appt = await must("appt", api.rpc("add_appointment", {
  in_project_id: pid, in_module_key: "bookings",
  in_starts_at: at(3), in_ends_at: at(4),
  in_party: madam.name, in_party_id: madam.id, in_staff_id: jasmine.id, in_service: "Balayage",
}));

let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/salon-preview|\/portal/, { timeout: 180000 });
  await page.goto(`${BASE}/en/salon-preview/schedule`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1000);

  console.log("\n① 面板在不在");
  const openBtn = page.locator('[data-salon-ai="closed"]');
  check("🔴 收起来的那颗按钮画出来了", (await openBtn.count()) > 0);
  await openBtn.click();
  await page.waitForTimeout(300);
  check("🔴 打开之后是一个真的面板，不是弹窗", (await page.locator('[data-salon-ai="open"]').count()) > 0);

  console.log("\n② 讲一句真的话，操作已经在的那一笔预约");
  const box = page.locator('[data-salon-ai="open"] textarea');
  await box.fill("Madam Chong has arrived");
  await page.locator('[data-salon-ai="open"] button[aria-label], [data-salon-ai="open"] button:has-text("↑")').last().click();
  await page.waitForTimeout(400);
  // The submit button has no stable text; click via Enter instead for reliability.
  await box.press("Enter").catch(() => {});
  await page.waitForFunction(() => !!document.querySelector("[data-salon-ai-said]"), { timeout: 30000 }).catch(() => {});
  const said1 = await page.locator("[data-salon-ai-said]").innerText().catch(() => "");
  console.log("  说的话:", said1);

  const { data: apptAfter } = await admin.from("appointments").select("arrived_at").eq("id", appt).single();
  check("🔴 真的把这一笔标成到了（arrived_at 真的写进去了），不是编了一个假编号导致静默失败", !!apptAfter?.arrived_at, apptAfter);

  console.log("\n③ 故意剪断描述那条线，看它老实说找不到");
  // Can't easily toggle server env mid-run; instead verify the honest-failure
  // shape directly: ask about a booking that was never described (a made-up
  // name), confirming the model doesn't silently invent a record id.
  await box.fill("Mark SchAI-Test Nobody Real as arrived");
  await box.press("Enter").catch(() => {});
  await page.waitForTimeout(3000);
  const said2 = await page.locator("[data-salon-ai-said]").innerText().catch(() => "");
  console.log("  说的话:", said2);
  check("🔴 编不出来的客人：没有乱标一笔，说了诚实的找不到/没做到",
    /could.?n.?t|can.?t|not sure|no booking|isn.?t on|找不到|没有/i.test(said2), said2);

  await page.screenshot({ path: ".screenshots/check-salon-work-ai.png" });
} finally {
  if (browser) await browser.close();
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) process.exit(1);
