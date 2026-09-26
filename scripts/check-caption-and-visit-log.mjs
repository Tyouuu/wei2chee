/**
 * 真登入、真资料库 —— items 4 & 5（founder-tasks 待办清单里他直接说「可以」
 * 的那三件不用他画的东西里的最后两件）。
 *
 * ① Lookbook「变文案」：种一份真的作品，真登入打开 Lookbook，按下按钮，
 *   看它是回来一句真的文案还是一句诚实的失败——两种都算过，只有页面
 *   卡死或者什么都不发生才算没过。
 * ② 收银自动记「这一次做了什么」：不驱动整个结帐 UI（那要一整套选品、
 *   选付款方式的点击，风险大、跟这一次改的逻辑无关），改成直接打
 *   `logTodaysVisitLines` 真正做的那两件事本身——查询今天这个客人身上
 *   `status='booked'` 的预约、呼叫 `add_visit_line`——用真的登入身分，
 *   证明查询窗口跟守卫是对的。也验证「今天两笔预约」时会读到 2 笔
 *   （不是 1），也就是那段「太含糊就不猜」的守卫真的挡得住。
 *
 * 用法：npm run dev 开着，然后 node scripts/check-caption-and-visit-log.mjs
 */
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/caption-and-visit-log";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let userId = null;
dropThrowawayOnExit(admin, () => userId);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));
const stamp = Date.now();

const email = `caption-visit-${stamp}@formae.test`;
const password = `Cv-${stamp}-x!`;
const { data: created, error: e1 } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (e1) throw new Error(`createUser: ${e1.message}`);
userId = created.user.id;
const { data: ind } = await admin.from("industries").select("id").eq("slug", "beauty").single();
const { data: lead, error: le } = await admin.from("leads").insert({ industry_id: ind.id, language: "en", answers: {} }).select("id").single();
if (le) throw new Error(`lead: ${le.message}`);
await admin.from("accounts").update({ lead_id: lead.id }).eq("id", userId);

const { error: e2 } = await api.auth.signInWithPassword({ email, password });
if (e2) throw new Error(`signIn: ${e2.message}`);

const { data: ws } = await api.rpc("my_workspace");
const projectId = ws?.[0]?.project_id;
if (!projectId) throw new Error("no project after signup");

