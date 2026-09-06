/**
 * 货退回来，架上真的多回去 —— 在真的浏览器里按一次。
 *
 * ── 为什么这一支要存在 ────────────────────────────────────────────────────
 *
 * `record_return` · `returns_of` · `drop_return` 从 20260905840000 起就在，
 * 32 ＋ 41 条真身分的断言全过（`check:returns` · `check:supplier-returns`），
 * 而**画面上一个入口都没有** —— 两条任务的收尾都写着同一句。
 *
 * 🔴 而它的靶不是「那颗按钮画出来了没有」，是**架上那个数字**：
 * 一个静静少算两行的退货，是他下个月盘点才会发现的错，
 * 而装修师傅不知道自己应该有几包（[任务 123] 的原话）。
 * 所以每一步之后都**回资料库问架上剩几件**。
 *
 * ⚠️ 卖跟买两边都走一次 —— 方向是那张单自己算出来的，
 * 而一支只走一边的尺，看不到接反了。
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
const EMAIL = `returns-${Date.now()}@formae.test`;
const PASSWORD = `Returns-${Date.now()}-x!`;

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

/** ⚠️ 每一个选择器都关在那一段里面 —— 「Record it」这一页上有三颗
 *  （盘点 · 谁介绍的 · 退货），而 Playwright 会直接拒绝跑。 */
const panelOf = (pg) => pg.locator("[data-returns-panel]");

let userId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;

/** ⚠️ 每一句道具的写入都当场看错误 —— 一句不看错误的写入，
 *  跟一句没有写过的写入，在报告里长得一模一样（任务 227）。 */
