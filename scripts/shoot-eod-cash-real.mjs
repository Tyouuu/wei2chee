/**
 * 沙龙新设计的 End of Day Cash——从写死的三个支付渠道换成真的今天的
 * ledger_entries，按真的 method 分组。真登入、真截图。
 *
 * ── 为什么（2026-09-24，Lookbook 之后第十页）───────────────────────────────
 *
 * 种三笔今天真的收款(两笔现金、一笔 DuitNow QR)、一笔真的开销。验证：
 * 结算清单是真的按 method 分组算出来的(不是写死三行)、Expected Cash
 * 只认含「cash」字样的 method、开销清单是真的、员工看不到这一整页
 * (sees_money)、Print Summary 真的触发浏览器列印。
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
const OUT = ".screenshots/eod-cash-real";
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
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));
const until = async (fn, ms = 30000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};

let browser;
try {
  const stamp = Date.now();
  const email = `eod-${stamp}@formae.test`;
  const password = `Eo-${stamp}-x!`;
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

  for (const k of ["customers", "expenses"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }
  const guest = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Eod-Test Guest",
  });
  if (guest.error) throw new Error(`guest: ${guest.error.message}`);

  const pay1 = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 8000, in_party: "Eod-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Haircut",
  });
  if (pay1.error) throw new Error(`pay1: ${pay1.error.message}`);
  await admin.from("ledger_entries").update({ method: "Cash" }).eq("id", pay1.data.id);

  const pay2 = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 5000, in_party: "Eod-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Wash",
  });
  if (pay2.error) throw new Error(`pay2: ${pay2.error.message}`);
  await admin.from("ledger_entries").update({ method: "Cash" }).eq("id", pay2.data.id);

  const pay3 = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 12000, in_party: "Eod-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Color",
  });
  if (pay3.error) throw new Error(`pay3: ${pay3.error.message}`);
  await admin.from("ledger_entries").update({ method: "DuitNow QR" }).eq("id", pay3.data.id);

  const expense = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 1500, in_party: "Towel Laundry Express",
    in_category: "supplies", in_note: "Receipt #8812",
  });
  if (expense.error) throw new Error(`expense: ${expense.error.message}`);

  browser = await chromium.launch();
  const ownerPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await ownerPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await ownerPage.fill('input[type="email"]', email);
  await ownerPage.fill('input[type="password"]', password);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForURL(/portal/, { timeout: 180000 });

  await ownerPage.goto(`${BASE}/en/salon-preview/eod-cash`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await ownerPage.locator("body").innerText();

  if (!/Maybank EDC Terminal|Batch #089|4099-2811/.test(body)) ok("写死的假 EDC 终端资料不见了");
  else no("还留着写死的假终端资料");

  if (/Cash/.test(body) && /2 transaction/.test(body)) ok("🔴 真的现金渠道分组显示 2 笔交易(不是写死的样子)");
  else no("现金渠道分组不对", body.match(/Cash[^\n]*/g)?.join(" | "));

  if (/DuitNow QR/.test(body) && /1 transaction/.test(body)) ok("🔴 真的 DuitNow QR 渠道分组显示 1 笔交易");
  else no("QR 渠道分组不对");

  if (/RM\s*130\.00/.test(body)) ok("🔴 Expected Cash 真的只算含 cash 字样的方式(80+50=130)");
  else no("Expected Cash 数字不对", body.match(/Expected Cash[\s\S]{0,100}/)?.[0]);

  if (/Towel Laundry Express/.test(body) && /RM\s*15\.00/.test(body)) ok("🔴 真的开销记录出现在 Petty Cash 那一段");
  else no("开销记录没有出现");

  if (/RM\s*250\.00/.test(body)) ok("🔴 Total Shift Gross 真的是三笔收款加总(80+50+120=250)");
  else no("Total Shift Gross 不对", body.match(/Total Shift Gross[\s\S]{0,80}/)?.[0]);

  await ownerPage.screenshot({ path: `${OUT}/1-reconciliation.png`, fullPage: true });

  // ═══ 任务 415：Print Summary 只印那一张 · Export CSV 真的下载（原来是弹「还没接」）═══
  console.log("\n导出 · 列印");
  let alerts = 0;
  ownerPage.on("dialog", () => { alerts += 1; });
  const readDownload = async () => {
    const dl = ownerPage.waitForEvent("download");
    await ownerPage.getByRole("button", { name: "Export CSV" }).click();
    const d = await dl;
    return { name: d.suggestedFilename(), text: readFileSync(await d.path(), "utf8") };
  };

  const csv1 = await readDownload();
  check("🔴 Export CSV 真的下载了一个文件：end-of-day-日期.csv", /^end-of-day-\d{4}-\d{2}-\d{2}\.csv$/.test(csv1.name), csv1.name);
  check("🔴 里面是今天真的收款：现金 2 笔 130.00 · DuitNow QR 1 笔 120.00 · 总额 250.00",
    /"Settlement","Cash","2","130\.00"/.test(csv1.text) && /"Settlement","DuitNow QR","1","120\.00"/.test(csv1.text) && /"Settlement","Total gross settled","","250\.00"/.test(csv1.text), csv1.text.slice(0, 500));
  check("🔴 备用金那一笔（洗毛巾 15.00）、应有现金 130.00 都在", /"Petty cash","Towel Laundry Express[^"]*","1","15\.00"/.test(csv1.text) && /"Cash","Expected cash \(by method\)","","130\.00"/.test(csv1.text));
  check("🔴 还没点钞：写「not counted」，不是写一个 RM 0 再算出一个 -130 的差额（那会像少了一百三）", /"Counted cash \(physical\)","","not counted"/.test(csv1.text) && /"Variance \(counted minus expected\)","",""/.test(csv1.text), csv1.text);

  // 点钞：100 + 20 + 10 = 130，跟应有的一样；备用金留 30；勾一项；写一句交班
  const nums = ownerPage.locator('input[type="number"]');
  await nums.nth(0).fill("1"); // RM 100
  await nums.nth(2).fill("1"); // RM 20
  await nums.nth(3).fill("1"); // RM 10
  await nums.nth(6).fill("30"); // float
  await ownerPage.getByText("Cash drawer physically verified", { exact: true }).click();
  await ownerPage.locator("textarea").fill("Fan in room 2 is broken");
  await ownerPage.screenshot({ path: `${OUT}/2-counted.png`, fullPage: true });
  const csv2 = await readDownload();
  check("🔴 点完钞再导出：点出来 130.00、差额 0.00、备用金 30.00、要存银行 100.00", /"Counted cash \(physical\)","","130\.00"/.test(csv2.text) && /"Variance \(counted minus expected\)","","0\.00"/.test(csv2.text) && /"Float retention","","30\.00"/.test(csv2.text) && /"Net bank deposit","","100\.00"/.test(csv2.text), csv2.text);
  check("🔴 每一种面额点了几张、清单勾了哪一项、交班那一句，都在里面", /"Count","Banknote RM 100","1","100\.00"/.test(csv2.text) && /"Count","Banknote RM 20","1","20\.00"/.test(csv2.text) && /"Checklist","Cash drawer physically verified","","done"/.test(csv2.text) && /"Checklist","Equipment powered off","","not done"/.test(csv2.text) && /"Handover note","Fan in room 2 is broken"/.test(csv2.text), csv2.text);

  // 列印：只印那一张纸（侧栏、点钞表、按钮不印）
  check("🔴 那一张纸在屏幕上是藏着的（不多占一屏）", !(await ownerPage.locator("[data-print-sheet]").isVisible()));
  await ownerPage.emulateMedia({ media: "print" });
  const sheetShown = await ownerPage.locator("[data-print-sheet]").isVisible();
  const asideShown = await ownerPage.locator("aside").first().isVisible().catch(() => false);
  const sheetText = await ownerPage.locator("[data-print-sheet]").innerText();
  await ownerPage.pdf({ path: `${OUT}/3-print.pdf`, format: "A4" });
  await ownerPage.setViewportSize({ width: 794, height: 1123 });
  await ownerPage.screenshot({ path: `${OUT}/3-print.png`, fullPage: true });
  await ownerPage.setViewportSize({ width: 1700, height: 1300 });
  await ownerPage.emulateMedia({ media: "screen" });
  check("🔴 列印规则接上了：印的时候只剩那一张纸，侧栏不见", sheetShown && !asideShown, `sheet=${sheetShown} sidebar=${asideShown}`);
  check("🔴 纸上有：应有现金 · 各渠道 · 点钞每一种面额 · 差额 · 交班那一句 · 签名栏",
    /Total gross settled[\s\S]*RM 250\.00/.test(sheetText) && /1 × Banknote RM 100/.test(sheetText) && /Variance[\s\S]*RM 0\.00/.test(sheetText) && /Fan in room 2 is broken/.test(sheetText) && /Counted by/.test(sheetText) && /Checked by/.test(sheetText), sheetText.slice(0, 600));
  check("🔴 整个过程一个「还没接」的 alert() 都没弹", alerts === 0, String(alerts));

  // ═══ 任务 415 第 2 项：Lock the Day 真的存下来（20260925010000）═══
  // 到这里页面上已经点了钞（130）、备用金 30、勾了一项、写了交班那一句。
  console.log("\n收工：锁定 · 隔夜还在 · 重开 · 再收");
  const lockedTag = ownerPage.getByTestId("eod-locked");
  const dayRows = async () =>
    (await admin.from("day_closings").select("*").eq("project_id", pid).order("locked_at", { ascending: true })).data ?? [];
  const goEod = async () => {
    await ownerPage.goto(`${BASE}/en/salon-preview/eod-cash`, { waitUntil: "networkidle", timeout: 180000 });
  };
  const bossName = email.split("@")[0];

  check("锁之前：「Lock the Day」在，「Reopen」不在", (await ownerPage.getByRole("button", { name: "Lock the Day" }).count()) === 1 && (await ownerPage.getByRole("button", { name: /Reopen the Day/ }).count()) === 0);
  check("锁之前库里一份都没有", (await dayRows()).length === 0);

  await ownerPage.getByRole("button", { name: "Lock the Day" }).click();
  await lockedTag.waitFor({ timeout: 60000 });
  const lockedText = await lockedTag.innerText();
  check("🔴 锁了：横幅写「Locked by 谁 at 几点」+ 点出来 RM 130.00 + balanced", new RegExp(`Locked by ${bossName} at \\d\\d:\\d\\d`).test(lockedText) && /Counted RM\s*130\.00/.test(lockedText) && /balanced/.test(lockedText), lockedText);
  const saved = await dayRows();
  check("🔴 库里真的有一份现行的：点钞 13000 · 该有 13000 · 备用金 3000 · 差额 0 · 要存 10000", saved.length === 1 && saved[0].voided_at === null && Number(saved[0].counted_cents) === 13000 && Number(saved[0].expected_cash_cents) === 13000 && Number(saved[0].float_cents) === 3000 && Number(saved[0].variance_cents) === 0 && Number(saved[0].net_deposit_cents) === 10000, JSON.stringify(saved[0]));
  check("🔴 交班那一句、清单勾了哪一项、各渠道、总额一起存了", saved[0]?.note === "Fan in room 2 is broken" && saved[0].checklist?.find((c) => c.label === "Cash drawer physically verified")?.done === true && saved[0].checklist?.find((c) => c.label === "Equipment powered off")?.done === false && saved[0].settlements?.length === 2 && Number(saved[0].gross_cents) === 25000, JSON.stringify([saved[0]?.note, saved[0]?.gross_cents]));
  check("🔴 谁锁的是登入的人（不是页面写的）", saved[0]?.locked_by === userId && saved[0]?.locked_by_name === bossName, `${saved[0]?.locked_by_name}`);
  check("锁了之后：点钞框、+/− 、备用金、清单、交班那一格全部动不了",
    (await nums.nth(0).getAttribute("readonly")) !== null && (await ownerPage.getByRole("button", { name: "One more Banknote RM 50" }).isDisabled()) &&
    (await nums.nth(6).getAttribute("readonly")) !== null && (await ownerPage.locator('input[type="checkbox"]').first().isDisabled()) && (await ownerPage.locator("textarea").getAttribute("readonly")) !== null);
  check("锁了之后：「Lock the Day」不见，换成「Reopen the Day」", (await ownerPage.getByRole("button", { name: "Lock the Day" }).count()) === 0 && (await ownerPage.getByRole("button", { name: "Reopen the Day" }).count()) === 1);
  await ownerPage.screenshot({ path: `${OUT}/4-locked.png`, fullPage: true });

  // 🔴 隔夜：整页重新载入，全部从库里读回来（这一条才是「存下来」）
  await goEod();
  check("🔴 重新载入之后还是锁着的", await lockedTag.isVisible());
  check("🔴 点钞读回来：RM 100 × 1、RM 20 × 1、RM 10 × 1，备用金 30", (await nums.nth(0).inputValue()) === "1" && (await nums.nth(2).inputValue()) === "1" && (await nums.nth(3).inputValue()) === "1" && (await nums.nth(1).inputValue()) === "0" && (await nums.nth(6).inputValue()) === "30");
  check("🔴 交班那一句、勾了的那一项读回来", (await ownerPage.locator("textarea").inputValue()) === "Fan in room 2 is broken" && (await ownerPage.locator('input[type="checkbox"]').first().isChecked()) && !(await ownerPage.locator('input[type="checkbox"]').nth(3).isChecked()));
  check("没有人动过帐：没有「changed」那条提醒", (await ownerPage.getByTestId("eod-changed").count()) === 0);

  // 锁了之后又进来一笔现金：画面上冻结的数字不动，但要告诉他
  const late = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 5000, in_party: "Eod-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Late tip-off",
  });
  if (late.error) throw new Error(`late: ${late.error.message}`);
  await admin.from("ledger_entries").update({ method: "Cash" }).eq("id", late.data.id);
  await goEod();
  const changedText = await ownerPage.getByTestId("eod-changed").innerText().catch(() => "");
  check("🔴 锁了之后又进了一笔现金：出现提醒，讲得出「当时该有 RM 130.00、现在帐上 RM 180.00」", /RM\s*130\.00/.test(changedText) && /RM\s*180\.00/.test(changedText), changedText);
  const frozenBody = await ownerPage.locator("body").innerText();
  check("🔴 画面上的 Expected Cash 还是冻结的 RM 130.00，不是新的 180（他拿哪个数字去对的，就留哪个）", /Expected Cash \(by method\)[\s\S]{0,40}RM\s*130\.00/i.test(frozenBody) && !/Expected Cash \(by method\)[\s\S]{0,40}RM\s*180\.00/i.test(frozenBody));
  const csvLocked = await readDownload();
  check("🔴 锁着的时候导出：写着谁锁的、几点", new RegExp(`"Locked","${bossName} at \\d\\d:\\d\\d"`).test(csvLocked.text), csvLocked.text.slice(0, 200));
  await ownerPage.emulateMedia({ media: "print" });
  const lockedSheet = await ownerPage.locator("[data-print-sheet]").innerText();
  await ownerPage.emulateMedia({ media: "screen" });
  check("🔴 列印的那一张纸上也写着「Locked by 谁 at 几点」", new RegExp(`Locked by ${bossName} at \\d\\d:\\d\\d`).test(lockedSheet), lockedSheet.slice(0, 200));
  await ownerPage.screenshot({ path: `${OUT}/5-late-payment.png`, fullPage: true });

  // 重开：从上次点的数字开始改，不是从零重点
  await ownerPage.getByRole("button", { name: "Reopen the Day" }).click();
  await ownerPage.getByLabel("Why reopen the day").fill("Missed a RM 50 note");
  await ownerPage.screenshot({ path: `${OUT}/5b-reopening.png`, clip: { x: 256, y: 0, width: 1444, height: 340 } });
  await ownerPage.getByRole("button", { name: "Reopen", exact: true }).click();
  await until(async () => (await ownerPage.getByRole("button", { name: "Lock the Day" }).count()) === 1);
  const afterReopen = await dayRows();
  check("🔴 重开：那一份留着（标了时间跟原因），没有被删", afterReopen.length === 1 && afterReopen[0].voided_at !== null && afterReopen[0].void_reason === "Missed a RM 50 note" && Number(afterReopen[0].counted_cents) === 13000, JSON.stringify(afterReopen.map((r) => [r.voided_at, r.void_reason])));
  check("🔴 重开之后：横幅没了、点钞框能改了，而且是上次点的数字（130），不是从零开始",
    (await lockedTag.count()) === 0 && (await nums.nth(0).getAttribute("readonly")) === null && (await nums.nth(0).inputValue()) === "1" && (await nums.nth(6).inputValue()) === "30" && (await ownerPage.locator("textarea").inputValue()) === "Fan in room 2 is broken");
  check("🔴 这一次是拿新的帐去对：该有 RM 180.00，点出来 130，差 −RM 50.00", /-RM\s*50\.00/.test(await ownerPage.locator("body").innerText()));
  await ownerPage.getByRole("button", { name: "One more Banknote RM 50" }).click();
  check("补上那张 RM 50 之后：差额归零，写着 Balanced", /Balanced/.test(await ownerPage.locator("body").innerText()));
  await ownerPage.getByRole("button", { name: "Lock the Day" }).click();
  await lockedTag.waitFor({ timeout: 60000 });
  check("🔴 再收一次：横幅是新的（点出来 RM 180.00 · balanced），提醒没了（冻结的已经是新的帐）", /Counted RM\s*180\.00/.test(await lockedTag.innerText()) && (await ownerPage.getByTestId("eod-changed").count()) === 0);
  const afterRelock = await dayRows();
  check("🔴 库里现在两份：旧的（重开了）+ 新的（现行，18000）", afterRelock.length === 2 && afterRelock.filter((r) => r.voided_at === null).length === 1 && Number(afterRelock.find((r) => r.voided_at === null).counted_cents) === 18000, JSON.stringify(afterRelock.map((r) => [r.counted_cents, r.voided_at])));
  await ownerPage.screenshot({ path: `${OUT}/6-relocked.png`, fullPage: true });

  // 两个分页同时收：输的那个讲一句人话，然后自己追上
  await api.rpc("reopen_day_closing", { in_id: afterRelock.find((r) => r.voided_at === null).id, in_reason: "setup for the two-tab test" });
  await goEod();
  check("前提：重开之后这一页是没锁的", (await ownerPage.getByRole("button", { name: "Lock the Day" }).count()) === 1);
  const otherTab = await api.rpc("lock_day_closing", {
    in_project_id: pid, in_closing_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date()),
    in_counts: { "100": 1 }, in_float_cents: 0, in_expected_cash_cents: 18000, in_gross_cents: 30000, in_outflows_cents: 0,
    in_settlements: [], in_checklist: [], in_note: "closed from the other tab",
  });
  if (otherTab.error) throw new Error(`otherTab: ${otherTab.error.message}`);
  await ownerPage.getByRole("button", { name: "Lock the Day" }).click();
  await until(async () => (await lockedTag.count()) === 1);
  check("🔴 另一个分页先收了：这一页按下去之后追上了，显示的是先收的那一份（点出来 RM 100.00），没有把它盖掉", /Counted RM\s*100\.00/.test(await lockedTag.innerText()) && (await ownerPage.locator("textarea").inputValue()) === "closed from the other tab");
  const liveNow = (await dayRows()).filter((r) => r.voided_at === null);
  check("🔴 库里现行的还是只有一份（另一个分页的那份）", liveNow.length === 1 && liveNow[0].note === "closed from the other tab", `${liveNow.length}`);

  // 明早：前一天的交班备注要出现在今天这一页
  await api.rpc("reopen_day_closing", { in_id: liveNow[0].id, in_reason: "back to open for the morning test" });
  const yday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(Date.now() - 86_400_000));
  const seedYday = await api.rpc("lock_day_closing", {
    in_project_id: pid, in_closing_date: yday, in_counts: { "100": 2 }, in_float_cents: 5000,
    in_expected_cash_cents: 20000, in_gross_cents: 41000, in_outflows_cents: 0, in_settlements: [],
    in_checklist: [], in_note: "Ice machine is leaking, bucket under the sink",
  });
  if (seedYday.error) throw new Error(`seedYday: ${seedYday.error.message}`);
  await goEod();
  const leftFor = await ownerPage.getByTestId("eod-left-for-you").innerText().catch(() => "");
  check("🔴 前一天他留的话出现在今天这一页顶上：「Left for the Morning」+ 那一句 + 谁留的", /Left for the Morning/.test(leftFor) && /Ice machine is leaking/.test(leftFor) && leftFor.includes(bossName), leftFor);
  const historyRows = ownerPage.getByTestId("eod-history-row");
  check("🔴 「Recent Closings」有前一天那一行：点出来 RM 200.00 · Balanced · 要存 RM 150.00", (await historyRows.count()) === 1 && /Counted RM\s*200\.00/.test(await historyRows.first().innerText()) && /Balanced/.test(await historyRows.first().innerText()) && /Banked RM\s*150\.00/.test(await historyRows.first().innerText()), await historyRows.first().innerText().catch(() => ""));
  check("今天自己（重开了、还没收）不在历史里", !/closed from the other tab/.test(await ownerPage.getByTestId("eod-history").innerText()));
  check("前一天那句话只出现一次（「Left for the Morning」里全文，历史那一行不再重复一遍）", ((await ownerPage.locator("body").innerText()).match(/Ice machine is leaking/g) ?? []).length === 1);
  await ownerPage.screenshot({ path: `${OUT}/7-morning.png`, fullPage: true });

  // 员工身分——整页都看不到(sees_money)。
  const staffEmail = `eod-staff-${stamp}@formae.test`;
  const staffPassword = `Es-${stamp}-x!`;
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
  await staffPage.goto(`${BASE}/en/salon-preview/eod-cash`, { waitUntil: "networkidle", timeout: 180000 });
  const staffBody = await staffPage.locator("body").innerText();
  if (/only visible to the business owner/.test(staffBody) && !/RM\s*250\.00/.test(staffBody))
    ok("🔴 员工身分完全看不到这一页的钱(sees_money 挡住整页)");
  else no("员工身分的金钱隔离不对");
  check("🔴 员工身分连「Print Summary」「Export CSV」两颗按钮都没有（钱不能被导出去）", !/Export CSV|Print Summary/i.test(staffBody));
  check("🔴 员工身分没有「Lock the Day」「Reopen the Day」，也看不到收工历史跟老板留的话", !/Lock the Day|Reopen the Day|Recent Closings|Left for the Morning|Ice machine/.test(staffBody));
  const staffSaw = await staffPage.evaluate(async () => document.querySelectorAll('[data-testid="eod-history"], [data-testid="eod-left-for-you"], [data-testid="eod-locked"]').length);
  check("🔴 员工那一页的 HTML 里连这几块的壳都没有", staffSaw === 0, String(staffSaw));
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
