/**
 * 帐单一个地方，工地另一个 —— 用眼睛看。
 *
 * 重点 7l：改完 → 跑尺子 → **自己先看图** → 不像就回去改。
 * 166 条真的呼叫全过、875 个单元测试全过、tsc 干净 —— 那些都不告诉我
 * 那几格在画面上长什么样、协不协调、手机上按不按得到。
 *
 * 拍五张：客户页（三个地址 ＋ 他的单子）· 开单时挑工地 · 那张纸上印出工地 ·
 * 只有一个地址的客户（那时候「哪一个工地」整个不出现）· 390 宽。
 *
 * ⚠️ 用的是 demo 那个真帐号，所以**跑完把自己造的东西删掉**。
 * ⚠️ 道具跟着那个系统自己的语言走（重点 22d）：那一页是英文的。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/addresses";
mkdirSync(OUT, { recursive: true });

const EMAIL = "tianyou.demo@formae.test";
const PASSWORD = "FormaeDemo2026!";

const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const shots = [];
const made = { records: [], parties: [] };

async function shoot(page, path, name) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const h1 = await page.locator("h1").first().innerText().catch(() => "");
  /* 登入页 · 错误页 · 那一页，三张在报告里长得一模一样。 */
  const stuck =
    /log in|sign in|登入/i.test(h1) || /something broke|does not exist|坏了|不存在/i.test(h1);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const body = await page.locator("main").first().innerText().catch(() => "");
  shots.push({ name, h1, stuck });
  console.log(`${stuck ? "🔴 卡住" : "拍到"}  ${name}  · h1「${h1}」`);
  return body;
}

