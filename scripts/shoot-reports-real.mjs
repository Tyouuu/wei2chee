/**
 * 沙龙新设计的 Reports & Rankings（利润与产出报表）——从写死的 2024 年 10 月
 * 数字换成真的：收款、来访、师傅、客人。真登入、真截图。
 *
 * ── 为什么（2026-09-24，任务 412，十二页里的第十二页）──────────────────────
 *
 * 种一间小沙龙这个月的真资料，每个数字都事先算好、页面上核对：
 *
 *   收款  Gita 3 笔（400+300+300，她的抽成对象）· Priya 600（套票）·
 *         Eve 200 · Fay 100 · Ann 50 · Dina 150（会员月费）
 *         Ann 另有一笔 500 已经冲正（不该算） · 上个月同期 1,000（没有客人）
 *   → 本月 2,100.00 = 服务 1,350 + 会员 150 + 套票 600；对上月 +110.0%
 *
 *   来访  Jasmine：两次 Full Balayage 各 800，共 4 小时  → 400.00/hr
 *         Amy：三次 Precision Cut 各 140 + 一次 Blow Dry 60，共 4 小时 → 120.00/hr
 *         染膏 RM 28/支，每次 Balayage 用一支；洗发水没有进价，用在一次 Cut 上
 *   → Balayage 有配方成本 RM 28.00 / 利润率 96.5%；Cut 写「有产品没进价」；
 *     Blow Dry 写「没记产品」
 *
 * 再验：VIP 前 20%（6 人取 2 位）、搜索、只看前 5%、WhatsApp 连结只在有号码时
 * 出现、「查看档案」真的跳到那个人、导出两份 CSV、列印时侧栏消失、
 * 员工登入整页看不到钱。
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
const OUT = ".screenshots/reports-real";
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
let emptyId = null;
dropThrowawayOnExit(admin, () => userId);
dropThrowawayOnExit(admin, () => emptyId);

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

// ── 日期：马来西亚时间的今天，这个月 1 号，上个月 1 号 ─────────────────────
const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
const month = todayStr.slice(0, 7);
const [ty, tm] = todayStr.split("-").map(Number);
const prevMonthFirst = new Date(Date.UTC(ty, tm - 2, 1)).toISOString().slice(0, 10);
// 预约钉在「这个月 1 号 09:00 马来西亚时间」起，永远落在这个月里。
const at = (hoursFrom9) => new Date(`${month}-01T01:00:00Z`).getTime() + hoursFrom9 * 3_600_000;
const iso = (h) => new Date(at(h)).toISOString();

let browser;
try {
  const stamp = Date.now();
  const email = `rep-${stamp}@formae.test`;
  const password = `Re-${stamp}-x!`;
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

  for (const k of ["customers", "staff", "bookings", "payments", "inventory"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  // ── 师傅 ───────────────────────────────────────────────────────────────
  const jasmine = await must("jasmine", api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Rep-Test Jasmine",
  }));
  const amy = await must("amy", api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Rep-Test Amy",
  }));
  await admin.from("directory_entries").update({ status: "Senior Resident" }).eq("id", jasmine.id);
  await admin.from("directory_entries").update({ status: "Precision Lead" }).eq("id", amy.id);
  await must("tiers", api.rpc("set_commission_tiers", {
    in_party_id: jasmine.id, in_tiers: [{ from_cents: 0, percent: 10 }],
  }));

  // ── 客人 ───────────────────────────────────────────────────────────────
  const mk = (name, extra = {}) =>
    must(name, api.rpc("add_directory_entry", {
      in_project_id: pid, in_module_key: "customers", in_name: name, ...extra,
    }));
  const gita = await mk("Rep-Test Gita", { in_whatsapp: "60128829104" });
  const priya = await mk("Rep-Test Priya");
  const eve = await mk("Rep-Test Eve");
  const fay = await mk("Rep-Test Fay");
  const ann = await mk("Rep-Test Ann");
  const dina = await mk("Rep-Test Dina");

  // ── 收款 ───────────────────────────────────────────────────────────────
  const pay = (partyRow, cents, extra = {}) =>
    must("pay", api.rpc("add_ledger_entry", {
      in_project_id: pid, in_module_key: "payments", in_direction: "in",
      in_amount_cents: cents, in_party: partyRow.name, in_party_id: partyRow.id,
      in_category: "service", in_note: "Rep-Test", ...extra,
    }));
  for (const c of [40000, 30000, 30000]) await pay(gita, c, { in_done_by: jasmine.id });
  const priyaPay = await pay(priya, 60000, { in_category: "package" });
  await must("package", api.rpc("add_service_package", {
    in_party_id: priya.id, in_name: "Rep-Test Colour Course", in_sessions_total: 6, in_entry_id: priyaPay.id,
  }));
  await pay(eve, 20000);
  await pay(fay, 10000);
  await pay(ann, 5000);
  const annBad = await pay(ann, 50000);
  await must("reverse", api.rpc("reverse_ledger_entry", { in_entry_id: annBad.id, in_note: "Rep-Test reversal" }));
  const membership = await must("membership", api.rpc("add_membership", {
    in_project_id: pid, in_party_id: dina.id, in_plan_name: "Rep-Test VIP", in_monthly_fee_cents: 15000,
  }));
  await must("fee", api.rpc("collect_membership_fee", { in_membership_id: membership.id }));
  // 上个月同期一笔 1,000（没有客人，所以不进 VIP 榜）
  await must("last month", api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 100000, in_party: "Rep-Test Walk-in", in_entry_on: prevMonthFirst, in_category: "service",
  }));

  // ── 货：染膏有进价，洗发水没有 ─────────────────────────────────────────
  const tube = await must("tube", api.rpc("add_catalog_item", {
    in_project_id: pid, in_module_key: "inventory", in_name: "Rep-Test Colour 6/34", in_unit: "tube", in_cost_cents: 2800,
  }));
  const shampoo = await must("shampoo", api.rpc("add_catalog_item", {
    in_project_id: pid, in_module_key: "inventory", in_name: "Rep-Test Shampoo", in_unit: "bottle",
  }));
  await must("stock tube", api.rpc("move_stock", { in_item_id: tube.id, in_direction: "in", in_qty: 20, in_reason: "supplier" }));
  await must("stock shampoo", api.rpc("move_stock", { in_item_id: shampoo.id, in_direction: "in", in_qty: 20, in_reason: "supplier" }));

  // ── 来访 ───────────────────────────────────────────────────────────────
  async function visit({ client, staff, from, to, service, cents, use }) {
    const id = await must("appt", api.rpc("add_appointment", {
      in_project_id: pid, in_module_key: "bookings",
      in_starts_at: iso(from), in_ends_at: iso(to),
      in_party: client.name, in_party_id: client.id, in_staff_id: staff.id, in_service: service,
    }));
    await must("done", api.rpc("set_appointment_status", { in_id: id, in_status: "done" }));
    const line = await must("line", api.rpc("add_visit_line", {
      in_appointment_id: id, in_service: service, in_staff_id: staff.id, in_price_cents: cents,
    }));
    if (use) await must("use", api.rpc("add_visit_product", { in_line_id: line.id, in_item_id: use.id, in_qty: 1 }));
  }
  await visit({ client: gita, staff: jasmine, from: 0, to: 2, service: "Full Balayage", cents: 80000, use: tube });
  await visit({ client: priya, staff: jasmine, from: 2, to: 4, service: "Full Balayage", cents: 80000, use: tube });
  await visit({ client: eve, staff: amy, from: 0, to: 1, service: "Precision Cut", cents: 14000, use: shampoo });
  await visit({ client: fay, staff: amy, from: 1, to: 2, service: "Precision Cut", cents: 14000 });
  await visit({ client: ann, staff: amy, from: 2, to: 3, service: "Precision Cut", cents: 14000 });
  await visit({ client: eve, staff: amy, from: 3, to: 4, service: "Blow Dry", cents: 6000 });

  // Jasmine 这个月打过一个 8 小时的班（用来验「用了多少」那一句）
  await must("shift", Promise.resolve(admin.from("staff_shifts").insert({
    project_id: pid, staff_id: jasmine.id,
    clock_in_at: `${month}-01T00:00:00Z`, clock_out_at: `${month}-01T08:00:00Z`,
  })));

  // ── 打开浏览器 ─────────────────────────────────────────────────────────
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 1300 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/salon-preview/reports`, { waitUntil: "networkidle", timeout: 180000 });
  const body = await page.locator("body").innerText();

  console.log("\n① 写死的样本不见了");
  check("没有 Bangsar 那些写死的名字", !/Datin Nora|Amanda Choong|Rachel Soo|Signature Balayage & Olaplex|Kérastase/.test(body));
  check("没有写死的 RM 48,250", !/48,250|35,126|33,003/.test(body));

  console.log("\n② 利润品质那一块");
  check("🔴 本月收款 RM 2,100.00（冲正的 500 没有算）", (await page.getByTestId("gross-takings").innerText()).includes("RM 2,100.00"),
    await page.getByTestId("gross-takings").innerText());
  check("🔴 对上个月同期 +110.0%", /\+110\.0% vs same days last month/.test(await page.getByTestId("mom-pill").innerText()),
    await page.getByTestId("mom-pill").innerText());
  check("服务与柜台 RM 1,350.00 · 64.3%", /Services & counter sales[\s\S]{0,60}64\.3%/i.test(body) && /RM 1,350\.00/.test(body));
  check("会员 RM 150.00 · 7.1%", /Memberships[\s\S]{0,60}7\.1%/i.test(body) && /RM 150\.00/.test(body));
  check("套票 RM 600.00 · 28.6%", /Prepaid packages[\s\S]{0,60}28\.6%/i.test(body) && /RM 600\.00/.test(body));
  check("🔴 用料成本 RM 56.00（两支染膏 × RM 28），不是编的", /RM 56\.00/.test(body));
  check("🔴 没有编出来的净利率 72.8% / 84% / 46% / 91%", !/72\.8%|84% Net|46% Net|91%/.test(body));

  console.log("\n③ 服务排行");
  const drivers = page.getByTestId("driver-row");
  check("三项服务", (await drivers.count()) === 3, String(await drivers.count()));
  const d1 = await drivers.nth(0).innerText();
  check("🔴 第一名 Full Balayage · RM 1,600.00 · 2 次 · 均价 RM 800.00", /Full Balayage/.test(d1) && /RM 1,600\.00/.test(d1) && /2 services/.test(d1) && /RM 800\.00 avg/.test(d1), d1);
  check("🔴 有进价的那一项算出配方成本 RM 28.00、利润率 96.5%", /RM 28\.00[\s\S]*\/ session/.test(d1) && /96\.5%/.test(d1), d1);
  const d2 = await drivers.nth(1).innerText();
  check("Precision Cut：有产品没进价，就直说，不给利润率", /Precision Cut/.test(d2) && /no cost price yet/.test(d2) && !/Net margin/.test(d2), d2);
  const d3 = await drivers.nth(2).innerText();
  check("Blow Dry：没记产品，就直说", /Blow Dry/.test(d3) && /No products logged/.test(d3), d3);

  console.log("\n④ 师傅产出");
  const stylists = page.getByTestId("stylist-row");
  check("两位师傅", (await stylists.count()) === 2, String(await stylists.count()));
  const s1 = await stylists.nth(0).innerText();
  check("🔴 Jasmine 排第一：RM 1,600.00 · 4.0 hrs · RM 400.00/hr · Top Producer", /Jasmine/.test(s1) && /RM 1,600\.00/.test(s1) && /4\.0 hrs/.test(s1) && /RM 400\.00/.test(s1) && /Top Producer/.test(s1), s1);
  check("🔴 打了 8 小时卡，就算得出 50% 使用率", /50% of 8 clocked/.test(s1), s1);
  check("🔴 抽成 RM 100.00（Gita 那 1,000 的 10%）", /RM 100\.00/.test(s1), s1);
  const s2 = await stylists.nth(1).innerText();
  check("🔴 Amy：RM 480.00 · 4.0 hrs · RM 120.00/hr，没有打卡就不编使用率", /Amy/.test(s2) && /RM 480\.00/.test(s2) && /RM 120\.00/.test(s2) && !/clocked/.test(s2), s2);
  check("🔴 全店均值 RM 260.00/hr（2,080 ÷ 8）", /Avg RM 260\.00\/hr/.test(body));
  check("没有编出来的 Capacity Slack / 75% 目标", !/Capacity Slack|75% booked|Balanced/.test(body));

  console.log("\n⑤ VIP 前 20%");
  const cards = page.getByTestId("vip-card");
  check("🔴 6 位付过钱的客人取前 20% = 2 位", (await cards.count()) === 2, String(await cards.count()));
  const c1 = await cards.nth(0).innerText();
  check("🔴 第一名 Gita · RM 1,000.00 · Top 5% · 偏好师傅 Jasmine", /Gita/.test(c1) && /RM 1,000\.00/.test(c1) && /Top 5%/i.test(c1) && /Jasmine/.test(c1), c1);
  check("拿得到 WhatsApp 的客人才画那颗按钮", /WhatsApp Care/.test(c1));
  const wa = await cards.nth(0).locator("a", { hasText: "WhatsApp Care" }).getAttribute("href");
  check("🔴 WhatsApp 连结真的指向她的号码", wa === "https://wa.me/60128829104", String(wa));
  const c2 = await cards.nth(1).innerText();
  check("第二名 Priya · RM 600.00 · 没号码就老实写没号码", /Priya/.test(c2) && /RM 600\.00/.test(c2) && /No WhatsApp number/.test(c2) && !/WhatsApp Care/.test(c2), c2);
  check("Cadence 是真的天数", /\d+ days? ago|Today/.test(c1), c1);
  check("🔴 前 20% 占 76.2%（1,600 ÷ 2,100）", /76\.2% Revenue Share/.test(await page.getByTestId("vip-share").innerText()), await page.getByTestId("vip-share").innerText());
  check("切线是第 2 名的 RM 600.00", /threshold cut-off: RM 600\.00/.test(body));
  check("导出按钮写对总人数（6）", /Export Full 6 Client Census/.test(body));
  check("侧栏：Reports & Rankings 亮着，Memberships 也是真连结（任务 413 之后）",
    (await page.locator("aside a", { hasText: "Reports & Rankings" }).count()) === 1
      && (await page.locator("aside a", { hasText: "Memberships" }).count()) === 1);

  await page.screenshot({ path: `${OUT}/1-full.png`, fullPage: true });

  console.log("\n⑥ 搜索 / 筛选");
  await page.getByLabel("Search VIP clients").fill("priya");
  check("搜「priya」只剩 1 张", (await page.getByTestId("vip-card").count()) === 1);
  await page.getByLabel("Search VIP clients").fill("");
  await page.getByLabel("Filter tier").selectOption("Top 5%");
  check("只看前 5% 只剩 Gita", (await page.getByTestId("vip-card").count()) === 1 && /Gita/.test(await page.getByTestId("vip-card").first().innerText()));
  await page.getByLabel("Filter tier").selectOption("all");
  await page.getByLabel("Search VIP clients").fill("zzzz");
  check("搜不到时讲一句，不是空白", /No VIP client matches/.test(await page.locator("body").innerText()));
  await page.getByLabel("Search VIP clients").fill("");

  console.log("\n⑦ 导出");
  const [dl1] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export Statement" }).click()]);
  const path1 = await dl1.path();
  const csv1 = readFileSync(path1, "utf8");
  check("🔴 对帐单 CSV：含总收款 2100.00、三块占比、两位师傅", /Gross takings \(RM\)","2100\.00/.test(csv1) && /Services & counter sales","1350\.00","64\.3/.test(csv1) && /Rep-Test Jasmine/.test(csv1) && /Full Balayage","2","1600\.00","800\.00/.test(csv1), csv1.slice(0, 400));
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Export Full 6 Client Census/ }).click()]);
  const csv2 = readFileSync(await dl2.path(), "utf8");
  check("🔴 客人全名单 CSV：6 位加表头，冲正的 500 不在 Ann 身上（50.00）", csv2.trim().split("\n").length === 7 && /Rep-Test Ann","[^"]*","1","1","50\.00"/.test(csv2), csv2);

  console.log("\n⑧ 列印：侧栏跟按钮不印，报表本体照印");
  await page.emulateMedia({ media: "print" });
  const asideVisible = await page.locator("aside").first().isVisible();
  const printBtnVisible = await page.getByRole("button", { name: "Print Audit" }).isVisible();
  const mainVisible = await page.getByText("Profit Quality Barometer").isVisible();
  check("🔴 列印时侧栏不见了", !asideVisible);
  check("列印时按钮不见了", !printBtnVisible);
  check("列印时报表本体还在", mainVisible);
  await page.emulateMedia({ media: "screen" });

  console.log("\n⑨ 「查看档案」真的跳到那个人");
  await page.getByLabel("View Rep-Test Priya's profile").click();
  await page.waitForURL(/salon-preview\/clients\?client=/, { timeout: 60000 });
  await page.waitForLoadState("networkidle");
  const h2 = await page.locator("h2", { hasText: "Rep-Test Priya" }).count();
  check("🔴 客户页第一个选中的是 Priya（不是名单排第一的人）", h2 >= 1 && /client=/.test(page.url()), page.url());
  await page.screenshot({ path: `${OUT}/2-profile-jump.png` });

  console.log("\n⑩ 员工登入：整页看不到钱");
  const staffEmail = `rep-staff-${stamp}@formae.test`;
  const staffPassword = `Rs-${stamp}-x!`;
  const { data: staffUser, error: staffMkErr } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  });
  if (staffMkErr) throw new Error(`createUser staff: ${staffMkErr.message}`);
  await must("member", api.rpc("add_project_member", { in_email: staffEmail }));
  const staffPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await staffPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await staffPage.fill('input[type="email"]', staffEmail);
  await staffPage.fill('input[type="password"]', staffPassword);
  await staffPage.click('button[type="submit"]');
  await staffPage.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await staffPage.goto(`${BASE}/en/salon-preview/reports`, { waitUntil: "networkidle", timeout: 180000 });
  const staffBody = await staffPage.locator("body").innerText();
  check("🔴 员工只看到「只有老板看得到」，一个数字都没有", /only visible to the business owner/.test(staffBody) && !/2,100\.00|Rep-Test Gita|Jasmine/.test(staffBody));
  admin.auth.admin.deleteUser(staffUser.user.id).catch(() => {});

  console.log("\n⑪ 一间什么资料都没有的新店：每一块都讲清楚，不是空白也不是 NaN");
  const emptyEmail = `rep-empty-${stamp}@formae.test`;
  const emptyPassword = `Rx-${stamp}-x!`;
  const { data: emptyUser, error: emptyMkErr } = await admin.auth.admin.createUser({
    email: emptyEmail, password: emptyPassword, email_confirm: true,
  });
  if (emptyMkErr) throw new Error(`createUser empty: ${emptyMkErr.message}`);
  emptyId = emptyUser.user.id;
  const emptyPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await emptyPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await emptyPage.fill('input[type="email"]', emptyEmail);
  await emptyPage.fill('input[type="password"]', emptyPassword);
  await emptyPage.click('button[type="submit"]');
  await emptyPage.waitForURL(/portal/, { timeout: 180000 });
  await emptyPage.goto(`${BASE}/en/salon-preview/reports`, { waitUntil: "networkidle", timeout: 180000 });
  const emptyBody = await emptyPage.locator("body").innerText();
  check("总收款 RM 0.00，不是 NaN", (await emptyPage.getByTestId("gross-takings").innerText()).includes("RM 0.00") && !/NaN|undefined|Infinity/.test(emptyBody));
  check("没有上月可比时讲一句", /Nothing to compare with last month yet/.test(emptyBody));
  check("没有付款时讲一句", /No payments recorded this month yet/.test(emptyBody));
  check("没有服务时讲一句", (await emptyPage.getByTestId("drivers-empty").count()) === 1);
  check("没有师傅来访时讲一句", (await emptyPage.getByTestId("stylists-empty").count()) === 1);
  check("没有客人付过钱时讲一句，而且没有搜索框", (await emptyPage.getByTestId("vip-empty").count()) === 1 && (await emptyPage.getByLabel("Search VIP clients").count()) === 0);
  await emptyPage.screenshot({ path: `${OUT}/3-empty.png`, fullPage: true });
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
  if (emptyId) await dropThrowaway(admin, emptyId);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
