/**
 * 关月 / 重开 —— 用眼睛看。
 *
 * 重点 7l。`check:period-lock` 31 条真的呼叫全过，而它答不了一件事：
 * **他按不按得到那颗开关。**
 *
 * 🔴 `set_reconciliation_settled` 从 20260902020000 就在，而到 2026-09-05
 * 为止**全 app 零个呼叫**（grep 过）—— 他关不了一个月，也重开不了，
 * 於是 20260905740000 那道期间锁既看不见也碰不到。
 * **一道没有人按得到开关的锁，跟没有那道锁是同一件事。**
 *
 * 而这一段量的顺序就是他会走的顺序：
 *   看得到那颗 -> 按下去真的关了 -> 画面讲得出关了什么 ->
 *   那个月的钱真的改不了 -> 重开 -> 又改得了
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
const OUT = ".screenshots/period-lock";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `lock-${stamp}@formae.test`;
const PASSWORD = `Lock-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* 马来西亚的月份，不是伺服器的（伺服器跑 UTC，他在 UTC+8）。 */
const monthOf = (n) => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const firstOf = (n) => `${monthOf(n)}-01`;

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

  /* 八个行业开局都没有对帐那一页 —— 这是道具，不是产品的洞。 */
  const { error: pgErr } = await api.rpc("add_project_page", {
    requested_key: "reconciliation", new_title: null,
  });
  if (pgErr && !String(pgErr.message).includes("exists")) {
    throw new Error(`add_project_page(reconciliation): ${pgErr.message}`);
  }

  /* 上个月收了一笔，而且是上个月那一天 —— 这样它才落在会被关起来的那个月。 */
  /* add_ledger_entry 回的是**一整行**（returns public.ledger_entries），
     不是一个编号 —— 第一版当成编号去查，那一条红看起来像产品把钱弄丢了。 */
  const { data: entryRow, error: eErr } = await api.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 3800000, in_party: "Celcom", in_entry_on: `${monthOf(-1)}-15`,
  });
  if (eErr) throw new Error(`add_ledger_entry: ${eErr.message}`);

  const { data: recId, error: rErr } = await api.rpc("add_reconciliation", {
    in_project_id: P, in_module_key: "reconciliation",
    in_period: firstOf(-1), in_source: "Upstream statement",
    in_their_cents: 3800000, in_direction: "in",
  });
  if (rErr) throw new Error(`add_reconciliation: ${rErr.message}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  const hide = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  const url = `${BASE}/en/portal/reconciliation/${recId}`;

  /* ① 那颗按钮在不在，而且按下去之前讲不讲得出会发生什么。 */
  await page.goto(url, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/1-open.png`, fullPage: true });
  console.log("拍到  1-open");
  const open = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const closeBtn = page.getByRole("button", { name: /^Close this month$/i });
  say("🔴 对帐那一页上有一颗「关起来」", (await closeBtn.count()) === 1, `${await closeBtn.count()} 颗`);
  say("而且按下去之前就讲得出关了什么改不了",
    /cannot change/i.test(open) && /reopen it/i.test(open), open.slice(0, 400));
  /* 还没关的时候不可以写「关起来了」—— 那是这一段最容易讲反的一句。 */
  say("还没关的时候不讲「关起来了」", !/Closed on/i.test(open), open.slice(0, 400));

  /* ② 按下去，真的关了。 */
  await closeBtn.click();
  await page.waitForTimeout(3500);
  await hide();
  await page.screenshot({ path: `${OUT}/2-closed.png`, fullPage: true });
  console.log("拍到  2-closed");
  const closed = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const { data: row } = await api
    .from("reconciliations").select("settled_at").eq("id", recId).maybeSingle();
  say("🔴 按下去，资料库里那个月真的关了", !!row?.settled_at, `${row?.settled_at}`);
  say("画面上讲得出是哪一天关的", /Closed on \d{4}-\d{2}-\d{2}/i.test(closed), closed.slice(0, 400));
  const reopenBtn = page.getByRole("button", { name: /^Reopen this month$/i });
  say("而且那颗变成「重开」", (await reopenBtn.count()) === 1, `${await reopenBtn.count()} 颗`);

  /* ③ 🔴 关了之后，那个月的钱真的改不了 —— 这才是那道锁。 */
  const { error: moveErr } = await api.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 99900, in_party: "Forgotten", in_entry_on: `${monthOf(-1)}-20`,
  });
  say("🔴 关了之后，补不进那个月",
    !!moveErr && /period_locked/i.test(moveErr.message ?? ""), moveErr?.message ?? "居然让它过了");
  say("而且那句话讲得出该怎么做",
    /reopen that month/i.test(moveErr?.message ?? ""), moveErr?.message);

  /* 控制组：这个月照样进得去 —— 少了这一条，上面那一条量的是空气
     （任务 125 学到的：守卫是绿的，因为那里本来就没有东西可以挡）。 */
  const { error: thisMonthErr } = await api.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 100, in_party: "This month", in_entry_on: `${monthOf(0)}-02`,
  });
  say("而这个月照样记得进去（控制组）", !thisMonthErr, thisMonthErr?.message);

  /* ④ 重开 -> 又改得了。出路只有这一条，而它要真的走得通。 */
  await reopenBtn.click();
  await page.waitForTimeout(3500);
  await hide();
  await page.screenshot({ path: `${OUT}/3-reopened.png`, fullPage: true });
  console.log("拍到  3-reopened");
  const again = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("重开之后又回到「关起来」那一颗",
    (await page.getByRole("button", { name: /^Close this month$/i }).count()) === 1,
    again.slice(0, 300));
  const { error: afterErr } = await api.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 99900, in_party: "Forgotten", in_entry_on: `${monthOf(-1)}-20`,
  });
  say("🔴 重开之后，那个月又补得进去", !afterErr, afterErr?.message);

  /* ⑤ 手机上按得到 —— 一颗拇指按不准的开关，等於没有那颗开关。 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await phone.goto(url, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForTimeout(1500);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/4-phone-390.png`, fullPage: true });
  console.log("拍到  4-phone-390");
  const small = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, select, input")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height < 40) out.push(`${el.tagName}=${Math.round(r.height)}`);
    }
    return out;
  });
  say("手机上每一颗都按得稳（≥40px）", small.length === 0, small.join(" · "));
  const scrolls = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  say("手机上不用左右滑", !scrolls, "会横滑");

  /* 那笔上个月的钱还在 —— 关月不可以动到任何一行。 */
  const { data: still } = await api
    .from("ledger_entries").select("id").eq("id", entryRow.id).maybeSingle();
  say("关月重开都没有动到那笔钱", !!still?.id, "那一行不见了");

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
