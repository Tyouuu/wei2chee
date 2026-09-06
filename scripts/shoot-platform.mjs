/**
 * 平台那一边长什么样 —— 先拍，再动手。
 *
 * ── 为什么先拍（2026-09-06）─────────────────────────────────────────────
 *
 * 老板排的第二步：**「我们自己的平台的UI也是要调好」**。
 * 而[重点 3](../docs/founder-points.md) 的规矩是**先截图、先看，再说话** ——
 * 凭印象列一张清单，会漏掉真正难看的那几页。
 *
 * ⚠️ 这一支**只拍不判**（除了几件量得出来的：横不横滚 · 页面开不开得了 ·
 * 一屏有几个按得到的东西）。**「好不好看」只有眼睛判得了**，
 * 而一把替眼睛打分的尺，是在量写它的人。
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
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
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
dropThrowawayOnExit(admin, () => userId);

const rows = [];
let browser;
try {
  const stamp = Date.now();
  const email = `plat-${stamp}@formae.test`;
  const password = `Plat-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  await api.rpc("set_project_style", { new_style: "swiss" });
  for (const k of ["customers", "quotations", "payments"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    reducedMotion: "reduce",
  });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  /* 平台那一边 —— 他建东西的地方，不是他跑生意的地方。 */
  const PAGES = [
    ["", "home"],
    ["library", "library"],
    ["sections", "sections"],
    ["templates", "templates"],
    ["styles", "styles"],
    ["spec", "spec"],
    ["enquiries", "enquiries"],
    ["account", "account"],
  ];

  let n = 0;
  for (const [path, name] of PAGES) {
    n += 1;
    /* 🔴 冷的那一次再走一遍。
       开发服务器第一次编译一条路由要二十秒以上，而在那之前它回的是
       **一模一样的 404** —— 跟一页真的坏掉长得没有分别。
       实测：需求书那一页连三次回 404，暖起来之后 200，一个字都没改。
       ⚠️ 只重试一次，而且**第二次照样不是 200 就照实报** ——
       一把永远重试到绿为止的尺，量的是耐心不是产品。 */
    let res = await page.goto(`${BASE}/en/portal/${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await page.waitForTimeout(2600);
    if ((res?.status() ?? 0) !== 200) {
      res = await page.goto(`${BASE}/en/portal/${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 180000,
      });
      await page.waitForTimeout(2600);
    }
    const m = await page.evaluate(() => {
      const seen = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const s = getComputedStyle(el);
        return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.01;
      };
      const controls = [...document.querySelectorAll("a[href],button,input,select,textarea")].filter(
        seen,
      );
      /* 「这一屏他看得到几个可以按的」—— 只数第一屏，
         因为一页有一百个而第一屏只有十个，那是两件事。 */
      const first = controls.filter((el) => el.getBoundingClientRect().top < window.innerHeight);
      const h1 = [...document.querySelectorAll("h1")].filter(seen).map((el) => el.textContent?.trim());
      return {
        height: document.documentElement.scrollHeight,
        wide: document.documentElement.scrollWidth > window.innerWidth + 2,
        controls: controls.length,
        firstScreen: first.length,
        h1,
        words: (document.body.innerText.match(/\S+/g) ?? []).length,
      };
    });
    /* 🔴 走到哪一页也要记 —— 一个被送去别处的页面，
       跟一个坏掉的页面在读数上长得一模一样。 */
    const landed = page.url().replace(BASE, "");
    rows.push({ name, status: res?.status() ?? 0, landed, ...m });
    if (!landed.endsWith(`/portal/${path}`)) console.log(`  ⚠️ ${name} → ${landed}`);
    await page.screenshot({ path: `${OUT}/${n}-${name}.png`, fullPage: true });
  }

  /* 手机上那一遍 —— 判这几页的是他，而他一半时间在手机上。 */
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', email);
  await phone.fill('input[type="password"]', password);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  for (const [path, name] of PAGES) {
    await phone.goto(`${BASE}/en/portal/${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await phone.waitForTimeout(2200);
    const wide = await phone.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    const r = rows.find((x) => x.name === name);
    if (r) r.wide390 = wide;
    await phone.screenshot({ path: `${OUT}/390-${name}.png`, fullPage: true });
  }

  console.log("");
  console.log("  页              回码   高    第一屏几个可按  一共  字数   横滚  横滚390  h1");
  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(14)} ${String(r.status).padEnd(5)} ${String(r.height).padEnd(6)}` +
        ` ${String(r.firstScreen).padEnd(15)} ${String(r.controls).padEnd(5)}` +
        ` ${String(r.words).padEnd(6)} ${r.wide ? "🔴" : "· "}    ${r.wide390 ? "🔴" : "· "}` +
        `      ${r.landed}   ${(r.h1 ?? []).join(" / ") || "—"}`,
    );
  }
  console.log(`\n→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图 —— 这一支只量得出上面那几栏`);
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}
