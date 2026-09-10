/**
 * 补习总览换掉「最近的学费单」—— 真的登入、真的开单、真的看画面。
 *
 *   npm run shoot:tuition-owing
 *
 * [任务 337] 量出来的：总览一直画着「Recent fee bills」，任何状态都列，
 * 而他真正要的第一句话是「这个月谁还没交」。这一支走真的三个学生：
 * 一个全交了（不该出现）· 一个欠着但还没到期（"Owing"，灰）·
 * 一个欠了 45 天（"Overdue"，红），排序是欠得多的在前面。
 */
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { dropThrowawayOnExit, dropThrowaway } from "./lib/throwaway.mjs";

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
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/tuition-owing";
mkdirSync(OUT, { recursive: true });

let pass = 0;
const bad = [];
const check = (what, ok, saw) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${what}`);
  } else {
    bad.push(what);
    console.log(`  FAIL  ${what}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

const stamp = Date.now();
let ownerId = null;
let browser = null;
dropThrowawayOnExit(admin, () => ownerId);

async function login(page, email, password) {
  await page
    .goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 })
    .catch(() => page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 90000 }));
  await page.waitForSelector("input[type=email]", { timeout: 60000 });
  for (let go = 0; go < 3; go++) {
    await page.fill("input[type=email]", email);
    await page.fill("input[type=password]", password);
    await page.click("button[type=submit]");
    const landed = await page
      .waitForURL(/\/portal/, { timeout: 90000 })
      .then(() => true, () => false);
    if (landed) return;
    const said = await page.locator('[role="alert"]').first().innerText().catch(() => "");
    if (said.trim()) throw new Error(`登入被拒：${said.trim()}`);
    await page.waitForSelector("input[type=email]", { timeout: 60000 });
  }
  throw new Error("登入按了三次都没有走到 /portal");
}

try {
  const { data: ind } = await admin
    .from("industries")
    .select("id")
    .eq("slug", "education")
    .single();
  const { data: lead } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: {} })
    .select("id")
    .single();

  const email = `tuitionowing-${stamp}@formae.test`;
  const password = `To-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { lead_id: lead.id },
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  ownerId = made.user.id;

  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", ownerId)
    .single();
  const P = proj.id;
  await admin
    .from("projects")
    .update({ business_name: "Bright Minds Tuition" })
    .eq("id", P);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  const say = async (fn, args) => {
    const { data, error } = await c.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  await say("add_project_page", { requested_key: "customers", new_title: "Students" });
  await say("add_project_page", { requested_key: "orders", new_title: "Fee bills" });

  const paid = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Meng",
  });
  const owing = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Hui",
  });
  const overdue = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Seng",
  });

  /* 全交了 —— 不该出现在「谁还没交」。 */
  const paidBill = await say("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "orders",
    in_title: "September fees",
    in_party: "Ah Meng",
    in_party_id: paid.id,
    in_amount_cents: 20000,
  });
  await say("add_ledger_entry", {
    in_project_id: P,
    in_module_key: "payments",
    in_direction: "in",
    in_amount_cents: 20000,
    in_party: "Ah Meng",
    in_party_id: paid.id,
    in_against_id: paidBill.id,
  });

  /* 还没到期，欠着 —— "Owing"，灰。 */
  await say("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "orders",
    in_title: "September fees",
    in_party: "Ah Hui",
    in_party_id: owing.id,
    in_amount_cents: 30000,
  });

  /* 到期 45 天 —— "Overdue"，红，而且金额比上面那笔大，排在最前面。 */
  const pastDue = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  await say("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "orders",
    in_title: "August fees",
    in_party: "Ah Seng",
    in_party_id: overdue.id,
    in_amount_cents: 45000,
    in_due_on: pastDue,
  });

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 2,
  });
  await login(page, email, password);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });

  await page.goto(`${BASE}/en/portal/dashboard`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("text=Who still owes", { timeout: 90000 });
  const body = await page.evaluate(() => document.body.innerText);

  check("表头换成了「Who still owes」", body.includes("Who still owes"));
  check("金额栏叫「Owes」", body.includes("Owes"));
  check("🔴 全交了的 Ah Meng 不出现", !body.includes("Ah Meng"), body.slice(0, 400));
  check("欠着的 Ah Hui 在，写着 Owing", /Ah Hui[\s\S]{0,60}Owing/.test(body), body.slice(0, 400));
  check("到期的 Ah Seng 在，写着 Overdue", /Ah Seng[\s\S]{0,60}Overdue/.test(body), body.slice(0, 400));
  check(
    "🔴 欠得多的排前面（Ah Seng RM 450 在 Ah Hui RM 300 之前）",
    /Ah Seng[\s\S]*Ah Hui/.test(body),
    body.slice(0, 400),
  );
  check("RM 450 · RM 300 都在", body.includes("RM 450") && body.includes("RM 300"));
  await page.screenshot({ path: `${OUT}/1-owner-dashboard.jpg`, type: "jpeg", quality: 82, fullPage: true });

  await page.close();
} catch (e) {
  bad.push(String(e?.message ?? e));
  console.log(`\n🔴 ${e?.message ?? e}`);
} finally {
  if (browser) await browser.close();
  const cleared = await dropThrowaway(admin, ownerId);
  console.log(cleared ? "\n临时帐号删掉了" : "\n🔴 删不掉");
}

console.log(`\n判：${pass} 过 · ${bad.length} 没过`);
if (bad.length) {
  for (const x of bad) console.log(`  · ${x}`);
  process.exitCode = 1;
}
