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
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));
async function must(label, p) {
  const r = await p;
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}
async function until(fn, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

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

  // 她更早的两次来访(29 天前、57 天前)——「她平常几天来一次」要三个不同的
  // 来访日才算得出来（两次只有一个间隔，一个间隔不是习惯，见 party_visits），
  // 这样中位数间隔是 28 天，Book Next 的「Her usual」才有东西可建议。
  // ⚠️ 要在她买套票之前做完，不然「做完」会顺手扣掉一次套票，
  // 套票那几条断言(剩 6 次)就不是原来的意思了。
  for (const [daysAgo, service] of [[29, "Root Touch-up"], [57, "Gloss Treatment"]]) {
    const st = new Date(Date.now() - daysAgo * 24 * 3600 * 1000); st.setUTCHours(2, 30, 0, 0);
    const en = new Date(st); en.setUTCHours(4, 0, 0, 0);
    const older = await api.rpc("add_appointment", {
      in_project_id: pid, in_module_key: "bookings",
      in_starts_at: st.toISOString(), in_ends_at: en.toISOString(),
      in_party: "Clients-Test Nora", in_party_id: vip.data.id, in_staff_id: jasmine.data.id,
      in_service: service,
    });
    if (older.error) throw new Error(`older visit: ${older.error.message}`);
    const olderDone = await api.rpc("set_appointment_status", { in_id: older.data, in_status: "done" });
    if (olderDone.error) throw new Error(`older done: ${olderDone.error.message}`);
  }

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
  // 她一笔 RM 55 的收款——发票页按客人筛的时候，这一笔一定要被筛掉。
  const chongPay = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 5500, in_party: "Clients-Test Regular Chong", in_party_id: regular.data.id,
    in_category: "service", in_note: "Toner",
  });
  if (chongPay.error) throw new Error(`chong pay: ${chongPay.error.message}`);

  browser = await chromium.launch();
  const ownerPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await ownerPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await ownerPage.fill('input[type="email"]', email);
  await ownerPage.fill('input[type="password"]', password);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForURL(/portal/, { timeout: 180000 });

  // 整个过程一个 alert() 都不能弹出来——以前六处按钮都是弹一句「还没接」。
  const alerts = [];
  ownerPage.on("dialog", (d) => { alerts.push(d.message()); d.dismiss().catch(() => {}); });

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

  // ═══ 任务 415：六处按钮全部接上（以前每一处都只弹一句「还没接」）═══════════
  const todayMY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const plusDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const customers = async () => must("customers", Promise.resolve(admin.from("directory_entries").select("id, name, phone, whatsapp, status, note").eq("project_id", pid).eq("module_key", "customers")));
  const dlgOf = (name) => ownerPage.getByRole("dialog", { name });
  const closeX = async () => { await ownerPage.getByRole("button", { name: "Close panel" }).click(); await ownerPage.getByRole("dialog").waitFor({ state: "detached" }); };
  const pickClient = async (name) => { await ownerPage.locator('section[aria-label="Client Directory"]').getByText(name).first().click(); await ownerPage.waitForTimeout(250); };

  // ① New Client Folio → add_directory_entry
  console.log("\n① New Client Folio");
  await ownerPage.getByRole("button", { name: /New Client Folio/ }).click();
  let dlg = dlgOf("New client");
  await dlg.waitFor();
  await dlg.getByRole("button", { name: "Add Client" }).click();
  check("🔴 没写名字就按 Add Client：讲一句人话，一位客人都没多", /Give her a name/.test(await dlg.innerText()) && (await customers()).length === 3, `${(await customers()).length}`);
  await dlg.getByLabel("Name").fill("Somebody New");
  await dlg.getByLabel("Phone").fill("012 553 0921");
  check("🔴 打的电话跟 Nora 是同一个号码：面板指出她是谁（不拦，一家人常常共用）", /already saved for\s*Clients-Test Nora/.test(await dlg.innerText()), (await dlg.innerText()).slice(0, 200));
  await dlg.getByLabel("Phone").fill("");
  await dlg.getByLabel("Name").fill("clients-test nora");
  check("🔴 同名（大小写不同）也指出来", /name already exists:\s*Clients-Test Nora/i.test(await dlg.innerText()));
  await dlg.getByLabel("Name").fill("Clients-Test Fresh Wan");
  await dlg.getByLabel("Phone").fill("017-888 9999");
  await dlg.getByLabel("Tag").fill("Brow Regular");
  await dlg.getByLabel("Notes").fill("Allergic to henna");
  check("电话一填，「她也在用这个号码的 WhatsApp」的勾出现，而且默认勾上", await dlg.getByRole("checkbox").isChecked());
  await ownerPage.screenshot({ path: `${OUT}/4-new-client-panel.png`, fullPage: true });
  await dlg.getByRole("button", { name: "Add Client" }).dblclick();
  await until(async () => (await customers()).length >= 4);
  await ownerPage.waitForTimeout(1500);
  const afterAdd = await customers();
  const fresh = afterAdd.find((c) => c.name === "Clients-Test Fresh Wan");
  check("🔴 连按两下 Add Client 只多一位客人（防重复）", afterAdd.length === 4, String(afterAdd.length));
  check("🔴 真的存进 directory_entries：名字 · 电话 · WhatsApp（勾了就是同一个号码）· 标签 · 备注",
    !!fresh && fresh.phone === "017-888 9999" && fresh.whatsapp === "017-888 9999" && fresh.status === "Brow Regular" && fresh.note === "Allergic to henna", JSON.stringify(fresh));
  await until(async () => (await ownerPage.locator("h2", { hasText: "Clients-Test Fresh Wan" }).count()) === 1);
  check("🔴 存完直接落在她的档案上（不是停在别人身上）", (await ownerPage.locator("h2", { hasText: "Clients-Test Fresh Wan" }).count()) === 1);
  check("面板关了", (await ownerPage.getByRole("dialog").count()) === 0);

  // ② Edit Profile → update_directory_entry
  console.log("\n② Edit Profile");
  await pickClient("Clients-Test Nora");
  await ownerPage.getByRole("button", { name: /Edit Profile/ }).click();
  dlg = dlgOf("Edit profile");
  await dlg.waitFor();
  check("🔴 面板打开时带着她现在的资料（不是空的）", (await dlg.getByLabel("Phone").inputValue()) === "012-553 0921" && (await dlg.getByLabel("Notes").inputValue()) === "Prefers quiet service, warm green tea");
  await dlg.getByLabel("Name").fill("");
  await dlg.getByRole("button", { name: "Save Changes" }).click();
  check("🔴 把名字清空按保存：讲一句人话，名字没被改成空的", /She needs a name/.test(await dlg.innerText()) && (await customers()).some((c) => c.name === "Clients-Test Nora"));
  await dlg.getByLabel("Name").fill("Clients-Test Nora");
  await dlg.getByLabel("Phone").fill("012-999 0000");
  await dlg.getByLabel("Tag").fill("VIP Gold");
  await dlg.getByLabel("Notes").fill("");
  await ownerPage.screenshot({ path: `${OUT}/5-edit-panel.png`, fullPage: true });
  await dlg.getByRole("button", { name: "Save Changes" }).click();
  await until(async () => (await customers()).find((c) => c.name === "Clients-Test Nora")?.phone === "012-999 0000");
  const nora = (await customers()).find((c) => c.name === "Clients-Test Nora");
  check("🔴 真的改了：电话、标签；备注清空就是清空", nora.phone === "012-999 0000" && nora.status === "VIP Gold" && nora.note === "", JSON.stringify(nora));
  await until(async () => /VIP Gold/i.test(await ownerPage.locator("body").innerText()));
  body = await ownerPage.locator("body").innerText();
  check("🔴 画面跟着变：新标签出现，「Notes on File」那一块因为备注空了而消失", /VIP Gold/i.test(body) && !/Notes on File/.test(body));

  // ③ Book Next → add_appointment，从她自己上一次来访开始
  console.log("\n③ Book Next");
  await ownerPage.getByRole("button", { name: /Book Next/ }).click();
  dlg = dlgOf("Book next appointment");
  await dlg.waitFor();
  check("🔴 服务预填她上次做的（Full Balayage & Gloss Toner）", (await dlg.getByLabel("Service").inputValue()) === "Full Balayage & Gloss Toner");
  check("🔴 师傅预填她平常那位（Jasmine）", (await dlg.getByLabel("Stylist").inputValue()) === jasmine.data.id);
  check("🔴 开始时间预填她平常的钟点（10:30），结束 = 开始 + 她上次那么久（90 分钟 → 12:00）",
    (await dlg.getByLabel("Start time").inputValue()) === "10:30" && (await dlg.getByLabel("End time").inputValue()) === "12:00",
    `${await dlg.getByLabel("Start time").inputValue()}–${await dlg.getByLabel("End time").inputValue()}`);
  check("🔴 「Her usual」日期预填了（两次来访相隔 28 天 → 上次来访再加 28 天）", (await dlg.getByLabel("Day").inputValue()) === plusDays(apptStart.toISOString().slice(0, 10), 28) && (await dlg.getByTestId("usual-date").count()) === 1, await dlg.getByLabel("Day").inputValue());
  await dlg.getByRole("button", { name: "In 4 weeks" }).click();
  check("点「In 4 weeks」：日期变成四个星期后", (await dlg.getByLabel("Day").inputValue()) === plusDays(todayMY, 28));
  await dlg.getByTestId("usual-date").click();
  await dlg.getByLabel("Day").fill(plusDays(todayMY, -3));
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  check("🔴 订一个已经过去的日子：讲一句人话，没有订", /already passed/.test(await dlg.innerText()));
  await dlg.getByTestId("usual-date").click();
  await dlg.getByLabel("Start time").fill("14:00");
  check("改开始时间，结束跟着走（14:00 → 15:30）", (await dlg.getByLabel("End time").inputValue()) === "15:30");
  await ownerPage.screenshot({ path: `${OUT}/6-book-next-panel.png`, fullPage: true });
  const nextDay = plusDays(apptStart.toISOString().slice(0, 10), 28);
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  await dlg.getByTestId("booked-note").waitFor({ timeout: 30000 });
  const booked = await must("booked", Promise.resolve(admin.from("appointments").select("starts_at, ends_at, party_id, staff_id, service, status").eq("project_id", pid).eq("status", "booked")));
  check("🔴 真的订下去了：她的名册身分 · Jasmine · 14:00–15:30（马来西亚时间）· 同一个服务",
    booked.length === 1 && booked[0].party_id === vip.data.id && booked[0].staff_id === jasmine.data.id &&
      new Date(booked[0].starts_at).getTime() === new Date(`${nextDay}T14:00:00+08:00`).getTime() &&
      new Date(booked[0].ends_at).getTime() === new Date(`${nextDay}T15:30:00+08:00`).getTime() && booked[0].service === "Full Balayage & Gloss Toner",
    JSON.stringify(booked));
  check("面板讲了订在哪天哪个钟点", /Booked for/.test(await dlg.getByTestId("booked-note").innerText()) && /14:00–15:30/.test(await dlg.getByTestId("booked-note").innerText()));
  await ownerPage.getByRole("button", { name: "Close", exact: true }).click();
  await until(async () => (await ownerPage.getByTestId("next-booking").count()) === 1);
  check("🔴 她的档案上多了一行「Next: …」写着刚订的那一次", /14:00 - 15:30/.test(await ownerPage.getByTestId("next-booking").innerText()) && /Full Balayage/.test(await ownerPage.getByTestId("next-booking").innerText()), await ownerPage.getByTestId("next-booking").innerText().catch(() => ""));
  // 同一位师傅同一个钟点再订一次 → 资料库自己的「撞时段」
  await ownerPage.getByRole("button", { name: /Book Next/ }).click();
  dlg = dlgOf("Book next appointment");
  await dlg.getByTestId("usual-date").click();
  await dlg.getByLabel("Start time").fill("14:00");
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  await until(async () => /already taken/i.test(await dlg.innerText()));
  check("🔴 同一位师傅同一个钟点再订：印资料库自己那句「已经有人了」", /already taken/i.test(await dlg.innerText()), (await dlg.innerText()).slice(0, 200));
  check("撞了的那笔没有存", (await must("booked2", Promise.resolve(admin.from("appointments").select("id").eq("project_id", pid).eq("status", "booked")))).length === 1);
  await closeX();

  // ④ Redeem Session → use_package_session
  console.log("\n④ Redeem Session");
  await ownerPage.getByRole("button", { name: /Redeem Session/ }).click();
  dlg = dlgOf("Use a package session");
  await dlg.waitFor();
  check("🔴 面板列出她的套票跟真的剩余（6 of 10 left）", (await dlg.getByRole("radio").count()) === 1 && /6 of 10 left/.test(await dlg.getByRole("radio").innerText()), await dlg.innerText());
  await dlg.getByLabel("Done by").selectOption({ label: "Clients-Test Jasmine" });
  await ownerPage.screenshot({ path: `${OUT}/7-redeem-panel.png`, fullPage: true });
  await dlg.getByRole("button", { name: "Use 1 Session" }).click();
  await dlg.getByTestId("redeem-note").waitFor({ timeout: 30000 });
  check("🔴 面板讲「用掉一次 · 还剩 5 次」", /One session of Fusio-Dose Caviar 10-Session Pass used — 5 left/.test(await dlg.getByTestId("redeem-note").innerText()), await dlg.getByTestId("redeem-note").innerText());
  const packs = await must("packs", Promise.resolve(admin.from("service_packages").select("id").eq("project_id", pid)));
  const uses = await must("uses", Promise.resolve(admin.from("package_uses").select("id, staff_id").eq("package_id", packs[0].id)));
  check("🔴 资料库里真的多了一次（4 → 5），记在 Jasmine 名下", uses.length === 5 && uses.filter((u) => u.staff_id === jasmine.data.id).length === 1, `${uses.length}`);
  await ownerPage.getByRole("button", { name: "Close", exact: true }).click();
  await until(async () => /5 Sessions Redeemed/.test(await ownerPage.locator("body").innerText()));
  check("🔴 套票卡跟着变：5 次用掉", /5 Sessions Redeemed/.test(await ownerPage.locator("body").innerText()));
  await pickClient("Clients-Test Plain Bakri");
  check("🔴 没有套票的客人：根本没有 Redeem Session 这颗按钮（不画一颗按下去一定失败的）", (await ownerPage.getByRole("button", { name: /Redeem Session/ }).count()) === 0);

  // ⑤ 发票 · 收银台：带着她过去
  console.log("\n⑤ Recent Payments · 发票 · 收银台");
  await pickClient("Clients-Test Nora");
  check("🔴 「Prescribed Homecare Regulars」那块假的不见了", !/Homecare/.test(await ownerPage.locator("body").innerText()));
  check("🔴 「Recent Payments」列出她真的收款（RM 740）", (await ownerPage.getByTestId("payment-row").count()) === 1 && /RM\s*740/.test(await ownerPage.getByTestId("payment-row").innerText()));
  await ownerPage.screenshot({ path: `${OUT}/8-recent-payments.png`, fullPage: true });
  await ownerPage.getByRole("link", { name: /View all invoices/ }).click();
  await ownerPage.waitForURL(/salon-preview\/invoices\?client=/, { timeout: 60000 });
  await ownerPage.getByTestId("client-filter").waitFor({ timeout: 60000 });
  body = await ownerPage.locator("body").innerText();
  check("🔴 发票页只剩她的：写着「只看 Clients-Test Nora」，Chong 那笔 RM 55 被筛掉", /Clients-Test Nora/.test(await ownerPage.getByTestId("client-filter").innerText()) && !/Regular Chong/.test(body), body.slice(0, 200));
  await ownerPage.screenshot({ path: `${OUT}/9-invoices-filtered.png`, fullPage: true });
  await ownerPage.getByRole("link", { name: "Show all" }).click();
  await until(async () => /Regular Chong/.test(await ownerPage.locator("body").innerText()));
  check("🔴 点「Show all」：两位的收款都回来了，筛选条不见", /Regular Chong/.test(await ownerPage.locator("body").innerText()) && (await ownerPage.getByTestId("client-filter").count()) === 0);
  await ownerPage.goto(`${BASE}/en/salon-preview/invoices?client=not-a-uuid`, { waitUntil: "networkidle", timeout: 180000 });
  check("🔴 网址里乱写的 client 不会搞坏整页：忽略它，显示全部", (await ownerPage.getByTestId("client-filter").count()) === 0 && /Regular Chong/.test(await ownerPage.locator("body").innerText()));
  await ownerPage.goto(`${BASE}/en/salon-preview/clients`, { waitUntil: "networkidle", timeout: 180000 });
  await pickClient("Clients-Test Nora");
  await ownerPage.getByRole("link", { name: /Charge in Register/ }).click();
  await ownerPage.waitForURL(/salon-preview\/register\?client=/, { timeout: 60000 });
  await until(async () => /Clients-Test Nora/.test(await ownerPage.locator("body").innerText()));
  body = await ownerPage.locator("body").innerText();
  check("🔴 收银台打开时她已经挂在这一单上（不用再挑一次客人）", /Clients-Test Nora/.test(body) && !/Select a client/.test(body));
  await ownerPage.screenshot({ path: `${OUT}/10-register-with-client.png`, fullPage: true });
  check("🔴 整个过程一个「还没接」的 alert() 都没弹", alerts.length === 0, alerts.join(" | "));

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
  check("🔴 员工身分看不到「Recent Payments」（那是她的钱），但订位 · 改资料的按钮都在",
    !/Recent Payments/.test(staffBody) && /Book Next/.test(staffBody) && /Edit Profile/.test(staffBody));
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
