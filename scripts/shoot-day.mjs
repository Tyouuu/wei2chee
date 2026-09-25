/**
 * 一间沙龙打开预约那一页，看到的是什么。
 *
 * ── 为什么要这一支 ────────────────────────────────────────────────────────
 *
 * 老板 2026-09-09：`我要看到saloon跟medi spa的頁面都是好看的 且 user friendly的`。
 *
 * 而这一页是那一行**一天开一百次**的那一页 —— 客人打电话来问
 * 「明天下午有没有位」，她开的就是它。
 *
 * `DayColumns`（[任务 305](../docs/founder-tasks.md) · 307）画得出
 * 「一天摊开、一个人一栏、块坐在它自己那个钟点上」，
 * 而 **`db push` 成功证明不了任何事，一支画得出来的组件也一样** ——
 * 这一支开一个真的沙龙帐号、排一天真的预约、打开那一页看。
 *
 * ── 它判什么 ──────────────────────────────────────────────────────────────
 *
 * 只判量得出来、而且坏了会让她读错的那几件：
 *   · 三个发型师真的分成三栏（不是退回一条清单）
 *   · 时刻那一栏画得出来
 *   · **一块的高度跟着它做多久走** —— 一个 90 分钟的护理不可以跟
 *     一个 30 分钟的剪发一样高，那正是「几点还排得下」这一句的答案
 *   · 还没派人的那一笔**不会不见**（她今天要处理的正是它）
 *   · 390 上不横滚
 *
 * ⚠️ 「好不好看」判不了，只有眼睛判得了（[重点 3](../docs/founder-points.md)）——
 * 所以它两个宽度各拍一张，而那两张是拿给他看的东西。
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { dropThrowawayOnExit, dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || "http://localhost:3000";
if (!URL_ || !ANON || !SERVICE) {
  console.error("缺 .env.local 里的三把钥匙");
  process.exit(2);
}
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const OUT = ".screenshots/day";
mkdirSync(OUT, { recursive: true });

let pass = 0;
const bad = [];
const judge = (what, ok, saw) => {
  if (ok) { pass++; console.log(`  PASS  ${what}`); }
  else { bad.push(what); console.log(`  FAIL  ${what}${saw === undefined ? "" : ` — ${saw}`}`); }
};

/* 今天的某一个钟点，本地时间 —— 不是 UTC。
   照 UTC 算，马来西亚早上八点之前跑，整天的预约会掉到昨天
   （[任务 168](../docs/founder-tasks.md) 付过这一次学费）。 */
