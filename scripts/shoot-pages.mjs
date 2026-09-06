/**
 * 十八页，一页一页拍清楚 —— 拍的是**他每天打开的那一边**，不是编辑器。
 *
 * ── 为什么这一支要存在（2026-09-05）──────────────────────────────────────
 *
 *   `你先给我看全部的画面 我都是要清晰的 这样我才懂我要做什么`
 *
 * ⚠️ **2026-09-07 之后这一段变了一半**：正门不再问「保存过没有」，
 * 一进来就是他的系统（front-door.ts）。下面第 ① 步那一次保存
 * 因此不再是必需的，留着只因为它同时在验「保存那一条路还通」。
 * 那一张上有我们的顶栏、
 * 那张黑色的引导卡、还有 Next 自己的红点，**三样都不是他的系统**。
 * 拿那种图去判设计，判到的是我们的工具。
 *
 * 所以这一支做三件 `audit` 不做的：
 *   ① **先按一次保存** → 从那一刻起每一页开的是「他的系统」（front-door）
 *   ② **把引导卡关掉、把 dev 红点藏掉** —— 那两样客户看不到，图上也不该有
 *   ③ 🔴 **视窗撑到跟内容一样高再拍** —— 编辑器的壳是 `h-screen`，
 *      `fullPage` 在那一边**拍不到折叠以下**（实测报表那一页底下被切一半，
 *      而图看起来完全正常）。系统那一边是 `min-h-screen`，量得到就撑得开。
 *
 * ⚠️ 台面（开十八页 · 种真资料）跟 `audit-demo.mjs` **共用同一份**
 * （lib/seed-demo.mjs）。这个仓库栽在「第二份手抄的清单」上至少八次。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { moduleLabels, openAllPages, seedEveryShape } from "./lib/seed-demo.mjs";

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
const OUT = ".screenshots/pages";
mkdirSync(OUT, { recursive: true });

const MARK = `ZZ${Date.now().toString().slice(-6)}`;
const EMAIL = `shots-${Date.now()}@formae.test`;
const PASSWORD = `Shots-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* 🔴 服务器没开就不要跑 —— 一份「十八页全坏」的报告，跟一份「服务器没开」
   的报告，在画面上长得一模一样，而这个仓库被这种尺子骗过至少四次。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let userId = null;
/* 🔴 被 Ctrl-C、被杀、或者输出接给 `head` 的时候，`finally` 不会跑 ——
   而那一次留下的是一个种了 25 张单的帐号，混在老板的「客户数」里。 */
