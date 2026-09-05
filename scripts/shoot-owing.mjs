/**
 * 谁欠我钱 —— 用眼睛看。
 *
 * `party_aging` 从 20260905140000 起就答得出整家公司的账龄分段，
 * 而**画面上一个入口都没有** —— [任务 142] 记着「今天只有助手答得出来」，
 * 也就是他要先想到去问一句话，才知道谁欠他钱。
 *
 * 🔴 而这一页最危险的地方不是少一格，是**空的会说谎**：
 * `party_aging` 是 `sees_money`，师傅拿回来是零行，
 * 而零行画出来就是「没有人欠你钱」。所以他打不开这一页（404），
 * 而这一段有一条控制组在量那件事。
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
const OUT = ".screenshots/owing";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `ow-${stamp}@formae.test`;
const PASSWORD = `Ow-${stamp}-x!`;
const CREW = `ow-crew-${stamp}@formae.test`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const day = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
};

const bad = [];
let userId = null;
let crewId = null;
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

  /* 两个客户，两种欠法 —— 一个欠得多，一个欠得久。
     🔴 那正好是这一页要分开讲的两件事。 */
  const { data: big } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Hup Seng Trading",
  });
  const { data: oldOne } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Kedai Ah Seng",
  });

  /* 欠得多，而且是这个月的。 */
  const { error: e1 } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_party: "Hup Seng Trading",
    in_party_id: big.id, in_title: "Big job", in_amount_cents: 3000000,
    in_stage: "Confirmed", in_issued_on: day(-3),
  });
  if (e1) throw new Error(`add_pipeline_record(big): ${e1.message}`);

  /* 欠得久 —— 一百天前那一张。 */
  const { error: e2 } = await api.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_party: "Kedai Ah Seng",
    in_party_id: oldOne.id, in_title: "Small job", in_amount_cents: 30000,
    in_stage: "Confirmed", in_issued_on: day(-100),
  });
  if (e2) throw new Error(`add_pipeline_record(old): ${e2.message}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector('input[type="email"]', { timeout: 120000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  const hide = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  /* ① 那一页打得开，而且数字是真的。 */
  await page.goto(`${BASE}/en/portal/owing`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  await hide();
  await page.screenshot({ path: `${OUT}/1-owing.png`, fullPage: true });
  console.log("拍到  1-owing");
  const seen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 那一页打得开", /Who owes me/i.test(seen), seen.slice(0, 300));
  say("两个欠钱的都在上面",
    /Hup Seng Trading/.test(seen) && /Kedai Ah Seng/.test(seen), seen.slice(0, 500));
  say("一共欠你 RM 30,300", /RM 30,300/.test(seen), seen.slice(0, 500));
  /* 🔴 「欠最久」跟「欠最多」是两件事 —— 那一张一百天前的小单
     排在最后，而它才是要打电话的那一个。 */
  say("🔴 超过 60 天那一格单独讲，而且是那一张小的（RM 300）",
    /Over 60 days/i.test(seen) && /RM 300/.test(seen), seen.slice(0, 600));
  say("而且提醒他要打的不是欠最多那一个",
    /not the largest/i.test(seen), seen.slice(0, 700));

  /* 点得进那个人 —— 他看完下一件事就是打给他，而电话在那一页上。 */
  const link = page.getByRole("link", { name: "Kedai Ah Seng" });
  say("每一行点得进那个客户", (await link.count()) === 1, `${await link.count()} 条`);
  /* ⚠️ `noWaitAfter` —— dev server 第一次进那一页要现编译，而 Playwright
     的 click 预设会等导航「稳定」，那在这里会超时，看起来像那条连结点不动。 */
  await link.click({ timeout: 60000, noWaitAfter: true });
  await page.waitForURL(/\/portal\/customers\//, { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(2000);
  say("而且真的落在他那一页上", /\/portal\/customers\//.test(page.url()), page.url());

  /* ② 入口在 —— 一页没有人点得进去的页面等於没有那一页。 */
  await page.goto(`${BASE}/en/portal/quotations/new`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(2500);
  const shelf = page.getByRole("link", { name: /^Who owes me$/i });
  say("🔴 「加一单」那一页上点得进去", (await shelf.count()) === 1, `${await shelf.count()} 条`);

  /* ③ 🔴 控制组：师傅打不开，而且**不是**看到一张空表。 */
  const { data: crewMade } = await admin.auth.admin.createUser({
    email: CREW, password: PASSWORD, email_confirm: true,
  });
  crewId = crewMade.user.id;
  const { error: addErr } = await api.rpc("add_project_member", { in_email: CREW });
  if (addErr) throw new Error(`add_project_member: ${addErr.message}`);

  const crewCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const crew = await crewCtx.newPage();
  await crew.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await crew.waitForSelector('input[type="email"]', { timeout: 120000 });
  await crew.fill('input[type="email"]', CREW);
  await crew.fill('input[type="password"]', PASSWORD);
  await crew.click('button[type="submit"]');
  await crew.waitForURL(/portal/, { timeout: 180000 });
  await crew.goto(`${BASE}/en/portal/owing`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await crew.waitForTimeout(2500);
  await crew.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await crew.screenshot({ path: `${OUT}/2-crew-404.png`, fullPage: true });
  console.log("拍到  2-crew-404");
  const crewText = (await crew.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 师傅那一边是 404", /does not exist/i.test(crewText), crewText.slice(0, 300));
  /* 🔴 而这一条才是重点：**不可以是一张空表**。
     零行画出来就是「没有人欠你钱」，对一个挂着三万应收的人撒谎。 */
  say("🔴 而不是一张写着「没有人欠你钱」的空表",
    !/Nobody owes you anything/i.test(crewText), crewText.slice(0, 300));

  /* ④ 手机上不用左右滑 —— 七栏的表要自己滚，不是把整页推宽。 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForSelector('input[type="email"]', { timeout: 120000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await phone.goto(`${BASE}/en/portal/owing`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await phone.waitForTimeout(2500);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/3-phone-390.png`, fullPage: true });
  console.log("拍到  3-phone-390");
  const scrolls = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  say("手机上整页不用左右滑（那张表自己滚）", !scrolls, "整页会横滑");
  /* 一个断成两行的金额，读起来是一个错的数字。 */
  const split = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("td")) {
      const t = (el.textContent ?? "").trim();
      if (!/^RM [\d,]+$/.test(t)) continue;
      const r = new Range();
      r.selectNodeContents(el);
      if (r.getClientRects().length > 1) out.push(t);
    }
    return out;
  });
  say("没有一个金额断成两行", split.length === 0, split.join(" · "));

  /* 🔴 零就留空 —— 一行五个「RM 0」是杂讯，而这一页存在的全部意义
     就是让眼睛落在不是零的那一格上。看图才看到的。 */
  const zeros = (seen.match(/RM 0(?![\d,])/g) ?? []).length;
  say("🔴 零的那几格留空，不印 RM 0", zeros === 0, `印了 ${zeros} 个`);

} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  if (crewId) await dropThrowaway(admin, crewId);
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
  if (browser) await browser.close();
}

console.log(`\n判：${bad.length} 项没过`);
for (const b of bad) console.log(`  · ${b}`);
process.exit(bad.length ? 1 : 0);
