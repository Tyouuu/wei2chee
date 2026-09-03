/**
 * 盘点 —— 真的数一次，用眼睛看。
 *
 * 重点 7l。210 条真的呼叫全过，而那些是打 RPC；
 * 那一格在画面上长什么样、按下去之前有没有先讲会发生什么、
 * 站在架子前面那支手机上按不按得到 —— 那些答不了。
 *
 * ⚠️ 跑完把那个货品跟它的流水删掉。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/stocktake";
mkdirSync(OUT, { recursive: true });

/* 🔴 **不用他的 demo 帐号。** 那个 demo 是一家装修公司，
   而装修公司**没有库存那一页** —— 那是对的，不是缺陷。
   第一版拿它来拍，然后正确地拍不到。

   替它开一个用完就删的帐号，而且**帮它开一页库存**。
   在他的 demo 上加一页库存，是为了拍一张图去改他的示范系统。 */
const stamp = Date.now();
const EMAIL = `stock-${stamp}@formae.test`;
const PASSWORD = `Stock-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
let userId = null;

const shots = [];
let itemId = null;

let browser;
try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;

  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");

  const { error: pageErr } = await api.rpc("add_project_page", {
    requested_key: "inventory", new_title: "Stock",
  });
  if (pageErr) throw new Error(`inventory page: ${pageErr.message}`);

  const { data: item, error: itemErr } = await api.rpc("add_catalog_item", {
    in_project_id: proj.id, in_module_key: "inventory",
    in_name: "Cement 50kg", in_unit: "bags",
  });
  if (itemErr) throw new Error(`item: ${itemErr.message}`);
  itemId = item.id;
  await api.rpc("move_stock", {
    in_item_id: itemId, in_direction: "in", in_qty: 91, in_reason: "Opening",
  });

  browser = await chromium.launch();
  const say = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
    if (!ok) shots.push({ name, stuck: true });
  };

  const url = `/en/portal/inventory/${itemId}`;
  for (const [w, h, tag] of [[1440, 1100, "1-wide"], [390, 844, "3-phone-390"]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/portal/, { timeout: 180000 });
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    const stuck = /log in|sign in/i.test(h1) || /something broke|does not exist/i.test(h1);
    shots.push({ name: tag, stuck });
    await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    console.log(`${stuck ? "🔴 卡住" : "拍到"}  ${tag} · h1「${h1}」`);

    if (tag === "1-wide") {
      const body = await page.locator("main").innerText();
      say("盘点那一格在画面上", /Stocktake/i.test(body), body.replace(/\s+/g, " ").slice(0, 300));

      /* 🔴 按下去之前要先讲会发生什么 —— 他多打了一个零，
         这一行是他唯一发现得了的地方。 */
      await page.getByLabel("How many are on the shelf now").fill("84");
      await page.waitForTimeout(400);
      const withPreview = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      say("先讲会记一笔多少", /This will record: −7 bags/.test(withPreview),
        withPreview.slice(withPreview.indexOf("Stocktake"), withPreview.indexOf("Stocktake") + 260));

      /* 数出来一样的时候，按钮要按不下去 —— 一笔 0 的流水是他帐上
         一行没有发生过的事。 */
      await page.getByLabel("How many are on the shelf now").fill("91");
      await page.waitForTimeout(400);
      const same = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      const disabled = await page.getByRole("button", { name: /^Record it$/i }).isDisabled();
      say("数出来一样就讲一样，而且按钮按不下去",
        /Same as the system/i.test(same) && disabled, `${same.slice(0, 200)} · disabled=${disabled}`);

      /* 真的记一次 */
      await page.getByLabel("How many are on the shelf now").fill("84");
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: /^Record it$/i }).click();
      await page.waitForTimeout(5000);
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      await page.screenshot({ path: `${OUT}/2-after.png`, fullPage: true });
      console.log("拍到  2-after");

      const { data: hand } = await api
        .from("stock_on_hand").select("on_hand").eq("item_id", itemId).maybeSingle();
      say("记完，架上是 84", Number(hand?.on_hand) === 84, `${hand?.on_hand}`);
      /* ⚠️ 「架上有几个」是一个 <input>，而 **innerText 不含 input 的值** ——
         第一版拿 innerText 去找 84，当然找不到，然后我以为画面没更新。
         **同一天第六次量错东西。**（而那一刻画面确实也有一个真的毛病，
         就在同一个地方：见 Stocktake 的 onCounted。） */
      const shownNow = await page
        .locator("main input")
        .nth(3)
        .inputValue()
        .catch(() => "");
      say("而且画面上那一格跟着变成 84（不用重新整理）",
        shownNow.trim() === "84", `那一格现在是「${shownNow}」`);
    } else {
      const box = await page
        .getByRole("button", { name: /^Record it$/i })
        .first()
        .boundingBox();
      say("手机上那颗按得到（≥44px）",
        !!box && box.height >= 44, box ? `${box.width}×${box.height}` : "找不到");
      const scrolls = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      say("手机上不用左右滑", !scrolls, "会横滑");
    }
  }
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  shots.push({ name: err.message, stuck: true });
} finally {
  /* 帐号删掉，它的 project 跟里面每一行跟着走（cascade）。 */
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  void itemId;
  console.log("\n(临时帐号删掉了)");
  if (browser) await browser.close();
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${bad.length} 项没过`);
if (bad.length) for (const b of bad) console.log(`  · ${b.name}`);
process.exit(bad.length ? 1 : 0);
