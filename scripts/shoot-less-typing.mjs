#!/usr/bin/env node
/**
 * npm run shoot:less-typing
 *
 * 他开一张新的报价单，而「水泥 50kg · 包 · 18.50」他一个字都不用打。
 *
 * ── 这一支在量什么 ────────────────────────────────────────────────────────
 *
 * [任务 150] 20260905 建了三支函式（他自己的货架 · 他打过的单位 ·
 * 上次卖给这个客人那几行），**而画面上一个入口都没有** ——
 * 一支没有人呼叫得到的函式，跟一支不存在的函式是同一件事。
 *
 * 而 [重点 29] 的量法是**数他要打几个字**。所以这一支真的去数：
 * 同一张单，接之前几个字、接之后几个字。
 * **一个宣称「省了很多字」的功能，跟一个真的省了字的功能，在报告里长得一模一样
 * —— 除非有人去数。**
 *
 * ── 🔴 它一定要开浏览器 ──────────────────────────────────────────────────
 *
 * 那三支函式的单元测试全绿、真客户身分的守卫全绿，**而画面上没有门** ——
 * 那正是这一整轮要修的那件事。一把不开浏览器的尺答不了「他按不按得到」。
 *
 * ── 用完就删 ─────────────────────────────────────────────────────────────
 *
 * 开一个自己的帐号，跑完删掉（含被 head/tail 掐断的时候 —— [任务 196]）。
 * 🔴 **绝对不照名字扫全库删** ——[任务 129] 那把枪炸掉过示范帐号。
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
const OUT = ".screenshots/less-typing";
const EMAIL = `typing-${Date.now()}@formae.test`;
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

  /* 他的货架。⚠️ River sand 卖完了 —— 它要排在后面。 */
  for (const [name, unit, price, onHand] of [
    ["River sand", "load", 12000, 0],
    ["Cement 50kg", "bag", 1850, 84],
  ]) {
    const { data: item, error } = await api.rpc("add_catalog_item", {
      in_project_id: proj.id,
      in_module_key: "inventory",
      in_name: name,
      in_unit: unit,
      in_price_cents: price,
    });
    if (error) throw new Error(`item ${name}: ${error.message}`);
    if (onHand > 0) {
      await api.rpc("move_stock", {
        in_item_id: item.id,
        in_direction: "in",
        in_qty: onHand,
        in_reason: "Opening",
      });
    }
  }

  /* 他的客人，跟上次卖给他的那一张单 */
  const { data: party, error: pErr } = await api.rpc("add_directory_entry", {
    in_project_id: proj.id,
    in_module_key: "customers",
    in_name: "Mr Tan",
  });
  if (pErr) throw new Error(`party: ${pErr.message}`);

  const { data: prev, error: rErr } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id,
    in_module_key: "quotations",
    in_title: "Taman Desa kitchen",
    in_party: "Mr Tan",
    in_party_id: party.id,
    in_amount_cents: 185000,
  });
  if (rErr) throw new Error(`prev record: ${rErr.message}`);

  const { error: lErr } = await api.rpc("set_record_lines", {
    in_record_id: prev.id,
    in_lines: [
      { description: "Cement 50kg", qty: 100, unit: "bag", unit_price_cents: 1850, amount_cents: 185000 },
    ],
  });
  if (lErr) throw new Error(`lines: ${lErr.message}`);

  browser = await chromium.launch();

  for (const [w, h, tag] of [
    [1440, 1100, "1-wide"],
    [390, 844, "2-phone-390"],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/portal/, { timeout: 180000 });
    await page.goto(`${BASE}/en/portal/quotations/new`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

    /* 🔴 载不到就是失败，不要对着一张登入页印读数 */
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    if (/log in|sign in/i.test(h1) || /something broke|not found/i.test(h1)) {
      say(`${tag} 打得开`, false, `h1「${h1}」`);
      continue;
    }

    if (tag === "1-wide") {
      /* ── 他自己的货架在那一格底下 ────────────────────────────────── */
      const opts = await page.locator("#ln-shelf option").evaluateAll((els) =>
        els.map((e) => e.getAttribute("value")),
      );
      say("他自己的货架接上去了", opts.includes("Cement 50kg"), JSON.stringify(opts));
      say(
        "🔴 卖完的排在后面",
        opts.indexOf("Cement 50kg") < opts.indexOf("River sand"),
        JSON.stringify(opts),
      );

      const units = await page.locator("#ln-units option").evaluateAll((els) =>
        els.map((e) => e.getAttribute("value")),
      );
      say("他打过的单位也接上去了", units.includes("bag"), JSON.stringify(units));

      /* ── 挑那个客人 → 「照上次那一张」出现 ───────────────────────── */
      await page.getByLabel(/customer|client|party/i).first().fill("Mr Tan").catch(() => {});
      await page.waitForTimeout(1400);
      const body1 = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say("挑了客人之后「照上次那一张」出现", /Same as last time/i.test(body1), body1.slice(0, 260));

      /* ── 按下去，那几行自己填好 ──────────────────────────────────── */
      await page.getByRole("button", { name: /Same as last time/i }).click();
      await page.waitForTimeout(600);
      const desc = await page.getByLabel("What it is").first().inputValue();
      const unit = await page.getByLabel("Unit").first().inputValue();
      const price = await page.getByLabel("Unit price").first().inputValue();

      /* 🔴 [重点 29] 的量法：他要打几个字 */
      const typed = `${desc}${unit}${price}`.length;
      say("按一下就把上次那一行填好", desc === "Cement 50kg" && unit === "bag", `${desc} · ${unit} · ${price}`);
      console.log(`         数出来：那一行 ${typed} 个字，他打了 0 个`);

      await page.screenshot({ path: `${OUT}/${tag}-filled.png`, fullPage: true });

      /* ── 打了字之后，那颗按钮要不见 ──────────────────────────────── */
      await page.getByLabel("What it is").first().fill("Strip out old kitchen");
      await page.waitForTimeout(500);
      const body2 = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say(
        "🔴 他打了字，那颗按钮就不见 —— 按下去会盖掉他打的",
        !/Same as last time/i.test(body2),
        body2.slice(0, 260),
      );

      /* ── 他自己打的一句话照样打得进去 ────────────────────────────── */
      const own = await page.getByLabel("What it is").first().inputValue();
      say("他自己打的一句话照样打得进去", own === "Strip out old kitchen", own);
    }

    await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    console.log(`拍到  ${tag} · h1「${h1}」`);
  }

  console.log(`\n判：${bad ? `🔴 ${bad} 项没过` : "全部过"}`);
  console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张`);
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

process.exit(bad ? 1 : 0);