const call = async (fn, args) => {
  const { data, error } = await api.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return Array.isArray(data) ? data[0] : data;
};

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
  for (const need of ["orders", "purchases", "inventory", "customers", "suppliers"]) {
    if (!opened.includes(need)) throw new Error(`没有 ${need} 那一页 —— 道具没摆好`);
  }

  /* ── 道具：一件货 · 一个客人 · 一家供应商 · 一张卖的单 · 一张买的单 ── */
  const item = await call("add_catalog_item", {
    in_project_id: projectId,
    in_module_key: "inventory",
    in_name: "Cement 50kg",
    in_unit: "bag",
  });
  const buyer = await call("add_directory_entry", {
    in_project_id: projectId,
    in_module_key: "customers",
    in_name: "Hup Seng Trading",
  });
  const seller = await call("add_directory_entry", {
    in_project_id: projectId,
    in_module_key: "suppliers",
    in_name: "Seng Huat Hardware",
  });

  /* 先进一百包，再卖二十包出去。 */
  const po = await call("add_pipeline_record", {
    in_project_id: projectId,
    in_module_key: "purchases",
    in_title: "Cement order",
    in_party: seller.name,
    in_party_id: seller.id,
    in_amount_cents: 250000,
    in_idempotency_key: crypto.randomUUID(),
  });
  await call("set_record_lines", {
    in_record_id: po.id,
    in_lines: [
      { description: "Cement 50kg", qty: 100, unit: "bag", unit_price_cents: 2500 },
    ],
  });
  await call("receive_purchase", { in_record_id: po.id });

  const so = await call("add_pipeline_record", {
    in_project_id: projectId,
    in_module_key: "orders",
    in_title: "Site delivery",
    in_party: buyer.name,
    in_party_id: buyer.id,
    in_amount_cents: 60000,
    in_idempotency_key: crypto.randomUUID(),
  });
  await call("set_record_lines", {
    in_record_id: so.id,
    in_lines: [
      { description: "Cement 50kg", qty: 20, unit: "bag", unit_price_cents: 3000 },
    ],
  });
  await call("deliver_record", { in_record_id: so.id, in_lines: null });

  const onHand = async () => {
    const { data } = await api
      .from("stock_on_hand")
      .select("on_hand")
      .eq("item_id", item.id)
      .maybeSingle();
    return Number(data?.on_hand ?? 0);
  };
  const start = await onHand();
  console.log(`\n摆好了：进 100 包、卖出 20 包 —— 架上 ${start}\n`);
  if (start !== 80) throw new Error(`道具没摆好，架上应该是 80 —— ${start}`);

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

  const openRecord = async (key, id) => {
    await page.goto(`${BASE}/en/portal/${key}/${id}`, {
      waitUntil: "domcontentloaded",
      timeout: 240000,
    });
    await page.waitForTimeout(2500);
  };

  console.log("① 卖的那一张单：客人退五包回来");
  await openRecord("orders", so.id);
  ok("那一段在", (await page.locator("[data-returns-panel]").count()) > 0);
  ok(
    "还没退过的时候讲一句，不画一张空清单",
    /Nothing has come back|还没有退过/.test(
      await page.locator("[data-returns-panel]").innerText(),
    ),
  );
  await panelOf(page).getByRole("button", { name: /Record a return|记一笔退货/ }).click();
  await page.waitForTimeout(600);
  await page
    .locator('[data-returns-panel] input[aria-label^="How many"]')
    .first()
    .fill("5");
  await panelOf(page).getByLabel(/^Why$/).fill("Wrong size");
  await page.screenshot({
    path: ".screenshots/returns/1-filled.png",
    fullPage: true,
  });
  await panelOf(page).getByRole("button", { name: /Record it|记下去/ }).click();
  await page.waitForTimeout(3500);

  const afterSale = await onHand();
  ok("🔴 架上多回去五包 · 85", afterSale === 85, String(afterSale));
  const { data: rets } = await api
    .from("returns")
    .select("id, record_id, reason")
    .eq("project_id", projectId);
  ok("退货那一行真的写下去了", (rets ?? []).length === 1, `${(rets ?? []).length} 行`);
  ok("原因记下来了", (rets ?? [])[0]?.reason === "Wrong size", String((rets ?? [])[0]?.reason));
  const panel = await page.locator("[data-returns-panel]").innerText();
  ok("那一次出现在清单上", /Cement 50kg/.test(panel), panel.slice(0, 160));
  ok(
    "🔴 而且它讲得出刚刚发生了什么（几行回到架上）",
    /back on the shelf|回到架上/.test(panel),
    panel.slice(0, 200),
  );
  await page.screenshot({
    path: ".screenshots/returns/2-done.png",
    fullPage: true,
  });

  console.log("\n② 🔴 撤销不是删掉 —— 货再送出去一次");
  await panelOf(page).getByRole("button", { name: /Undo this one|撤销这一笔/ }).click();
  await page.waitForTimeout(3500);
  const afterUndo = await onHand();
  ok("架上回到 80", afterUndo === 80, String(afterUndo));

  console.log("\n③ 买的那一张单：退两包回给供应商");
  await openRecord("purchases", po.id);
  const buyPanel = await page.locator("[data-returns-panel]").innerText();
  ok("那一段在", (await page.locator("[data-returns-panel]").count()) > 0);
  ok(
    "🔴 讲的是「送回给供应商」，不是「回到架上」",
    /back to the supplier|送回给供应商/.test(buyPanel),
    buyPanel.slice(0, 200),
  );
  await panelOf(page).getByRole("button", { name: /Record a return|记一笔退货/ }).click();
  await page.waitForTimeout(600);
  await page
    .locator('[data-returns-panel] input[aria-label^="How many"]')
    .first()
    .fill("2");
  await panelOf(page).getByRole("button", { name: /Record it|记下去/ }).click();
  await page.waitForTimeout(3500);
  const afterBuy = await onHand();
  ok("🔴 架上少两包 · 78 —— 方向是那张单自己算的", afterBuy === 78, String(afterBuy));

  console.log("\n④ 什么都没填就按，它讲一句，不写一行");
  await openRecord("orders", so.id);
  await panelOf(page).getByRole("button", { name: /Record a return|记一笔退货/ }).click();
  await page.waitForTimeout(600);
  await panelOf(page).getByRole("button", { name: /Record it|记下去/ }).click();
  await page.waitForTimeout(1500);
  const said = await page.locator("[data-returns-panel]").innerText();
  ok(
    "讲了一句为什么按不下去",
    /Nothing to return yet|还没有填要退的东西/.test(said),
    said.slice(0, 200),
  );
  const { count: still } = await api
    .from("returns")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  ok("🔴 而且一行都没有多写", Number(still) === 1, String(still));

  console.log("\n⑤ 报价单那一页不画它（货一件都没有出去过）");
  const q = await call("add_pipeline_record", {
    in_project_id: projectId,
    in_module_key: "quotations",
    in_title: "Quote",
    in_party: buyer.name,
    in_party_id: buyer.id,
    in_amount_cents: 10000,
    in_idempotency_key: crypto.randomUUID(),
  });
  await openRecord("quotations", q.id);
  ok(
    "🔴 报价单上没有那一段",
    (await page.locator("[data-returns-panel]").count()) === 0,
  );

  console.log("\n⑥ 390 —— 判这一页的是他，而他在手机上");
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await context.storageState(),
  });
  const mp = await phone.newPage();
  await mp.goto(`${BASE}/en/portal/orders/${so.id}`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await mp.waitForTimeout(2500);
  ok("那一段在", (await mp.locator("[data-returns-panel]").count()) > 0);
  const wide = await mp.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  ok("390 上不横滚", !wide);
  await panelOf(mp).getByRole("button", { name: /Record a return|记一笔退货/ }).click();
  await mp.waitForTimeout(600);
  const wide2 = await mp.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  ok("🔴 摊开那几格之后照样不横滚", !wide2);
  await mp.screenshot({
    path: ".screenshots/returns/3-phone.png",
    fullPage: true,
  });
  await phone.close();
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass} 过 ${fail} 没过`);
console.log("→ .screenshots/returns/  ⚠️ 现在去用眼睛看那三张图");
process.exitCode = fail ? 1 : 0;
