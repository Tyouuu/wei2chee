/**
 * 他欠多少、欠多久、超不超额 —— 用眼睛看。
 *
 * 重点 7l。220 条真的呼叫全过，而那些答不了这一件：
 * **那一句有没有在他挑完客户、还没写金额的那一刻出现。**
 * 一句出现在错的时刻的提醒，跟没有那一句一样。
 *
 * ⚠️ 用完就删的帐号，不动他的 demo。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/credit";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `credit-${stamp}@formae.test`;
const PASSWORD = `Credit-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const shots = [];
let userId = null;
let browser;

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const P = proj.id;

  /* 一个欠得多又欠得久的客户，跟一个乾乾净净的。 */
  const { data: heavy } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Heng Hardware",
  });
  await api.rpc("update_directory_entry", {
    in_id: heavy.id, in_credit_limit_cents: 2_000_000,
  });
  await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Last month's load",
    in_party: "Heng Hardware", in_party_id: heavy.id,
    in_amount_cents: 3_000_000, in_issued_on: "2026-07-01",
  });
  const { data: clean } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ong Trading",
  });
  void clean;

  browser = await chromium.launch();
  const say = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
    if (!ok) shots.push({ name, stuck: true });
  };

  for (const [w, h, tag] of [[1440, 1000, "1-wide"], [390, 844, "3-phone-390"]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/portal/, { timeout: 180000 });
    await page.goto(`${BASE}/en/portal/quotations/new`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForTimeout(1200);

    /* ⚠️ 那一格叫什么，是**这一家自己**决定的（一个新帐号还没有分析，
       所以它不叫「Client」）。用那个挂着客户名单的下拉去认它 ——
       全表单只有对方那一格有 `list=`。
       第一版写死「Client」，在一个新帐号上找不到。 */
    const nameBox = page.locator("input[list]").first();

    /* 乾净的那个：一个字都不该出现。 */
    await nameBox.fill("Ong Trading");
    await page.waitForTimeout(400);
    const cleanBody = (await page.locator("main").innerText()).replace(/\s+/g, " ");

    /* 欠钱的那个。 */
    await nameBox.fill("Heng Hardware");
    await page.waitForTimeout(400);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    const owingBody = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    const stuck = /log in|sign in/i.test(h1) || /something broke|does not exist/i.test(h1);
    shots.push({ name: tag, stuck });
    console.log(`${stuck ? "🔴 卡住" : "拍到"}  ${tag} · h1「${h1}」`);

    if (tag !== "1-wide") continue;

    say("挑一个不欠钱的客户，一个字都不出现",
      !/Already owes/i.test(cleanBody), cleanBody.slice(0, 300));
    say("挑一个欠钱的，讲得出他欠多少",
      /Already owes RM 30,000/.test(owingBody), owingBody.slice(0, 400));
    /* 🔴 「多久了」是这一句真正的价值 —— RM 30,000 欠三天跟欠六十天，
       是两个完全不同的决定。 */
    say("而且讲得出欠多久", /oldest is \d+ days/.test(owingBody), owingBody.slice(0, 400));
    say("超过他自己写的额度，讲出来", /over the limit you set/i.test(owingBody),
      owingBody.slice(0, 400));
    /* 🔴 只出现一次。第一版它印在「工程」「客户」「报价」三格底下 ——
       因为那一句放在每一格共用的那支函式结尾、没有条件。
       读数全绿，看图一眼就看到。 */
    const howManyTimes = (owingBody.match(/Already owes/g) ?? []).length;
    say("而且只出现一次（在对方那一格底下）", howManyTimes === 1, `出现了 ${howManyTimes} 次`);
    /* ⚠️ 而且**不挡他开单** —— 那个额度是他自己随手写的一个数字。 */
    const saveDisabled = await page
      .getByRole("button", { name: /^Save$/i })
      .first()
      .isDisabled();
    say("但是照样开得了单（额度是一句话，不是一道门）", !saveDisabled, "保存被挡住了");
  }
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  shots.push({ name: err.message, stuck: true });
} finally {
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
  if (browser) await browser.close();
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${bad.length} 项没过`);
if (bad.length) for (const b of bad) console.log(`  · ${b.name}`);
process.exit(bad.length ? 1 : 0);
