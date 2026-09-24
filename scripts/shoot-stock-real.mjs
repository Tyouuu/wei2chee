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
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));
async function must(label, p) {
  const r = await p;
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}
async function until(fn, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

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
  const afterSearch = await page.locator("table").innerText();
  if (/Stock-Test Shampoo 500ml/.test(afterSearch) && !/Stock-Test Bleach Tub/.test(afterSearch))
    ok("🔴 搜索是真的在过滤，不是装饰");
  else no("搜索没有真的过滤");
  await page.screenshot({ path: `${OUT}/2-searched.png`, fullPage: true });

  // ═══ 任务 415：右边那一整块是真的进货单 + 真的到货 ══════════════════════════
  const suppliersOf = async () => must("suppliers", Promise.resolve(admin.from("directory_entries").select("id, name, whatsapp").eq("project_id", pid).eq("module_key", "suppliers")));
  const posOf = async () => must("pos", Promise.resolve(admin.from("pipeline_records").select("id, doc_no, party, party_id, amount_cents, stage").eq("project_id", pid).eq("module_key", "purchases").order("created_at")));
  const linesOf = async (rid) => must("lines", Promise.resolve(admin.from("record_lines").select("id, qty, unit_price_cents, item_id, description").eq("record_id", rid)));
  const onHand = async (itemId) => Number((await must("hand", Promise.resolve(admin.from("stock_on_hand").select("on_hand").eq("item_id", itemId)))).at(0)?.on_hand ?? 0);
  const panelText = async () => page.locator("aside", { hasText: "Quick Purchase Order" }).innerText();
  const alerts = [];
  page.on("dialog", (d) => { alerts.push(d.message()); d.dismiss().catch(() => {}); });

  await page.getByPlaceholder("Search SKU, name, or location...").fill("");
  await page.goto(`${BASE}/en/salon-preview/stock`, { waitUntil: "networkidle", timeout: 180000 });
  let side = await panelText();

  console.log("\n① 假的不见了，真的从「快没了的货」开始");
  check("🔴 设计自带的假资料全部不见（Blond Studio · PO #2024-108 · L'Oréal · 94.2%）", !/Blond Studio|2024-108|L'Or|Milbon|94\.2/.test(await page.locator("body").innerText()));
  check("🔴 草稿里只有真的快没了那一件（Bleach Tub 库存 1 ≤ 补货线 3），健康的洗发水没有被塞进来", (await page.getByTestId("po-line").count()) === 1 && /Stock-Test Bleach Tub/.test(await page.getByTestId("po-line").innerText()), await page.getByTestId("po-line").allInnerTexts().then((a) => a.join("|")));
  check("🔴 数量预填一次补货线的量（3），价钱预填他记的成本（RM 426.00 = 3 × 142）", (await page.getByTestId("po-qty").innerText()) === "3" && /RM\s*426\.00/.test(await page.getByTestId("po-total").innerText()));
  check("🔴 还没有任何供应商：直接摆出「新供应商」两格，而且 WhatsApp 那颗按钮是灰的，旁边讲为什么", (await page.getByLabel("New supplier name").count()) === 1 && (await page.getByRole("button", { name: /Send WhatsApp PO to Supplier/ }).isDisabled()) && (await page.getByTestId("po-no-whatsapp").count()) === 1);
  check("🔴 「Above reorder level」是真的算出来的：两件有补货线的里 1 件在线上（1 of 2 · 50%）", /1 of 2\s*·\s*50%/.test(await page.getByTestId("po-par").innerText()));
  check("路上没有货：写「Nothing is on the way.」", /Nothing is on the way/.test(side));
  await page.screenshot({ path: `${OUT}/3-purchase-panel.png`, fullPage: true });

  console.log("\n② 存一张进货单（新供应商、不发 WhatsApp）");
  await page.getByLabel("New supplier name").fill("Stock-Test Supplier");
  await page.getByRole("button", { name: /Save Purchase Order/ }).dblclick();
  await until(async () => (await posOf()).length >= 1);
  await page.waitForTimeout(1500);
  const po1s = await posOf();
  check("🔴 连按两下「Save Purchase Order」只开一张单（防重复）", po1s.length === 1, String(po1s.length));
  const sups = await suppliersOf();
  const sup1 = sups.find((s) => s.name === "Stock-Test Supplier");
  const po1 = po1s[0];
  const l1 = await linesOf(po1.id);
  check("🔴 真的进了资料库：供应商存在 · 单挂在他身上 · 单号 PO- 开头 · 第一格阶段 Ordered", !!sup1 && po1.party_id === sup1.id && /^PO-/.test(po1.doc_no) && po1.stage === "Ordered", JSON.stringify(po1));
  check("🔴 明细：Bleach Tub ×3，单价 RM 142.00（成本，不是卖价），总额 RM 426.00", l1.length === 1 && Number(l1[0].qty) === 3 && Number(l1[0].unit_price_cents) === 14200 && l1[0].item_id === low.data.id && Number(po1.amount_cents) === 42600, JSON.stringify(l1));
  await until(async () => (await page.getByTestId("po-open").count()) === 1);
  side = await panelText();
  check("🔴 「Delivery Inbound」多了这一张：供应商 · 单号 · 1 line · RM 426.00 · Ordered today", (await page.getByTestId("po-open").count()) === 1 && /Stock-Test Supplier/.test(side) && side.includes(po1.doc_no) && /1 line/.test(side) && /RM\s*426\.00/.test(side) && /Ordered today/.test(side));
  check("🔴 刚订过的货不再被建议第二次（草稿变空：Nothing is running low）", (await page.getByTestId("po-empty").count()) === 1);
  check("🔴 左边那张表里 Bleach Tub 多了一个「On order」标签", /On order/i.test(await page.locator("table").innerText()));
  await page.screenshot({ path: `${OUT}/4-after-save.png`, fullPage: true });

  console.log("\n③ 没有价钱的货：要先问一次");
  const towel = await api.rpc("add_catalog_item", { in_project_id: pid, in_module_key: "inventory", in_name: "Stock-Test Towel", in_unit: "pc", in_sku: "STK-TWL-1" });
  if (towel.error) throw new Error(`towel: ${towel.error.message}`);
  await page.goto(`${BASE}/en/salon-preview/stock`, { waitUntil: "networkidle", timeout: 180000 });
  check("加货的下拉里，Bleach Tub 写着「already on order」", (await page.getByLabel("Add an item").locator("option", { hasText: "Bleach Tub (already on order)" }).count()) === 1);
  await page.getByLabel("Add an item").selectOption(towel.data.id);
  check("🔴 加进来的毛巾没有成本：价钱那一格是空的（不是偷用卖价）", (await page.getByLabel("Price of Stock-Test Towel").inputValue()) === "");
  await page.getByRole("button", { name: /Save Purchase Order/ }).click();
  check("🔴 没价钱就存：讲一句人话「毛巾一件多少钱」，一张单都没多", /What does Stock-Test Towel cost/.test(await page.getByTestId("po-error").innerText()) && (await posOf()).length === 1);
  await page.getByLabel("Price of Stock-Test Towel").fill("abc");
  await page.getByRole("button", { name: /Save Purchase Order/ }).click();
  check("🔴 价钱乱打（abc）也挡下来", /What does Stock-Test Towel cost/.test(await page.getByTestId("po-error").innerText()));
  await page.getByLabel("Price of Stock-Test Towel").fill("8.50");
  await page.getByRole("button", { name: "More Stock-Test Towel" }).click();
  await page.getByRole("button", { name: "More Stock-Test Towel" }).click();
  check("加两下：数量 3，总额 RM 25.50", (await page.getByTestId("po-qty").innerText()) === "3" && /RM\s*25\.50/.test(await page.getByTestId("po-total").innerText()));
  await page.getByRole("button", { name: "Remove Stock-Test Towel" }).click();
  check("× 把这一行拿掉，草稿又空了", (await page.getByTestId("po-line").count()) === 0);
  await page.getByLabel("Add an item").selectOption(towel.data.id);
  check("拿掉的可以再加回来", (await page.getByTestId("po-line").count()) === 1);

  console.log("\n④ 有 WhatsApp 号码的供应商：真的打开一则写好的讯息");
  const waSup = await api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "suppliers", in_name: "Stock-Test WA Supplier", in_whatsapp: "012-345 6789" });
  if (waSup.error) throw new Error(`waSup: ${waSup.error.message}`);
  await page.goto(`${BASE}/en/salon-preview/stock`, { waitUntil: "networkidle", timeout: 180000 });
  check("🔴 下拉里有两位供应商；默认是上一张单的那位（没有 WhatsApp）→ 按钮灰的", (await page.getByLabel("Supplier").locator("option").count()) >= 3 && (await page.getByRole("button", { name: /Send WhatsApp PO to Supplier/ }).isDisabled()));
  await page.getByLabel("Supplier").selectOption(waSup.data.id);
  await page.getByLabel("Add an item").selectOption(towel.data.id);
  await page.getByLabel("Price of Stock-Test Towel").fill("8.50");
  await page.getByRole("button", { name: "More Stock-Test Towel" }).click();
  await page.getByRole("button", { name: "More Stock-Test Towel" }).click();
  check("🔴 换成有号码的供应商：按钮亮了", await page.getByRole("button", { name: /Send WhatsApp PO to Supplier/ }).isEnabled());
  await page.context().route("https://wa.me/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<html>wa</html>" }));
  const popupPromise = page.context().waitForEvent("page", { timeout: 30000 });
  await page.getByRole("button", { name: /Send WhatsApp PO to Supplier/ }).click();
  const popup = await popupPromise;
  const waUrl = popup.url();
  await popup.close().catch(() => {});
  const waText = decodeURIComponent(waUrl.split("?text=")[1] ?? "");
  const po2s = await posOf();
  const po2 = po2s.find((p) => p.party_id === waSup.data.id);
  check("🔴 真的开了一个 wa.me 窗口，号码是 60123456789（本地写法 012-345 6789 已经补国码）", /^https:\/\/wa\.me\/60123456789\?text=/.test(waUrl), waUrl);
  check("🔴 讯息已经写好：单号 · 品名 · 数量 · 单价 · 总额（RM 25.50）· 商家名字", !!po2 && waText.includes(po2.doc_no) && /3 x Stock-Test Towel/.test(waText) && /RM 8\.50/.test(waText) && /Total RM 25\.50/.test(waText) && /Company/.test(waText), waText);
  check("🔴 同一时间进了资料库：第二张单 · 三条毛巾 · 单价 RM 8.50 · 总额 RM 25.50", po2s.length === 2 && !!po2 && Number(po2.amount_cents) === 2550 && (await linesOf(po2.id))[0].item_id === towel.data.id);
  await until(async () => (await page.getByTestId("po-saved").count()) === 1);
  check("存完那一条写着单号，还留一个「Open the WhatsApp message」的连结（浏览器拦了弹窗也点得开）", (await page.getByTestId("po-saved").getByRole("link").count()) === 1);
  await until(async () => (await page.getByTestId("po-open").count()) === 2);
  await page.screenshot({ path: `${OUT}/5-two-open-orders.png`, fullPage: true });

  console.log("\n⑤ 到货：分两次收，架上的数字真的跟着走");
  const before = await onHand(low.data.id);
  const card1 = page.getByTestId("po-open").filter({ hasText: "Stock-Test Supplier" }).filter({ hasNotText: "WA" });
  await card1.getByRole("button", { name: "Receive" }).click();
  check("🔴 点 Receive：每一行一个「到了几个」，默认就是订的量（3）", (await card1.getByLabel("Arrived Stock-Test Bleach Tub").inputValue()) === "3");
  await card1.getByLabel("Arrived Stock-Test Bleach Tub").fill("0");
  await card1.getByRole("button", { name: "Confirm Receipt" }).click();
  check("🔴 全填 0 就确认：讲一句人话，架上一点都没动", /Enter how many/.test(await card1.getByTestId("po-receive-error").innerText()) && (await onHand(low.data.id)) === before);
  await card1.getByLabel("Arrived Stock-Test Bleach Tub").fill("2");
  await page.screenshot({ path: `${OUT}/6-receiving.png`, fullPage: true });
  await card1.getByRole("button", { name: "Confirm Receipt" }).click();
  await until(async () => (await onHand(low.data.id)) === before + 2);
  check("🔴 只到了 2 个：架上 1 → 3，不是 4", (await onHand(low.data.id)) === before + 2, String(await onHand(low.data.id)));
  await until(async () => /still short/.test(await page.getByTestId("po-flash").innerText().catch(() => "")));
  check("🔴 面板讲「1 line added to stock · 1 still short」", /1 line added to stock · 1 still short/.test(await page.getByTestId("po-flash").innerText()), await page.getByTestId("po-flash").innerText().catch(() => ""));
  const po1After = (await posOf()).find((p) => p.id === po1.id);
  check("🔴 还差一个：这张单还是 Ordered，没有被当成收完", po1After.stage === "Ordered", po1After.stage);
  const moves = await must("moves", Promise.resolve(admin.from("stock_moves").select("qty, direction, cost_cents, against_id").eq("against_id", po1.id)));
  check("🔴 库存流水记的成本是订单上的单价（RM 142.00），不是别的", moves.length === 1 && moves[0].direction === "in" && Number(moves[0].cost_cents) === 14200, JSON.stringify(moves));
  await until(async () => (await page.getByTestId("po-open").filter({ hasText: "Stock-Test Supplier" }).filter({ hasNotText: "WA" }).count()) === 1);
  // 那一条只数卡片有几张，而卡片本来就还在——它一开始就成立。要等的是服务器把新数字送回来
  // （router.refresh() 落地：架上那一行变成 3 tub），不然点到的是还写着「ordered 3」的旧卡，
  // 再点确认就照旧卡的默认 3 个收了。人不会在 100 毫秒内点第二下，这一条只是让尺子别抢跑。
  await until(async () => /3 tub/.test(await page.locator("tr", { hasText: "Stock-Test Bleach Tub" }).innerText().catch(() => "")));
  const card1b = page.getByTestId("po-open").filter({ hasText: "Stock-Test Supplier" }).filter({ hasNotText: "WA" });
  await card1b.getByRole("button", { name: "Receive" }).click();
  check("🔴 再点 Receive：默认只剩没到的那 1 个，并写着「2 in already」", (await card1b.getByLabel("Arrived Stock-Test Bleach Tub").inputValue()) === "1" && /2 in already/.test(await card1b.innerText()));
  await card1b.getByRole("button", { name: "Confirm Receipt" }).click();
  await until(async () => (await onHand(low.data.id)) === before + 3);
  check("🔴 收齐：架上 1 → 4", (await onHand(low.data.id)) === before + 3);
  await until(async () => (await posOf()).find((p) => p.id === po1.id)?.stage === "Received");
  check("🔴 这张单自己变成 Received", (await posOf()).find((p) => p.id === po1.id)?.stage === "Received");
  await until(async () => (await page.getByTestId("po-open").count()) === 1);
  check("🔴 「Delivery Inbound」只剩没到的那一张（毛巾）", (await page.getByTestId("po-open").count()) === 1 && /Stock-Test WA Supplier/.test(await panelText()));
  const bleachRow = await page.locator("tr", { hasText: "Stock-Test Bleach Tub" }).innerText();
  const towelRow = await page.locator("tr", { hasText: "Stock-Test Towel" }).innerText();
  check("🔴 Bleach Tub 收齐了：「On order」标签不见，数字变成 4 tub；毛巾那张还在路上，标签还在", !/On order/i.test(bleachRow) && /4 tub/.test(bleachRow) && /On order/i.test(towelRow), bleachRow + " || " + towelRow);
  check("🔴 「Above reorder level」跟着变：2 of 2 · 100%", /2 of 2\s*·\s*100%/.test(await page.getByTestId("po-par").innerText()));
  await page.screenshot({ path: `${OUT}/7-after-receipt.png`, fullPage: true });
  check("🔴 整个过程一个 alert() 都没弹", alerts.length === 0, alerts.join(" | "));

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
