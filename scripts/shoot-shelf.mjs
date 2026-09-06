/**
 * 三扇门：效期 · 借出去的 · 改一台车。真的登入，真的按。
 *
 * ── 为什么（2026-09-06）─────────────────────────────────────────────────
 *
 * `expiring_soon` · `add_stock_batch` · `batches_of`（20260905320000）·
 * `lend_item` · `return_rental` · `rentals_out`（20260905540000）·
 * `update_vehicle` · `set_vehicle_archived`（20260905290000）——
 * **八支，画面上一个入口都没有**，而三条任务的收尾自己都写着
 * 「画面上没有那一页」。
 *
 * ── ⚠️ 它量的是画面，不是回码 ──────────────────────────────────────────
 *
 * `notFound()` 在这个壳里回的是 **200 配一张找不到的页**（壳先流出去了），
 * 所以拿状态码当答案，就是拿一个跟画面无关的代理指标当答案 ——
 * 而这个仓库被那种尺子骗过四次。
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
const OUT = ".screenshots/shelf";
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

const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

let browser;
try {
  const stamp = Date.now();
  const email = `shelf-${stamp}@formae.test`;
  const password = `Shelf-${stamp}-x!`;
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
  /* ⚠️ `orders` 不是随便挑的 —— `lend_item` 只收订单跟工程。 */
  for (const k of ["customers", "orders", "inventory"]) {
    /* ⚠️ 签名是 `(requested_key, new_title)` —— 旧的 `new_page_key` 已经不在了
       （20260905110000）。而 PostgREST 找不到那支函式只是回一个 error，
       **不抛** —— 于是没有添加到的那几页静静地不存在，
       而它下面那一条红看起来像产品坏了。 */
    const { error: pgErr } = await api.rpc("add_project_page", {
      requested_key: k,
      new_title: "",
    });
    if (pgErr && !/already/i.test(pgErr.message)) console.log(`  ⚪ 台面：${k} — ${pgErr.message}`);
  }

  const { data: cust, error: cErr } = await api.rpc("add_directory_entry", {
    in_project_id: pid,
    in_module_key: "customers",
    in_name: "Wedding House",
    in_whatsapp: "012-3xx xxxx",
  });
  if (cErr) throw new Error(`add customer: ${cErr.message}`);
  const custId = cust?.id ?? cust;

  const { data: job, error: jErr } = await api.rpc("add_pipeline_record", {
    in_project_id: pid,
    in_module_key: "orders",
    in_title: "Saturday marquee",
    in_party: "Wedding House",
    in_party_id: custId,
  });
  if (jErr) throw new Error(`add job: ${jErr.message}`);
  const jobId = job?.id ?? job;

  const { data: item, error: iErr } = await api.rpc("add_catalog_item", {
    in_project_id: pid,
    in_module_key: "inventory",
    in_name: "Panadol 500mg",
    in_unit: "box",
  });
  if (iErr) throw new Error(`add item: ${iErr.message}`);
  const itemId = item?.id ?? item;

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
    await page.goto(`${BASE}/en/portal/${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await page.waitForTimeout(2600);
    return page.locator("body").innerText();
  };

  // ── ① 效期 ─────────────────────────────────────────────────────────────
  let body = await open("expiry");
  if (/Nothing expiring/i.test(body)) ok("一批都还没有的时候，画的是一句话");
  else no("空的时候画了别的", body.slice(0, 120));
  await page.screenshot({ path: `${OUT}/1-expiry-empty.png`, fullPage: true });

  /* 🔴 没有批号就不准记 —— 一个空的批号在画面上跟一个真的长得一样。 */
  await page.getByRole("button", { name: /Record it/i }).click();
  await page.waitForTimeout(1200);
  const said0 = await page.locator("body").innerText();
  if (/needs its number/i.test(said0)) ok("🔴 没有批号挡下来，而且讲得出为什么");
  else no("🔴 没有批号照样记", said0.slice(0, 120));

  await page.getByLabel("Batch").fill("B240915");
  await page.getByLabel("Expires").fill(day(20));
  await page.getByRole("button", { name: /Record it/i }).click();
  await page.waitForTimeout(3200);

  const { data: batches } = await admin
    .from("stock_batches")
    .select("id, code, expiry_on")
    .eq("project_id", pid);
  if ((batches ?? [])[0]?.code === "B240915") ok("那一批真的记进去了");
  else no("那一批没记进去", JSON.stringify(batches));

  /* 🔴 一批没有货的批号不算「快过期」—— `expiring_soon` 要 `left_over > 0`。
     那是对的：一盒都不剩的批号没有什么要从架上拿下来。
     而我第一版的台面没进货，于是对着一个完全正确的画面报了红。 */
  const batchId = (batches ?? [])[0]?.id;
  if (batchId) {
    const { error: mvErr } = await api.rpc("move_stock", {
      in_item_id: itemId,
      in_direction: "in",
      in_qty: 12,
      in_reason: "opening",
      in_batch_id: batchId,
    });
    if (mvErr) no("台面：进不了货", mvErr.message);
  }

  body = await open("expiry");
  if (/B240915/.test(body)) ok("它当场出现在「快过期的」上");
  else no("「快过期的」上没有它", body.slice(0, 200));
  if (/days left/i.test(body)) ok("还有几天讲出来了");
  else no("没有讲还有几天", body.slice(0, 400));
  await page.screenshot({ path: `${OUT}/2-expiry-soon.png`, fullPage: true });

  /* 「它那几批」—— `batches_of` 那一支。 */
  await page.getByRole("button", { name: /Its batches/i }).click();
  await page.waitForTimeout(2200);
  const list = await page.locator("body").innerText();
  if (/on hand/i.test(list)) ok("「它那几批」答得出来（还剩几件是加出来的）");
  else no("「它那几批」没有答案", list.slice(0, 160));
  await page.screenshot({ path: `${OUT}/3-expiry-batches.png`, fullPage: true });

  // ── ② 借出去的 ─────────────────────────────────────────────────────────
  body = await open("rentals");
  if (/Nothing is out/i.test(body)) ok("没有东西在外面的时候，画的是一句话");
  else no("空的时候画了别的", body.slice(0, 120));

  /* 🔴 没写出去了什么就不准记。 */
  if ((await page.getByRole("button", { name: /It went out/i }).count()) === 0) {
    no("借一样东西出去那几格没画", body.slice(0, 400));
    throw new Error("stop here");
  }
  await page.getByRole("button", { name: /It went out/i }).click();
  await page.waitForTimeout(1200);
  const said1 = await page.locator("body").innerText();
  if (/Write down what went out/i.test(said1)) ok("🔴 没写东西挡下来");
  else no("🔴 没写东西照样记", said1.slice(0, 120));

  await page.getByLabel("What went out").fill("Scaffold tower");
  await page.getByLabel("How many").fill("2");
  /* ⚠️ 归还日不可以早过出去那天（那支函式自己挡）——
     而我第一版填了三天前，于是那一笔根本没进去，
     而那条红看起来像产品坏了。第十九次红的是我的道具。 */
  await page.getByLabel("Back by").fill(day(7));
  await page.getByRole("button", { name: /It went out/i }).click();
  await page.waitForTimeout(3400);

  const { data: rentals } = await admin
    .from("rentals")
    .select("descr, qty, due_back_on, returned_on")
    .eq("project_id", pid);
  const r0 = (rentals ?? [])[0];
  if (r0 && r0.descr === "Scaffold tower") ok("借出去真的记进去了");
  else no("借出去没记进去", JSON.stringify(rentals));
  if (r0 && Number(r0.qty) === 2) ok("几件记对了");
  else no("几件不对", String(r0?.qty));

  /* 一笔真的逾期的 —— 柜台上没有「哪天出去的」那一格
     （那是当下记的），所以这一笔直接摆进去。 */
  const { error: odErr } = await api.rpc("lend_item", {
    in_record_id: jobId,
    in_descr: "Trestle table",
    in_qty: 6,
    in_out_on: day(-10),
    in_due_back_on: day(-3),
  });
  if (odErr) no("台面：逾期那一笔摆不进去", odErr.message);

  body = await open("rentals");
  if (/Scaffold tower/.test(body)) ok("它出现在「现在在外面」上");
  else no("清单上没有它", body.slice(0, 200));
  /* 🔴 逾期几天讲出来 —— 收不收钱是他的判断，不是一条公式。 */
  if (/days over/i.test(body)) ok("🔴 逾期几天讲出来了（而且没有替他算租金）");
  else no("🔴 逾期没有讲出来", body.slice(0, 200));
  /* 🔴 不要用 `/RM/` —— 它打中的是侧栏上的 **FORMAE**（FO-RM-AE）。
     一个子字串比对打中商标，跟一个真的金额在报告里长得一模一样。 */
  const main = await page.locator("main").innerText().catch(() => body);
  if (!/RM\s?[\d,]/.test(main)) ok("⚠️ 这一页上一分钱都没有（押金住在帐上）");
  else no("这一页上出现了金额", main.slice(0, 200));
  await page.screenshot({ path: `${OUT}/4-rentals-out.png`, fullPage: true });

  await page.getByRole("button", { name: /It came back/i }).first().click();
  await page.waitForTimeout(3400);
  const { data: back } = await admin
    .from("rentals")
    .select("descr, returned_on")
    .eq("project_id", pid)
    .not("returned_on", "is", null);
  if ((back ?? []).length === 1) ok("按「还回来了」真的收了一笔回来");
  else no("还不回来", JSON.stringify(back));
  /* ⚠️ 只收一笔 —— 另外那一笔要还在清单上，
     不然那颗按钮是把整张清单清掉。 */
  body = await page.locator("body").innerText();
  const goneOne = (back ?? [])[0]?.descr;
  if (goneOne && !body.includes(goneOne)) ok("收回来那一笔离开了清单");
  else no("收回来了还留在清单上", String(goneOne));
  if ((back ?? []).length === 1 && /Trestle table|Scaffold tower/.test(body))
    ok("而另外那一笔还在");
  else no("一按把整张清单清掉了", body.slice(0, 200));
  await page.screenshot({ path: `${OUT}/5-rentals-back.png`, fullPage: true });

  // ── ③ 改一台车 ─────────────────────────────────────────────────────────
  await open("vehicles");
  await page.locator("#plate").fill("WB 8888 C");
  await page.getByRole("button", { name: /look it up/i }).click();
  await page.waitForTimeout(2400);
  await page.getByLabel(/what is it/i).first().fill("Toyota Hilux");
  await page.getByRole("button", { name: /register this plate/i }).click();
  await page.waitForTimeout(3400);

  const edit = page.getByRole("button", { name: /Change this one/i });
  if (await edit.count()) ok("找到一台车之后才画「改这一台」");
  else no("「改这一台」不在");
  await edit.click();
  await page.waitForTimeout(1200);
  await page.getByLabel(/what is it/i).last().fill("Toyota Hilux 2.4");
  await page.getByLabel(/service every/i).last().fill("15000");
  await page.getByRole("button", { name: /^Save$/ }).last().click();
  await page.waitForTimeout(3000);

  const { data: cars } = await admin
    .from("vehicles")
    .select("descr, service_every_km, archived_at")
    .eq("project_id", pid);
  const car = (cars ?? [])[0];
  if (car?.descr === "Toyota Hilux 2.4") ok("改的那一行真的写进去了");
  else no("改的没写进去", JSON.stringify(car));
  if (car?.service_every_km === 15000) ok("保养间隔改到了");
  else no("保养间隔没改到", String(car?.service_every_km));
  await page.screenshot({ path: `${OUT}/6-vehicle-edited.png`, fullPage: true });

  await page.getByRole("button", { name: /Change this one/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /Take it off the list/i }).click();
  await page.waitForTimeout(3000);
  const { data: cars2 } = await admin
    .from("vehicles")
    .select("archived_at")
    .eq("project_id", pid)
    .maybeSingle();
  if (cars2?.archived_at) ok("收起来了");
  else no("收不起来", JSON.stringify(cars2));
  const after = await page.locator("body").innerText();
  if (!/Toyota Hilux/.test(after)) ok("收起来之后画面上不再有它");
  else no("收起来了画面上还在");

  // ── ③b 谁欠我钱 · 要跟的 · 分店 ─────────────────────────────────────────
  /* 三页 2026-09-06 换了骨架，而在这之前没有一把尺打开过它们。
     台面全部走**人按的那几支**，只有「把日子推回去」用管理钥匙 ——
     一张单开出来就是今天，而账龄要的是一张放了三个月的单。 */
  const { data: oldJob, error: ojErr } = await api.rpc("add_pipeline_record", {
    in_project_id: pid,
    in_module_key: "orders",
    in_title: "Chairs, 200",
    in_party: "Wedding House",
    in_party_id: custId,
    in_amount_cents: 480000,
  });
  if (ojErr) no("台面：那一张旧单开不出来", ojErr.message);
  const oldId = oldJob?.id ?? oldJob;
  const longAgo = new Date(Date.now() - 100 * 864e5).toISOString().slice(0, 10);
  const { error: backErr } = await admin
    .from("pipeline_records")
    .update({ issued_on: longAgo })
    .eq("id", oldId);
  if (backErr) no("台面：日子推不回去", backErr.message);

  let owe = await open("owing");
  if (/Wedding House/.test(owe)) ok("欠钱的那个人出现在「谁欠我钱」上");
  else no("「谁欠我钱」上没有他", owe.slice(0, 240));
  if (/RM\s?4,800/.test(owe)) ok("他欠多少写在那一行上");
  else no("欠多少没写出来", owe.slice(0, 240));
  /* 🔴 五格里**零的那几格不印** —— 一行五个 RM 0 是杂讯，
     而账龄表存在的全部意义就是让眼睛落在不是零的那一格上。 */
  const zeros = (owe.match(/RM 0(?![\d,])/g) ?? []).length;
  if (zeros === 0) ok("🔴 零的那几格没有印出来");
  else no("🔴 印了几个 RM 0", String(zeros));
  /* 那一条带子：过了 90 天那一段是最实的一个红。 */
  const segs = await page.locator("li div[aria-hidden='true'] > span").count();
  if (segs >= 1) ok("那一条账龄带真的画出来了");
  else no("那一条带子没画");
  await page.screenshot({ path: `${OUT}/8-owing.png`, fullPage: true });

  const dueLongAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const { error: fuErr } = await api.rpc("set_follow_up", {
    in_record_id: oldId,
    in_what: "Call about the balance",
    in_due_on: dueLongAgo,
  });
  if (fuErr) no("台面：跟进那一条写不进去", fuErr.message);

  let chase = await open("today");
  if (/Call about the balance/.test(chase)) ok("要跟的那一件出现在「要跟的」上");
  else no("「要跟的」上没有它", chase.slice(0, 240));
  if (/days late|day late/i.test(chase)) ok("🔴 逾期几天讲出来了");
  else no("🔴 逾期没有讲出来", chase.slice(0, 240));
  /* 🔴 筛子在清单**上面**，不是页脚两条底线字。 */
  const filterInHead = await page
    .locator("section.ds-card header a[aria-current='page']")
    .count();
  if (filterInHead === 1) ok("🔴 「今天 / 这个星期」在卡头上，而且选中的那一个讲得出来");
  else no("🔴 筛子不在卡头上", String(filterInHead));
  await page.screenshot({ path: `${OUT}/9-today.png`, fullPage: true });

  for (const nm of ["Ipoh Garden", "Bercham"]) {
    const { error: bErr } = await api.rpc("add_branch", { in_project_id: pid, in_name: nm });
    if (bErr) no(`台面：开不了「${nm}」`, bErr.message);
  }
  let shops = await open("branches");
  if (/Ipoh Garden/.test(shops) && /Bercham/.test(shops)) ok("两间店都在");
  else no("两间店没有都在", shops.slice(0, 240));
  /* 🔴 关掉的那一间排到底下，不是在同一串里划掉。 */
  await page
    .getByRole("button", { name: /Switch off|Switch back on/i })
    .first()
    .click();
  await page.waitForTimeout(2600);
  shops = await page.locator("body").innerText();
  const closedHead = shops.indexOf("Closed");
  if (closedHead > 0 && shops.indexOf("Ipoh Garden") > closedHead)
    ok("🔴 关掉的那一间排到「关了的」底下");
  else no("🔴 关掉的那一间还混在开着的那一串里", shops.slice(0, 300));
  await page.screenshot({ path: `${OUT}/10-branches.png`, fullPage: true });

  // ── ④ 侧栏 ─────────────────────────────────────────────────────────────
  await open("");
  const rail = await page.locator("nav").first().innerText();
  for (const label of ["Shelf life", "Out on loan"]) {
    if (rail.includes(label)) ok(`侧栏上有「${label}」`);
    else no(`侧栏上没有「${label}」`, rail.slice(0, 200));
  }
  await page.screenshot({ path: `${OUT}/7-rail.png`, fullPage: true });

  // ── ⑤ 手机上 ───────────────────────────────────────────────────────────
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
    [11, "expiry"],
    [12, "rentals"],
    [13, "owing"],
    [14, "today"],
    [15, "branches"],
  ]) {
    await phone.goto(`${BASE}/en/portal/${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 180000,
    });
    await phone.waitForTimeout(2400);
    const wide = await phone.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    if (!wide) ok(`390 上不横滚 · ${path}`);
    else no(`390 上横滚了 · ${path}`);
    await phone.screenshot({ path: `${OUT}/${n}-${path}-390.png`, fullPage: true });
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
