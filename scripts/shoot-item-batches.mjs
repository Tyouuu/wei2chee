/**
 * 一件货自己的批号，长在它自己那一页上 —— 真登入，真按，真截图。
 *
 * ── 为什么（2026-09-12，[任务 397]）──────────────────────────────────────
 *
 * 客户那一页早就把疗程、储值卡、欠款全部收在一起（EspoCRM 那条参考）。
 * 库存那一边少了同一件事——一件货自己有几批、哪一批先过期，
 * 今天只在「效期」那张全店清单上看得到，点进这一件货自己那一页
 * （`/portal/inventory/<id>`）什么都没有。这一支验证的是新加的那一段
 * （`item-batches.tsx`），不是效期那一页本身（那一页已经有 shoot-shelf.mjs 在盖）。
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
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
const OUT = ".screenshots/item-batches";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
dropThrowawayOnExit(admin, () => userId);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };

const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

let browser;
try {
  const stamp = Date.now();
  const email = `itembatch-${stamp}@formae.test`;
  const password = `Ib-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;

  const { error: pgErr } = await api.rpc("add_project_page", {
    requested_key: "inventory",
    new_title: "",
  });
  if (pgErr && !/already/i.test(pgErr.message)) no("台面：库存那一页开不了", pgErr.message);

  const { data: item, error: iErr } = await api.rpc("add_catalog_item", {
    in_project_id: pid,
    in_module_key: "inventory",
    in_name: "Panadol 500mg",
    in_unit: "box",
  });
  if (iErr) throw new Error(`add item: ${iErr.message}`);
  const itemId = item?.id ?? item;

  /* 第二件货，故意没有批号 —— 用来验证「没有批号就整段不画」。 */
  const { data: item2, error: i2Err } = await api.rpc("add_catalog_item", {
    in_project_id: pid,
    in_module_key: "inventory",
    in_name: "Cement 50kg",
    in_unit: "bag",
  });
  if (i2Err) throw new Error(`add item2: ${i2Err.message}`);
  const item2Id = item2?.id ?? item2;

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: "reduce" });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  // ── ① 没有批号的货 —— 整段不画 ──────────────────────────────────────────
  await page.goto(`${BASE}/en/portal/inventory/${item2Id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2200);
  let body = await page.locator("body").innerText();
  if (!/Batches of this item/i.test(body)) ok("没有批号的货，这一段整个不画");
  else no("没有批号照样画了这一段", body.slice(0, 200));
  await page.screenshot({ path: `${OUT}/1-no-batches.png`, fullPage: true });

  // ── ② 加两批，一批过期、一批没过期 ───────────────────────────────────────
  const { data: b1, error: b1Err } = await api.rpc("add_stock_batch", {
    in_item_id: itemId,
    in_code: "B240915",
    in_expiry_on: day(20),
    in_unit_cost_cents: 850,
  });
  if (b1Err) throw new Error(`add batch1: ${b1Err.message}`);
  const { data: b2, error: b2Err } = await api.rpc("add_stock_batch", {
    in_item_id: itemId,
    in_code: "B230101",
    in_expiry_on: day(-30),
    in_unit_cost_cents: 800,
  });
  if (b2Err) throw new Error(`add batch2: ${b2Err.message}`);

  const { error: mv1 } = await api.rpc("move_stock", {
    in_item_id: itemId, in_direction: "in", in_qty: 12, in_reason: "opening", in_batch_id: b1.id,
  });
  if (mv1) no("台面：进不了第一批的货", mv1.message);
  const { error: mv2 } = await api.rpc("move_stock", {
    in_item_id: itemId, in_direction: "in", in_qty: 3, in_reason: "opening", in_batch_id: b2.id,
  });
  if (mv2) no("台面：进不了第二批的货", mv2.message);

  await page.goto(`${BASE}/en/portal/inventory/${itemId}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2600);
  body = await page.locator("body").innerText();
  if (/Batches of this item/i.test(body)) ok("有批号的货，这一段画出来了");
  else no("有批号却没画出来", body.slice(0, 240));
  if (/B240915/.test(body) && /B230101/.test(body)) ok("两批的批号都在");
  else no("批号没有全部出现", body.slice(0, 300));
  if (/Expired/i.test(body)) ok("🔴 过期的那一批讲得出「已过期」");
  else no("🔴 没有讲哪一批过期", body.slice(0, 300));
  if (/Cost/i.test(body)) ok("老板身分：进价印出来了");
  else no("老板身分没看到进价", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/2-two-batches.png`, fullPage: true });

  /* 🔴 宽屏两栏——那张纸不该塞在窄窄一条 560px 里。 */
  const mainWidth = await page.locator("main").first().evaluate((el) => el.getBoundingClientRect().width);
  if (mainWidth > 900) ok(`🔴 宽屏用的是两栏版面 · ${Math.round(mainWidth)}px`);
  else no("🔴 宽屏还是窄的一栏", String(mainWidth));

  /* ⚠️ 进价对看不到钱的人是不是 null —— `check:batches` 已经在打资料库
     那一层验过 `sees_money`（`batches_of` 自己的判断）。这一支只补
     眼睛看的那一半：老板身分打开这一页，进价真的印出来了（上面那一条）。 */

} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
