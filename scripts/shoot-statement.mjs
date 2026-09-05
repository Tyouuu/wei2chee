#!/usr/bin/env node
/**
 * npm run shoot:statement
 *
 * 他每个月要发给这个客人的那一张纸。
 *
 * ── 这一支在量什么 ────────────────────────────────────────────────────────
 *
 * [任务 147] 20260905 把月结对帐单的算术做完了，而它自己的收尾写着
 * 「**那张纸不存在** —— 这是算术，画面那一半不是我的地盘」。
 * 这一支量那张纸在不在，而且量它讲的话对不对。
 *
 * ── 🔴 最要紧的一条：期末余额要跟 party_debts 一分不差 ──────────────────
 *
 * 「他还欠我多少」只能有一个答案。对帐单如果自己把几行加一次，
 * 那就是同一个问题的第二个答案 —— 而这个仓库栽在那上面至少八次。
 * 所以这一支**两边各问一次，然后比**。
 *
 * ── 🔴 第二条：师傅那一边整段不画 ────────────────────────────────────────
 *
 * `party_statement` 是 sees_money 的，师傅打它拿回**零行**，
 * 而零行会画成一张空的对帐单，读起来是「这个客人什么都没欠」。
 * ⚠️ 而这一条要**带控制组**（[任务 125] 的教训）：先证明老板那一边真的看得到，
 *    不然「师傅看不到」量的可能是「根本没有资料」。
 *
 * ── ⚠️ 两个踩过的坑 ──────────────────────────────────────────────────────
 *
 * · 那个查询构造器是 thenable 不是 Promise —— `.catch` 直接挂上去会炸。要先 await
 * · 用完就删，含被 head/tail 掐断的时候（[任务 196]）。
 *   🔴 **绝对不照名字扫全库删** —— [任务 129] 那把枪炸掉过示范帐号
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
const OUT = ".screenshots/statement";
const EMAIL = `stmt-${Date.now()}@formae.test`;
const MATE = `stmt-mate-${Date.now()}@formae.test`;
const PASSWORD = "throwaway-" + Math.random().toString(36).slice(2);

mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const mateApi = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
let mateId = null;
dropThrowawayOnExit(admin, () => userId);

let browser;
let bad = 0;
const say = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad += 1;
};
const rm = (cents) => `RM ${(cents / 100).toLocaleString("en-MY")}`;

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

  const { data: party, error: pErr } = await api.rpc("add_directory_entry", {
    in_project_id: proj.id,
    in_module_key: "customers",
    in_name: "Hup Seng Trading",
  });
  if (pErr) throw new Error(`party: ${pErr.message}`);

  /* 这个月：开两张单，收一笔。期末应该是 48,500 + 12,000 − 20,000 = 40,500 */
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  for (const [title, cents] of [
    ["Taman Desa kitchen", 4850000],
    ["Bathroom refit", 1200000],
  ]) {
    const { error } = await api.rpc("add_pipeline_record", {
      in_project_id: proj.id,
      in_module_key: "quotations",
      in_title: title,
      in_party: "Hup Seng Trading",
      in_party_id: party.id,
      in_amount_cents: cents,
      in_issued_on: today,
    });
    if (error) throw new Error(`record ${title}: ${error.message}`);
  }
  const { error: payErr } = await api.rpc("add_ledger_entry", {
    in_project_id: proj.id,
    in_module_key: "payments",
    in_direction: "in",
    in_amount_cents: 2000000,
    in_party: "Hup Seng Trading",
    in_party_id: party.id,
    in_entry_on: today,
  });
  if (payErr) throw new Error(`payment: ${payErr.message}`);

  /* 🔴 两边各问一次 —— 那是这一支存在的理由 */
  const month = today.slice(0, 7);
  const lastDay = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const edges = { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };

  const { data: stmt, error: sErr } = await api.rpc("party_statement", {
    p_project_id: proj.id,
    p_party_id: party.id,
    p_from: edges.from,
    p_to: edges.to,
  });
  if (sErr) throw new Error(`statement: ${sErr.message}`);
  const closing = stmt.length ? Number(stmt[stmt.length - 1].running_cents) : null;

  const { data: debts, error: dErr } = await api.rpc("party_debts", { in_project_id: proj.id });
  if (dErr) throw new Error(`debts: ${dErr.message}`);
  const owed = (debts ?? []).find((d) => d.party_id === party.id);
  const owedCents = owed ? Number(owed.owed_cents ?? owed.total_cents ?? 0) : 0;

  say(
    "🔴 期末余额跟「他欠我多少」一分不差",
    closing === owedCents,
    `对帐单 ${closing} · party_debts ${owedCents}`,
  );

  /* 师傅：加进来，然后拿他自己的登入去问 */
  const { data: mate } = await admin.auth.admin.createUser({
    email: MATE,
    password: PASSWORD,
    email_confirm: true,
  });
  mateId = mate?.user?.id ?? null;
  /* ⚠️ 那个查询构造器是 thenable 不是 Promise —— 要先 await */
  const { error: memErr } = await api.rpc("add_project_member", {
    in_email: MATE,
    in_role: "crew",
  });
  if (memErr) throw new Error(`add member: ${memErr.message}`);

  await mateApi.auth.signInWithPassword({ email: MATE, password: PASSWORD });
  const { data: mateRows } = await mateApi.rpc("party_statement", {
    p_project_id: proj.id,
    p_party_id: party.id,
    p_from: edges.from,
    p_to: edges.to,
  });
  say(
    "🔴 师傅问不到（而上面那一条是控制组）",
    (mateRows ?? []).length === 0,
    `拿回 ${(mateRows ?? []).length} 行`,
  );

  browser = await chromium.launch();
  for (const [w, h, tag] of [
    [1440, 1500, "1-wide"],
    [390, 1000, "2-phone-390"],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/portal/, { timeout: 180000 });
    await page.goto(`${BASE}/en/portal/customers/${party.id}`, {
      waitUntil: "networkidle",
      timeout: 180000,
    });
    await page.waitForTimeout(2400);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

    /* 🔴 载不到就是失败，不要对着一张登入页印读数 */
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    if (/log in|sign in/i.test(h1) || /something broke|not found/i.test(h1)) {
      say(`${tag} 打得开`, false, `h1「${h1}」`);
      continue;
    }

    if (tag === "1-wide") {
      const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say("那张纸在客户那一页上", /Monthly statement/i.test(body), body.slice(0, 200));
      say(
        "两张单都列出来了",
        /Taman Desa kitchen/.test(body) && /Bathroom refit/.test(body),
        body.slice(0, 400),
      );
      say(
        "🔴 画面上那个期末余额就是资料库算的那一个",
        body.includes(rm(closing)),
        `找 ${rm(closing)} · ${body.slice(body.indexOf("Monthly statement"), body.indexOf("Monthly statement") + 420)}`,
      );

      /* 🔴 看图才看到的：期末写 RM 60,500，而正上方写着
         「已付、还没用掉 RM 20,000」。两个数字都对（订金故意不冲销余额），
         **而那张纸发出去，客人会回一句「我付过两万了」。**
         [任务 147] 的原话就是两个数字要一起讲。 */
      say(
        "🔴 期末底下要讲那笔订金——两个数字一起讲",
        /not yet applied/i.test(body) && body.includes(rm(2000000)),
        body.slice(body.indexOf("Closing balance"), body.indexOf("Closing balance") + 240),
      );

      /* 换一个没有来往的月份 —— 空的时候要讲期初，不是画一张空表 */
      await page.getByLabel(/Which month/i).fill("2026-01");
      await page.waitForTimeout(1800);
      const quiet = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say(
        "没有来往的月份讲一句话，不是一张空表",
        /Nothing happened this month/i.test(quiet),
        quiet.slice(0, 300),
      );
      await page.getByLabel(/Which month/i).fill(month);
      await page.waitForTimeout(1800);
    }

    if (tag === "2-phone-390") {
      /* 🔴 看图才看到的：390 的时候那张五栏表被切掉，
         **而被切掉的正好是「期末余额」** ——
         他打开这一页要看的就是那一个数字。
         一个被切断的金额，读起来是一个错的数字。 */
      const seen = await page.evaluate(() => {
        const w = window.innerWidth;
        return [...document.querySelectorAll("main *")]
          .filter((el) => !el.children.length && (el.textContent || "").trim())
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.right <= w + 1 && b.left >= -1;
          })
          .map((el) => (el.textContent || "").trim());
      });
      const shown = seen.join(" | ");
      say(
        "🔴 手机上看得到期末余额（没有被切掉）",
        seen.some((t) => t.includes(rm(closing))),
        `找 ${rm(closing)} · ${shown.slice(0, 300)}`,
      );
      say(
        "手机上也看得到那笔订金那一句",
        seen.some((t) => /not yet applied/i.test(t)),
        shown.slice(0, 300),
      );
    }

    await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    console.log(`拍到  ${tag} · h1「${h1}」`);
  }

  console.log(`\n判：${bad ? `🔴 ${bad} 项没过` : "全部过"}`);
  console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那两张`);
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, mateId);
  await dropThrowaway(admin, userId);
}

process.exit(bad ? 1 : 0);
