/**
 * 客人打开他自己那张单 —— 用眼睛看，而且走两边。
 *
 * 重点 7l。`check:shared-record` 43 条真的呼叫全过，而它答不了两件事：
 * **老板发不发得出那条连结**，跟**屋主打不打得开、按不按得下去**。
 *
 * 🔴 那四支函式 20260905230000 就做好了，而到 2026-09-05 为止
 * **画面上一个入口都没有**。
 *
 * 这一段走的就是那条线的两头：
 *   老板开一条 -> 屋主在**没有登入的浏览器**打开 -> 看得到逐项跟分期 ->
 *   看不到成本、看不到别的单 -> 按同意 -> 老板那一边看得到他答了什么 ->
 *   收回 -> 当场打不开，而他答过的那句话留着
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
const OUT = ".screenshots/shared-record";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `sr-${stamp}@formae.test`;
const PASSWORD = `Sr-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const bad = [];
let userId = null;
let browser;
const say = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
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
  await admin.from("projects").update({ business_name: "Hup Seng Reno" }).eq("id", P);

  /* 一张真的报价单，带逐项跟分期 —— 那两段正好是屋主最想看的。 */
  const { data: quote, error: qErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_party: "Mr Tan", in_title: "Taman Desa 3-room reno", in_amount_cents: 4850000,
  });
  if (qErr) throw new Error(`add_pipeline_record: ${qErr.message}`);
  await api.rpc("set_record_lines", {
    in_record_id: quote.id,
    in_lines: [
      { description: "Hack and dispose", qty: 1, unit: "job", unit_price_cents: 800000,
        note: "cost to us 4,200" },
      { description: "Cement screed", qty: 120, unit: "sqft", unit_price_cents: 12000 },
    ],
  });
  await api.rpc("set_record_terms", {
    in_record_id: quote.id,
    in_terms: [
      { description: "Deposit", portion: 30 },
      { description: "On start", portion: 40 },
      { description: "On completion", portion: 30 },
    ],
  });

  /* 第二张单 —— 一条连结只可以开一张，这一张是拿来证明它的。 */
  await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_party: "Mr Tan", in_title: "Second bathroom", in_amount_cents: 900000,
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  const hide = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const url = `${BASE}/en/portal/quotations/${quote.id}`;

  /* ① 那颗按钮在，而且收款那一页没有（控制组）。 */
  await page.goto(url, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/1-before.png`, fullPage: true });
  console.log("拍到  1-before");
  const before = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const shareBtn = page.getByRole("button", { name: /^Open a link for the customer$/i });
  say("🔴 报价单那一页上有一颗「发给客人」", (await shareBtn.count()) === 1, `${await shareBtn.count()} 颗`);
  say("还没答的时候讲得出来，不是一片空白",
    /has not answered yet/i.test(before), before.slice(0, 400));

  /* ② 开一条。 */
  await shareBtn.click();
  await page.waitForTimeout(3500);
  await hide();
  await page.screenshot({ path: `${OUT}/2-link.png`, fullPage: true });
  console.log("拍到  2-link");
  const link = await page.getByLabel("The customer's link").inputValue();
  say("🔴 画面上真的给得出那条连结", /\/r\/[0-9a-f-]{36}$/i.test(link), `读到「${link}」`);
  const { data: row } = await api
    .from("pipeline_records").select("share_ref").eq("id", quote.id).maybeSingle();
  say("门牌不是那一行的 id", row?.share_ref && row.share_ref !== quote.id, `${row?.share_ref}`);

  /* ③ 🔴 屋主那一边 —— 全新的浏览器情境，没有任何 cookie，而且是手机。 */
  const outside = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const his = await outside.newPage();
  await his.goto(link, { waitUntil: "networkidle", timeout: 180000 });
  await his.waitForTimeout(2000);
  await his.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await his.screenshot({ path: `${OUT}/3-customer-390.png`, fullPage: true });
  console.log("拍到  3-customer-390");
  const seen = (await his.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 没有登入的人打得开", /Taman Desa 3-room reno/.test(seen), seen.slice(0, 300));
  say("上面是他的招牌，不是我们的",
    /Hup Seng Reno/.test(seen) && !/Formae/i.test(seen), seen.slice(0, 300));
  say("看得到逐项", /Cement screed/.test(seen), seen.slice(0, 400));
  /* 🔴 **分期要印钱，不只印比例** —— 屋主最想知道的正好是订金要转多少。
     22,400 的三成 = RM 6,720。资料库存的是「三成」，金额是算出来的。 */
  say("看得到分期怎么付，而且印得出订金是多少",
    /Deposit/.test(seen) && /30%/.test(seen) && /RM 6,720/.test(seen), seen.slice(0, 600));
  /* 🔴 **22,400 不是 48,500。** `set_record_lines` 把逐项的合计写回那一行
     —— 我开单的时候写 48,500，而两行逐项加起来是 8,000 + 14,400。
     **产品是对的**：一张总额跟自己逐项对不上的单，是在自己跟自己打架
     （任务 155 记过同一件，这是第二次）。第 16 次红的是我的道具。 */
  say("看得到总数，而且是逐项加起来那一个", /RM 22,400/.test(seen), seen.slice(0, 400));
  /* 🔴 漏不漏 —— 这一段比功能重要。 */
  say("🔴 看不到逐项的注解（那是他的成本）", !/cost to us/i.test(seen), seen.slice(0, 500));
  say("🔴 一条连结只开一张单，看不到他的另一张",
    !/Second bathroom/.test(seen), seen.slice(0, 400));
  say("看不到任何一个 id",
    !new RegExp(quote.id, "i").test(await his.content()), "id 印在页面上");

  /* 那一页穿的是他的漆，不是我们的深色壳 —— 而且要读得出来。 */
  const paint = await his.evaluate(() => {
    const lum = (css) => {
      const m = String(css).match(/[\d.]+/g);
      if (!m || m.length < 3) return null;
      const [r, g, b] = m.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const h1 = document.querySelector("h1");
    const main = document.querySelector("main");
    return {
      ground: lum(getComputedStyle(document.body).backgroundColor),
      scoped: lum(getComputedStyle(main?.parentElement ?? document.body).backgroundColor),
      ink: h1 ? lum(getComputedStyle(h1).color) : null,
      maxWidth: main ? getComputedStyle(main).maxWidth : "none",
    };
  });
  /* 🔴 `/p/` 那一次是看图才发现的：没有根 layout 就一行 CSS 都不载入，
     加了之后又变成近黑底配近黑字。所以量的是**读不读得出来**。 */
  say("🔴 那一页读得出来 —— 地跟字分得开",
    paint.maxWidth !== "none" && paint.ink !== null && paint.scoped !== null &&
      Math.abs(paint.scoped - paint.ink) > 0.4,
    JSON.stringify(paint));

  /* ④ 按同意。 */
  const nameBox = his.getByRole("textbox").first();
  await nameBox.waitFor({ state: "visible", timeout: 60000 });
  await his.waitForTimeout(1200);
  await nameBox.fill("Mr Tan");
  await his.waitForTimeout(300);
  say("名字真的打进去了", (await nameBox.inputValue()) === "Mr Tan", await nameBox.inputValue());
  await his.getByRole("button", { name: /^I accept this$/i }).click({ timeout: 30000 });
  await his.waitForTimeout(3500);
  await his.screenshot({ path: `${OUT}/4-accepted.png`, fullPage: true });
  console.log("拍到  4-accepted");
  const after = (await his.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 他按得下去，而且那一页讲得出他答了", /Accepted/i.test(after), after.slice(0, 400));
  const { data: answered } = await api
    .from("pipeline_records").select("answer, answered_name, stage").eq("id", quote.id).maybeSingle();
  say("资料库里真的记下来了", answered?.answer === "accepted", JSON.stringify(answered));
  say("而且他自己写的名字在上面", answered?.answered_name === "Mr Tan", `${answered?.answered_name}`);
  /* 🔴 同意是事实，搬他的流程是他的判断 —— stage 一动都不动。 */
  say("🔴 而那一单走到哪没有被自动搬走", answered?.stage !== "accepted", `${answered?.stage}`);

  /* ⑤ 老板那一边看得到他答了什么。 */
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/5-owner-sees.png`, fullPage: true });
  console.log("拍到  5-owner-sees");
  const ownerSees = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 老板看得到是谁、哪一天答的",
    /Mr Tan accepted on \d{4}-\d{2}-\d{2}/.test(ownerSees), ownerSees.slice(0, 500));
  say("而且讲得出那一单还是他自己决定要不要搬",
    /still your call/i.test(ownerSees), ownerSees.slice(0, 500));

  /* ⑥ 收回 —— 当场打不开，而他答过的那句话留着。 */
  await page.getByRole("button", { name: /^Take the link back$/i }).click();
  await page.waitForTimeout(3500);
  await his.reload({ waitUntil: "networkidle", timeout: 180000 });
  await his.waitForTimeout(1200);
  await his.screenshot({ path: `${OUT}/6-taken-back.png`, fullPage: true });
  console.log("拍到  6-taken-back");
  const shut = (await his.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 收回之后当场打不开", /not in use/i.test(shut), shut.slice(0, 300));
  const { data: kept } = await api
    .from("pipeline_records").select("answer, answered_name").eq("id", quote.id).maybeSingle();
  say("而他答过的那句话留着", kept?.answer === "accepted" && kept?.answered_name === "Mr Tan",
    JSON.stringify(kept));
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const stillShown = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("老板那一边也还看得到他答过", /Mr Tan accepted/.test(stillShown), stillShown.slice(0, 400));

  /* ⑦ 手机上按得稳。 */
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
  const scrolls = await his.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  say("手机上不用左右滑", !scrolls, "会横滑");

  /* 🔴 一个断成两行的金额，读起来是一个错的数字（任务 107u 同一条）。 */
  const split = await his.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("td, span")) {
      const t = (el.textContent ?? "").trim();
      if (!/^RM [\d,]+\.\d\d$/.test(t)) continue;
      const r = new Range();
      r.selectNodeContents(el);
      if (r.getClientRects().length > 1) out.push(t);
    }
    return out;
  });
  say("🔴 没有一个金额断成两行", split.length === 0, split.join(" · "));

  /* ══ ⑧ 过期那一张 —— 同意变灰，而「我要改一点」照旧按得动 ═══════════════
     🔴 这一段是 20260905790000 的画面那一半。`can_answer` 本来把过期
     也算进去，於是整张表单被收起来：**屋主连问一句的地方都没有**，
     而资料库那一边是准的（写那一支自己就写着「我要改一点照旧准」）。 */
  const { data: old } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_party: "Mr Tan", in_title: "Last month price", in_amount_cents: 300000,
    in_due_on: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
  });
  const { data: oldShare } = await api.rpc("share_record", { in_record_id: old.id });
  const oldPage = await outside.newPage();
  await oldPage.goto(`${BASE}/r/${oldShare?.share_ref}`, { waitUntil: "networkidle", timeout: 180000 });
  await oldPage.waitForTimeout(2000);
  await oldPage.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await oldPage.screenshot({ path: `${OUT}/7-expired-390.png`, fullPage: true });
  console.log("拍到  7-expired-390");
  const expiredText = (await oldPage.locator("body").innerText()).replace(/\s+/g, " ");
  say("过期那一张讲得出它过期了", /has expired/i.test(expiredText), expiredText.slice(0, 300));
  /* 🔴 表单还在 —— 收起来就是那个洞。 */
  const oldName = oldPage.getByRole("textbox").first();
  await oldName.waitFor({ state: "visible", timeout: 60000 });
  await oldPage.waitForTimeout(800);
  await oldName.fill("Mr Tan");
  await oldPage.waitForTimeout(300);
  const yes = oldPage.getByRole("button", { name: /^I accept this$/i });
  const ask = oldPage.getByRole("button", { name: /^I want a change$/i });
  say("🔴 过期了，那颗同意按不下去", await yes.isDisabled(), "居然还按得下去");
  say("🔴 而「我要改一点」照旧按得动", await ask.isEnabled(), "被一起关掉了");
  await ask.click({ timeout: 30000 });
  await oldPage.waitForTimeout(3500);
  const { data: askedRow } = await api
    .from("pipeline_records").select("answer").eq("id", old.id).maybeSingle();
  say("而且他真的问得出那一句", askedRow?.answer === "changes", `${askedRow?.answer}`);

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
