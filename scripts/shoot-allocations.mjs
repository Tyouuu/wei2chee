/**
 * 一笔钱分摊多张单，用眼睛看。
 *
 * 重点 7l：改完 → 跑尺子 → **自己先看图** → 不像就回去改。
 * 151 条真的呼叫全过、875 个单元测试全过、tsc 干净 —— 那些都不告诉我
 * 那一格在画面上长什么样、协不协调、手机上按不按得到。
 *
 * 拍五张：收款新单（分摊编辑器）· 分了两张单之后的订金那一行 ·
 * 报价单上的「已收 / 还欠」· 收齐了那一句 · 390 宽。
 *
 * ⚠️ 用的是 demo 那个真帐号，所以**跑完把自己造的东西删掉** ——
 * 一把每跑一次就在老板自己的数字里留几笔假单的尺，是有代价的尺。
 *
 * ⚠️ 而且道具跟着那个系统自己的语言走（重点 22d）：那一页是英文的，
 * 所以造出来的单也是英文的。中文的假资料放进一个英文系统，
 * 他看到的不是产品的毛病，是我拿错了道具 —— 而他只能从画面上判断。
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
const OUT = ".screenshots/allocations";
mkdirSync(OUT, { recursive: true });

const EMAIL = "tianyou.demo@formae.test";
const PASSWORD = "FormaeDemo2026!";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const shots = [];
const made = { records: [], entries: [] };

async function shoot(page, path, name, note = "") {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  /* Next 的 dev 徽章会印在画面上，而客户永远看不到它 ——
     一颗只有开发机上才有的黑点，不该出现在拿给他看的图里。 */
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const h1 = await page.locator("h1").first().innerText().catch(() => "");
  /* 拍到登入页、拍到错误页、拍到那一页 —— 三张在报告里长得一模一样。
     这个仓库被这个形状骗过四次。 */
  const stuck =
    /log in|sign in|登入/i.test(h1) || /something broke|does not exist|坏了|不存在/i.test(h1);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const body = await page.locator("main").first().innerText().catch(() => "");
  shots.push({ name, h1, stuck, body });
  console.log(`${stuck ? "🔴 卡住" : "拍到"}  ${name}  · h1「${h1}」${note ? ` · ${note}` : ""}`);
  return body;
}

