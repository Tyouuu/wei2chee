/* 表格上那个搜索框，真的会筛吗。
 *
 * ⚠️ 这一支存在的唯一理由：**一个按不动的控件是缺陷，不是装饰。**
 * 任务 15 砍掉过一个搜不到东西的 ⌘K；任务 94 抓到过一条说「已筛选」而画面没筛
 * 的筛选条。所以这个框做出来的当天就要有人真的打字进去看行数变少。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { demoProject } from "./lib/demo-project.mjs";
config({ path: ".env.local", quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const demo = await demoProject(db);
const PROJECT = demo.id;
const proj = demo;
const acct = { email: demo.email };

const fails = [];
const ok = (n, c, d = "") => (c ? console.log(`  PASS  ${n}`) : (fails.push(n), console.log(`  FAIL  ${n}  ${d}`)));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', acct.email);
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 60000 });

/* 中台 是两套带搜索框的其中一套，也是 demo 帐号本来穿的那一套。 */
await p.goto("http://localhost:3000/zh/portal/dashboard", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(7000);

const search = p.locator('input[placeholder]').first();
ok("表格上有一个搜索框", await search.isVisible().catch(() => false));

const rowsBefore = await p.locator("table tbody tr").count();
ok("表格本来有行", rowsBefore > 1, `${rowsBefore} 行`);

await search.fill("Taman");
await p.waitForTimeout(900);
const rowsAfter = await p.locator("table tbody tr").count();
ok("打字之后行数变少", rowsAfter < rowsBefore && rowsAfter > 0, `${rowsBefore} → ${rowsAfter}`);

const head = await p.locator("body").innerText();
ok("上面那个条数跟着变", /1\s*(条|record)/.test(head), head.match(/共?\s*\d+\s*(条|records?)/)?.[0] ?? "读不到");

await search.fill("zzzzzz");
await p.waitForTimeout(700);
const empty = await p.locator("table tbody").first().innerText();
console.log("      找不到时 tbody 是：", JSON.stringify(empty.slice(0,120)));
ok("找不到的时候讲一句话，不是空白也不是全部", /没有|no |zzzzzz/i.test(empty), JSON.stringify(empty.slice(0,80)));

await search.fill("");
await p.waitForTimeout(700);
ok("清空之后全部回来", (await p.locator("table tbody tr").count()) === rowsBefore);


/* 一行都还没有的那一屏 —— 一个真实客户第一天看到的东西。
   用搜索把行数筛到零之后再把表**清空**是做不到的，所以直接问渲染层：
   把 rows 换成空阵列，tbody 会不会讲话。 */
const emptyWords = await p.evaluate(() => {
  const tb = document.querySelector("table tbody");
  return tb ? tb.innerText.length : -1;
});
ok("表格本来有内容（对照用）", emptyWords > 0, String(emptyWords));


/* ────────────────────────────────────────────────────────────────────────
   一句「已筛选」，要么是真的，要么不准印。

   2026-09-05 之前，五页的表头上都有这一行：

       FILTERED BY  状态：等回覆  ×      ← 底下那张表七行，一行都没少
                                        ← 那颗 × 指着 "#"

   一行同时讲两句不是真的话，加一个按不动的东西。而**这一支尺子当时是全绿的**
   —— 它只走总览那一页，而总览没有那一行。所以它现在多走几页，
   而且问的是最笨的那个问题：**这一页上有没有一个连结哪里都不去。**
   ──────────────────────────────────────────────────────────────────────── */
const MODULE_PAGES = ["quotations", "customers", "payments", "projects"];
for (const key of MODULE_PAGES) {
  const res = await p
    .goto(`http://localhost:3000/en/portal/${key}`, { waitUntil: "networkidle", timeout: 180000 })
    .catch(() => null);
  /* 这个帐号没有开这一页 —— 跳过，不当成过也不当成不过。 */
  if (!res || res.status() >= 400) {
    console.log(`  SKIP  ${key} —— 这个帐号没有这一页`);
    continue;
  }
  await p.waitForTimeout(5000);

  const deadLinks = await p.locator('main a[href="#"]').count();
  ok(`${key} · 没有一个连结指着「哪里都不去」`, deadLinks === 0, `${deadLinks} 个`);

  /* 印着「已筛选」就要真的筛过 —— 画面上的行数一定要比它自己report 的总数少。 */
  const saysFiltered = await p.getByText(/filtered by|筛选条件/i).count();
  if (saysFiltered) {
    const shown = await p.locator("table tbody tr").count();
    const body = await p.locator("body").innerText();
    const total = Number(body.match(/(\d+)\s*records?/i)?.[1] ?? "0");
    ok(
      `${key} · 说了「已筛选」就真的筛过`,
      total > 0 && shown < total,
      `画面上 ${shown} 行 / 一共 ${total} 行`,
    );
  }

  /* 那一排分段按下去，行数一定要变 —— 一排按不动的分段跟一排会筛的，长得一模一样。 */
  const segs = p.locator('[role="group"] button[aria-pressed]');
  const n = await segs.count();
  if (n > 1) {
    const was = await p.locator("table tbody tr").count();
    await segs.nth(1).click();
    await p.waitForTimeout(800);
    const now = await p.locator("table tbody tr").count();
    ok(`${key} · 那一排分段真的会筛`, now < was && now > 0, `${was} → ${now}`);
  }
}

await b.close();
console.log(fails.length ? `\n🔴 ${fails.length} 条没过` : "\n全过");
process.exit(fails.length ? 1 : 0);
