/**
 * 法定费率表那一页 —— 在真的浏览器里装一份、核对一次。
 *
 * ── 为什么这一支要存在 ────────────────────────────────────────────────────
 *
 * `upsert_statutory_schedule` · `confirm_statutory_schedule`
 * （20260904210000）**画面上一个入口都没有** —— [任务 243](../docs/founder-tasks.md#243)
 * 数的那几支里的最后两支真的功能。而它们两支的第一句都是 `is_founder()`，
 * 所以它们的家在 `/console`，不在客户的薪资页（那一页的档头自己就写着）。
 *
 * ── ⚠️ 它写的是**全域**的一张表，不是某一家生意的 ────────────────────────
 *
 * `statutory_schedules` 没有 `project_id` —— 法律对每一家生意都一样。
 * 也就是说这一支种下去的东西，**每一个客户的薪资都读得到**。
 * 两道防线，两道都要：
 *
 *   ① 生效日写 **2099-01-01**。`statutory_lookup` 挑的是
 *      `effective_from <= 那一天` —— 一份 2099 年生效的表，
 *      在它活着的那几秒里**没有任何一次真的薪资选得到它**。
 *   ② 跑完**逐个写出 id 删掉**。不扫 pattern ——
 *      那把枪 2026-09-04 炸掉过示范帐号（[任务 129](../docs/founder-tasks.md#129)）。
 *
 * ── 🔴 它问的最后一句是「资料库怎么说」，不是「画面写了什么」 ──────────────
 *
 * 一张画着「3 格」的画面，跟一张真的装了三格的表，长得一模一样。
 * 每一次按完都回资料库对一次。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowawayOnExit, dropThrowaways } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const stamp = Date.now();
const TAB = String.fromCharCode(9);

/* 🔴 一个不可能被任何一次真的薪资选到的类别加生效日。 */
const PART = `RULER-${stamp}`;
const FROM = "2099-01-01";

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/* 服务器不在的时候**拒绝跑**，不猜 —— 一份「每一条都没过」的报告，
   跟一份「服务器没开」的报告，在画面上长得一模一样。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
const ok = (name, cond, saw) => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

const people = [];
async function founderPerson() {
  const email = `law-${stamp}@formae.test`;
  const password = `Law-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  people.push(data.user.id);
  const { error: roleErr } = await admin
    .from("accounts")
    .update({ role: "founder" })
    .eq("id", data.user.id);
  if (roleErr) throw new Error(`role: ${roleErr.message}`);
  return { id: data.user.id, email, password };
}
dropThrowawayOnExit(admin, () => people);

/** 那几份被这一支种进去的表，跑完要删干净。 */
async function dropSchedules() {
  const { data } = await admin
    .from("statutory_schedules")
    .select("id")
    .eq("part", PART);
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;
  /* brackets 是 on delete cascade，所以删表头就够。 */
  const { error } = await admin
    .from("statutory_schedules")
    .delete()
    .in("id", ids);
  if (error) throw new Error(`cleanup: ${error.message}`);
  return ids.length;
}

const readSchedule = async () => {
  const { data } = await admin
    .from("statutory_schedules")
    .select("id, confirmed_at, confirmed_by, confirmed_note, source_name")
    .eq("part", PART)
    .maybeSingle();
  return data;
};