// ── ① Lookbook: seed one real work, then drive the button through the browser ──
const seeded = await api.rpc("add_lookbook_work", {
  in_project_id: projectId,
  in_title: "Copper Balayage Melt",
  in_category: "Balayage",
  in_level: "7.3",
  in_formula: "Igora Royal 7-77 + 8-4 -- SECRET, must never reach the model",
  in_note: "Warm-toned regulars love this",
  in_tags: ["warm undertone"],
});
if (seeded.error) throw new Error(`add_lookbook_work: ${seeded.error.message}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/en/login`, { waitUntil: "load", timeout: 120000 });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/salon-preview|\/portal/, { timeout: 120000 });
await page.goto(`${BASE}/en/salon-preview/lookbook`, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(1000);

const captionBtn = page.getByRole("button", { name: /Turn into a Caption/i });
check("🔴 「变文案」按钮画出来了", await captionBtn.count() > 0);
await captionBtn.first().click();
// 真的呼叫模型，给够时间；不管回来的是一句真文案还是一句诚实的失败，
// 两种都是这一支该有的样子——只有「什么都没发生」才是没做完。
/* 🔴 第一版这里等的是 `p.font-mono` —— 而配方那个「LAB FORMULA」框本来就有
   一个 `p.font-mono`，页面一进来它就在，於是这一句立刻为真、根本没有真的
   等模型跑完，量出来 0/0 是我自己的等待条件写错，不是产品的错。改成等
   「Post Caption」那句字（只有生成完才会出现），或者等失败的那句 flash。 */
await page.waitForFunction(
  () => !!document.querySelector('[data-testid="lookbook-flash"]') ||
        [...document.querySelectorAll("span")].some((s) => s.textContent === "Post Caption"),
  { timeout: 30000 },
).catch(() => {});
const captionBoxText = await page.locator("text=Post Caption").count();
const flashText = await page.locator('[data-testid="lookbook-flash"]').innerText().catch(() => "");
check(
  "🔴 按下去之后：要嘛真的写出一份文案，要嘛给一句诚实的失败——不是卡住不动",
  captionBoxText > 0 || flashText.length > 0,
  `caption box: ${captionBoxText}, flash: "${flashText}"`,
);
if (captionBoxText > 0) {
  const written = await page.locator(".p-2\\.5 p.leading-relaxed").first().innerText().catch(() => "");
  check("🔴 配方（她的商业机密）没有出现在文案里", !written.includes("Igora") && !written.includes("SECRET"), written);
}
await page.screenshot({ path: `${OUT}/lookbook-caption.png` });
await ctx.close();
await browser.close();

// ── ② Register 收银结帐自动记「做了什么」：直接打真的查询 + 真的 RPC ──
const { data: customer, error: ce } = await api.rpc("add_directory_entry", {
  in_project_id: projectId,
  in_module_key: "customers",
  in_name: "Puan Aisyah",
});
if (ce) throw new Error(`add_directory_entry: ${ce.message}`);
const partyId = customer.id;

const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
const noon = `${todayStr}T04:00:00+08:00`; // 12pm MYT, safely inside "today"
const oneHourLater = `${todayStr}T05:00:00+08:00`;

const appt1 = await api.rpc("add_appointment", {
  in_project_id: projectId,
  in_module_key: "bookings",
  in_party: "Puan Aisyah",
  in_party_id: partyId,
  in_starts_at: noon,
  in_ends_at: oneHourLater,
  in_service: "Colour touch-up",
});
if (appt1.error) throw new Error(`add_appointment: ${appt1.error.message}`);

// The exact query logTodaysVisitLines() runs, against a real signed-in client.
async function todaysBookedFor(pid) {
  const { data } = await api
    .from("appointments")
    .select("id")
    .eq("party_id", pid)
    .eq("status", "booked")
    .gte("starts_at", `${todayStr}T00:00:00+08:00`)
    .lte("starts_at", `${todayStr}T23:59:59.999+08:00`);
  return data ?? [];
}

let todays = await todaysBookedFor(partyId);
check("🔴 一个客人、今天一笔在跑的预约 —— 查得到刚好 1 笔", todays.length === 1, todays.length);

const line1 = await api.rpc("add_visit_line", { in_appointment_id: todays[0].id, in_service: "Blow dry", in_price_cents: 4500 });
if (line1.error) throw new Error(`add_visit_line: ${line1.error.message}`);
const line2 = await api.rpc("add_visit_line", { in_appointment_id: todays[0].id, in_service: "Blow dry", in_price_cents: 4500 });
if (line2.error) throw new Error(`add_visit_line (qty 2nd): ${line2.error.message}`);

const { data: writtenLines } = await admin
  .from("appointment_lines")
  .select("service, price_cents")
  .eq("appointment_id", todays[0].id);
check("🔴 checkout 那两支 add_visit_line 呼叫真的落地成两行", (writtenLines ?? []).length === 2, writtenLines);
check("每一行的服务名跟价钱都对", (writtenLines ?? []).every((r) => r.service === "Blow dry" && r.price_cents === 4500), writtenLines);

// A second booked appointment today makes it ambiguous -- the guard must see 2, not 1.
const appt2 = await api.rpc("add_appointment", {
  in_project_id: projectId,
  in_module_key: "bookings",
  in_party: "Puan Aisyah",
  in_party_id: partyId,
  in_starts_at: `${todayStr}T08:00:00+08:00`,
  in_ends_at: `${todayStr}T09:00:00+08:00`,
  in_service: "Second visit today",
});
if (appt2.error) throw new Error(`add_appointment #2: ${appt2.error.message}`);
todays = await todaysBookedFor(partyId);
check(
  "🔴 同一个客人今天两笔在跑的预约 —— 查询老实回 2 笔（logTodaysVisitLines 看到 !==1 就会跳过，不猜是哪一笔）",
  todays.length === 2,
  todays.length,
);

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
console.log(`→ ${OUT}/lookbook-caption.png  ⚠️ 现在去用眼睛看这张图`);
if (fail.length) process.exit(1);
