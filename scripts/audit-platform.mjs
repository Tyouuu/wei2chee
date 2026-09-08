/**
 * 平台那一边的排查 —— **他一辈子走一次的那条路**。
 *
 * ── 为什么它跟 audit:product 是两把尺 ──────────────────────────────────
 *
 *   audit:product   他**一年三百天**打开的那三十九页
 *   🔴 这一支        他**一辈子走一次**的那几页：素材库 · 模板 · 版段 ·
 *                   风格 · 需求书 · 帐号 ＋ 编辑器 ＋ 我们自己那个官网
 *
 * 两边的判准不一样，所以不可以合成一把：
 * **产品那一边要「每天用不用得顺」，平台这一边要「这一条路走不走得完」。**
 * 一页在产品上「一屏只有三块」是毛病；在平台上一屏只有一件事，常常是对的。
 *
 * ⚠️ 它**不送出问卷** —— 送出去会呼叫模型（一次约 RM 0.285），而
 * 「要他打几个字」在送出去之前就量得到。**一把会花钱的尺没有人敢跑。**
 *
 * ⚠️ 它**不判好不好看**。数字只能否决（[重点 24]）；通过要看它拍下来那几张。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "node:fs";
import { AUDIT } from "./lib/ui-probe.mjs";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/platform";
mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* 🔴 服务器没开就不要跑 —— 一份「每一页全坏」的报告，跟一份「服务器没开」
   的报告，在画面上长得一模一样。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

/** 这一屏要他做几个决定 · 打几个字 · 侧栏上有几条路。 */
const SHAPE = () => {
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width >= 1 && r.height >= 1 && s.visibility !== "hidden" && s.display !== "none";
  };
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return seen(el) && r.top < innerHeight && r.bottom > 0;
  };
  const main = document.querySelector("main") || document.body;

  /* 第一屏上按得到的东西 —— 一条走一次的路，第一屏该只有一件事。 */
  const clickable = [...document.querySelectorAll("a[href],button,[role=button],select")].filter(onScreen);

  /* 要他打字的格子（搜寻不算）。 */
  const typing = [...document.querySelectorAll("input,textarea")].filter((el) => {
    if (!seen(el)) return false;
    const t = (el.type || "").toLowerCase();
    return !["hidden", "submit", "button", "checkbox", "radio", "search"].includes(t);
  }).length;

  /* 侧栏上有几条路 —— 他 2026-09-08 讲「太多东西了」，而那一条量得到。 */
  const rail = document.querySelector("aside nav") || document.querySelector("aside");
  const railLinks = rail ? [...rail.querySelectorAll("a[href]")].filter(seen).length : 0;

  return {
    height: Math.round(document.documentElement.scrollHeight),
    firstScreen: clickable.length,
    typing,
    railLinks,
    words: (main.innerText || "").trim().split(/\s+/).filter(Boolean).length,
    h1: [...document.querySelectorAll("h1")].filter(seen).map((h) => h.innerText.trim().slice(0, 44)),
  };
};

async function visit(page, name, url, width) {
  let res;
  try {
    res = await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 120000 });
  } catch {
    return { width, name, url, failed: "载不出来" };
  }
  if (!res || res.status() >= 400) return { width, name, url, failed: `回 ${res ? res.status() : "?"}` };
  await page.waitForTimeout(1400);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  /* 🔴 走到的是不是它自己 —— 一次重导，读到的每一个数字都是别一页的。 */
  const landed = page.url();
  if (!landed.includes(url.split("?")[0])) {
    return { width, name, url, failed: `被导去 ${landed.split("/").slice(3).join("/")}` };
  }
  const a = await page.evaluate(AUDIT);
  const s = await page.evaluate(SHAPE);
  if (width === 1400) {
    const slug = url.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
    await page.screenshot({ path: `${OUT}/${slug}.png` });
  }
  return { width, name, url, ...a, ...s };
}

let userId = null;
let browser;
dropThrowawayOnExit(admin, () => userId);
const rows = [];
const notes = [];

