/**
 * 四扇新的门：帐 · 保养合约 · 薪水 · 税。真的登入，真的按。
 *
 * ── 为什么（2026-09-06）─────────────────────────────────────────────────
 *
 * 老板 2026-09-05 的体检数出来：**七十二支功能按不到** ——
 * 「建好了、验过了，他打开浏览器找不到」。
 * 最大的四块正好是这四页（会计 4 · 保养合约 7 · 薪资 7 · 税与电子发票 5）。
 *
 * 这一支不打 RPC，它开真的浏览器走完柜台真正的那一串，而且**每按一次
 * 就用真的客户身分回去问那一行** —— 一颗看起来成功而资料库里没变的按钮，
 * 比一颗报错的糟得多。
 *
 * ── ⚠️ 它同时验反过来那一半 ────────────────────────────────────────────
 *
 * **师傅打不开钱那四页**（帐 · 薪水 · 税 · 谁欠我钱）。
 * 那不是藏起来，是 404 —— 而这一条要有一个**控制组**：先证明老板真的
 * 打得开，不然「师傅打不开」量的是空气（任务 125 的教训）。
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
const OUT = ".screenshots/tools";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
let staffId = null;
dropThrowawayOnExit(admin, () => userId);

const pass = [];
const fail = [];
const ok = (m) => {
  pass.push(m);
  console.log(`  PASS  ${m}`);
};
const no = (m, got) => {
  fail.push(m);
  console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`);
};

let browser;
try {
  // ── 台面 ───────────────────────────────────────────────────────────────
  const stamp = Date.now();
  const email = `tools-${stamp}@formae.test`;
  const password = `Tools-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;
  await api.rpc("set_project_style", { new_style: "swiss" });
  for (const k of ["customers", "quotations", "payments", "staff"]) {
    await api.rpc("add_project_page", { new_page_key: k });
  }

  /* 一个客户 · 一个师傅 —— 保养合约要一个人，薪水要一个人。 */
  const { data: cust, error: cErr } = await api.rpc("add_directory_entry", {
    in_project_id: pid,
    in_module_key: "customers",
    in_name: "Hup Seng Trading",
    in_whatsapp: "012-3xx xxxx",
  });
  if (cErr) throw new Error(`add customer: ${cErr.message}`);
  const custId = cust?.id ?? cust;

  const { data: st, error: sErr } = await api.rpc("add_directory_entry", {
    in_project_id: pid,
    in_module_key: "staff",
    in_name: "Ah Meng",
  });
  if (sErr) throw new Error(`add staff: ${sErr.message}`);
  staffId = st?.id ?? st;

  /* 一张单，好让税那一页有东西可以试。 */
  const { data: job, error: jErr } = await api.rpc("add_pipeline_record", {
    in_project_id: pid,
    in_module_key: "quotations",
    in_title: "Roof repair, block C",
    in_party: "Hup Seng Trading",
    in_amount_cents: 480000,
    in_party_id: custId,
  });
  if (jErr) throw new Error(`add job: ${jErr.message}`);
  const jobId = job?.id ?? job;

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    reducedMotion: "reduce",
  });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  const open = async (path) => {
    const res = await page.goto(`${BASE}/en/portal/${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await page.waitForTimeout(2600);
    return res?.status() ?? 0;
  };

  // ── ① 帐 ───────────────────────────────────────────────────────────────
  if ((await open("books")) === 200) ok("帐那一页打得开");
  else no("帐那一页打不开");

  const books0 = await page.locator("body").innerText();
  /* 试算表两边一定要平 —— 而它一开始是空的，两边都零。 */
  if (/It balances/i.test(books0)) ok("试算表一开始就是平的");
  else no("试算表一开始就不平", books0.slice(0, 120));
  /* 八个科目要在。 */
  if (/Cash|Bank/i.test(books0)) ok("八个科目建出来了");
  else no("科目表是空的", books0.slice(0, 120));
  await page.screenshot({ path: `${OUT}/1-books-empty.png`, fullPage: true });

  /* 开帐：打一个数字，存下去，位置那一格要跟着动。 */
  const amounts = page.getByLabel("Amount (RM)");
  await amounts.first().fill("20000");
  await page.getByLabel("As on").first().fill("2026-01-01");
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await page.waitForTimeout(2600);

  const { data: openRow } = await admin
    .from("opening_balances")
    .select("code, amount_cents, as_on")
    .eq("project_id", pid);
  const first = (openRow ?? [])[0];
  if (first && Number(first.amount_cents) === 2000000) ok("开帐真的写进去了（RM 20,000）");
  else no("开帐没写进去", JSON.stringify(openRow));

  await open("books");
  const books1 = await page.locator("body").innerText();
  if (/RM 20,000/.test(books1)) ok("那个数字回到画面上");
  else no("画面上没有那个数字", books1.slice(0, 200));
  /* 🔴 开帐永远配得平 —— 另一边自己去权益（20260905570000）。
     这一条是整页会计的地基：它不该因为他打了一个数字就不平。 */
  if (/It balances/i.test(books1)) ok("🔴 打了开帐之后还是平的");
  else no("🔴 打了开帐之后不平了", books1.slice(0, 200));
  await page.screenshot({ path: `${OUT}/2-books-opened.png`, fullPage: true });

  // ── ② 保养合约 ─────────────────────────────────────────────────────────
  if ((await open("contracts")) === 200) ok("保养合约那一页打得开");
  else no("保养合约那一页打不开");
  await page.screenshot({ path: `${OUT}/3-contracts-empty.png`, fullPage: true });

  await page.getByLabel("For").selectOption({ label: "Hup Seng Trading" });
  await page.getByLabel("What you do").fill("Clean 3 units");
  await page.getByRole("button", { name: /Sign it/i }).click();
  await page.waitForTimeout(3000);

  const { data: cons } = await admin
    .from("service_contracts")
    .select("id, party_id, title, every_months, starts_on")
    .eq("project_id", pid);
  const con = (cons ?? [])[0];
  if (con) ok("合约真的签进去了");
  else no("合约没有签进去", JSON.stringify(cons));
  if (con && con.party_id === custId) ok("合约连到那个客户");
  else no("合约没有连到客户");
  /* ⚠️ 留空的到期日存的是「没有」，不是今天。 */
  const { data: con2 } = await admin
    .from("service_contracts")
    .select("ends_on")
    .eq("project_id", pid)
    .maybeSingle();
  if (con2 && con2.ends_on === null) ok("「到」留空存的是「没有」，不是今天");
  else no("「到」留空存成了一个日子", String(con2?.ends_on));

  await open("contracts");
  /* 🔴 量那一张**清单**，不量整页 ——
     “Hup Seng Trading” 同时是底下「签一份」那个下拉里的一个选项，
     所以拿整页去匹配会在一张**空的**清单上报 PASS。
     2026-09-06 它真的骗过我一次。 */
  const roundList = page.locator("ul").first();
  const con3 = await roundList.innerText().catch(() => "");
  if (/Hup Seng Trading/.test(con3)) ok("签完那一轮就出现在「要去哪几家」上");
  else no("签完那一张清单还是空的", con3.slice(0, 200));

  /* 🔴 「顺手开一张单」那个下拉要在 ——
     它不在的时候，意思是 `project_pages` 那一句查询静静地失败了
     （欄位名写错→PostgREST 400→supabase-js 不抛→data 是 null），
     而画面上完全看得过去。 */
  const jobPick = page.locator("select").filter({ hasText: /Quotations|Orders/i });
  if (await jobPick.count()) ok("🔴 「顺手开一张单」那个下拉在（页面查得到他那几页）");
  else no("🔴 那个下拉不在 —— project_pages 那一句查询静静地失败了");
  await page.screenshot({ path: `${OUT}/4-contracts-signed.png`, fullPage: true });

  /* 在门口按一下。 */
  const came = page.getByRole("button", { name: /^Came$/ }).first();
  if (await came.count()) {
    await came.click();
    await page.waitForTimeout(3200);
    const { data: visits } = await admin
      .from("service_visits")
      .select("status, record_id")
      .eq("project_id", pid);
    const v = (visits ?? [])[0];
    if (v && v.status === "done") ok("按「来过了」真的记了一次");
    else no("按了没有记进去", JSON.stringify(visits));
    /* 🔴 它顺手开一张单，走的是人按的那一支 —— 所以有单号。 */
    if (v?.record_id) {
      const { data: rec } = await admin
        .from("pipeline_records")
        .select("doc_no")
        .eq("id", v.record_id)
        .maybeSingle();
      if (rec?.doc_no) ok("顺手开出来那张单有单号（走的是人按的那一支）");
      else no("开出来那张单没有单号", JSON.stringify(rec));
    } else {
      no("按「来过了」没有开出单");
    }
    await page.screenshot({ path: `${OUT}/5-contracts-came.png`, fullPage: true });
  } else {
    /* 🔴 它不在的时候，意思是那一行被画成「已经记过了」——
       `due_visits` 对一次还没记过的到期回的是 `'due'`，不是 null。 */
    no("画面上没有「来过了」那颗按钮 —— 那一行被画成已经记过了");
  }

  // ── ③ 薪水 ─────────────────────────────────────────────────────────────
  if ((await open("payroll")) === 200) ok("薪水那一页打得开");
  else no("薪水那一页打不开");
  const pay0 = await page.locator("body").innerText();
  /* 🔴 一个人都没有底薪的时候，不画那颗「开一次」——
     开出来会是一张空的薪水单。

     ⚠️ 量的是**那颗按钮**，不是整页的字 ——
     旁边那一句「Nobody has a rate yet. Set one below, then open the run.」
     本身就包含“open the run”，而我第一版拿整页去匹配，
     于是对着一个完全正确的画面报了红。 */
  if ((await page.getByRole("button", { name: /Open the run/i }).count()) === 0) ok("🔴 没有人有底薪的时候不画「开一次」");
  else no("🔴 没有人有底薪却画了「开一次」");
  await page.screenshot({ path: `${OUT}/6-payroll-noterms.png`, fullPage: true });

  await page.getByLabel("Rate (RM)").first().fill("2500");
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await page.waitForTimeout(2600);

  const { data: terms } = await admin
    .from("staff_pay_terms")
    .select("rate_cents, basis")
    .eq("project_id", pid);
  if ((terms ?? [])[0] && Number(terms[0].rate_cents) === 250000) ok("底薪写进去了（RM 2,500）");
  else no("底薪没写进去", JSON.stringify(terms));

  await open("payroll");
  await page.getByRole("button", { name: /Open the run/i }).click();
  await page.waitForTimeout(3600);

  const { data: runs } = await admin.from("pay_runs").select("id, paid_at").eq("project_id", pid);
  if ((runs ?? []).length === 1) ok("开出来一张薪水单");
  else no("薪水单没开出来", JSON.stringify(runs));

  const pay1 = await page.locator("body").innerText();
  if (/Ah Meng/.test(pay1)) ok("那个人出现在薪水单上");
  else no("薪水单上没有那个人", pay1.slice(0, 200));
  /* 🔴 法定那几笔是算出来的 —— 他一个字都没打，而它们要在。 */
  const { data: slips } = await admin
    .from("payslips")
    .select("gross_cents, deduction_cents, employer_cents, net_cents")
    .eq("project_id", pid);
  const slip = (slips ?? [])[0];
  if (slip && Number(slip.gross_cents) === 250000) ok("底薪自己变成第一笔收入");
  else no("底薪没有变成收入", JSON.stringify(slip));
  /* 🔴 **法律那几张表是资料，不是代码**（20260904210000）。
     这一库今天一张都没有 —— 所以公积金跟社险算出来就是零，
     而那是对的。错的是**不讲出来** ——
     一张没有法定扣款的薪资单，跟一张算出来刚好是零的，
     在画面上一模一样。所以这一段按那几张表在不在分两边量。 */
  const { data: laws } = await admin
    .from("statutory_schedules")
    .select("scheme")
    .not("confirmed_at", "is", null);
  const lawReady = (laws ?? []).length > 0;
  if (lawReady) {
    if (slip && Number(slip.deduction_cents) > 0) ok("🔴 公积金社险自己算出来了（他一个字没打）");
    else no("🔴 法定那几笔是零", JSON.stringify(slip));
    if (slip && Number(slip.net_cents) < Number(slip.gross_cents)) ok("拿回家的比赚的少");
    else no("拿回家的没有扣", JSON.stringify(slip));
  } else {
    if (/no statutory deductions/i.test(pay1))
      ok("🔴 法律表还没有人核对，而画面上讲出来了");
    else no("🔴 法律表是空的，而这一页什么都没讲", pay1.slice(0, 240));
  }
  await page.screenshot({ path: `${OUT}/7-payroll-open.png`, fullPage: true });

  /* 发出去 —— 整张锁住，而且记一笔钱出去。 */
  await page.getByRole("button", { name: /Pay it out/i }).click();
  await page.waitForTimeout(3600);
  const { data: runs2 } = await admin.from("pay_runs").select("paid_at").eq("project_id", pid);
  if ((runs2 ?? [])[0]?.paid_at) ok("发出去了，整张锁住");
  else no("发不出去", JSON.stringify(runs2));
  await page.screenshot({ path: `${OUT}/8-payroll-paid.png`, fullPage: true });

  // ── ④ 税 ───────────────────────────────────────────────────────────────
  if ((await open("tax")) === 200) ok("税那一页打得开");
  else no("税那一页打不开");
  const tax0 = await page.locator("body").innerText();
  /* 🔴 还没登记 SST 就不画那几个数字 —— 一张写着「SST RM 0.00」的单，
     是在讲一件他没有资格讲的话。 */
  if (/Not registered/i.test(tax0)) ok("🔴 还没登记就讲出来，不画一个 RM 0");
  else no("🔴 还没登记却画了税额", tax0.slice(0, 200));
  await page.screenshot({ path: `${OUT}/9-tax-empty.png`, fullPage: true });

  await page.getByLabel("Tax number (TIN)").fill("C1234567890");
  await page.getByLabel("SSM number").fill("202601234567");
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await page.waitForTimeout(2600);
  const { data: prof } = await admin
    .from("tax_profile")
    .select("tin, reg_no")
    .eq("project_id", pid)
    .maybeSingle();
  if (prof?.tin === "C1234567890") ok("纳税人编号写进去了");
  else no("纳税人编号没写进去", JSON.stringify(prof));

  await open("tax");
  /* 🔴 那一张单要真的出现在下拉里 ——
     它不在的时候画面写着「还没有单」，而那句话是假的：
     `project_pages.key` 这个欄位名不存在，PostgREST 回 400，
     而 supabase-js 不抛。 */
  const taxBody = await page.locator("body").innerText();
  if (!/No documents yet/i.test(taxBody)) ok("🔴 他那张单真的可以拿来试");
  else no("🔴 税那一页找不到他的单", taxBody.slice(0, 200));
  await page.getByRole("button", { name: /What is missing/i }).click();
  await page.waitForTimeout(2800);
  const tax1 = await page.locator("body").innerText();
  /* 🔴 「还差什么」是一份清单，不是一句「还没好」。 */
  if (/Still missing|Nothing missing/i.test(tax1)) ok("「还差什么」答得出来");
  else no("「还差什么」没有答案", tax1.slice(0, 200));
  /* 讲清楚它还不是什么。 */
  if (/Nothing here is sent anywhere/i.test(tax1)) ok("画面上讲出「什么都不会送出去」");
  else no("没有讲出它还不是什么");
  await page.screenshot({ path: `${OUT}/10-tax-check.png`, fullPage: true });

  /* 这一张单的税率。 */
  await page.getByLabel("Rate (%)").last().fill("8");
  await page.getByRole("button", { name: /Put it on this one/i }).click();
  await page.waitForTimeout(3000);
  const { data: rec2 } = await admin
    .from("pipeline_records")
    .select("tax_rate")
    .eq("id", jobId)
    .maybeSingle();
  if (rec2 && Number(rec2.tax_rate) === 8) ok("税率写在那一张单上了");
  else no("税率没写上去", JSON.stringify(rec2));

  // ── ⑤ 侧栏上真的看得到（一条按得到的连结）─────────────────────────────
  await open("");
  const rail = await page.locator("nav").first().innerText();
  for (const [label, path] of [
    ["Books", "books"],
    ["Pay", "payroll"],
    ["Tax", "tax"],
    ["Service contracts", "contracts"],
  ]) {
    if (rail.includes(label)) ok(`侧栏上有「${label}」`);
    else no(`侧栏上没有「${label}」`, path);
  }
  /* ⚠️ 车牌是按有没有资料画的 —— 这个帐号一台车都没有，所以**不该**在。 */
  if (!rail.includes("Plates")) ok("⚠️ 一台车都没有，车牌那一行不画");
  else no("一台车都没有却画了车牌");
  await page.screenshot({ path: `${OUT}/11-rail.png`, fullPage: true });

  // ── ⑥ 手机上 ───────────────────────────────────────────────────────────
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', email);
  await phone.fill('input[type="password"]', password);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  for (const [n, path] of [
    [12, "books"],
    [13, "contracts"],
    [14, "payroll"],
    [15, "tax"],
  ]) {
    await phone.goto(`${BASE}/en/portal/${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await phone.waitForTimeout(2400);
    /* 🔴 手机上不准横滚 —— 一个要左右推才读得完的工作台，在工地上等於读不了。 */
    const wide = await phone.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    if (!wide) ok(`390 上不横滚 · ${path}`);
    else no(`390 上横滚了 · ${path}`);
    await phone.screenshot({ path: `${OUT}/${n}-${path}-390.png`, fullPage: true });
  }

  // ── ⑦ 反过来那一半：师傅打不开钱那几页 ────────────────────────────────
  const mateEmail = `mate-${stamp}@formae.test`;
  const matePass = `Mate-${stamp}-x!`;
  const { data: mate } = await admin.auth.admin.createUser({
    email: mateEmail,
    password: matePass,
    email_confirm: true,
  });
  const { error: invErr } = await api.rpc("add_project_member", { in_email: mateEmail });
  if (invErr) {
    console.log(`  ⚪ 请不动人（${invErr.message}）—— 师傅那一段跳过`);
  } else {
    const mp = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: "reduce" });
    await mp.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await mp.fill('input[type="email"]', mateEmail);
    await mp.fill('input[type="password"]', matePass);
    await mp.click('button[type="submit"]');
    await mp.waitForURL(/portal/, { timeout: 180000 });

    /* 控制组先跑 —— 没有它，下面那三条量的是空气（任务 125）。 */
    const conRes = await mp.goto(`${BASE}/en/portal/contracts`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    if ((conRes?.status() ?? 0) === 200) ok("控制组：师傅打得开保养合约（那是他一天的工作）");
    else no("控制组：师傅连保养合约都打不开", String(conRes?.status()));

    /* 🔴 量的是**他看不看得到那一页**，不是 HTTP 回多少。

       `notFound()` 在这里回的是 **200 配一张找不到的页** ——
       壳先渲染、先刷出去了，所以状态码已经定了改不了。
       拿状态码当答案，就是拿一个跟画面无关的代理指标当答案
       —— 而这个仓库被那种尺子骗过四次。 */
    for (const [path, marker] of [
      ["books", /Trial balance|Opening figures|Where you stand/i],
      ["payroll", /This pay run|What each person is on/i],
      ["tax", /Who this business is|Check one document/i],
    ]) {
      await mp.goto(`${BASE}/en/portal/${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 180000,
      });
      await mp.waitForTimeout(2000);
      const seen = await mp.locator("body").innerText();
      if (!marker.test(seen)) ok(`🔴 师傅看不到 ${path}`);
      else no(`🔴 师傅看得到 ${path}`, seen.slice(0, 120));
    }
    const mateRail = await mp.locator("nav").first().innerText().catch(() => "");
    if (!/Books|^Pay$|Tax/m.test(mateRail)) ok("🔴 而侧栏上也不给他那几条连结");
    else no("🔴 侧栏上给了师傅一条通往 404 的连结");
    await mp.screenshot({ path: `${OUT}/16-mate-rail.png`, fullPage: true });
    await admin.auth.admin.deleteUser(mate.user.id).catch(() => {});
  }
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
