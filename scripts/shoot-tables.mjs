/**
 * 餐台 · 厨房那两扇门：真的登入，真的按。
 *
 * ── 为什么（2026-09-08）─────────────────────────────────────────────────
 *
 * `seat_table` · `close_table` · `tables_now` · `add_dining_table` ·
 * `update_dining_table` · `append_record_line` · `serve_line` ·
 * `kitchen_queue` —— **八支，画面上一个入口都没有**，而两条任务的收尾
 * 自己都写着「画面上八扇门一扇都没有」。
 *
 * ── ⚠️ 它量的是画面，不是回码 ──────────────────────────────────────────
 *
 * `notFound()` 在这个壳里回的是 **200 配一张找不到的页**，所以拿状态码
 * 当答案，就是拿一个跟画面无关的代理指标当答案 ——
 * 这个仓库被那种尺子骗过四次。
 *
 * ── 🔴 每按一次就回资料库对一次 ────────────────────────────────────────
 *
 * 「画面上写着开台了」跟「资料库里真的有一张单」是两件事，
 * 而这个仓库二十几次「说了没做」全部掉在那条缝里。
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
const OUT = ".screenshots/tables";
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
  { auth: { persistSession: false } },
);
const api = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

let userId = null;
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
  const stamp = Date.now();
  const email = `kopitiam-${stamp}@formae.test`;
  const password = `Kopitiam-${stamp}-x!`;
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
  /* 餐饮开局那几页。`orders` 是餐台单要落的那一页。 */
  for (const k of ["customers", "orders", "payments"]) {
    const { error: pgErr } = await api.rpc("add_project_page", {
      requested_key: k,
      new_title: "",
    });
    if (pgErr && !/already/i.test(pgErr.message))
      console.log(`  ⚪ 台面：${k} — ${pgErr.message}`);
  }

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


  /* 🔴 等那句话**真的画出来**，不要数秒。
     router.refresh() 多久落地看这台机器在忙什么（三个 session 共用一棵树，
     每改一次开发服务器就要重编译）—— 而一把有时候红有时候绿的尺，
     跟一把坏掉的尺是同一件事（重点 24）。实测：同样的代码，
     一轮 27 全过，下一轮「那一桌没有画金额」红。 */
  const waited = async (re, ms = 20000) => {
    const until = Date.now() + ms;
    let last = "";
    while (Date.now() < until) {
      last = await page.locator("body").innerText();
      if (re.test(last)) return { hit: true, body: last };
      await page.waitForTimeout(400);
    }
    return { hit: false, body: last };
  };
  const open = async (path) => {
    await page.goto(`${BASE}/en/portal/${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await page.waitForTimeout(2600);
    return page.locator("body").innerText();
  };

  // ── ① 一张桌都还没有 ───────────────────────────────────────────────────
  console.log("\n① 一张桌都还没有");
  let hit;
  let body = await open("tables");
  if (/No tables yet/i.test(body)) ok("空的时候画的是一句话，不是一片空白");
  else no("空的时候画了别的", body.slice(0, 160));
  if (!/[一-鿿]/.test(body)) ok("英文系统上一个中文都没有");
  else no("英文系统上有中文", (body.match(/[一-鿿]+/g) ?? []).join(" "));
  await page.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });

  // ── ② 开三张桌 ─────────────────────────────────────────────────────────
  console.log("\n② 开三张桌");
  for (const [name, seats] of [
    ["3", "4"],
    ["5", "2"],
    ["6", "6"],
  ]) {
    await page.getByLabel(/What you call it/i).fill(name);
    await page.getByLabel(/^Seats$/i).fill(seats);
    await page.getByRole("button", { name: /Open a table/i }).click();
    await page.waitForTimeout(1800);
  }
  const { data: tbls } = await admin
    .from("dining_tables")
    .select("id, name, seats")
    .eq("project_id", pid)
    .order("name");
  if ((tbls ?? []).length === 3) ok("三张桌真的开进去了");
  else no("桌没开出来", JSON.stringify(tbls));
  const t3 = (tbls ?? []).find((t) => t.name === "3");

  ({ hit, body } = await waited(/\bFree\b/));
  if (hit) ok("画面上写着「空着」");
  else no("画面上没有写空着", body.slice(0, 200));
  await page.screenshot({ path: `${OUT}/2-three-tables.png`, fullPage: true });

  // ── ③ 客人坐下 ─────────────────────────────────────────────────────────
  console.log("\n③ 三号桌坐下");
  await page
    .locator('[data-table="3"]')
    .getByRole("button", { name: /Seat a party/i })
    .click();
  await page.waitForTimeout(3000);

  const { data: recs } = await admin
    .from("pipeline_records")
    .select("id, doc_no, table_id")
    .eq("project_id", pid);
  if ((recs ?? []).length === 1 && recs[0].table_id === t3?.id)
    ok("🔴 资料库里真的多了一张单，而且挂在三号桌上");
  else no("那张单没开出来", JSON.stringify(recs));
  const rid = recs?.[0]?.id;

  ({ hit, body } = await waited(/RM\s*0\.00/));
  if (hit) ok("那一桌画着 RM 0.00 —— 还没点东西");
  else no("那一桌没有画金额", body.slice(0, 200));

  // ── ④ 加两碟 ───────────────────────────────────────────────────────────
  console.log("\n④ 点两样（云吞面 ×2 · 咖啡 ×1）");
  const addDish = async (what, howMany, each) => {
    const card = page.locator('[data-table="3"]');
    await card.getByRole("button", { name: /Add a dish/i }).click();
    await page.waitForTimeout(600);
    await card.getByLabel(/What they ordered/i).fill(what);
    await card.getByLabel(/How many/i).fill(howMany);
    await card.getByLabel(/Each \(RM\)/i).fill(each);
    await card.getByRole("button", { name: /^Add it$/i }).click();
    await page.waitForTimeout(2600);
  };
  await addDish("Wantan mee", "2", "8");
  await addDish("Kopi O", "1", "5.50");

  const { data: lines } = await admin
    .from("record_lines")
    .select("id, description, qty, amount_cents, served_qty")
    .eq("record_id", rid)
    .order("sort_order");
  if ((lines ?? []).length === 2) ok("🔴 两碟真的写进去了");
  else no("那两碟没写进去", JSON.stringify(lines));
  const total = (lines ?? []).reduce((s, l) => s + Number(l.amount_cents), 0);
  if (total === 2150) ok("金额自己算出来 RM 21.50（2×8 ＋ 5.50）");
  else no("金额算错", String(total));

  ({ hit, body } = await waited(/RM\s*21\.50/));
  if (hit) ok("画面上写着 RM 21.50");
  else no("画面上没有那个数字", body.slice(0, 240));
  if (/2 items/i.test(body)) ok("而且写着两样");
  else no("没有写几样", body.slice(0, 240));
  await page.screenshot({ path: `${OUT}/3-seated.png`, fullPage: true });

  // ── ⑤ 厨房 ─────────────────────────────────────────────────────────────
  console.log("\n⑤ 厨房那一屏");
  body = await open("kitchen");
  if (/Wantan mee/.test(body) && /Kopi O/.test(body))
    ok("🔴 两碟都在厨房那一屏上");
  else no("厨房那一屏上没有那两碟", body.slice(0, 240));
  /* ⚠️ 只量那几行菜，不量整页 —— 侧栏上写着 FO**RM**AE，
     而一把把自家招牌算成金额的尺，量的是它自己。 */
  const kitchenText = (
    await page.locator("[data-kitchen-line]").allInnerTexts()
  ).join(" | ");
  if (!/RM/.test(kitchenText))
    ok("🔴 一分钱都没有 —— 厨房不需要知道那一碟卖多少");
  else no("🔴 厨房那一屏上有金额", kitchenText);
  if (!/[一-鿿]/.test(body)) ok("英文系统上一个中文都没有");
  else no("英文系统上有中文", (body.match(/[一-鿿]+/g) ?? []).join(" "));
  await page.screenshot({ path: `${OUT}/4-kitchen.png`, fullPage: true });

  // ── ⑥ 出一碟 ───────────────────────────────────────────────────────────
  console.log("\n⑥ 出一碟（三碟粿条里的一碟 —— 这里是两碟里的一碟）");
  await page
    .locator('[data-kitchen-line="Wantan mee"]')
    .getByRole("button", { name: /^One out$/i })
    .click();
  await page.waitForTimeout(3000);

  const { data: after1 } = await admin
    .from("record_lines")
    .select("description, qty, served_qty")
    .eq("record_id", rid);
  const mee = (after1 ?? []).find((l) => l.description === "Wantan mee");
  if (Number(mee?.served_qty) === 1)
    ok("🔴 资料库里真的出了一碟 —— 是数字不是勾");
  else no("没有出", JSON.stringify(mee));

  /* ⚠️ 等那一句**真的画出来**，不要数秒 —— `router.refresh()` 多久落地
     看这台机器在忙什么，而一把有时候红有时候绿的尺，跟一把坏掉的尺
     是同一件事（任务 203 付过这一次学费）。 */
  const stillLeft = page
    .locator('[data-kitchen-line="Wantan mee"]')
    .getByText(/1 of 2 left/i)
    .first();
  const showed = await stillLeft.waitFor({ timeout: 15000 }).then(
    () => true,
    () => false,
  );
  if (showed) ok("🔴 画面上写着还剩一碟（一共两碟）");
  else
    no(
      "画面上没有写还剩几碟",
      (await page.locator("[data-kitchen-line]").allInnerTexts()).join(" | "),
    );

  // 出多了 —— 那句拒绝要讲差多少
  await page
    .locator('[data-kitchen-line="Wantan mee"]')
    .getByRole("button", { name: /^One out$/i })
    .click();
  await page.waitForTimeout(2600);
  body = await open("kitchen");
  if (!/Wantan mee/.test(body)) ok("🔴 出完了，那一行自己从厨房那一屏上走掉");
  else no("出完了还挂在上面", body.slice(0, 240));
  await page.screenshot({ path: `${OUT}/5-kitchen-after.png`, fullPage: true });

  // ── ⑦ 结帐 ─────────────────────────────────────────────────────────────
  console.log("\n⑦ 结帐（收 RM 25，找 RM 3.50）");
  body = await open("tables");
  const card3 = page.locator('[data-table="3"]');
  await card3.getByRole("button", { name: /^Settle$/i }).click();
  await page.waitForTimeout(600);
  await card3.getByLabel(/Cash taken/i).fill("25");
  /* 🔴 这一颗跟上面那一颗**不可以同名** —— 第一次跑的时候两颗都叫 Settle，
     Playwright 直接拒绝（strict mode violation），而那正是一个人
     看着两颗一模一样的按钮不知道按哪一颗的样子。产品改了，不是尺改了。 */
  await card3.getByRole("button", { name: /^Take the money$/i }).click();
  await page.waitForTimeout(3200);

  const { data: paid } = await admin
    .from("ledger_entries")
    .select("amount_cents, direction, against_id")
    .eq("project_id", pid);
  if (
    (paid ?? []).length === 1 &&
    Number(paid[0].amount_cents) === 2150 &&
    paid[0].against_id === rid
  )
    ok("🔴 进帐是 RM 21.50，不是他手上那张 RM 25，而且挂在那张单上");
  else no("钱记错了", JSON.stringify(paid));

  const { data: freed } = await admin
    .from("dining_tables")
    .select("name, seated_record_id")
    .eq("id", t3.id)
    .single();
  if (freed?.seated_record_id === null) ok("🔴 桌子放开了");
  else no("桌子还挂着那张单", JSON.stringify(freed));

  ({ hit, body } = await waited(/Change RM\s*3\.50/i));
  if (hit) ok("🔴 画面上讲出找他 RM 3.50");
  else no("画面上没有讲找多少", body.slice(0, 300));

  const { data: stillThere } = await admin
    .from("pipeline_records")
    .select("id, table_id")
    .eq("id", rid)
    .single();
  if (stillThere?.table_id === t3.id)
    ok("🔴 而那张单还记得它在三号桌 —— 历史，永不改");
  else no("那张单忘了它在哪一桌", JSON.stringify(stillThere));
  await page.screenshot({ path: `${OUT}/6-settled.png`, fullPage: true });

  // ── ⑧ 赊数 ─────────────────────────────────────────────────────────────
  console.log("\n⑧ 赊数（五号桌，一分钱都没给）");
  await page
    .locator('[data-table="5"]')
    .getByRole("button", { name: /Seat a party/i })
    .click();
  await page.waitForTimeout(2800);
  const card5 = page.locator('[data-table="5"]');
  await card5.getByRole("button", { name: /Add a dish/i }).click();
  await page.waitForTimeout(600);
  await card5.getByLabel(/What they ordered/i).fill("Nasi lemak");
  await card5.getByLabel(/How many/i).fill("3");
  await card5.getByLabel(/Each \(RM\)/i).fill("6");
  await card5.getByRole("button", { name: /^Add it$/i }).click();
  await page.waitForTimeout(2800);

  await card5.getByRole("button", { name: /^Settle$/i }).click();
  await page.waitForTimeout(600);
  ({ hit, body } = await waited(/Leave it blank to put it on their tab/i));
  if (hit) ok("🔴 画面上讲出「留空就是赊数」");
  else no("没有讲赊数怎么按", body.slice(0, 300));
  await card5.getByRole("button", { name: /^Take the money$/i }).click();
  await page.waitForTimeout(3200);

  ({ hit, body } = await waited(/Still owed RM\s*18\.00/i));
  if (hit) ok("🔴 讲出还欠 RM 18.00");
  else no("没有讲还欠多少", body.slice(0, 300));
  const { data: onlyOne } = await admin
    .from("ledger_entries")
    .select("id")
    .eq("project_id", pid);
  if ((onlyOne ?? []).length === 1) ok("🔴 一分都没付就不记帐");
  else no("多记了一笔", String(onlyOne?.length));

  // ── ⑨ 手机 ─────────────────────────────────────────────────────────────
  console.log("\n⑨ 手机（390）");
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
  for (const [name, path] of [
    ["tables", "tables"],
    ["kitchen", "kitchen"],
  ]) {
    await phone.goto(`${BASE}/en/portal/${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await phone.waitForTimeout(2600);
    const wide = await phone.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    if (!wide) ok(`手机上 ${name} 不横滚`);
    else no(`手机上 ${name} 横滚了`);
    await phone.screenshot({ path: `${OUT}/7-${name}-390.png`, fullPage: true });
  }

  /* 🔴 不横滚不等於读得了。
     第一版两页在 390 上都是坏的，而「不横滚」两条都绿：
     · 餐台：「他自己的叫法」那个框被挤成 40px，画面上只看得到两个字母
     · 厨房：菜名折两行、那一句说明折**六行**
     两个都是几样东西挤在一行、而旁边那几颗按钮是 shrink-0。
     量法：**那一块字在 390 上有多宽** —— 挤到剩不到卡片的一半就是坏的。
     （重点 24：眼睛看到的错，当场变成一条会红的守卫。） */
  const roomFor = async (sel, what) => {
    const box = await phone.locator(sel).first().boundingBox();
    if (!box) {
      no(`量不到 ${what}`);
      return;
    }
    if (box.width >= 150) ok(`手机上 ${what} 有 ${Math.round(box.width)}px 可以读`);
    else no(`🔴 手机上 ${what} 被挤成 ${Math.round(box.width)}px`);
  };
  await phone.goto(`${BASE}/en/portal/kitchen`, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await phone.waitForTimeout(2600);
  await roomFor("[data-kitchen-line] .flex-col", "厨房那一行的菜名");
  await phone.goto(`${BASE}/en/portal/tables`, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await phone.waitForTimeout(2600);
  await roomFor(
    'input[aria-label*="What you call it"]',
    "开一张桌那个名字框",
  );

  console.log(
    fail.length === 0
      ? `\n判：全部过（${pass.length} 项）`
      : `\n判：${pass.length} 过 · ${fail.length} 没过`,
  );
  if (fail.length > 0) process.exitCode = 1;
} catch (err) {
  console.error(`\n🔴 走到一半炸了：${err?.message ?? err}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (userId) await dropThrowaway(admin, userId);
}
