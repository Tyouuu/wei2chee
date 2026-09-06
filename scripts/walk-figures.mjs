#!/usr/bin/env node
/**
 * npm run walk:figures
 *
 * 画面上印出来的每一个金额，资料库答不答得出来。
 *
 * ── 为什么这一支要存在（2026-09-07）──────────────────────────────────────
 *
 * 他问：`重点应该是客户看到吗`。对 —— 而今天**没有任何一把尺在量那件事**：
 *
 *   · 十三条链的走法（`walk:reno` 那几支）**只走资料库，一次浏览器都没开**
 *   · `check:reachable` 走的是一份**写死的页面清单**，新做的那几页一页都不在
 *   · `audit:demo` 会开浏览器，而它问的是「他自己的资料在不在上面」——
 *     **不是「印出来那个数字对不对」**
 *
 * 而这个仓库真正在犯的错，几乎全部落在最后那一句上：
 *
 *   「本月已确认工程额 RM 71,300」—— 每一家公司都一样（任务 111）
 *   「Customer 13」—— 那一格数的是客户＋供应商＋师傅三种人（任务 191）
 *   「还欠 RM 24,500」—— 同一笔钱扣了两次（任务 118）
 *   「+800% vs last month」—— 凭空（任务 105b）
 *
 * 🔴 **四件读数全绿，四件都是打开画面才看到的。**
 *
 * ── 它怎么判 ──────────────────────────────────────────────────────────────
 *
 * 开一个用完就删的帐号 → 种一笔真资料 → 一页一页打开 →
 * 把画面上每一个 `RM …` 刮下来 → 跟**资料库答得出来的那一组数字**比。
 *
 *   🔴 **一个画面上的金额，资料库答不出来，它就是凭空的。**
 *
 * 而「资料库答得出来」不是我背下来的一张表，是**问出来的**：
 *   · 每一张有金额那一栏的表，用他自己的登入身分读一次
 *   · 那几张表**自己那几种分法**加起来的总数（哪一页 · 进来还是出去）
 *   · 加上几支**会算**的读取函式（他欠我 · 我欠他 · 抽成 · 讯号）
 *
 * ⚠️ 它红的时候有两种可能，而两种都有用：
 *   ① 真的凭空 —— 那是一个客户会指着问的数字
 *   ② 真的算出来的，而它的来源还没进这一支的答案里
 *      → **把那个来源加进来**，这把尺就更准一分（不是把门槛放宽）
 *
 * ── ⚠️ 四个已经踩过的坑，写在这里免得再踩 ────────────────────────────────
 *   · **服务器没开就拒绝跑** —— 一份「每一页都坏」的报告，跟一份
 *     「服务器没开」的报告，在画面上长得一模一样（任务 145）
 *   · **载到登入页／错误页就是失败**，不要对着它印读数
 *   · **用完就删，含被 head/tail 掐断的时候**（任务 196）；
 *     🔴 绝对不照名字扫全库删（任务 129 那把枪炸掉过示范帐号）
 *   · 🔴 **印出它读到的是哪一页**。他的第一扇门是**编辑器**（任务 162：
 *     还没保存过 → 编辑器），而那一边画的是产生出来的草稿。
 *     一份只印判决的尺，答不了「它是不是在读另一个画面」
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages, seedEveryShape } from "./lib/seed-demo.mjs";

const BASELINE = JSON.parse(
  readFileSync(new URL("./figures-baseline.json", import.meta.url), "utf8"),
);

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

const BASE = "http://localhost:3000";
const STAMP = Date.now();
const EMAIL = `fig-${STAMP}@formae.test`;
const PASSWORD = `Fig-${STAMP}-x!`;
const MARK = `ZZ${STAMP}`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
let crewId = null; /* 第 ④ 段那个师傅 —— 两个都要删掉 */
dropThrowawayOnExit(admin, () => [userId, crewId]);

