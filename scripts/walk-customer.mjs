/**
 * 一个客人从头到尾做一天的事 —— **全程用点的，不走资料库捷径**。
 *
 *   npm run walk:customer
 *
 * 老板 2026-09-07：
 *   `我希望我推出我的产品的时候 我的产品是一个很成熟的一个平台`
 *   `我不要出现任何的低级问题`
 *   `我需要你模拟客户操作 看看哪里是不对`
 *   `你真是跑了一轮后 你才可以给我更好更到位的改善建议`
 *
 * ── 为什么这一支要存在 ────────────────────────────────────────────────────
 *
 * 走一遍那六支（reno · salon · workshop · hardware · tuition · dealer）
 * **五支从来不开浏览器** —— 它们数的是「资料库那一层非按不可的呼叫」，
 * 而任务 231 自己写着「不量画面：画面上一次可能要点三下才走完一次呼叫」。
 *
 * 而唯一开浏览器那一支（`walk.mjs`）的档头写着 **「它不写任何东西」** ——
 * 只点连结、开表单、打字，**不按送出**，因为它走的是老板自己的示范帐号。
 *
 * 🔴 **所以「一个客人从头到尾做一天的事」，从来没有人在浏览器里走过。**
 * 而低级问题（按了没反应 · 打的字不见了 · 标签讲错话 · 存了看不到）
 * 全部只活在那一层。
 *
 * ── 它跟别的尺不一样的地方 ────────────────────────────────────────────────
 *
 *   1. **它自己开一个用完就删的帐号** —— 所以它敢按送出
 *   2. 🔴 **它不预先知道按钮在哪。** 每一步它去**找**一个客人会找的东西
 *      （「加一单」「保存」），找不到就是一个发现，不是一次崩溃。
 *      写死选择器的尺，量的是写它的人记得什么
 *   3. **它不判分数，它列发现。** 严重的排前面
 *
 * ⚠️ 它**不碰示范帐号**。`walk.mjs` 那条规矩没有被推翻 ——
 * 一把每跑一次就往老板自己那一份里丢一笔假单的尺，是有代价的尺。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const STAMP = Date.now();
const EMAIL = `walk-${STAMP}@formae.test`;
const PASSWORD = `Walk!${STAMP}`;
/* 走哪一行 —— TRADE=salon npm run walk:customer
   ⚠️ 每一行的页面不一样，所以「一天的事」也不一样。一支只走装修的尺，
   量不到沙龙老板的第一天。 */
const TRADES = {
  reno:     { pages: ["customers", "quotations", "payments"], who: "Hin Fatt Renovation", job: "quotations" },
  salon:    { pages: ["customers", "bookings", "payments"],   who: "Wei Hair Studio",     job: "bookings" },
  hardware: { pages: ["customers", "inventory", "orders", "payments"], who: "Seng Huat Hardware", job: "orders" },
  workshop: { pages: ["customers", "projects", "payments"],   who: "Ah Keong Motor",      job: "projects" },
};
const TRADE = process.env.TRADE || "reno";
const T = TRADES[TRADE];
if (!T) throw new Error(`不认得这一行：${TRADE}（${Object.keys(TRADES).join(" ")}）`);
const OUT = `.screenshots/walk-customer/${TRADE}`;
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
dropThrowawayOnExit?.(admin, () => userId);

/* ── 发现 ────────────────────────────────────────────────────────────────
   分三级。**只有第一级是「客人会当场看到坏掉」** —— 其余两级是杂讯跟粗糙，
   而他讲的「低级问题」正好落在第二级最多。 */
const found = [];
const BAD = "🔴 坏的";
const ODD = "⚠️ 怪的";
const NIT = "· 粗糙";
const flag = (level, where, what, evidence = "") => {
  found.push({ level, where, what, evidence });
  console.log(`  ${level}  ${where.padEnd(18)} ${what}${evidence ? "\n      " + evidence : ""}`);
};
const ok = (where, what) => console.log(`  ✓        ${where.padEnd(18)} ${what}`);

/* 一步一步走，每一步记它花了几次点击 */
let clicks = 0;
const step = (n, title) => console.log(`\n${n}. ${title}`);

