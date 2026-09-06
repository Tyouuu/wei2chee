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
const OUT = ".screenshots/walk-customer";
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
    .update({ business_name: "Hin Fatt Renovation", system_language: "en" })
    .eq("id", proj.id);

  for (const key of ["customers", "quotations", "payments"]) {
    await api.rpc("add_project_page", { requested_key: key, new_title: null });
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
  await page.goto(`${BASE}/en/portal/customers`, { waitUntil: "domcontentloaded", timeout: 180000 });
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
  step("1c", "按一次保存，正门才换过来");
  {
    const save = await findControl(page, ["confirm design", "save"]);
    if (!save) {
      flag(ODD, "保存", "找不到那颗保存/确认 —— 改用直接存一次");
    } else {
      const label = ((await save.innerText().catch(() => "")) || "").replace(/s+/g, " ").trim();
      ok("保存", `那颗按钮叫「${label}」`);
    }
    /* 不按那颗绿的（它会跳去 WhatsApp）。用编辑器自己的保存把这一页收下来。 */
    /* ⚠️ 参数名先读过原文再写：它叫 target_page_key / new_layout，
       不是这个仓库到处在用的 in_*。猜名字这个仓库红过八次。 */
    const { error: sErr } = await api.rpc("save_project_page", {
      target_page_key: "customers",
      new_layout: { content: [], root: {} },
    });
    if (sErr) flag(ODD, "保存", "存不进去", sErr.message);
  }

  /* ── ② 建一个客户 ──────────────────────────────────────────────────── */
  step(2, "建一个客户（全程用点的）");
  await page.goto(`${BASE}/en/portal/customers`, { waitUntil: "domcontentloaded", timeout: 180000 });
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
  await page.goto(`${BASE}/en/portal/customers`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2200);
  const list = await seen(page);
  if (list.includes("Puan Aminah")) ok("客户清单", "他在名单上");
  else flag(BAD, "客户清单", "刚建的客户不在名单上", list.slice(0, 160));

  /* ── ③ 开一张报价单 ────────────────────────────────────────────────── */
  step(3, "开一张报价单");
  await page.goto(`${BASE}/en/portal/quotations`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2200);
  await shot(page, "5-quotations");

  const newQ = await findControl(page, ["new", "add", "\\+"]);
  if (!newQ) {
    flag(BAD, "报价单页", "找不到「开一张」的按钮", (await seen(page)).slice(0, 160));
  } else {
    await newQ.click();
    clicks++;
    await page.waitForTimeout(3000);
    await shot(page, "6-quote-form");

    const boxes = page.locator("input:visible, textarea:visible");
    const n = await boxes.count();
    ok("新报价单", `表单上有 ${n} 个可以打字的框`);

    /* 一个客人在这里要打几个字 —— 重点 29 那把尺 */
    const required = await page.locator("input[required]:visible, textarea[required]:visible").count();
    ok("新报价单", `其中 ${required} 个是必填`);

    /* 填：题目、对方、金额 */
    const fillIf = async (sel, val, why) => {
      const el = page.locator(sel).first();
      if (await el.count()) {
        await el.fill(val);
        clicks++;
        return true;
      }
      flag(ODD, "新报价单", `找不到${why}那一格`, sel);
      return false;
    };
    await fillIf('input[name*="title" i], input[placeholder*="what" i], input[type=text]:visible', "Kitchen refit", "题目");

    /* 对方：客人会期待它认得刚建的那个客户 */
    const partyBox = page.locator('input[list], input[name*="party" i], input[placeholder*="who" i]').first();
    if (await partyBox.count()) {
      await partyBox.fill("Puan Aminah");
      clicks++;
      ok("新报价单", "对方那一格填得了刚建的客户");
    } else {
      flag(ODD, "新报价单", "找不到「这一单是谁的」那一格");
    }

    const amtBox = page.locator('input[inputmode=decimal], input[type=number], input[name*="amount" i]').first();
    if (await amtBox.count()) {
      await amtBox.fill("30100");
      clicks++;
    } else flag(ODD, "新报价单", "找不到金额那一格");

    const saveQ = await findControl(page, ["save", "create", "add"]);
    if (!saveQ) flag(BAD, "新报价单", "找不到「保存」");
    else {
      await saveQ.click();
      clicks++;
      await page.waitForTimeout(3500);
      await shot(page, "7-quote-saved");
      const afterQ = await seen(page);
      if (/QT-|Kitchen refit/i.test(afterQ)) ok("新报价单", "存下来了，画面上看得到");
      else flag(BAD, "新报价单", "按了保存，画面上找不到那张单", afterQ.slice(0, 200));

      /* 🔴 单号：一张没有单号的报价单，客人拿到手上无法引用 */
      if (/QT-\d{4}-\d+/.test(afterQ)) ok("新报价单", `单号 ${/QT-\d{4}-\d+/.exec(afterQ)[0]}`);
      else flag(ODD, "新报价单", "画面上看不到单号");

      /* 🔴 那一颗打印 —— 任务 251 量到的那一件，用眼睛在画面上确认一次 */
      const printBtn = await findControl(page, ["print", "打印", "download", "pdf"]);
      if (printBtn) ok("那张纸", "有一颗打印/下载");
      else flag(BAD, "那张纸", "整页找不到打印或下载 —— 客人要一张报价，他只能截图");
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
    const amt = page.locator('input[inputmode=decimal], input[type=number], input[name*="amount" i]').first();
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
    ["/en/portal/quotations", "14-phone-quotes"],
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
  console.log(`\n判：一天的事按了 ${clicks} 次 · 坏的 ${bad.length} · 怪的 ${odd.length} · 粗糙 ${nit.length}`);
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
