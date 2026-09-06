/**
 * 他拍一张收据，那几格自己填好，按保存，帐上多一笔 —— 在真的浏览器里走一次。
 *
 * ── 为什么资料库那一支不够 ────────────────────────────────────────────────
 *
 * `npm run check:receipt` 26 条**真的模型呼叫**从 2026-09-04 起就全过了，
 * 而**画面上那颗按钮到 2026-09-07 为止不存在** —— 也就是那 26 条量的是
 * 一条没有人走得到的路（[任务 140](../docs/founder-tasks.md#140) 自己的
 * 收尾就写着「没有画面」）。
 *
 * 这一支走的是他真的会走的那五段：
 *   ① 选一张图 → ② 浏览器缩图 → ③ 传上那个 private 的桶（RLS 在那一层挡）
 *   → ④ 打 `/api/receipt` → ⑤ 那几格填进去 → ⑥ 按保存 → ⑦ 帐上真的多一笔
 *
 * 🔴 而它真正的靶是最后两段：这个仓库最贵的那一类缺陷是
 * **「读到了，送不到」** —— `receipt_url` 那一栏从建表那天就在，
 * 两支写入函式从第一版就收它，而三个星期零个 TypeScript 传过它。
 * 所以这里不只看画面上填了没有，**要回资料库问那一行**。
 *
 * ⚠️ 它花钱：走一次就是一次真的模型呼叫（量过 3.0 秒一张干净的单）。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages } from "./lib/seed-demo.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = `receipt-${Date.now()}@formae.test`;
const PASSWORD = `Receipt-${Date.now()}-x!`;

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const api = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

/* 🔴 服务器没开就不要跑 —— 一份「那颗按钮不在」的报告，
   跟一份「服务器没开」的报告，在输出里长得一模一样。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
const ok = (name, cond, saw) => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

/** 一张真的马来西亚现金单。⚠️ 三个金额是**故意的**（小计 · TOTAL · 收的现金）
 *  —— 它要挑对 TOTAL 那一个，而不是最大的那一个。
 *  日期写 `01/09/2026`：这个市场是日在前，读成 9 月 1 号才对。 */
async function receiptImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1000">
  <rect width="720" height="1000" fill="#ffffff"/>
  <g font-family="monospace" fill="#111111">
    <text x="360" y="70" font-size="30" text-anchor="middle" font-weight="bold">SENG HUAT HARDWARE</text>
    <text x="360" y="106" font-size="20" text-anchor="middle">No 12, Jalan Kebun, Klang</text>
    <text x="360" y="196" font-size="26" text-anchor="middle" font-weight="bold">CASH BILL</text>
    <text x="60"  y="250" font-size="22">Date : 01/09/2026</text>
    <text x="420" y="250" font-size="22">No : 004512</text>
    <text x="60"  y="330" font-size="22">Cement 50kg</text>
    <text x="360" y="330" font-size="22">5 x 24.10</text>
    <text x="660" y="330" font-size="22" text-anchor="end">120.50</text>
    <text x="60"  y="412" font-size="22">Subtotal</text>
    <text x="660" y="412" font-size="22" text-anchor="end">120.50</text>
    <text x="60"  y="462" font-size="26" font-weight="bold">TOTAL</text>
    <text x="660" y="462" font-size="26" text-anchor="end" font-weight="bold">RM 120.50</text>
    <text x="60"  y="512" font-size="22">Cash</text>
    <text x="660" y="512" font-size="22" text-anchor="end">RM 150.00</text>
    <text x="360" y="640" font-size="20" text-anchor="middle">Terima kasih</text>
  </g>