dropThrowawayOnExit(admin, () => userId);
let browser;
const shot = [];

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const P = proj?.id;
  if (!P) throw new Error("注册没有开出一个 project");
  await api.rpc("set_project_style", { new_style: "ledger" });

  const labels = moduleLabels();
  const { opened } = await openAllPages(api, { quiet: true });
  /* 🔴 五行、真的生意名字 —— **一页一笔记录判不了设计**，而尺子那一边
     要的正好相反（一行带记号的就够，多了反而分不出哪一行是他的）。 */
  const seeded = await seedEveryShape(api, P, MARK, opened, { quiet: true, rows: 5, showroom: true });
  console.log(`开了 ${opened.length} 页 · 种了 ${seeded.size} 种零件的真资料\n`);

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  /* ── ① 按一次保存 ──────────────────────────────────────────────────────
     `frontDoor()`：**问的是整套，不是这一页**。保存最不起眼的那一页（排行），
     其余十七页照旧从产生器长出来，而正门从此是「他的系统」。

     ⚠️ **不要保存官网那一页** —— 保存会把它冻起来，而拍出来的就不再是
     产生器画的那一版。第一版保存的正是它，於是它拍出 41,000px 的空白，
     而我差点把那记成产品的毛病。**先换一页，再判。** */
  await page.goto(`${BASE}/en/portal/ranking?design=1`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(2500);
  /* ⚠️ 「保存设计」2026-09-05 从顶栏搬进了 `More ▾` 那个选单
     （editor-client.tsx 那段注解写着为什么）。先开选单，再按它。 */
  /* ⚠️ `More▾` 是一个 `<summary>`，不是 button —— 拿 role 找它找不到。 */
  await page.locator("summary", { hasText: /^More/ }).first().click({ timeout: 30000 });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /save design/i }).first().click({ timeout: 30000 });
  await page.waitForTimeout(3500);
  console.log("按过一次「Save design」——从这里起打开的是他的系统，不是编辑器\n");

  /* ── ② 引导卡关掉 · dev 红点藏掉 ─────────────────────────────────────── */
  await page.goto(`${BASE}/en/portal/quotations`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const gotIt = page.getByRole("button", { name: /got it, hide this/i }).first();
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(600);
  await page.addStyleTag({
    content: "nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }",
  });

  /* ── ③ 一页一页拍，视窗撑到跟内容一样高 ─────────────────────────────── */
  /* 只看某几页的时候：`ONLY=purchases,quotations npm run shoot:pages`。
     十八页拍一轮几分钟，而改一页的时候只有那一页要用眼睛看。
     ⚠️ **筛掉的照旧种进去** —— 一张少了别的模块的页面，
     侧栏跟数字都会跟真的那一版不一样。 */
  const only = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const shooting = only.length ? opened.filter((k) => only.includes(k)) : opened;
  if (only.length && shooting.length !== only.length) {
    console.log(`⚠️ 这几页这个帐号没有开：${only.filter((k) => !shooting.includes(k)).join(" · ")}`);
  }
  for (const key of shooting) {
    const url = `${BASE}/en/portal/${key}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(1100);
      await page.addStyleTag({
        content: "nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }",
      });
      /* 撑高，分两步 —— 🔴 **直接量是循环的**：那一页是 `min-h-screen`，
         所以「内容有多高」永远等於我设的视窗高，於是每一页都拍出同一个高度
         加一大片白。先把视窗压矮，量到的才是真的内容，再撑回去。
         （编辑器那一边是 `h-screen`，`fullPage` 根本拍不到折叠以下 ——
          实测报表那一页底下被切一半，而图看起来完全正常。） */
      await page.setViewportSize({ width: 1440, height: 520 });
      await page.waitForTimeout(500);
      const h = await page.evaluate(() =>
        Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      );
      /* 🔴 **官网那一页不可以撑视窗** —— 它的段是按视窗高算的（`100vh` 那一类），
         所以视窗越高它就越高：撑到 4600 拍出来是 **9 × 4600 ≈ 41,000px**，
         一条导航加四万像素的空白。**越量越高的回圈。**
         而我差点把那记成产品的毛病。高的那一种页用正常视窗 ＋ `fullPage` 就好。 */
      const growable = h < 2600;
      const tall = growable ? Math.min(Math.max(Math.ceil(h) + 32, 900), 2600) : 1200;
      await page.setViewportSize({ width: 1440, height: tall });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${key}.png`, fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1200 });
      const heading = await page
        .evaluate(() => document.querySelector("h1")?.textContent?.trim() ?? "")
        .catch(() => "");
      shot.push({ key, label: labels[key] ?? key, height: tall, heading });
      console.log(`  ${String(key).padEnd(16)} ${String(tall).padStart(5)}px  ${heading}`);
    } catch (e) {
      console.log(`  🔴 ${key} — ${String(e).slice(0, 90)}`);
      shot.push({ key, label: labels[key] ?? key, height: 0, heading: "" });
    }
  }
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
  console.log("\n临时帐号删掉了");
}

const bad = shot.filter((s) => !s.height);
console.log(`\n拍到 ${shot.length - bad.length} / ${shot.length} 页 → ${OUT}`);
process.exit(bad.length ? 1 : 0);