let browser;
try {
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const P = proj.id;

  /* ── 道具：两张单 ＋ 一笔付两张的钱 ─────────────────────────────────── */
  const { data: docA, error: aErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Taman Desa kitchen", in_party: "Mr Tan", in_amount_cents: 4_850_000,
  });
  if (aErr) throw new Error(`docA: ${aErr.message}`);
  made.records.push(docA.id);
  await api.rpc("set_record_terms", {
    in_record_id: docA.id,
    in_terms: [
      { description: "Deposit", portion: 30 },
      { description: "On start", portion: 40 },
      { description: "On completion", portion: 30 },
    ],
  });

  const { data: docB } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Bathroom refit", in_party: "Mr Tan", in_amount_cents: 800_000,
  });
  made.records.push(docB.id);

  const { data: paid } = await api.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_amount_cents: 2_000_000, in_party: "Mr Tan", in_note: "Bank transfer",
  });
  made.entries.push(paid.id);

  browser = await chromium.launch();
  const wide = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await wide.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.fill('input[type="email"]', EMAIL);
  await wide.fill('input[type="password"]', PASSWORD);
  await wide.click('button[type="submit"]');
  await wide.waitForURL(/portal/, { timeout: 180000 });

  /* ① 空的编辑器 —— 一颗「再分一张」，没有别的 */
  await shoot(wide, "/en/portal/payments/new", "1-new-payment");

  /* ② 真的分一次：两张单，剩下 RM 3,000 当订金 */
  await wide.goto(`${BASE}/en/portal/payments/${paid.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.waitForTimeout(900);
  await wide.getByRole("button", { name: /Add another document/i }).click();
  await wide.getByLabel("Pick a document").first().selectOption(docA.id);
  await wide.getByLabel("How much").first().fill("12000");
  await wide.getByRole("button", { name: /Add another document/i }).click();
  await wide.getByLabel("Pick a document").nth(1).selectOption(docB.id);
  await wide.getByLabel("How much").nth(1).fill("5000");
  await wide.waitForTimeout(500);
  await wide.screenshot({ path: `${OUT}/2-split.png`, fullPage: true });
  const splitText = await wide.locator("main").innerText();
  shots.push({ name: "2-split", h1: "split", stuck: false, body: splitText });
  console.log(`拍到  2-split · 订金那一行：${(splitText.match(/deposit:.*/i) ?? ["(没有)"])[0]}`);

  /* 指名哪一期 —— 只在那张单真的有分期表的时候才出现 */
  const termPicker = wide.getByLabel("Which stage").first();
  const hasTermPicker = await termPicker.count();
  if (hasTermPicker) await termPicker.selectOption({ index: 1 });

  await wide.getByRole("button", { name: /^Save|保存/i }).first().click();
  await wide.waitForURL(/portal\/payments$/, { timeout: 60000 });

  /* ③ 那张单上的「已收 / 还欠」 */
  const docBody = await shoot(wide, `/en/portal/quotations/${docA.id}`, "3-document-settled");

  /* ④ 收齐了 —— 把 B 那张补满 */
  const { data: paid2 } = await api.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_amount_cents: 300_000, in_party: "Mr Tan", in_note: "Balance",
  });
  made.entries.push(paid2.id);
  await api.rpc("set_payment_allocations", {
    in_entry_id: paid2.id, in_rows: [{ record_id: docB.id, amount_cents: 300_000 }],
  });
  const fullBody = await shoot(wide, `/en/portal/quotations/${docB.id}`, "4-paid-in-full");

  /* ⑤ 手机：而且它是「改这一笔」，所以「还欠」不可以把同一笔钱扣两次。 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  const phoneBody = await shoot(phone, `/en/portal/payments/${paid.id}`, "5-phone-390");

  /* ── 读数：画面上真的讲了那几句吗 ─────────────────────────────────── */
  const say = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
    if (!ok) shots.push({ name, stuck: true, h1: "", body: "" });
  };
  say("分了两张之后，剩下的那一段讲成订金", /deposit/i.test(splitText), splitText.slice(0, 200));
  say("那张单上讲得出已收多少", /Received/i.test(docBody) && /RM\s?12,000/.test(docBody),
    docBody.slice(0, 300));
  say("而且讲得出还欠多少", /Still owed/i.test(docBody) && /RM\s?36,500/.test(docBody),
    docBody.slice(0, 300));
  say("收齐了就讲收齐了，不印一个 RM 0", /Paid in full/i.test(fullBody), fullBody.slice(0, 300));
  say("那两期还没收的，一个字都不印（不是 Received RM 0）",
    !/Received RM 0/.test(docBody), docBody.slice(0, 400));
  /* 🔴 改这一笔的时候，同一笔钱不可以扣两次。
     A 那张单 RM 48,500，除了这一笔以外没有别人付过 —— 框里打 12,000，
     旁边就该是 36,500。修之前它写的是 24,500（同一笔钱扣了两次）。

     ⚠️ 只验 A 那一张。我第一版连 B 也一起写死成 RM 3,000，然后它红了 ——
     **而红的是我的期望，不是产品**：B 在第 ④ 步又收了一笔 RM 3,000，
     所以除掉这一笔之后它只剩 5,000 没收，框里打 5,000 就是 RM 0。
     把作者算错的数字写成正确答案，尺子就不再量产品，开始量作者。 */
  say("改这一笔：还欠没有把这笔钱扣两次",
    /Still owed on it RM 36,500/.test(phoneBody),
    phoneBody.replace(/\s+/g, " ").slice(0, 700));
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  shots.push({ name: err.message, stuck: true, h1: "", body: "" });
} finally {
  /* 跑完把自己造的东西删掉。钱先删（分摊会跟着走），再删单。 */
  for (const id of made.entries) await api.from("ledger_entries").delete().eq("id", id);
  for (const id of made.records) await api.from("pipeline_records").delete().eq("id", id);
  console.log("\n(道具清掉了)");
  if (browser) await browser.close();
  void admin;
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${shots.length - bad.length} 项过 · ${bad.length} 项没过`);
if (bad.length) for (const b of bad) console.log(`  · ${b.name}`);
process.exit(bad.length ? 1 : 0);
