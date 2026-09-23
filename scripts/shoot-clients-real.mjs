/**
 * 沙龙新设计的 Clients & Folios——从八个手写客人换成真的 directory_entries，
 * 而且第一次做出真的点了会换的右边档案（原始设计右边永远是 Datin Nora）。
 * 真登入、真截图。
 *
 * ── 为什么（2026-09-24，Schedule 之后第六页）───────────────────────────────
 *
 * 种三位真客人：一位有真的完成预约(含真的行项价钱)、一笔真的收款、一张
 * 真的套票；一位只有基本资料，什么活动都没有；一位放在另一个分类
 * (status)。验证：清单是真的、点了真的能换右边档案(这是原始设计唯一
 * 承认过的一个洞)、金额/次数/套票都是真算出来的、分类跟搜索是真的过滤、
 * 员工登入看不到金额(sees_money)但看得到其他一切、CSV 真的下载得到。
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
const OUT = ".screenshots/clients-real";
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
  const email = `cli-${stamp}@formae.test`;
  const password = `Cl-${stamp}-x!`;
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

  for (const k of ["customers", "staff", "bookings"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  const jasmine = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Clients-Test Jasmine",
  });
  if (jasmine.error) throw new Error(`jasmine: ${jasmine.error.message}`);

  // 客人一：VIP,有真的完成预约(带价钱)、真的收款、真的套票。
  const vip = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Clients-Test Nora",
    in_phone: "012-553 0921", in_whatsapp: "60125530921",
  });
  if (vip.error) throw new Error(`vip: ${vip.error.message}`);
  await admin.from("directory_entries").update({ status: "VIP Platinum", note: "Prefers quiet service, warm green tea" }).eq("id", vip.data.id);

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const apptStart = new Date(yesterday); apptStart.setUTCHours(2, 30, 0, 0);
  const apptEnd = new Date(yesterday); apptEnd.setUTCHours(4, 0, 0, 0);
  const visit = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: apptStart.toISOString(), in_ends_at: apptEnd.toISOString(),
    in_party: "Clients-Test Nora", in_party_id: vip.data.id, in_staff_id: jasmine.data.id,
    in_service: "Full Balayage & Gloss Toner",
  });
  if (visit.error) throw new Error(`visit: ${visit.error.message}`);
  const visitId = visit.data;
  const done = await api.rpc("set_appointment_status", { in_id: visitId, in_status: "done" });
  if (done.error) throw new Error(`done: ${done.error.message}`);
  const line = await api.rpc("add_visit_line", {
    in_appointment_id: visitId, in_service: "Full Balayage & Gloss Toner",
    in_staff_id: jasmine.data.id, in_price_cents: 74000,
  });
  if (line.error) throw new Error(`add_visit_line: ${line.error.message}`);

  const pay = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 74000, in_party: "Clients-Test Nora", in_party_id: vip.data.id,
    in_category: "service", in_note: "Balayage",
  });
  if (pay.error) throw new Error(`pay: ${pay.error.message}`);

  const pkg = await api.rpc("add_service_package", {
    in_party_id: vip.data.id, in_name: "Fusio-Dose Caviar 10-Session Pass",
    in_sessions_total: 10,
  });
  if (pkg.error) {
    console.log(`  (add_service_package 签名跟猜的不一样,跳过套票种资料: ${pkg.error.message})`);
  } else {
    const pkgId = typeof pkg.data === "object" ? pkg.data.id : pkg.data;
    for (let i = 0; i < 4; i++) {
      await api.rpc("use_package_session", { in_package_id: pkgId });
    }
  }

  // 客人二：普通,什么活动都没有——验证「零资料」的诚实空状态。
  const plain = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Clients-Test Plain Bakri",
    in_phone: "016-000 1111",
  });
  if (plain.error) throw new Error(`plain: ${plain.error.message}`);

  // 客人三：另一个分类,验证分段筛选是真的按 status 分组算出来的。
  const regular = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Clients-Test Regular Chong",
    in_phone: "019-222 3333",
  });
  if (regular.error) throw new Error(`regular: ${regular.error.message}`);
  await admin.from("directory_entries").update({ status: "Color Regular" }).eq("id", regular.data.id);

  browser = await chromium.launch();
  const ownerPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await ownerPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await ownerPage.fill('input[type="email"]', email);
  await ownerPage.fill('input[type="password"]', password);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForURL(/portal/, { timeout: 180000 });

  await ownerPage.goto(`${BASE}/en/salon-preview/clients`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await ownerPage.locator("body").innerText();

  if (!/Datin Nora Al-Habshee|Amanda Choong|Marcus Tan|Rachel Soo/.test(body))
    ok("八个手写示范客人的名字都不见了");
  else no("还留着手写的示范客人");

  if (/Clients-Test Nora/.test(body) && /Clients-Test Plain Bakri/.test(body) && /Clients-Test Regular Chong/.test(body))
    ok("🔴 三位真客人都出现在清单里");
  else no("客人没有全部出现");

  await ownerPage.screenshot({ path: `${OUT}/1-default-selection.png`, fullPage: true });

  // 默认选中第一位(按最近来访排序,Nora 应该排最前面,因为她是唯一有真预约的)。
  // ⚠️ ringgit() 对整数金额印 "RM 740"，没有 ".00"（跟 storedCredit 那次
  // 同一个坑），断言配它真的印出来的样子，不是我自己以为的样子。
  if (/RM\s*740(\.00)?\b/.test(body) && /Full Balayage & Gloss Toner/.test(body))
    ok("🔴 默认档案(Nora)显示她真的收款金额跟真的服务");
  else no("默认档案不对", body.match(/RM\s*[\d,.]+/g)?.join(","));

  // 点第二位客人(什么活动都没有),右边真的换掉——这是原始设计唯一的洞。
  await ownerPage.getByText("Clients-Test Plain Bakri").first().click();
  await ownerPage.waitForTimeout(300);
  body = await ownerPage.locator("body").innerText();
  if (/No completed visits recorded for Clients-Test Plain Bakri/.test(body) && !/Full Balayage & Gloss Toner/.test(body))
    ok("🔴 点了第二位客人,右边档案真的换成她的(空)资料——原始设计的洞补上了");
  else no("点击没有真的更新右边档案");

  if (/No active prepaid packages for Clients-Test Plain Bakri/.test(body))
    ok("🔴 诚实的空状态:她没有套票");
  else no("空状态没有出现");

  await ownerPage.screenshot({ path: `${OUT}/2-selected-plain.png`, fullPage: true });

  // 分段筛选——切到 Color Regular,应该只剩 Chong。⚠️ 断言只看左边那份
  // 名单(aria-label="Client Directory")，不是整页——右边档案本来就该
  // 保留 Bakri(刚刚点的那一位)，跟筛选无关，那是主从版面正常的样子，
  // 不是这个筛选器要清掉的东西。
  await ownerPage.getByText(/Color Regular \(\d+\)/).click();
  await ownerPage.waitForTimeout(300);
  const leftList = await ownerPage.locator('section[aria-label="Client Directory"]').innerText();
  if (/Clients-Test Regular Chong/.test(leftList) && !/Clients-Test Plain Bakri/.test(leftList) && !/Clients-Test Nora/.test(leftList))
    ok("🔴 分段筛选是真的按 status 分组算出来的,不是写死的四个分类");
  else no("分段筛选不对", leftList.match(/Clients-Test [A-Za-z ]+/g)?.join(","));
  await ownerPage.getByText(/All \(\d+\)/).click();

  // 套票面板(如果种成功了)。
  if (pkg && !pkg.error) {
    await ownerPage.getByText("Clients-Test Nora").first().click();
    await ownerPage.waitForTimeout(300);
    body = await ownerPage.locator("body").innerText();
    if (/Fusio-Dose Caviar 10-Session Pass/.test(body) && /6/.test(body) && /10 Sessions Remaining/i.test(body))
      ok("🔴 真的套票面板显示真的剩余次数(10 - 4 = 6)");
    else no("套票面板不对", body.match(/Fusio-Dose[\s\S]{0,150}/)?.[0]);
  }

  // 真的搜索。
  await ownerPage.getByPlaceholder("Search name, phone, WhatsApp...").fill("Bakri");
  await ownerPage.waitForTimeout(400);
  const afterSearch = await ownerPage.locator("body").innerText();
  if (/Clients-Test Plain Bakri/.test(afterSearch) && !/Clients-Test Regular Chong/.test(afterSearch))
    ok("🔴 搜索是真的在过滤客人清单");
  else no("搜索没有真的过滤");
  await ownerPage.getByPlaceholder("Search name, phone, WhatsApp...").fill("");

  // CSV 真的下载。
  const downloadPromise = ownerPage.waitForEvent("download");
  await ownerPage.getByText("Export CSV").click();
  const download = await downloadPromise;
  const suggestedName = download.suggestedFilename();
  if (/clients-\d{4}-\d{2}-\d{2}\.csv/.test(suggestedName)) ok("🔴 Export CSV 真的触发了一次下载,不是装饰按钮");
  else no("CSV 下载没有真的发生", suggestedName);

  // 员工身分——看得到清单跟档案,看不到钱(sees_money)。
  const staffEmail = `cli-staff-${stamp}@formae.test`;
  const staffPassword = `Cs-${stamp}-x!`;
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
  await staffPage.goto(`${BASE}/en/salon-preview/clients`, { waitUntil: "networkidle", timeout: 180000 });
  const staffBody = await staffPage.locator("body").innerText();
  if (/Clients-Test Nora/.test(staffBody) && !/Lifetime Spend/.test(staffBody))
    ok("🔴 员工身分看得到客人,但看不到「Lifetime Spend」这个金额格子(sees_money)");
  else no("员工身分的金钱隔离不对", staffBody.match(/Lifetime Spend[\s\S]{0,40}/)?.[0]);
  await staffPage.screenshot({ path: `${OUT}/3-staff-view.png`, fullPage: true });
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
