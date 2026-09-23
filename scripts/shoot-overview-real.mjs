/**
 * 沙龙新设计的 Overview——第一页从示范假资料换成真的资料。真登入、真截图。
 *
 * ── 为什么（2026-09-24，老板拍板：今早那套新设计要取代旧的那一套）───────────
 *
 * 这一支种一批真资料（客户 · 师傅 · 今天的预约 · 今天的收款 · 一件低于
 * 补货线的库存），真登入之后打开新设计那一页，验证画面上印的每一个数字
 * 都是真的算出来的，不是他当初给的示范样品数字。
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
const OUT = ".screenshots/overview-real";
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
  const email = `ov-${stamp}@formae.test`;
  const password = `Ov-${stamp}-x!`;
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

  // 真的取一个跟示范样品明显不同的名字，才知道画面读的是真名字不是巧合。
  const businessName = `Sunrise Beauty Bar ${stamp}`;
  const { error: nameErr } = await admin
    .from("projects").update({ business_name: businessName }).eq("id", pid);
  if (nameErr) console.log("  (name column may differ, continuing)", nameErr.message);

  for (const k of ["customers", "bookings", "staff"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  const amy = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Amy Overview-Test",
  });
  if (amy.error) throw new Error(`staff: ${amy.error.message}`);
  const jas = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Jasmine Overview-Test",
  });
  if (jas.error) throw new Error(`staff2: ${jas.error.message}`);

  const guestA = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Guest Aina",
  });
  const guestB = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Guest Bakri",
  });

  // 今天两笔预约：一笔已经到了（Amy），一笔还没到（Jasmine）。
  const soon = new Date(Date.now() + 3600e3).toISOString();
  const soonEnd = new Date(Date.now() + 2 * 3600e3).toISOString();
  const laterStart = new Date(Date.now() + 4 * 3600e3).toISOString();
  const laterEnd = new Date(Date.now() + 5 * 3600e3).toISOString();

  const apptA = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: soon, in_ends_at: soonEnd,
    in_party: "Guest Aina", in_party_id: guestA.data.id, in_service: "Signature Facial",
    in_staff_id: amy.data.id,
  });
  if (apptA.error) throw new Error(`appt A: ${apptA.error.message}`);
  await admin.from("appointments").update({ arrived_at: new Date().toISOString() }).eq("id", apptA.data);

  const apptB = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: laterStart, in_ends_at: laterEnd,
    in_party: "Guest Bakri", in_party_id: guestB.data.id, in_service: "Balayage",
    in_staff_id: jas.data.id,
  });
  if (apptB.error) throw new Error(`appt B: ${apptB.error.message}`);

  // 今天一笔真的收款，指定付款方式，好验证 payment-split 那一块。
  const pay = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 18800, in_party: "Guest Aina", in_party_id: guestA.data.id,
    in_category: "service", in_note: "Signature Facial",
  });
  if (pay.error) throw new Error(`ledger: ${pay.error.message}`);
  await admin.from("ledger_entries").update({ method: "DuitNow QR" }).eq("id", pay.data.id);

  // 一件低于补货线的库存。库存模组内部叫 "inventory"，不是页面显示的 "stock"。
  await api.rpc("add_project_page", { requested_key: "inventory", new_title: "" });
  const item = await api.rpc("add_catalog_item", {
    in_project_id: pid, in_module_key: "inventory",
    in_name: "Overview-Test Bleach Powder", in_unit: "tub",
  });
  if (item.error) throw new Error(`catalog item: ${item.error.message}`);
  await admin.from("catalog_items").update({ reorder_at: 3 }).eq("id", item.data.id);
  await api.rpc("count_stock", { in_item_id: item.data.id, in_counted: 1, in_reason: "seed" });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/salon-preview/overview`, {
    waitUntil: "networkidle", timeout: 180000,
  });

  const body = await page.locator("body").innerText();

  if (!/Wei Hair Studio/.test(body)) ok("侧栏跟抬头不再写死 Wei Hair Studio");
  else no("还印着示范样品的店名 Wei Hair Studio");

  if (body.includes(businessName)) ok("🔴 侧栏 + 抬头讲得出真的店名");
  else no("店名不对", body.slice(0, 200));

  if (/2 Guests/.test(body)) ok("🔴 今日客流：真的 2 位客人");
  else no("客流数字不对", body.match(/\d+ Guests?/)?.[0]);

  if (/1 Upcoming · 1 Arrived · 0 Completed/.test(body))
    ok("🔴 讲得出 1 笔还没到、1 笔已到、0 笔完成");
  else no("客流细节不对", body.slice(0, 600));

  if (/2 of 2 Stylists Booked|100%/.test(body)) ok("🔴 技师负荷：2 位师傅都真的有预约");
  else no("技师负荷不对", body.slice(0, 600));

  if (/RM\s*188(\.00)?\b/.test(body)) ok("🔴 今日实收：真的 RM 188（不是示范样品的 RM 2,480）");
  else no("今日实收不对", body.match(/RM[\d,.\s]+/g)?.join(" | "));

  if (/1 Receipt Settled Today/.test(body)) ok("🔴 讲得出今天 1 张收据");
  else no("收据张数不对");

  if (/DuitNow QR/.test(body)) ok("🔴 付款方式真的读到 DuitNow QR，不是猜的 QR/Card/Cash");
  else no("付款方式没读到");

  if (/Overview-Test Bleach Powder/.test(body) && /1 left/.test(body))
    ok("🔴 低库存卡真的讲出那件货、真的剩 1");
  else no("低库存不对", body.slice(0, 800));

  if (/Amy Overview-Test/.test(body) && /Jasmine Overview-Test/.test(body))
    ok("🔴 师傅榜单是真的两位师傅，不是示范样品的 Amy Chen/Jasmine Teo 那四位");
  else no("师傅榜单不对");

  if (/Senior|Master|Creative|Associate/.test(body)) no("还留着编出来的师傅 tier 字样");
  else ok("发明的师傅 tier 标签真的拿掉了");

  if (/Guest Bakri/.test(body) && /Balayage/.test(body)) ok("🔴 排程列表讲得出还没到的那一笔（真的客人跟服务）");
  else no("排程列表不对");

  if (/Guest Aina/.test(body) && /Signature Facial/.test(body)) ok("🔴 已经到的那一笔也留在排程里，不是被过滤掉了");
  else no("已到的那一笔从排程消失了");

  if (/Arrived/.test(body)) ok("🔴 Aina 那一笔真的显示 Arrived（用的是真的 arrived_at）");
  else no("到达状态没有显示");

  if (!/WA Confirmed|On Route|Walk-in Request|Drawer Balanced/.test(body))
    ok("发明的 WhatsApp 标签、Drawer Balanced 都真的拿掉了");
  else no("还留着编出来的 WhatsApp/抽屉字样");

  await page.screenshot({ path: `${OUT}/1-real-data.png`, fullPage: true });

  // 点一下排程那一列的 Open，确认它是一条真的连结（不是死按钮）。
  // exact:true——不加的话会先配到「Open Schedule Grid」那个标题按钮。
  const openLink = page.getByRole("link", { name: "Open", exact: true }).first();
  const href = await openLink.getAttribute("href");
  if (href && href.includes(`/portal/bookings/`)) ok("🔴 「Open」是真的连到那一笔预约的记录页，不是死链接");
  else no("Open 连结不对", href ?? "null");

} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那张图`);
