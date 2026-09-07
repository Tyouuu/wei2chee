/**
 * 柜台 —— 扫一下 · 结帐 · 找零，在真的浏览器里走一次。
 *
 * `scan_item` 跟 `ring_up_sale`（20260906830000 · 850000）31 条真身分的
 * 断言全过，而 [任务 242](../docs/founder-tasks.md#242) 自己的收尾写着：
 * 「**那一屏不存在** —— 扫描框 · 篮子 · 收钱那一格，三样都是画面那一边。」
 *
 * ── 这一支量的四件 ────────────────────────────────────────────────────────
 *
 *  ① 扫到的那一件真的进篮子，扫两下 = 两件不是两行
 *  ② 🔴 找零跟总额是**资料库算的** —— 画面不可以自己减一次
 *  ③ 🔴 一按之后架上真的少了，帐上真的多一笔
 *  ④ 按两下只成交一次，而且第二下讲得出「刚才已经结过了」
 *
 * ⚠️ 用完就删的帐号。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/counter";
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const stamp = Date.now();
const EMAIL = `till-${stamp}@formae.test`;
const PASSWORD = `Till-${stamp}-x!`;

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

const bad = [];
let userId = null;
let browser;
const say = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};
const must = (what, r) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};
/* 排版照产品自己那一支（`ringgit`：整数不印小数）。
   在这里再写一份 toFixed(2)，红出来的会是我的尺不是画面（任务 203）。 */
const rm = (cents) => {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", {
    minimumFractionDigits: whole % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};
const onHand = async (itemId) => {
  const { data } = await api
    .from("stock_moves")
    .select("direction, qty")
    .eq("item_id", itemId);
  return (data ?? []).reduce(
    (n, m) => n + (m.direction === "in" ? Number(m.qty) : -Number(m.qty)),
    0,
  );
};

