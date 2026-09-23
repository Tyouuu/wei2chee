/**
 * 沙龙新设计的 Stylists & Staff——从一个手写的假师傅(Jasmine Teo #ST-003)
 * 换成真的 directory_entries。真登入、真截图。
 *
 * ── 为什么（2026-09-24，Clients 之后第七页）─────────────────────────────
 *
 * 种两位真师傅：一位有真的抽成阶梯、真的这个月完成的预约(带价钱)、
 * 真的打卡记录；一位什么活动都没有。验证：清单选择器真的能换人、
 * 真的表单能存(update_directory_entry)、抽成阶梯是真的算出来的、
 * 当前阶梯真的用这个月的真收入去比、打卡记录是真的、员工身分看不到
 * 抽成金额、真的收档(set_directory_archived)。
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
const OUT = ".screenshots/stylists-real";
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
  const email = `sty-${stamp}@formae.test`;
  const password = `St-${stamp}-x!`;
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
    in_project_id: pid, in_module_key: "staff", in_name: "Stylist-Test Jasmine",
    in_phone: "016-882 9104", in_email: "jasmine@stylist-test.formae",
  });
  if (jasmine.error) throw new Error(`jasmine: ${jasmine.error.message}`);
  await admin.from("directory_entries").update({ status: "Full-time", note: "Balayage & foilyage specialist" }).eq("id", jasmine.data.id);

  const plain = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Stylist-Test Amy",
  });
  if (plain.error) throw new Error(`plain: ${plain.error.message}`);

  // 真的抽成阶梯:0-500 是 15%,500 以上是 25%。
  const tiers = await api.rpc("set_commission_tiers", {
    in_party_id: jasmine.data.id,
    in_tiers: [{ from_cents: 0, percent: 15 }, { from_cents: 50000, percent: 25 }],
  });
  if (tiers.error) throw new Error(`set_commission_tiers: ${tiers.error.message}`);

  // 一位真客人 + 这个月一笔真的完成预约,带真的行项价钱(RM 800,超过 500 那一档)。
  const guest = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Stylist-Test Guest",
  });
  if (guest.error) throw new Error(`guest: ${guest.error.message}`);
  const now = new Date();
  const start = new Date(now); start.setUTCHours(now.getUTCHours() - 2);
  const end = new Date(now); end.setUTCHours(now.getUTCHours() - 1);
  const visit = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: start.toISOString(), in_ends_at: end.toISOString(),
    in_party: "Stylist-Test Guest", in_party_id: guest.data.id, in_staff_id: jasmine.data.id,
    in_service: "Full Balayage",
  });
  if (visit.error) throw new Error(`visit: ${visit.error.message}`);
  const visitId = visit.data;
  const done = await api.rpc("set_appointment_status", { in_id: visitId, in_status: "done" });
  if (done.error) throw new Error(`done: ${done.error.message}`);
  const line = await api.rpc("add_visit_line", {
    in_appointment_id: visitId, in_service: "Full Balayage", in_staff_id: jasmine.data.id, in_price_cents: 80000,
  });
  if (line.error) throw new Error(`add_visit_line: ${line.error.message}`);

  // 🔴 抽成算的是「谁收了这笔钱」(ledger_entries.done_by, staff_earnings
  // 那支 RPC 的定义),不是 appointment_lines 那笔服务价钱本身——两者是
  // 不同的问题(见档头「谁收了 vs 谁做了」)。commission_tiers 用来比较
  // 的分母是这一笔真的收款,种资料要种收款,不是只种服务行项。
  const pay = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 80000, in_party: "Stylist-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Full Balayage",
  });
  if (pay.error) throw new Error(`pay: ${pay.error.message}`);
  const setDoneBy = await admin.from("ledger_entries").update({ done_by: jasmine.data.id }).eq("id", pay.data.id);
  if (setDoneBy.error) throw new Error(`set done_by: ${setDoneBy.error.message}`);

  // 真的打卡记录——上班又下班一次。
  const clockIn = await api.rpc("clock_in", { in_staff_id: jasmine.data.id });
  if (clockIn.error) throw new Error(`clock_in: ${clockIn.error.message}`);
  const clockOut = await api.rpc("clock_out", { in_staff_id: jasmine.data.id });
  if (clockOut.error) throw new Error(`clock_out: ${clockOut.error.message}`);

  browser = await chromium.launch();
  const ownerPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await ownerPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await ownerPage.fill('input[type="email"]', email);
  await ownerPage.fill('input[type="password"]', password);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForURL(/portal/, { timeout: 180000 });

  // 直接指名 Jasmine——不指定的话按名字排序默认打开的是 Amy(A 排在 J 前面),
  // 那不是产品的错,是这里如果不指名就在测错的人。
  await ownerPage.goto(`${BASE}/en/salon-preview/stylists?staff=${jasmine.data.id}`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await ownerPage.locator("body").innerText();

  if (!/Jasmine Teo|#ST-003|884-JTEO/.test(body)) ok("手写的假师傅(Jasmine Teo #ST-003)不见了");
  else no("还留着手写的假师傅");

  // ⚠️ 状态/备注是 <input>/<textarea> 的 value,不是文字节点——
  // innerText() 读不到表单控件的值,要用 inputValue() 才对。
  const statusValue = await ownerPage.locator('input[type="text"]').nth(1).inputValue();
  if (/Stylist-Test Jasmine/.test(body) && statusValue === "Full-time")
    ok("🔴 真师傅的名字跟真的雇用状态读到了");
  else no("师傅资料不对", statusValue);

  const noteValue = await ownerPage.locator("textarea").inputValue();
  if (noteValue === "Balayage & foilyage specialist") ok("🔴 真的 note 字段读到了");
  else no("note 没有出现", noteValue);

  if (/RM\s*8,?00(\.00)?\b/.test(body) || /RM\s*800\b/.test(body))
    ok("🔴 抽成阶梯真的用这个月的真收入(RM 800)去比");
  else no("收入数字不对", body.match(/RM\s*[\d,.]+/g)?.join(","));

  // 800 元收入落在第二档(500+, 25%)——第二档要标成 Current Run-rate。
  // ⚠️ 那个标签套了 CSS uppercase,渲染出来是 "CURRENT RUN-RATE",
  // 跟这一晚好几次同一个坑一样,用不分大小写的判断。
  if (/25%/.test(body) && /current run-rate/i.test(body))
    ok("🔴 第二档(25%)真的被标成当前阶梯,不是写死的 T2");
  else no("当前阶梯判断不对", body.match(/current run-rate[\s\S]{0,10}|T\d[\s\S]{0,80}/gi)?.join(" | "));

  if (/Still on shift|Clocked In/.test(body) || /\b1\.0\b|\b0\.\d\b/.test(body))
    ok("🔴 真的打卡记录出现了(上班又下班一次)");
  else no("打卡记录没有出现", body.match(/Recent Shifts[\s\S]{0,300}/)?.[0]);

  await ownerPage.screenshot({ path: `${OUT}/1-jasmine.png`, fullPage: true });

  // 换到第二位师傅(什么活动都没有)——验证选择器真的能换人。
  // ⚠️ 开始那一刻网址本来就带着 "staff="(Jasmine 的 id),用同一个宽松的
  // regex 等,Playwright 当场就判定「已经满足」,不会真的等到换成 Amy 的
  // id 才继续——要等的是新网址真的出现 Amy 的 id。
  await ownerPage.locator("select").first().selectOption({ label: "Stylist-Test Amy" });
  await ownerPage.waitForURL(new RegExp(`staff=${plain.data.id}`), { timeout: 15000 });
  await ownerPage.waitForLoadState("networkidle");
  body = await ownerPage.locator("body").innerText();
  if (/No clock-ins recorded for Stylist-Test Amy/.test(body) && !/RM\s*800/.test(body))
    ok("🔴 换了师傅,右边(读 props 那一半)真的换成她的(空)资料——原始设计只认一个人的洞补上了");
  else no("换师傅没有真的更新右边画面");

  // 🔴 左边表单是本地 state,不是直接读 props——真登入之后用眼睛看截图
  // 才抓到:换了师傅,右边资料换了,左边表单欄位却还是上一位的值(useState
  // 的惰性初始值只在第一次掛载跑一次)。这里直接量表单欄位的真实值,
  // 不能只看 innerText——那次漏就是漏在这里。
  const nameAfterSwitch = await ownerPage.locator('input[type="text"]').first().inputValue();
  if (nameAfterSwitch === "Stylist-Test Amy")
    ok("🔴 换了师傅,左边表单欄位也真的换成她的值,不是留着上一位的(useState 没有黏住)");
  else no("表单欄位还留着上一位师傅的值——按 Save 会把这一位的资料写去另一位身上", nameAfterSwitch);

  await ownerPage.screenshot({ path: `${OUT}/2-selected-amy.png`, fullPage: true });

  // 真的编辑跟存档——改一下 Amy 的电话,存,重整,确认真的写进资料库了。
  const phoneInput = ownerPage.locator('input[type="text"]').nth(2);
  await phoneInput.fill("012-000 9999");
  await ownerPage.getByText("Save Stylist Settings").click();
  await ownerPage.waitForTimeout(1200);
  const { data: checkAmy } = await admin.from("directory_entries").select("phone").eq("id", plain.data.id).single();
  if (checkAmy?.phone === "012-000 9999") ok("🔴 Save 真的把改动写进资料库(update_directory_entry)");
  else no("Save 没有真的写进资料库", checkAmy?.phone);

  // 员工身分——看得到师傅资料,看不到抽成金额(sees_money)。
  const staffEmail = `sty-staff-${stamp}@formae.test`;
  const staffPassword = `Ss-${stamp}-x!`;
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
  await staffPage.goto(`${BASE}/en/salon-preview/stylists?staff=${jasmine.data.id}`, { waitUntil: "networkidle", timeout: 180000 });
  const staffBody = await staffPage.locator("body").innerText();
  if (/Stylist-Test Jasmine/.test(staffBody) && !/Commission This Month/.test(staffBody))
    ok("🔴 员工身分看得到师傅资料,但看不到「Commission This Month」这个金额格子(sees_money)");
  else no("员工身分的金钱隔离不对");
  admin.auth.admin.deleteUser(staffUser.user.id).catch(() => {});

  // 真的收档——Amy 存档之后应该从选择器消失(或者整页跳到剩下那一位)。
  await ownerPage.goto(`${BASE}/en/salon-preview/stylists?staff=${plain.data.id}`, { waitUntil: "networkidle", timeout: 180000 });
  ownerPage.once("dialog", (d) => d.accept());
  await ownerPage.getByText("Archive Stylist").click();
  await ownerPage.waitForTimeout(1200);
  const { data: checkArchived } = await admin.from("directory_entries").select("archived_at").eq("id", plain.data.id).single();
  if (checkArchived?.archived_at) ok("🔴 Archive 真的把这位师傅收起来了(set_directory_archived),不是装饰按钮");
  else no("Archive 没有真的生效");

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
