/**
 * 一笔预约当场做了什么 —— 真登入，真按，真截图。
 *
 * ── 为什么（2026-09-12，[任务 397] 补的洞）───────────────────────────────
 *
 * `treatment_notes.appointment_id` 建表那天就有，`treatment-desk.tsx` 的
 * 表单跟助手那一支从来没有送过值——补的是两半：① 表单加一格「哪一次预约」，
 * 可以不选 ② 预约自己那一页现在读得到连过去的那一笔笔记
 * （`[recordId]/page.tsx` 新的 `appointmentTreatments`）。
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
const OUT = ".screenshots/visit-treatment-link";
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
  const email = `visitlink-${stamp}@formae.test`;
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
    const { error: pgErr } = await api.rpc("add_project_page", { requested_key: k, new_title: "" });
    if (pgErr && !/already/i.test(pgErr.message)) no(`台面：${k} 那一页开不了`, pgErr.message);
  }

  const { data: cust, error: cErr } = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Ms Gita",
  });
  if (cErr) throw new Error(`add customer: ${cErr.message}`);
  const custId = cust?.id ?? cust;

  const { data: staff, error: sErr } = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Nurse Lily",
  });
  if (sErr) throw new Error(`add staff: ${sErr.message}`);
  const staffId = staff?.id ?? staff;

  const tomorrow = new Date(Date.now() + 864e5);
  const starts = new Date(tomorrow.setHours(15, 0, 0, 0)).toISOString();
  const ends = new Date(tomorrow.setHours(15, 45, 0, 0)).toISOString();
  const { data: appt, error: aErr } = await api.rpc("add_appointment", {
    in_project_id: pid,
    in_module_key: "bookings",
    in_starts_at: starts,
    in_ends_at: ends,
    in_party: "Ms Gita",
    in_party_id: custId,
    in_staff_id: staffId,
    in_service: "Botox",
  });
  if (aErr) throw new Error(`add appointment: ${aErr.message}`);
  const apptId = appt?.id ?? appt;

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: "reduce" });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  // ── ① 预约自己那一页 —— 还没记过，这一段不该画 ──────────────────────────
  await page.goto(`${BASE}/en/portal/bookings/${apptId}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2200);
  let body = await page.locator("body").innerText();
  if (!/What she has had done/i.test(body)) ok("还没记过，「她做过什么」那一段不画");
  else no("还没记过却画了这一段", body.slice(0, 200));
  await page.screenshot({ path: `${OUT}/1-appointment-before.png`, fullPage: true });

  // ── ② 疗程记录那一页 —— 挑这一位客人，指定这一次预约 ───────────────────
  await page.goto(`${BASE}/en/portal/treatments`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: /Ms Gita/i }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Record a treatment/i }).click();
  await page.waitForTimeout(400);

  const visitSelect = page.getByLabel("Which visit");
  if ((await visitSelect.count()) === 0) {
    no("🔴 「哪一次预约」那一格没画出来", await page.locator("body").innerText().then(t => t.slice(0, 300)));
    throw new Error("stop here");
  }
  ok("🔴 有真的预约的时候，「哪一次预约」那一格画出来了");
  const botoxValue = await visitSelect
    .locator("option", { hasText: "Botox" })
    .first()
    .getAttribute("value");
  if (!botoxValue) {
    no("🔴 下拉里找不到带 Botox 的那一个选项", await visitSelect.innerText());
    throw new Error("stop here");
  }
  await visitSelect.selectOption(botoxValue);

  await page.getByLabel("What was done").fill("20 units of Botox on her forehead");
  await page.getByLabel("Area").fill("Forehead");
  await page.getByLabel("Done by").selectOption({ label: "Nurse Lily" });
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForTimeout(2600);

  const { data: savedNote } = await admin
    .from("treatment_notes")
    .select("id, appointment_id, what")
    .eq("party_id", custId)
    .maybeSingle();
  if (savedNote?.appointment_id === apptId) ok("🔴 那一笔笔记真的连去了这一笔预约");
  else no("🔴 appointment_id 没有连上", JSON.stringify(savedNote));
  await page.screenshot({ path: `${OUT}/2-note-linked.png`, fullPage: true });

  // ── ③ 回到预约那一页 —— 现在看得到这一笔做了什么 ────────────────────────
  await page.goto(`${BASE}/en/portal/bookings/${apptId}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2200);
  body = await page.locator("body").innerText();
  if (/What she has had done/i.test(body)) ok("🔴 预约那一页现在画出了「她做过什么」");
  else no("🔴 预约那一页还是没有画出来", body.slice(0, 300));
  if (/20 units of Botox on her forehead/.test(body)) ok("这一笔记录的内容原样出现在这一页上");
  else no("内容没有出现", body.slice(0, 400));
  if (/Nurse Lily/.test(body)) ok("做的人也在");
  else no("做的人没出现", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/3-appointment-after.png`, fullPage: true });

  // ── ④ 没有预约的客人 —— 那一格不画（不留一个永远只有一个选项的下拉） ───
  const { data: cust2, error: c2Err } = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Walk-in Wendy",
  });
  if (c2Err) no("台面：第二个客人建不了", c2Err.message);
  await page.goto(`${BASE}/en/portal/treatments`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: /Walk-in Wendy/i }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Record a treatment/i }).click();
  await page.waitForTimeout(400);
  if ((await page.getByLabel("Which visit").count()) === 0)
    ok("🔴 没有预约的客人，「哪一次预约」那一格整个不画");
  else no("🔴 没有预约却画了那一格", "");

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
