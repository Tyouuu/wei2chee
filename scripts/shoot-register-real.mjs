/**
 * 沙龙新设计的 Register & Checkout——这一页跟 Lookbook 同一类：真的购物车
 * 结帐地基不存在(Task 405 自己的档头就写着「需要全新的地基」)。这一支验的
 * 是左边目录换成真的 catalog_items、顶栏数字是真的、右边样品票据老实
 * 标成「不是真的」、没有地基的按钮至少讲一句诚实的话。真登入、真截图。
 *
 * ── 为什么（2026-09-24，End of Day Cash 之后第十一页，也是最后一页）───────
 *
 * 种两件真货品/服务(带真价钱跟 SKU)、今天一笔真收款、一笔真的完成预约。
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
const OUT = ".screenshots/register-real";
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
  const email = `reg-${stamp}@formae.test`;
  const password = `Rg-${stamp}-x!`;
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

  for (const k of ["customers", "inventory", "bookings"]) {
    await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  }

  const item = await api.rpc("add_catalog_item", {
    in_project_id: pid, in_module_key: "inventory",
    in_name: "Register-Test Keratin Treatment", in_unit: "session", in_sku: "REG-KER-01",
  });
  if (item.error) throw new Error(`item: ${item.error.message}`);
  await admin.from("catalog_items").update({ price_cents: 32000 }).eq("id", item.data.id);

  const guest = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Register-Test Guest",
  });
  if (guest.error) throw new Error(`guest: ${guest.error.message}`);

  const pay = await api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 9500, in_party: "Register-Test Guest", in_party_id: guest.data.id,
    in_category: "service", in_note: "Haircut",
  });
  if (pay.error) throw new Error(`pay: ${pay.error.message}`);

  const now = new Date();
  const start = new Date(now); start.setUTCHours(now.getUTCHours() - 1);
  const visit = await api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: start.toISOString(), in_ends_at: now.toISOString(),
    in_party: "Register-Test Guest", in_party_id: guest.data.id, in_service: "Haircut",
  });
  if (visit.error) throw new Error(`visit: ${visit.error.message}`);
  const done = await api.rpc("set_appointment_status", { in_id: visit.data, in_status: "done" });
  if (done.error) throw new Error(`done: ${done.error.message}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/salon-preview/register`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await page.locator("body").innerText();

  // ⚠️ "Full Balayage & Gloss Lift" 故意还留着——它现在活在右边清楚标成
  // "Not a real folio" 的样品票据示范里，不是悄悄冒充真资料，跟 Lookbook
  // 那六张示范卡片同一个道理。真正要确认清空的是左边目录格跟假客人姓名。
  if (!/Haircut & Signature Blowdry|Men's Precision Fade|Datin Nora Al-Habshee/.test(body))
    ok("九张手写的假目录卡(除了样品票据里刻意保留的示范行)、假客人姓名都不见了");
  else no("还留着手写的假目录/假客人");

  if (/Register-Test Keratin Treatment/.test(body) && /REG-KER-01/.test(body) && /RM\s*320(\.00)?\b/.test(body))
    ok("🔴 真的货品出现在目录格,带真的 SKU 跟价钱");
  else no("真的货品没有正确出现");

  if (/RM\s*95(\.00)?\b/.test(body)) ok("🔴 顶栏 Shift Takings 真的是今天那笔收款(RM 95)");
  else no("Shift Takings 不对", body.match(/Shift Takings[\s\S]{0,60}/)?.[0]);

  if (/1\s*\/\s*1/.test(body)) ok("🔴 顶栏 Completed Today 真的是 1/1(今天一笔预约,已完成)");
  else no("Completed Today 不对", body.match(/Completed Today[\s\S]{0,40}/)?.[0]);

  if (/Not a real folio/i.test(body)) ok("🔴 右边样品票据老实标成「不是真的」,不是悄悄冒充真资料");
  else no("样品票据没有诚实标注");

  await page.screenshot({ path: `${OUT}/1-register.png`, fullPage: true });

  // 真的搜索——过滤目录。
  await page.getByPlaceholder(/Search service or retail SKU/).fill("Keratin");
  await page.waitForTimeout(400);
  const afterSearch = await page.locator("body").innerText();
  if (/Register-Test Keratin Treatment/.test(afterSearch)) ok("🔴 搜索是真的在过滤目录");
  else no("搜索没有真的过滤");

  // 没有地基的按钮——至少给诚实的话。
  let sawDialog = false;
  page.once("dialog", (d) => { sawDialog = true; d.accept(); });
  await page.locator('button:has-text("Charge")').first().click();
  await page.waitForTimeout(300);
  if (sawDialog) ok("🔴 「Charge」按下去至少讲一句诚实的话,不是完全没反应");
  else no("「Charge」按下去什么都没发生");

} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那张图`);
