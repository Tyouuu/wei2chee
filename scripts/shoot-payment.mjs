/**
 * 客人付了钱，帐上自己多一行 —— 用眼睛看那一行出现。
 *
 * `check:payment` 那 29 条打的是 RPC。它答得了「资料库对不对」，
 * 答不了[重点 7l](../docs/founder-points.md) 问的那一句：**画面上真的多了一行吗。**
 *
 * ⚠️ 而且回呼是**真的用 HTTP 打进那一支 route 的**，不是在这里直接呼叫
 * 资料库 —— 绕过 route 就等於没有验那一段，而那一段正是闸道以后会打的。
 *
 * ⚠️ 用完就删的帐号。**不碰他的 demo** —— 在他自己的示范系统上凭空多一笔
 * 收款，是为了拍一张图去改他给客人看的数字。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/payment";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `pay-shot-${stamp}@formae.test`;
const PASSWORD = `PayShot-${stamp}-x!`;
const REF = `chip-shot-${stamp}`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const failed = [];
const say = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failed.push(name);
};

let userId = null;
let browser;

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;

  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");

  /* 一个刚注册的帐号 `style` 是 null，而工作台那几页会把他推去挑风格 ——
     第一版就是那样拍到一张「Choose your system style」。挑一套，
     然后再拍。（走那支人按的 RPC，不是直接 update。） */
  const { error: styleErr } = await api.rpc("set_project_style", { new_style: "ledger" });
  if (styleErr) throw new Error(`style: ${styleErr.message}`);

  for (const [key, title] of [["quotations", "Quotations"], ["payments", "Payments"]]) {
    const { error } = await api.rpc("add_project_page", { requested_key: key, new_title: title });
    if (error) throw new Error(`${key}: ${error.message}`);
  }

  const { data: job, error: jobErr } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id, in_module_key: "quotations",
    in_title: "Kitchen refit", in_party: "Mr Tan", in_amount_cents: 4_850_000,
  });
  if (jobErr) throw new Error(`quotation: ${jobErr.message}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  /* ── 改之前 ─────────────────────────────────────────────────────── */
  await page.goto(`${BASE}/en/portal/payments`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: `${OUT}/1-before.png`, fullPage: false });
  say("改之前那一页上没有这笔钱", !before.includes("3,000"), "居然已经有了");

  /* ── 他开一张付款要求（以后是「发一条付款连结给客人」那颗按钮） ─── */
  const { error: reqErr } = await api.rpc("open_payment_request", {
    in_project_id: proj.id, in_amount_cents: 300_000,
    in_provider: "chip", in_provider_ref: REF,
    in_record_id: job.id, in_payer: "Mr Tan",
  });
  say("开得起一张付款要求", !reqErr, reqErr?.message);

  const mid = await page.reload({ waitUntil: "networkidle" }).then(() =>
    page.evaluate(() => document.body.innerText),
  );
  say("开了要求之后，帐上还是什么都没有（他还没付）", !mid.includes("3,000"), "太早出现了");

  /* ── 🔴 闸道打进来。真的 HTTP，真的那一支 route ─────────────────── */
  const res = await fetch(`${BASE}/api/pay/chip`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pay-secret": env.PAY_CALLBACK_SECRET ?? "" },
    body: JSON.stringify({ provider_ref: REF, paid_cents: 300_000, method: "card", payer: "Mr Tan" }),
  });
  const body = await res.json().catch(() => null);
  say("回呼那一支收得下来", res.status === 200 && body?.ok === true, `${res.status} ${JSON.stringify(body)}`);

  /* ── 改之后：没有人碰过键盘 ─────────────────────────────────────── */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: `${OUT}/2-after.png`, fullPage: false });
  say("🔴 收款那一页自己多了一行 RM 3,000", after.includes("3,000"), after.slice(0, 200));
  /* ⚠️ 我第一版在这里硬性要求画面上看得到「card」，而它红了 ——
     **红的是我的期望，不是产品。** 去查了：那一栏真的写进去了
     （`ledger_entries.method = 'card'`），只是**收款那张表根本没有那一栏**
     （`live-rows.ts` 的投影没有 select 它）。

     把作者的偏好写成正确答案，尺子就不再量产品，开始量作者 ——
     这个仓库记过两次。所以这里守的是**存得住**，
     而「画面上看不看得到」印出来给人看，不判它对错（那是版面的决定，
     而版面不是这个 session 的地盘）。 */
  const { data: methodRow } = await api
    .from("ledger_entries").select("method").eq("reference", REF).single();
  say("记得住是刷卡进来的", methodRow?.method === "card", `${methodRow?.method}`);
  console.log(
    `   （画面上看不看得到付款方式：${/card/i.test(after) ? "看得到" : "看不到"}` +
      " —— 这一栏只印，不判)",
  );

  /* 那张单自己变成「还欠 RM 45,500」。 */
  await page.goto(`${BASE}/en/portal/quotations/${job.id}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  await page.waitForTimeout(1200);
  const doc = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: `${OUT}/3-document.png`, fullPage: false });
  say("🔴 那张单自己算出还欠 RM 45,500", doc.includes("45,500"), doc.slice(0, 240));

  /* 手机上也看一眼 —— 他的客人是在手机上付的，他也是在手机上看的。 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await phone.goto(`${BASE}/en/portal/payments`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForTimeout(1200);
  await phone.screenshot({ path: `${OUT}/4-phone-390.png`, fullPage: false });
  const small = await phone.evaluate(() => document.body.innerText);
  say("手机上也看得到", small.includes("3,000"), small.slice(0, 160));
} finally {
  if (browser) await browser.close();
  if (!(await dropThrowaway(admin, userId))) failed.push("临时帐号删不掉");
  else console.log("\n临时帐号删掉了");
}

console.log(`\n判：${failed.length ? `${failed.length} 条没过` : "全过"} · 图在 ${OUT}`);
process.exit(failed.length ? 1 : 0);
