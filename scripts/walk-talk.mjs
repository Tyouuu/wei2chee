/**
 * 一天，只用讲的 —— 他坐在他最常开的那一页上，把一天的事讲完。
 *
 * ── 🔴 这一支跟 `check:work-ai` 不是同一件事（2026-09-09）────────────────
 *
 * 那一支是**守卫**：一条一条守着「这个行为不准回去」。这一支是**走查**：
 * 不问「那一格做不做得到」，问 **「他这样用，接得住几句」**。
 *
 * 老板 2026-09-09 讲：`如果没有的话 你就要帮我去实测`。
 * 而「还要不要加功能」这个问题，用数的比用想的准。
 *
 * ── 🔴 它故意不换页 ─────────────────────────────────────────────────────
 *
 * 量出来：**十四个做事的动作里有五个绑在特定页面上** ——
 * 冲正只在钱那几页 · 发连结只在单据上 · 收货只在进货单 · 盘点只在货架 ·
 * 记一天工只在师傅页。
 *
 * 而一个真的老板**不知道这件事**，也不该知道。他站在报价单那一页，
 * 想到什么讲什么。所以这一支从头到尾**不换页** —— 换了页就量不到那件事，
 * 而那件事正是「还要不要加东西」的答案。
 *
 * ── 三种结果，而第三种是唯一危险的那一种 ────────────────────────────────
 *
 *   ✅ 做到了      —— 它讲做了，而资料库真的变了
 *   ⚠️ 挡下来了    —— 它没做，**而且讲得出该去哪里做**（这不是缺陷，是诚实）
 *   🔴 说了没做    —— 它讲得像做了，而资料库一个字都没动
 *
 * 第三种是这个仓库的招牌毛病，而它只有走一遍才看得见。
 *
 * 要开着 `npm run dev`。
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages, seedEveryShape } from "./lib/seed-demo.mjs";

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
const OUT = ".screenshots/walk-talk";
mkdirSync(OUT, { recursive: true });
const MARK = `WT${Date.now().toString().slice(-6)}`;
const EMAIL = `walktalk-${Date.now()}@formae.test`;
const PASSWORD = `Walktalk-${Date.now()}-x!`;
/* 他一天到晚开着的那一页。换成别的 `PAGE=stock npm run walk:talk` 也走得了。 */
const PAGE = process.env.PAGE ?? "quotations";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let userId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;
const log = [];