let browser;
try {
  const founder = await founderPerson();

  /* 今天这个资料库有几份 —— 空的那一段只有在真的空的时候才问得了。
     ⚠️ 20260904210000 是**刻意**一行费率都没种的，所以今天多半是零。 */
  const { count: already } = await admin
    .from("statutory_schedules")
    .select("id", { count: "exact", head: true });

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.fill('input[type="email"]', founder.email);
  await page.fill('input[type="password"]', founder.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/console|portal/, { timeout: 240000 });

  console.log("\n① 那扇门");
  await page.goto(`${BASE}/en/console/law`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(2500);
  ok("那一页打得开", page.url().includes("/console/law"), page.url());
  ok(
    "🔴 顶栏上有那一格 —— 不然这一页只有知道网址的人到得了",
    (await page.locator('header a[href$="/console/law"]').count()) === 1,
  );

  /* 🔴 两条 sticky 都停在 0，一滚下去页面那一条就把 console 的导航整个盖掉
     —— 2026-09-07 那张图上看得到，而在它之前 console 那三页都是这样。
     `console-shell.tsx` 用 `--bar-top` 把页面那一条推下来，而那个高度是
     **量出来的**（顶栏窄屏会折成两行）。所以这里问的是最后那一句：
     滚下去之后，两条框不可以重叠。窄屏那一边下面再问一次。 */
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(400);
  const stack = await page.evaluate(() => {
    const head = document.querySelector("header")?.getBoundingClientRect();
    const bar = document.querySelector("main h1")?.closest("div.sticky")
      ?.parentElement?.parentElement;
    const barBox = (
      document.querySelector("main .sticky") ?? bar
    )?.getBoundingClientRect();
    return head && barBox
      ? { headBottom: head.bottom, barTop: barBox.top }
      : null;
  });
  ok(
    "🔴 滚下去之后，页面那一条不会盖住 console 的导航",
    !!stack && stack.barTop >= stack.headBottom,
    stack ? `顶栏底 ${stack.headBottom} · 那一条顶 ${stack.barTop}` : "量不到",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  await page.screenshot({
    path: ".screenshots/console/law-empty.png",
    fullPage: true,
  });

  const body0 = await page.locator("body").innerText();
  if ((already ?? 0) === 0) {
    ok(
      "🔴 一份都没有的时候，讲的是**算不出来**，不是「发不出去」",
      (await page.locator("[data-law-nothing]").count()) === 1 &&
        /worked out/i.test(body0),
      body0.slice(0, 200),
    );
    ok("而且讲得出去哪里拿", /kwsp|perkeso/i.test(body0), body0.slice(0, 300));
  } else {
    console.log(
      `  ⚪ 跳过「空的那一段」—— 这个资料库已经有 ${already} 份表，这一支不去清别人的东西`,
    );
  }

  console.log("\n② 贴一份读不懂的进去");
  const bad = [
    `100.00${TAB}200.00${TAB}1.00${TAB}2.00`,
    `200.01${TAB}300.00${TAB}abc${TAB}2.00`,
  ].join("\n");
  await page.fill("[data-law-paste]", bad);
  await page.waitForTimeout(400);
  const refused = page.locator("[data-law-refused]");
  ok("整份拒绝，不是跳过那一行", (await refused.count()) === 1);
  const refusedText = (await refused.count()) ? await refused.innerText() : "";
  ok(
    "🔴 讲得出是**第 2 行** —— 他要去改的是那一行",
    /\b2\b/.test(refusedText),
    refusedText,
  );
  const loadBtn = page.locator("[data-law-load] button").last();
  ok("那颗按钮按不下去", await loadBtn.isDisabled());

  console.log("\n③ 贴官方那张表的样子");
  /* KWSP 第三附表那几行真的长的样子：标题 · 两格金额 · 表尾那一行是百分比。 */
  const good = [
    `Wage from${TAB}Wage to${TAB}Employee${TAB}Employer`,
    `4,900.01${TAB}5,000.00${TAB}550.00${TAB}600.00`,
    `5,000.01${TAB}5,100.00${TAB}561.00${TAB}612.00`,
    `20,000.01${TAB}${TAB}11%${TAB}12%`,
  ].join("\n");
  await page.fill("[data-law-paste]", good);
  await page.waitForTimeout(400);
  const preview = page.locator("[data-law-preview]");
  ok("读得懂了", (await preview.count()) === 1);
  const previewText = (await preview.count()) ? await preview.innerText() : "";
  ok(
    "🔴 三格，其中一格是比例 —— 两个数字都要讲",
    /3 brackets/i.test(previewText) && /1 of them a rate/i.test(previewText),
    previewText.slice(0, 200),
  );
  ok(
    "🔴 跳过标题那一行**讲出来** —— 静静吃掉一行正是它在防的",
    /Ignored the heading/i.test(previewText),
    previewText.slice(0, 200),
  );
  ok(
    "表尾那一行画在预览里（没有上限、百分比）",
    /20,000\.01 \+/.test(previewText) && /11% \/ 12%/.test(previewText),
    previewText.slice(0, 300),
  );
  ok(
    "🔴 表还没填出处，按钮照样按不下去 —— 一份没有出处的法定表，稽查的时候拿不出来",
    await loadBtn.isDisabled(),
  );

  console.log("\n④ 装进去");
  await page.fill('[data-law-load] input[placeholder="A, C, E, 1, 2…"]', PART);
  await page.fill('[data-law-load] input[type="date"]', FROM);
  /* 出处 · 网址 · 法令 · 经过谁 —— 照画面上的顺序。 */
  const nameBox = page
    .locator('[data-law-load] label:has-text("Source") input')
    .first();
  await nameBox.fill(`KWSP Third Schedule ${stamp}`);
  await page.fill(
    '[data-law-load] input[placeholder="https://"]',
    "https://www.kwsp.gov.my/",
  );
  await page.waitForTimeout(300);
  ok("四格填完了，按钮活过来", !(await loadBtn.isDisabled()));

  await loadBtn.click();
  await page.waitForTimeout(3000);

  const row = await readSchedule();
  ok("🔴 资料库里真的多了那一份", !!row, JSON.stringify(row));
  ok(
    "而且没有人核对过 —— 装进去不等於核对过",
    !!row && row.confirmed_at === null,
    row?.confirmed_at ?? "null",
  );
  const { count: brackets } = await admin
    .from("statutory_brackets")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", row?.id ?? "00000000-0000-0000-0000-000000000000");
  ok("🔴 三格真的进去了", brackets === 3, String(brackets));
  const { count: tail } = await admin
    .from("statutory_brackets")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", row?.id ?? "00000000-0000-0000-0000-000000000000")
    .is("wage_to_cents", null);
  ok("表尾那一行是没有上限的那一格", tail === 1, String(tail));
  const { data: kwsp } = await admin
    .from("statutory_brackets")
    .select("wage_from_cents, employee_cents, employer_cents")
    .eq("schedule_id", row?.id ?? "00000000-0000-0000-0000-000000000000")
    .eq("wage_from_cents", 490001)
    .maybeSingle();
  ok(
    "🔴 4,900.01 是 490001 分、550.00 是 55000 分 —— 一分不差",
    kwsp?.employee_cents === 55000 && kwsp?.employer_cents === 60000,
    JSON.stringify(kwsp),
  );

  console.log("\n⑤ 它在那一页上");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForTimeout(2500);
  const mine = page.locator(`[data-law-row]:has-text("${PART}")`);
  ok("那一份画出来了", (await mine.count()) === 1);
  const mineText = (await mine.count()) ? await mine.innerText() : "";
  ok("写着「还没核对」", /not checked/i.test(mineText), mineText.slice(0, 200));
  ok(
    "🔴 几格看得见 —— 一份零格的表在清单上跟一份完整的长得一样",
    /3 brackets/i.test(mineText),
    mineText.slice(0, 200),
  );
  ok(
    "有表尾那一行，也讲出来了",
    /has the tail row/i.test(mineText),
    mineText.slice(0, 200),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: ".screenshots/console/law-loaded.png",
    fullPage: true,
  });

  const body1 = await page.locator("body").innerText();
  ok(
    "🔴 顶上那一条讲的是**发不出去**，不是「算不出来」—— 两种缺法，两个后果",
    (await page.locator("[data-law-unconfirmed]").count()) === 1 &&
      /pay out/i.test(body1),
    body1.slice(0, 300),
  );

  console.log("\n⑥ 我核对过了");
  await mine.locator("input").fill("KWSP page 3, downloaded today");
  await mine.locator("button").click();
  await page.waitForTimeout(3000);
  const confirmed = await readSchedule();
  ok(
    "🔴 资料库那一栏盖章了",
    !!confirmed?.confirmed_at,
    confirmed?.confirmed_at ?? "null",
  );
  ok(
    "而且记住是谁核对的",
    confirmed?.confirmed_by === founder.id,
    confirmed?.confirmed_by ?? "null",
  );
  ok(
    "那一句话留着 —— 稽查的时候要拿得出来",
    confirmed?.confirmed_note === "KWSP page 3, downloaded today",
    confirmed?.confirmed_note,
  );
  await page.waitForTimeout(1500);
  const body2 = await page.locator("body").innerText();
  ok(
    "画面上那一条挡着钱的话不见了",
    (await page.locator("[data-law-unconfirmed]").count()) === 0,
    body2.slice(0, 200),
  );

  console.log("\n⑦ 再装一次同一份");
  await page.fill("[data-law-paste]", good);
  await page.fill('[data-law-load] input[placeholder="A, C, E, 1, 2…"]', PART);
  await page.fill('[data-law-load] input[type="date"]', FROM);
  await page
    .locator('[data-law-load] label:has-text("Source") input')
    .first()
    .fill(`KWSP Third Schedule ${stamp} v2`);
  await page.fill(
    '[data-law-load] input[placeholder="https://"]',
    "https://www.kwsp.gov.my/",
  );
  await page.waitForTimeout(400);
  await page.locator("[data-law-load] button").last().click();
  await page.waitForTimeout(3000);
  const again = await readSchedule();
  ok(
    "🔴 换掉那一份，而**核对被收回** —— 画面上那句话讲的就是这件事",
    !!again && again.confirmed_at === null,
    again?.confirmed_at ?? "null",
  );
  ok(
    "换掉的是同一份，不是多一份重叠的",
    again?.id === row?.id && again?.source_name.endsWith("v2"),
    `${again?.id === row?.id} · ${again?.source_name}`,
  );

  console.log("\n⑧ 窄的那一边");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  ok("不横滚", overflow <= 1, `${overflow}px`);
  ok(
    "那个贴的框还在画面里",
    await page.locator("[data-law-paste]").isVisible(),
  );
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(400);
  const stack390 = await page.evaluate(() => {
    const head = document.querySelector("header")?.getBoundingClientRect();
    const bar = document.querySelector("main .sticky")?.getBoundingClientRect();
    return head && bar ? { headBottom: head.bottom, barTop: bar.top } : null;
  });
  ok(
    "🔴 窄屏那一条顶栏折成两行，页面那一条要跟着下来",
    !!stack390 && stack390.barTop >= stack390.headBottom,
    stack390
      ? `顶栏底 ${stack390.headBottom} · 那一条顶 ${stack390.barTop}`
      : "量不到",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: ".screenshots/console/law-390.png",
    fullPage: true,
  });
} catch (e) {
  fail++;
  console.log(`\n  FAIL  这一支自己炸了 — ${e.message}`);
} finally {
  if (browser) await browser.close();
  try {
    const dropped = await dropSchedules();
    console.log(`\n  清掉 ${dropped} 份这一支种下去的表`);
  } catch (e) {
    console.log(`\n  🔴 清不掉：${e.message}`);
    fail++;
  }
  await dropThrowaways(admin, people);
}

console.log(
  "\n→ .screenshots/console/law-empty.png · law-loaded.png · law-390.png  ⚠️ 现在去用眼睛看那三张图",
);
console.log(`\n判：${pass} 过 ${fail} 没过`);
process.exitCode = fail ? 1 : 0;
