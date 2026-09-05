#!/usr/bin/env node
/**
 * npm run shoot:referral
 *
 * 「这一单是谁介绍的。」
 *
 * ── 这一支在量什么 ────────────────────────────────────────────────────────
 *
 * 20260905260000 建了三支函式（`set_record_referral` · `referrals_owing` ·
 * `referred_jobs`），而到 2026-09-05 为止 **画面上一个入口都没有** ——
 * [任务 156] 自己的收尾就写着「画面上没有「这一单是谁介绍的」那一格」。
 *
 * ── 🔴 最要紧的一条：按了，资料库真的要变 ────────────────────────────────
 *
 * 这个仓库出过二十次「说了没做」，形状永远一样：
 * **画面讲它做了，而资料库里什么都没发生。**
 * 所以每写一次，就**用真的客户身分回去问那一行**。
 *
 * ── 🔴 第二条：那个数字是资料库算的 ──────────────────────────────────────
 *
 * [任务 156]：比例算在**收到的钱**上，不是单上那个总数。
 * 所以这一支故意让那张单只收一部分钱，然后比画面上印的那个数字
 * 跟 `referred_jobs` 回的那一个 —— **两个一定要一模一样**。
 *
 * ── ⚠️ 它一分钱都不碰 ────────────────────────────────────────────────────
 *
 * [任务 156]：替他记一笔他还没讲过要给的钱，是在他帐上凭空多一笔支出。
 * 记完介绍费之后，钱那张表的行数**一行都不可以多**。
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const BASE = "http://localhost:3000";
const OUT = ".screenshots/referral";
const EMAIL = `ref-${Date.now()}@formae.test`;
const PASSWORD = "throwaway-" + Math.random().toString(36).slice(2);

mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
dropThrowawayOnExit(admin, () => userId);

let browser;
let bad = 0;
const say = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad += 1;
};

/** 那一行现在挂着谁 —— 用真的客户身分问，不是看画面 */
const rowOf = async (id) => {
  const { data } = await api
    .from("pipeline_records")
    .select("referrer_id, referral_portion, referral_amount_cents")
    .eq("id", id)
    .maybeSingle();
  return data ?? {};
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
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");

  for (const key of ["customers", "quotations", "payments"]) {
    const { error } = await api.rpc("add_project_page", { requested_key: key, new_title: key });
    if (error) throw new Error(`${key}: ${error.message}`);
  }

  /* 两个人：一个是客人，一个是介绍他来的。 */
  const mkParty = async (name) => {
    const { data, error } = await api.rpc("add_directory_entry", {
      in_project_id: proj.id,
      in_module_key: "customers",
      in_name: name,
      in_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(`${name}: ${error.message}`);
    return typeof data === "string" ? data : data?.id;
  };
  const buyerId = await mkParty("Puan Siti");
  const senderId = await mkParty("Ah Ming");

  /* 一张 RM 10,000 的单，而客人只付了 RM 4,000 ——
     🔴 那个差额就是这一支存在的理由：3% 算在 4,000 上，不是 10,000 上。 */
  const { data: job, error: jErr } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id,
    in_module_key: "quotations",
    in_title: "Kitchen refit",
    in_party: "Puan Siti",
    in_party_id: buyerId,
    in_amount_cents: 1000000,
    in_idempotency_key: crypto.randomUUID(),
  });
  if (jErr) throw new Error(`job: ${jErr.message}`);
  const jobId = typeof job === "string" ? job : job?.id;

  const { error: payErr } = await api.rpc("add_ledger_entry", {
    in_project_id: proj.id,
    in_module_key: "payments",
    in_direction: "in",
    in_amount_cents: 400000,
    in_party: "Puan Siti",
    in_party_id: buyerId,
    in_against_id: jobId,
    in_idempotency_key: crypto.randomUUID(),
  });
  if (payErr) throw new Error(`payment: ${payErr.message}`);

  const { count: before } = await api
    .from("ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("project_id", proj.id);

  say("一开始没有人介绍", (await rowOf(jobId)).referrer_id === null, JSON.stringify(await rowOf(jobId)));

  browser = await chromium.launch();
  for (const [w, h, tag] of [
    [1440, 1400, "1-wide"],
    [390, 900, "2-phone-390"],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/portal/, { timeout: 180000 });
    await page.goto(`${BASE}/en/portal/quotations/${jobId}`, {
      waitUntil: "networkidle",
      timeout: 180000,
    });
    await page.waitForTimeout(2000);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

    /* 🔴 载不到就是失败，不要对着一张登入页印读数 */
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    if (/log in|sign in/i.test(h1) || /something broke|not found/i.test(h1)) {
      say(`${tag} 打得开`, false, `h1「${h1}」`);
      continue;
    }

    const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    say(`${tag} 那一段在单上`, /Who sent this one in/i.test(body), body.slice(0, 200));

    if (tag === "1-wide") {
      /* 🔴 那一句一定要讲清楚比例算在哪一笔钱上 —— 一个看到 3% 的老板
         会以为是 RM 10,000 的 3%。 */
      say(
        "🔴 而它讲清楚比例算在收到的钱上",
        /already received/i.test(body),
        body.slice(body.indexOf("Who sent this one in"), body.indexOf("Who sent this one in") + 240),
      );

      const whoBox = page.locator('input[list="referral-people"]');

      /* ── 名字对不上就不猜（[任务 89]）───────────────────────────── */
      await whoBox.fill("Ah Meng");
      await page.getByRole("button", { name: /^Record it$/ }).click();
      await page.waitForTimeout(1500);
      const said = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say(
        "🔴 名字对不上就不猜，而且讲得出是哪一个名字",
        /no “Ah Meng”|no "Ah Meng"/i.test(said) && (await rowOf(jobId)).referrer_id === null,
        said.slice(0, 200),
      );

      /* ── 挂上去，3% ─────────────────────────────────────────────── */
      await whoBox.fill("Ah Ming");
      await page.getByRole("textbox", { name: "Per cent", exact: true }).fill("3");
      await page.getByRole("button", { name: /^Record it$/ }).click();
      /* 🔴 等那一句真的画出来，不要数到 2.5 秒就读。
         `router.refresh()` 重画的是伺服器那一棵树，快慢看机器 ——
         **一把有时候红有时候绿的尺，跟一把坏掉的尺是同一件事**
         （实测三轮里红一轮，而产品每一轮都是对的）。
         ⚠️ 等不到照样红：那才是「它真的没画出来」。 */
      await page
        .waitForFunction(() => /owes him RM/i.test(document.body.innerText), null, {
          timeout: 20000,
        })
        .catch(() => {});
      const row = await rowOf(jobId);
      say(
        "按下去资料库真的挂上了 3%",
        row.referrer_id === senderId && Number(row.referral_portion) === 3,
        JSON.stringify(row),
      );

      /* 🔴 画面上那个数字 = 资料库算的那一个 */
      const { data: jobRows } = await api.rpc("referred_jobs", {
        in_project_id: proj.id,
        in_referrer_id: senderId,
      });
      const mine = (jobRows ?? []).find((j) => j.record_id === jobId);
      const cents = Number(mine?.promised_cents ?? -1);
      const shown = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      /* 🔴 不重写一遍排版规则 —— `ringgit()` 整数不印小数，而我第一版写死了
         `.00`，红的是我的尺不是产品（这一天第十六次）。改成**把画面上那个
         数字读回来**，跟资料库那一个比 —— 把排版反过来，不是再抄一份排版。 */
      const seen = /owes him RM ([0-9,]+(?:\.[0-9]{2})?)/i.exec(shown);
      const onScreen = seen ? Math.round(Number(seen[1].replace(/,/g, "")) * 100) : null;
      say("🔴 3% 算在收到的 RM 4,000 上，不是单上的 RM 10,000", cents === 12000, `${cents} sen`);
      say(
        "🔴 画面印的就是资料库算的那一个",
        onScreen === cents,
        `画面 ${onScreen} sen · 资料库 ${cents} sen`,
      );

      /* 🔴 挂上去的样子也要拍一张 —— 底下那一轮拍的是**清掉之后**，
         而他每天看到的是这一张（有名字、有 3%、有那个数字）。
         一张只有空状态的图，判不了这一段做得好不好。 */
      await page.screenshot({ path: `${OUT}/3-filled.png`, fullPage: true });

      /* 🔴 它一分钱都不碰 */
      const { count: after } = await api
        .from("ledger_entries")
        .select("id", { count: "exact", head: true })
        .eq("project_id", proj.id);
      say("🔴 记完介绍费，钱那张表一行都没有多", after === before, `${before} → ${after}`);

      /* ── 自己介绍自己要挡（资料库那一条）───────────────────────── */
      await whoBox.fill("Puan Siti");
      await page.getByRole("button", { name: /^Record it$/ }).click();
      await page.waitForTimeout(2000);
      const stillMing = await rowOf(jobId);
      say(
        "🔴 客人自己介绍自己挡下来，而原本那一笔还在",
        stillMing.referrer_id === senderId && Number(stillMing.referral_portion) === 3,
        JSON.stringify(stillMing),
      );

      /* ── 阿明自己那一页：他替我带过几单，我还欠他多少 ─────────────
         🔴 那才是他真正的动作 —— 打给阿明之前先看一眼，而不是逐张单对帐。 */
      await page.goto(`${BASE}/en/portal/customers/${senderId}`, {
        waitUntil: "networkidle",
        timeout: 180000,
      });
      await page.waitForTimeout(2000);
      const his = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say("🔴 阿明那一页写着他带过的单", /Jobs he sent you/i.test(his), his.slice(0, 200));
      await page.screenshot({ path: `${OUT}/4-referrer.png`, fullPage: true });
      /* 一分钱都还没给他，所以「还欠」就是「答应给」 —— 而两个数字
         都要从资料库那一支来，不是这一页自己算的。 */
      const { data: owingRows } = await api.rpc("referrals_owing", { in_project_id: proj.id });
      const mineRow = (owingRows ?? []).find((r) => r.referrer_id === senderId);
      const owed = /Still owed RM ([0-9,]+(?:\.[0-9]{2})?)/i.exec(his);
      say(
        "🔴 「还欠他」就是资料库算的那一个",
        owed && Math.round(Number(owed[1].replace(/,/g, "")) * 100) === Number(mineRow?.owing_cents),
        `画面 ${owed?.[1]} · 资料库 ${mineRow?.owing_cents} sen`,
      );
      /* 点得进那一张单 —— 一条连不过去的连结跟一颗按不动的按钮是同一件事 */
      const href = await page
        .locator(`main a[href$="/${jobId}"]`)
        .first()
        .getAttribute("href")
        .catch(() => null);
      say("那一行点得进那张单", !!href && href.includes("/quotations/"), String(href));

      /* 🔴 而买家那一页不可以有这一段 —— 她一单都没有介绍过 */
      await page.goto(`${BASE}/en/portal/customers/${buyerId}`, {
        waitUntil: "networkidle",
        timeout: 180000,
      });
      await page.waitForTimeout(1500);
      const hers = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say(
        "🔴 没有带过单的客户整段不画，不是一份 0 单",
        !/Jobs he sent you/i.test(hers),
        hers.slice(0, 200),
      );

      await page.goto(`${BASE}/en/portal/quotations/${jobId}`, {
        waitUntil: "networkidle",
        timeout: 180000,
      });
      await page.waitForTimeout(1500);

      /* ── 清掉，三栏一起走 ───────────────────────────────────────── */
      await page.getByRole("button", { name: /^Nobody introduced them$/ }).click();
      await page.waitForTimeout(2500);
      const gone = await rowOf(jobId);
      say(
        "清掉之后三栏一起走",
        gone.referrer_id === null &&
          gone.referral_portion === null &&
          gone.referral_amount_cents === null,
        JSON.stringify(gone),
      );
    }

    await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    console.log(`拍到  ${tag} · h1「${h1}」`);
  }

  console.log(`\n判：${bad ? `🔴 ${bad} 项没过` : "全部过"}`);
  console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那两张`);
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

process.exit(bad ? 1 : 0);
