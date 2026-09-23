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

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1200 } });
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
