/**
 * 沙龙新设计的 Memberships & VIP Passes（会员月卡）——从写死的 47 位订阅者
 * 换成真的 memberships / membership_payments。真登入、真按钮、真截图。
 *
 * ── 为什么（2026-09-24，任务 413，十三页里的第十三页）──────────────────────
 *
 * 种六位会员，每个数字事先算好：
 *
 *   VIP Monthly  RM 150：Gita（今天开始，收过一期）· Priya（45 天前开始 → 逾期）·
 *                        Ann（今天开始）· Dina（收过一期后取消）
 *   Blowout Pass RM 360：Eve（今天开始）· Fay（100 天前开始，收过两期 → 仍逾期）
 *
 *   → 在册 5 位（取消的不算）· 本月新增 3（Gita / Ann / Eve）
 *   → 每月固定 RM 1,170（150×3 + 360×2）
 *   → 本月已收 RM 1,020（Gita 150 + Fay 720 + Dina 150）· 逾期 2 位（Priya · Fay）
 *   → 平均会员时长 0.8 个月（(45 + 100) 天 ÷ 30.4375 ÷ 6 人）
 *   → 计划卡：VIP 3 位（Most Popular）· Blowout 2 位
 *
 * 再用真的按钮走：给 Priya 收一期 · 对 Ann 连按两下只收一次 · 取消 Eve、恢复 Eve ·
 * 新增一位（三种没填好的提示各出一次）· 新增之后两个计划都是 3 位，「Most Popular」
 * 该消失 · 搜索 / 只看逾期 · 导出 CSV · 列印时侧栏不见 · 员工登入看不到钱 ·
 * 一间全新的空店每一块都讲清楚。
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
const OUT = ".screenshots/memberships-real";
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

const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
const daysAgo = (n) => new Date(new Date(`${todayStr}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

async function waitText(page, re, ms = 30000) {
  return page
    .waitForFunction((src) => new RegExp(src).test(document.body.innerText), re.source, { timeout: ms })
    .then(() => true)
    .catch(() => false);
}
async function until(fn, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}
const rowOf = (page, name) => page.getByTestId("member-row").filter({ hasText: name });

async function login(browser, email, password, size = { width: 1700, height: 1300 }) {
  const ctx = await browser.newContext({ viewport: size, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  return page;
}

let browser;
try {
  const stamp = Date.now();
  const email = `mem-${stamp}@formae.test`;
  const password = `Me-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;

  for (const k of ["customers", "payments"]) await api.rpc("add_project_page", { requested_key: k, new_title: "" });

  const client = (name, extra = {}) =>
    must(name, api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "customers", in_name: name, ...extra }));
  const gita = await client("Mem-Test Gita", { in_phone: "012-882 9104" });
  const priya = await client("Mem-Test Priya");
  const ann = await client("Mem-Test Ann");
  const eve = await client("Mem-Test Eve");
  const fay = await client("Mem-Test Fay");
  const dina = await client("Mem-Test Dina");
  const zed = await client("Mem-Test Zed");

  const join = (who, plan, fee, startedOn) =>
    must(`join ${who.name}`, api.rpc("add_membership", {
      in_project_id: pid, in_party_id: who.id, in_plan_name: plan, in_monthly_fee_cents: fee, in_started_on: startedOn,
    }));
  const mGita = await join(gita, "VIP Monthly", 15000, todayStr);
  const mPriya = await join(priya, "VIP Monthly", 15000, daysAgo(45));
  await join(ann, "VIP Monthly", 15000, todayStr);
  await join(eve, "Blowout Pass", 36000, todayStr);
  const mFay = await join(fay, "Blowout Pass", 36000, daysAgo(100));
  const mDina = await join(dina, "VIP Monthly", 15000, todayStr);
  const collectRpc = (m) => must("collect", api.rpc("collect_membership_fee", { in_membership_id: m.id, in_idempotency_key: crypto.randomUUID() }));
  await collectRpc(mGita);
  await collectRpc(mFay);
  await collectRpc(mFay);
  await collectRpc(mDina);
  await must("cancel dina", api.rpc("set_membership_archived", { in_id: mDina.id, in_archived: true }));

  browser = await chromium.launch();
  const page = await login(browser, email, password);
  await page.goto(`${BASE}/en/salon-preview/memberships`, { waitUntil: "networkidle", timeout: 180000 });
  const body = await page.locator("body").innerText();

  console.log("\n① 写死的样本不见了");
  check("没有 Bangsar 那些写死的名字", !/Amanda Choong|Datin Nora|Elena Rostova|Samantha Yeoh|Marcus Tan|Rachel Soo/.test(body));
  check("没有写死的 47 / 14,800 / 98.2%", !/98\.2%|RM 14,800|47 active/.test(body));
  check("🔴 没有假的付款方式 / PCI-DSS / 卡号", !/PCI-DSS|Visa|Mastercard|Amex|••••/.test(body));
  check("🔴 没有编出来的名额上限 / 福利清单 / Edit Plan", !/\d+ \/ \d+ Cap|Priority WhatsApp|Olaplex|Edit Plan/.test(body));

  console.log("\n② 四格数字");
  const t = (id) => page.getByTestId(id).innerText();
  const kActive = await t("kpi-active");
  check("🔴 在册 5 位（取消的 Dina 不算），本月新增 3", /\b5\b/.test(kActive) && /\+3 this month/.test(kActive), kActive);
  check("🔴 每月固定 RM 1,170", /RM 1,170/.test(await t("kpi-monthly")), await t("kpi-monthly"));
  const kColl = await t("kpi-collected");
  check("🔴 本月已收 RM 1,020，逾期 2 位", /RM 1,020/.test(kColl) && /2 overdue/.test(kColl), kColl);
  check("🔴 平均会员时长 0.8 个月", /0\.8\s*months/.test(await t("kpi-length")), await t("kpi-length"));

  console.log("\n③ 计划卡（从会员按计划名分组）");
  const cards = page.getByTestId("plan-card");
  check("两个计划", (await cards.count()) === 2, String(await cards.count()));
  const c1 = await cards.nth(0).innerText();
  check("🔴 VIP Monthly：3 位 · RM 150 / month · Most Popular", /VIP Monthly/.test(c1) && /3 members/.test(c1) && /RM 150/.test(c1) && /Most Popular/i.test(c1), c1);
  check("🔴 只算在册的：收了 RM 150（Gita），1 位逾期（Priya），Dina 取消了不算", /RM 150 collected to date/.test(c1) && /1 overdue/.test(c1), c1);
  const c2 = await cards.nth(1).innerText();
  check("🔴 Blowout Pass：2 位 · RM 360 · 收了 RM 720 · 1 位逾期（Fay）", /Blowout Pass/.test(c2) && /2 members/.test(c2) && /RM 360/.test(c2) && /RM 720 collected/.test(c2) && /1 overdue/.test(c2) && !/Most Popular/i.test(c2), c2);
  check("每张卡都有下次该缴的日期", /Next fee due \d+ \w+ \d{4}/.test(c1) && /Next fee due/.test(c2));

  console.log("\n④ 帐本");
  const rows = page.getByTestId("member-row");
  check("六位（含取消的）", (await rows.count()) === 6, String(await rows.count()));
  const fayRow = await rowOf(page, "Mem-Test Fay").innerText();
  check("🔴 Fay：累计已付 RM 720 · 逾期 · 有具体逾期天数", /RM 720/.test(fayRow) && /Payment Due/.test(fayRow) && /\d+ days? overdue/.test(fayRow), fayRow);
  const gitaRow = await rowOf(page, "Mem-Test Gita").innerText();
  check("Gita：RM 150 · Active · 电话在 · 上次付款是今天", /RM 150/.test(gitaRow) && /Active/.test(gitaRow) && /012-882 9104/.test(gitaRow), gitaRow);
  const dinaRow = await rowOf(page, "Mem-Test Dina").innerText();
  check("Dina：Cancelled，没有收款按钮", /Cancelled/.test(dinaRow) && /Reactivate/.test(dinaRow) && !/Collect/.test(dinaRow), dinaRow);
  check("🔴 排序：最逾期的在最上面（Priya 45 天前、然后 Fay），取消的在最下面（Dina）",
    /Priya/.test(await rows.nth(0).innerText()) && /Fay/.test(await rows.nth(1).innerText()) && /Dina/.test(await rows.nth(5).innerText()));
  check("分页签的数字是真的：All 6 · Active 5 · Overdue 2 · Cancelled 1", /All \(6\)/.test(body) && /Active \(5\)/.test(body) && /Overdue \(2\)/.test(body) && /Cancelled \(1\)/.test(body));
  check("页脚老实讲「手动收，自动扣款要先有收款闸道」", /collected by hand\. Automatic debit needs a payment gateway/.test(body));
  check("侧栏：Memberships 现在是一个真的连结，而且亮着",
    (await page.locator("aside a", { hasText: "Memberships" }).count()) === 1);
  await page.screenshot({ path: `${OUT}/1-full.png`, fullPage: true });

  console.log("\n⑤ 真的收一期");
  const before = await must("before", Promise.resolve(admin.from("membership_payments").select("id").eq("membership_id", mPriya.id)));
  check("（基线）Priya 还没收过", before.length === 0);
  await page.getByLabel(`Collect RM 150 from Mem-Test Priya`).click();
  await until(async () => (await admin.from("membership_payments").select("id").eq("membership_id", mPriya.id)).data?.length === 1);
  await until(async () => !/Not yet/.test(await rowOf(page, "Mem-Test Priya").innerText()));
  const pPay = await must("priya pays", Promise.resolve(admin.from("membership_payments").select("amount_cents, ledger_entry_id").eq("membership_id", mPriya.id)));
  check("🔴 真的记了一笔 RM 150 的会员费", pPay.length === 1 && Number(pPay[0].amount_cents) === 15000, JSON.stringify(pPay));
  const led = await must("ledger", Promise.resolve(admin.from("ledger_entries").select("category, amount_cents, direction").eq("id", pPay[0]?.ledger_entry_id ?? "00000000-0000-0000-0000-000000000000")));
  check("🔴 同时进了收款帐本：category = membership · 进来的钱", led.length === 1 && led[0].category === "membership" && led[0].direction === "in" && Number(led[0].amount_cents) === 15000, JSON.stringify(led));
  check("画面上 Priya 的累计变成 RM 150，而还是逾期（一期只推一个月）", /RM 150\b/.test(await rowOf(page, "Mem-Test Priya").innerText()) && /Payment Due/.test(await rowOf(page, "Mem-Test Priya").innerText()));
  await until(async () => /RM 1,170/.test(await t("kpi-collected")));
  check("🔴 本月已收跟着涨到 RM 1,170（1,020 + 150）", /RM 1,170/.test(await t("kpi-collected")), await t("kpi-collected"));

  console.log("\n⑥ 🔴 连按两下只收一次");
  await page.getByLabel(`Collect RM 150 from Mem-Test Ann`).dblclick();
  await until(async () => /RM 1,320/.test(await t("kpi-collected")));
  await new Promise((r) => setTimeout(r, 1500));
  const aPay = await must("ann pays", Promise.resolve(admin.from("membership_payments").select("id").eq("membership_id", (await must("annm", Promise.resolve(admin.from("memberships").select("id").eq("party_id", ann.id))))[0].id)));
  check("🔴 Ann 连按两下，资料库里只有一笔", aPay.length === 1, String(aPay.length));

  console.log("\n⑦ 取消 / 恢复");
  await page.getByLabel(`Cancel Mem-Test Eve's membership`).click();
  await waitText(page, /Cancelled \(2\)/);
  check("🔴 取消后：Cancelled 2 · Active 4，每月固定跟着降到 RM 810", /Cancelled \(2\)/.test(await page.locator("body").innerText()) && /Active \(4\)/.test(await page.locator("body").innerText()) && /RM 810/.test(await t("kpi-monthly")), await t("kpi-monthly"));
  const eveM = (await must("evem", Promise.resolve(admin.from("memberships").select("id, archived_at").eq("party_id", eve.id))))[0];
  check("资料库里真的收起来了（不是删掉）", !!eveM.archived_at);
  await page.getByRole("button", { name: /^Cancelled \(2\)/ }).click();
  await rowOf(page, "Mem-Test Eve").getByRole("button", { name: "Reactivate" }).click();
  await waitText(page, /Cancelled \(1\)/);
  const eveM2 = (await must("evem2", Promise.resolve(admin.from("memberships").select("archived_at").eq("party_id", eve.id))))[0];
  check("🔴 恢复回来了（Cancelled 又是 1，资料库的收起时间清掉）", !eveM2.archived_at && /Cancelled \(1\)/.test(await page.locator("body").innerText()));
  await page.getByRole("button", { name: /^All \(/ }).click();

  console.log("\n⑧ 新增一位会员");
  await page.getByRole("button", { name: "New Membership" }).click();
  const dlg = page.getByRole("dialog", { name: "New membership" });
  await dlg.getByRole("button", { name: "Create Membership" }).click();
  check("🔴 没选客人：讲要选谁", /Pick which client/.test(await page.getByTestId("form-error").innerText()));
  await dlg.getByLabel("Find client").fill("Zed");
  await dlg.getByLabel("Client", { exact: true }).selectOption({ label: "Mem-Test Zed" });
  await dlg.getByRole("button", { name: "Create Membership" }).click();
  check("🔴 没写计划名：讲要写计划名", /what the plan is called/.test(await page.getByTestId("form-error").innerText()));
  await dlg.getByLabel("Plan name").fill("Blowout Pass");
  check("🔴 打成已有的计划名，月费自己带出来（RM 360）", (await dlg.getByLabel("Monthly fee").inputValue()) === "360", await dlg.getByLabel("Monthly fee").inputValue());
  await dlg.getByLabel("Monthly fee").fill("0");
  await dlg.getByRole("button", { name: "Create Membership" }).click();
  check("🔴 月费 0：讲要写月费", /how much the plan costs/.test(await page.getByTestId("form-error").innerText()));
  await page.screenshot({ path: `${OUT}/2-form-error.png` });
  await dlg.getByLabel("Monthly fee").fill("360");
  await dlg.getByRole("button", { name: "Create Membership" }).click();
  await dlg.waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
  await until(async () => (await rowOf(page, "Mem-Test Zed").count()) === 1);
  const zedM = await must("zedm", Promise.resolve(admin.from("memberships").select("plan_name, monthly_fee_cents, started_on, next_due_on").eq("party_id", zed.id)));
  check("🔴 真的开了：Blowout Pass · RM 360 · 今天开始 · 第一期今天该缴", zedM.length === 1 && zedM[0].plan_name === "Blowout Pass" && Number(zedM[0].monthly_fee_cents) === 36000 && zedM[0].started_on === todayStr && zedM[0].next_due_on === todayStr, JSON.stringify(zedM));
  check("弹窗关了，Active 变 6", !(await page.getByRole("dialog").count()) && /Active \(6\)/.test(await page.locator("body").innerText()));
  check("🔴 两个计划现在都是 3 位，「Most Popular」该消失（平手不乱标）", (await page.getByText("Most Popular").count()) === 0);

  console.log("\n⑨ 搜索 / 分页签");
  await page.getByLabel("Search memberships").fill("priya");
  check("搜「priya」只剩 1 位", (await rows.count()) === 1);
  await page.getByLabel("Search memberships").fill("blowout");
  check("按计划名搜「blowout」得 3 位（Eve · Fay · Zed）", (await rows.count()) === 3, String(await rows.count()));
  await page.getByLabel("Search memberships").fill("zzzz");
  check("搜不到时讲一句", /No membership matches that/.test(await page.locator("body").innerText()));
  await page.getByLabel("Search memberships").fill("");
  await page.getByRole("button", { name: /^Overdue \(/ }).click();
  check("🔴 只看逾期：Fay 跟 Priya", (await rows.count()) === 2 && /Fay/.test(await rows.nth(0).innerText()) && /Priya/.test(await rows.nth(1).innerText()));
  await page.getByRole("button", { name: /^All \(/ }).click();

  console.log("\n⑩ 导出 / 列印");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export Ledger" }).click()]);
  const csv = readFileSync(await dl.path(), "utf8").trim().split("\n");
  check("🔴 收款记录 CSV：表头 ＋ 6 笔（Gita 1 · Fay 2 · Dina 1 · Priya 1 · Ann 1）", csv.length === 7 && /Paid on/.test(csv[0]) && csv.filter((l) => /Mem-Test Fay/.test(l)).length === 2 && /"150\.00"/.test(csv.join("\n")) && /"360\.00"/.test(csv.join("\n")), csv.join(" | "));
  await page.emulateMedia({ media: "print" });
  check("🔴 列印时侧栏不见了、按钮不见了、帐本还在", !(await page.locator("aside").first().isVisible()) && !(await page.getByRole("button", { name: "Export Ledger" }).isVisible()) && (await page.getByText("Members & Fee Ledger").isVisible()));
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: `${OUT}/3-after.png`, fullPage: true });

  console.log("\n⑪ 员工登入：整页看不到钱");
  const staffEmail = `mem-staff-${stamp}@formae.test`;
  const staffPassword = `Ms-${stamp}-x!`;
  const { data: staffUser, error: sErr } = await admin.auth.admin.createUser({ email: staffEmail, password: staffPassword, email_confirm: true });
  if (sErr) throw new Error(`createUser staff: ${sErr.message}`);
  await must("member", api.rpc("add_project_member", { in_email: staffEmail }));
  const staffPage = await login(browser, staffEmail, staffPassword).catch(async () => null);
  if (staffPage) {
    await staffPage.goto(`${BASE}/en/salon-preview/memberships`, { waitUntil: "networkidle", timeout: 180000 });
    const sb = await staffPage.locator("body").innerText();
    check("🔴 员工只看到「只有老板看得到」，一个数字都没有", /only visible to the business owner/.test(sb) && !/RM 1,|Mem-Test/.test(sb), sb.slice(0, 200));
  } else no("员工登入失败");
  admin.auth.admin.deleteUser(staffUser.user.id).catch(() => {});

  console.log("\n⑫ 一间什么资料都没有的新店");
  const emptyEmail = `mem-empty-${stamp}@formae.test`;
  const emptyPassword = `Mx-${stamp}-x!`;
  const { data: eu, error: eErr } = await admin.auth.admin.createUser({ email: emptyEmail, password: emptyPassword, email_confirm: true });
  if (eErr) throw new Error(`createUser empty: ${eErr.message}`);
  emptyId = eu.user.id;
  const emptyPage = await login(browser, emptyEmail, emptyPassword);
  await emptyPage.goto(`${BASE}/en/salon-preview/memberships`, { waitUntil: "networkidle", timeout: 180000 });
  const eb = await emptyPage.locator("body").innerText();
  check("零个数字，没有 NaN", !/NaN|undefined|Infinity/.test(eb) && /RM 0/.test(await emptyPage.getByTestId("kpi-monthly").innerText()) && /—/.test(await emptyPage.getByTestId("kpi-length").innerText()));
  check("没有计划时讲一句", (await emptyPage.getByTestId("plans-empty").count()) === 1);
  check("没有会员时讲一句，而且没有搜索框", (await emptyPage.getByTestId("ledger-empty").count()) === 1 && (await emptyPage.getByLabel("Search memberships").count()) === 0);
  await emptyPage.screenshot({ path: `${OUT}/4-empty.png`, fullPage: true });
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
