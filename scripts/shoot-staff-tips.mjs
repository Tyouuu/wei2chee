/**
 * 师傅自己那一页多一段：这个月客人给的小费。真登入、真按、真截图。
 *
 * ── 为什么（2026-09-24，founder-tasks 里没有编号的这一件，答的是老板问的
 * 「功能层面还没到跟大厂对齐」那句话）─────────────────────────────────────
 *
 * `tips_of`（20260911190000）从做出来那天起零个 UI 呼叫端——助手也没有
 * 接（[任务 374] 只登记了这个缺口，没有人接过画面）。这一支验证：
 * 用 `VisitLinesPanel`（[任务 402]）真的给一行留一笔小费之后，
 * 那位师傅自己的记录页（跟打卡、抽成同一页）讲得出「这个月拿了多少」；
 * 另一位没有小费的师傅讲得出「还没有」，不是一个假的 0。
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
const OUT = ".screenshots/staff-tips";
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
  const email = `stafftips-${stamp}@formae.test`;
  const password = `St-${stamp}-x!`;
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

  for (const k of ["customers", "bookings", "staff"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }
  const her = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Puan Aina",
  });
  if (her.error) throw new Error(`add_directory_entry(customer): ${her.error.message}`);
  const tipped = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Farah",
  });
  if (tipped.error) throw new Error(`add_directory_entry(staff tipped): ${tipped.error.message}`);
  const untipped = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Bella",
  });
  if (untipped.error) throw new Error(`add_directory_entry(staff untipped): ${untipped.error.message}`);

  const appt = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 3600e3).toISOString(),
    in_ends_at: new Date(Date.now() + 2 * 3600e3).toISOString(),
    in_party: "Puan Aina", in_party_id: her.data.id, in_service: "Manicure",
  });
  if (appt.error) throw new Error(`add_appointment: ${appt.error.message}`);
  const apptId = appt.data;

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  // ── Bella 一开始（还没有小费）：讲得出「还没有」，不是一个假的 RM 0 ──────
  await page.goto(`${BASE}/en/portal/staff/${untipped.data.id}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  let body = await page.locator("body").innerText();
  if (/No tips from guests in the last 30 days yet/.test(body)) ok("Bella 还没被打赏：讲得出「还没有」");
  else no("Bella 一开始的字不对", body.slice(0, 400));
  await page.screenshot({ path: `${OUT}/1-bella-none.png`, fullPage: true });

  // ── 用真的 VisitLinesPanel 给 Farah 记一行、留一笔小费 ────────────────────
  await page.goto(`${BASE}/en/portal/bookings/${apptId}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  const panel = page.locator("h2", { hasText: "What was done this visit" }).locator("..");
  await panel.getByLabel("What was done").fill("Gel manicure");
  await panel.locator("select").selectOption({ label: "Farah" });
  await panel.getByLabel("Price").fill("60");
  await panel.getByRole("button", { name: "Add a line" }).click();
  await page.waitForTimeout(3000);

  const { data: lineRow } = await admin
    .from("appointment_lines").select("id, staff_id")
    .eq("appointment_id", apptId).single();
  if (lineRow?.staff_id === tipped.data.id) ok("那一行真的记在 Farah 名下");
  else no("那一行没有记在 Farah 名下", JSON.stringify(lineRow));

  const tipBox = panel.getByLabel("Tip");
  await tipBox.fill("15");
  await panel.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(3000);

  const { data: afterTip } = await admin
    .from("appointment_lines").select("tip_cents").eq("id", lineRow.id).single();
  if (afterTip?.tip_cents === 1500) ok("小费存进 appointment_lines 是 RM 15");
  else no("小费没有存对", JSON.stringify(afterTip));

  // ── 直接问一次资料库自己的 tips_of，确认它真的算得出来（不靠画面猜）────
  const { data: rpcRows, error: rpcErr } = await api.rpc("tips_of", {
    in_project_id: pid, in_days: 30,
  });
  if (rpcErr) no("tips_of 呼叫失败", rpcErr.message);
  const mine = (rpcRows ?? []).find((r) => r.staff_id === tipped.data.id);
  if (mine?.tip_cents === 1500 && mine?.tipped_visits === 1)
    ok("🔴 tips_of 自己算出 RM 15 · 1 次来访");
  else no("tips_of 算出来的不对", JSON.stringify(mine));

  // ── Farah 自己的记录页现在讲得出这个数字 ──────────────────────────────────
  await page.goto(`${BASE}/en/portal/staff/${tipped.data.id}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  body = await page.locator("body").innerText();
  if (/RM\s*15\.00 in tips across 1 visits/.test(body) || /RM\s*15 in tips across 1 visits/.test(body))
    ok("🔴 Farah 自己那一页讲得出「RM 15 小费 · 1 次来访」");
  else no("Farah 那一页的字不对", body.slice(0, 400));
  await page.screenshot({ path: `${OUT}/2-farah-tipped.png`, fullPage: true });

  // ── Bella 完全没被这一笔波及（另一位师傅的名下不该多出小费）────────────
  await page.goto(`${BASE}/en/portal/staff/${untipped.data.id}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  body = await page.locator("body").innerText();
  if (/No tips from guests in the last 30 days yet/.test(body)) ok("Bella 名下没有被记到别人的小费");
  else no("Bella 名下意外多了小费", body.slice(0, 400));
  await page.screenshot({ path: `${OUT}/3-bella-still-none.png`, fullPage: true });

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
