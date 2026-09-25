/**
 * 储值卡送的那一部分，有没有接到客户详情页上——[任务 346]。
 *
 * `grant_credit` · `use_credit` · `credit_of` 建好那天（20260909360000）
 * 就写了 36 条 `check:deposits`，而那一支只打资料库，不开浏览器
 * （[重点 24]：像不像只有眼睛判得了）。这一支拿真的登入身分（重点 26）
 * 充值一笔、开浏览器、真的滚到那一段，用眼睛能看的字去认「Gift credit
 * remaining」跟金额有没有印出来——不是把两支尺当同一把，是两把各管一半。
 *
 *   node scripts/shoot-stored-credit.mjs
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { seedEveryShape, modulesForIndustry } from "./lib/seed-demo.mjs";
import { TRADES } from "./lib/trade-props.mjs";

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
const OUT = ".screenshots/verify";
mkdirSync(OUT, { recursive: true });

const EMAIL = `credit-${Date.now()}@formae.test`;
const PASSWORD = `Credit-${Date.now()}-x!`;
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
dropThrowawayOnExit(admin, () => userId);

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const P = proj?.id;
  if (!P) throw new Error("no project");

  const T = TRADES.salon;
  const { data: ind } = await admin.from("industries").select("id").eq("slug", T.industry).single();
  const { data: lead } = await admin.from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "verify-credit" } })
    .select("id").single();
  await admin.from("accounts").update({ lead_id: lead.id }).eq("id", userId);

  const keys = modulesForIndustry(T.industry);
  const opened = [];
  for (const key of keys) {
    const { error } = await api.rpc("add_project_page", { requested_key: key, new_title: null });
    if (!error) opened.push(key);
  }
  await seedEveryShape(api, P, `credit-${Date.now()}`, opened, {
    showroom: true,
    rows: 5,
    props: T.props,
  });

  const { data: customers } = await api
    .from("directory_entries")
    .select("id, name")
    .eq("project_id", P)
    .eq("module_key", "customers")
    .order("name");
  const mrsChan = customers?.[0];
  if (!mrsChan) throw new Error("no seeded customer found");

  /* 充值 1,000 送 200 —— 走人按的那一支，不另开写入路径。 */
  const { error: grantErr } = await api.rpc("grant_credit", {
    in_project_id: P,
    in_party_id: mrsChan.id,
    in_amount_cents: 200_00,
    in_reason: "verify-credit top-up bonus",
  });
  if (grantErr) throw new Error(`grant_credit: ${grantErr.message}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal|salon-preview/, { timeout: 60000 });

  await page.goto(`${BASE}/en/portal/customers/${mrsChan.id}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/customer-credit.png`, fullPage: true });

  const text = await page.evaluate(() => document.body.innerText);
  const ok = /gift credit remaining/i.test(text) && /RM\s?200/i.test(text);
  console.log(ok ? "🟢 那一段印出来了，RM 200" : "🔴 那一段没有印出来");
  console.log(`  客户：${mrsChan.name}（${mrsChan.id}）`);
  console.log(`  图：${OUT}/customer-credit.png`);
  if (!ok) process.exitCode = 1;

  await browser.close();
} catch (e) {
  console.error("🔴", e.stack ?? e);
  process.exitCode = 1;
}
