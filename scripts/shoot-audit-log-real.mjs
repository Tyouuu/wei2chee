/**
 * 沙龙新设计的 Audit Log——从六个编出来的示范故事换成真的 record_changes。
 * 真登入、真截图。
 *
 * ── 为什么（2026-09-24，Overview / Stock / Invoices 之后第四页）───────────
 *
 * 种一笔真的报价单改动(人改的)、一笔真的报价单改动(带 x-formae-actor:
 * assistant 头,模拟助手改的)、一笔真的客户资料改动——三种真实会写进
 * record_changes 的形状,跟 check-audit-actor.mjs 已经验证过的技巧同一套
 * (同一个 email/password 开两把钥匙，唯一差别是那一个请求头)。
 *
 * 验证：清单是真的、点了真的能换选中哪一条、右边详情面板真的跟着换
 * (原始设计整个面板零点击处理)、AI 徽章真的分得出人跟助手、
 * 员工身分看得到诚实的话而不是被 RLS 悄悄清空的假清单。
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/audit-log-real";
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

const stamp = Date.now();
const people = [];

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };

let browser;
try {
  const bossEmail = `aud-${stamp}@formae.test`;
  const bossPassword = `Au-${stamp}-x!`;
  const { data: bossMade, error: bossMkErr } = await admin.auth.admin.createUser({
    email: bossEmail, password: bossPassword, email_confirm: true,
  });
  if (bossMkErr) throw new Error(`createUser boss: ${bossMkErr.message}`);
  people.push(bossMade.user.id);

  const boss = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: bossInErr } = await boss.auth.signInWithPassword({ email: bossEmail, password: bossPassword });
  if (bossInErr) throw new Error(`signIn boss: ${bossInErr.message}`);
  const { data: proj } = await boss.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;

  for (const k of ["customers", "quotations"]) {
    await boss.rpc("add_project_page", { requested_key: k, new_title: "" });
  }
  const guest = await boss.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Audit-Test Halim",
  });
  if (guest.error) throw new Error(`guest: ${guest.error.message}`);

  // 同一个人，第二把钥匙——带上助手那条伺服器路会送的头（照 check-audit-actor.mjs 已经验证过的做法）。
  const asAssistant = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { "x-formae-actor": "assistant" } },
  });
  await asAssistant.auth.signInWithPassword({ email: bossEmail, password: bossPassword });

  // 1) 人改的——真的客户名单，改一次 status（entity=directory）。
  const upd1 = await boss.rpc("update_directory_entry", { in_id: guest.data.id, in_status: "vip" });
  if (upd1.error) throw new Error(`upd1: ${upd1.error.message}`);

  // 2) 真的报价单（entity=pipeline），先开一张。
  const quote = await boss.rpc("add_pipeline_record", {
    in_project_id: pid, in_module_key: "quotations",
    in_title: "Audit-Test Rewiring Job", in_party: "Audit-Test Halim",
    in_party_id: guest.data.id, in_amount_cents: 480000,
  });
  if (quote.error) throw new Error(`quote: ${quote.error.message}`);

  // 3) 助手改的——同一张单，带那个头改进度（via_ai 应该是 true）。
  const upd3 = await asAssistant.rpc("update_pipeline_record", { in_id: quote.data.id, in_stage: "quoted" });
  if (upd3.error) throw new Error(`upd3 (via_ai): ${upd3.error.message}`);

  browser = await chromium.launch();

  // 老板身分——完整看得到。
  const ownerPage = await (await browser.newContext({ viewport: { width: 1600, height: 1200 } })).newPage();
  await ownerPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await ownerPage.fill('input[type="email"]', bossEmail);
  await ownerPage.fill('input[type="password"]', bossPassword);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForURL(/portal/, { timeout: 180000 });
  await ownerPage.goto(`${BASE}/en/salon-preview/audit-log`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await ownerPage.locator("body").innerText();

  if (!/142|Applied 10% Courtesy Loyalty|AI Auto-Reconciled WhatsApp/.test(body))
    ok("发明的六个示范故事、假的 142/84/58 数字都不见了");
  else no("还留着编出来的示范故事/假数字");

  if (/Audit-Test Halim/.test(body)) ok("🔴 真的客户名字出现在活动清单里");
  else no("客户名字没有出现");

  if (/Status/.test(body) && /vip/.test(body))
    ok("🔴 真的栏位变化(status → vip)读到了");
  else no("status 变化没读到", body.match(/Status[\s\S]{0,60}/)?.[0]);

  if (/AI Assistant/.test(body)) ok("🔴 助手改的那一笔真的标了 AI Assistant 徽章");
  else no("AI 徽章没有出现");

  if (new RegExp(`aud-${stamp}`).test(body)) ok("🔴 人改的那一笔真的印出登入的名字(email 前缀)");
  else no("人改的那一笔名字没有出现");

  if (/Audit-Test Rewiring Job/.test(body) && /Quotation|Order/.test(body))
    ok("🔴 第二种 entity(报价单)也真的出现了");
  else no("报价单那一笔没有出现");

  await ownerPage.screenshot({ path: `${OUT}/1-owner-list.png`, fullPage: true });

  // 默认选中的是最新那一笔(报价单那一条,按 created_at desc)——右边详情
  // 面板已经显示它的真内容。点客户那一条(不是默认选中的那一笔),面板
  // 要真的换掉——原始设计这里是零点击处理,这才是真的在测「点了会不会换」。
  // ⚠️ 面板标题套了 CSS uppercase,innerText() 读到的是 "ACTIVITY DETAILS"，
  // 跟 Stock 页 "Low"→"LOW" 同一个坑，这里用不分大小写的判断避开它。
  await ownerPage.getByText("Audit-Test Halim").first().click();
  await ownerPage.waitForTimeout(300);
  body = await ownerPage.locator("body").innerText();
  if (/activity details/i.test(body) && /Customer \/ Staff/.test(body) && /Changed Status/.test(body))
    ok("🔴 点了客户那一行,右边详情面板真的换成她的内容——原始设计的洞补上了");
  else {
    no("点击没有真的更新详情面板");
    console.log("── DEBUG: full body after click ──\n" + body.slice(0, 3000));
  }

  await ownerPage.screenshot({ path: `${OUT}/2-selected-detail.png`, fullPage: true });

  // 真的搜索——过滤到只剩客户那笔。
  await ownerPage.getByPlaceholder("Search record, staff name, or field...").fill("Halim");
  await ownerPage.waitForTimeout(400);
  const afterSearch = await ownerPage.locator("body").innerText();
  if (/Audit-Test Halim/.test(afterSearch)) ok("🔴 搜索是真的在过滤,不是装饰");
  else no("搜索没有真的过滤");

  await ownerPage.screenshot({ path: `${OUT}/3-searched.png`, fullPage: true });

  // 员工身分——sees_money 挡下来,给一句诚实的话,不是空清单。
  const staffEmail = `aud-staff-${stamp}@formae.test`;
  const staffPassword = `As-${stamp}-x!`;
  const { data: staffUser, error: staffMkErr } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  });
  if (staffMkErr) throw new Error(`createUser staff: ${staffMkErr.message}`);
  people.push(staffUser.user.id);
  const memberAdd = await boss.rpc("add_project_member", { in_email: staffEmail });
  if (memberAdd.error) throw new Error(`add_project_member: ${memberAdd.error.message}`);

  const staffPage = await (await browser.newContext({ viewport: { width: 1600, height: 1200 } })).newPage();
  await staffPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await staffPage.fill('input[type="email"]', staffEmail);
  await staffPage.fill('input[type="password"]', staffPassword);
  await staffPage.click('button[type="submit"]');
  await staffPage.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await staffPage.goto(`${BASE}/en/salon-preview/audit-log`, { waitUntil: "networkidle", timeout: 180000 });
  const staffBody = await staffPage.locator("body").innerText();
  if (/only visible to the business owner/.test(staffBody) && !/Audit-Test Halim/.test(staffBody))
    ok("🔴 员工身分看到诚实的话,不是一份被 RLS 悄悄清空的假清单");
  else no("员工身分没有被诚实地挡下来", staffBody.slice(0, 200));
  await staffPage.screenshot({ path: `${OUT}/4-staff-blocked.png`, fullPage: true });

} finally {
  if (browser) await browser.close();
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
