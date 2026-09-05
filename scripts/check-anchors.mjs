/**
 * 客户的公开官网上，每一条页内连结都要真的按得动。
 *
 * ── 为什么这一支要开浏览器（2026-09-05）──────────────────────────────────
 *
 * 那一天量到：客户唯一那个上线的官网上**四条连结全部按不动**，
 * 其中一条是右上角那颗 **「Ask price」—— 整页唯一的转换按钮**。
 *
 * 🔴 而修到一半的时候撞到这一整件事真正的形状：
 * **资料里有 id，跟画面上有 id，是两件事。**
 *
 *   · `anchor-prune.ts` 那几条单元测试问的是**版面资料**里有没有那个 id ——
 *     全绿
 *   · 而画面上 `document.getElementById('website-form')` 是 **null**：
 *     那几个区段从来没有把 id 画到 DOM 上，
 *     而询价那一块画的是**写死的 `id="ask"`**，跟它在资料里的名字对不上
 *
 * **一把只问资料的尺，会把「四条全部按不动」判成全绿。**
 * 所以这一支开真的浏览器，问的是那个陌生人真的按下去会发生什么。
 *
 * ⚠️ 它答不了「按下去滚到对的地方」（那要量位置），只答
 * **「有没有落点」**。那正是这一天坏掉的那一件。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

/* 🔴 服务器没开就不要跑 —— 一份「每一条都按不动」的报告，跟一份
   「服务器没开」的报告，在画面上长得一模一样。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

/* 上线的每一个客户官网。**不写死网址** —— 写死的那一个哪天被换掉，
   这把尺会对着一个 404 回报「零条按不动」。 */
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: sites, error } = await db
  .from("projects")
  .select("site_slug, site_published")
  .not("site_slug", "is", null);
if (error) {
  console.error(`🔴 读不到有哪些官网：${error.message}`);
  process.exit(2);
}
const live = (sites ?? []).filter((s) => s.site_slug);
if (!live.length) {
  console.log("⚪ 今天没有一个客户开了官网 —— 这一支没有东西可以量。");
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let dead = 0;
let checked = 0;

for (const s of live) {
  const url = `${BASE}/s/${s.site_slug}`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 180000 });
  const code = res?.status() ?? 0;
  if (code >= 400) {
    console.log(`\n⚪ /s/${s.site_slug} — 回 ${code}（还没上线），跳过`);
    continue;
  }
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"], button[data-href^="#"]')].map((a) => {
      const href = a.getAttribute("href") ?? a.getAttribute("data-href") ?? "";
      const id = href.slice(1);
      return {
        text: (a.textContent || "").trim().slice(0, 30),
        href,
        /* 光秃秃的 `#` 永远算按不动 —— 它是一颗按了什么都不会发生的按钮。 */
        ok: id !== "" && !!document.getElementById(id),
      };
    }),
  );
  checked += links.length;
  const bad = links.filter((l) => !l.ok);
  dead += bad.length;
  console.log(`\n== /s/${s.site_slug}   ${links.length} 条页内连结`);
  for (const l of links) {
    console.log(`  ${l.ok ? "✅" : "🔴"}  ${l.text.padEnd(26)} ${l.href}`);
  }
}

await browser.close();

console.log(`\n判：${checked} 条页内连结 · ${dead} 条按不动`);
if (dead) {
  console.log(
    "🔴 一条按不动的连结不会报错，也不会有任何样式变化 —— 他会按，然后什么都不会发生。",
  );
}
process.exit(dead ? 1 : 0);
