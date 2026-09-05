/**
 * 阶梯佣金 —— 用眼睛看。
 *
 * 重点 7l。253 条真的呼叫全过，而那些答不了：
 * **他有没有地方写那几档**，跟**那个数字画在画面上对不对**。
 * 这个仓库最常犯的错就是「东西建好了，线没接」，而那正好是数字看不见的。
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
const OUT = ".screenshots/commission";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `comm-${stamp}@formae.test`;
const PASSWORD = `Comm-${stamp}-x!`;

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

  /* ⚠️ **没有一个行业开局就有师傅那一页** —— 八个行业的预设都是
     总览 · 客户 · 单据 · 收款 · 官网（DEFAULT_MODULES_FOR_INDUSTRY）。
     一个沙龙老板讲「我有三个发型师、要算抽成」的时候，那一页是 AI 帮他
     加的。所以这里要先把它加出来，不然这一整段量的是一个 404。
     **这不是产品的洞，是这个测试的道具** —— 而它花了我一轮才看出来。 */
  const { error: pageErr } = await api.rpc("add_project_page", {
    requested_key: "staff", new_title: null,
  });
  if (pageErr && !String(pageErr.message).includes("exists")) {
    throw new Error(`add_project_page(staff): ${pageErr.message}`);
  }

  /* 一个师傅跟一个客户 —— 那个客户是拿来证明**佣金不会画在客户页上**的。
     一个挂在客户身上的抽成，在画面上完全正常，而它没有意义。 */
  const { data: aida } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Aida",
  });
  const { data: cust } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Puan Siti",
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  const hide = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  /* ① 还没写抽成的师傅页：讲得出「还没写」，不是一片空白。 */
  await page.goto(`${BASE}/en/portal/staff/${aida.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  await hide();
  await page.screenshot({ path: `${OUT}/1-no-tiers.png`, fullPage: true });
  const blank = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  1-no-tiers");
  say("师傅页上有「他的抽成」这一段", /Their commission/i.test(blank), blank.slice(0, 200));
  say("还没写的时候讲得出来，不是一片空白", /No bands yet/i.test(blank), blank.slice(0, 240));
  /* ⚠️ 还没写档的时候**故意不画佣金那一格** —— 一个 RM 0 的抽成读起来像
     「这个月他一分佣金都没有」，而真相是他根本没有抽成。
     所以这里量的是「那一格不在」，不是「那一格写着零」。 */
  say("还没写档的时候不画佣金那一格",
    !/Commission this month/i.test(blank), blank.slice(0, 300));

  /* 🔴 客户页上不可以有这一段。 */
  await page.goto(`${BASE}/en/portal/customers/${cust.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1000);
  await hide();
  await page.screenshot({ path: `${OUT}/2-customer-has-none.png`, fullPage: true });
  const custText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  2-customer-has-none");
  say("客户页上没有佣金那一段", !/Their commission/i.test(custText), custText.slice(0, 200));

  /* ② 真的写两档：头五千一成，之后一成半。 */
  await page.goto(`${BASE}/en/portal/staff/${aida.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Add a band$/i }).click();
  await page.getByLabel("Rate % 1").fill("10");
  await page.getByRole("button", { name: /^Add a band$/i }).click();
  await page.getByLabel("From 2").fill("5000");
  await page.getByLabel("Rate % 2").fill("15");
  await page.waitForTimeout(300);
  const phrase = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("一边打一边讲得出那句话",
    /first RM 5,000 at 10%/i.test(phrase) && /RM 5,000 and above at 15%/i.test(phrase),
    phrase.slice(0, 300));

  await page.getByRole("button", { name: /^Save$/i }).last().click();
  await page.waitForTimeout(3000);
  await hide();
  await page.screenshot({ path: `${OUT}/3-two-bands.png`, fullPage: true });
  console.log("拍到  3-two-bands");
  const { data: savedTiers } = await api
    .from("commission_tiers").select("from_cents, percent").eq("party_id", aida.id).order("from_cents");
  say("两档真的存进去了", (savedTiers ?? []).length === 2, JSON.stringify(savedTiers));
  say("而且存的是分，不是块", Number((savedTiers ?? [])[1]?.from_cents) === 500000,
    JSON.stringify(savedTiers));

  /* 🔴 重新载入之后还在 —— 一份读不回来的设定，下一次保存会把它清掉。 */
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const backAgain = await page.getByLabel("Rate % 2").inputValue();
  say("重新打开那两档还在", backAgain === "15", `读回 ${backAgain}`);

  /* ③ 收一笔八千，挑 Aida。 */
  await page.goto(`${BASE}/en/portal/payments/new`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const pickers = await page.getByLabel("Who did it").count();
  say("收款那一页挑得到「谁做的」", pickers === 1, `${pickers} 个下拉`);
  await page.locator("form input").first().fill("Hair colour, Puan Siti");
  await page.getByLabel(/amount/i).first().fill("8000").catch(() => {});
  await page.getByLabel("Who did it").selectOption({ label: "Aida" });
  await hide();
  await page.screenshot({ path: `${OUT}/4-who-did-it.png`, fullPage: true });
  console.log("拍到  4-who-did-it");
  await page.getByRole("button", { name: /^Save$/i }).first().click();
  await page.waitForTimeout(5000);

  const { data: paid } = await api
    .from("ledger_entries").select("id, amount_cents, done_by").eq("done_by", aida.id).maybeSingle();
  say("那笔钱真的挂在她名下", paid?.done_by === aida.id, JSON.stringify(paid));
  say("而且金额是八千", Number(paid?.amount_cents) === 800000, `${paid?.amount_cents}`);

  /* ④ 回到她那一页：这个月做了多少，抽多少。 */
  await page.goto(`${BASE}/en/portal/staff/${aida.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/5-this-month.png`, fullPage: true });
  const month = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  5-this-month");
  /* 业绩那个数字只出现一次 —— 表单里那一格（模板自己叫它「本月业绩」，
     而它从今天起是锁住的、算出来的）。底下那一段只讲抽多少。

     🔴 **`innerText` 读不到 `<input>` 的值。** 这一条第一版量的是整页的字，
     於是它回报「RM 8,000 印了 0 次」，而画面上就在那里 ——
     **产品是对的，尺子瞎了**。这个仓库栽在同一件事上两次了。 */
  const takings = await page.getByLabel("This month").inputValue();
  say("那一格写着她这个月做了 RM 8,000", takings === "RM 8,000", `读到「${takings}」`);
  say("而且业绩只写一次，不是上下各印一遍",
    (month.match(/RM 8,000/g) ?? []).length === 0,
    `底下那一段又印了 ${(month.match(/RM 8,000/g) ?? []).length} 次`);
  say("那一格是锁住的，讲得出它是算出来的",
    /Worked out from the payments credited to them/i.test(month), month.slice(0, 400));
  /* 🔴 这一条就是整件事：5000×10% + 3000×15% = 950，不是 8000×15% = 1200。 */
  say("而佣金是 RM 950（分段算），不是 RM 1,200（整笔跳档）",
    /RM 950/.test(month) && !/RM 1,200/.test(month), month.slice(0, 320));
  say("而且明写着这只是算给你看的，不是付出去了",
    /not paid/i.test(month), month.slice(0, 320));

  /* ⑥ 手机 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await phone.goto(`${BASE}/en/portal/staff/${aida.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForTimeout(1500);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/6-phone-390.png`, fullPage: true });
  console.log("拍到  6-phone-390");
  const scrolls = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  say("手机上不用左右滑", !scrolls, "会横滑");

  /* 手机上每一颗按得到 —— 一个拇指按不准的「拿掉」会让他删错一档。 */
  const small = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, select, input")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height < 40) out.push(`${el.tagName}:${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 24)}=${Math.round(r.height)}`);
    }
    return out;
  });
  say("手机上每一颗都按得稳（≥40px）", small.length === 0, small.join(" · "));

  /* == (7) 佣金率的世代，跟下游经销商（20260905640000 . 720000 . 770000）=====
     🔴 **这一段是那四个洞的「最后一寸」。** 那两支函式 9-05 就是真的了，
     而在这之前**画面上没有任何一个地方读得到它们** ——
     他打开浏览器找不到它，那就是这个仓库犯过二十次的那件事。

     两种情况要分开测，因为它们的答案是相反的，而两个都是对的：
       A · 这个月之前一份办法都没有 -> 用他**最后一次讲的**那一份
       B · 这个月一号之前就有一份   -> 用**一号那一份**，今天改了也不动
     B 才是走 vibe-dealer 那一次量到的洞（上个月 RM 760 变 RM 1,140）。 */
  const firstOfMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit",
  }).format(new Date()) + "-01";

  await page.goto(`${BASE}/en/portal/staff/${aida.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const gen1 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("讲得出这个月是照哪一份办法算的",
    /worked out on the rates set from/i.test(gen1), gen1.slice(0, 320));
  const dateBoxes = await page.getByLabel("In force from").count();
  say("有一个「从哪天起」的框", dateBoxes === 1, `${dateBoxes} 个`);
  say("而且讲得出现在存是下个月才算",
    /starts next month/i.test(gen1), gen1.slice(0, 320));

  /* ── A · 同一天改回来，算后面那一次（20260905770000）───────────────────
     🔴 **这一条是用眼睛看那张图看出来的，尺子一条都没红。**
     「Earlier」那一段把同一天存过的两份都列出来，而资料库只认一份 ——
     去查它认哪一份，才看到两条退路的排序是反的：他今天第一次写抽成
     打错了、当天改回来，**这个月用的会是他打错的那一份**。
     现在两条都取「他最后一次讲的」，所以 5000x10% + 3000x30% = RM 1,400。 */
  await page.getByLabel("Rate % 2").fill("30");
  await page.getByRole("button", { name: /^Save$/i }).last().click();
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/7-same-day-fix.png`, fullPage: true });
  console.log("拍到  7-same-day-fix");
  const sameDay = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 之前一份都没有的时候，同一天改回来就算他最后讲的那一份（RM 1,400）",
    /RM 1,400/.test(sameDay), sameDay.slice(0, 460));
  /* 而「以前的」只留一行 —— 同一天存两次，作废的那一份不可以还列在上面。 */
  const earlierLines = (sameDay.match(/2026-\d\d-\d\d — first RM/g) ?? []).length;
  say("同一天存两次，「以前的」只留最后那一份",
    earlierLines <= 1, `列了 ${earlierLines} 行`);

  /* ── B · 这个月一号就有一份 -> 今天改，这个月一分都不动 ─────────────────
     这才是那个洞：改之前上个月本来 RM 760，改一次率变 RM 1,140。 */
  const { error: backErr } = await api.rpc("set_commission_tiers", {
    in_party_id: aida.id,
    in_tiers: [{ from_cents: 0, percent: 10 }, { from_cents: 500000, percent: 15 }],
    in_effective_from: firstOfMonth,
  });
  say("一号那一份写得进去", !backErr, backErr?.message);

  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const onFirst = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("这个月回到一号那一份（RM 950）", /RM 950/.test(onFirst), onFirst.slice(0, 460));

  await page.getByLabel("Rate % 2").fill("50");
  await page.getByRole("button", { name: /^Save$/i }).last().click();
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/8-month-does-not-move.png`, fullPage: true });
  console.log("拍到  8-month-does-not-move");
  const held = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 今天把率改成 50%，这个月会付的还是 RM 950 —— 一分都没动",
    /RM 950/.test(held), held.slice(0, 460));
  say("而他打的那一份也讲出来了，不是偷偷换掉",
    /would come to RM 2,000/i.test(held), held.slice(0, 500));
  say("那两档确实存进去了（下个月才算）",
    (await page.getByLabel("Rate % 2").inputValue()) === "50", "读不回 50");
  say("而且改过几次看得到", /Earlier/i.test(held), held.slice(0, 500));

  /* 而他要改的正好是这个月的时候，那个框就是出口。 */
  await page.getByLabel("In force from").fill(firstOfMonth);
  await page.getByRole("button", { name: /^Save$/i }).last().click();
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/9-from-the-first.png`, fullPage: true });
  console.log("拍到  9-from-the-first");
  const moved = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("写成这个月一号，数字就动了（RM 2,000）",
    /RM 2,000/.test(moved), moved.slice(0, 460));

  /* 🔴 下游经销商（洞〇）：抽成 9-05 放宽到他身上，而客户那一页
     **从来没有问过那一支**，所以那笔抽成算得出来而永远没有人看得到。 */
  const { error: dErr } = await api.rpc("set_commission_tiers", {
    in_party_id: cust.id,
    in_tiers: [{ from_cents: 0, percent: 6 }],
    in_effective_from: firstOfMonth,
  });
  say("下游经销商身上写得了抽成办法", !dErr, dErr?.message);
  const { error: mErr } = await api.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 1000000, in_party: "Celcom",
    in_entry_on: firstOfMonth, in_done_by: cust.id, in_note: "downstream",
  });
  say("那笔钱挂得到下游经销商头上", !mErr, mErr?.message);

  await page.goto(`${BASE}/en/portal/customers/${cust.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/10-downstream.png`, fullPage: true });
  console.log("拍到  10-downstream");
  const down = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 下游经销商的抽成，在他自己那一页上看得到",
    /Their commission/i.test(down) && /RM 600/.test(down), down.slice(0, 460));
  say("而且分得出他是下游，不是员工",
    /downstream dealer/i.test(down), down.slice(0, 460));


  /* ⑤ 改错人改得回来 —— 那不是钱，是一句关於谁的话。 */
  await page.goto(`${BASE}/en/portal/payments/${paid.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const openWith = await page.getByLabel("Who did it").inputValue();
  say("打开那一笔，「谁做的」读得回来", openWith === aida.id, `读回 ${openWith}`);
  await page.getByLabel("Who did it").selectOption({ value: "" });
  await page.getByRole("button", { name: /^Save$/i }).first().click();
  await page.waitForTimeout(5000);
  const { data: cleared } = await api
    .from("ledger_entries").select("done_by").eq("id", paid.id).maybeSingle();
  say("挑成「没有指定」真的拿得掉", cleared?.done_by === null, `${cleared?.done_by}`);

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
