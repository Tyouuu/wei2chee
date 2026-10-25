/**
 * 真登入、真资料库 —— AI 助手第二次接进新版沙龙页，这次是客户页（[任务432] 续）。
 *
 * 跟 Schedule 那支（check-salon-work-ai.mjs）同一个形状，换一页验证：
 * 这一页的候选清单走的是 `describeSalonClients`（RecordTable 形状，不是
 * DaySchedule），要单独证明模型读得懂这份格式、挑得对真客人的编号。
 *
 * 用法：npm run dev 开着，然后 node scripts/check-salon-clients-work-ai.mjs
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
const email = `cli-ai-${stamp}@formae.test`;
const password = `Sa-${stamp}-x!`;
const { data: made, error: mkErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
userId = made.user.id;
const { error: inErr } = await api.auth.signInWithPassword({ email, password });
if (inErr) throw new Error(`signIn: ${inErr.message}`);
const { data: proj } = await api.from("projects").select("id").single();
const pid = proj.id;

for (const k of ["customers"]) {
  await api.rpc("add_project_page", { requested_key: k, new_title: "" });
}

const gita = await must(
  "gita",
  api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "customers", in_name: "CliAI-Test Gita" }),
);

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
  await page.goto(`${BASE}/en/salon-preview/clients`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);

  console.log("\n① 面板在不在、是不是透明的（上次 Schedule 试点踩过这个坑）");
  const openBtn = page.locator('[data-salon-ai="closed"]');
  check("🔴 收起来的那颗按钮画出来了", (await openBtn.count()) > 0);
  await openBtn.click();
  await page.waitForTimeout(300);
  const openPanel = page.locator('[data-salon-ai="open"]');
  check("🔴 打开之后是一个真的面板", (await openPanel.count()) > 0);
  const bg = await openPanel.evaluate((el) => getComputedStyle(el).backgroundColor);
  check("🔴 面板有真的底色，不是透明的（跟 Schedule 第一版踩过的坑一样）", bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent", bg);

  console.log("\n② 讲一句真的话，透过客户页自己的候选清单（describeSalonClients）认出真客人");
  const box = openPanel.locator("textarea");
  await box.fill("Give CliAI-Test Gita RM 50 gift credit for her birthday");
  await box.press("Enter").catch(() => {});
  await page.waitForFunction(() => !!document.querySelector("[data-salon-ai-said]"), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const said1 = await page.locator("[data-salon-ai-said]").innerText().catch(() => "");
  console.log("  说的话:", said1);

  const { data: credit } = await admin
    .from("stored_value_moves")
    .select("amount_cents, direction")
    .eq("party_id", gita.id)
    .eq("direction", "in")
    .maybeSingle();
  check("🔴 真的记了一笔 RM 50 的储值——助手读懂了客户页自己的候选清单格式，不是只会 Schedule 那一种", credit?.amount_cents === 5000, JSON.stringify(credit));

  console.log("\n③ 编不出来的客人：不乱配给名字相近的真人");
  await box.fill("Give CliAI-Test Nobody-Real RM 999 gift credit");
  await box.press("Enter").catch(() => {});
  await page.waitForTimeout(3000);
  const said2 = await page.locator("[data-salon-ai-said]").innerText().catch(() => "");
  console.log("  说的话:", said2);
  const { data: badCredit } = await admin.from("stored_value_moves").select("amount_cents").eq("party_id", gita.id).eq("amount_cents", 99900).maybeSingle();
  check("🔴 编出来的名字没有被接到 Gita 身上（没有多一笔 999）", !badCredit);

  await page.screenshot({ path: ".screenshots/check-salon-clients-work-ai.png" });
} finally {
  if (browser) await browser.close();
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) process.exit(1);
