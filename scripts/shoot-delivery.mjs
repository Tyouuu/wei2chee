/**
 * 送货 · 签收 —— 用眼睛看，而且走两边。
 *
 * 重点 7l。`check:delivery-note` 51 条真的呼叫全过，而它答不了：
 * **老板开不开得了一趟货**，跟**客人签不签得下去**。
 *
 * 🔴 而这一件比别的更糟一点：客人那一页（`/r/<号码>`）9-05 已经画得出
 * 签收那一颗，**而老板开不了一趟货，所以那颗按钮永远不会出现**。
 * **半条线跟没有线是同一件事。**
 *
 * 这一段走完整条：
 *   架上有货 -> 开一趟 -> **架上真的少了** -> 还欠多少写在上面 ->
 *   客人在**没有登入的手机**上签 -> 老板那一边看得到他签了
 *
 * ⚠️ 用完就删的帐号。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/delivery";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `dl-${stamp}@formae.test`;
const PASSWORD = `Dl-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* ⚠️ 用 domcontentloaded 不用 networkidle：dev server 会一直开着一条
   websocket，而第一次进一页还要现编译 —— networkidle 在这里会等到超时，
   而那看起来像那一页打不开。每一次导航后面都有一个固定等待。 */
const bad = [];
let userId = null;
let browser;
const say = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};
/* `stock_on_hand` 是一张 view，不是一支函式 —— 照 check:delivery-note 的读法。 */
const onHand = async (P, name) => {
  const { data } = await api.from("stock_on_hand").select("name, on_hand").eq("project_id", P);
  const row = (data ?? []).find((r) => r.name === name);
  return row ? Number(row.on_hand) : null;
};

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await admin.from("projects").select("id").eq("account_id", userId).single();
  const P = proj.id;
  await admin.from("projects").update({ business_name: "Hup Seng Hardware" }).eq("id", P);
  /* ⚠️ 一个光秃秃的帐号没有这几页 —— 这是**道具**，不是产品的洞。
     第一版没有加，於是那一页回 404，而三条红看起来像那一段没画出来。 */
  for (const k of ["inventory", "orders", "projects"]) {
    const { error } = await api.rpc("add_project_page", { requested_key: k, new_title: null });
    if (error && !String(error.message).includes("exists")) {
      throw new Error(`add_project_page(${k}): ${error.message}`);
    }
  }

  /* 架上先有 200 包水泥。 */
  const { data: item, error: itErr } = await api.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Cement 50kg", in_unit: "bag", in_price_cents: 1850,
  });
  if (itErr) throw new Error(`add_catalog_item: ${itErr.message}`);
  await api.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 200, in_reason: "Opening",
  });

  /* 一张订单：90 包 ＋ 一行一口价的运费（那一行不该算「还没送到」）。 */
  const { data: order, error: oErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_party: "Mr Tan", in_title: "Site order", in_amount_cents: 200000,
  });
  if (oErr) throw new Error(`add_pipeline_record: ${oErr.message}`);
  await api.rpc("set_record_lines", {
    in_record_id: order.id,
    in_lines: [
      { description: "Cement 50kg", qty: 90, unit: "bag", unit_price_cents: 1850, item_id: item.id },
      { description: "Delivery charge", unit_price_cents: 15000 },
    ],
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector('input[type="email"]', { timeout: 120000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  const hide = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const url = `${BASE}/en/portal/orders/${order.id}`;

  /* ① 那一段在，而且讲得出还欠什么。 */
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/1-before.png`, fullPage: true });
  console.log("拍到  1-before");
  const before = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 订单那一页上有「送出去了几趟」",
    /Deliveries/.test(before), before.slice(0, 400));
  say("还没送过的时候讲得出来", /Nothing has gone out yet/i.test(before), before.slice(0, 500));
  say("还欠 90 包写在上面", /Still owed/i.test(before) && /Cement 50kg · 90/.test(before),
    before.slice(0, 600));
  /* 🔴 一口价那一行不算「还没送到」—— 架上没有东西要动。 */
  say("🔴 运费那一行不算还欠", !/Delivery charge · /.test(before), before.slice(0, 600));

  /* 报价单那一页不该有这一段（控制组）。 */
  const { data: quote } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_party: "Mr Tan", in_title: "Not agreed yet", in_amount_cents: 100000,
  });
  await page.goto(`${BASE}/en/portal/quotations/${quote.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(1200);
  const quoteText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("报价单那一页没有这一段（控制组）",
    !/Nothing has gone out yet/i.test(quoteText), quoteText.slice(0, 300));

  /* ② 开一趟 —— 架上真的少。 */
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Open a run$/i }).click();
  await page.waitForTimeout(600);
  await page.getByLabel("Who took it").fill("Ah Meng lorry");
  await page.getByLabel("Who received it").fill("Site foreman");
  await page.getByRole("button", { name: /^Send it out$/i }).click();
  await page.waitForTimeout(4000);
  /* ⚠️ 重新载入再读 —— `router.refresh()` 回来之前就读，读到的是按下去
     之前那一版，而那几条红看起来像那一趟没有画出来。 */
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(1800);
  await hide();
  await page.screenshot({ path: `${OUT}/2-sent.png`, fullPage: true });
  console.log("拍到  2-sent");
  say("🔴 送出去之后架上真的少了（200 -> 110）", (await onHand(P, "Cement 50kg")) === 110,
    `${await onHand(P, "Cement 50kg")}`);
  const sent = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("那一趟画出来了，带着谁去送、谁收的",
    /Ah Meng lorry/.test(sent) && /Site foreman/.test(sent), sent.slice(0, 600));
  say("而且写着他还没有自己签", /has not signed for it himself/i.test(sent), sent.slice(0, 600));
  say("送完了就不再写「还欠」", !/Still owed/i.test(sent), sent.slice(0, 600));

  /* ③ 🔴 客人那一边 —— 没有登入的手机。 */
  const { data: shared } = await api.rpc("share_record", { in_record_id: order.id });
  const outside = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const his = await outside.newPage();
  await his.goto(`${BASE}/r/${shared?.share_ref}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await his.waitForTimeout(2000);
  await his.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await his.screenshot({ path: `${OUT}/3-customer-390.png`, fullPage: true });
  console.log("拍到  3-customer-390");
  const seen = (await his.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 客人那一页上看得到那一趟", /Deliveries/i.test(seen) && /Cement 50kg/.test(seen),
    seen.slice(0, 500));

  /* 🔴 这一颗就是「半条线」那一件 —— 在这之前它永远不会出现。 */
  /* ⚠️ **不要用「Your name」** —— 答覆那一段也有一个，而它们本来
     一模一样：第一版拿 `.last()` 填到了答覆那一格，於是签收那颗
     一直是灰的，看起来像那颗按钮做死了（第 17 次道具错）。
     产品那一边也跟着改了：签收那一格现在叫「签收人」。 */
  const signName = his.getByLabel("Who is signing");
  await signName.waitFor({ state: "visible", timeout: 60000 });
  await his.waitForTimeout(1000);
  await signName.fill("Mr Tan");
  await his.waitForTimeout(300);
  const signBtn = his.getByRole("button", { name: /^I received this$/i });
  say("🔴 那两格名字不同名 —— 读屏软件分得出来",
    (await his.getByLabel("Who is signing").count()) === 1 &&
      (await his.getByLabel("Your name").count()) === 1,
    "两格同名");
  say("🔴 客人那一页上真的有一颗「我收到了」", (await signBtn.count()) === 1,
    `${await signBtn.count()} 颗`);
  await signBtn.click({ timeout: 30000 });
  await his.waitForTimeout(3500);
  /* ⚠️ 重新载入再读 —— 同一个时机问题，这一轮已经栽过两次。 */
  await his.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await his.waitForTimeout(1500);
  await his.screenshot({ path: `${OUT}/4-signed-390.png`, fullPage: true });
  console.log("拍到  4-signed-390");
  const signedText = (await his.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 他签得下去，那一页讲得出是谁签的",
    /Signed by Mr Tan/i.test(signedText), signedText.slice(0, 500));

  /* ④ 老板那一边看得到他签了。 */
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/5-owner-sees.png`, fullPage: true });
  console.log("拍到  5-owner-sees");
  const ownerSees = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 老板看得到他自己签了，而且是哪一天",
    /Mr Tan signed for it on \d{4}-\d{2}-\d{2}/.test(ownerSees), ownerSees.slice(0, 700));
  /* 签过的那一趟不给收起来 —— 那是他按下去的一句话，不是我们的记录。 */
  say("签过的那一趟不再给收起来",
    (await page.getByRole("button", { name: /^Put this run away$/i }).count()) === 0,
    "居然还给收");

  /* ⑤ 一件货都没有的那一趟（装修交屋 · 服务做完）。
     ⚠️ **用订单那一页，不用工程那一页。** 一个没有走过问卷的帐号，
     工程那一页产生出来没有表格，`loadRecordPage` 正确地回 404 ——
     那是**道具**不是产品的洞。同一件事在订单上量得到：
     一张只有一行一口价的单，一样是「没有货要出」。 */
  const { data: job, error: jobErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_party: "Mrs Tan", in_title: "Kitchen refit", in_amount_cents: 485000,
  });
  if (jobErr) throw new Error(`add_pipeline_record(handover): ${jobErr.message}`);
  await api.rpc("set_record_lines", {
    in_record_id: job.id,
    in_lines: [{ description: "Refit, all in", unit_price_cents: 485000 }],
  });
  await page.goto(`${BASE}/en/portal/orders/${job.id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  const jobBefore = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("一口价那一张也有「送出去了几趟」", /Deliveries/.test(jobBefore), jobBefore.slice(0, 400));
  say("而且它没有「还欠」—— 架上没有东西要动",
    !/Still owed/i.test(jobBefore), jobBefore.slice(0, 400));
  await page.getByRole("button", { name: /^Open a run$/i }).click({ timeout: 30000 });
  await page.waitForTimeout(800);
  const jobForm = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  /* 🔴 没有货的时候，那颗讲的是「交了」不是「送出去」——
     一颗写着「送出去」而什么都不出的按钮，是在讲一件不会发生的事。 */
  say("没有货的时候，那颗讲的是「交了」",
    /Nothing on this job comes off a shelf/i.test(jobForm) &&
      (await page.getByRole("button", { name: /^Handed over$/i }).count()) === 1,
    jobForm.slice(0, 400));
  await page.getByRole("button", { name: /^Handed over$/i }).click({ timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  await hide();
  await page.screenshot({ path: `${OUT}/6-handover.png`, fullPage: true });
  console.log("拍到  6-handover");
  const handed = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 一件货都没有的一趟也交得了", /no goods, handed over/i.test(handed), handed.slice(0, 500));

  /* ⑥ 手机上按得稳。 */
  const small = await his.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, input, textarea")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height < 40) out.push(`${el.tagName}=${Math.round(r.height)}`);
    }
    return out;
  });
  say("手机上每一颗都按得稳（≥40px）", small.length === 0, small.join(" · "));

} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
  if (browser) await browser.close();
}

console.log(`\n判：${bad.length} 项没过`);
for (const b of bad) console.log(`  · ${b}`);
process.exit(bad.length ? 1 : 0);
