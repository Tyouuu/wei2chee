/**
 * 她放过几次飞机 · 这一单要不要订金 —— 真的登入、真的按、真的看画面。
 *
 *   node scripts/shoot-noshow.mjs
 *
 * [任务 333/354] 量出来的三格里最后两格：`deposit_advice` ·
 * `set_appointment_deposit` · `set_booking_rules` 20260909320000 就在跑，
 * 到这一轮为止零个呼叫端。这一支走整条线：
 *   开两次没来的记录 → 打开她下一次的预约 → 还没设规矩，画面上讲不出建议 →
 *   老板在这一张单上把规矩填了 → 重新整理 → 这一次讲得出建议 →
 *   柜台收订金、存起来 → 重新整理还在 → 按「不收了」→ 清掉
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
const OUT = ".screenshots/noshow";
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
    .eq("slug", "beauty")
    .single();
  const { data: lead } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: {} })
    .select("id")
    .single();

  const email = `noshowshot-${stamp}@formae.test`;
  const password = `Ns-${stamp}-x!`;
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
    .update({ business_name: "Petal Beauty Bar" })
    .eq("id", P);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  const say = async (fn, args) => {
    const { data, error } = await c.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  await say("add_project_page", { requested_key: "staff", new_title: "Staff" });
  await say("add_project_page", { requested_key: "bookings", new_title: "Bookings" });

  const lim = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });

  const hour = 3600000;
  const past = (h) => new Date(Date.now() - h * hour).toISOString();
  const future = (h) => new Date(Date.now() + h * hour).toISOString();

  /* 两次没来 —— 不同时段，不然撞上排他约束（同一个专案没有指定师傅
     就是共用同一把锁）。 */
  for (const startH of [96, 72]) {
    const id = await say("add_appointment", {
      in_project_id: P,
      in_module_key: "bookings",
      in_starts_at: past(startH),
      in_ends_at: past(startH - 1),
      in_party: "Mrs Lim",
      in_party_id: lim.id,
      in_service: "Facial",
    });
    await say("set_appointment_status", { in_id: id, in_status: "no_show" });
  }
  /* 一次真的来了。 */
  const cameId = await say("add_appointment", {
    in_project_id: P,
    in_module_key: "bookings",
    in_starts_at: past(48),
    in_ends_at: past(47),
    in_party: "Mrs Lim",
    in_party_id: lim.id,
    in_service: "Facial",
  });
  await say("set_appointment_status", { in_id: cameId, in_status: "done" });

  /* 下一次要来的那一单 —— 这一支走完全程要打开的那一张。 */
  const nextId = await say("add_appointment", {
    in_project_id: P,
    in_module_key: "bookings",
    in_starts_at: future(24),
    in_ends_at: future(25),
    in_party: "Mrs Lim",
    in_party_id: lim.id,
    in_service: "Facial",
  });

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1100 },
    deviceScaleFactor: 2,
  });
  await login(page, email, password);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });

  /* ── ① 还没设规矩：讲得出「放过两次」，讲不出建议 ──────────────────── */
  console.log("\n① 还没设规矩");
  await page.goto(`${BASE}/en/portal/bookings/${nextId}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector("text=No-shows & deposit", { timeout: 90000 });
  const body1 = await page.evaluate(() => document.body.innerText);
  check("这一段画出来了", body1.includes("No-shows & deposit"));
  check("讲得出「放过两次」", body1.includes("Missed 2 of 3 visits"), body1.slice(0, 500));
  check("🔴 还没设规矩，讲不出建议", !body1.includes("consider asking for a deposit"));
  check("老板看得到「这门生意的规矩」那一段", body1.includes("This shop's no-show policy"));
  await page.screenshot({ path: `${OUT}/1-no-policy.jpg`, type: "jpeg", quality: 82, fullPage: true });

  /* ── ② 老板在这一张单上把规矩填了 ─────────────────────────────────── */
  console.log("\n② 填规矩：放 2 次之后要收 RM 50");
  await page
    .locator("label", { hasText: "Ask for a deposit after this many no-shows" })
    .locator("input")
    .fill("2");
  await page.locator("label", { hasText: "How much" }).locator("input").fill("50");
  await page.getByRole("button", { name: "Save policy", exact: true }).click();
  await page
    .waitForFunction(
      () => document.body.innerText.includes("consider asking for a deposit"),
      undefined,
      { timeout: 30000 },
    )
    .catch(() => {});
  const body2 = await page.evaluate(() => document.body.innerText);
  check("🔴 存了规矩，同一张单现在讲得出建议", body2.includes("consider asking for a deposit"), body2.slice(0, 600));
  check("建议的金额是 RM 50", body2.includes("RM 50"), body2.slice(0, 600));
  await page.screenshot({ path: `${OUT}/2-policy-set.jpg`, type: "jpeg", quality: 82, fullPage: true });

  /* ── ③ 柜台收订金 ─────────────────────────────────────────────────── */
  console.log("\n③ 收订金 RM 50");
  const noShowSection = page.locator("h2", { hasText: "No-shows & deposit" }).locator("xpath=../..");
  await noShowSection.locator("label", { hasText: "Deposit for this booking" }).locator("input").fill("50");
  await noShowSection.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .waitForFunction(() => document.body.innerText.includes("Remove"), undefined, { timeout: 30000 })
    .catch(() => {});
  const body3 = await page.evaluate(() => document.body.innerText);
  check("🔴 存了之后画面上多一颗「Remove」——已经有订金了", body3.includes("Remove"));
  const { data: apptRow } = await admin
    .from("appointments")
    .select("deposit_cents")
    .eq("id", nextId)
    .single();
  check("资料库里这一单真的记着 RM 50", Number(apptRow?.deposit_cents) === 5000, apptRow?.deposit_cents);
  await page.screenshot({ path: `${OUT}/3-deposit-set.jpg`, type: "jpeg", quality: 82, fullPage: true });

  /* ── ④ 重新整理，还在 ─────────────────────────────────────────────── */
  console.log("\n④ 重新整理");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("text=No-shows & deposit", { timeout: 90000 });
  const body4 = await page.evaluate(() => document.body.innerText);
  check("重新整理之后订金还在（Remove 还在）", body4.includes("Remove"));

  /* ── ⑤ 「不收了」——清掉 ───────────────────────────────────────────── */
  console.log("\n⑤ 不收了");
  await page.click('button:has-text("Remove")');
  await page
    .waitForFunction(() => !document.body.innerText.includes("Remove"), undefined, { timeout: 30000 })
    .catch(() => {});
  const body5 = await page.evaluate(() => document.body.innerText);
  check("🔴 按了「不收了」，「Remove」不见了", !body5.includes("Remove"), body5.slice(0, 300));
  const { data: apptRow2 } = await admin
    .from("appointments")
    .select("deposit_cents")
    .eq("id", nextId)
    .single();
  check("资料库里这一单的订金清空了", apptRow2?.deposit_cents == null, apptRow2?.deposit_cents);
  await page.screenshot({ path: `${OUT}/4-deposit-cleared.jpg`, type: "jpeg", quality: 82, fullPage: true });

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