const at = (h, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const stamp = Date.now();
let ownerId = null;
let browser = null;
dropThrowawayOnExit(admin, () => ownerId);

try {
  /* ── 台面：一间三个发型师的沙龙 ─────────────────────────────────────── */
  const { data: ind } = await admin
    .from("industries").select("id").eq("slug", "beauty").single();
  const { data: lead } = await admin
    .from("leads").insert({ industry_id: ind.id, language: "en", answers: {} })
    .select("id").single();

  const email = `dayshot-${stamp}@formae.test`;
  const password = `Ds-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { lead_id: lead.id },
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  ownerId = made.user.id;

  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", ownerId).single();
  const P = proj.id;
  await admin.from("projects").update({ business_name: "Saloon Vivienne" }).eq("id", P);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });

  const say = async (fn, args) => {
    const { data, error } = await c.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };
  const idOf = (x) => x?.id ?? x;

  const stylists = {};
  for (const name of ["Amy", "Jasmine", "Kelly"]) {
    stylists[name] = idOf(await say("add_directory_entry", {
      in_project_id: P, in_module_key: "staff", in_name: name,
    }));
  }
  const clients = {};
  for (const name of ["Ms Lim", "Mrs Tan", "Ms Wong", "Puan Aisyah", "Ms Chong"]) {
    clients[name] = idOf(await say("add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: name,
    }));
  }

  /* 一天真的排法：长的短的都有、有一个空档、有一笔还没派人。
     ⚠️ 长短一定要混 —— 一天全部排 60 分钟，「块的高度跟着做多久走」
     那一条量出来会是绿的，而它什么都没有证明。 */
  const day = [
    ["Amy", "Ms Lim", "Colour and cut", 10, 0, 12, 0],
    ["Amy", "Mrs Tan", "Wash and blow", 13, 30, 14, 15],
    ["Jasmine", "Ms Wong", "Perm", 10, 30, 13, 0],
    ["Jasmine", "Puan Aisyah", "Trim", 15, 0, 15, 30],
    ["Kelly", "Ms Chong", "Hair treatment", 11, 0, 12, 30],
  ];
  for (const [who, party, service, h1, m1, h2, m2] of day) {
    await say("add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: at(h1, m1), in_ends_at: at(h2, m2),
      in_party_id: clients[party], in_staff_id: stylists[who], in_service: service,
    });
  }
  /* 🔴 还没派人的那一笔 —— 她今天要处理的正是它。 */
  await say("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(16, 0), in_ends_at: at(17, 0),
    in_party: "Walk-in", in_service: "Cut",
  });

  /* ── 打开那一页 ─────────────────────────────────────────────────────── */
  browser = await chromium.launch();

  const shoot = async (w, h, tag) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(portal|salon-preview)/, { timeout: 120000 });

    await page.goto(`${BASE}/en/portal/bookings`, { waitUntil: "domcontentloaded" });
    /* 🔴 等那几个人的名字画出来，不是数秒。
       一把在数秒的尺，机器忙的时候会对着一张还没画完的页面报红
       （[任务 203](../docs/founder-tasks.md) 付过这一次学费）。 */
    await page.waitForFunction(
      () => document.body.innerText.includes("Jasmine"),
      undefined,
      { timeout: 60000 },
    ).catch(() => {});
    await page.waitForTimeout(600);

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`    ${w} 整页高：${height}px`);

    await page.screenshot({ path: `${OUT}/${tag}.jpg`, quality: 82, type: "jpeg", fullPage: true });

    const seen = await page.evaluate(() => {
      const body = document.body.innerText;
      /* 一块 = 一个绝对定位、而且真的有高度的东西，装着那个客人的名字。 */
      const blocks = [...document.querySelectorAll("a,span,div")]
        .filter((el) => {
          const s = getComputedStyle(el);
          if (s.position !== "absolute") return false;
          const r = el.getBoundingClientRect();
          /* ⚠️ 一块上印的是**服务**，不是客人的名字 —— 第一版拿名字去配，
             於是六块只认得出一块，而那条红看起来完全像产品坏了。 */
          return (
            r.height > 18 &&
            r.width > 40 &&
            /Colour|Wash|Perm|Trim|treatment|Cut/.test(el.innerText || "")
          );
        })
        .map((el) => ({
          text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
          h: Math.round(el.getBoundingClientRect().height),
        }));
      return {
        body,
        blocks,
        hours: (body.match(/\b\d{2}:00\b/g) || []).length,
        links: [...document.querySelectorAll("a")].filter(
          (a) => getComputedStyle(a).position === "absolute",
        ).length,
        wide: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });

    return { page, ...seen };
  };

  console.log("① 电脑");
  const d = await shoot(1400, 1000, "bookings-1400");
  judge("三个发型师各自一栏", ["Amy", "Jasmine", "Kelly"].every((n) => d.body.includes(n)),
    d.body.slice(0, 80));
  judge("时刻那一栏画得出来", d.hours >= 4, `${d.hours} 个整点`);
  judge("还没派人的那一笔没有不见", d.body.includes("Walk-in"));
  /* 🔴 同一批预约不可以在同一页上画两次（[任务 17] · [152] 判过两次）。 */
  judge(
    "底下没有一张一模一样的表",
    (d.body.match(/Colour and cut/g) || []).length === 1,
    `「Colour and cut」印了 ${(d.body.match(/Colour and cut/g) || []).length} 次`,
  );
  judge("那一块点得进那一笔", d.links >= 5, `${d.links} 块点得动`);
  /* 🔴 从名册挑一个客人排的预约，块上要看得到**她的名字**。
     2026-09-09 之前那一栏读的是他手打的那一串字，而从名册挑的那一笔
     它是空的 —— 於是一间沙龙最常做的那种预约，日程上没有名字。 */
  judge("块上看得到是给谁的", d.body.includes("Ms Lim"),
    d.blocks.map((b) => b.text).join(" | ").slice(0, 120));
  judge("每一块都真的画出来了", d.blocks.length >= 5, `${d.blocks.length} 块`);

  /* 🔴 这一条才是这一页的用处：一个两个钟头的护理，一定比一个
     45 分钟的洗吹高。一样高的话，「几点还排得下」这一句就答不了。 */
  const tall = d.blocks.find((b) => /Colour/.test(b.text));   // 10:00-12:00
  const short = d.blocks.find((b) => /Wash/.test(b.text));    // 13:30-14:15
  judge("一块的高度跟着它做多久走",
    !!tall && !!short && tall.h > short.h * 1.8,
    tall && short ? `两个钟头 ${tall.h}px · 45 分钟 ${short.h}px` : "找不到那两块");

  await d.page.close();

  console.log("② 手机");
  const m = await shoot(390, 844, "bookings-390");
  judge("手机上不横滚", !m.wide);
  /* 🔴 手机上四个人要横着滑，而滑过去之后时刻那一栏一定要还在。
     一张没有时间轴的日程，读起来是一堆浮在空白上的块。 */
  const stuck = await m.page.evaluate(() => {
    const box = [...document.querySelectorAll("div")].find(
      (d) => getComputedStyle(d).overflowX === "auto" && d.scrollWidth > d.clientWidth + 20,
    );
    if (!box) return null;
    box.scrollLeft = box.scrollWidth;
    const left = box.getBoundingClientRect().left;
    return [...document.querySelectorAll("span")]
      .filter((el) => /^\d{2}:00$/.test((el.textContent || "").trim()))
      .some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.left >= left - 2 && r.left < left + 90;
      });
  });
  judge("滑到最右边，时刻那一栏还在", stuck === true, stuck === null ? "找不到那个横滑的框" : String(stuck));
  judge("手机上三个发型师都在", ["Amy", "Jasmine", "Kelly"].every((n) => m.body.includes(n)));
  await m.page.close();

  console.log(`\n判：${pass} 过 · ${bad.length} 没过`);
  console.log(`图：${OUT}/bookings-1400.jpg · bookings-390.jpg`);
  if (bad.length) process.exitCode = 1;
} catch (e) {
  console.error("炸了：", e.message);
  process.exitCode = 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (ownerId) await dropThrowaway(admin, ownerId);
}
