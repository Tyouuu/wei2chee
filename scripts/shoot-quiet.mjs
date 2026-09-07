/**
 * 「他还在不在开」—— 在真的浏览器里看一次那张后台。
 *
 * ── 为什么这一支要存在 ────────────────────────────────────────────────────
 *
 * `console_quiet_customers` 跟 `console_customers` 新的那两栏
 * （20260906520000 · 530000 · [任务 227](../docs/founder-tasks.md#227)）
 * 23 条真身分的断言全过（`check:console`），而**画面上一个字都没有** ——
 * [任务 252](../docs/founder-tasks.md#252) 数的那 19 支之一。
 *
 * 🔴 而它答的是[任务 133](../docs/founder-tasks.md#133) 那一句：
 * **续约率不是一个指标，它就是这盘生意本身**（五成续约 ≈ 白做那一套的工）。
 * 而**续约那一天太晚了** —— 能提早看的是「他还在不在开」。
 *
 * ── ⚠️ 它不碰他真的那一个后台 ─────────────────────────────────────────────
 *
 * `shoot:console` 用的是**他自己那个真的帐号**（magic link），
 * 所以那一支不能拿来种一个假的客户。这一支自己开一个 founder、
 * 一个安静了六十天的客户，看完两个都删掉。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowawayOnExit, dropThrowaways } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const stamp = Date.now();

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
const ok = (name, cond, saw) => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

const people = [];
async function person(tag, { signIn = true } = {}) {
  const email = `quiet-${tag}-${stamp}@formae.test`;
  const password = `Quiet-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  people.push(data.user.id);
  if (!signIn) return { id: data.user.id, email, password, client: null };
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { error: e2 } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  return { id: data.user.id, email, password, client };
}
/* ⚠️ 两个都要删，而且**逐个写出 id** —— 一支照 pattern 扫全库删东西的程式，
   正是 2026-09-04 炸掉示范帐号的那把枪（[任务 129](../docs/founder-tasks.md#129)）。 */
dropThrowawayOnExit(admin, () => people);

const projectOf = async (id) => {
  const { data } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", id)
    .single();
  return data?.id;
};

let browser;
try {
  const founder = await person("founder");
  const { error: roleErr } = await admin
    .from("accounts")
    .update({ role: "founder" })
    .eq("id", founder.id);
  if (roleErr) throw new Error(`role: ${roleErr.message}`);

  /* 🔴 一个从来没有打开过的客户，而且六十天前就开了户。
     `console_quiet_customers` 对没有登入纪录的**退回「从开户到今天」** ——
     一个 null 排在最后，会让最该打那通电话的那一个看不见。 */
  const gone = await person("gone", { signIn: false });
  const goneProject = await projectOf(gone.id);
  const longAgo = new Date(Date.now() - 60 * 86400e3).toISOString();
  const { error: dateErr } = await admin
    .from("projects")
    .update({ business_name: `Wai Seng ${stamp}`, created_at: longAgo })
    .eq("id", goneProject);
  if (dateErr) throw new Error(`backdate: ${dateErr.message}`);

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.fill('input[type="email"]', founder.email);
  await page.fill('input[type="password"]', founder.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/console|portal/, { timeout: 240000 });
  await page.goto(`${BASE}/en/console`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(3000);

  const body = await page.locator("body").innerText();
  ok(
    "那一张后台打得开（他自己的身分）",
    /Gone quiet|Customers/i.test(body),
    body.slice(0, 200),
  );

  console.log("\n① 谁安静了");
  ok("🔴 那一段在", /Gone quiet/i.test(body), body.slice(0, 300));
  ok(
    "🔴 那一家在名单上",
    body.includes(`Wai Seng ${stamp}`),
    body.slice(0, 400),
  );
  /* 🔴 「几天没打开」是他要讲的那一句 —— 一个日期要他自己去减。 */
  ok(
    "🔴 讲的是「几天没打开」，不是一个要他自己去减的日期",
    /6[01] days quiet/.test(body),
    (body.match(/\d+ days? quiet/) ?? ["没有"])[0],
  );
  ok(
    "而且讲得出这个月有没有询价",
    /no enquiries this month/i.test(body),
    body.slice(0, 400),
  );
  /* ⚠️ 第一版写死「不到五个客户」，而跑的时候那个资料库里有十一个 ——
     **那是我的断言在假设环境，不是产品错了**。
     问的改成：**画面上那一句，跟画面上那个数字对不对得上**
     （[任务 43](../docs/founder-tasks.md#43) · [227](#227)：
     不到五个客户，那一份不能拿来做决定）。 */
  const seen = await page.locator("table tbody tr").count();
  const tooEarly = /not something to act on yet/i.test(body);
  const asList = /Nobody renews a system/i.test(body);
  ok(
    "⚠️ 那一句跟画面上那个数字对得上（<5 讲「还不能拿来做决定」）",
    seen < 5 ? tooEarly && !asList : asList && !tooEarly,
    `${seen} 家 · tooEarly=${tooEarly} · asList=${asList}`,
  );
  ok(
    "从来没打开过的那一格讲得出来",
    /Never opened/i.test(body),
    body.slice(0, 500),
  );

  console.log("\n② 客户名单多的那两栏");
  const heads = await page.locator("table thead th").allInnerTexts();
  ok(
    "🔴 「上一次打开」那一栏在",
    heads.some((h) => /Last opened/i.test(h)),
    heads.join(" | "),
  );
  ok(
    "🔴 「这个月的询价」那一栏在",
    heads.some((h) => /Enquiries this month/i.test(h)),
    heads.join(" | "),
  );
  /* ⚠️ 原本那六栏一栏都没有掉 —— 只加不改（[重点 31]：先做「加」）。 */
  for (const want of ["Business", "Trade", "Pages", "Stage", "Fees", "Updated"]) {
    ok(
      `原本的「${want}」还在`,
      heads.some((h) => new RegExp(want, "i").test(h)),
      heads.join(" | "),
    );
  }

  await page.screenshot({
    path: ".screenshots/console/quiet.png",
    fullPage: true,
  });

  console.log("\n③ 390 —— 他在路上也会看");
  const mp = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: await context.storageState(),
    })
  ).newPage();
  await mp.goto(`${BASE}/en/console`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await mp.waitForTimeout(2500);
  ok(
    "那一段在",
    /Gone quiet/i.test(await mp.locator("body").innerText()),
  );
  const wide = await mp.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  /* 🔴 那张客户表本来就是横着滚的（`min-w-[880px]`，而它自己包在
     `overflow-x-auto` 里）—— 所以问的是**整页**横不横滚，不是那张表。 */
  ok("390 上整页不横滚", !wide);
  await mp.screenshot({ path: ".screenshots/console/quiet-390.png" });
} finally {
  if (browser) await browser.close().catch(() => {});
  /* ⚠️ 两个都删掉 —— 留一个在 `accounts` 里，
     后台那个「客户数」就会把它算进去，而那正是他拿来做决定的那个数字
     （[任务 129](../docs/founder-tasks.md#129)）。 */
  if (people.length) await dropThrowaways(admin, people);
}

console.log(`\n判：${pass} 过 ${fail} 没过`);
console.log("→ .screenshots/console/quiet*.png  ⚠️ 现在去用眼睛看那两张图");
process.exitCode = fail ? 1 : 0;
