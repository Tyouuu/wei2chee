/**
 * 会员月费——真登入、真按、真截图。
 *
 * ── 为什么（2026-09-24，答老板问「功能层面还没到跟大厂对齐」那句话）───────
 *
 * `add_membership` · `collect_membership_fee` · `set_membership_archived` ·
 * `memberships_of`（20260912060000）从做出来那天起零个 UI 呼叫端。这一支
 * 验证客户那一页新加的那一段：开始收会员费、这个月收了、取消、重新开始，
 * 每一步都真的写进 `memberships` / `membership_payments` / `ledger_entries`。
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
const OUT = ".screenshots/membership-panel";
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

/* 偶尔 router.refresh() 的往返比平常晚现身——摊开重试而不是死等一次
   （跟 [任务 372] 那次同一个做法），不是因为逻辑有问题，是网路时间。 */
async function waitForText(page, pattern, tries = 10, gapMs = 800) {
  for (let i = 0; i < tries; i++) {
    const body = await page.locator("body").innerText();
    if (pattern.test(body)) return body;
    await page.waitForTimeout(gapMs);
  }
  return page.locator("body").innerText();
}

let browser;
try {
  const stamp = Date.now();
  const email = `member-${stamp}@formae.test`;
  const password = `Mb-${stamp}-x!`;
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
    in_project_id: pid, in_module_key: "customers", in_name: "Puan Salmah",
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
  // 会员段落在「Account & activity」分页签底下（[任务 404]）——那是
  // 一个明写 role="tab" 的按钮，不是普通 role="button"，两者在无障碍树
  // 里不是同一个角色，getByRole("button", ...) 找不到它。
  const tab = page.getByRole("tab", { name: "Account & activity" });
  if (await tab.count()) await tab.click();
  await page.waitForTimeout(300);

  let body = await page.locator("body").innerText();
  if (/A fixed fee every month/.test(body)) ok("一开始：讲得出还没开过会员费的说明");
  else no("一开始的字不对", body.slice(0, 400));
  await page.screenshot({ path: `${OUT}/1-none-yet.png`, fullPage: true });

  // ── 开始收会员费：VIP Monthly · RM 120/mo ────────────────────────────────
  await page.getByRole("button", { name: "Start membership" }).click();
  await page.getByLabel(/What it's called/).fill("VIP Monthly");
  await page.getByLabel("Fee per month").fill("120");
  await page.getByRole("button", { name: "Start membership" }).click();
  await page.waitForTimeout(3000);

  const { data: memRow } = await admin
    .from("memberships").select("id, plan_name, monthly_fee_cents, next_due_on")
    .eq("party_id", partyId).single();
  if (memRow?.plan_name === "VIP Monthly" && memRow?.monthly_fee_cents === 12000)
    ok("🔴 会员费真的开了，计划名字跟金额都对");
  else no("开会员费没有真的写对", JSON.stringify(memRow));

  body = await waitForText(page, /VIP Monthly/);
  if (/VIP Monthly/.test(body) && /RM\s*120/.test(body) && new RegExp(`Next due ${memRow.next_due_on}`).test(body))
    ok("画面上讲得出计划、金额、下一次该缴的日期");
  else no("画面上的会员资讯不对", body.slice(0, 400));
  await page.screenshot({ path: `${OUT}/2-started.png`, fullPage: true });

  // ── 这个月收了 ────────────────────────────────────────────────────────
  const dueBefore = memRow.next_due_on;
  await page.getByRole("button", { name: "Mark this month collected" }).click();
  await page.waitForTimeout(3000);

  const { data: afterCollect } = await admin
    .from("memberships").select("next_due_on").eq("id", memRow.id).single();
  if (afterCollect?.next_due_on !== dueBefore) ok("🔴 收了之后，下一次该缴的日期真的往后推了");
  else no("日期没有往后推", JSON.stringify(afterCollect));

  const { data: payRow } = await admin
    .from("membership_payments").select("amount_cents, ledger_entry_id")
    .eq("membership_id", memRow.id).single();
  if (payRow?.amount_cents === 12000 && payRow?.ledger_entry_id)
    ok("🔴 那笔钱真的记进 membership_payments，也真的挂了一笔 ledger_entries");
  else no("那笔钱没有真的记对", JSON.stringify(payRow));

  const { data: ledgerRow } = await admin
    .from("ledger_entries").select("amount_cents, party_id, direction")
    .eq("id", payRow.ledger_entry_id).single();
  if (ledgerRow?.amount_cents === 12000 && ledgerRow?.party_id === partyId && ledgerRow?.direction === "in")
    ok("🔴 那笔 ledger_entries 是真的一笔收款，挂在这位客人身上");
  else no("那笔收款记错了", JSON.stringify(ledgerRow));
  await page.screenshot({ path: `${OUT}/3-collected.png`, fullPage: true });

  // ── 取消会员 ──────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Cancel membership" }).click();
  await page.waitForTimeout(3000);

  const { data: afterCancel } = await admin
    .from("memberships").select("archived_at").eq("id", memRow.id).single();
  if (afterCancel?.archived_at) ok("🔴 取消了，资料库里真的标了 archived_at");
  else no("取消没有真的写进资料库", JSON.stringify(afterCancel));

  body = await waitForText(page, /Cancelled/);
  if (/Cancelled/.test(body) && (await page.getByRole("button", { name: "Restart" }).count()) > 0)
    ok("画面换成「已经取消」，也换成「重新开始」的按钮");
  else no("取消后的画面不对", body.slice(0, 400));
  await page.screenshot({ path: `${OUT}/4-cancelled.png`, fullPage: true });

  // ── 重新开始 ──────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Restart" }).click();
  await page.waitForTimeout(3000);

  const { data: afterRestart } = await admin
    .from("memberships").select("archived_at").eq("id", memRow.id).single();
  if (afterRestart?.archived_at === null) ok("🔴 重新开始了，archived_at 真的清掉了");
  else no("重新开始没有真的写进资料库", JSON.stringify(afterRestart));
  await page.screenshot({ path: `${OUT}/5-restarted.png`, fullPage: true });

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
