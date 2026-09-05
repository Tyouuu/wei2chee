/**
 * 开着「减少动效」的人，打开每一页都要看得到东西。
 *
 * ── 为什么这一把尺存在（2026-09-05）────────────────────────────────────
 *
 * 🔴 实测四页 —— **谁欠我钱 · 今天要跟的 · 分店 · 询价 —— 四页全部是空白的。**
 * 页面标题在，底下整块停在 `opacity: 0`。
 *
 * 根因在 `(app)/section.tsx`：`useReducedMotion()` **第一次画回的是 `null`**
 * （伺服器那一边读不到那个设定），所以第一帧套上了 `hidden`；挂载之后它变
 * `true`，而当时的写法把 `variants` 换成 `undefined` ——
 * **再也没有任何东西认得 `show`**，那一块就停在 hidden 上。
 *
 * ⚠️ 而这件事**每一条既有的检查都会放它过**：
 * `check:reachable` 打靶打得到（`opacity: 0` 照样有面积）·
 * 单元测试渲染得出来 · Playwright 的 `click` 也认为它「看得见」——
 * **`opacity: 0` 在它眼里不是隐藏**。抓到它的是一张图。
 *
 * ⚠️ 而「减少动效」不是一个冷门设定：手机上很多人开着，
 * 而对晕动敏感的人那是必开的。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
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

/** 走整个壳里那几页。**每一页都用同一个 `PageBody`**，所以一页坏就是全部坏 ——
 *  而列几页而不是一页，是为了让那句判语讲得出规模。 */
const PAGES = ["", "owing", "today", "branches", "enquiries", "vehicles", "styles"];

let userId = null;
dropThrowawayOnExit(admin, () => userId);

const bad = [];
let checked = 0;
let browser;

try {
  const email = `motion-${Date.now()}@formae.test`;
  const password = `Motion-${Date.now()}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  await api.rpc("set_project_style", { new_style: "swiss" });

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    /* 这一把尺的全部意义就在这一行。 */
    reducedMotion: "reduce",
  });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  for (const key of PAGES) {
    const url = `${BASE}/en/portal${key ? `/${key}` : ""}`;
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    const code = res?.status() ?? 0;
    if (code >= 400) {
      console.log(`  ⚪ /${key || "(首页)"} — 回 ${code}，跳过`);
      continue;
    }
    /* 给动效走完的时间。**等太短会把一个正在淡入的画面判成坏的** ——
       而那种红比不查更糟：它会教下一个人去把这一条关掉。 */
    await page.waitForTimeout(2600);
    checked++;
    const faded = await page.evaluate(() =>
      [...document.querySelectorAll("div, section, main")]
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.opacity !== "0") return false;
          /* 一个本来就没有东西的元素不算 —— 我们量的是「有内容而看不到」。 */
          return (el.textContent ?? "").trim().length > 0;
        })
        .map((el) => (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 48)),
    );
    if (faded.length) {
      bad.push(`/${key || "(首页)"} — ${faded.length} 块看不到：${faded[0]}`);
      console.log(`  🔴 /${key || "(首页)"}   ${faded.length} 块内容停在 opacity 0`);
    } else {
      console.log(`  ✅ /${key || "(首页)"}`);
    }
  }
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

console.log(`\n判：走了 ${checked} 页 · ${bad.length} 页有看不到的内容`);
if (bad.length) {
  console.log(
    "🔴 一个开着「减少动效」的人打开这几页，看到的是一张空白页 ——\n" +
      "   而每一条既有的检查都会放它过，因为 `opacity: 0` 照样有面积。",
  );
  for (const b of bad) console.log("   " + b);
  process.exit(1);
}
