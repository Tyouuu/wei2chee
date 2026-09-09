/**
 * AI 助手，照他真的会遇到的顺序拍一次。
 *
 * ── 为什么要这一支，而 shoot:assistant 已经在（2026-09-09）────────────────
 *
 * 那一支拍的是**出事的时候**（等太久 · 500 · 那句话讲得对不对），
 * 而老板问的是另一件：**「ai助手的UI设计是长什么样的」**。
 *
 * 而这两件今天差得最远的一格，是**他找不找得到它**：
 * `front-door.ts` 2026-09-07 之后，每一次打开都是他的系统 ——
 * 编辑器（连同助手）退到「改设计」那一颗按钮后面。
 * 所以第一张要拍的不是助手，是**没有助手的那一屏**。
 *
 * 四张：
 *   1-system   他每天打开的那一页 —— 整页没有助手
 *   2-rest     进了编辑器、什么都没选 —— 一条细线
 *   3-open     点一块 —— 展开，带着那一块自己的四个动词
 *   4-reply    真的讲一句话、真的呼叫一次模型
 *
 * ⚠️ **不用他的示范帐号** —— 编辑器有自动保存，而第 4 张会真的改一页。
 * 2026-08-27 那一次就是这样把示范官网的大标题改成「二十年装修经验」
 * 并且留在那里的（任务 23e）。这一支自己开一个用完就删的。
 *
 * ⚠️ 第 4 张**真的花一次模型的钱**（约 RM 0.05）—— 一张假的回覆答不了
 * 「它长什么样」，而那正是他问的那一句。
 *
 *   npm run shoot:ai        （要先 npm run dev）
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages, seedEveryShape } from "./lib/seed-demo.mjs";

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
const OUT = ".screenshots/ai";
mkdirSync(OUT, { recursive: true });

const MARK = `AI${Date.now().toString().slice(-6)}`;
const EMAIL = `ai-${Date.now()}@formae.test`;
const PASSWORD = `Ai-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* 🔴 服务器没开就不要跑 —— 一份「助手整个不见了」的报告，跟一份
   「服务器没开」的报告，在画面上长得一模一样。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let userId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;
const notes = [];
const say = (ok, line) => {
  notes.push({ ok, line });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${line}`);
};

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
  if (!P) throw new Error("注册没有开出一个 project");
  await api.rpc("set_project_style", { new_style: "ledger" });
  const { opened } = await openAllPages(api, { quiet: true });
  await seedEveryShape(api, P, MARK, opened, { quiet: true, rows: 5, showroom: true });

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  const hideDev = () =>
    page.addStyleTag({
      content:
        "nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }",
    });

  /* ── ① 他每天打开的那一页 ─────────────────────────────────────────────── */
  await page.goto(`${BASE}/en/portal/quotations`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const gotIt = page.getByRole("button", { name: /got it, hide this/i }).first();
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(500);
  await hideDev();
  await page.screenshot({ path: `${OUT}/1-system.png` });
  const hasPanelHere = await page.locator('[data-panel="ai"]').count();
  say(hasPanelHere === 0, `他每天打开的那一页上，助手在不在 — ${hasPanelHere ? "在" : "不在"}`);

  /* ── ② 进编辑器，什么都不选 ───────────────────────────────────────────── */
  await page.goto(`${BASE}/en/portal/quotations?design=1`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(6000);
  await hideDev();
  await page.screenshot({ path: `${OUT}/2-rest.png` });
  const restH = await page
    .locator('[data-dock="ai"]')
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().height))
    .catch(() => 0);
  say(restH > 0, `什么都没选的时候，那一条有多高 — ${restH}px`);

  /* ── ③ 点一块 ────────────────────────────────────────────────────────── */
  const block = page.locator("[data-puck-dnd] h1, [data-puck-dnd] h2").first();
  await block.click({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await hideDev();
  await page.screenshot({ path: `${OUT}/3-open.png` });
  const openH = await page
    .locator('[data-dock="ai"]')
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().height))
    .catch(() => 0);
  say(openH > restH, `点一块之后它展开了 — ${restH}px → ${openH}px`);

  /* ── ④ 真的讲一句话 ──────────────────────────────────────────────────── */
  const box = page.locator('[data-panel="ai"] textarea').first();
  await box.waitFor({ timeout: 30000 });
  await box.fill("Add a column called Site supervisor to the table");
  /* ⚠️ 那颗按钮**没有 `type` 属性** —— 它故意不在一个 form 里
     （Puck 的栏位面板自己就是一个 form，套一层是不合法的 HTML，
      见 ai-assistant.tsx 那一段注解）。所以照它的字找它。 */
  await page
    .locator('[data-panel="ai"]')
    .getByRole("button", { name: /change it/i })
    .first()
    .click({ timeout: 30000 });
  /* 🔴 等「Thinking…」不见，不是等某一句话出现 ——
     第一版等的是 /column/，而**他问的那一句里就有 column**，
     所以它当场就中了，拍到的是还在转的那一格。
     一个已经为真的条件，跟一个等到了的条件，在报告里长得一模一样。 */
  await page
    .locator('[data-panel="ai"]')
    .getByText(/thinking/i)
    .first()
    .waitFor({ state: "detached", timeout: 180000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
  await hideDev();
  await page.screenshot({ path: `${OUT}/4-reply.png` });
  const reply = await page
    .locator('[data-panel="ai"]')
    .innerText()
    .catch(() => "");
  const said = reply.split("\n").map((s) => s.trim()).filter(Boolean).slice(-6).join(" / ");
  say(reply.length > 0, `它回了什么 — ${said.slice(0, 160)}`);

  /* ── ⑤ 他附一张图（2026-09-09 加的）──────────────────────────────────────
     老板自己讲的用法：`拍照給妳分析啊 上傳invoice啊`。
     🔴 而在 20260909160000 之前，那张图上传之后画面上那颗缩图指着的是一条
     **公开的网址** —— 任何人拿到都打得开，而它可能是他供应商的发票。
     现在缩图是浏览器自己的 `blob:`（只在这个分页里存在），图本身在
     private 的 `ask-photos` 里。**画面上要一模一样地看得到那张图**，
     所以这一张非拍不可：一条量得到的 src，跟一张看得到的缩图，是两件事。 */
  const shot = await sharp({
    create: { width: 900, height: 500, channels: 3, background: "#1f6feb" },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  await page
    .locator('[data-panel="ai"] input[type="file"]')
    .first()
    .setInputFiles({ name: "invoice.jpg", mimeType: "image/jpeg", buffer: shot });
  const thumb = page.locator('[data-panel="ai"] img').first();
  await thumb.waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await hideDev();
  await page.screenshot({ path: `${OUT}/5-photo.png` });
  const src = await thumb.getAttribute("src").catch(() => "");
  say(!!src && src.startsWith("blob:"), `缩图指着什么 — ${String(src).slice(0, 60)}`);
  const box2 = await thumb.boundingBox().catch(() => null);
  say(!!box2 && box2.width > 8 && box2.height > 8, `缩图画出来了没有 — ${box2 ? `${Math.round(box2.width)}×${Math.round(box2.height)}` : "没有"}`);
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
  console.log("\n临时帐号删掉了");
}

const bad = notes.filter((n) => !n.ok).length;
console.log(`\n判：${notes.length - bad} 过 ${bad} 没过 → ${OUT}`);
process.exit(bad ? 1 : 0);
