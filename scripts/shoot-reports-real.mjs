/**
 * 沙龙新设计的 Reports & Rankings（利润与产出报表）——简化版（2026-10，
 * founder-tasks 任务426 简化案，砍法顺序第 3 件）。真登入、真截图。
 *
 * ── 为什么砍（任务 412 原版 → 任务 426 简化版）─────────────────────────────
 *
 * 老板亲口要的：不要再做到「跟大厂看齐」的复杂度，要大家一上手就会用。
 * 照 重点34（他自己手写簿上会不会有这一格）判，原版三块被砍：
 *
 *   - VIP Pareto 卡（5%/20% 分级 · 来访周期 · 偏好师傅 · 搜索筛选 · 客人
 *     名单导出）—— 一个小沙龙老板自己就认得熟客，没有人会在本子上排
 *     Pareto 名次
 *   - 每个服务的配方成本/利润率 —— 只有记过用料又填了进价才算得出来，
 *     大多数店从来不填，大多数行只会写「没有利润率」，纯噪音
 *   - 师傅使用率%（订位时长 / 打卡时长）、每小时产值 —— 给二十张椅子配
 *     楼面经理的店才有用，三五个人的店老板自己就知道谁忙谁闲
 *
 * 留下来的：本月收款对比上个月同期（一个大数字 + 一句百分比），
 * 「卖得最好的服务」排行，「谁做的最多」排行 —— 小沙龙老板真正会问的
 * 两句话。
 *
 * 后端一个字都没动：service_performance · visit_earnings · staff_earnings ·
 * hours_worked_of · party_value · party_visits · 用料成本那一整套都还在跑，
 * 这一页只是不再读、不再画它们。
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
  await must("tiers", api.rpc("set_commission_tiers", {
    in_party_id: jasmine.id, in_tiers: [{ from_cents: 0, percent: 10 }],
  }));

  // ── 客人 ───────────────────────────────────────────────────────────────
  const mk = (name, extra = {}) =>
    must(name, api.rpc("add_directory_entry", {
      in_project_id: pid, in_module_key: "customers", in_name: name, ...extra,
    }));
  const gita = await mk("Rep-Test Gita");
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
  // 上个月同期一笔 1,000（没有客人，所以不进本月的数）
  await must("last month", api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 100000, in_party: "Rep-Test Walk-in", in_entry_on: prevMonthFirst, in_category: "service",
  }));

  // ── 来访（配方成本/用料那一套不再量，但照样种一笔，证明没有废掉它） ──────
  const tube = await must("tube", api.rpc("add_catalog_item", {
    in_project_id: pid, in_module_key: "inventory", in_name: "Rep-Test Colour 6/34", in_unit: "tube", in_cost_cents: 2800,
  }));
  await must("stock tube", api.rpc("move_stock", { in_item_id: tube.id, in_direction: "in", in_qty: 20, in_reason: "supplier" }));

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
  await visit({ client: eve, staff: amy, from: 0, to: 1, service: "Precision Cut", cents: 14000 });
  await visit({ client: fay, staff: amy, from: 1, to: 2, service: "Precision Cut", cents: 14000 });
  await visit({ client: ann, staff: amy, from: 2, to: 3, service: "Precision Cut", cents: 14000 });
  await visit({ client: eve, staff: amy, from: 3, to: 4, service: "Blow Dry", cents: 6000 });

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

  console.log("\n② 本月收款（简化：只剩大数字 + 对比，没有三块拆分）");
  check("🔴 本月收款 RM 2,100.00（冲正的 500 没有算）", (await page.getByTestId("gross-takings").innerText()).includes("RM 2,100.00"),
    await page.getByTestId("gross-takings").innerText());
  check("🔴 对上个月同期 +110.0%", /\+110\.0% vs same days last month/.test(await page.getByTestId("mom-pill").innerText()),
    await page.getByTestId("mom-pill").innerText());
  check("🔴 三块拆分（Services/Memberships/Prepaid）砍掉了，画面上没有这几个标签", !/Services & counter sales|Prepaid packages/.test(body));
  check("🔴 没有编出来的净利率，也没有用料成本那一行了（整块砍掉）", !/72\.8%|84% Net|46% Net|91%|Consumables used/.test(body));

  console.log("\n③ 服务排行（简化：没有配方成本/利润率）");
  const drivers = page.getByTestId("driver-row");
  check("三项服务", (await drivers.count()) === 3, String(await drivers.count()));
  const d1 = await drivers.nth(0).innerText();
  check("🔴 第一名 Full Balayage · RM 1,600.00 · 2 次 · 均价 RM 800.00", /Full Balayage/.test(d1) && /RM 1,600\.00/.test(d1) && /2 services/.test(d1) && /RM 800\.00 avg/.test(d1), d1);
  check("🔴 没有配方成本/利润率这两行了（就算这项有记用料跟进价）", !/Formula cost|Net margin/.test(d1), d1);
  const d2 = await drivers.nth(1).innerText();
  check("Precision Cut 在第二名，没有「没有进价」那一句了（整句砍掉）", /Precision Cut/.test(d2) && !/no cost price yet|Net margin/.test(d2), d2);
  const d3 = await drivers.nth(2).innerText();
  check("Blow Dry 在第三名，没有「没记产品」那一句了", /Blow Dry/.test(d3) && !/No products logged/.test(d3), d3);

  console.log("\n④ 师傅产出（简化：没有使用率/每小时产值/Top Producer）");
  const stylists = page.getByTestId("stylist-row");
  check("两位师傅", (await stylists.count()) === 2, String(await stylists.count()));
  const s1 = await stylists.nth(0).innerText();
  check("🔴 Jasmine 排第一：RM 1,600.00 · 抽成 RM 100.00（Gita 那 1,000 的 10%）", /Jasmine/.test(s1) && /RM 1,600\.00/.test(s1) && /RM 100\.00/.test(s1), s1);
  check("🔴 没有打卡使用率、没有每小时产值、没有 Top Producer 这几件", !/clocked|\/hr|Top Producer/.test(s1), s1);
  const s2 = await stylists.nth(1).innerText();
  check("Amy：RM 480.00，没有佣金就是「—」", /Amy/.test(s2) && /RM 480\.00/.test(s2) && /—/.test(s2), s2);
  check("没有编出来的 Capacity Slack / 75% 目标 / 全店均值 RM/hr", !/Capacity Slack|75% booked|Balanced|Avg RM.*\/hr/.test(body));

  console.log("\n⑤ VIP Pareto 整块砍掉了");
  check("🔴 画面上没有 VIP Pareto 卡（没有 Pareto、没有 Top 5%/Top 20% 分级）", !/Pareto|Top 5%|Top 20%/.test(body));
  check("🔴 没有客人名单导出按钮了", (await page.getByRole("button", { name: /Export Full.*Client Census/ }).count()) === 0);
  check("🔴 没有 VIP 搜索框了", (await page.getByLabel("Search VIP clients").count()) === 0);
  check("侧栏：Reports & Rankings 亮着，套票会员那一行是真连结（任务 413 · 419 之后）",
    (await page.locator("aside a", { hasText: "Reports & Rankings" }).count()) === 1
      && (await page.locator("aside a", { hasText: "Packages & Plans" }).count()) === 1);

  await page.screenshot({ path: `${OUT}/1-full.png`, fullPage: true });

  console.log("\n⑥ 导出（简化版：只剩总收款 + 两份排行，没有三块拆分、没有客人名单）");
  const [dl1] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export Statement" }).click()]);
  const path1 = await dl1.path();
  const csv1 = readFileSync(path1, "utf8");
  check("🔴 对帐单 CSV：含总收款 2100.00、两位师傅、没有三块拆分那几行", /Gross takings \(RM\)","2100\.00/.test(csv1) && /Rep-Test Jasmine/.test(csv1) && /Full Balayage","2","1600\.00","800\.00/.test(csv1) && !/Services & counter sales/.test(csv1), csv1.slice(0, 400));

  console.log("\n⑦ 列印：侧栏跟按钮不印，报表本体照印");
  await page.emulateMedia({ media: "print" });
  const asideVisible = await page.locator("aside").first().isVisible();
  const printBtnVisible = await page.getByRole("button", { name: "Print Audit" }).isVisible();
  const mainVisible = await page.getByText("This Month's Takings").isVisible();
  check("🔴 列印时侧栏不见了", !asideVisible);
  check("列印时按钮不见了", !printBtnVisible);
  check("列印时报表本体还在", mainVisible);
  await page.emulateMedia({ media: "screen" });

  console.log("\n⑧ 员工登入：整页看不到钱");
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

  console.log("\n⑨ 一间什么资料都没有的新店：每一块都讲清楚，不是空白也不是 NaN");
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
  check("没有服务时讲一句", (await emptyPage.getByTestId("drivers-empty").count()) === 1);
  check("没有师傅来访时讲一句", (await emptyPage.getByTestId("stylists-empty").count()) === 1);
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
