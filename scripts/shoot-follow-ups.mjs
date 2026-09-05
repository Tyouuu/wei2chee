/**
 * 下一步 —— 用眼睛看。
 *
 * 五支函式 20260905800000 就是真的了，而画面上一个入口都没有。
 * 一个承包商手上十二张报价单，今天没有任何地方写着**星期五要打给谁** ——
 * 而 Pipedrive 整个产品就是 `Processes, pipeline and activities`。
 *
 * 这一支量两件事，而第二件是重点：
 *   ① 单据那一页上写得下、改得了、做得完
 *   ② 🔴 **写完之后它真的出现在「要跟的事」上** —— 那一段就是这条线，
 *      而这个仓库二十次「说了没做」的形状全部是同一件：
 *      写进去了，而另一头没有人读它。
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
const OUT = ".screenshots/follow-ups";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `fu-${stamp}@formae.test`;
const PASSWORD = `Fu-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/* 登入，然后真的站在 portal 里面。
   ⚠️ 那一跳是浏览器那一端做的，而 dev server 忙的时候它可以拖很久 ——
   实测三次跑有三次卡在 `/en/login` 上，读起来像登入坏了。
   等不到就自己走过去：钥匙已经在 cookie 里，中介层认得它。
   **真的没登入的话它会被推回登入页，后面每一条照样红** —— 这不是把
   一个产品的毛病藏起来，是把 dev server 的时快时慢从尺子里拿掉。 */
