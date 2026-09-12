/**
 * 套票 —— 用眼睛看。
 *
 * 重点 7l。271 条真的呼叫全过，而那些答不了：
 * **他有没有一个地方看得到「还剩三次」**，跟**那个数字画在画面上对不对**。
 *
 * ⚠️ 用完就删的帐号。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/packages";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `pack-${stamp}@formae.test`;
const PASSWORD = `Pack-${stamp}-x!`;

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

  const { data: her } = await api.rpc("add_directory_entry", {
    in_project_id: proj.id, in_module_key: "customers", in_name: "Puan Aminah",
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  const hide = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  /* ① 还没卖过：讲得出来，不是一片空白。
     🔴 「Packages」躲在「Account & activity」那个分页签底下（老板要求的
     设计总检：客户页收成两个分页签）——先点开它，才看得到那一段。 */
  await page.goto(`${BASE}/en/portal/customers/${her.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1400);
  await page.getByRole("tab", { name: "Account & activity" }).click();
  await page.waitForTimeout(300);
  await hide();
  await page.screenshot({ path: `${OUT}/1-none.png`, fullPage: true });
  const blank = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  1-none");
  say("客户页上有「套票」这一段", /Packages/i.test(blank), blank.slice(0, 200));
  /* 🔴 任务 403 的设计总检把「还没有卖过套票给他」那句拿掉了 ——
     空的时候只留 packLede 那一句说明（「卖几次，用一次扣一次」），
     不再多讲一句意思重复的话（packages-panel.tsx 的档头写着为什么）。
     这一条原本等的是那句已经拿掉的字，改成等还在的那一句。 */
  say(
    "还没卖过的时候讲得出来",
    /Sold as a number of sessions/i.test(blank),
    blank.slice(0, 240),
  );

  /* 🔴 师傅那一页上不可以有这一段 —— 套票是卖给客人的。 */
  const { data: aStylist } = await api.rpc("add_directory_entry", {
    in_project_id: proj.id, in_module_key: "staff", in_name: "Aida",
  });
  /* ⚠️ supabase 的建构器是 thenable，不是 Promise —— 它没有 `.catch`。
     写 `.catch(() => {})` 会当场丢 TypeError，而那一行本来是想「忽略错误」。 */
  const { error: pageErr } = await api.rpc("add_project_page", {
    requested_key: "staff", new_title: null,
  });
  if (pageErr && !String(pageErr.message).includes("exists")) {
    throw new Error(`add_project_page(staff): ${pageErr.message}`);
  }
  await page.goto(`${BASE}/en/portal/staff/${aStylist.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const staffText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("师傅页上没有套票那一段", !/No package sold to them yet/i.test(staffText),
    staffText.slice(0, 200));

  /* ── 他先付了、还没用掉的钱 ────────────────────────────────────────
     🔴 这个数字从 20260903030000 起就算得出来，而到 2026-09-04 为止
     **全 app 零个消费端** —— 任务 61 · 67 · 44 三天各要过它一次。
     这几条守的就是它真的画出来了。 */
  await api.rpc("add_ledger_entry", {
    in_project_id: proj.id, in_module_key: "payments",
    in_amount_cents: 100000, in_party: "Puan Aminah", in_party_id: her.id,
  });
  await page.goto(`${BASE}/en/portal/customers/${her.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/5-credit.png`, fullPage: true });
  const credit = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  5-credit");
  say("先付的那一千块画出来了", /RM 1,000/.test(credit), credit.slice(0, 400));
  say("而且讲得出是哪一笔付的", /From RC-/.test(credit), credit.slice(0, 400));

  /* 分摊掉之后余额要归零 —— 一个不会跟着动的余额，是一个明天就变假的数字。 */
  const { data: aJob } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id, in_module_key: "quotations", in_title: "Colour treatment",
    in_party: "Puan Aminah", in_party_id: her.id, in_amount_cents: 100000,
  });
  const { data: theEntry } = await api
    .from("ledger_entries").select("id").eq("party_id", her.id).eq("direction", "in").limit(1).maybeSingle();
  await api.rpc("set_payment_allocations", {
    in_entry_id: theEntry.id,
    in_rows: [{ record_id: aJob.id, amount_cents: 100000 }],
  });
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const after = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("分摊给那张单之后，余额自己归零",
    /everything they have paid is accounted for/i.test(after), after.slice(0, 400));

  /* ② 真的卖一张十次的。这是一次新的 goto，页签会重设回默认的
     「Overview」——「Sell one」在「Account & activity」底下，要重新点开。 */
  await page.goto(`${BASE}/en/portal/customers/${her.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1400);
  await page.getByRole("tab", { name: "Account & activity" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^Sell one$/i }).click();
  await page.getByLabel("What it is (10 wash and blow)").fill("10 wash and blow");
  await page.getByLabel("Sessions").fill("10");
  await page.getByRole("button", { name: /^Sell one$/i }).click();
  await page.waitForTimeout(3500);
  await hide();
  await page.screenshot({ path: `${OUT}/2-sold.png`, fullPage: true });
  const sold = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  2-sold");
  say("卖出去之后画面上写着还剩十次", /10 left/.test(sold), sold.slice(0, 300));

  const { data: packRow } = await api
    .from("service_packages").select("id, sessions_total").eq("party_id", her.id).maybeSingle();
  say("而且资料库里真的有那一张", Number(packRow?.sessions_total) === 10, JSON.stringify(packRow));

  /* ③ 用掉三次 —— 一次一按，就是前台真的会做的事。 */
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: /^Use one$/i }).click();
    await page.waitForTimeout(2600);
  }
  await hide();
  await page.screenshot({ path: `${OUT}/3-seven-left.png`, fullPage: true });
  const used = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  3-seven-left");
  say("按三次之后写着还剩七次", /7 left/.test(used), used.slice(0, 300));

  const { count: useRows } = await api
    .from("package_uses").select("id", { count: "exact", head: true }).eq("package_id", packRow.id);
  say("而且打卡那几行刚好三行，不是四行", useRows === 3, `${useRows} 行`);

  /* 🔴 剩几次不可以是一个输入框 —— 它是数出来的。 */
  const typable = await page.evaluate(() => {
    for (const el of document.querySelectorAll("input")) {
      if (/^\s*7\s*$/.test(el.value)) return true;
    }
    return false;
  });
  say("剩几次是印出来的，不是一格给他打字的", !typable, "有一个输入框装着 7");

  /* ④ 打错了退得回来。 */
  await page.getByRole("button", { name: /^Undo the last one$/i }).click();
  await page.waitForTimeout(3000);
  const undone = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("退回一次之后写着还剩八次", /8 left/.test(undone), undone.slice(0, 200));

  /* ⑤ 手机 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await phone.goto(`${BASE}/en/portal/customers/${her.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForTimeout(1500);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/4-phone-390.png`, fullPage: true });
  console.log("拍到  4-phone-390");
  const scrolls = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  say("手机上不用左右滑", !scrolls, "会横滑");
  const small = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, select, input")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height < 40) {
        out.push(`${el.tagName}:${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 22)}=${Math.round(r.height)}`);
      }
    }
    return out;
  });
  say("手机上每一颗都按得稳（≥40px）", small.length === 0, small.join(" · "));

  /* 🔴 画面上没有中文 —— 这个系统的语言是英文（重点 22d）。 */
  const cjk = (await phone.locator("body").innerText()).match(/[一-鿿]/g) ?? [];
  say("英文系统里画面上没有中文", cjk.length === 0, cjk.join(""));
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
