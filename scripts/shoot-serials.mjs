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
  await call("set_record_lines", {
    in_record_id: so.id,
    in_lines: [
      {
        description: "Perodua Myvi 1.3",
        qty: 1,
        unit: "unit",
        unit_price_cents: 3200000,
        /* 🔴 序号写在**那一行**上，不是写在出货那一次上
           （`deliver_record` 读的是 `ln.batch_code`）。
           ⚠️ 而画面上**没有那一格** —— `line-editor.tsx` 的 `Line`
           没有 batchCode，所以一台车今天在画面上卖不出去：
           出货那一支会拒绝，而他没有地方打那个号码。
           这一支道具用 RPC 摆好它，**那个洞另外登记，不假装它不在**。 */
        batch_code: CODE,
      },
    ],
  });
  /* 🔴 一台一台管的货，出货一定要讲哪一台（20260906100000 那条守卫）。 */
  /* ⚠️ 那几行是靠 line_id 配的，不是靠名字 —— 我第一版送了 description，
     它回 moved:0 · skipped:1，**而它不报错**：一支把失败写在回传值里的函式，
     对只看 error 的呼叫端，跟一支成功的函式长得一模一样。 */
  const { data: soLines } = await api
    .from("record_lines")
    .select("id")
    .eq("record_id", so.id);
  const went = await call("deliver_record", {
    in_record_id: so.id,
    in_lines: [{ line_id: soLines[0].id, qty: 1, batch_code: CODE }],
  });
  if (Number(went.moved) !== 1) {
    throw new Error("道具没摆好，那一台没有出去 — " + JSON.stringify(went));
  }

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
console.log("→ .screenshots/serials/  ⚠️ 现在去用眼睛看那三张图");
process.exitCode = fail ? 1 : 0;