let browser;
try {
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const P = proj.id;

  /* ── 道具：一个有三个地址的客户，一个只有一个的 ─────────────────────── */
  const { data: many, error: mErr } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Lim Construction",
    in_phone: "012-345 6789",
  });
  if (mErr) throw new Error(`party: ${mErr.message}`);
  made.parties.push(many.id);
  const { data: addrs } = await api.rpc("set_directory_addresses", {
    in_party_id: many.id,
    in_rows: [
      { label: "Billing", line: "12 Jalan Bukit, Taman Desa", region: "KL", is_billing: true },
      { label: "Site A", line: "Lot 42, Jalan Kebun", region: "Klang" },
      { label: "Site B", line: "No 8, Jalan Sekolah", region: "Puchong" },
    ],
  });

  const { data: one } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Wong Hardware",
  });
  made.parties.push(one.id);
  await api.rpc("set_directory_addresses", {
    in_party_id: one.id, in_rows: [{ label: "Shop", line: "5 Jalan Pasar" }],
  });

  /* 他的两单，其中一单挂在 Site A 上 */
  const { data: job1 } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Kitchen at Klang",
    in_party: "Lim Construction", in_party_id: many.id, in_amount_cents: 4_850_000,
    in_site_address_id: addrs.find((a) => a.label === "Site A").id,
  });
  made.records.push(job1.id);
  const { data: job2 } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Bathroom",
    in_party: "Lim Construction", in_party_id: many.id, in_amount_cents: 800_000,
  });
  made.records.push(job2.id);

  browser = await chromium.launch();
  const wide = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await wide.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.fill('input[type="email"]', EMAIL);
  await wide.fill('input[type="password"]', PASSWORD);
  await wide.click('button[type="submit"]');
  await wide.waitForURL(/portal/, { timeout: 180000 });

  const partyBody = await shoot(wide, `/en/portal/customers/${many.id}`, "1-customer-page");
  /* ⚠️ 地址是打在 <input> 里的，而 innerText **不含 input 的值** ——
     第一版拿 innerText 去找「Jalan Kebun」，它当然找不到，然后我差点去
     「修」一个没有毛病的页面。第二次量错东西了，同一天。 */
  const addrValues = await wide.locator('input[aria-label="Address"]').evaluateAll(
    (els) => els.map((e) => e.value),
  );
  const billingChecked = await wide
    .locator('input[type="checkbox"]:checked')
    .count();
  const jobBody = await shoot(wide, `/en/portal/quotations/${job1.id}`, "2-job-at-a-site");
  const oneBody = await shoot(wide, `/en/portal/customers/${one.id}`, "3-one-address");

  /* 只有一个地址的客户，「哪一个工地」整个不出现 —— 一个永远只有一个
     选项的下拉是一个假的控件。 */
  await wide.goto(`${BASE}/en/portal/quotations/new`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.waitForTimeout(900);
  const nameBox = wide.locator("label").filter({ has: wide.getByText("Client", { exact: true }) }).locator("input").first();
  await nameBox.fill("Wong Hardware");
  await wide.waitForTimeout(400);
  const pickerForOne = await wide.getByLabel("Which site").count();
  await nameBox.fill("Lim Construction");
  await wide.waitForTimeout(400);
  const pickerForMany = await wide.getByLabel("Which site").count();
  await wide.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await wide.screenshot({ path: `${OUT}/4-picker-appears.png`, fullPage: true });
  shots.push({ name: "4-picker-appears", h1: "picker", stuck: false });
  console.log(`拍到  4-picker-appears · 一个地址的客户 ${pickerForOne} 个下拉 · 三个地址的 ${pickerForMany} 个`);

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await shoot(phone, `/en/portal/customers/${many.id}`, "5-phone-390");

  /* ── 读数 ─────────────────────────────────────────────────────────── */
  const say = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
    if (!ok) shots.push({ name, stuck: true, h1: "" });
  };
  say("客户页上三个地址都在",
    addrValues.length === 3 &&
      addrValues.some((v) => /Taman Desa/.test(v)) &&
      addrValues.some((v) => /Jalan Kebun/.test(v)) &&
      addrValues.some((v) => /Jalan Sekolah/.test(v)),
    addrValues.join(" | "));
  say("而且只有一个勾着「帐单寄这里」", billingChecked === 1, `勾了 ${billingChecked} 个`);
  /* 🔴 他来过几次。含收起来的 —— 一件做完收档的工作，还是来过一次。
     ⚠️ **没有积分、没有等级**：那是他还没有决定的一套方案，
     而替他发明一套等级，是在他的系统里宣布一件他没有讲过的事。 */
  say("客户页上讲得出他来过几次",
    /How often they come/i.test(partyBody) && /2 times/.test(partyBody),
    partyBody.replace(/\s+/g, " ").slice(0, 500));
  say("而且讲得出一共多少、上一次什么时候",
    /worth RM 56,500/.test(partyBody) && /last one 2026-/.test(partyBody),
    partyBody.replace(/\s+/g, " ").slice(0, 500));
  say("客户页上看得到他的单子",
    /Their jobs/i.test(partyBody) && /Kitchen at Klang/.test(partyBody),
    partyBody.replace(/\s+/g, " ").slice(0, 400));
  say("而且讲得出他还欠多少", /They still owe/i.test(partyBody),
    partyBody.replace(/\s+/g, " ").slice(0, 400));
  /* 🔴 那张纸上要印得出工地 —— 师傅拿着它出门。 */
  say("那张纸上印着工地", /Which site/i.test(jobBody) && /Jalan Kebun/.test(jobBody),
    jobBody.replace(/\s+/g, " ").slice(0, 500));
  say("一个地址的客户不出现「哪一个工地」，三个地址的才出现",
    pickerForOne === 0 && pickerForMany === 1, `${pickerForOne} / ${pickerForMany}`);
  say("还没有单子的客户，讲的是「还没有单子」不是一片空白",
    /No jobs yet/i.test(oneBody), oneBody.replace(/\s+/g, " ").slice(0, 300));
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  shots.push({ name: err.message, stuck: true, h1: "" });
} finally {
  for (const id of made.records) await api.from("pipeline_records").delete().eq("id", id);
  for (const id of made.parties) await api.from("directory_entries").delete().eq("id", id);
  console.log("\n(道具清掉了)");
  if (browser) await browser.close();
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${shots.length - bad.length} 项过 · ${bad.length} 项没过`);
if (bad.length) for (const b of bad) console.log(`  · ${b.name}`);
process.exit(bad.length ? 1 : 0);
