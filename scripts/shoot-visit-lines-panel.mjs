/**
 * 沙龙那一本日记簿——做什么 · 谁做 · 多少钱 · 小费。真登入、真按、真截图。
 *
 * ── 为什么（2026-09-12，[任务 402]）───────────────────────────────────────
 *
 * `add_visit_line` · `set_visit_tip` 从做出来那天起零个 UI 呼叫端。
 * 这一支验证预约详情页新加的那一段：加一行、给那一行留小费，
 * 两次都真的写进 `appointment_lines`。
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
const OUT = ".screenshots/visit-lines-panel";
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
  const email = `visitline-${stamp}@formae.test`;
  const password = `Vl-${stamp}-x!`;
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
    in_project_id: pid, in_module_key: "customers", in_name: "Ms Gita",
  });
  if (her.error) throw new Error(`add_directory_entry(customer): ${her.error.message}`);
  const lily = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Nurse Lily",
  });
  if (lily.error) throw new Error(`add_directory_entry(staff): ${lily.error.message}`);

  const appt = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 3600e3).toISOString(),
    in_ends_at: new Date(Date.now() + 2 * 3600e3).toISOString(),
    in_party: "Ms Gita", in_party_id: her.data.id, in_service: "Facial",
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

  await page.goto(`${BASE}/en/portal/bookings/${apptId}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  let body = await page.locator("body").innerText();
  if (/Nothing recorded yet/.test(body)) ok("一开始：讲得出「还没有记下来」");
  else no("一开始的字不对", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });

  // ── 加一行：Botox · Nurse Lily · RM 800 ──────────────────────────────────
  // 用面板自己的标题找到它的根节点，底下的 getByLabel/getByRole 才不会
  // 撞到同一页上 NoShowPanel 那几个同样叫「How much」「Save」的栏位。
  const panel = page.locator("h2", { hasText: "What was done this visit" }).locator("..");
  await panel.getByLabel("What was done").fill("Botox 20 units");
  await panel.locator("select").selectOption({ label: "Nurse Lily" });
  await panel.getByLabel("How much").fill("800");
  await panel.getByRole("button", { name: "Add a line" }).click();
  await page.waitForTimeout(3000);

  const { data: lineRow } = await admin
    .from("appointment_lines").select("id, service, staff_id, price_cents")
    .eq("appointment_id", apptId).single();
  if (lineRow?.service === "Botox 20 units" && lineRow?.staff_id === lily.data.id && lineRow?.price_cents === 80000)
    ok("🔴 加了一行，资料库里的服务／师傅／价钱全对");
  else no("加一行没有真的写对", JSON.stringify(lineRow));

  body = await page.locator("body").innerText();
  if (/Botox 20 units/.test(body) && /Nurse Lily/.test(body) && /RM\s*800/.test(body))
    ok("画面上那一行讲得出服务、师傅、价钱");
  else no("画面上那一行不对", body.slice(0, 400));
  await page.screenshot({ path: `${OUT}/2-line-added.png`, fullPage: true });

  // ── 给这一行留 RM 50 小费 ────────────────────────────────────────────────
  const tipBox = panel.getByLabel("Tip");
  await tipBox.fill("50");
  await panel.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(3000);

  const { data: afterTip } = await admin
    .from("appointment_lines").select("tip_cents").eq("id", lineRow.id).single();
  if (afterTip?.tip_cents === 5000) ok("🔴 小费存进去了，资料库里是 RM 50");
  else no("小费没有存对", JSON.stringify(afterTip));

  const { data: ledgerCheck } = await admin
    .from("ledger_entries").select("id").eq("project_id", pid);
  if ((ledgerCheck ?? []).length === 0) ok("🔴 小费没有进 ledger_entries——不是营业额");
  else no("小费意外进了帐", JSON.stringify(ledgerCheck));
  await page.screenshot({ path: `${OUT}/3-tip-saved.png`, fullPage: true });

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
