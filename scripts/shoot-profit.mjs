/**
 * 「这个月赚多少」—— 用眼睛看。
 *
 * 重点 7l。289 条真的呼叫、22 条组件测试全过，而那些答不了：
 * **画面上写的是不是那个数字**，跟**他有没有一个地方填得了类别跟那一单**。
 *
 * 用完就删的帐号 —— 一支在他自己的资料库里留下假帐的尺子，不值得用。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/profit";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `gl-${stamp}@formae.test`;
const PASSWORD = `Gl-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const bad = [];
let userId = null;
let browser;
const say = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", userId)
    .single();

  /* 一个新帐号还没有挑过风格，而没挑过风格的时候 portal 会先请他挑 ——
     所以这里替他挑一套，不然量到的是那一页。
     ⚠️ 那不是产品的毛病，是这支尺子拿错了道具。 */
  await admin.from("projects").update({ style: "ledger" }).eq("id", proj.id);

  /* 报表跟开销两页要存在 —— 一个新帐号开局没有它们。 */
  for (const key of ["expenses", "reports"]) {
    const { error } = await api.rpc("add_project_page", { requested_key: key, new_title: null });
    if (error && !/exist/i.test(error.message)) {
      throw new Error(`add_project_page(${key}): ${error.message}`);
    }
  }

  const { data: him } = await api.rpc("add_directory_entry", {
    in_project_id: proj.id,
    in_module_key: "customers",
    in_name: "Ang Chee Keong",
  });
  const { data: theJob } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id,
    in_module_key: "quotations",
    in_title: "Taman Desa 3-room refit",
    in_party: "Ang Chee Keong",
    in_party_id: him.id,
    in_amount_cents: 4_850_000,
  });
  /* 收进来一笔，挂在那张单上（走分摊 —— 那是进来的钱的路）。 */
  await api.rpc("add_ledger_entry", {
    in_project_id: proj.id,
    in_module_key: "payments",
    in_amount_cents: 1_455_000,
    in_party: "Ang Chee Keong",
    in_party_id: him.id,
    in_against_id: theJob.id,
  });
  /* 花出去两笔，挂在同一张单上。 */
  await api.rpc("add_ledger_entry", {
    in_project_id: proj.id,
    in_module_key: "expenses",
    in_amount_cents: 620_000,
    in_party: "Hup Seng Hardware",
    in_category: "Materials",
    in_job_id: theJob.id,
  });
  await api.rpc("add_ledger_entry", {
    in_project_id: proj.id,
    in_module_key: "expenses",
    in_amount_cents: 180_000,
    in_party: "Site crew",
    in_category: "Labour",
    in_job_id: theJob.id,
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const login = async (p) => {
    await p.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await p.fill('input[type="email"]', EMAIL);
    await p.fill('input[type="password"]', PASSWORD);
    await p.click('button[type="submit"]');
    await p.waitForURL(/portal/, { timeout: 180000 });
  };
  await login(page);
  const hide = (p) =>
    p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const readAll = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

  /* 1. 报表：收到 · 花掉 · 赚 */
  await page.goto(`${BASE}/en/portal/reports`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(2000);
  await hide(page);
  await page.screenshot({ path: `${OUT}/1-reports.png`, fullPage: true });
  const rep = await readAll(page);
  console.log("拍到  1-reports");
  say("报表上写着这个月收到多少", /RM 14,550/.test(rep), rep.slice(0, 500));
  say("也写着花掉多少", /Spent this month/i.test(rep) && /RM 8,000/.test(rep), rep.slice(0, 500));
  say("而且写着赚多少", /Kept this month/i.test(rep) && /RM 6,550/.test(rep), rep.slice(0, 500));
  say("讲得出「赚」是怎么算的", /less what went out/i.test(rep), rep.slice(0, 500));
  say("讲得出最大一笔花在哪", /Biggest: Materials RM 6,200/.test(rep), rep.slice(0, 700));

  /* 2. 那一单自己赚多少 */
  await page.goto(`${BASE}/en/portal/quotations/${theJob.id}`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page.waitForTimeout(1800);
  await hide(page);
  await page.screenshot({ path: `${OUT}/2-job.png`, fullPage: true });
  const job = await readAll(page);
  console.log("拍到  2-job");
  say(
    "那一单写着它花掉多少",
    /Spent on this job/i.test(job) && /RM 8,000/.test(job),
    job.slice(0, 700),
  );
  say("而且写着它赚多少", /This job kept/i.test(job) && /RM 6,550/.test(job), job.slice(0, 700));
  say(
    "而且讲得出那只是到目前为止的（这一单还没收齐）",
    /not fully paid yet, so this is what it has kept so far/i.test(job),
    job.slice(0, 900),
  );
  say(
    "而且列得出花在哪几样",
    /Materials RM 6,200/.test(job) && /Labour RM 1,800/.test(job),
    job.slice(0, 800),
  );

  /* 3. 一张还没有开销挂上去的单，不准写「赚 RM X」 */
  const { data: bare } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id,
    in_module_key: "quotations",
    in_title: "Kitchen only",
    in_party: "Ang Chee Keong",
    in_party_id: him.id,
    in_amount_cents: 900_000,
  });
  await api.rpc("add_ledger_entry", {
    in_project_id: proj.id,
    in_module_key: "payments",
    in_amount_cents: 300_000,
    in_party: "Ang Chee Keong",
    in_party_id: him.id,
    in_against_id: bare.id,
  });
  await page.goto(`${BASE}/en/portal/quotations/${bare.id}`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page.waitForTimeout(1800);
  await hide(page);
  await page.screenshot({ path: `${OUT}/3-no-costs.png`, fullPage: true });
  const bareText = await readAll(page);
  console.log("拍到  3-no-costs");
  say(
    "没有开销挂上去的单，不宣称它赚了多少",
    !/This job kept/i.test(bareText),
    bareText.slice(0, 600),
  );
  say(
    "而且讲得出该怎么做，不是一片空白",
    /No expenses are filed against this job yet/i.test(bareText),
    bareText.slice(0, 700),
  );

  /* 4. 开销那一页：填得了类别，也挑得到单 */
  await page.goto(`${BASE}/en/portal/expenses/new`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide(page);
  await page.screenshot({ path: `${OUT}/4-expense-form.png`, fullPage: true });
  const formText = await readAll(page);
  console.log("拍到  4-expense-form");
  say("开销页上有「这笔钱是干什么的」", /What this was for/i.test(formText), formText.slice(0, 400));
  say("也有「算在哪一单上」", /Which job this belongs to/i.test(formText), formText.slice(0, 400));
  const catBox = page.locator('input[aria-label="What this was for"]');
  say("而且那一格真的打得了字", await catBox.isEditable(), "打不了字");
  const optVals = await page
    .locator("#money-category-list option")
    .evaluateAll((els) => els.map((e) => e.getAttribute("value")));
  say(
    "下拉里是他自己打过的类别（不是我们编的）",
    optVals.includes("Materials") && optVals.includes("Labour"),
    JSON.stringify(optVals),
  );

  /* 5. 收款那一页不准出现「算在哪一单上」 */
  await page.goto(`${BASE}/en/portal/payments/new`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const payText = await readAll(page);
  say(
    "收款那一页没有「算在哪一单上」（进来的钱走分摊）",
    !/Which job this belongs to/i.test(payText),
    payText.slice(0, 400),
  );
  say("但类别照样有 —— 进来的钱也可以说它是什么", /What this was for/i.test(payText), payText.slice(0, 400));

  /* 6. 手机 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(phone);
  await phone.goto(`${BASE}/en/portal/expenses/new`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await phone.waitForTimeout(1500);
  await hide(phone);
  await phone.screenshot({ path: `${OUT}/5-phone-390.png`, fullPage: true });
  console.log("拍到  5-phone-390");
  const scrolls = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  say("手机上不用左右滑", !scrolls, "会横滑");
  const small = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, select, input")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height < 40) {
        const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24);
        out.push(`${el.tagName}:${name}=${Math.round(r.height)}`);
      }
    }
    return out;
  });
  say("手机上每一颗都按得稳（>=40px）", small.length === 0, small.join(" · "));

  /* 英文系统里画面上没有中文（重点 22d：拿错道具比产品的毛病更常见）。 */
  const cjk = (await phone.locator("body").innerText()).match(/[一-鿿]/g) ?? [];
  say("英文系统里画面上没有中文", cjk.length === 0, cjk.join(""));
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
  if (browser) await browser.close();
}

console.log(`\n判：${bad.length} 项没过`);
for (const b of bad) console.log(`  · ${b}`);
process.exit(bad.length ? 1 : 0);