try {
  const EMAIL = `plat-${Date.now()}@formae.test`;
  const PASSWORD = `Plat-${Date.now()}-x!`;
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
  const { error: bnErr } = await admin
    .from("projects")
    .update({ business_name: "Hin Fatt Renovation", system_language: "en" })
    .eq("id", proj.id);
  if (bnErr) throw new Error(`business_name: ${bnErr.message}`);

  /* 🔴 故意**不**替它挑风格 —— 一个刚注册的老板本来就没挑过，而 2026-09-08
     拆掉那道门之后，这几页应该照样打得开。这一支顺手在验它。 */

  const OPEN = [
    { name: "我们自己的官网", url: "/en" },
    { name: "登入", url: "/en/login" },
  ];
  const IN = [
    { name: "portal 首页", url: "/en/portal" },
    { name: "风格库", url: "/en/portal/styles" },
    { name: "素材库", url: "/en/portal/library" },
    { name: "模板库", url: "/en/portal/templates" },
    { name: "版段库", url: "/en/portal/sections" },
    { name: "需求书", url: "/en/portal/spec" },
    { name: "帐号", url: "/en/portal/account" },
    { name: "编辑器", url: "/en/portal/dashboard?design=1" },
    { name: "官网编辑器", url: "/en/portal/website?design=1" },
  ];

  browser = await chromium.launch();
  for (const width of [1400, 390]) {
    /* ① 没登入那一段 —— 他第一次看到我们的样子。 */
    const out = await browser.newPage({ viewport: { width, height: 900 } });
    for (const { name, url } of OPEN) rows.push(await visit(out, name, url, width));

    /* 问卷 —— **只看，不送出**（送出去要花钱）。 */
    if (width === 1400) {
      await out.goto(`${BASE}/en`, { waitUntil: "networkidle", timeout: 180000 }).catch(() => {});
      const q = await out
        .evaluate(() => {
          const fields = [...document.querySelectorAll("input,textarea")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width >= 1 && !["hidden", "submit", "button"].includes((el.type || "").toLowerCase());
          });
          return {
            typing: fields.length,
            named: fields.filter((el) => el.labels?.length || el.getAttribute("aria-label")).length,
          };
        })
        .catch(() => null);
      if (q) notes.push(`落地页上要他打字的格子 ${q.typing} 个 · 其中 ${q.named} 个有名字`);
    }
    await out.close();

    /* ② 登入之后那一段。 */
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: width === 1400 ? 2 : 1,
    });
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/portal/, { timeout: 180000 });
    for (const { name, url } of IN) rows.push(await visit(page, name, url, width));
    await page.close();
  }
} finally {
  await browser?.close();
  if (userId) await dropThrowaway(admin, userId);
}

for (const width of [1400, 390]) {
  console.log(`\n== ${width}px ==`);
  console.log("  页                    高   一屏可按 打字 侧栏 字数 字<4.5 框<3 死链 中文 拇指");
  for (const r of rows.filter((x) => x.width === width)) {
    if (r.failed) {
      console.log(`  🔴 ${r.name.slice(0, 20).padEnd(21)}${r.failed}`);
      continue;
    }
    const c = (n) => (n ? String(n).padStart(5) : "    ·");
    console.log(
      `  ${r.name.slice(0, 20).padEnd(21)}${String(r.height).padStart(5)}` +
        `${String(r.firstScreen).padStart(9)}${c(r.typing)}${c(r.railLinks)}${String(r.words).padStart(5)}` +
        `${c(r.text.length)}${c(r.boxes.length)}${c(r.dead.length)}${c(r.cjk.length)}${c(r.taps.length)}`,
    );
  }
}
/* 🔴 逐项 —— 一个报得出数字、指不出是哪一条的读数，没有办法动手。
   2026-09-08 补：它印了「中文 3」而我要另外写一支探针才知道那三个字是什么。
   ⚠️ 每一种只印头几条 —— 版段库一页 450 个拇指目标，全印出来没有人读。 */
console.log("\n-- 逐项，只印有东西的 --");
for (const r of rows) {
  if (r.failed) continue;
  const bits = [
    ...(r.cjk ?? []).slice(0, 4).map((t) => `中文  「${String(t).slice(0, 40)}」`),
    ...(r.boxes ?? []).slice(0, 4).map((b) => `框 ${b.rt}:1（要 3）  「${b.label}」`),
    ...(r.text ?? []).slice(0, 4).map((t) => `字 ${t.rt}:1（要 ${t.need}）${t.px}px  「${t.t}」`),
    ...(r.dead ?? []).slice(0, 2).map((t) => `死链  「${String(t).slice(0, 40)}」`),
    ...(r.taps ?? []).slice(0, 6).map((t) => `拇指 ${t.w}x${t.h}（旁边 ${t.near}）「${t.t}」`),
    ...(r.leaked ?? []).slice(0, 3).map((l) => `🔴 代码印在画面上  「${l}」`),
  ];
  if (!bits.length) continue;
  console.log(`\n  ${r.name}  ${r.width}px  ${r.url}`);
  for (const b of bits) console.log(`    ${b}`);
}

for (const n of notes) console.log(`\n${n}`);
const failed = rows.filter((r) => r.failed).length;
console.log(`\n判：${rows.length - failed} 页量到 · ${failed} 页没量到`);
console.log(`图在 ${OUT}/ —— 数字只能否决，通过要用眼睛看那几张。`);
