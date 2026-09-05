/**
 * 十八页，一页一页打开，看它到底是真的还是画的。
 *
 * ── 为什么这一支要存在（2026-09-05）──────────────────────────────────────
 *
 *   `你一定要弄明白全部的功能 因为这个system很重要 我会直接demo给客户看`
 *   `哪里断了哪里还没建好 什么功能有连接`
 *
 * 那三个问题今天**没有一个地方答得出来**。`shape-state.ts` 答得了
 * 「这个零件有没有表」，答不了「他打开那一页会看到什么」——
 * 而他要站在别人店里打开的正是后者。
 *
 * ── 它怎么判 ──────────────────────────────────────────────────────────────
 *
 * 开一个用完就删的帐号，把**每一种零件都种一笔带记号的真资料**，
 * 然后一页一页打开，问三句：
 *
 *   ① 打得开吗
 *   ② 🔴 **他自己的资料在上面吗**（记号 `ZZ<时间戳>`）
 *   ③ 🔴 **有没有示范资料混在里面**（`Alpha Sdn Bhd` 那一批）
 *
 * 第三句是这一支真正的价值。一桌示范会自己招认（名字一看就是范例），
 * 而**一个总数只是一个数字，看起来就是他的** —— 而他会站在客人面前
 * 指着那个数字讲话。
 *
 * ⚠️ 判「没有资料」跟判「坏了」是两件事：一页正确地空着（他还没开单）
 * 不算错，所以只有**种过资料的那几页**才要求看得到记号。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";
import { moduleKeys, moduleLabels, openAllPages, seedEveryShape } from "./lib/seed-demo.mjs";

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
const OUT = ".screenshots/audit";
mkdirSync(OUT, { recursive: true });

/* 目录里那十八个。**从产品自己的档案读出来**，不是手抄一份 ——
   这个仓库栽在「第二份手写清单」上至少五次。 */
/* 十八个 key 跟它们的英文名字，**从产品自己的目录读出来**。
   开页跟种资料那两段跟 `shoot-pages.mjs` 共用一份 —— 见 lib/seed-demo.mjs。 */
const KEYS = moduleKeys();
const LABELS = moduleLabels();

/* 示范资料里最认得出来的几句。它们出现在一页**有真资料**的画面上，
   就是他会指着讲错话的地方。 */
const SAMPLES = [
  "Alpha Sdn Bhd", "Beta Enterprise", "Delta Sdn Bhd",
  "Ampang bathroom retile", "Bukit Jalil kitchen", "Cheras shoplot fitout",
  "Customer A", "Customer B", "Customer C",
  "陈先生", "李太太", "王老板", "兴发",
];

/** 种进去的钱**全部加起来**。走单五笔 × RM 4,850 ＋ 记帐三笔 × RM 1,234。
 *  一页上出现比这个还大的金额，**那个数字不可能是他的**。 */
const CEILING = 5 * 4850 + 3 * 1234;

/** 自己有资料的那几页。总览 · 报表 · 排行不在里面 —— 它们一行都不存，
 *  画出来的是**月份**（`shape-state.ts` 把它们标成 `reads`）。 */
const HOLDS_ROWS = new Set([
  "quotations", "orders", "projects", "tasks", "purchases",
  "payments", "expenses", "commission",
  "customers", "suppliers", "staff",
  "inventory", "bookings", "reconciliation",
]);

const stamp = Date.now().toString().slice(-6);
const MARK = `ZZ${stamp}`;
const EMAIL = `audit-${Date.now()}@formae.test`;
const PASSWORD = `Audit-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
let browser;
const rows = [];

/* 🔴 **服务器没开，就不要跑。**
   第一次跑完报「打不开：18」，而真相是 `npm run dev` 死了 ——
   一份「十八页全坏」的报告，跟一份「服务器没开」的报告，
   在画面上长得一模一样，而这个仓库被这种尺子骗过至少四次。 */
try {
  const ping = await fetch(`${BASE}/en/login`).catch(() => null);
  if (!ping || ping.status >= 400) {
    console.error(`
🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
    process.exit(2);
  }
} catch {
  console.error(`
🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

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

  /* ── 每一页都开出来 · 每一种零件种一笔带记号的真资料 ─────────────── */
  const { opened } = await openAllPages(api);
  console.log(`开了 ${opened.length} / ${KEYS.length} 页
`);
  const seeded = await seedEveryShape(api, P, MARK, opened);
  console.log(`种了 ${seeded.size} 种零件的真资料，记号 ${MARK}
`);

  /* ── 一页一页打开 ──────────────────────────────────────────────────── */
  browser = await chromium.launch();
  /* 🔴 **两倍解析度、整页。** 缩图上看不到的东西，1:1 上一眼就看到 ——
     而他要拿这些图去判「我要做什么」，一张糊的图答不了那个问题。 */
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  for (const key of opened) {
    const url = `${BASE}/en/portal/${key}`;
    let text = "";
    let ok = false;
    try {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(900);
      text = await page.evaluate(() => document.body.innerText);
      ok = (res?.status() ?? 0) < 400 && !/Something broke|Page not found/i.test(text);
      await page.screenshot({ path: `${OUT}/${key}.png`, fullPage: true });
    } catch (e) {
      text = String(e).slice(0, 120);
    }
    const mine = text.includes(MARK);
    const leaks = SAMPLES.filter((s) => text.includes(s));

    /* 🔴 **比他全部家当还大的金额，不可能是他的。**
       名字那一份抓不到用数字捏出来的示范资料 —— 而对帐那一页正是那样：
       它印着 `RM 246,800 · 128 entries`、三行月结、还写着「这个月对得上」，
       而这个帐号一共只有一笔 RM 1,234。**他会站在客人面前指着那个数字。** */
    const tooBig = [...text.matchAll(/RM\s*([\d,]+)/g)]
      .map((m) => Number(m[1].replace(/,/g, "")))
      .filter((n) => Number.isFinite(n) && n > CEILING);

    /* 一页写着「N records」而看不到他的记号 —— 那 N 行是别人的。
       ⚠️ **只问「自己有资料」的那几页**。报表 · 排行 · 总览的行是**月份**，
       不是他的记录 —— 记号永远不会出现在那上面。
       第一版没有分，於是它对着一张完全正确的报表叫「有几行不是他的」，
       而那一页上写着 RM 1,234、一笔、九月 —— 全部是他的。
       **红的是尺，不是产品。** */
    const counted = Number((text.match(/(\d+)\s+records?\b/) ?? [])[1] ?? 0);
    const ghostRows = HOLDS_ROWS.has(key) && counted > 0 && !mine;

    rows.push({
      key, ok, seeded: seeded.has(key), mine, leaks,
      tooBig: [...new Set(tooBig)].slice(0, 4), ghostRows, chars: text.length,
    });
  }
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
  console.log("\n临时帐号删掉了");
}

/* ── 报告 ──────────────────────────────────────────────────────────────── */
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad("页", 16)}${pad("打得开", 8)}${pad("种过资料", 10)}${pad("看得到他的", 12)}示范资料混进来`);
console.log("-".repeat(78));
for (const r of rows) {
  console.log(
    pad(r.key, 16) +
      pad(r.ok ? "是" : "🔴 否", 8) +
      pad(r.seeded ? "是" : "—", 10) +
      pad(r.seeded ? (r.mine ? "是" : "🔴 否") : "—", 12) +
      (r.leaks.length || r.tooBig.length || r.ghostRows
        ? "🔴 " +
          [
            ...r.leaks,
            ...r.tooBig.map((n) => `RM ${n.toLocaleString("en-MY")}`),
            r.ghostRows ? "有几行不是他的" : "",
          ].filter(Boolean).join(" · ")
        : "—"),
  );
}

const broken = rows.filter((r) => !r.ok);
const missing = rows.filter((r) => r.seeded && !r.mine);
const leaking = rows.filter((r) => r.leaks.length || r.tooBig.length || r.ghostRows);
console.log("\n" + "=".repeat(78));
console.log(`打不开：${broken.length} · 种了资料却看不到：${missing.length} · 混着示范资料：${leaking.length}`);
writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 2));
console.log(`图在 ${OUT}`);
process.exit(broken.length + missing.length + leaking.length ? 1 : 0);