</svg>`;
  return await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

let userId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const projectId = proj.id;
  await api.rpc("set_project_style", { new_style: "ledger" });
  const { opened } = await openAllPages(api, { quiet: true });
  if (!opened.includes("expenses")) throw new Error("没有开销那一页 —— 道具没摆好");

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 240000 });

  console.log("\n① 那颗按钮画在花钱那一页上");
  await page.goto(`${BASE}/en/portal/expenses/new`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(2500);
  ok(
    "开销那一页上有「拍一张收据」",
    (await page.locator("[data-receipt-shot]").count()) > 0,
  );
  ok(
    "🔴 而且有一格日期 —— 少了它，一叠上个月的收据全部落在这个月",
    (await page.locator('[data-field="entry_on"]').count()) > 0,
  );

  await page.goto(`${BASE}/en/portal/payments/new`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(2000);
  ok(
    "🔴 收进来的钱那一页不画它",
    (await page.locator("[data-receipt-shot]").count()) === 0,
  );

  console.log("\n② 🔴 真的选一张图，走完那五段");
  await page.goto(`${BASE}/en/portal/expenses/new`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: ".screenshots/receipt/1-before.png",
    fullPage: true,
  });

  const started = Date.now();
  await page.setInputFiles('[data-receipt-shot] input[type="file"]', {
    name: "cash-bill.jpg",
    mimeType: "image/jpeg",
    buffer: await receiptImage(),
  });
  /* 等那句「读好了」，不要等一个写死的秒数 —— route 那边的上限是 120 秒，
     而一张皱的单会想得比这一张久。 */
  await page
    .locator("[data-receipt-shot]")
    .getByText(/Read\. Check the boxes|读好了/i)
    .waitFor({ timeout: 150000 })
    .catch(() => {});
  const tookMs = Date.now() - started;
  console.log(`    走完那五段花了 ${(tookMs / 1000).toFixed(1)} 秒`);

  const val = async (sel) =>
    (await page.locator(sel).first().inputValue().catch(() => "")).trim();
  const amount = await val('[data-field="amount"]');
  const party = await val('[data-field="secondary"]');
  const note = await val('[data-field="primary"]');
  const onDate = await val('[data-field="entry_on"]');

  ok("金额填进去了 · 120.50", /120\.50/.test(amount), amount || "空的");
  ok(
    "🔴 挑的是 TOTAL，不是那张单上最大的那个数字（150.00 是他给的现金）",
    !/150/.test(amount),
    amount,
  );
  /* ⚠️ 认「HARDWARE」不认整个店名。第一版写 `seng huat`，
     而它读回来是 **SENG HLIAT** —— 那是模型在我自己画的那张 SVG 上
     认错了一个字母，**产品做的是对的**（读到什么就填什么）。
     一支尺在这里量辨字率，就是拿别人的活当自己的靶：
     那一件是 `npm run check:receipt` 在量的。
     这一条要证明的是**那一栏落到了这一格**，不是它一个字母都没错。 */
  ok("哪一家填进去了", /hardware/i.test(party), party || "空的");
  ok("买了什么填进去了", note.length > 0, note || "空的");
  ok(
    "🔴 日期读成 9 月 1 号 —— 这个市场是日在前",
    onDate === "2026-09-01",
    onDate || "空的",
  );
  await page.screenshot({
    path: ".screenshots/receipt/2-read.png",
    fullPage: true,
  });

  console.log("\n③ 🔴 按保存，回资料库问那一行");
  await page
    .getByRole("button", { name: /^Save$|^保存/ })
    .first()
    .click();
  await page.waitForTimeout(4000);
  const { data: rows, error: rErr } = await api
    .from("ledger_entries")
    .select("amount_cents, party, note, entry_on, receipt_url, direction")
    .eq("project_id", projectId);
  ok("读得到那张表", !rErr, rErr?.message);
  const row = (rows ?? [])[0] ?? {};
  ok("帐上真的多一笔", (rows ?? []).length === 1, `${(rows ?? []).length} 行`);
  ok("金额进去了 · RM 120.50", Number(row.amount_cents) === 12050, String(row.amount_cents));
  ok("方向是出去的钱", row.direction === "out", String(row.direction));
  ok(
    "🔴 日期是收据上那一天，不是今天",
    row.entry_on === "2026-09-01",
    String(row.entry_on),
  );
  ok(
    "🔴 那张收据挂在这一笔上（`receipt_url` 三个星期没有人写过它）",
    typeof row.receipt_url === "string" &&
      row.receipt_url.startsWith(`${projectId}/`),
    String(row.receipt_url),
  );

  console.log("\n④ 那张照片是他的，别人拿不到");
  const { data: other } = await admin.auth.admin.createUser({
    email: `receipt-other-${Date.now()}@formae.test`,
    password: `${PASSWORD}-o`,
    email_confirm: true,
  });
  const otherApi = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await otherApi.auth.signInWithPassword({
    email: other.user.email,
    password: `${PASSWORD}-o`,
  });
  const { data: stolen } = await otherApi.storage
    .from("receipts")
    .download(row.receipt_url);
  ok("🔴 另一家下载不了那张收据", !stolen);
  await dropThrowaway(admin, other.user.id);

  console.log("\n⑤ 存过之后，那一格日期锁住（钱不改，只开一张相反的）");
  await page.goto(`${BASE}/en/portal/expenses`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(2000);
  const firstCell = page.locator("table a").first();
  if ((await firstCell.count()) > 0) {
    await firstCell.click();
    await page.waitForTimeout(3000);
    const box = page.locator('[data-field="entry_on"]').first();
    ok("那一格还在", (await box.count()) > 0);
    ok(
      "🔴 而且它是锁的",
      (await box.getAttribute("aria-readonly")) === "true",
      String(await box.getAttribute("aria-readonly")),
    );
    ok(
      "🔴 读得回来 —— 打开一笔上个月的，看到的是上个月",
      (await box.inputValue()) === "2026-09-01",
      await box.inputValue(),
    );
    ok(
      "🔴 而那颗相机不画在这一页上（这一页填不进任何一格）",
      (await page.locator("[data-receipt-shot]").count()) === 0,
    );
    await page.screenshot({
      path: ".screenshots/receipt/3-saved.png",
      fullPage: true,
    });
  } else {
    ok("点得进那一笔", false, "表上一行都没有");
  }
  console.log("\n⑥ 390 —— 判这一页的是他，而他在手机上");
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await context.storageState(),
  });
  const mp = await phone.newPage();
  await mp.goto(`${BASE}/en/portal/expenses/new`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await mp.waitForTimeout(2500);
  ok("那颗按钮在", (await mp.locator("[data-receipt-shot]").count()) > 0);
  const wide = await mp.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  ok("390 上不横滚", !wide);
  /* ⚠️ 打击面 44 起跳 —— 一颗只有一行字的按钮画出来 21px 高，
     而他那根拇指按不准 21px（shoot:commission 在 390 量到的同一条）。 */
  const box = await mp
    .locator('[data-receipt-shot] label')
    .first()
    .boundingBox();
  ok(
    "拇指按得准（≥44）",
    (box?.height ?? 0) >= 44,
    `${Math.round(box?.height ?? 0)}px`,
  );
  await mp.screenshot({
    path: ".screenshots/receipt/4-phone.png",
    fullPage: true,
  });
  await phone.close();
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass} 过 ${fail} 没过`);
console.log("→ .screenshots/receipt/  ⚠️ 现在去用眼睛看那三张图");
process.exitCode = fail ? 1 : 0;
