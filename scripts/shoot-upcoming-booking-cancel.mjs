/**
 * 客户页「Upcoming Booking」卡的「Cancel」按钮——真的按得动吗（2026-09-14）。
 *
 * 逐行比对参考稿新加的一颗按钮，`upcoming-booking-card.tsx` 走的是
 * `set_appointment_status`（跟这一笔预约自己详情页的分段钮同一支）。
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
const OUT = ".screenshots/upcoming-cancel";
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

let pass = 0, fail = 0;
const ok = (m) => { console.log("  PASS ", m); pass++; };
const no = (m, d) => { console.log("  FAIL ", m, d ?? ""); fail++; };

let browser;
try {
  const stamp = Date.now();
  const email = `upcancel-${stamp}@formae.test`;
  const password = `Dr-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw mkErr;
  userId = made.user.id;

  const { data: sess, error: sErr } = await api.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  const token = sess.session.access_token;
  const authed = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: proj } = await authed.from("projects").select("id").single();
  const pid = proj.id;

  for (const k of ["customers", "bookings"]) {
    await authed.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  const her = await authed.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Ms Farah",
  });
  const partyId = her.data.id;

  const appt = await authed.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 3600e3).toISOString(),
    in_ends_at: new Date(Date.now() + 2 * 3600e3).toISOString(),
    in_party: "Ms Farah", in_party_id: partyId, in_service: "Manicure",
  });
  if (appt.error) throw appt.error;
  const apptId = appt.data;

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/portal/customers/${partyId}`, {
    waitUntil: "networkidle", timeout: 180000,
  });

  const before = await page.locator("body").innerText();
  if (/Upcoming Booking/.test(before) && /Manicure/.test(before))
    ok("Upcoming Booking 卡在，读得到那一笔");
  else no("一开始没有看到 Upcoming Booking 卡", before.slice(0, 300));

  await page.screenshot({ path: `${OUT}/1-before.png`, fullPage: true });

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(2500);

  const { data: row } = await admin.from("appointments").select("status").eq("id", apptId).maybeSingle();
  if (row?.status === "cancelled") ok("🔴 按了 Cancel，资料库里这一笔真的变成 cancelled");
  else no("资料库里的状态不对", JSON.stringify(row));

  const after = await page.locator("body").innerText();
  if (!/Upcoming Booking/.test(after)) ok("画面上那张卡不见了");
  else no("画面上那张卡还在", after.slice(0, 300));

  await page.screenshot({ path: `${OUT}/2-after.png`, fullPage: true });

  await page.reload({ waitUntil: "networkidle" });
  const reloaded = await page.locator("body").innerText();
  if (!/Upcoming Booking/.test(reloaded)) ok("重新整理之后，那张卡还是不在（不是只有客户端记忆）");
  else no("重新整理之后那张卡又出现了", reloaded.slice(0, 300));

  console.log(`\n判：${pass} 过 · ${fail} 没过`);
} finally {
  await browser?.close();
  if (userId) await dropThrowaway(admin, userId);
  process.exit(fail > 0 ? 1 : 0);
}
