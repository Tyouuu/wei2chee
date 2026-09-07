/**
 * 打一个车架号，看到那一台走过的路 —— 在真的浏览器里查一次。
 *
 * ── 为什么这一支要存在 ────────────────────────────────────────────────────
 *
 * `serial_history` · `set_item_serial_tracking`（20260906100000）
 * 27 条真身分的断言全过（`check:serials`），而**画面上一个入口都没有**
 * （[任务 252](../docs/founder-tasks.md#252) 数的 24 支之二）。
 *
 * 🔴 而它服务的是他自己那份名单上最大的一群：怡保 262 家里 **122 家要序号**，
 * **车行 90 家是排第一的行业**（[任务 181](../docs/founder-tasks.md#181)）。
 *
 * ⚠️ 走的是**一台车真的会走的那一条**：登记 → 进货架 → 卖出去 → 再查一次。
 * 每一步之后**回资料库对一次**，因为「在不在架上」是这一页的答案，
 * 而一个说反了的答案在柜台上就是把一台已经卖掉的车再卖一次。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages } from "./lib/seed-demo.mjs";

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
const EMAIL = `serials-${Date.now()}@formae.test`;
const PASSWORD = `Serials-${Date.now()}-x!`;
const CODE = "PM2A1234567890";

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const api = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

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

const call = async (fn, args) => {
  const { data, error } = await api.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return Array.isArray(data) ? data[0] : data;
};

let userId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;

try {
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
  const projectId = proj.id;
  await api.rpc("set_project_style", { new_style: "ledger" });
  const { opened } = await openAllPages(api, { quiet: true });
  for (const need of ["inventory", "orders", "customers"]) {
    if (!opened.includes(need)) throw new Error(`没有 ${need} 那一页 —— 道具没摆好`);
  }

  /* 一间二手车行：一件「Myvi 1.3」，架上零台。 */
  const car = await call("add_catalog_item", {
    in_project_id: projectId,
    in_module_key: "inventory",
    in_name: "Perodua Myvi 1.3",
    in_unit: "unit",
  });
  const buyer = await call("add_directory_entry", {
    in_project_id: projectId,
    in_module_key: "customers",
    in_name: "Mr Tan",
  });

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 240000 });

  const openPage = async () => {
    await page.goto(`${BASE}/en/portal/serials`, {
      waitUntil: "domcontentloaded",
      timeout: 240000,
    });
    await page.waitForTimeout(2500);
  };

  console.log("① 一件都还没开序号的时候");
  await openPage();
  ok("那一页打得开", (await page.locator("[data-serial-search]").count()) > 0);
  const first = await page.locator("body").innerText();
  ok(
    "🔴 讲的是「还没有一件货是一台一台管的」，不是一张假的清单",
    /Nothing is tracked one by one|还没有一件货/.test(first),
    first.slice(0, 200),
  );
  ok(
    "⚠️ 而侧栏上还没有那一行（一件都没开）",
    !/Serial numbers/.test(
      await page.locator("nav, aside").first().innerText().catch(() => ""),
    ),
  );
  await page.screenshot({
    path: ".screenshots/serials/1-empty.png",
    fullPage: true,
  });

  console.log("\n② 把那一件货打开");
  await page.getByRole("button", { name: /Show the other/i }).click();
  await page.waitForTimeout(400);
  await page
    .locator("[data-tracked-items]")
    .getByRole("button", { name: /^Track one by one$/ })
    .first()
    .click();
  await page.waitForTimeout(3000);
  const { data: itemNow } = await api
    .from("catalog_items")
    .select("tracks_serial")
    .eq("id", car.id)
    .maybeSingle();
  ok("🔴 那一件货真的开了", itemNow?.tracks_serial === true, String(itemNow?.tracks_serial));

  console.log("\n③ 登记一台，那个号码不用再打一次");
  await openPage();
  await page.locator('[data-serial-search] input').first().fill(CODE);
  await page.getByRole("button", { name: /Look it up|查一下/ }).click();
  await page.waitForTimeout(2500);
  const notYet = await page.locator("[data-serial-search]").innerText();
  ok(
    "查不到的时候讲一句，而且就在那里登记",
    /Register this one|登记这一台/.test(notYet),
    notYet.slice(0, 200),
  );
  await page
    .locator('[data-serial-search] input[inputmode="decimal"]')
    .fill("28000");
  await page.getByRole("button", { name: /^Register it$/ }).click();
  await page.waitForTimeout(3500);
  const { data: batch } = await api
    .from("stock_batches")
    .select("id, code, unit_cost_cents")
    .eq("item_id", car.id)
    .maybeSingle();
  ok("那一台写下去了", batch?.code === CODE, String(batch?.code));
  ok(
    "🔴 那一台自己的进价记下来了（一台车一个价）",
    Number(batch?.unit_cost_cents) === 2800000,
    String(batch?.unit_cost_cents),
  );

  console.log("\n④ 进一台，再卖出去 —— 那一页要讲得出它不在了");
  /* ⚠️ 那一支收的是 `in_batch_id`（uuid），**不是号码** ——
     我第一版猜了 `in_batch_code`，而 PostgREST 回的是「找不到那支函式」。
     **这个 session 第十次猜签名而不去读它。** */
  await call("move_stock", {
    in_item_id: car.id,
    in_direction: "in",
    in_qty: 1,
    in_reason: "Trade-in",
    in_batch_id: batch.id,
  });
  const so = await call("add_pipeline_record", {
    in_project_id: projectId,
    in_module_key: "orders",
    in_title: "Sold to Mr Tan",
    in_party: buyer.name,
    in_party_id: buyer.id,
    in_amount_cents: 3200000,
    in_idempotency_key: crypto.randomUUID(),
  });
  /* ⚠️ 这一行**故意不带号码** —— 那正是他在画面上打完一行之后的样子，
     而下一段就是这一支尺真正在守的那一件：**他在画面上讲得出是哪一台吗**。 */
  await call("set_record_lines", {
    in_record_id: so.id,
    in_lines: [
      {
        description: "Perodua Myvi 1.3",
        qty: 1,
        unit: "unit",
        unit_price_cents: 3200000,
      },
    ],
  });

  console.log("\n④b 哪一台 —— 在画面上打进去（[任务 275]）");
  /* 🔴 2026-09-07 之前这一格不存在：一间二手车行
     **登记那一台 · 进货架 · 开一张单三步都做得了，而最后一步做不了** ——
     出货被拒绝（'say which serial is going out'），而他没有地方打那个号码。

     ⚠️ 号码读的是**存下来那一行**上的 `batch_code`，不是出货那一次送的 ——
     `deliver_record` 里那个 `ln` 是 `record_lines` 的那一行（20260906100000）。
     所以「他打得进去吗」就是「这一台卖不卖得出去」，没有第二条路。 */
  await page.goto(`${BASE}/en/portal/orders/${so.id}`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(3000);
  const serialBox = page.getByLabel(/Which unit/i).first();
  ok("🔴 那一行上有一格可以打号码", (await serialBox.count()) > 0);
  ok(
    "架上那一台在挑选清单里 —— 17 个字不该要他打",
    (await page.locator(`datalist option[value="${CODE}"]`).count()) > 0,
  );
  /* 一包水泥那一行上不该有它 —— 那一条由单元测试守（`line-suggest.test.tsx`），
     这里守的是**真的资料库 + 真的浏览器**那一半。 */
  await serialBox.fill(CODE);
  /* ⚠️ 拍下来 —— 一格看得懂的框跟一格挤在四个数字中间的框，
     读数上长得一模一样（[重点 7l]）。 */
  /* ⚠️ 拍那一块自己，不要自己算裁切框 —— 第一版拿 boundingBox 去裁，
     而那一格是**填完之后**才长出来的，於是图上那个框被切了一半。 */
  await page
    .locator("section")
    .filter({ hasText: /Line items/ })
    .first()
    .screenshot({ path: ".screenshots/serials/4-which-unit.png" });
  await page.getByRole("button", { name: /^Save|保存/ }).first().click();
  await page.waitForTimeout(3500);

  const { data: soLines } = await api
    .from("record_lines")
    .select("id, batch_code")
    .eq("record_id", so.id);
  ok(
    "🔴 按了保存，那一行上真的有那个号码",
    soLines?.[0]?.batch_code === CODE,
    String(soLines?.[0]?.batch_code),
  );

  console.log("\n④c 那一台出得去了");
  /* ⚠️ 那几行是靠 line_id 配的，不是靠名字 —— 我第一版送了 description，
     它回 moved:0 · skipped:1，**而它不报错**：一支把失败写在回传值里的函式，
     对只看 error 的呼叫端，跟一支成功的函式长得一模一样。
     ⚠️ 而 `in_lines` 里**不送 batch_code** —— 那一支根本不读它。 */
  const went = await call("deliver_record", {
    in_record_id: so.id,
    in_lines: [{ line_id: soLines[0].id, qty: 1 }],
  });
  ok(
    "🔴 出货没有被拒绝 —— 号码是他在画面上讲的",
    Number(went.moved) === 1,
    JSON.stringify(went),
  );

  await openPage();
  await page.locator('[data-serial-search] input').first().fill(CODE);
  await page.getByRole("button", { name: /Look it up|查一下/ }).click();
  await page.waitForTimeout(2500);
  const card = await page.locator("[data-serial-search]").innerText();
  ok("那一台找得到", /Perodua Myvi/.test(card), card.slice(0, 200));
  ok("号码印出来了", card.includes(CODE), card.slice(0, 200));
  ok(
    "🔴 讲的是「不在了」，不是「还在架上」",
    /Gone|不在了/.test(card) && !/Still on the shelf|还在架上/.test(card),
    card.slice(0, 300),
  );
  /* ⚠️ 认「RM 28,000」不认「RM 28,000.00」—— `ringgit()` 整数不印小数，
     而它的档头写着为什么：**那是承包商写钱的写法，带两位小数的是软件的写法**。
     第十二次红的是我的断言，不是产品。 */
  ok("进价印出来了 · RM 28,000", /RM\s?28,000/.test(card), card.slice(0, 300));
  ok("走过的路：进 · 出，两步都在", /\bIn\b/.test(card) && /\bOut\b/.test(card), card.slice(0, 400));
  ok("那一步上写着卖给谁", /Mr Tan/.test(card), card.slice(0, 400));
  await page.screenshot({
    path: ".screenshots/serials/2-found.png",
    fullPage: true,
  });

  console.log("\n⑤ 侧栏上那一行出现了");
  const rail = await page.locator("aside, nav").first().innerText().catch(() => "");
  ok("🔴 开了一件之后侧栏上才有那一行", /Serial numbers/.test(rail), rail.slice(0, 300));

  console.log("\n⑥ 390 —— 判这一页的是他，而他在柜台上");
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await context.storageState(),
  });
  const mp = await phone.newPage();
  await mp.goto(`${BASE}/en/portal/serials`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await mp.waitForTimeout(2500);
  ok("那一页在", (await mp.locator("[data-serial-search]").count()) > 0);
  const wide = await mp.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  ok("390 上不横滚", !wide);
  await mp.locator('[data-serial-search] input').first().fill(CODE);
  await mp.getByRole("button", { name: /Look it up|查一下/ }).click();
  await mp.waitForTimeout(2500);
  const wide2 = await mp.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  ok("🔴 查出来那一张卡照样不横滚", !wide2);
  await mp.screenshot({
    path: ".screenshots/serials/3-phone.png",
    fullPage: true,
  });
  await phone.close();
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass} 过 ${fail} 没过`);
console.log("→ .screenshots/serials/  ⚠️ 现在去用眼睛看那四张图");
process.exitCode = fail ? 1 : 0;
