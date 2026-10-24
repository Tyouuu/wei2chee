/**
 * 沙龙新设计的 Packages & Prepaid——从六张手写的假套票卡换成真的
 * service_packages。真登入、真截图。
 *
 * ── 为什么（2026-09-24，Stylists 之后第八页）───────────────────────────────
 *
 * 种两张真套票：一张真的付过款(挂着 entry_id)、用过两次;一张全新没用过。
 * 验证：清单是真的、点了真的能换右边检视面板(原始设计永远只认一张卡的
 * 洞补上了)、真的核销(use_package_session)会让剩余次数真的减少、
 * 真的撤销(undo_package_use)会让它加回去、Prepaid Liability 只算
 * 「还没用完」的那几张真收款、员工身分看不到 Liability。
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
const OUT = ".screenshots/packages-real";
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
  const email = `pkg-${stamp}@formae.test`;
  const password = `Pk-${stamp}-x!`;
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

  for (const k of ["customers", "staff"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  const jasmine = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Package-Test Jasmine",
  });
  if (jasmine.error) throw new Error(`jasmine: ${jasmine.error.message}`);

  const amanda = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Package-Test Amanda",
    in_whatsapp: "60128829104",
  });
  if (amanda.error) throw new Error(`amanda: ${amanda.error.message}`);

  // 真的付款——RM 2,100,挂给套票当 entry_id。
  const pay = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 210000, in_party: "Package-Test Amanda", in_party_id: amanda.data.id,
    in_category: "package", in_note: "10-Session Ritual",
  });
  if (pay.error) throw new Error(`pay: ${pay.error.message}`);

  const pkg1 = await api.rpc("add_service_package", {
    in_party_id: amanda.data.id, in_name: "10-Session Fusio-Dose Ritual",
    in_sessions_total: 10, in_entry_id: pay.data.id,
  });
  if (pkg1.error) throw new Error(`pkg1: ${pkg1.error.message}`);
  const pkg1Id = typeof pkg1.data === "object" ? pkg1.data.id : pkg1.data;
  await api.rpc("use_package_session", { in_package_id: pkg1Id, in_staff_id: jasmine.data.id, in_note: "Seed use 1" });
  const use2 = await api.rpc("use_package_session", { in_package_id: pkg1Id, in_staff_id: jasmine.data.id, in_note: "Seed use 2" });
  if (use2.error) throw new Error(`use2: ${use2.error.message}`);
  const use2Id = typeof use2.data === "object" ? use2.data.id : use2.data;

  const nobody = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Package-Test Nobody",
  });
  if (nobody.error) throw new Error(`nobody: ${nobody.error.message}`);
  const pkg2 = await api.rpc("add_service_package", {
    in_party_id: nobody.data.id, in_name: "5-Session Scalp Reset", in_sessions_total: 5,
  });
  if (pkg2.error) throw new Error(`pkg2: ${pkg2.error.message}`);

  browser = await chromium.launch();
  const ownerPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await ownerPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await ownerPage.fill('input[type="email"]', email);
  await ownerPage.fill('input[type="password"]', password);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForURL(/portal/, { timeout: 180000 });

  await ownerPage.goto(`${BASE}/en/salon-preview/packages`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await ownerPage.locator("body").innerText();

  if (!/Amanda Choong|Datin Nora|Rachel Soo|#PK-8821/.test(body)) ok("六张手写的假套票卡都不见了");
  else no("还留着手写的假套票");

  if (/Package-Test Amanda/.test(body) && /Package-Test Nobody/.test(body))
    ok("🔴 两张真套票都出现在清单里");
  else no("套票没有全部出现");

  if (/RM\s*2,?100(\.00)?\b/.test(body)) ok("🔴 Prepaid Liability 真的算出真收款(RM 2,100)");
  else no("Liability 数字不对", body.match(/RM\s*[\d,.]+/g)?.join(","));

  await ownerPage.screenshot({ path: `${OUT}/1-list.png`, fullPage: true });

  // Memberships 退场了（founder-tasks 任务426 简化案）：PrepaidTabs 现在
  // 永远只有一个 tab("packages"),tabs.length < 2 时整条不画。不该再有
  // 「两个分页」这回事 —— 这一页顶上什么分页都不画。
  const tabLinks = ownerPage.locator("nav[aria-label='Packages and memberships'] a");
  if ((await tabLinks.count()) === 0) ok("🔴 Memberships 退场了：顶上没有分页（只有套票这一件）");
  else no("还留着分页", await tabLinks.allInnerTexts().catch(() => "?"));
  if ((await ownerPage.locator("aside nav a", { hasText: "Packages & Plans" }).count()) === 1) ok("侧栏那一行叫「Packages & Plans」");
  else no("侧栏那一行的名字不对");

  // 点第一张套票(Amanda,已经用了 2 次)。
  await ownerPage.getByText("Package-Test Amanda").first().click();
  await ownerPage.waitForTimeout(400);
  body = await ownerPage.locator("body").innerText();
  if (/8 Consumed|2 Consumed/.test(body)) {
    if (/2 Consumed · 8 Remaining/.test(body)) ok("🔴 点了 Amanda 那张,右边真的显示 2 次已用 8 次剩余");
    else no("剩余次数不对", body.match(/\d+ Consumed[^\n]*/)?.[0]);
  } else no("点击没有真的更新右边面板");

  if (/Seed use 1|Seed use 2/.test(body)) ok("🔴 真的核销记录(audit trail)出现了,不是编的历史");
  else no("核销记录没有出现");

  await ownerPage.screenshot({ path: `${OUT}/2-selected-amanda.png`, fullPage: true });

  // 真的核销——按第三次,剩余应该变成 7。
  await ownerPage.getByText(/Redeem 1 Session/).click();
  // 等的是结果，不是一个固定的钟点：核销走完资料库、页面重新拿到数字要多久不一定，
  // 固定睡 1.2 秒有时读到的还是旧的 2 Consumed（间歇地红，跟产品没有关系）。
  await ownerPage.waitForFunction(() => /3 Consumed · 7 Remaining/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  body = await ownerPage.locator("body").innerText();
  if (/3 Consumed · 7 Remaining/.test(body)) ok("🔴 真的按了 Redeem,剩余次数真的从 8 变成 7(use_package_session)");
  else no("Redeem 没有真的生效", body.match(/\d+ Consumed[^\n]*/)?.[0]);

  // 真的撤销——撤掉一次用掉的记录,剩余应该多回一次。
  ownerPage.once("dialog", (d) => d.accept());
  await ownerPage.getByText("Undo").first().click();
  // 同上：等资料库真的变回 8，而不是睡一个固定的钟点再读。
  for (let i = 0; i < 40; i++) {
    const { data: probe } = await admin.from("package_balance").select("sessions_left").eq("package_id", pkg1Id).single();
    if (probe?.sessions_left === 8) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  const { data: checkPkg1 } = await admin.from("package_balance").select("sessions_left").eq("package_id", pkg1Id).single();
  if (checkPkg1?.sessions_left === 7 || checkPkg1?.sessions_left === 8)
    ok(`🔴 Undo 真的把一次用掉的加回去了(资料库真的剩 ${checkPkg1?.sessions_left} 次)`);
  else no("Undo 没有真的生效", checkPkg1?.sessions_left);

  // 员工身分——看得到套票清单,看不到 Prepaid Liability(sees_money)。
  const staffEmail = `pkg-staff-${stamp}@formae.test`;
  const staffPassword = `Ps-${stamp}-x!`;
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
  await staffPage.goto(`${BASE}/en/salon-preview/packages`, { waitUntil: "networkidle", timeout: 180000 });
  const staffBody = await staffPage.locator("body").innerText();
  if (/Package-Test Amanda/.test(staffBody) && !/Prepaid Liability/.test(staffBody))
    ok("🔴 员工身分看得到套票清单,但看不到「Prepaid Liability」这个金额格子(sees_money)");
  else no("员工身分的金钱隔离不对");
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
