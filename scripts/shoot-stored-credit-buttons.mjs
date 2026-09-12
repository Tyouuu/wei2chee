/**
 * 「充值」「用掉」两颗按钮——真登入、真按、真截图。
 *
 * ── 为什么（2026-09-12，[任务 346/399] 收尾）─────────────────────────────
 *
 * `grant_credit` · `use_credit` 从做出来那天起零个呼叫端。客户页只接了
 * 读的那一半（「还剩多少」），这一支验证写的那一半：老板送一笔、
 * 用掉一笔，两次都真的写进 `stored_value_moves`，画面上的数字跟着变。
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
const OUT = ".screenshots/stored-credit-buttons";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
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
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };

let browser;
try {
  const stamp = Date.now();
  const email = `credbtn-${stamp}@formae.test`;
  const password = `Cb-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;

  await api.rpc("add_project_page", { requested_key: "customers", new_title: "" });
  const her = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Ms Priya",
  });
  if (her.error) throw new Error(`add_directory_entry: ${her.error.message}`);
  const partyId = her.data.id;

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/portal/customers/${partyId}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  let body = await page.locator("body").innerText();
  if (/None -- never given/i.test(body)) ok("一开始：没有送过，讲得出「没有」");
  else no("一开始的字不对", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/1-before.png`, fullPage: true });

  // ── 送一笔 RM 200 ──────────────────────────────────────────────────────
  const grantAmountBox = page.locator('input[type="number"]').first();
  await grantAmountBox.fill("200");
  await page.locator('input[type="text"]').first().fill("Birthday");
  await page.getByRole("button", { name: "Give it" }).click();
  await page.waitForTimeout(6000);

  const { data: afterGrant } = await admin
    .from("stored_value_moves").select("direction, amount_cents, reason")
    .eq("party_id", partyId).eq("direction", "in").single();
  if (afterGrant?.amount_cents === 20000 && afterGrant?.reason === "Birthday")
    ok("🔴 送出去了，资料库里真的多一笔 RM 200，理由对了");
  else no("送出去没有真的写进资料库", JSON.stringify(afterGrant));

  body = await page.locator("body").innerText();
  if (/RM\s*200(?!\.\d)/.test(body)) ok("画面上的数字跟着变成 RM 200");
  else no("画面上的数字没有跟着变", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/2-after-grant.png`, fullPage: true });

  // ── 用掉 RM 50 ─────────────────────────────────────────────────────────
  const useAmountBox = page.locator('input[type="number"]').nth(1);
  await useAmountBox.fill("50");
  await page.getByRole("button", { name: "Record it" }).click();
  await page.waitForTimeout(6000);

  const { data: afterUse } = await admin
    .from("stored_value_moves").select("direction, amount_cents")
    .eq("party_id", partyId).eq("direction", "out").single();
  if (afterUse?.amount_cents === 5000) ok("🔴 用掉了，资料库里真的多一笔 RM 50 的支出");
  else no("用掉没有真的写进资料库", JSON.stringify(afterUse));

  body = await page.locator("body").innerText();
  if (/RM\s*150(?!\.\d)/.test(body)) ok("画面上的数字变成 RM 150（200 - 50）");
  else no("画面上的余额不对", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/3-after-use.png`, fullPage: true });

  // ── 用超过她剩下的，应该被挡下来 ──────────────────────────────────────
  await useAmountBox.fill("500");
  await page.getByRole("button", { name: "Record it" }).click();
  await page.waitForTimeout(2000);
  body = await page.locator("body").innerText();
  if (/gift credit left/i.test(body)) ok("🔴 用超过剩下的，讲得出「只剩多少」，没有让她透支");
  else no("超支没有被挡下来", body.slice(0, 300));

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