async function signIn(page) {
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector('input[type="email"]', { timeout: 120000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page
    .waitForFunction(() => location.pathname.includes("/portal"), null, { timeout: 60000 })
    .catch(async () => {
      await page.goto(`${BASE}/en/portal`, { waitUntil: "domcontentloaded", timeout: 180000 });
    });
  await page.waitForFunction(() => location.pathname.includes("/portal"), null, {
    timeout: 120000,
  });
}

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

  /* 🔴 没挑过风格的帐号，每一页都会被推去 `/style-select` ——
     而那时候 `waitForURL(/portal/)` 看到的是一串回到登入页的导航，
     读起来像登入坏了。（`align-pages.mjs` 的档头已经记过同一条。） */
  await api.rpc("set_project_style", { new_style: "ledger" });

  /* 两张单：一张他今天要在画面上写下一步，一张已经逾期两天。 */
  const { data: quote, error: qErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_party: "Mr Tan",
    in_title: "Taman Desa reno", in_amount_cents: 4850000,
  });
  if (qErr) throw new Error(`add_pipeline_record: ${qErr.message}`);
  const { data: late, error: lErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_party: "Puan Siti",
    in_title: "Bathroom", in_amount_cents: 900000,
  });
  if (lErr) throw new Error(`add_pipeline_record(late): ${lErr.message}`);
  const { error: seedErr } = await api.rpc("set_follow_up", {
    in_record_id: late.id, in_what: "Send the revised drawing", in_due_on: day(-2),
  });
  if (seedErr) throw new Error(`set_follow_up(seed): ${seedErr.message}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(page);
  const hide = () =>
    page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  /* ① 单据那一页上有那一格。 */
  console.log("\n① 单据那一页");
  await page.goto(`${BASE}/en/portal/quotations/${quote.id}`, {
    waitUntil: "domcontentloaded", timeout: 180000,
  });
  await page.waitForTimeout(3000);
  await hide();
  await page.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });
  console.log("拍到  1-empty");
  let seen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 那一格在那张单上", /Next step/i.test(seen), seen.slice(0, 400));
  say("而且还没有的时候不假装有一个",
    !/Done/.test(seen) || !/Not chasing this/.test(seen), seen.slice(0, 400));

  /* ② 写下一步 —— 真的打字，真的按。 */
  console.log("\n② 写一个");
  await page.fill('input[placeholder="Call and ask if they have decided"]', "Call and ask if they decided");
  await page.fill('input[aria-label="On"]', day(0));
  await page.getByRole("button", { name: "Note it down" }).click({ timeout: 60000, noWaitAfter: true });
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  await hide();
  await page.screenshot({ path: `${OUT}/2-written.png`, fullPage: true });
  console.log("拍到  2-written");
  seen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 写下去之后那张单上看得到它",
    /Call and ask if they decided/.test(seen), seen.slice(0, 600));
  say("两颗都在：做完了 · 不跟了",
    /Done/.test(seen) && /Not chasing this/i.test(seen), seen.slice(0, 600));
  /* 🔴 已经有一个的时候，那颗按钮讲的是「改成这个」不是「记下来」——
     一颗写着「记下来」而实际上会把原本那一句换掉的按钮，是在骗他。 */
  say("🔴 已经有一个的时候，那颗按钮改口说「改成这个」",
    /Change it to this/i.test(seen) && !/Note it down/i.test(seen), seen.slice(0, 600));

  /* ③ 🔴 这一条才是这支尺子存在的理由：另一头真的读它。 */
  console.log("\n③ 要跟的事那一页");
  await page.goto(`${BASE}/en/portal/today`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(3000);
  await hide();
  await page.screenshot({ path: `${OUT}/3-today.png`, fullPage: true });
  console.log("拍到  3-today");
  seen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 刚写的那一件真的出现在这一页上",
    /Call and ask if they decided/.test(seen), seen.slice(0, 700));
  say("逾期那一件也在", /Send the revised drawing/.test(seen), seen.slice(0, 700));
  say("🔴 逾期几天是算出来的（2 天）", /2 days late/.test(seen), seen.slice(0, 700));
  say("逾期几件单独讲", /Overdue/i.test(seen), seen.slice(0, 700));

  /* 🔴 逾期那一件要排在最前面 —— 他打开这一页要看的不是「今天有两件」，
     是「有一件昨天就该做而你没做」。 */
  /* ⚠️ 量的是**画面上的先后**，不是 DOM 的形状 —— 第一版写
     `main li`，而那一页根本没有 `<main>`，於是它对着一个完全正确的
     排序回报「排最前面 — （空）」。**红的是尺子，不是产品。** */
  const iLate = seen.indexOf("Send the revised drawing");
  const iSoon = seen.indexOf("Call and ask if they decided");
  say("🔴 逾期那一件排最前面",
    iLate >= 0 && iSoon >= 0 && iLate < iSoon, `逾期在 ${iLate} · 今天在 ${iSoon}`);

  /* 往后拨一个礼拜 —— 那一段是自己算「马来西亚的今天 + 7」，
     而 `toISOString()` 用的是 UTC，半夜到早上八点会差一天。 */
  await page.getByRole("link", { name: /Look a week ahead/i }).click({
    timeout: 60000, noWaitAfter: true,
  });
  await page.waitForURL(/until=week/, { timeout: 180000 }).catch(() => {});
  /* ⚠️ 等那一段真的画出来，不是等一个固定的秒数 —— 第一版等 2.5 秒，
     读到的是只有侧栏的半张页，而它看起来像那一段整个不见了。 */
  await page.waitForSelector("text=Just what is due", { timeout: 120000 });
  const weekSeen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("往后拨一个礼拜看得到两件",
    /Send the revised drawing/.test(weekSeen) && /Call and ask if they decided/.test(weekSeen),
    weekSeen.slice(0, 400));
  await page.goto(`${BASE}/en/portal/today`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);

  /* 每一行点得进那张单 —— 他读完这一行下一件事就是打开它。 */
  const back = page.getByRole("link", { name: /Taman Desa reno/ });
  say("每一行点得回那张单", (await back.count()) === 1, `${await back.count()} 条`);
  await back.click({ timeout: 60000, noWaitAfter: true });
  await page.waitForURL(/\/portal\/quotations\//, { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(2000);
  say("而且真的落在那张单上",
    page.url().includes(`/portal/quotations/${quote.id}`), page.url());

  /* ④ 做完了 —— 那一页上就不该再有它。 */
  console.log("\n④ 做完了");
  await page.getByRole("button", { name: "Done" }).click({ timeout: 60000, noWaitAfter: true });
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/en/portal/today`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  await hide();
  await page.screenshot({ path: `${OUT}/4-done.png`, fullPage: true });
  console.log("拍到  4-done");
  seen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 做完的那一件从这一页上走了",
    !/Call and ask if they decided/.test(seen), seen.slice(0, 700));
  say("而逾期那一件还在", /Send the revised drawing/.test(seen), seen.slice(0, 700));

  /* ⑤ 入口在 —— 一页没有人点得进去的页面等於没有那一页。 */
  console.log("\n⑤ 入口");
  await page.goto(`${BASE}/en/portal/quotations/new`, {
    waitUntil: "domcontentloaded", timeout: 180000,
  });
  await page.waitForTimeout(2500);
  const shelf = page.getByRole("link", { name: /^To chase$/i });
  say("🔴 「加一单」那一页上点得进去", (await shelf.count()) === 1, `${await shelf.count()} 条`);

  /* ⑥ 手机上 —— 他在工地上就是这个宽度。 */
  console.log("\n⑥ 390");
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await signIn(phone);
  await phone.goto(`${BASE}/en/portal/today`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await phone.waitForTimeout(2500);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/5-phone.png`, fullPage: true });
  console.log("拍到  5-phone");
  const wide = await phone.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  say("手机上不用左右滑", !wide, "整页比萤幕宽");
  const phoneSeen = (await phone.locator("body").innerText()).replace(/\s+/g, " ");
  say("手机上看得到逾期那一件", /Send the revised drawing/.test(phoneSeen), phoneSeen.slice(0, 400));
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
}

console.log(`\n判：${bad.length ? `${bad.length} 条没过` : "全过"}`);
for (const b of bad) console.log(`  · ${b}`);
process.exit(bad.length ? 1 : 0);
