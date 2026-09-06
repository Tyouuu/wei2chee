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
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
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

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);
const api = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false },
  },
);

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
  const { error: inErr } = await api.auth.signInWithPassword({
    email,
    password,
  });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;
  await api.rpc("set_project_style", { new_style: "swiss" });
  for (const k of [
    "customers",
    "quotations",
    "payments",
    "staff",
    "bookings",
  ]) {
    /* ⚠️ 签名是 `(requested_key, new_title)` —— 旧的 `new_page_key` 已经不在了
       （20260905110000）。而 PostgREST 找不到那支函式只是回一个 error，
       **不抛** —— 于是没有添加到的那几页静静地不存在，
       而它下面那一条红看起来像产品坏了。 */
    const { error: pgErr } = await api.rpc("add_project_page", {
      requested_key: k,
      new_title: "",
    });
    if (pgErr && !/already/i.test(pgErr.message))
      console.log(`  ⚪ 台面：${k} — ${pgErr.message}`);
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
  await page.goto(`${BASE}/en/login`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
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
  await page
    .getByRole("button", { name: /^Save$/ })
    .first()
    .click();
  await page.waitForTimeout(2600);

  const { data: openRow } = await admin
    .from("opening_balances")
    .select("code, amount_cents, as_on")
    .eq("project_id", pid);
  const first = (openRow ?? [])[0];
  if (first && Number(first.amount_cents) === 2000000)
    ok("开帐真的写进去了（RM 20,000）");
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
  await page.screenshot({
    path: `${OUT}/3-contracts-empty.png`,
    fullPage: true,
  });

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
  const jobPick = page
    .locator("select")
    .filter({ hasText: /Quotations|Orders/i });
  if (await jobPick.count())
    ok("🔴 「顺手开一张单」那个下拉在（页面查得到他那几页）");
  else no("🔴 那个下拉不在 —— project_pages 那一句查询静静地失败了");
  await page.screenshot({
    path: `${OUT}/4-contracts-signed.png`,
    fullPage: true,
  });

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
    await page.screenshot({
      path: `${OUT}/5-contracts-came.png`,
      fullPage: true,
    });
  } else {
    /* 🔴 它不在的时候，意思是那一行被画成「已经记过了」——
       `due_visits` 对一次还没记过的到期回的是 `'due'`，不是 null。 */
    no("画面上没有「来过了」那颗按钮 —— 那一行被画成已经记过了");
  }

  /* ── 🔴 每一份合约：改隔多久一次 · 停掉 ──────────────────────────────
     `update_service_contract` · `set_contract_archived` 从建出来那天起
     **画面上一个入口都没有**，而这一页原本只问得到「该去了」跟
     「快到期了」—— 一份跑到一半的合约到不了。
     「一年洗两次改成三次」是这一行每一年都会做的事。 */
  await open("contracts");
  await page.waitForTimeout(1200);
  const fixOne = page.getByRole("button", { name: /Fix this one/i }).first();
  if ((await fixOne.count()) > 0) {
    ok("🔴 每一份合约那一张卡在（跑到一半的那几份到得了）");
    await fixOne.click();
    await page.waitForTimeout(900);
    await page.locator('input[type="number"]').first().fill("3");
    await page.getByRole("button", { name: /^Save$/ }).first().click();
    await page.waitForTimeout(3200);
    const { data: after } = await admin
      .from("service_contracts")
      .select("id, every_months, archived_at")
      .eq("project_id", pid);
    const one = (after ?? [])[0];
    if (Number(one?.every_months) === 3) ok("🔴 隔多久一次改得了");
    else no("🔴 改不了", JSON.stringify(after));

    /* 🔴 先从同一扇门再签一份，才停掉第一份。

       不是为了凑数：**侧栏那一行是「你有这个」，不是「这里可以做这个」**
       （`hasContracts` 数的是还在跑的那几份），而永远打得开的那扇门
       在「加一单」底下那条架子上，无条件画。
       所以停掉唯一那一份之后侧栏少一行是**对的**，
       ⚠️ 而我 2026-09-07 第一版停完就去量侧栏，量到的是我自己刚做的事。 */
    await page.getByLabel("For").selectOption({ label: "Hup Seng Trading" });
    await page.getByLabel("What you do").fill("Service the compressor");
    await page.getByRole("button", { name: /Sign it/i }).click();
    await page.waitForTimeout(3200);

    /* 🔴 停掉不是删掉 —— 已经做过的那几次还在。 */
    await page.getByRole("button", { name: /Fix this one/i }).first().click();
    await page.waitForTimeout(900);
    await page
      .getByRole("button", { name: /Stop this contract/i })
      .first()
      .click();
    await page.waitForTimeout(3200);
    const { data: stopped } = await admin
      .from("service_contracts")
      .select("archived_at")
      .eq("id", one.id)
      .single();
    if (stopped?.archived_at) ok("🔴 停得掉");
    else no("🔴 停不掉", JSON.stringify(stopped));
    const { data: keptVisits } = await admin
      .from("service_visits")
      .select("status")
      .eq("project_id", pid);
    if ((keptVisits ?? []).length >= 1)
      ok("🔴 而做过的那几次还在 —— 停掉不是删掉");
    else no("🔴 做过的那几次不见了", JSON.stringify(keptVisits));

    /* 停掉的那一份从清单上走了，而另一份还在 —— 少了后半句，
       一支把整页弄空的实作也会过。 */
    /* ⚠️ 用**那几个字**找，不要用「第几个 ul」——
       第一个 ul 是侧栏，而我 2026-09-07 第一版就是那样量的，
       於是一份**真的还在**的合约被报成不见了。 */
    const stillThere = await page
      .getByText("Service the compressor", { exact: false })
      .count();
    if (stillThere > 0)
      ok("🔴 另一份还在（停掉的是那一份，不是这一页）");
    else no("🔴 另一份也不见了");
  } else {
    no("🔴 每一份合约那一张卡不在 —— 跑到一半的合约到不了");
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
  if ((await page.getByRole("button", { name: /Open the run/i }).count()) === 0)
    ok("🔴 没有人有底薪的时候不画「开一次」");
  else no("🔴 没有人有底薪却画了「开一次」");
  await page.screenshot({
    path: `${OUT}/6-payroll-noterms.png`,
    fullPage: true,
  });

  await page.getByLabel("Rate (RM)").first().fill("2500");
  await page
    .getByRole("button", { name: /^Save$/ })
    .first()
    .click();
  await page.waitForTimeout(2600);

  const { data: terms } = await admin
    .from("staff_pay_terms")
    .select("rate_cents, basis")
    .eq("project_id", pid);
  if ((terms ?? [])[0] && Number(terms[0].rate_cents) === 250000)
    ok("底薪写进去了（RM 2,500）");
  else no("底薪没写进去", JSON.stringify(terms));

  await open("payroll");
  await page.getByRole("button", { name: /Open the run/i }).click();
  await page.waitForTimeout(3600);

  const { data: runs } = await admin
    .from("pay_runs")
    .select("id, paid_at")
    .eq("project_id", pid);
  if ((runs ?? []).length === 1) ok("开出来一张薪水单");
  else no("薪水单没开出来", JSON.stringify(runs));

  /* ⚠️ 重新载入，不等 `router.refresh()` —— 开发模式下那一次
     重画要等编译，而一把因为编译慢而红的尺，跟一把抳到
     bug 的尺在报告里长得一模一样。 */
  await open("payroll");

  /* 🔴 只量**那一张卡**，不量整页 —— “Ah Meng” 同时在底下
     「每个人的底薪」那一卡上，拿整页去匹配会在一张**空的**
     薪水单上报 PASS。保养合约那一轮它已经骗过我一次。 */
  const runCard = page.locator("section").first();
  const pay1 = await runCard.innerText().catch(() => "");
  if (/Ah Meng/.test(pay1)) ok("那个人出现在那一张薪水单上");
  else no("那一张薪水单上没有那个人", pay1.slice(0, 200));
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
    if (slip && Number(slip.deduction_cents) > 0)
      ok("🔴 公积金社险自己算出来了（他一个字没打）");
    else no("🔴 法定那几笔是零", JSON.stringify(slip));
    if (slip && Number(slip.net_cents) < Number(slip.gross_cents))
      ok("拿回家的比赚的少");
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
  const { data: runs2 } = await admin
    .from("pay_runs")
    .select("paid_at")
    .eq("project_id", pid);
  if ((runs2 ?? [])[0]?.paid_at) ok("发出去了，整张锁住");
  else no("发不出去", JSON.stringify(runs2));
  await page.screenshot({ path: `${OUT}/8-payroll-paid.png`, fullPage: true });

  // ── ④ 税 ───────────────────────────────────────────────────────────────
  if ((await open("tax")) === 200) ok("税那一页打得开");
  else no("税那一页打不开");
  /* 左边那一列：三段，而且每一段自己讲状态。 */
  const taxTabs = page.getByRole("button", {
    name: /Who this business is|^SST|Check one document/i,
  });
  if ((await taxTabs.count()) === 3) ok("左边那一列三段都在");
  else no("左边那一列不是三段", String(await taxTabs.count()));

  /* 🔴 什么都还没填的时候先开「这门生意是谁」——
     那时候「拿一张单试」的答案是「每一样都缺」，一句真话而它答不了
     他下一步该做什么。 */
  if (await page.getByLabel("Tax number (TIN)").isVisible())
    ok("🔴 还没填的时候先开填的那一段");
  else no("🔴 还没填却先开了别段");

  /* 🔴 还没登记 SST 就不画那几个数字 —— 一张写着「SST RM 0.00」的单，
     是在讲一件他没有资格讲的话。
     ⚠️ 问的是**那一张卡**，不是整页：左边那一列现在也写着
     「Not registered」，拿整页去问会变成在量那一行字，不是量那一段。 */
  await page.getByRole("button", { name: /^SST/i }).click();
  await page.waitForTimeout(400);
  const sstCard = await page.locator("section.ds-card").first().innerText();
  if (/Not registered/i.test(sstCard)) ok("🔴 还没登记就讲出来，不画一个 RM 0");
  else no("🔴 还没登记却画了税额", sstCard.slice(0, 200));
  await page.screenshot({ path: `${OUT}/9-tax-empty.png`, fullPage: true });

  await page.getByRole("button", { name: /Who this business is/i }).click();
  await page.waitForTimeout(400);

  await page.getByLabel("Tax number (TIN)").fill("C1234567890");
  await page.getByLabel("SSM number").fill("202601234567");
  await page
    .getByRole("button", { name: /^Save$/ })
    .first()
    .click();
  await page.waitForTimeout(2600);
  const { data: prof } = await admin
    .from("tax_profile")
    .select("tin, reg_no")
    .eq("project_id", pid)
    .maybeSingle();
  if (prof?.tin === "C1234567890") ok("纳税人编号写进去了");
  else no("纳税人编号没写进去", JSON.stringify(prof));

  await open("tax");
  /* 🔴 填过了就先开他回来要做的那一件 —— 不用他自己去点。
     ⚠️ 问的是**开着那一张卡自己的抬头**。第一版问
     `getByLabel(/^Document$/)`，而一个包着 select 的 label，
     它的名字里连每一个选项的字都算进去 —— 於是那一条红了，
     而画面是对的（底下写税率那几步只有在这一段里才做得到）。
     **第二十二次红的是我的尺。** */
  const taxOpen = await page.locator("section.ds-card h2").first().innerText();
  if (/Check one document/i.test(taxOpen)) ok("🔴 填过了先开拿一张单试那一段");
  else no("🔴 填过了还是开在填的那一段", taxOpen);
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
  if (/Nothing here is sent anywhere/i.test(tax1))
    ok("画面上讲出「什么都不会送出去」");
  else no("没有讲出它还不是什么");
  await page.screenshot({ path: `${OUT}/10-tax-check.png`, fullPage: true });

  /* 这一张单的税率。 */
  /* 🔴 挑明白那一张 —— 下拉里排第一的是**最新**那一张，
     而保养合约那一段刚刚又开了一张。我第一版没挑，
     于是税率写到了另外那一张上，而断言去问我自己那一张 ——
     **第二十一次红的是我的道具。** */
  await page.locator("select").last().selectOption(jobId);
  await page.waitForTimeout(600);
  await page.getByLabel(/Tax on this one/i).fill("8");
  await page.getByRole("button", { name: /Put it on this one/i }).click();
  await page.waitForTimeout(3000);
  const { data: rec2 } = await admin
    .from("pipeline_records")
    .select("tax_rate")
    .eq("id", jobId)
    .maybeSingle();
  if (rec2 && Number(rec2.tax_rate) === 8) ok("税率写在那一张单上了");
  else no("税率没写上去", JSON.stringify(rec2));

  // ── ④a 总览那张「客户」卡 ─────────────────────────────────────────────
  /* 🔴 它数过三种人。老板 2026-09-07 自己去排查，回来讲：
     「客户 ＋ 供应商 ＋ 师傅加起来，而标签写着『客户』」——
     **一个错的数字配一个对的标签**，而他看到那个数字不会怀疑它。

     台面：1 个客户 · 1 个师傅 · 1 个供应商。那张卡该写 1，不是 3。 */
  const { error: supErr } = await api.rpc("add_directory_entry", {
    in_project_id: pid,
    in_module_key: "suppliers",
    in_name: "Chop Wah Kee",
  });
  if (supErr) no("台面：供应商建不了", supErr.message);

  await open("dashboard");
  const board = await page.locator("body").innerText();
  /* ⚠️ 那张卡的抬头是**他自己的那个词**（`nouns.customer`），
     所以是「Customer」不是「Customers」—— 我第一版找复数，
     於是对着一张已经修好的卡报「读不到」。 */
  const custCard = /\bCustomers?\b\s*\n\s*(\d+)/.exec(board)?.[1] ?? "";
  if (custCard === "1") ok("🔴 总览那张「客户」卡只数客户");
  else no("🔴 那张卡数的不只是客户", `画面 ${custCard || "读不到"} · 应该是 1`);

  // ── ④b 出勤 ───────────────────────────────────────────────────────────
  /* `log_work_day` · `work_days_of` · `days_worked`（20260906550000）——
     三支画面上一个入口都没有，而少了它，一个按天算的师傅开一次薪
     拿到的是一张空的薪资单（[任务 228] 的收尾）。 */
  if ((await open("attendance")) === 200) ok("出勤那一页打得开");
  else no("出勤那一页打不开");

  /* 一片格子 ← `up-productivity` 那一张月历。 */
  /* ⚠️ 数的是**一个月的每一天**，不是按得到的那几天 ——
     我第一版数按钮，而今天是六号，於是它对着一张完全正确的月历
     报「那一片格子没画出来 — 6」。按不按得到是下面那一条在量的事。 */
  const dayCells = await page.locator('[data-attendance="day"]').count();
  const pressable = await page
    .locator('[data-attendance="grid"] button')
    .count();
  if (dayCells >= 28) ok(`那一片格子画出来了 · ${dayCells} 天`);
  else no("那一片格子没画出来", String(dayCells));

  /* 🔴 明天不是按钮 —— `log_work_day` 自己会拒绝还没发生的日子，
     而一颗按下去一定失败的按钮是这个仓库禁的第一条。
     所以按得到的格子数**不可以**等於这个月的天数（除非今天是最后一天）。 */
  const mytNow = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const dayOfMonth = Number(mytNow.slice(8));
  const inMonth = new Date(
    Date.UTC(Number(mytNow.slice(0, 4)), Number(mytNow.slice(5, 7)), 0),
  ).getUTCDate();
  if (pressable === dayOfMonth) ok("🔴 只有已经过完的那几天按得到");
  else if (dayOfMonth === inMonth) ok("⚠️ 今天是这个月最后一天，这一条量不到");
  else
    no(
      "🔴 还没到的日子也按得下去",
      `按得到 ${pressable} · 今天 ${dayOfMonth} 号`,
    );

  /* 挑一天之前不画那三颗 —— 点一格是「挑那一天」，不是当场改掉它。 */
  if ((await page.getByRole("button", { name: /^Full day$/ }).count()) === 0)
    ok("🔴 还没挑一天，那三颗不画");
  else no("🔴 没挑就画了那三颗");

  await page.locator('[data-attendance="grid"] button').first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Full day$/ }).click();
  await page.waitForTimeout(3000);

  const { data: wd1 } = await admin
    .from("work_days")
    .select("on_date, kind")
    .eq("project_id", pid);
  if ((wd1 ?? []).length === 1 && wd1[0].kind === "full")
    ok("那一天真的记进去了");
  else no("那一天没记进去", JSON.stringify(wd1));

  /* 🔴 半天算半天，而那个数字是**资料库算的** ——
     在浏览器里把格子加起来就是同一个问题两个答案。 */
  await page.locator('[data-attendance="grid"] button').nth(1).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Half day$/ }).click();
  await page.waitForTimeout(3000);
  await open("attendance");
  const att = await page.locator("body").innerText();
  if (/1\.5 days worked/.test(att)) ok("🔴 半天算半天 · 1.5 天");
  else no("🔴 半天没有算半天", att.slice(0, 300));
  if (/2 recorded/.test(att)) ok("记了两天");
  else no("记了几天不对", att.slice(0, 300));

  /* 同一天再记一次是**改**，不是多一行。 */
  await page.locator('[data-attendance="grid"] button').first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Away$/ }).click();
  await page.waitForTimeout(3000);
  const { data: wd2 } = await admin
    .from("work_days")
    .select("on_date, kind")
    .eq("project_id", pid);
  if ((wd2 ?? []).length === 2) ok("同一天再记一次是改，不是多一行");
  else no("同一天记出了两行", JSON.stringify(wd2));
  await page.screenshot({ path: `${OUT}/16-attendance.png`, fullPage: true });

  // ── ④c 谁有空 ─────────────────────────────────────────────────────────
  /* `who_is_free` · `staff_hours_of` · `set_staff_hours`（20260906430000）——
     三支画面上一个入口都没有（[任务 224] 的收尾）。 */
  if ((await open("rota")) === 200) ok("谁有空那一页打得开");
  else no("谁有空那一页打不开");

  /* 🔴 一行班都没排 → 每一个人都算有空，而且讲出来。
     那是 `who_is_free` 自己写在代码里的，理由是 20260902030000 拒绝
     整套上班时间引擎的那一句：不填也用得了。 */
  const rota0 = await page.locator("body").innerText();
  if (/Nobody has hours set yet/i.test(rota0)) ok("🔴 还没排班的时候讲出来了");
  else no("🔴 还没排班却没讲", rota0.slice(0, 240));
  if (/\bFree\b/.test(rota0)) ok("🔴 还没排班的时候，人算有空");
  else no("🔴 还没排班却说没空", rota0.slice(0, 240));
  const rails = await page.locator('[data-rota="rail"]').count();
  if (rails >= 1) ok(`一个人一条轨道 · ${rails} 条`);
  else no("一条轨道都没画");

  /* 排一个礼拜：星期一 10:00–19:00。 */
  const monInput = page.locator('[data-rota="roster"] li input[type="time"]');
  await monInput.nth(0).fill("10:00");
  await monInput.nth(1).fill("19:00");
  await page.getByRole("button", { name: /Save the week/i }).click();
  await page.waitForTimeout(3200);

  const { data: hrs } = await admin
    .from("staff_hours")
    .select("weekday, starts_at, ends_at")
    .eq("project_id", pid);
  if ((hrs ?? []).length === 1 && hrs[0].weekday === 1)
    ok("那一个礼拜存进去了（星期一）");
  else no("那一个礼拜没存进去", JSON.stringify(hrs));

  /* 🔴 排完之后它才真的在答问题：同一个星期一，班里跟班外两个答案。
     ⚠️ 挑的是**下一个星期一**，不是今天 —— 一把只在星期一跑得对的尺，
     一个礼拜里有六天在说谎。 */
  const nextMon = (() => {
    const d = new Date(Date.now() + 8 * 3600e3);
    d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
    return d.toISOString().slice(0, 10);
  })();
  await open(`rota?d=${nextMon}&s=14:00&e=15:00`);
  const inShift = await page.locator("body").innerText();
  if (/\bFree\b/.test(inShift)) ok("🔴 班里那一格 · 有空");
  else no("🔴 班里那一格没说有空", inShift.slice(0, 300));

  await open(`rota?d=${nextMon}&s=20:00&e=21:00`);
  const outShift = await page.locator("body").innerText();
  if (/Not rostered/i.test(outShift)) ok("🔴 班外那一格 · 没排班");
  else no("🔴 班外那一格没说没排班", outShift.slice(0, 300));
  await page.screenshot({ path: `${OUT}/18-rota.png`, fullPage: true });

  // ── ④d 班 ─────────────────────────────────────────────────────────────
  /* 十一支画面上一个入口都没有。而少了它，**补习那一行用不了这个产品**：
     一堂十个学生的课，照旧的做法要开十行预约，而那条不准撞的约束
     会把第二行到第十行全部拒绝。 */
  if ((await open("classes")) === 200) ok("班那一页打得开");
  else no("班那一页打不开");

  /* ⚠️ 在**那一张卡里面**找 —— 「Name」这个字在这个壳里有四个
     （加一页的对话框、两个设定框），而 `getByLabel` 打到全部。 */
  const newClass = page.locator('[data-classes="new"]');
  await newClass.locator('input[type="text"]').fill("Form 4 Maths");
  await newClass.locator('input[type="number"]').fill("8");
  await newClass.getByRole("button", { name: /Add the class/i }).click();
  await page.waitForTimeout(3200);

  const { data: cls } = await admin
    .from("class_groups")
    .select("id, name, capacity")
    .eq("project_id", pid);
  if ((cls ?? [])[0]?.name === "Form 4 Maths") ok("那一个班开出来了");
  else no("那一个班没开出来", JSON.stringify(cls));

  /* 摊开：名单空的 → 加一个学生 → 名单上有他。 */
  await page.getByRole("button", { name: /Form 4 Maths/ }).click();
  await page.waitForTimeout(2000);
  const empty = await page.locator("body").innerText();
  if (/Nobody on this class yet/i.test(empty)) ok("刚开的班，名单是空的");
  else no("名单不是空的", empty.slice(0, 200));

  await page
    .locator('[data-classes="groups"] select')
    .first()
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: /^Add$/ }).click();
  await page.waitForTimeout(3000);
  const { data: mem } = await admin
    .from("class_members")
    .select("party_id, left_on")
    .eq("group_id", cls[0].id);
  if ((mem ?? []).filter((m) => !m.left_on).length === 1)
    ok("一个学生进了名单");
  else no("学生没进名单", JSON.stringify(mem));

  /* 一个礼拜几点上：星期一 16:00–17:00。 */
  const slotInputs = page.locator('[data-classes="groups"] input[type="time"]');
  await slotInputs.nth(0).fill("16:00");
  await slotInputs.nth(1).fill("17:00");
  await page.getByRole("button", { name: /Save the hours/i }).click();
  await page.waitForTimeout(3200);
  const { data: sl } = await admin
    .from("class_slots")
    .select("weekday, starts_at")
    .eq("group_id", cls[0].id);
  if ((sl ?? []).length === 1 && sl[0].weekday === 1)
    ok("那一个时段存进去了（星期一）");
  else no("那一个时段没存进去", JSON.stringify(sl));

  /* 🔴 排好之后，接下来两个礼拜的课自己长出来 —— 而且带着状态。 */
  await open("classes");
  const due0 = await page.locator("body").innerText();
  if (/Form 4 Maths/.test(due0) && /Not opened/i.test(due0))
    ok("🔴 接下来那几堂自己长出来，而且写着「还没开」");
  else no("🔴 那几堂没长出来", due0.slice(0, 400));
  /* 🔴 印的是**墙上时钟**，不是 UTC —— 我排的是下午四点，
     而第一版切 ISO 字串印出「08:00」，数字全绿、看图才看到。 */
  if (/16:00.{0,3}17:00/.test(due0)) ok("🔴 那一堂印的是他排的那个钟点");
  else no("🔴 那一堂的钟点印错了", due0.slice(0, 400));

  await page
    .getByRole("button", { name: /^Open it$/ })
    .first()
    .click();
  await page.waitForTimeout(3400);
  const opened = await page.locator("body").innerText();
  if (/Not marked yet/i.test(opened))
    ok("🔴 开出来了，而且**开出来不等於点过名**");
  else no("🔴 开出来之后状态不对", opened.slice(0, 400));

  await page
    .getByRole("button", { name: /Take attendance/i })
    .first()
    .click();
  await page.waitForTimeout(2400);
  await page
    .locator('[data-classes="attendance"]')
    .getByRole("button", { name: /^Came$/ })
    .first()
    .click();
  await page.waitForTimeout(3200);
  const { data: attRows } = await admin
    .from("class_attendance")
    .select("status")
    .eq("project_id", pid);
  if ((attRows ?? [])[0]?.status === "came") ok("点名真的记进去了");
  else no("点名没记进去", JSON.stringify(attRows));
  await open("classes");
  const marked = await page.locator("body").innerText();
  if (/\bMarked\b/.test(marked)) ok("🔴 点完之后那一行写着「点过了」");
  else no("🔴 点完之后状态没变", marked.slice(0, 400));
  /* 🔴 一个班开出来之后改得了，也关得掉（`update_class_group`，
     2026-09-07 之前画面上一个入口都没有）。一个老师换人、
     一个班从八个位子加到十个，是每一个学期都会做的事。 */
  await page.getByRole("button", { name: /Form 4 Maths/ }).click();
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: /Fix this class/i }).click();
  await page.waitForTimeout(800);
  const editCard = page.locator('[data-classes="groups"]');
  await editCard.locator('input[type="text"]').first().fill("Form 5 Maths");
  await editCard.locator('input[type="number"]').first().fill("12");
  await editCard.getByRole("button", { name: /^Save$/ }).first().click();
  await page.waitForTimeout(3200);
  const { data: fixed } = await admin
    .from("class_groups")
    .select("name, capacity, archived_at")
    .eq("id", cls[0].id)
    .single();
  if (fixed?.name === "Form 5 Maths" && Number(fixed?.capacity) === 12)
    ok("🔴 改得了名字跟人数");
  else no("🔴 改不了", JSON.stringify(fixed));

  /* 🔴 关掉不是删掉 —— 上过的课跟点过的名都还在。
     ⚠️ **不要再点一次那个班** —— 存完之后它还是展开的（展开是浏览器
     这一边的状态，`router.refresh()` 碰不到它），再点一次是把它收起来。
     第一版就是这样，於是「改这个班」那颗找不到，看起来像它不见了。 */
  await page.getByRole("button", { name: /Fix this class/i }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Close this class/i }).click();
  await page.waitForTimeout(3200);
  const { data: closed } = await admin
    .from("class_groups")
    .select("archived_at")
    .eq("id", cls[0].id)
    .single();
  if (closed?.archived_at) ok("🔴 关掉了");
  else no("🔴 没关掉", JSON.stringify(closed));
  const { data: keptAtt } = await admin
    .from("class_attendance")
    .select("status")
    .eq("project_id", pid);
  if ((keptAtt ?? []).length === 1)
    ok("🔴 而点过的那一次还在 —— 关掉不是删掉");
  else no("🔴 点过的那一次不见了", JSON.stringify(keptAtt));
  await open("classes");
  const afterClose = await page.locator("body").innerText();
  if (!/Form 5 Maths/.test(afterClose)) ok("关掉之后它不在这一页上");
  else no("关掉之后它还在这一页上", afterClose.slice(0, 300));

  await page.screenshot({ path: `${OUT}/20-classes.png`, fullPage: true });

  // ── ④e 「拿走我的资料」 ───────────────────────────────────────────────
  /* 🔴 那颗按钮自己去抓四样（专案 · 页面 · 询价 · 照片），而库里 49 张表 ——
     8-30 之后建的**一张都不在里面**。而「免费，随时」是已经写在页面上的
     承诺（任务 64）。2026-09-07 换成 `export_my_data`。 */
  await open("account");
  await page
    .getByRole("button", { name: /^Your data$/i })
    .click()
    .catch(() => {});
  await page.waitForTimeout(1200);
  const dl = page.waitForEvent("download", { timeout: 60000 });
  await page
    .getByRole("button", { name: /Download|Export/i })
    .first()
    .click();
  const file = await dl;
  const path = await file.path();
  const dump = JSON.parse(readFileSync(path, "utf8"));
  const keys = Object.keys(dump);
  /* 🔴 那几张真的会装着他生意的表，一张都不可以少。 */
  const want = [
    "pipeline_records",
    "ledger_entries",
    "directory_entries",
    "catalog_items",
    "appointments",
  ];
  const short = want.filter((k) => !(k in dump));
  if (short.length === 0) ok(`🔴 汇出档里有他每一张表 · ${keys.length} 个`);
  else
    no(
      "🔴 汇出档里少了那几张表",
      `${short.join(" · ")} — 有的：${keys.join("/")}`,
    );
  /* 而照片照旧列出来 —— 那几张网址会在停止托管那天失效。 */
  if ("photos" in dump) ok("照片照旧列出来");
  else no("照片不见了", keys.join("/"));

  // ── ⑤ 侧栏上真的看得到（一条按得到的连结）─────────────────────────────
  await open("");
  /* ⚠️ 等那一条侧栏真的画出来 —— 开发模式下第一次编译
     可能比那个固定的等待长，而一把因为编译慢而红的尺，
     跟一把抳到 bug 的尺在报告里长得一模一样，
     而一把时不时叫一声的尺没有人会看。 */
  await page
    .locator("nav")
    .first()
    .getByText(/Books/i)
    .first()
    .waitFor({ timeout: 60000 })
    .catch(() => {});
  /* ⚠️ 认那一条**有名字的** nav —— 模块页对老板打开的是编辑器，
     而编辑器自己也有一个 nav（Blocks / Outline）。
     我第一版拿 `nav` 的第一个，於是它读的是那一个，
     然后回报「侧栏底下少了」，看起来完全像侧栏做坏了。 */
  const railHome = await page
    .locator('aside[aria-label="Main navigation"] nav')
    .first()
    .innerText();
  const rows = (s) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  /* 🔴 新规矩（2026-09-06，老板：「现在太多东西了」）：
     一件工具住在**它讲的那一页**底下，打开那一页才画出来。
     所以站在首页的时候，那几行**不该在**。 */
  const homeRows = rows(railHome);
  const hidden = ["Books", "Tax", "Pay", "Days worked", "Who is free"].filter(
    (l) => !homeRows.includes(l),
  );
  if (hidden.length === 5) ok("🔴 首页那条侧栏上没有那几件工具");
  else no("🔴 首页那条侧栏上还挂着工具", homeRows.join(" · "));

  /* 而按那一行右边那支箭，它们就在那一页底下摊开。
     ⚠️ **不是「打开那一页」** —— 模块页不在这个壳里，点进去连侧栏都没有了。 */
  const rail = page.locator('aside[aria-label="Main navigation"]');
  for (const [pageLabel, labels] of [
    ["Payments", ["Books", "Tax"]],
    ["Staff", ["Days worked", "Who is free", "Pay"]],
    ["Customers", ["Service contracts"]],
    ["Bookings", ["Classes"]],
  ]) {
    await rail
      .locator("a", { hasText: new RegExp(`^${pageLabel}$`) })
      .first()
      .locator("button")
      .click();
    await page.waitForTimeout(400);
    const here = rows(await rail.locator("nav").first().innerText());
    const missing = labels.filter((l) => !here.includes(l));
    if (missing.length === 0)
      ok(`🔴 摊开「${pageLabel}」，它底下就有 ${labels.join(" · ")}`);
    else
      no(
        `🔴 「${pageLabel}」底下少了`,
        `${missing.join(" · ")} — 侧栏：${here.join("/")}`,
      );
  }

  /* ⚠️ 车牌是按有没有资料画的 —— 这个帐号一台车都没有，所以**不该**在。 */
  if (!railHome.includes("Plates")) ok("⚠️ 一台车都没有，车牌那一行不画");
  else no("一台车都没有却画了车牌");
  await page.screenshot({ path: `${OUT}/11-rail.png`, fullPage: true });

  // ── ⑥ 手机上 ───────────────────────────────────────────────────────────
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await phone.goto(`${BASE}/en/login`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await phone.fill('input[type="email"]', email);
  await phone.fill('input[type="password"]', password);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  for (const [n, path] of [
    [12, "books"],
    [13, "contracts"],
    [14, "payroll"],
    [15, "tax"],
    [17, "attendance"],
    [19, "rota"],
    [21, "classes"],
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
    await phone.screenshot({
      path: `${OUT}/${n}-${path}-390.png`,
      fullPage: true,
    });
  }

  // ── ⑦ 反过来那一半：师傅打不开钱那几页 ────────────────────────────────
  const mateEmail = `mate-${stamp}@formae.test`;
  const matePass = `Mate-${stamp}-x!`;
  const { data: mate } = await admin.auth.admin.createUser({
    email: mateEmail,
    password: matePass,
    email_confirm: true,
  });
  const { error: invErr } = await api.rpc("add_project_member", {
    in_email: mateEmail,
  });
  if (invErr) {
    console.log(`  ⚪ 请不动人（${invErr.message}）—— 师傅那一段跳过`);
  } else {
    const mp = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
      reducedMotion: "reduce",
    });
    await mp.goto(`${BASE}/en/login`, {
      waitUntil: "networkidle",
      timeout: 180000,
    });
    await mp.fill('input[type="email"]', mateEmail);
    await mp.fill('input[type="password"]', matePass);
    await mp.click('button[type="submit"]');
    await mp.waitForURL(/portal/, { timeout: 180000 });

    /* 控制组先跑 —— 没有它，下面那三条量的是空气（任务 125）。 */
    const conRes = await mp.goto(`${BASE}/en/portal/contracts`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    if ((conRes?.status() ?? 0) === 200)
      ok("控制组：师傅打得开保养合约（那是他一天的工作）");
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
    const mateRail = await mp
      .locator("nav")
      .first()
      .innerText()
      .catch(() => "");
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