let browser;
const bad = [];
const say = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};
const rm = (cents) =>
  `RM ${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/* 🔴 服务器没开就拒绝跑。 */
try {
  const r = await fetch(`${BASE}/en/login`, { redirect: "manual" });
  if (r.status >= 500) throw new Error(`回 ${r.status}`);
} catch (e) {
  console.error(`\n🔴 ${BASE} 打不开（${e.message}）—— 先 npm run dev。`);
  console.error(
    "   拒绝跑：一份「每一页都坏」的报告，跟一份「服务器没开」的报告，长得一模一样。\n",
  );
  process.exit(2);
}

try {
  /* ── 一个用完就删的帐号 ──────────────────────────────────────────── */
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const P = proj.id;
  await api.rpc("set_project_style", { new_style: "ledger" });

  console.log("\n① 开页面 · 种一笔真资料");
  const { opened } = await openAllPages(api, { quiet: true });
  await seedEveryShape(api, P, MARK, opened, { quiet: true, rows: 1 });
  say("道具：页面开得出来", opened.length >= 12, `${opened.length} 页`);

  /* ── ② 资料库答得出来的那一组数字 ───────────────────────────────────
     🔴 **问出来的，不是我背下来的。** */
  console.log("\n② 资料库答得出哪几个数字");
  /* 分 -> **它从哪几个地方来**（不是第一个）。
     🔴 要一整组，是因为第 ④ 段要问「这个数字是不是只有老板看得到」——
     而一个同时来自单据（师傅看得到）跟帐本（只有老板）的金额，
     **不是**只有老板看得到的。只记第一个来源，那一段会开始冤枉人。 */
  const answers = new Map();
  const add = (cents, from) => {
    const n = Number(cents);
    if (!Number.isFinite(n)) return;
    if (!answers.has(n)) answers.set(n, new Set());
    answers.get(n).add(from);
  };
  /* 零永远算数：一页正确地空着就印 RM 0.00。 */
  add(0, "空的");

  const TABLES = [
    ["pipeline_records", "amount_cents"],
    ["ledger_entries", "amount_cents"],
    ["record_lines", "amount_cents"],
    ["record_terms", "amount_cents"],
    ["catalog_items", "price_cents"],
    ["catalog_items", "cost_cents"],
    ["returns", "credit_cents"],
    ["ledger_allocations", "amount_cents"],
  ];
  for (const [tbl, col] of TABLES) {
    /* 有哪几栏是那张表自己的事 —— 由宽到窄试，不猜。 */
    let rows = [];
    for (const sel of [
      `${col}, module_key, direction, party`,
      `${col}, module_key, direction`,
      `${col}, module_key, party`,
      `${col}, module_key`,
      col,
    ]) {
      const { data, error } = await api.from(tbl).select(sel).eq("project_id", P);
      if (!error) {
        rows = data ?? [];
        break;
      }
    }
    for (const row of rows) add(row[col], `${tbl}.${col}`);

    /* 🔴 **加起来的那几个也要算答得出来。**
       第一次跑就撞到：`reports` 印 RM 2,468，而库里两笔各 RM 1,234 ——
       那是**真的加出来的**，不是凭空。
       ⚠️ 而修法是**照那张表自己的栏位分组加一次**，
       不是在这里把产品的算术再写一次（同一个问题两份实作，
       这个仓库栽过至少八次），也不是把门槛放宽。
       ⚠️ 代价写出来：这一步让答案变宽。换到的是不再对着一个真的总额叫红 ——
       而一把常常冤枉人的尺没有人看。 */
    const nums = rows.map((r) => Number(r[col])).filter(Number.isFinite);
    if (nums.length > 1) {
      add(
        nums.reduce((x, y) => x + y, 0),
        `${tbl}.${col} 全部加起来`,
      );
    }
    /* 🔴 **按人加起来的那几个也要算答得出来** —— 2026-09-07 第 ④ 段
       第一次跑就撞到：师傅在排行那一页看到 RM 19,400，而这把尺报
       「只有老板看得到（来自 party_debts.owed_cents）」。

       去查才知道**红的是尺不是产品**：排行那一页读不到帐本的时候
       会退回单据（`live-months.ts` 写着为什么），然后**按人加起来** ——
       而这里当时只按模块跟方向加，没有按人加。那个数字刚好等於
       `party_debts.owed_cents`，因为那几张单一分钱都还没分摊，
       「他还欠」就等於「他一共报了」。

       ⚠️ 修法是**把那个来源加进来**（这把尺自己档头写的第 ② 种），
       不是把门槛放宽，也不是在这里把排行那一页的算术再写一次。 */
    for (const how of ["module_key", "direction", "party", "both", "party/direction"]) {
      const by = new Map();
      for (const r of rows) {
        const k =
          how === "both"
            ? `${r.module_key}/${r.direction}`
            : how === "party/direction"
              ? `${r.party}/${r.direction}`
              : r[how];
        if (k === undefined || String(k).includes("undefined")) continue;
        by.set(k, (by.get(k) ?? 0) + Number(r[col] ?? 0));
      }
      for (const [k, v] of by) add(v, `${tbl}.${col} 的 ${k} 加起来`);
    }
  }

  /* 会算的那几支 —— 画面上「还欠」「我欠谁」「这个月抽多少」就是它们。 */
  const CALLS = [
    ["party_debts", { in_project_id: P }],
    ["party_payables", { in_project_id: P }],
    ["nudges_due", { in_project_id: P }],
    ["purchase_mismatches", { in_project_id: P }],
    ["referrals_owing", { in_project_id: P }],
  ];
  for (const [name, args] of CALLS) {
    const { data, error } = await api.rpc(name, args);
    if (error) continue;
    for (const row of Array.isArray(data) ? data : [data]) {
      if (!row || typeof row !== "object") continue;
      for (const [k, v] of Object.entries(row)) {
        if (/_cents$/.test(k)) add(v, `${name}.${k}`);
      }
    }
  }
  say(
    "控制组：真的问到数字了（不是空的）",
    answers.size >= 4,
    `只有 ${answers.size} 个 —— 下面那一整段会变成量空气`,
  );
  console.log(
    `     ${[...answers.keys()]
      .sort((a, b) => a - b)
      .map((c) => rm(c))
      .join(" · ")}`,
  );

  /* ── ③ 一页一页打开，把画面上的金额刮下来 ───────────────────────── */
  console.log("\n③ 画面上印出来的金额");
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  let seen = 0;
  const ownerSeen = new Set(); /* 第 ④ 段的控制组要用 */
  const invented = [];
  /* 对不上的那一页，把它**整页**的金额留下来 —— 一个孤立的数字判不了
     它是凭空的还是算出来的，要看它旁边那几个。 */
  const pageFigures = new Map();

  for (const key of opened) {
    const url = key === "dashboard" ? `${BASE}/en/portal` : `${BASE}/en/portal/${key}`;
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(2600);
    if ((res?.status() ?? 0) >= 400) {
      say(`${key} 打得开`, false, `回 ${res?.status()}`);
      continue;
    }
    const text = await page.evaluate(() => document.body.innerText);
    if (/log in|sign in/i.test(text.slice(0, 400)) || /something broke/i.test(text)) {
      say(`${key} 打得开`, false, "落在登入页或错误页");
      continue;
    }
    const found = [...text.matchAll(/RM\s*(-?[\d,]+(?:\.\d{1,2})?)/g)].map((m) =>
      Math.round(parseFloat(m[1].replace(/,/g, "")) * 100),
    );
    seen += found.length;
    for (const c of found) ownerSeen.add(c);
    console.log(
      `     ${key.padEnd(16)}${String(found.length).padStart(3)} 个金额  ` +
        `${page.url().replace(BASE, "")}  ${text.replace(/\s+/g, " ").slice(0, 46)}`,
    );
    const off = [...new Set(found)].filter((c) => !answers.has(c));
    if (off.length) pageFigures.set(key, [...new Set(found)]);
    for (const cents of off) invented.push([key, cents]);
  }

  say("控制组：画面上真的印了金额（不是一页都没有）", seen > 0, `${seen} 个`);

  /* 🔴 已经登记在案的那几页 —— 连理由一起写在 figures-baseline.json。
     一把从第一天就红的尺没有人看；而**一页新的红了就是没过**。 */
  const offPages = [...new Set(invented.map(([k]) => k))];
  const fresh = offPages.filter((k) => !BASELINE[k]);
  const healed = Object.keys(BASELINE).filter(
    (k) => !k.startsWith("_") && !offPages.includes(k),
  );

  say(
    "🔴 每一个印出来的金额，资料库都答得出来（基线上那几页除外）",
    fresh.length === 0,
    invented
      .filter(([k]) => fresh.includes(k))
      .map(([k, c]) => `${k}:${rm(c)}`)
      .join(" · "),
  );

  for (const k of offPages.filter((x) => BASELINE[x])) {
    const n = invented.filter(([p2]) => p2 === k).length;
    console.log(`  基线  ${k} —— ${n} 个答不出来（${BASELINE[k].reason.slice(0, 52)}…）`);
  }
  if (healed.length) {
    console.log(
      `\n这几页干净了，把它从 figures-baseline.json 划掉：${healed.join(" · ")}`,
    );
    console.log("   一条指着一个已经修好的东西的例外，会静静放过下一个洞。");
  }

  if (invented.length) {
    console.log("\n🔴 资料库答不出来的那几个 —— 逐个用眼睛判它是哪一种：");
    console.log("   ① 真的凭空（客户会指着问的那一个）");
    console.log("   ② 真的算出来的，而它的来源还没进这一支的答案里");
    console.log("\n   那几页整页的金额（判「算出来的」要看它旁边那几个）：");
    for (const [k, all] of pageFigures) {
      console.log(`     ${k}`);
      console.log(`       ${all.sort((x, y) => x - y).map((c) => rm(c)).join(" · ")}`);
    }
  }

  /* ── ④ 🔴 师傅那一边：他看得到的，有没有一个是只有老板看得到的 ────────
   *
   * 上一版这一支写着「只量老板那一边」。而这个产品从 9-01 起有第二种人，
   * 而且他每天都在用（任务 84）。
   *
   * ⚠️ 资料库那一层已经守得很紧（`check:staff` 57 条，用真的登入身分打的）。
   * 缺的是**画面**那一层：`shoot:staff` 只并排拍过**四页**（任务 84），
   * 而那之后又建了十几页 —— 任务 177 量到的那个洞就是这一句：
   * **尺子看得到画面，只是从来没走到新做的那几页。**
   *
   * ── 它怎么判（🔴 一份名单都没有）────────────────────────────────────
   *
   * 不写「哪几页是钱的页」。产品自己那一支（`canOpenModule`）本来就
   * **不照页面清单判，照那个模块的形状判** —— 而它的注解写着为什么：
   * 佣金是後来才进帐本那个形状的，一份手写的清单会放它过去。
   * 我在这里再抄一份，就是这个仓库栽过至少八次的那件事。
   *
   * 所以问的是**那个数字本身**：
   *
   *   🔴 **一个只从「只有老板看得到」那几个来源算得出来的金额，
   *       不可以印在师傅打得开的任何一页上。**
   *
   * 「只从」两个字是重点：一张报价单的总额师傅本来就看得到（任务 117），
   * 而它也会出现在帐本上。同时来自两边的，不算。
   *
   * ⚠️ 师傅打不开那一页 → 什么都刮不到 → 过。那比过还好。
   * ⚠️ 控制组（任务 125 的教训）：**老板自己要真的印过那种数字** ——
   *    少了它，这一整段量的是空气，而它会一直印「全部过」。 */
  console.log("\n④ 🔴 师傅那一边");

  const MONEY_ONLY = /^(ledger_entries|ledger_allocations|party_debts|party_payables|referrals_owing)\./;
  const ownerOnly = new Set(
    [...answers]
      .filter(([cents, froms]) => cents !== 0 && [...froms].every((f) => MONEY_ONLY.test(f)))
      .map(([cents]) => cents),
  );
  say(
    "控制组：老板自己印过只有他看得到的数字",
    [...ownerOnly].some((c) => ownerSeen.has(c)),
    `只有老板看得到的有 ${ownerOnly.size} 个，而画面上一个都没印 —— 下面那一条会变成量空气`,
  );

  const crewEmail = `fig-crew-${STAMP}@formae.test`;
  const crewPassword = `FigCrew-${STAMP}-x!`;
  const { data: crewMade, error: crewErr } = await admin.auth.admin.createUser({
    email: crewEmail,
    password: crewPassword,
    email_confirm: true,
  });
  if (crewErr) throw new Error(`建师傅: ${crewErr.message}`);
  crewId = crewMade.user.id;
  const { error: joinErr } = await api.rpc("add_project_member", { in_email: crewEmail });
  say("道具：师傅加得进这家公司", !joinErr, joinErr?.message);

  if (!joinErr) {
    const crewCtx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const crewPage = await crewCtx.newPage();

    /* 🔴 登不进来要讲清楚是**道具**没摆好，不是产品坏了。
       这一支一趟建两个帐号，而十分钟里开四个就会撞到那一边的限流
       （任务 253 撞过同一个）—— 而一份「师傅登不进来」的报告，
       跟一份「登入坏了」的报告，在画面上长得一模一样。
       所以：等一下再试一次；还是不行就整段跳过，**不印判决**。 */
    let crewIn = false;
    for (const wait of [0, 25000]) {
      if (wait) await crewPage.waitForTimeout(wait);
      try {
        await crewPage.goto(`${BASE}/en/login`, {
          waitUntil: "domcontentloaded",
          timeout: 180000,
        });
        await crewPage.fill('input[type="email"]', crewEmail);
        await crewPage.fill('input[type="password"]', crewPassword);
        await crewPage.click('button[type="submit"]');
        await crewPage.waitForURL(/portal/, { timeout: 45000 });
        crewIn = true;
        break;
      } catch {
        /* 再试一次 */
      }
    }
    say(
      "道具：师傅登得进来",
      crewIn,
      "两次都停在登入页 —— 十之八九是同一趟开两个帐号撞到限流。" +
        "第 ④ 段这一趟没有量到东西，**不要当成师傅那一边没事**",
    );

    const leaked = [];
    const shut = [];
    let crewFigures = 0;
    for (const key of crewIn ? opened : []) {
      const url = key === "dashboard" ? `${BASE}/en/portal` : `${BASE}/en/portal/${key}`;
      const res = await crewPage.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 180000,
      });
      await crewPage.waitForTimeout(2200);
      if ((res?.status() ?? 0) >= 400) {
        shut.push(key);
        continue;
      }
      const text = await crewPage.evaluate(() => document.body.innerText);
      if (/log in|sign in/i.test(text.slice(0, 400))) {
        say(`师傅打得开 ${key}`, false, "被踢回登入页");
        continue;
      }
      const found = [...text.matchAll(/RM\s*(-?[\d,]+(?:\.\d{1,2})?)/g)].map((m) =>
        Math.round(parseFloat(m[1].replace(/,/g, "")) * 100),
      );
      crewFigures += found.length;
      for (const cents of new Set(found)) {
        if (ownerOnly.has(cents)) leaked.push([key, cents]);
      }
    }
    await crewCtx.close();

    if (crewIn)
      console.log(
        `     打得开 ${opened.length - shut.length} 页 · 关着 ${shut.length} 页` +
          `${shut.length ? `（${shut.join(" · ")}）` : ""} · 他看到 ${crewFigures} 个金额`,
      );
    /* 🔴 登不进来的时候这一条**不印** —— 一条没有量到东西的绿，
       跟一条真的量过的绿，在报告里长得一模一样。 */
    if (crewIn)
      say(
        "🔴 师傅看得到的金额里，没有一个是只有老板看得到的",
        leaked.length === 0,
      /* 🔴 **要讲得出它是从哪里来的。** 一份只说「漏了 RM 19,400」的报告，
         读的人分不出那是产品漏了，还是这把尺把一个巧合当成漏 ——
         而这个仓库红过二十几次，其中一半红的是尺不是产品。 */
      leaked
        .map(([k, c]) => `${k}:${rm(c)}（来自 ${[...(answers.get(c) ?? [])].join(" · ")}）`)
        .join(" · "),
    );
  }
} catch (e) {
  /* 🔴 抛了例外要算没过 —— 少了这一段，中途炸掉会印出「全部过」。 */
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  await browser?.close().catch(() => {});
  await dropThrowaways(admin, [userId, crewId]);
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}\n`);
  process.exitCode = bad.length ? 1 : 0;
}
