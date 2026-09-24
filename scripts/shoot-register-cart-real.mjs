/**
 * 收银台的购物车、结帐、代金券、拆两种付款方式、暂放、收据列印 ——
 * 老板 2026-09-24 纠正之后重做的那一版：不是「有没有反应」,是「够不够格
 * 跟大厂的收银台比」。这一支验的是真的购物车、真的结帐(走跟总览、每日结帐
 * 同一支 add_ledger_entry)、真的代金券(走 credit_of/use_credit)、真的
 * 拆两种付款方式(两笔 add_ledger_entry)、真的收据(用列印规则量,不是
 * 只看画面上有没有字)、真的暂放(sessionStorage,同一台电脑)。
 *
 * 🔴 最后一段是员工(柜台)的登入真的在浏览器里按一次「结帐」——
 * 任务 411:`add_ledger_entry` 原本只认帐号老板本人(`account_id = auth.uid()`),
 * 这一支第一版量到的就是员工按结帐会拿到一句 `not your project`。他拍板
 * 「肯定要放宽给员工」之后,20260924020000 把闸门换成 `works_here`,而且只放宽
 * 「客人付给我们的钱」。守卫在 check:ledger-staff,这里补的是它够不到的那一半:
 * 员工真的坐在收银台前,一路点到收据。
 *
 * 种两件真货品(带真价钱)、一位真客人(带一笔真的送出去的礼券)。
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/register-cart-real";
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
let staffId = null;
dropThrowawayOnExit(admin, () => [userId, staffId]);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };

let browser;
try {
  const stamp = Date.now();
  const email = `regcart-${stamp}@formae.test`;
  const password = `Rc-${stamp}-x!`;
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

  for (const k of ["customers", "inventory", "bookings"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  const itemA = await api.rpc("add_catalog_item", {
    in_project_id: pid, in_module_key: "inventory",
    in_name: "Cart-Test Keratin Wash", in_unit: "session", in_sku: "CART-01",
  });
  if (itemA.error) throw new Error(`itemA: ${itemA.error.message}`);
  await admin.from("catalog_items").update({ price_cents: 10000 }).eq("id", itemA.data.id);

  const guest = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Cart-Test Guest",
  });
  if (guest.error) throw new Error(`guest: ${guest.error.message}`);

  const gift = await api.rpc("grant_credit", {
    in_project_id: pid, in_party_id: guest.data.id, in_amount_cents: 3000, in_reason: "Birthday",
  });
  if (gift.error) throw new Error(`gift: ${gift.error.message}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/salon-preview/register`, { waitUntil: "networkidle", timeout: 180000 });

  // ── 1. 真的购物车 ─────────────────────────────────────────────────────
  const addBtn = page.locator('h3:has-text("Cart-Test Keratin Wash")').locator("..").locator("..").getByRole("button").last();
  await addBtn.click();
  await addBtn.click(); // 按两次 -- 应该是同一行数量变 2,不是两行
  let body = await page.locator("body").innerText();
  if (/2×\s*Cart-Test Keratin Wash/.test(body)) ok("🔴 加两次同一件货,变成同一行数量 2(不是两行)");
  else no("购物车没有正确加总数量", body.match(/Keratin Wash[\s\S]{0,20}/)?.[0]);

  // ── 2. 真的挂客人 ─────────────────────────────────────────────────────
  await page.getByTitle("Attach Client").click();
  await page.locator("select").selectOption({ label: "Cart-Test Guest" });
  body = await page.locator("body").innerText();
  if (/Cart-Test Guest/.test(body)) ok("🔴 真的挂上一个真客人(不是打字乱猜)");
  else no("挂客人没有成功");

  // ── 3. 真的折扣(行内表单,不是浏览器 prompt) ──────────────────────────
  await page.getByText("Custom Discount / Tip").click();
  await page.locator('input[type="number"]').first().fill("20");
  await page.getByText("Apply", { exact: true }).click();
  body = await page.locator("body").innerText();
  if (/Discount: RM 20/.test(body)) ok("🔴 折扣是行内表单填出来的真数字,不是弹出一个浏览器输入框");
  else no("折扣没有生效", body.match(/Discount[\s\S]{0,30}/)?.[0]);

  // 200 - 20 = 180
  if (/RM\s*180(\.00)?\b/.test(body)) ok("🔴 折扣扣完之后总额是真的算出来的(200-20=180)");
  else no("折扣之后的总额不对");

  // ── 4. 真的代金券(走真的储值卡余额) ──────────────────────────────────
  await page.getByTitle(/gift credit/).click();
  body = await page.locator("body").innerText();
  if (/Voucher: -RM 30/.test(body)) ok("🔴 代金券用的是这位客人真的储值余额(RM 30),不是编的数字");
  else no("代金券没有套用", body.match(/Voucher[\s\S]{0,30}/)?.[0]);
  // 180 - 30 = 150
  if (/RM\s*150(\.00)?\b/.test(body)) ok("🔴 代金券扣完之后总额是真的算出来的(180-30=150)");
  else no("代金券之后的总额不对");

  // ── 5. 真的拆两种付款方式(行内表单) ───────────────────────────────────
  await page.getByText("Split Bill", { exact: true }).click();
  await page.locator('input[type="number"]').last().fill("50");
  body = await page.locator("body").innerText();
  if (/On DuitNow QR/.test(body) && /RM\s*100(\.00)?\b/.test(body)) ok("🔴 拆帐是行内表单,第一种方式自动算出剩下那一份(150-50=100)");
  else no("拆帐没有正确显示两边的金额");

  await page.screenshot({ path: `${OUT}/1-cart-with-discount-voucher-split.png`, fullPage: true });

  // ── 6. 真的结帐 -- 走跟总览、每日结帐同一支 add_ledger_entry ─────────
  await page.getByRole("button", { name: /Charge RM/ }).click();
  await page.waitForTimeout(2500);
  body = await page.locator("body").innerText();
  if (/Charged & Printed/.test(body)) ok("🔴 结完帐真的换成收据画面(不是留在同一张购物车上)");
  else no("结帐之后没有换成收据画面", body.slice(0, 200));

  // 收据本身的内容
  if (/Cart-Test Guest/.test(body) && /2×\s*Cart-Test Keratin Wash/.test(body)) ok("🔴 收据上印的是这一笔真的品项跟真的客人");
  else no("收据内容不对");
  // 净额是 200(货) - 20(折扣) - 30(代金券) = 150,不是拆帐第一份的 100 ——
  // 拆帐只是把这 150 分给两种付款方式,不会改变净额本身。
  if (/Total Paid[\s\S]{0,12}RM\s*150(\.00)?\b/.test(body)) ok("🔴 收据上的 Total Paid 是真的算出来的净额 150(200 - 20 折扣 - 30 代金券)");
  else no("收据上的总额不对", body.match(/Total Paid[\s\S]{0,30}/)?.[0]);

  // ── 7. 用列印规则量,不是只看画面 -- @media print 底下只留收据那一块 ──
  await page.emulateMedia({ media: "print" });
  const sidebarVisibleUnderPrint = await page.locator("nav, aside").first().isVisible().catch(() => false);
  const sheetVisibleUnderPrint = await page.locator("[data-print-sheet]").isVisible();
  await page.emulateMedia({ media: "screen" });
  if (sheetVisibleUnderPrint && !sidebarVisibleUnderPrint) ok("🔴 列印规则真的接上了:@media print 底下只剩收据那一张纸,侧栏不见了");
  else no("列印规则没有正确接上", `sheet visible=${sheetVisibleUnderPrint} sidebar visible=${sidebarVisibleUnderPrint}`);

  // ── 8. 真的换算过的钱 -- 拿真的资料库数字核对,不是只信画面 ───────────
  const { data: ledgerRows } = await admin
    .from("ledger_entries")
    .select("amount_cents, method, party_id")
    .eq("project_id", pid)
    .eq("direction", "in");
  const total = (ledgerRows ?? []).reduce((s, r) => s + Number(r.amount_cents), 0);
  const methods = new Set((ledgerRows ?? []).map((r) => r.method));
  // 净额 150 拆成 QR 100 + Cash 50 -- 两笔真的进帐,加起来等於净额,不等於
  // 拆帐第一份的 100。代金券的 30 不算在这里,它走的是 stored_value_moves。
  if (total === 15000) ok("🔴 帐上真的进了 RM 150(两笔真的收款加起来,跟收据的净额一致)");
  else no("帐上的真实总额不对", `total_cents=${total}`);
  if (methods.has("DuitNow QR") && methods.has("Cash Drawer")) ok("🔴 帐上真的是两笔、两种付款方式(拆帐不是装样子)");
  else no("帐上没有两笔不同方式", [...methods].join(","));

  const { data: creditMoves } = await admin
    .from("stored_value_moves")
    .select("direction, amount_cents")
    .eq("project_id", pid)
    .eq("party_id", guest.data.id)
    .eq("direction", "out");
  if ((creditMoves ?? []).some((m) => Number(m.amount_cents) === 3000)) ok("🔴 代金券真的扣掉了她的储值卡(走 use_credit,不是只在画面上扣看看)");
  else no("储值卡没有真的被扣");

  // ── 9. 真的暂放(sessionStorage,这台电脑上) ───────────────────────────
  await page.getByRole("button", { name: "New Sale" }).click();
  await page.waitForTimeout(300);
  const addBtn2 = page.locator('h3:has-text("Cart-Test Keratin Wash")').locator("..").locator("..").getByRole("button").last();
  await addBtn2.click();
  await page.waitForTimeout(200);
  await page.getByTitle("Hold Folio").click();
  await page.waitForTimeout(300);
  body = await page.locator("body").innerText();
  // "Parked Tickets" 那个标签有 `uppercase` 的 CSS,innerText 读到的是渲染后的
  // 「PARKED TICKETS」—— 这整个 session 撞过好几次同一个坑,这里要用不分大小写。
  if (/Parked Tickets/i.test(body) && /1× Cart-Test Keratin Wash/.test(body)) ok("🔴 暂放真的把这一张单存起来,而且购物车清空了");
  else no("暂放没有正确生效", body.match(/PARKED TICKETS[\s\S]{0,120}/i)?.[0]);
  const stored = await page.evaluate(() => sessionStorage.getItem("formae-register-parked-v1"));
  if (stored && JSON.parse(stored).length === 1) ok("🔴 暂放真的写进了这台电脑的 sessionStorage(不是只存在内存里,重新整理会不见)");
  else no("sessionStorage 里没有真的存到");

  // 恢复暂放的单
  await page.locator("text=Walk-in").first().click();
  body = await page.locator("body").innerText();
  if (/1×\s*Cart-Test Keratin Wash/.test(body) && !/Parked Tickets[\s\S]{0,50}1× Cart-Test Keratin Wash/.test(body)) ok("🔴 点回那张暂放的单,真的恢复成购物车,而且从暂放清单里消失");
  else no("恢复暂放的单没有成功");

  await page.screenshot({ path: `${OUT}/2-hold-and-resume.png`, fullPage: true });

  // ── 10. 诚实没接的两件 ────────────────────────────────────────────────
  let sawDialog = false;
  page.once("dialog", (d) => { sawDialog = true; d.accept(); });
  await page.getByRole("button", { name: "Scan SKU" }).click();
  await page.waitForTimeout(300);
  if (sawDialog) ok("Scan SKU 老实讲一句还没接,不是完全没反应");
  else no("Scan SKU 按下去什么都没发生");

  // ── 11. 🔴 员工(柜台)真的按得了结帐 —— 任务 411,他拍板放宽 ─────────────
  const staffEmail = `regcart-staff-${stamp}@formae.test`;
  const staffPassword = `Rs-${stamp}-x!`;
  const { data: staffUser, error: staffMkErr } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  });
  if (staffMkErr) throw new Error(`createUser staff: ${staffMkErr.message}`);
  staffId = staffUser.user.id;
  const memberAdd = await api.rpc("add_project_member", { in_email: staffEmail });
  if (memberAdd.error) throw new Error(`add_project_member: ${memberAdd.error.message}`);

  // 11a. 资料库这一层(守卫 check:ledger-staff 量得更细,这里只留最要紧的两条)
  const staffApi = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await staffApi.auth.signInWithPassword({ email: staffEmail, password: staffPassword });
  const staffCharge = await staffApi.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 5000, in_party: "Staff Test", in_category: "service", in_note: "test",
  });
  if (!staffCharge.error) ok("🔴 员工登入呼叫收款成功了(任务 411 放宽之后)");
  else no("员工登入收款还是被挡", staffCharge.error.message);
  const staffOut = await staffApi.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 5000, in_party: "Supplier", in_note: "staff tries expense",
  });
  if (staffOut.error) ok("🔴 付出去的钱仍然只有老板(放宽只放了「客人付的钱」)");
  else no("员工居然记得下一笔开销 —— 放宽放过头了");

  // 11b. 真的浏览器:员工坐在收银台前,一路点到收据
  const staffCtx = await browser.newContext({ viewport: { width: 1700, height: 1300 } });
  const staffPage = await staffCtx.newPage();
  await staffPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await staffPage.fill('input[type="email"]', staffEmail);
  await staffPage.fill('input[type="password"]', staffPassword);
  await staffPage.click('button[type="submit"]');
  await staffPage.waitForURL(/portal/, { timeout: 180000 });
  await staffPage.goto(`${BASE}/en/salon-preview/register`, { waitUntil: "networkidle", timeout: 180000 });

  let staffBody = await staffPage.locator("body").innerText();
  if (!/Shift Takings/i.test(staffBody)) ok("员工看不到「今天收了多少」(那是老板的数字,这次放宽没有把它一起放出来)");
  else no("员工居然看得到 Shift Takings");
  if (/Cart-Test Keratin Wash/.test(staffBody)) ok("员工看得到货架上的货(能开始结帐)");
  else no("员工的收银台看不到货品", staffBody.slice(0, 200));

  const staffAdd = staffPage.locator('h3:has-text("Cart-Test Keratin Wash")').locator("..").locator("..").getByRole("button").last();
  await staffAdd.click();
  await staffPage.getByRole("button", { name: /Charge RM/ }).click();
  await staffPage.waitForTimeout(3000);
  staffBody = await staffPage.locator("body").innerText();
  await staffPage.screenshot({ path: `${OUT}/3-staff-charged.png`, fullPage: true });
  if (/Charged & Printed/.test(staffBody)) ok("🔴 员工登入真的按完「结帐」,拿到收据(不是一句资料库的英文错误)");
  else no("员工按结帐没有拿到收据", staffBody.match(/Charge[\s\S]{0,200}/)?.[0]);

  const { data: staffRows } = await admin
    .from("ledger_entries")
    .select("amount_cents, direction, recorded_by")
    .eq("project_id", pid)
    .eq("recorded_by", staffId)
    .ilike("note", "%Cart-Test Keratin Wash%");
  if (staffRows?.length === 1 && Number(staffRows[0].amount_cents) === 10000 && staffRows[0].direction === "in")
    ok("🔴 帐上多了那一笔 RM 100,而且记的是**员工自己**(谁收的钱查得到)");
  else no("员工那一笔在帐上不对", JSON.stringify(staffRows));

} finally {
  if (browser) await browser.close();
  await dropThrowaways(admin, [userId, staffId]);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
