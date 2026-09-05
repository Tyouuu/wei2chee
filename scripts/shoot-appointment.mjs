#!/usr/bin/env node
/**
 * npm run shoot:appointment
 *
 * 一间沙龙的柜台：客人来了、没来、取消了。
 *
 * ── 这一支在量什么 ────────────────────────────────────────────────────────
 *
 * `appointments.status` 从 20260902030000 就在，清单上也印得出来，
 * 而 `set_appointment_status` **画面上一个入口都没有** ——
 * 一个印得出来而改不了的状态，是一个从第二天起就在说谎的字。
 *
 * ── 🔴 最要紧的一条：按了，资料库真的要变 ────────────────────────────────
 *
 * 这个仓库出过二十次「说了没做」，每一次都是同一个形状：
 * **画面讲它做了，而资料库里什么都没发生。**
 * 所以这一支每按一颗，就**用真的客户身分回去问那一行**。
 *
 * ── 🔴 第二条：那个时段空不空要跟着变 ────────────────────────────────────
 *
 * 20260902030000 那条不准撞的排他约束**认得 status**：
 * 取消掉的不再占时段，「没来」的**还占着**（那一个钟头是真的过去了）。
 * 这几颗按钮会改变那件事，所以这一支两边都试一次。
 *
 * ── ⚠️ 它一分钱都不碰 ────────────────────────────────────────────────────
 *
 * [任务 100]：客人没来要不要扣钱是他的决定。这一支顺手验一次
 * **按完钱那张表一行都没有多**。
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
const OUT = ".screenshots/appointment";
const EMAIL = `appt-${Date.now()}@formae.test`;
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

/** 那一行现在是什么状态 —— 用真的客户身分问，不是看画面 */
const statusOf = async (id) => {
  const { data } = await api.from("appointments").select("status").eq("id", id).maybeSingle();
  return data?.status ?? null;
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

  const { error: pageErr } = await api.rpc("add_project_page", {
    requested_key: "bookings",
    new_title: "Bookings",
  });
  if (pageErr) throw new Error(`bookings page: ${pageErr.message}`);

  /* 明天早上十点，一个钟头 */
  const day = new Date(Date.now() + 8 * 3600 * 1000 + 86400000).toISOString().slice(0, 10);
  /* ⚠️ 它回的是**一个 uuid**，不是一行 ——
     当成物件读 `.id` 会拿到 undefined，而接下来每一句
     都在对一个不存在的 id 讲话，报出来像产品坏了。 */
  const { data: apptId, error: aErr } = await api.rpc("add_appointment", {
    in_project_id: proj.id,
    in_module_key: "bookings",
    in_starts_at: `${day}T02:00:00Z` /* 马来西亚早上十点 */,
    in_ends_at: `${day}T03:00:00Z`,
    in_party: "Mrs Lee",
    in_service: "Colour and cut",
  });
  if (aErr) throw new Error(`appointment: ${aErr.message}`);

  say("刚开出来是「还没来」", (await statusOf(apptId)) === "booked", await statusOf(apptId));

  browser = await chromium.launch();
  for (const [w, h, tag] of [
    [1440, 1200, "1-wide"],
    [390, 900, "2-phone-390"],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/portal/, { timeout: 180000 });
    await page.goto(`${BASE}/en/portal/bookings/${apptId}`, {
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

    if (tag === "1-wide") {
      const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say("那四颗按钮在预约那一页上", /Did they turn up/i.test(body), body.slice(0, 220));

      /* 🔴 按之前要看得到这是哪一张 —— 页面标题写的是「Edit · Bookings」，
         十八页都一样，而客人的名字在表单卡里、要滑过四个格子。
         所以那个名字必须画在**这一段里面**，不是在页面上某个地方。 */
      const panel = (
        await page
          .locator("section")
          .filter({ hasText: /Did they turn up/i })
          .last()
          .innerText()
      ).replace(/\s+/g, " ");
      say(
        "🔴 那一段自己写着这是谁的预约",
        /Mrs Lee/.test(panel) && /Colour and cut/i.test(panel),
        panel.slice(0, 200),
      );
      say(
        "🔴 而它讲清楚不碰钱",
        /moves no money/i.test(body),
        body.slice(body.indexOf("Did they turn up"), body.indexOf("Did they turn up") + 260),
      );

      /* 🔴 按一颗，回去问资料库 —— 画面讲它做了不算数 */
      await page.getByRole("button", { name: /^Came$/ }).click();
      await page.waitForTimeout(2500);
      say("按「来了」资料库真的变了", (await statusOf(apptId)) === "done", await statusOf(apptId));

      await page.getByRole("button", { name: /^No show$/ }).click();
      await page.waitForTimeout(2500);
      say("按「没来」资料库真的变了", (await statusOf(apptId)) === "no_show", await statusOf(apptId));

      /* 🔴 「没来」那一个钟头还占着 —— 它真的过去了 */
      const clash = await api.rpc("add_appointment", {
        in_project_id: proj.id,
        in_module_key: "bookings",
        in_starts_at: `${day}T02:30:00Z`,
        in_ends_at: `${day}T03:30:00Z`,
        in_party: "Someone else",
      });
      say(
        "🔴 「没来」那个时段还占着 —— 那一个钟头真的过去了",
        !!clash.error,
        clash.error ? clash.error.message : "居然订得进去",
      );

      await page.getByRole("button", { name: /^Cancelled$/ }).click();
      await page.waitForTimeout(2500);
      say("按「取消了」资料库真的变了", (await statusOf(apptId)) === "cancelled", await statusOf(apptId));

      /* 取消掉的不再占时段 */
      const free = await api.rpc("add_appointment", {
        in_project_id: proj.id,
        in_module_key: "bookings",
        in_starts_at: `${day}T02:30:00Z`,
        in_ends_at: `${day}T03:30:00Z`,
        in_party: "Someone else",
      });
      say("取消掉之后那个时段空回来", !free.error, free.error ? free.error.message : "");

      /* ⚠️ 一分钱都不碰 */
      const { count } = await api
        .from("ledger_entries")
        .select("id", { count: "exact", head: true })
        .eq("project_id", proj.id);
      say("🔴 按完钱那张表一行都没有多", (count ?? 0) === 0, `${count} 行`);
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
