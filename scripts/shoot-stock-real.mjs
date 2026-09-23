/**
 * 沙龙新设计的 Salon Stock——从示范假资料换成真的资料。真登入、真截图。
 *
 * ── 为什么（2026-09-24，Overview 之后第二页）───────────────────────────────
 *
 * 种两件真库存(一件健康、一件低于补货线)、一笔 30 天内的出货记录，
 * 真登入之后打开新设计那一页，验证真的数字取代了示范样品的 186 个 SKU。
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
const OUT = ".screenshots/stock-real";
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

let browser;
try {
  const stamp = Date.now();
  const email = `stk-${stamp}@formae.test`;
  const password = `Sk-${stamp}-x!`;
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

  await api.rpc("add_project_page", { requested_key: "inventory", new_title: "" });

  const healthy = await api.rpc("add_catalog_item", {
    in_project_id: pid, in_module_key: "inventory",
    in_name: "Stock-Test Shampoo 500ml", in_unit: "bottle", in_sku: "STK-SHP-500",
  });
  if (healthy.error) throw new Error(`healthy item: ${healthy.error.message}`);
  await admin.from("catalog_items").update({ reorder_at: 5, cost_cents: 2200 }).eq("id", healthy.data.id);
  await api.rpc("count_stock", { in_item_id: healthy.data.id, in_counted: 40, in_reason: "seed" });

  const low = await api.rpc("add_catalog_item", {
    in_project_id: pid, in_module_key: "inventory",
    in_name: "Stock-Test Bleach Tub", in_unit: "tub", in_sku: "STK-BLC-001",
  });
  if (low.error) throw new Error(`low item: ${low.error.message}`);
  await admin.from("catalog_items").update({ reorder_at: 3, cost_cents: 14200 }).eq("id", low.data.id);
  await api.rpc("count_stock", { in_item_id: low.data.id, in_counted: 1, in_reason: "seed" });
  // 一笔真的出货记录，测 30 天出货量。
  await api.rpc("count_stock", { in_item_id: low.data.id, in_counted: 6, in_reason: "restock for velocity test" });
  await api.rpc("count_stock", { in_item_id: low.data.id, in_counted: 1, in_reason: "used" });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/salon-preview/stock`, {
    waitUntil: "networkidle", timeout: 180000,
  });

  const body = await page.locator("body").innerText();

  if (!/186 SKUs|Bleach & Lighteners|Demi & Permanent Color/.test(body))
    ok("发明的 186 个 SKU、假的分类标签都不见了");
  else no("还留着示范样品的假分类/假数量");

  if (/Stock-Test Shampoo 500ml/.test(body) && /STK-SHP-500/.test(body))
    ok("🔴 真的健康库存那一件讲得出名字跟 SKU");
  else no("健康库存那一件不对");

  if (/40 bottle/.test(body)) ok("🔴 真的现有数量 40 bottle");
  else no("现有数量不对", body.match(/\d+ bottle/)?.[0]);

  if (/Stock-Test Bleach Tub/.test(body) && /STK-BLC-001/.test(body))
    ok("🔴 低库存那一件讲得出名字跟 SKU");
  else no("低库存那一件不对");

  // 序列 0→1→6→1：现有 1，低于补货线 3 但还没到 0，所以是 "Low" 不是
  // "Deficit"（Deficit 只留给真的见底），跟组件自己的三段判断一致。
  // 标签的字是 "Low"，CSS uppercase 让它显示成 "LOW" —— innerText() 读的是
  // 渲染后的样子，不是原始字串，所以这里要配大写。
  if (/\bLOW\b/.test(body)) ok("🔴 低库存那一件真的标成 LOW（1 <= reorder 3，但还没到 0）");
  else no("LOW 标签没有出现");

  if (/RM\s*142\.00/.test(body)) ok("🔴 成本真的读到 RM 142.00");
  else no("成本不对");

  // 最后一次盘点是 6→1，那一笔 5 件的 out 移动落在 30 天窗口内。
  if (/5 tub/.test(body)) ok("🔴 30 天出货量真的算出来是 5 tub（6→1 那次盘点产生的 out 移动）");
  else no("velocity 不对", body.match(/\d+ tub\b/g)?.join(" | "));

  await page.screenshot({ path: `${OUT}/1-real-data.png`, fullPage: true });

  // 真的搜索——过滤到只剩健康那一件。
  await page.getByPlaceholder("Search SKU, name, or location...").fill("Shampoo");
  await page.waitForTimeout(400);
  const afterSearch = await page.locator("body").innerText();
  if (/Stock-Test Shampoo 500ml/.test(afterSearch) && !/Stock-Test Bleach Tub/.test(afterSearch))
    ok("🔴 搜索是真的在过滤，不是装饰");
  else no("搜索没有真的过滤");
  await page.screenshot({ path: `${OUT}/2-searched.png`, fullPage: true });

  // 右边的 Draft PO 面板还留着、还能真的加减。
  const qtyBefore = await page.locator("text=4 tubs").isVisible().catch(() => false);
  await page.getByRole("button", { name: "+" }).first().click();
  await page.waitForTimeout(200);
  const nowFiveVisible = await page.locator("text=5 tubs").isVisible().catch(() => false);
  if (qtyBefore && nowFiveVisible) ok("🔴 右边 Draft PO 面板的 + 按钮还是真的能加");
  else no("Draft PO 面板的按钮坏了", `before=${qtyBefore} after=${nowFiveVisible}`);

} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那张图`);
