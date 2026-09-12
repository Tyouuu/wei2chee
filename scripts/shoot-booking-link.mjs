/**
 * 她自己那张预约 —— 真登入、真按、真截图。
 *
 * ── 为什么（2026-09-12，接续[任务 371/398]）───────────────────────────────
 *
 * `public_appointment` · `cancel_shared_appointment` · `submit_appointment_review`
 * 三支从做出来那天起零个呼叫端——`check-self-cancel.mjs` 只打过资料库，
 * 没有人真的开过 `/b/<ref>` 这个网址。这一支走浏览器：连结打得开、
 * 排好的可以取消、做完的可以留评价，两张截图。
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
const OUT = ".screenshots/booking-link";
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
  const email = `booklink-${stamp}@formae.test`;
  const password = `Bl-${stamp}-x!`;
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
  await admin.from("projects").update({ business_name: "Xing Fa Salon" }).eq("id", pid);

  for (const k of ["customers", "bookings"]) {
    const { error: pgErr } = await api.rpc("add_project_page", { requested_key: k, new_title: "" });
    if (pgErr && !/already/i.test(pgErr.message)) no(`台面：${k} 那一页开不了`, pgErr.message);
  }

  const her = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Ms Farah",
  });
  if (her.error) throw new Error(`add_directory_entry: ${her.error.message}`);

  // ── ① 排好的一笔 —— 打得开、可以取消 ─────────────────────────────────────
  const booked = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 864e5).toISOString(),
    in_ends_at: new Date(Date.now() + 864e5 + 36e5).toISOString(),
    in_party: "Ms Farah", in_party_id: her.data.id, in_service: "Facial",
  });
  if (booked.error) throw new Error(`add_appointment(booked): ${booked.error.message}`);
  const { data: bookedRow } = await admin
    .from("appointments").select("public_ref").eq("id", booked.data).single();

  browser = await chromium.launch();

  // ── 老板那一边 —— 单据详情页上有没有这条连结、复不复制得出来 ────────────
  const adminCtx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await adminCtx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const adminPage = await adminCtx.newPage();
  await adminPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await adminPage.fill('input[type="email"]', email);
  await adminPage.fill('input[type="password"]', password);
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL(/portal/, { timeout: 180000 });
  await adminPage.goto(`${BASE}/en/portal/bookings/${booked.data}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  const linkInput = adminPage.getByLabel("Her link");
  const expectedLink = `${BASE}/b/${bookedRow.public_ref}`;
  if ((await linkInput.count()) > 0 && (await linkInput.inputValue()) === expectedLink)
    ok("老板那一边：单据上印着她自己那条连结，网址是对的");
  else no("老板那一边：连结不见了或者网址不对", await linkInput.inputValue().catch(() => "(找不到)"));
  await adminPage.getByRole("button", { name: "Copy" }).click();
  await adminPage.waitForTimeout(400);
  const clip = await adminPage.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  if (clip === expectedLink) ok("🔴 按了「复制」，剪贴簿里真的是那条连结");
  else no("剪贴簿里不对", clip);
  await adminPage.screenshot({ path: `${OUT}/0-admin-record.png`, fullPage: true });
  await adminCtx.close();

  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  await page.goto(`${BASE}/b/${bookedRow.public_ref}`, { waitUntil: "networkidle", timeout: 180000 });
  let body = await page.locator("body").innerText();
  if (/Xing Fa Salon/.test(body) && /Ms Farah/.test(body)) ok("排好的一笔：打得开，写着这家跟她的名字");
  else no("排好的一笔打不开", body.slice(0, 200));
  const cancelBtn = page.getByRole("button", { name: "Cancel this booking" });
  if ((await cancelBtn.count()) > 0) ok("排好的一笔：有「取消」按钮");
  else no("找不到取消按钮", body.slice(0, 200));
  await page.screenshot({ path: `${OUT}/1-booked.png`, fullPage: true });

  await cancelBtn.click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await page.waitForTimeout(6000);
  const { data: afterCancel } = await admin
    .from("appointments").select("status").eq("id", booked.data).single();
  if (afterCancel?.status === "cancelled") ok("🔴 按了两下之后，资料库真的取消了");
  else no("资料库没有真的取消", afterCancel?.status);
  body = await page.locator("body").innerText();
  if (/Cancelled/.test(body) && !(await page.getByRole("button", { name: "Cancel this booking" }).count()))
    ok("取消之后，画面讲得出状态、也没有再给按一次");
  else no("取消后的画面不对", body.slice(0, 200));
  await page.screenshot({ path: `${OUT}/2-cancelled.png`, fullPage: true });

  // ── ② 做完的一笔 —— 留一句评价 ───────────────────────────────────────────
  const done = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() - 36e5).toISOString(),
    in_ends_at: new Date().toISOString(),
    in_party: "Ms Farah", in_party_id: her.data.id, in_service: "Botox",
  });
  if (done.error) throw new Error(`add_appointment(done): ${done.error.message}`);
  await api.rpc("set_appointment_status", { in_id: done.data, in_status: "done" });
  const { data: doneRow } = await admin
    .from("appointments").select("public_ref").eq("id", done.data).single();

  await page.goto(`${BASE}/b/${doneRow.public_ref}`, { waitUntil: "networkidle", timeout: 180000 });
  body = await page.locator("body").innerText();
  if (/How was it/.test(body)) ok("做完的一笔：画的是评价表单");
  else no("做完的一笔没有画评价表单", body.slice(0, 200));

  await page.locator('button[aria-label="5"]').click();
  await page.locator("textarea").fill("Very gentle, will come back.");
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForTimeout(1500);

  const { data: afterReview } = await admin
    .from("appointments").select("review_rating, review_text").eq("id", done.data).single();
  if (afterReview?.review_rating === 5 && afterReview?.review_text === "Very gentle, will come back.")
    ok("🔴 5 星 + 那句话，资料库真的写进去了");
  else no("资料库没有写对", JSON.stringify(afterReview));
  await page.screenshot({ path: `${OUT}/3-reviewed.png`, fullPage: true });

  // ── ③ 假的门牌 ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/b/00000000-0000-0000-0000-000000000000`, { waitUntil: "domcontentloaded", timeout: 180000 });
  body = await page.locator("body").innerText();
  if (/not in use/i.test(body)) ok("假的门牌：讲得出「这条连结不能用了」");
  else no("假的门牌没有讲清楚", body.slice(0, 200));

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
