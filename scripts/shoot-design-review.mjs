/**
 * 设计总检——把一个客户、一笔预约，喂到「什么都有」的状态，拍出来给眼睛看。
 *
 * ── 为什么（2026-09-12，老板要求「好好改良一下设计」）───────────────────
 *
 * 这一晚陆续在客户页、预约页上加了好几段（储值卡充值/用掉、她自己的连结、
 * 没来记录、这一次做了什么）。每一段单独看都对，但从来没有人在同一张
 * 客户页上把它们全部叠起来看过一次——那正是老板担心的「杂乱」。
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
const OUT = ".screenshots/design-review";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
dropThrowawayOnExit(admin, () => userId);

let browser;
try {
  const stamp = Date.now();
  const email = `design-${stamp}@formae.test`;
  const password = `Dr-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const pid = proj.id;
  await admin.from("projects").update({ business_name: "Wei Hair Studio" }).eq("id", pid);

  for (const k of ["customers", "bookings", "staff"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  const lily = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Nurse Lily",
  });

  // 一个「什么都有」的客人：付过钱、送过储值卡、放过飞机、留过评价
  const her = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Mrs Chan",
  });
  const partyId = her.data.id;

  // 她的备注——沙龙老板真的会写的那种自由文字（发色配方、偏好）
  await api.rpc("update_directory_entry", {
    in_id: partyId,
    in_note: "Ash brown 6.1 root touch-up every 6-8 weeks, no bleach on crown. Prefers quiet service, working on iPad during blowdry.",
  });

  // 这门生意的规矩早就设过了——看已经settle 下来长什么样，不是第一次设定的样子
  await api.rpc("set_booking_rules", {
    in_project_id: pid, in_no_show_deposit_after: 2, in_default_deposit_cents: 5000,
  });

  // 送她一笔储值 + 用掉一部分
  await api.rpc("grant_credit", { in_project_id: pid, in_party_id: partyId, in_amount_cents: 20000, in_reason: "Birthday" });
  await api.rpc("use_credit", { in_project_id: pid, in_party_id: partyId, in_amount_cents: 5000 });

  // 三笔预约：一笔今天要来、一笔她放过飞机、一笔做完留了评价
  const today = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 3600e3).toISOString(),
    in_ends_at: new Date(Date.now() + 2 * 3600e3).toISOString(),
    in_party: "Mrs Chan", in_party_id: partyId, in_service: "Colour touch-up",
  });
  await admin.from("appointment_lines").insert({
    project_id: pid, appointment_id: today.data, service: "Colour touch-up",
    staff_id: lily.data.id, price_cents: 18000, sort_order: 0,
  });

  const missed = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() - 5 * 864e5).toISOString(),
    in_ends_at: new Date(Date.now() - 5 * 864e5 + 3600e3).toISOString(),
    in_party: "Mrs Chan", in_party_id: partyId, in_service: "Manicure",
  });
  await api.rpc("set_appointment_status", { in_id: missed.data, in_status: "no_show" });

  const done = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() - 10 * 864e5).toISOString(),
    in_ends_at: new Date(Date.now() - 10 * 864e5 + 3600e3).toISOString(),
    in_party: "Mrs Chan", in_party_id: partyId, in_service: "Rebonding",
  });
  await api.rpc("set_appointment_status", { in_id: done.data, in_status: "done" });
  await admin.from("appointment_lines").insert([
    { project_id: pid, appointment_id: done.data, service: "Rebonding", staff_id: lily.data.id, price_cents: 32000, sort_order: 0 },
    { project_id: pid, appointment_id: done.data, service: "Chronologiste Hair Oil (take-home)", staff_id: null, price_cents: 4500, sort_order: 1 },
  ]);
  await admin.from("appointments").update({
    review_rating: 5, review_text: "Loved it, will come back!",
    review_submitted_at: new Date().toISOString(),
  }).eq("id", done.data);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/portal/customers/${partyId}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/customer-full.png`, fullPage: true });
  await page.getByRole("tab", { name: "Account & activity" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/customer-account-tab.png`, fullPage: true });

  await page.goto(`${BASE}/en/portal/bookings/${today.data}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/booking-full.png`, fullPage: true });

  console.log(`客户 id: ${partyId} · 预约 id: ${today.data}`);
  console.log(`→ ${OUT}/`);

} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}
