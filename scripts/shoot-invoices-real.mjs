/**
 * 沙龙新设计的 Invoices——从示范假资料换成真的资料。真登入、真截图。
 *
 * ── 为什么（2026-09-24，Overview / Stock 之后第三页）───────────────────────
 *
 * 种两笔真收款(一笔正常、一笔被冲正过)，验证：清单是真的、点了真的能换
 * 选中哪一张、右边收据真的跟着换（这正是原始设计自己承认的那个洞——
 * 点别的行收据画面不会换），而且收据上不再印一个编出来的 6% 税金。
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
const OUT = ".screenshots/invoices-real";
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
  const email = `inv-${stamp}@formae.test`;
  const password = `Iv-${stamp}-x!`;
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

  for (const k of ["customers", "staff"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }
  const stylist = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Invoice-Test Farah",
  });
  const guestA = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Invoice-Test Aina",
  });
  const guestB = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Invoice-Test Bakri",
  });

  const payA = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 25000, in_party: "Invoice-Test Aina", in_party_id: guestA.data.id,
    in_category: "service", in_note: "Full service",
  });
  if (payA.error) throw new Error(`payA: ${payA.error.message}`);
  const updA = await admin.from("ledger_entries").update({ method: "DuitNow QR", done_by: stylist.data.id }).eq("id", payA.data.id).select();
  if (updA.error) throw new Error(`updA: ${updA.error.message}`);

  const payB = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 9000, in_party: "Invoice-Test Bakri", in_party_id: guestB.data.id,
    in_category: "service", in_note: "Haircut",
  });
  if (payB.error) throw new Error(`payB: ${payB.error.message}`);
  await admin.from("ledger_entries").update({ method: "Cash" }).eq("id", payB.data.id);
  // 冲正掉 payB，验证「Refunded」状态是真的从资料库算出来的。
  const reversal = await api.rpc("reverse_ledger_entry", { in_entry_id: payB.data.id });
  if (reversal.error) throw new Error(`reverse: ${reversal.error.message}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/salon-preview/invoices`, {
    waitUntil: "networkidle", timeout: 180000,
  });

  let body = await page.locator("body").innerText();

  if (!/INV-2024-1088|Amanda Choong|SST|SUBTOTAL/.test(body))
    ok("发明的示范发票、假税金字样都不见了");
  else no("还留着示范样品/假税金");

  if (/Invoice-Test Aina/.test(body) && /RM\s*250\.00/.test(body))
    ok("🔴 真的付款列表讲得出 Aina 跟 RM 250");
  else no("Aina 那一笔不对");

  // 两栏都套了 CSS uppercase，innerText() 读的是渲染后的样子——
  // "DuitNow QR" 显示成 "DUITNOW QR"，跟 Stock 页 "Low"→"LOW" 同一个坑。
  if (/DUITNOW QR/.test(body) && /Invoice-Test Farah/.test(body))
    ok("🔴 真的付款方式跟师傅归属都读到了");
  else no("付款方式/师傅不对", body.match(/DUITNOW[^\n]*|CASH\b/gi)?.join(" | "));

  if (/REFUNDED/.test(body)) ok("🔴 Bakri 那一笔真的显示 Refunded（冲正是真的从资料库算出来的）");
  else no("Refunded 状态没有出现");

  // 默认选中最新那一笔（Bakri，因为按 created_at desc 排）。
  if (/Invoice-Test Bakri/.test(body) && /RM\s*90\.00/.test(body))
    ok("默认收据显示最新一笔（Bakri）的真实资料");
  else no("默认收据不对");

  await page.screenshot({ path: `${OUT}/1-default-selection.png`, fullPage: true });

  // 点 Aina 那一行，收据要真的换掉——这正是原始设计自己的洞。
  await page.getByText("Invoice-Test Aina").first().click();
  await page.waitForTimeout(300);
  body = await page.locator("body").innerText();
  if (/TOTAL PAID:[\s\S]{0,20}RM\s*250\.00/.test(body) && /Guest: Invoice-Test Aina/.test(body))
    ok("🔴 点了 Aina 那一行，收据真的换成她的——原始设计的那个洞补上了");
  else no("点击换选没有真的更新收据", body.match(/TOTAL PAID:[\s\S]{0,30}/)?.[0]);

  if (!/SST|6%|SUBTOTAL/.test(body)) ok("换过去之后收据上还是没有编出来的税金");
  else no("收据上出现了编出来的税金");

  await page.screenshot({ path: `${OUT}/2-selected-aina.png`, fullPage: true });

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
