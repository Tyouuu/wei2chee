/**
 * 沙龙新设计的 Schedule（Floor Timeline gantt）——从四个手写师傅的示范资料
 * 换成真的 appointments。真登入、真截图。
 *
 * ── 为什么（2026-09-24，Audit Log 之后第五页，改动最大的一页）─────────────
 *
 * 这一页跟前四页不一样：原始设计是每一张预约卡片用手算的像素位置
 * (left-[168px] w-[240px]) 摆出来的，不是一份资料阵列。种四位真师傅、
 * 六笔今天的真预约(涵盖 in service / upcoming / done / no_show 四种状态、
 * 一个跨小时的空档、一个真的时间冲突验证排他约束)，验证：时间轴的位置
 * 是真的从 starts_at/ends_at 算出来的、状态徽章跟到不到店(arrived_at)
 * 挂钩、搜索跟师傅筛选跟状态药丸都还在真的过滤、右边「下一位客人」跟
 * 「快速空档」两个面板都是真的排出来的，不是编的。
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
const OUT = ".screenshots/schedule-real";
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

// 今天，马来西亚时间，固定几个钟点方便断言（不是「现在」，是种资料用的锚点）。
const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
const at = (h, m = 0) => new Date(`${todayStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+08:00`).toISOString();

let browser;
try {
  const stamp = Date.now();
  const email = `sch-${stamp}@formae.test`;
  const password = `Sc-${stamp}-x!`;
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

  const amy = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Schedule-Test Amy",
  });
  if (amy.error) throw new Error(`amy: ${amy.error.message}`);
  await admin.from("directory_entries").update({ status: "Senior Master" }).eq("id", amy.data.id);
  const jasmine = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Schedule-Test Jasmine",
  });
  if (jasmine.error) throw new Error(`jasmine: ${jasmine.error.message}`);

  // Amy: 一笔已经到店(in service)、一笔待来的(upcoming)、中间留一段真的空档。
  const a1 = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(10, 0), in_ends_at: at(11, 30),
    in_party: "Schedule-Test Guest Amanda", in_staff_id: amy.data.id,
    in_service: "Balayage Highlights",
  });
  if (a1.error) throw new Error(`a1: ${a1.error.message}`);
  const a1Id = a1.data;
  // arrived_at 走的是专门那一支（[任务 366]），不是 set_appointment_status。
  const markArrived = await api.rpc("mark_appointment_arrived", { in_id: a1Id });
  if (markArrived.error) throw new Error(`mark_appointment_arrived: ${markArrived.error.message}`);

  const a2 = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(15, 0), in_ends_at: at(16, 0),
    in_party: "Schedule-Test Guest Marcus", in_staff_id: amy.data.id,
    in_service: "Fade Cut & Beard",
  });
  if (a2.error) throw new Error(`a2: ${a2.error.message}`);

  // Jasmine: 一笔已经完成的(done)、一笔没来的(no_show)。
  const a3 = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(9, 30), in_ends_at: at(10, 30),
    in_party: "Schedule-Test Guest Nora", in_staff_id: jasmine.data.id,
    in_service: "Root Touchup",
  });
  if (a3.error) throw new Error(`a3: ${a3.error.message}`);
  const a3Id = a3.data;
  const done = await api.rpc("set_appointment_status", { in_id: a3Id, in_status: "done" });
  if (done.error) throw new Error(`done: ${done.error.message}`);

  const a4 = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(11, 0), in_ends_at: at(12, 0),
    in_party: "Schedule-Test Guest Rachel", in_staff_id: jasmine.data.id,
    in_service: "Digital Perm",
  });
  if (a4.error) throw new Error(`a4: ${a4.error.message}`);
  const a4Id = a4.data;
  const noShow = await api.rpc("set_appointment_status", { in_id: a4Id, in_status: "no_show" });
  if (noShow.error) throw new Error(`noShow: ${noShow.error.message}`);

  // 真的排他约束——同一个师傅同一段时间不能再排一笔，验证产品的地基没被这一页绕过。
  const clash = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(10, 30), in_ends_at: at(11, 0),
    in_party: "Schedule-Test Guest Clash", in_staff_id: amy.data.id,
    in_service: "Should not fit",
  });
  if (!clash.error) throw new Error("排他约束没有挡住重叠预约——种资料的假设错了");

  // ── 任务 415 补的：换日期 · 周视图 · 空档 · 真的订 · 点开一笔 ──────────────
  // 一位真客人（订的时候要能连到她的档案），加上「同一周里的另一天」一笔预约。
  const lina = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Schedule-Test Lina",
  });
  if (lina.error) throw new Error(`lina: ${lina.error.message}`);
  const dowToday = (new Date(`${todayStr}T00:00:00Z`).getUTCDay() + 6) % 7; // 周一 = 0 … 周日 = 6
  const shift = (d, n) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
  const otherDay = shift(todayStr, dowToday < 6 ? 1 : -1); // 永远落在同一个周一到周日里
  const atOn = (d, h, m = 0) => new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+08:00`).toISOString();
  const other = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: atOn(otherDay, 10), in_ends_at: atOn(otherDay, 11),
    in_party: "Other-Day Guest", in_staff_id: amy.data.id, in_service: "Other Day Cut",
  });
  if (other.error) throw new Error(`other: ${other.error.message}`);
  // 一笔要拿来取消的
  const cancelMe = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(17, 0), in_ends_at: at(17, 30),
    in_party: "Cancel-Me Guest", in_staff_id: amy.data.id, in_service: "Trim",
  });
  if (cancelMe.error) throw new Error(`cancelMe: ${cancelMe.error.message}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1200 } });
  // 这一页原本所有没接的按钮都是 alert() —— 现在整个过程一个都不该弹。
  const alerts = [];
  page.on("dialog", (d) => { alerts.push(d.message()); d.dismiss().catch(() => {}); });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/salon-preview/schedule`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await page.locator("body").innerText();

  if (!/Amy Chen|Jasmine Teo|Chloe Tan|Kelvin Ng|Amanda Choong|Datin Nora/.test(body))
    ok("四个手写师傅、编出来的示范客人名字都不见了");
  else no("还留着手写的示范师傅/客人");

  if (/Schedule-Test Amy/.test(body) && /Schedule-Test Jasmine/.test(body))
    ok("🔴 真的两位师傅都出现在侧栏跟时间轴上");
  else no("师傅没有出现");

  if (/Senior Master/.test(body)) ok("🔴 真的职位文字(存在 status 栏)读到了");
  else no("职位文字没有出现");

  if (/Schedule-Test Guest Amanda/.test(body) && /Balayage Highlights/.test(body))
    ok("🔴 真的预约(Amanda)读到了名字跟服务");
  else no("Amanda 那笔没有出现");

  if (/Schedule-Test Guest Nora/.test(body) && /COMPLETED/.test(body))
    ok("🔴 done 状态真的标成 COMPLETED");
  else no("done 状态没有对上", body.match(/Schedule-Test Guest Nora[\s\S]{0,120}/)?.[0]);

  if (/Schedule-Test Guest Rachel/.test(body) && /NO SHOW/.test(body))
    ok("🔴 no_show 状态真的标成 NO SHOW");
  else no("no_show 状态没有对上");

  if (/Schedule-Test Guest Marcus/.test(body) && /UPCOMING/.test(body))
    ok("🔴 还没到的那笔标成 UPCOMING(没有 arrived_at)");
  else no("upcoming 状态没有对上");

  // 真的两位师傅数字——不是写死的「4 Stylists」。
  if (/Full Roster · 2 Stylists|2 of 2 Clocked In/.test(body))
    ok("🔴 师傅人数是真的算出来的(2 位),不是写死的 4 位");
  else no("师傅人数字样不对", body.match(/Roster[^\n]*|Clocked In[^\n]*/)?.[0]);

  await page.screenshot({ path: `${OUT}/1-full-timeline.png`, fullPage: true });

  // 真的搜索——过滤到只剩 Marcus 那一位师傅(Amy)的行。⚠️ 右边侧栏(Quick
  // Slot / Next Arrivals)是整页概览,不跟着搜索走——跟原始设计同一个
  // 范围(那几张卡从来就是写死的、不吃过滤器),所以断言只能认时间轴上
  // 才会出现的东西(某个师傅具体的预约明细),不能认师傅的裸名字。
  await page.getByPlaceholder("Search guest, stylist, service...").fill("Marcus");
  await page.waitForTimeout(400);
  const afterSearch = await page.locator("body").innerText();
  if (/Fade Cut & Beard/.test(afterSearch) && !/Root Touchup/.test(afterSearch) && !/Digital Perm/.test(afterSearch))
    ok("🔴 搜索是真的按师傅整行过滤,不是装饰(Jasmine 那两笔预约明细不见了)");
  else no("搜索没有真的过滤", afterSearch.match(/Root Touchup|Digital Perm/g)?.join(","));
  await page.screenshot({ path: `${OUT}/2-searched.png`, fullPage: true });
  await page.getByPlaceholder("Search guest, stylist, service...").fill("");

  // 右边「下一位客人」——真的按时间排序,Marcus(15:00)应该在名单上。
  // ⚠️ 两个面板标题都套了 CSS uppercase,跟 Audit Log 那次同一个坑,
  // 这里用不分大小写的判断避开它。
  await page.waitForTimeout(300);
  body = await page.locator("body").innerText();
  if (/next guest arrivals/i.test(body) && /Schedule-Test Guest Marcus/.test(body))
    ok("🔴 「下一位客人」面板真的列出还没到的那一位,不是编的两个假名字");
  else no("下一位客人面板不对");

  if (/quick slot placement/i.test(body) && /Schedule-Test (Amy|Jasmine)/.test(body))
    ok("🔴 「快速空档」面板真的列出算出来的空档,挂着真师傅的名字");
  else no("快速空档面板不对");

  // ── ① 换日期 ────────────────────────────────────────────────────────────
  console.log("\n① 换日期");
  const dayLabelOf = (d) => new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${d}T12:00:00+08:00`));
  // 换日期是 Next 的软导航：等标题真的变了再判，不是等 networkidle（新内容还没出来它就回了）。
  const showing = (d) => until(async () => (await page.getByTestId("day-label").innerText()) === dayLabelOf(d), 60000);
  await page.getByLabel("Next day").click();
  await showing(shift(todayStr, 1));
  check("🔴 「下一天」真的换了一天（网址带日期，标题写着明天）", page.url().includes(`date=${shift(todayStr, 1)}`) && (await page.getByTestId("day-label").innerText()) === dayLabelOf(shift(todayStr, 1)), await page.getByTestId("day-label").innerText());
  let b = await page.locator("body").innerText();
  check("🔴 换了一天之后，今天的预约（Marcus）不见了", !/Schedule-Test Guest Marcus/.test(b));
  check("换了一天，「Back to Today」出现", (await page.getByRole("link", { name: "Back to Today" }).count()) === 1);
  await page.getByRole("link", { name: "Back to Today" }).click();
  await showing(todayStr);
  await until(async () => /Schedule-Test Guest Marcus/.test(await page.locator("body").innerText()));
  check("🔴 「Back to Today」回到今天，Marcus 又在", (await page.getByTestId("day-label").innerText()) === dayLabelOf(todayStr) && /Schedule-Test Guest Marcus/.test(await page.locator("body").innerText()));
  await page.getByLabel("Previous day").click();
  await showing(shift(todayStr, -1));
  check("「上一天」也翻得动", (await page.getByTestId("day-label").innerText()) === dayLabelOf(shift(todayStr, -1)));
  await page.goto(`${BASE}/en/salon-preview/schedule?date=not-a-date`, { waitUntil: "networkidle", timeout: 180000 });
  check("🔴 乱写的日期不会炸，退回今天", (await page.getByTestId("day-label").innerText()) === dayLabelOf(todayStr));
  await page.goto(`${BASE}/en/salon-preview/schedule?date=2026-02-30`, { waitUntil: "networkidle", timeout: 180000 });
  check("不存在的日期（2 月 30 号）也退回今天", (await page.getByTestId("day-label").innerText()) === dayLabelOf(todayStr));
  await page.goto(`${BASE}/en/salon-preview/schedule?date=${otherDay}`, { waitUntil: "networkidle", timeout: 180000 });
  check("🔴 直接打开同一周的另一天，看得到那天的预约", /Other-Day Guest/.test(await page.locator("body").innerText()));

  // ── ② 周视图 ────────────────────────────────────────────────────────────
  console.log("\n② 周视图");
  await page.goto(`${BASE}/en/salon-preview/schedule`, { waitUntil: "networkidle", timeout: 180000 });
  await page.getByRole("button", { name: /^Week/ }).click();
  const totals = await page.getByTestId("week-total").allInnerTexts();
  const todayIdx = dowToday;
  const otherIdx = (new Date(`${otherDay}T00:00:00Z`).getUTCDay() + 6) % 7;
  check("🔴 周视图七天都有总数", totals.length === 7, JSON.stringify(totals));
  check("🔴 今天的总数是 5（Amy 3 笔含要取消那笔 + Jasmine 2 笔）", totals[todayIdx] === "5", `今天=${totals[todayIdx]}`);
  check("🔴 同一周另一天的总数是 1（Other-Day Guest）", totals[otherIdx] === "1", `另一天=${totals[otherIdx]}`);
  check("没有假的写死师傅名", !/Chloe Tan|Amy Chen|Kelvin Ng/.test(await page.locator("body").innerText()));
  await page.screenshot({ path: `${OUT}/3-week.png`, fullPage: true });
  await page.getByTestId("week-day").nth(otherIdx).click();
  await showing(otherDay);
  await until(async () => /Other-Day Guest/.test(await page.locator("body").innerText()));
  check("🔴 点周视图里的一天，真的打开那一天", /Other-Day Guest/.test(await page.locator("body").innerText()));

  // ── ③ 空档列表 + 订一个空档 ──────────────────────────────────────────────
  console.log("\n③ 空档");
  await page.goto(`${BASE}/en/salon-preview/schedule`, { waitUntil: "networkidle", timeout: 180000 });
  await page.getByRole("button", { name: /Gap & Open/ }).click();
  check("🔴 空档列表：今天 Amy 4 段 + Jasmine 3 段 = 7 段（含 17:30–18:00 那 30 分钟）", (await page.getByTestId("gap-row").count()) === 7, String(await page.getByTestId("gap-row").count()));
  await page.screenshot({ path: `${OUT}/4-gaps.png`, fullPage: true });
  const amyGap = page.getByTestId("gap-row").filter({ hasText: "Schedule-Test Amy" }).filter({ hasText: "09:00 - 10:00" });
  await amyGap.getByRole("button", { name: "Book this slot" }).click();
  let dlg = page.getByRole("dialog", { name: "New appointment" });
  check("🔴 点空档：订位弹窗自己带好师傅 Amy、09:00、10:00", (await dlg.getByLabel("Stylist").inputValue()) === amy.data.id && (await dlg.getByLabel("Start time").inputValue()) === "09:00" && (await dlg.getByLabel("End time").inputValue()) === "10:00");
  await dlg.getByLabel("Client").fill("Gap-Booked Guest");
  await dlg.getByLabel("Service").fill("Gloss");
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  await dlg.waitFor({ state: "detached", timeout: 30000 });
  const gapRow = await must("gap booked", Promise.resolve(admin.from("appointments").select("starts_at, ends_at, staff_id, party, service, source").eq("project_id", pid).eq("party", "Gap-Booked Guest")));
  check("🔴 真的订进资料库：Amy · 09:00–10:00 · Gloss · 柜台订的", gapRow.length === 1 && gapRow[0].staff_id === amy.data.id && new Date(gapRow[0].starts_at).getTime() === new Date(at(9, 0)).getTime() && new Date(gapRow[0].ends_at).getTime() === new Date(at(10, 0)).getTime() && gapRow[0].service === "Gloss" && gapRow[0].source === "staff", JSON.stringify(gapRow));
  await until(async () => (await page.getByTestId("gap-row").count()) === 6);
  check("🔴 订完那一段空档不见了（7 → 6）", (await page.getByTestId("gap-row").count()) === 6, String(await page.getByTestId("gap-row").count()));
  await page.getByRole("button", { name: /^Day/ }).click();

  // ── ④ 新增预约（顶上那颗按钮） ────────────────────────────────────────────
  console.log("\n④ 新增预约");
  await page.getByRole("button", { name: /New\s*Appointment/ }).first().click();
  dlg = page.getByRole("dialog", { name: "New appointment" });
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  check("🔴 什么都没填：讲要写是谁", /who the booking is for/.test(await dlg.getByTestId("booking-error").innerText()));
  await dlg.getByLabel("Client").fill("Schedule-Test Li");
  check("🔴 打「Li」，真的客人 Lina 出现在建议里", (await dlg.getByRole("button", { name: "Schedule-Test Lina" }).count()) === 1);
  await dlg.getByRole("button", { name: "Schedule-Test Lina" }).click();
  check("选了之后写明已连到她的客人档案", /Linked to her saved client folio/.test(await dlg.innerText()));
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  check("没填时间：讲要选起止时间", /start and an end time/.test(await dlg.getByTestId("booking-error").innerText()));
  await dlg.getByLabel("Start time").fill("13:00");
  await dlg.getByLabel("End time").fill("12:00");
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  check("🔴 结束早于开始：讲「结束要晚于开始」", /end after it starts/.test(await dlg.getByTestId("booking-error").innerText()));
  await dlg.getByLabel("Stylist").selectOption(amy.data.id);
  await dlg.getByLabel("Start time").fill("10:30");
  await dlg.getByLabel("End time").fill("11:00");
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  await page.waitForFunction(() => /already taken/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  check("🔴 订到 Amy 已经有人的时段：资料库自己的那句「That time is already taken」出现在弹窗里", /already taken/i.test(await dlg.innerText()), await dlg.innerText());
  const clashRows = await must("clash", Promise.resolve(admin.from("appointments").select("id").eq("project_id", pid).eq("party_id", lina.data.id)));
  check("🔴 撞了的那笔没有被存进去", clashRows.length === 0);
  await page.screenshot({ path: `${OUT}/5-dialog-clash.png` });
  await dlg.getByLabel("Stylist").selectOption(jasmine.data.id);
  await dlg.getByLabel("Start time").fill("12:30");
  await dlg.getByLabel("End time").fill("13:30");
  await dlg.getByLabel("Service").fill("Cut");
  await dlg.getByRole("button", { name: "Book Appointment" }).click();
  await dlg.waitFor({ state: "detached", timeout: 30000 });
  const linaRows = await must("lina", Promise.resolve(admin.from("appointments").select("party, party_id, staff_id, starts_at").eq("project_id", pid).eq("party_id", lina.data.id)));
  check("🔴 换成 Jasmine 12:30 就订成了，而且连到 Lina 的客人档案（party_id 是她）", linaRows.length === 1 && linaRows[0].staff_id === jasmine.data.id && new Date(linaRows[0].starts_at).getTime() === new Date(at(12, 30)).getTime(), JSON.stringify(linaRows));
  await until(async () => /Schedule-Test Lina/.test(await page.locator("body").innerText()));
  check("画面上那一格出现了", /Schedule-Test Lina/.test(await page.locator("body").innerText()));

  // ── ⑤ 点开一笔预约 ──────────────────────────────────────────────────────
  console.log("\n⑤ 点开一笔预约");
  const cardOf = (name) => page.getByTestId("appt-card").filter({ hasText: name });
  await cardOf("Schedule-Test Guest Marcus").click();
  let ad = page.getByRole("dialog", { name: "Appointment" });
  check("🔴 点开 Marcus（还没到）：四个动作都有", (await ad.getByRole("button", { name: "She's here" }).count()) === 1 && (await ad.getByRole("button", { name: "Mark done" }).count()) === 1 && (await ad.getByRole("button", { name: "No show" }).count()) === 1 && (await ad.getByRole("button", { name: "Cancel booking" }).count()) === 1);
  check("弹窗里写着他的名字 / 服务 / 时间 / 师傅", /Fade Cut & Beard/.test(await ad.innerText()) && /15:00/.test(await ad.innerText()) && /Schedule-Test Amy/.test(await ad.innerText()));
  await ad.getByRole("button", { name: "She's here" }).click();
  await ad.waitFor({ state: "detached", timeout: 30000 });
  const marcus = await must("marcus", Promise.resolve(admin.from("appointments").select("arrived_at, status").eq("project_id", pid).eq("party", "Schedule-Test Guest Marcus")));
  check("🔴 「She's here」真的写了 arrived_at，状态还是 booked（没有提前扣套票）", !!marcus[0]?.arrived_at && marcus[0]?.status === "booked", JSON.stringify(marcus));
  await until(async () => /IN SERVICE/.test(await cardOf("Schedule-Test Guest Marcus").innerText()));
  await cardOf("Schedule-Test Guest Marcus").click();
  ad = page.getByRole("dialog", { name: "Appointment" });
  check("到店之后，「She's here」跟「No show」不再出现（来了就不能没来）", (await ad.getByRole("button", { name: "She's here" }).count()) === 0 && (await ad.getByRole("button", { name: "No show" }).count()) === 0);
  await ad.getByRole("button", { name: "Mark done" }).click();
  await ad.waitFor({ state: "detached", timeout: 30000 });
  const marcusDone = await must("marcus done", Promise.resolve(admin.from("appointments").select("status").eq("project_id", pid).eq("party", "Schedule-Test Guest Marcus")));
  check("🔴 「Mark done」真的把状态写成 done", marcusDone[0]?.status === "done");
  await until(async () => /COMPLETED/.test(await cardOf("Schedule-Test Guest Marcus").innerText()));
  await cardOf("Schedule-Test Guest Marcus").click();
  ad = page.getByRole("dialog", { name: "Appointment" });
  check("做完的那一笔：只说「已经处理过了」，没有动作按钮，但有「Open full record」连结", /already settled/.test(await ad.innerText()) && (await ad.getByRole("button", { name: "Mark done" }).count()) === 0 && (await ad.getByRole("link", { name: "Open full record" }).count()) === 1);
  const href = await ad.getByRole("link", { name: "Open full record" }).getAttribute("href");
  check("「Open full record」指向这一笔自己的页", new RegExp(`/portal/bookings/[0-9a-f-]{36}$`).test(href ?? ""), href ?? "");
  await ad.getByRole("button", { name: "Close" }).click();
  await cardOf("Cancel-Me Guest").click();
  ad = page.getByRole("dialog", { name: "Appointment" });
  await ad.getByRole("button", { name: "Cancel booking" }).click();
  await ad.waitFor({ state: "detached", timeout: 30000 });
  const cancelled = await must("cancelled", Promise.resolve(admin.from("appointments").select("status").eq("project_id", pid).eq("party", "Cancel-Me Guest")));
  check("🔴 「Cancel booking」真的写成 cancelled（不是删掉，那一行还在）", cancelled.length === 1 && cancelled[0].status === "cancelled", JSON.stringify(cancelled));
  // 套票：Lina 有一张 10 次的套票，做完她那一笔就该扣一次，而且弹窗要讲出来。
  const pkg = await api.rpc("add_service_package", { in_party_id: lina.data.id, in_name: "Facial x10", in_sessions_total: 10 });
  if (pkg.error) throw new Error(`add_service_package: ${pkg.error.message}`);
  const pkgId = typeof pkg.data === "object" ? pkg.data.id : pkg.data;
  await cardOf("Schedule-Test Lina").click();
  ad = page.getByRole("dialog", { name: "Appointment" });
  await ad.getByRole("button", { name: "Mark done" }).click();
  await ad.getByTestId("appt-note").waitFor({ timeout: 30000 }).catch(() => {});
  const note = (await ad.getByTestId("appt-note").innerText().catch(() => "")) || "";
  check("🔴 做完一位有套票的客人：弹窗讲「用掉一次 Facial x10，还剩 9 次」", /One session of Facial x10 was used — 9 left/.test(note), note);
  const uses = await must("uses", Promise.resolve(admin.from("package_uses").select("id").eq("package_id", pkgId)));
  check("🔴 资料库里那张套票真的记了一次用掉", uses.length === 1, String(uses.length));
  await page.screenshot({ path: `${OUT}/7-package-note.png` });
  await ad.getByRole("button", { name: "Close" }).click();
  await page.screenshot({ path: `${OUT}/6-after-actions.png`, fullPage: true });

  // ── ⑥ 员工登入也订得了 ───────────────────────────────────────────────────
  console.log("\n⑥ 员工登入");
  const staffEmail = `sch-staff-${stamp}@formae.test`;
  const staffPassword = `Ss-${stamp}-x!`;
  const { data: staffUser, error: sErr } = await admin.auth.admin.createUser({ email: staffEmail, password: staffPassword, email_confirm: true });
  if (sErr) throw new Error(`createUser staff: ${sErr.message}`);
  const sm = await api.rpc("add_project_member", { in_email: staffEmail });
  if (sm.error) throw new Error(`add_project_member: ${sm.error.message}`);
  const staffCtx = await browser.newContext({ viewport: { width: 1700, height: 1200 } });
  const sp = await staffCtx.newPage();
  await sp.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await sp.fill('input[type="email"]', staffEmail);
  await sp.fill('input[type="password"]', staffPassword);
  await sp.click('button[type="submit"]');
  await sp.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await sp.goto(`${BASE}/en/salon-preview/schedule`, { waitUntil: "networkidle", timeout: 180000 });
  await sp.getByRole("button", { name: /New\s*Appointment/ }).first().click();
  const sdlg = sp.getByRole("dialog", { name: "New appointment" });
  await sdlg.getByLabel("Client").fill("Counter-Booked Guest");
  await sdlg.getByLabel("Stylist").selectOption(jasmine.data.id);
  await sdlg.getByLabel("Start time").fill("14:00");
  await sdlg.getByLabel("End time").fill("14:30");
  await sdlg.getByRole("button", { name: "Book Appointment" }).click();
  await sdlg.waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
  const counter = await must("counter", Promise.resolve(admin.from("appointments").select("id").eq("project_id", pid).eq("party", "Counter-Booked Guest")));
  check("🔴 站柜台的员工（不是老板）也订得了一笔", counter.length === 1);
  await staffCtx.close();
  admin.auth.admin.deleteUser(staffUser.user.id).catch(() => {});

  check("🔴 整个过程一个「还没接」的弹窗都没有出现", alerts.length === 0, alerts.join(" | "));

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