/** 找一个客人会找的控件：按看得见的字找，不写死类名 */
const findControl = async (page, words) => {
  /* ⚠️ 第一版没有这一条，於是它「找到」了一个 innerText 是整页的东西 ——
     那是 Puck 包画布的那一层，不是按钮。**一个控件的标签是短的。** */
  for (const w of words) {
    const all = page.locator("a:visible, button:visible, [role=button]:visible").filter({
      hasText: new RegExp(w, "i"),
    });
    const n = await all.count();
    for (let i = 0; i < n; i++) {
      const el = all.nth(i);
      const txt = ((await el.innerText().catch(() => "")) || "").replace(/s+/g, " ").trim();
      if (txt.length > 0 && txt.length <= 40) return el;
    }
  }
  return null;
};

/** 画面上人读得到的字 */
const seen = async (page) =>
  (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ");

const shot = async (page, name) =>
  page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }).catch(() => {});

let browser;
try {
  /* ── 台面：一个刚注册完问卷的装修承包商 ───────────────────────────────── */
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;

  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id, style, business_name").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");

  /* 一个真的客人是走完问卷才进来的，问卷会替他挑好风格跟公司名。
     这里补上，不然量到的是「跳过问卷」那条路，不是客人走的那条。 */
  /* ⚠️ supabase 那个 builder 不是完整的 Promise —— .catch 挂不上去（任务 213）*/
  await api.rpc("set_project_style", { new_style: "swiss" });
  await admin
    .from("projects")
    .update({ business_name: T.who, system_language: "en" })
    .eq("id", proj.id);

  for (const key of T.pages) {
    const { error } = await api.rpc("add_project_page", { requested_key: key, new_title: null });
    if (error) flag(ODD, "开页", `${key} 开不出来`, error.message);
  }

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.on("pageerror", (e) => flag(BAD, "浏览器", "页面丢出错误", String(e).slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|hydrat/i.test(m.text()))
      flag(NIT, "浏览器", "主控台红字", m.text().slice(0, 140));
  });

  /* ── ① 登入 ────────────────────────────────────────────────────────── */
  step(1, "登入");
  const t0 = Date.now();
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  clicks++;
  await page.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  /* 🔴 登入没成功就停。上一趟它等了 183 秒还在登入页，而後面每一条
     「找不到按钮」读到的都是那一页 —— 六条假的发现。
     **一趟登不进去的走法，跟一个坏掉的产品，在报告里长得一模一样。** */
  if (!page.url().includes("/portal"))
    throw new Error(`登入没成功：${((Date.now() - t0) / 1000).toFixed(1)}s 之后还在 ${new URL(page.url()).pathname}`);
  ok("登入", `${((Date.now() - t0) / 1000).toFixed(1)}s 之后落在 ${new URL(page.url()).pathname}`);
  await shot(page, "1-landed");

  /* 他第一眼看到什么 */
  const first = await seen(page);
  if (/something broke|not found|error/i.test(first.slice(0, 200)))
    flag(BAD, "第一屏", "落地就是错误页", first.slice(0, 140));
  const cjk = (first.match(/[一-鿿]/g) ?? []).length;
  if (cjk > 0)
    flag(ODD, "第一屏", `英文系统里有 ${cjk} 个中文字`, (first.match(/[一-鿿][^ ]{0,12}/g) ?? []).slice(0, 5).join(" · "));

  /* ── ①b 第一次打开：他看到的每一颗按钮按不按得动 ───────────────────
     🔴 `front-door.ts` 写着这是**故意的**：一页都没保存过 → 开编辑器，
     因为那是「看看你的系统、改改看」，也是我们卖的那一屏。
     而它的代价从来没有人量过 —— 这一段量它。 */
  step("1b", "第一次打开：那些按钮按不按得动");
  await page.goto(`${BASE}/en/portal/${T.pages[0]}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  await shot(page, "1b-first-visit");
  {
    const before = page.url();
    const btn = await findControl(page, ["new customer", "new ", "add"]);
    if (!btn) flag(ODD, "第一次", "找不到「加一个客户」");
    else {
      const label = ((await btn.innerText().catch(() => "")) || "").replace(/s+/g, " ").trim();
      await btn.click().catch(() => {});
      await page.waitForTimeout(2200);
      if (page.url() === before)
        flag(BAD, "第一次", `按「${label}」什么都不发生 —— 而画面上没有任何东西讲为什么`, before);
      else ok("第一次", `按「${label}」走到 ${new URL(page.url()).pathname}`);
    }
    /* 有没有一条看得见的路，从「看」走到「用」 */
    const wayOut = await findControl(page, ["my system", "preview", "use it", "start"]);
    if (!wayOut) flag(BAD, "第一次", "画面上找不到一条「开始用」的路");
    else ok("第一次", `出路叫「${((await wayOut.innerText().catch(() => "")) || "").trim()}」`);
  }

  /* ── ①c 按一次保存 —— 那一刻起它才是他的系统（front-door.ts） ───────── */
  step("1c", "把气泡关掉，再按同一颗");
  {
    /* 🔴 这一步才是那个证明。第一次按不动，可能是气泡挡的，也可能是画布
       把点击吃掉了。关掉气泡再按一次就分得开。 */
    const dismiss = await findControl(page, ["got it", "hide this"]);
    if (!dismiss) flag(ODD, "气泡", "找不到关掉它的那颗");
    else {
      await dismiss.click().catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, "1c-tooltip-gone");
      const b2 = page.url();
      const again = await findControl(page, ["new customer", "new ", "add"]);
      if (!again) flag(ODD, "关掉气泡之后", "按钮不见了");
      else {
        await again.click().catch(() => {});
        await page.waitForTimeout(2500);
        if (page.url() === b2)
          flag(BAD, "关掉气泡之后", "🔴 还是不动 —— 不是气泡，是画布把点击吃掉了", b2);
        else {
          flag(BAD, "气泡", "🔴 气泡关掉就按得动了 —— 挡他的就是那个气泡");
          await shot(page, "1c-works-now");
        }
      }
    }
    /* 收下这套系统：存它自己那一份，不是一张空的（上一趟我把那一页清空了）*/
    const { data: pg } = await api
      .from("project_pages")
      .select("layout_json")
      .eq("page_key", T.pages[0])
      .maybeSingle();
    const lay = pg?.layout_json;
    if (lay && Array.isArray(lay.content) && lay.content.length) {
      const { error } = await api.rpc("save_project_page", {
        target_page_key: T.pages[0],
        new_layout: lay,
      });
      if (error) flag(ODD, "收下", "存不进去", error.message);
      else ok("收下", `存回它自己那一份（${lay.content.length} 块）`);
    } else flag(ODD, "收下", "读不到那一页自己的版面");
  }

  /* ── ② 建一个客户 ──────────────────────────────────────────────────── */
  step(2, "建一个客户（全程用点的）");
  await page.goto(`${BASE}/en/portal/${T.pages[0]}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2200);
  await shot(page, "2-customers-empty");

  const emptyText = await seen(page);
  const addBtn = await findControl(page, ["add", "new", "\\+"]);
  if (!addBtn) {
    flag(BAD, "客户页", "找不到任何「加一个」的按钮", emptyText.slice(0, 160));
  } else {
    const label = (await addBtn.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    ok("客户页", `找到「${label}」`);
    const before = page.url();
    await addBtn.click();
    clicks++;
    await page.waitForTimeout(2500);
    if (page.url() === before) flag(BAD, "客户页", `按了「${label}」网址没变`, before);
    await shot(page, "3-customer-form");

    /* 填一个客人 —— 找那个「叫什么」的框 */
    const nameBox = page.locator("input[type=text]:visible, input:not([type]):visible").first();
    if (!(await nameBox.count())) {
      flag(BAD, "新客户", "表单上找不到可以打字的框");
    } else {
      await nameBox.fill("Puan Aminah");
      clicks++;
      const save = await findControl(page, ["save", "add", "create"]);
      if (!save) flag(BAD, "新客户", "打完字找不到「保存」");
      else {
        const saveLabel = (await save.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
        await save.click();
        clicks++;
        await page.waitForTimeout(3000);
        const after = await seen(page);
        if (after.includes("Puan Aminah")) ok("新客户", `「${saveLabel}」→ 名字出现在画面上`);
        else flag(BAD, "新客户", `按了「${saveLabel}」，画面上找不到刚打的名字`, after.slice(0, 160));
        await shot(page, "4-customer-saved");
      }
    }
  }

  /* 回客户清单，看它在不在 */
  await page.goto(`${BASE}/en/portal/${T.pages[0]}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2200);
  const list = await seen(page);
  if (list.includes("Puan Aminah")) ok("客户清单", "他在名单上");
  else flag(BAD, "客户清单", "刚建的客户不在名单上", list.slice(0, 160));

  /* ── ③ 开一张单 ──────────────────────────────────────────────────────
     🔴 上一趟这一段是坏的：我点到的不是「开一张新的」，所以量到的不是那张
     表单，然后报了三个假的发现。这一次点不到就走网址，**而且把点不到记下来**。 */
  step(3, `开一张单（${T.job}）`);
  await page.goto(`${BASE}/en/portal/${T.job}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  await shot(page, "5-list");

  {
    let reached = false;
    const btn = await findControl(page, ["new ", "add "]);
    if (!btn) {
      flag(BAD, `${T.job} 页`, "找不到「开一张新的」那颗按钮");
    } else {
      const label = ((await btn.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
      const before = page.url();
      await btn.click().catch(() => {});
      await page.waitForTimeout(2800);
      if (page.url() === before) flag(BAD, `${T.job} 页`, `按「${label}」网址没变`, before);
      else {
        reached = true;
        ok(`${T.job} 页`, `按「${label}」走到 ${new URL(page.url()).pathname}`);
      }
    }
    if (!reached) {
      await page.goto(`${BASE}/en/portal/${T.job}/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
      await page.waitForTimeout(2800);
    }
    await shot(page, "6-form");

    /* 这张表要他打几个字 —— 重点 29 那把尺 */
    const boxes = page.locator("main input:visible, main textarea:visible");
    const n = await boxes.count();
    const req = await page.locator("main input[required]:visible, main textarea[required]:visible").count();
    ok("那张表", `${n} 个可以打字的框，其中 ${req} 个必填`);

    /* 每一个框都要有一个看得见的名字 —— 没有名字的框，他只能猜 */
    const nameless = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("main input, main textarea")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const lab =
          (el.labels && el.labels[0]?.innerText) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          "";
        if (!lab.trim()) out.push(el.getAttribute("name") || el.type || "?");
      }
      return out;
    });
    if (nameless.length) flag(ODD, "那张表", `${nameless.length} 个框没有看得见的名字`, nameless.slice(0, 5).join(" · "));

    /* 填第一格（表单自己说过：第一格是这一笔在讲什么） */
    const first = page.locator("main input:visible, main textarea:visible").first();
    if (await first.count()) {
      await first.fill("Taman Ipoh 3-room reno");
      clicks++;
    } else flag(BAD, "那张表", "一个可以打字的框都没有");

    /* 对方 —— 它认不认得刚建的那个客户 */
    const party = page.locator('main input[list], main input[name*="party" i]').first();
    if (await party.count()) {
      await party.fill("Puan Aminah");
      clicks++;
      ok("那张表", "对方那一格填得了刚建的客户");
    }

    const amt = page.locator('main input[type=number]:visible, main input[inputmode=decimal]:visible').first();
    if (await amt.count()) {
      await amt.fill("30100");
      clicks++;
    } else flag(ODD, "那张表", "找不到金额那一格");

    const save = await findControl(page, ["save"]);
    if (!save) flag(BAD, "那张表", "找不到「保存」");
    else {
      await save.click();
      clicks++;
      await page.waitForTimeout(3500);
      await shot(page, "7-saved");
      const after = await seen(page);
      if (/Taman Ipoh/i.test(after)) ok("那张单", "存下来了，画面上看得到");
      else flag(BAD, "那张单", "按了保存，画面上找不到它", after.slice(0, 200));

      const no = /\b[A-Z]{2}-\d{4}-\d+/.exec(after);
      if (no) ok("那张单", `单号 ${no[0]}`);
      else flag(ODD, "那张单", "画面上看不到单号 —— 客人拿到手上没法引用它");

      /* 🔴 那一颗打印 */
      const pr = await findControl(page, ["print", "download", "pdf"]);
      if (pr) ok("那张纸", "有一颗打印或下载");
      else flag(BAD, "那张纸", "找不到打印或下载 —— 客人要一张，他只能截图");
    }
  }

  /* ── ④ 收一笔钱 ────────────────────────────────────────────────────── */
  step(4, "收一笔订金");
  await page.goto(`${BASE}/en/portal/payments`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2200);
  const payAdd = await findControl(page, ["new", "add", "\\+"]);
  if (!payAdd) flag(BAD, "收款页", "找不到「记一笔」的按钮");
  else {
    await payAdd.click();
    clicks++;
    await page.waitForTimeout(3000);
    await shot(page, "8-payment-form");
    /* 🔴 上一趟只填金额，产品**正确地**拒绝了（「第一格是这一笔在讲什么」）——
       那一条红是我的尺，不是产品。这一次照它讲的填。 */
    const firstBox = page.locator("main input:visible, main textarea:visible").first();
    if (await firstBox.count()) {
      await firstBox.fill("Deposit from Puan Aminah");
      clicks++;
    }
    const amt = page.locator('main input[type=number]:visible, main input[inputmode=decimal]:visible').first();
    if (await amt.count()) {
      await amt.fill("9030");
      clicks++;
      const savePay = await findControl(page, ["save", "record", "add"]);
      if (savePay) {
        await savePay.click();
        clicks++;
        await page.waitForTimeout(3500);
        const afterPay = await seen(page);
        if (/9,030|9030/.test(afterPay)) ok("收款", "记下来了，画面上看得到");
        else flag(BAD, "收款", "按了保存，画面上找不到那笔钱", afterPay.slice(0, 200));
        await shot(page, "9-payment-saved");
      } else flag(BAD, "收款", "找不到「保存」");
    } else flag(BAD, "收款", "表单上找不到金额那一格");
  }

  /* ── ⑤ 一天做完之后，他打开的第一页 ──────────────────────────────── */
  step(5, "他明天早上打开的第一页");
  for (const [path, name] of [
    ["/en/portal", "10-overview"],
    ["/en/portal/today", "11-today"],
    ["/en/portal/owing", "12-owing"],
  ]) {
    const r = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(2500);
    const code = r?.status() ?? 0;
    if (code >= 400) {
      flag(BAD, path, `打不开 —— ${code}`);
      continue;
    }
    const body = await seen(page);
    if (/something broke|not found/i.test(body.slice(0, 200))) {
      flag(BAD, path, "开出来是错误页", body.slice(0, 140));
      continue;
    }
    await shot(page, name);
    const zh = (body.match(/[一-鿿]/g) ?? []).length;
    if (zh > 0)
      flag(ODD, path, `英文系统里有 ${zh} 个中文字`, (body.match(/[一-鿿][^ ]{0,10}/g) ?? []).slice(0, 4).join(" · "));
    ok(path, `打得开 · ${body.length} 个字`);
  }

  /* ── ⑥ 手机上再走一次最要紧的三页 ────────────────────────────────── */
  step(6, "手机上（390）");
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await phone.waitForTimeout(2500);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  for (const [path, name] of [
    ["/en/portal", "13-phone-overview"],
    [`/en/portal/${T.job}`, "14-phone-list"],
    ["/en/portal/today", "15-phone-today"],
  ]) {
    await phone.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await phone.waitForTimeout(2500);
    await phone.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
    /* 横滚 = 手指要左右拨才读得完 */
    const wide = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    if (wide) flag(BAD, `手机 ${path}`, "整页要左右滑");
    /* 拇指按不稳的 */
    const small = await phone.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll("a,button,[role=button],input,select")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.bottom < 0 || r.top > innerHeight) continue;
        if (r.height < 40 || r.width < 40)
          bad.push(`${(el.innerText || el.value || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 22)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return bad;
    });
    if (small.length)
      flag(NIT, `手机 ${path}`, `${small.length} 个控件小过 40px`, small.slice(0, 4).join(" · "));
    else ok(`手机 ${path}`, "没有横滚 · 没有太小的控件");
  }

  /* ── 判 ───────────────────────────────────────────────────────────── */
  const bad = found.filter((f) => f.level === BAD);
  const odd = found.filter((f) => f.level === ODD);
  const nit = found.filter((f) => f.level === NIT);
  console.log(`\n判 · ${TRADE}：一天的事按了 ${clicks} 次 · 坏的 ${bad.length} · 怪的 ${odd.length} · 粗糙 ${nit.length}`);
  console.log(`图：${OUT}/`);
  if (bad.length) {
    console.log("\n🔴 客人会当场看到坏掉的：");
    bad.forEach((f, i) => console.log(`  ${i + 1}. ${f.where} —— ${f.what}${f.evidence ? "\n     " + f.evidence : ""}`));
  }
  fs.writeFileSync(`${OUT}/found.json`, JSON.stringify({ clicks, found }, null, 2));
  process.exitCode = 0;
} catch (e) {
  console.error("\n跑不完：", e.message);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  const gone = await dropThrowaway(admin, userId);
  console.log(gone ? "临时帐号删掉了" : "🔴 临时帐号删不掉");
}
