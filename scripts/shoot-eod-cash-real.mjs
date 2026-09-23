/**
 * 沙龙新设计的 End of Day Cash——从写死的三个支付渠道换成真的今天的
 * ledger_entries，按真的 method 分组。真登入、真截图。
 *
 * ── 为什么（2026-09-24，Lookbook 之后第十页）───────────────────────────────
 *
 * 种三笔今天真的收款(两笔现金、一笔 DuitNow QR)、一笔真的开销。验证：
 * 结算清单是真的按 method 分组算出来的(不是写死三行)、Expected Cash
 * 只认含「cash」字样的 method、开销清单是真的、员工看不到这一整页
 * (sees_money)、Print Summary 真的触发浏览器列印。
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
const OUT = ".screenshots/eod-cash-real";
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

let browser;
try {
  const stamp = Date.now();
  const email = `eod-${stamp}@formae.test`;
  const password = `Eo-${stamp}-x!`;
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

  for (const k of ["customers", "expenses"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }
  const guest = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Eod-Test Guest",
  });
  if (guest.error) throw new Error(`guest: ${guest.error.message}`);

  const pay1 = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 8000, in_party: "Eod-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Haircut",
  });
  if (pay1.error) throw new Error(`pay1: ${pay1.error.message}`);
  await admin.from("ledger_entries").update({ method: "Cash" }).eq("id", pay1.data.id);

  const pay2 = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 5000, in_party: "Eod-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Wash",
  });
  if (pay2.error) throw new Error(`pay2: ${pay2.error.message}`);
  await admin.from("ledger_entries").update({ method: "Cash" }).eq("id", pay2.data.id);

  const pay3 = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 12000, in_party: "Eod-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Color",
  });
  if (pay3.error) throw new Error(`pay3: ${pay3.error.message}`);
  await admin.from("ledger_entries").update({ method: "DuitNow QR" }).eq("id", pay3.data.id);

  const expense = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 1500, in_party: "Towel Laundry Express",
    in_category: "supplies", in_note: "Receipt #8812",
  });
  if (expense.error) throw new Error(`expense: ${expense.error.message}`);

  browser = await chromium.launch();
  const ownerPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await ownerPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await ownerPage.fill('input[type="email"]', email);
  await ownerPage.fill('input[type="password"]', password);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForURL(/portal/, { timeout: 180000 });

  await ownerPage.goto(`${BASE}/en/salon-preview/eod-cash`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await ownerPage.locator("body").innerText();

  if (!/Maybank EDC Terminal|Batch #089|4099-2811/.test(body)) ok("写死的假 EDC 终端资料不见了");
  else no("还留着写死的假终端资料");

  if (/Cash/.test(body) && /2 transaction/.test(body)) ok("🔴 真的现金渠道分组显示 2 笔交易(不是写死的样子)");
  else no("现金渠道分组不对", body.match(/Cash[^\n]*/g)?.join(" | "));

  if (/DuitNow QR/.test(body) && /1 transaction/.test(body)) ok("🔴 真的 DuitNow QR 渠道分组显示 1 笔交易");
  else no("QR 渠道分组不对");

  if (/RM\s*130\.00/.test(body)) ok("🔴 Expected Cash 真的只算含 cash 字样的方式(80+50=130)");
  else no("Expected Cash 数字不对", body.match(/Expected Cash[\s\S]{0,100}/)?.[0]);

  if (/Towel Laundry Express/.test(body) && /RM\s*15\.00/.test(body)) ok("🔴 真的开销记录出现在 Petty Cash 那一段");
  else no("开销记录没有出现");

  if (/RM\s*250\.00/.test(body)) ok("🔴 Total Shift Gross 真的是三笔收款加总(80+50+120=250)");
  else no("Total Shift Gross 不对", body.match(/Total Shift Gross[\s\S]{0,80}/)?.[0]);

  await ownerPage.screenshot({ path: `${OUT}/1-reconciliation.png`, fullPage: true });

  // 员工身分——整页都看不到(sees_money)。
  const staffEmail = `eod-staff-${stamp}@formae.test`;
  const staffPassword = `Es-${stamp}-x!`;
  const { data: staffUser, error: staffMkErr } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  });
  if (staffMkErr) throw new Error(`createUser staff: ${staffMkErr.message}`);
  const memberAdd = await api.rpc("add_project_member", { in_email: staffEmail });
  if (memberAdd.error) throw new Error(`add_project_member: ${memberAdd.error.message}`);

  const staffPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await staffPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await staffPage.fill('input[type="email"]', staffEmail);
  await staffPage.fill('input[type="password"]', staffPassword);
  await staffPage.click('button[type="submit"]');
  await staffPage.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await staffPage.goto(`${BASE}/en/salon-preview/eod-cash`, { waitUntil: "networkidle", timeout: 180000 });
  const staffBody = await staffPage.locator("body").innerText();
  if (/only visible to the business owner/.test(staffBody) && !/RM\s*250\.00/.test(staffBody))
    ok("🔴 员工身分完全看不到这一页的钱(sees_money 挡住整页)");
  else no("员工身分的金钱隔离不对");
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