async function say(page, sentence) {
  /* 🔴 两种关着的样子都要认：宽屏预设就是开的，窄屏是一颗圆钮
     （`closed-narrow`）。只认一种的走查，会在另一种上报一个假的死局。 */
  /* ⚠️ **要看得见的那一颗**。两种关着的样子同时在 DOM 里，
     而窄屏那一颗在宽屏是 0×0 —— `.first()` 拿到它，点不动，
     然后这一支报一个假的「面板不在」。 */
  const shut = page.locator(
    '[data-work-ai="closed"]:visible, [data-work-ai="closed-narrow"]:visible',
  );
  if (await shut.count()) await shut.first().click().catch(() => {});
  const box = page.locator('[data-work-ai="open"] textarea').first();
  await box.waitFor({ timeout: 30000 });
  await box.fill(sentence);
  await page
    .locator('[data-work-ai="open"]')
    .getByRole("button", { name: /change it/i })
    .first()
    .click({ timeout: 30000 });
  await page
    .locator("[data-work-ai-said]")
    .first()
    .waitFor({ timeout: 180000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  return (
    await page
      .locator("[data-work-ai-said]")
      .first()
      .innerText()
      .catch(() => "")
  ).trim();
}

/** 那张表现在有几行 —— 用来判「真的动了没有」。 */
async function count(table, filter = (q) => q) {
  const { count: n } = await filter(
    admin.from(table).select("id", { count: "exact", head: true }),
  );
  return n ?? 0;
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
  const { opened } = await openAllPages(api, { quiet: true });
  await seedEveryShape(api, P, MARK, opened, { quiet: true, rows: 3 });
  /* 一件有价钱的货 —— 他讲「两支灯」的时候价钱要从他自己那里来。 */
  await api.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "LED downlight", in_unit: "pc", in_price_cents: 4500,
  });
  /* 一封官网上进来的询价。 */
  await admin.from("site_enquiries").insert({
    project_id: P, name: "Puan Aishah", contact: "013-777 2244",
    answers: { "What do you need": "Repaint 3 rooms, Taman Melati" },
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  await page.goto(`${BASE}/en/portal/${PAGE}`, { waitUntil: "networkidle", timeout: 180000 });
  /* ⚠️ 等它**真的出现**，不是等一个固定的秒数 —— 刚起的服务器
     第一次编译这一页要很久，而一份「面板不在」的报告跟一份
     「还在编译」的报告在画面上长得一模一样。 */
  await page
    .locator("[data-work-ai]")
    .first()
    .waitFor({ timeout: 120000 })
    .catch(() => {});
  await page.waitForTimeout(1200);

  console.log(`\n他坐在 /${PAGE} 上，一整天不换页。\n`);

  /*
    一个装修老板真的会讲的十二句 —— 顺序照他一天的顺序，不是照我们的目录。
    `want` 是「讲完之后资料库应该多／少什么」；回 null 表示这一句是问问题，
    本来就不该动任何东西。
  */
  const day = [
    { say: "What do I need to chase today?", want: null, note: "开工先问一句" },
    { say: `Add a quotation for Kedai Aman, RM 3,200, rewire two shoplots`,
      want: () => count("pipeline_records", (q) => q.eq("project_id", P).ilike("party", "%kedai aman%")) },
    { say: "On that quote add a line: 2 LED downlight",
      want: () => count("record_lines", (q) => q.eq("project_id", P)) },
    { say: "Same again for Lim Brothers",
      want: () => count("pipeline_records", (q) => q.eq("project_id", P).ilike("party", "%lim brothers%")) },
    { say: "Send the Kedai Aman quote to them", want: null, note: "发一条连结给客人" },
    { say: "Note on that one: call them Friday about the deposit",
      want: () => count("follow_ups", (q) => q.eq("project_id", P)) },
    { say: "Reply to Puan Aishah about the repaint", want: null, note: "官网上进来的那一封" },
    { say: "Ah Ming worked a full day today",
      want: () => count("work_days", (q) => q.eq("project_id", P)), note: "🔴 记一天工只在师傅页" },
    { say: "Counted 84 bags of cement",
      want: () => count("stock_moves", (q) => q.eq("project_id", P)), note: "🔴 盘点只在货架页" },
    { say: "Took RM 1,000 deposit from Kedai Aman",
      want: () => count("ledger_entries", (q) => q.eq("project_id", P)), note: "🔴 记一笔钱" },
    { say: "How much came in this month?", want: null, note: "问数字" },
    { say: "Who owes me money?", want: null, note: "问欠款" },
  ];

  for (const step of day) {
    const before = step.want ? await step.want() : 0;
    const said = await say(page, step.say);
    const after = step.want ? await step.want() : 0;
    const moved = step.want ? after - before : 0;
    const oneLine = said.split(String.fromCharCode(10)).join(" / ").slice(0, 150);

    /* 🔴 三种，而第三种是唯一危险的那一种。判「它讲得像做了没有」用的是
       它自己那一句里有没有「做不到 / 要去哪里做」那一类的话 —— 一个
       讲得出去哪里做的拒绝是诚实，一个只会说「好了」而什么都没动的不是。 */
    /* ⚠️ 第一版漏掉了最常见的那一种形状：
       「Todays attendance is recorded on the **Staff page, not this** Quotations page」——
       一句很诚实的拒绝，而我那把尺把它归成「说了没做」。
       一把把诚实算成说谎的尺，会逼下一个人去拆掉那几道守卫。 */
    const refused =
      /* ⚠️ 这一条正则改过三次，每一次都是它把一句**诚实的拒绝**
         归成了「说了没做」。模型每一次的讲法都不一样（「is recorded on」·
         「goes on」·「can only be recorded on … not here」），所以改成抳
         **那一句里有没有指路**：它念得出另一页的名字，就不是说谎。
         一把把诚实算成说谎的尺，会逼下一个人去拆掉那几道守卫。 */
      /* ⚠️ 「already」也算 —— 2026-09-10 量的：同一句讲三次，
         第一次加了行，第二三次它讲「那一行已经在那张单上了」。
         **那是对的行为**，而不把它算进来，这一支会把一次防重复
         报成「说了没做」。 */
      /can.?t|cannot|not available|only be|only on|goes on|is recorded on|go to|is done on|not (this|here)|already (on|there|done|added)|做不到|不能|要在|请到|那一页|已经在/i.test(said) ||
      /(Stock|Staff|Shelf|Payments|Expenses|Bookings|Design) page/i.test(said);
    let verdict;
    if (!step.want) verdict = said ? "✅ 答了" : "🔴 一句话都没讲";
    else if (moved > 0) verdict = "✅ 做到了";
    else if (refused) verdict = "⚠️ 挡下来了（讲得出去哪里做）";
    else verdict = "🔴 说了没做";

    log.push({ ...step, said: oneLine, moved, verdict });
    console.log(`${verdict}  「${step.say}」`);
    console.log(`            ${oneLine}`);
    if (step.note) console.log(`            ${step.note}`);
    console.log("");
  }

  await page.screenshot({ path: `${OUT}/day.png` });
} catch (e) {
  console.error(e);
  log.push({ say: "(threw)", verdict: "🔴 整支掉下去", said: String(e.message).slice(0, 120) });
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);

  const did = log.filter((l) => l.verdict.startsWith("✅")).length;
  const held = log.filter((l) => l.verdict.startsWith("⚠️")).length;
  const lied = log.filter((l) => l.verdict.startsWith("🔴")).length;
  console.log("──────────────────────────────────────────────────────────");
  console.log(`一天讲了 ${log.length} 句：✅ ${did} 接住 · ⚠️ ${held} 挡下来 · 🔴 ${lied} 说了没做`);
  if (lied) {
    console.log("\n🔴 说了没做的那几句 —— 这一类是这个仓库的招牌毛病：");
    for (const l of log.filter((x) => x.verdict.startsWith("🔴"))) {
      console.log(`  · 「${l.say}」→ ${l.said}`);
    }
  }
  if (held) {
    console.log("\n⚠️ 挡下来的那几句（他要先走到别的页才讲得动）：");
    for (const l of log.filter((x) => x.verdict.startsWith("⚠️"))) {
      console.log(`  · 「${l.say}」`);
    }
  }
  console.log(`\n图：${OUT}/day.png`);
  /* 🔴 这一支**不用红绿判成败** —— 它是一份读数，不是一条守卫。
     把「他要换页」判成失败，会逼下一个人去把那五道守卫拆掉。 */
  process.exit(0);
}