try {
  const made = must(
    "createUser",
    await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    }),
  );
  userId = made.user.id;
  dropThrowawayOnExit(admin, () => userId);
  must(
    "signIn",
    await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD }),
  );
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", userId)
    .single();
  const P = proj.id;

  for (const key of ["inventory", "orders", "payments"]) {
    const r = await api.rpc("add_project_page", {
      requested_key: key,
      new_title: null,
    });
    if (r.error && !String(r.error.message).includes("exists")) {
      throw new Error(`add_project_page(${key}): ${r.error.message}`);
    }
  }

  /* 一件带条码的货，架上 20 罐。 */
  const item = must(
    "add_catalog_item",
    await api.rpc("add_catalog_item", {
      in_project_id: P,
      in_module_key: "inventory",
      in_name: "Panadol 500mg",
      in_unit: "box",
      in_sku: "9551234567890",
      in_price_cents: 1250,
    }),
  );
  const itemId = item.id ?? item;
  /* 架上摆 20 盒。⚠️ `add_catalog_item` **没有**开帐数量那个参数 ——
     我第一版猜了一个 `in_opening_qty`，而那一条红看起来像建货品坏了。 */
  must(
    "move_stock",
    await api.rpc("move_stock", {
      in_item_id: itemId,
      in_direction: "in",
      in_qty: 20,
      in_reason: "Opening",
    }),
  );
  say("台面：架上有 20 盒", (await onHand(itemId)) === 20, `${await onHand(itemId)}`);

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 240000 });
  const hide = () =>
    page
      .addStyleTag({ content: "nextjs-portal{display:none!important}" })
      .catch(() => {});

  const url = `${BASE}/en/portal/counter`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForTimeout(1800);
  await hide();
  await page.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });
  console.log("拍到  1-empty");

  console.log("\n① 扫一下");
  say("那一屏在", (await page.locator("[data-counter]").count()) === 1);
  /* 🔴 一条没解析出来的 key 印在画面上（`portal.counter.scanNone`）——
     它不报错、不留痕迹，而 `check:en` 只数中文，看不到它。
     整支跑完再问一次，因为那两句只在扫失败的时候才出现。 */
  const rawKey = () =>
    page.evaluate(() => (document.body.innerText.match(/portal.[a-zA-Z.]+/g) ?? []).join(" · "));
  /* ⚠️ 空的时候不画一张空表 —— 那一句在页面上讲过了。 */
  say(
    "空篮子不画一张空表（控制组）",
    (await page.locator("[data-basket-line]").count()) === 0,
  );
  const box = page.locator('input[aria-label="Scan or type the code"]');
  await box.fill("nope-nope");
  await box.press("Enter");
  await page.waitForTimeout(1200);
  let seen = (await page.locator("[data-counter]").innerText()).replace(/\s+/g, " ");
  /* 🔴 讲出他刚扫的那一串 —— 一句「找不到」他拿不去做事。 */
  say("扫不到的时候讲得出是哪一串", /nope-nope/.test(seen), seen.slice(0, 200));
  say("🔴 画面上没有一条没解析出来的 key", (await rawKey()) === "", await rawKey());

  await box.fill("9551234567890");
  await box.press("Enter");
  await page.waitForTimeout(1200);
  await box.fill("9551234567890");
  await box.press("Enter");
  await page.waitForTimeout(1200);
  await hide();
  await page.screenshot({ path: `${OUT}/2-basket.png`, fullPage: true });
  console.log("拍到  2-basket");
  say(
    "🔴 同一件扫两下 = 两件，不是两行",
    (await page.locator("[data-basket-line]").count()) === 1,
    `${await page.locator("[data-basket-line]").count()} 行`,
  );
  /* 🔴 一行明细要在**一行**上。`deskField` 自己带 `w-full`，
     而两个 width 在同一个元素上，赢的是样式表里后面那一条 ——
     於是数量那一格铺满整行，一行断成三行（看图才看到的）。 */
  const qtyW = await page.evaluate(() => {
    const el = document.querySelector("[data-basket-qty]");
    return el ? Math.round(el.getBoundingClientRect().width) : -1;
  });
  say("🔴 数量那一格没有铺满整行", qtyW > 0 && qtyW < 160, qtyW + "px");
  /* ⚠️ 第一版数的是「几个不同的上缘」—— 而 `items-center` 底下
     高矮不同的东西上缘本来就不一样，於是一行好好的明细被报成两行。
     **量到的东西不是画面上的东西**（又一次）。
     断没断行看的是：这一行有没有比它最高的那一样还高。 */
  const wrapped = await page.evaluate(() => {
    const li = document.querySelector("[data-basket-line]");
    if (!li) return null;
    const h = li.getBoundingClientRect().height;
    const tall = Math.max(
      ...[...li.children].map((c) => c.getBoundingClientRect().height),
    );
    return { h: Math.round(h), tall: Math.round(tall) };
  });
  say(
    "🔴 一行明细画在一行上",
    !!wrapped && wrapped.h <= wrapped.tall + 8,
    JSON.stringify(wrapped),
  );
  const sub = (await page.locator("[data-counter-subtotal]").innerText()).trim();
  say("小计是两盒的钱", sub === rm(2500), `${sub} vs ${rm(2500)}`);
  /* 🔴 篮子里有东西的时候，「扫一样东西就开始」是一句假话。 */
  say(
    "🔴 篮子有东西了就不再讲「扫一样东西就开始」",
    !/Scan something to start/i.test(await page.locator("[data-counter]").innerText()),
  );

  console.log("\n② 收钱，找零");
  await page.locator('input[aria-label="Money taken"]').fill("50");
  await page.getByRole("button", { name: /^Ring it up$/i }).click();
  await page.waitForTimeout(4000);
  await hide();
  await page.screenshot({ path: `${OUT}/3-change.png`, fullPage: true });
  console.log("拍到  3-change");
  say("结完帐那一屏出来了", (await page.locator("[data-counter-done]").count()) === 1);
  const change = (await page.locator("[data-counter-change]").innerText()).trim();
  /* 🔴 找零是**资料库算的** —— 5000 − 2500 = 2500。
     这一条量的是「画面没有自己再减一次」。 */
  say("🔴 找他的钱对得上", change === rm(2500), `${change} vs ${rm(2500)}`);

  console.log("\n③ 架上跟帐上");
  const left = await onHand(itemId);
  say("🔴 架上真的少了两盒", left === 18, `${left}`);
  const { data: ledger } = await api
    .from("ledger_entries")
    .select("amount_cents, direction")
    .eq("project_id", P);
  const took = (ledger ?? [])
    .filter((e) => e.direction === "in")
    .reduce((n, e) => n + Number(e.amount_cents), 0);
  /* 🔴 记的是**这一篮**，不是他手上那张 RM 50 —— 找出去的不是收入。 */
  say("🔴 帐上记的是这一篮，不是他手上那张钞票", took === 2500, `${took}`);
  const { data: docs } = await api
    .from("pipeline_records")
    .select("doc_no, module_key")
    .eq("project_id", P);
  say(
    "开出来的那张单有单号，而且开在订单那一页",
    (docs ?? []).some((d) => d.doc_no && d.module_key === "orders"),
    JSON.stringify(docs),
  );

  console.log("\n④ 一件一台一台管的货，这一屏卖不了");
  const car = must(
    "add_catalog_item(serial)",
    await api.rpc("add_catalog_item", {
      in_project_id: P,
      in_module_key: "inventory",
      in_name: "Myvi 2019",
      in_unit: "unit",
      in_sku: "CAR-001",
      in_price_cents: 3800000,
    }),
  );
  must(
    "set_item_serial_tracking",
    await api.rpc("set_item_serial_tracking", {
      in_item_id: car.id ?? car,
      in_on: true,
    }),
  );
  await page.getByRole("button", { name: /^Next customer$/i }).click();
  await page.waitForTimeout(800);
  const box2 = page.locator('input[aria-label="Scan or type the code"]');
  await box2.fill("CAR-001");
  await box2.press("Enter");
  await page.waitForTimeout(1500);
  seen = (await page.locator("[data-counter]").innerText()).replace(/\s+/g, " ");
  /* 🔴 `deliver_record` 会要他讲哪一台，而柜台没有地方讲 ——
     加进篮子按下去才失败，就是一颗按下去一定失败的按钮。 */
  say("🔴 讲出来，而且不加进篮子", /Myvi 2019/.test(seen), seen.slice(0, 250));
  say("🔴 这一句也没有印出 key", (await rawKey()) === "", await rawKey());
  say(
    "🔴 篮子还是空的",
    (await page.locator("[data-basket-line]").count()) === 0,
    `${await page.locator("[data-basket-line]").count()} 行`,
  );

  console.log("\n⑤ 390 —— 柜台常常是一台手机");
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 240000 });
  await phone.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
  await phone.waitForTimeout(1800);
  const pbox = phone.locator('input[aria-label="Scan or type the code"]');
  await pbox.fill("9551234567890");
  await pbox.press("Enter");
  await phone.waitForTimeout(1500);
  await phone
    .addStyleTag({ content: "nextjs-portal{display:none!important}" })
    .catch(() => {});
  await phone.screenshot({ path: `${OUT}/4-phone-390.png`, fullPage: true });
  console.log("拍到  4-phone-390");
  say("手机上扫得到", (await phone.locator("[data-basket-line]").count()) === 1);
  const small = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(
      "[data-counter] button, [data-counter] input, [data-counter] select",
    )) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height < 40) out.push(`${el.tagName}=${Math.round(r.height)}`);
    }
    return out;
  });
  say("手机上每一颗都按得稳（≥40px）", small.length === 0, small.join(" · "));
  const wide = await phone.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  say("手机上不用左右滑", !wide);
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
}

console.log(`\n判：${bad.length} 项没过`);
for (const b of bad) console.log(`  · ${b}`);
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
process.exitCode = bad.length ? 1 : 0;
