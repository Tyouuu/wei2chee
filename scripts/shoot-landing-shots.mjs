/* 官网上那三张产品图 —— 真的画面，不是示意图。
 *
 * 老板 2026-08-31:「我要有点动效 就是比较现代一点的」。
 * 量出来我们官网**整页只有一张产品图**（Trafft 每一张功能卡都有一张真介面）。
 * 而「先看到你自己的系统」正是我们唯一的卖点 —— 一张图撑不起它。
 *
 * ⚠️ 拍的是**登入之后真的那三个画面**，不是设计稿：
 *   1 总览（你的系统）· 2 编辑器（用讲的改）· 3 官网（客人看到的）
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { demoProject } from "./lib/demo-project.mjs";
import fs from "node:fs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const demo = await demoProject(db);
const PROJECT = demo.id;
const proj = demo;
const acct = { email: demo.email };
if (!acct?.email) throw new Error("demo project has no account");

const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email: acct.email });
if (error) throw new Error(`generateLink failed: ${error.message}`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/portal`,
  { waitUntil: "networkidle", timeout: 60000 });
if (!/\/portal/.test(p.url())) throw new Error(`login did not land in the portal: ${p.url()}`);

fs.mkdirSync("public/shots", { recursive: true });
const shots = [
  ["home", "/en/portal"],                     // 你的系统：有哪几页
  ["system", "/en/portal/dashboard"],         // 总览＋编辑器：用讲的改
  ["website", `/s/${proj.site_slug}`],    // 客人看到的官网
];
for (const [name, path] of shots) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(2200);
  /* ⚠️ 拍之前先确认这一页真的在。
     第一版把 `/en/portal/overview/edit` 拍成一张 404，**然后印出档名说成功** ——
     一个只会存档不会看画面的脚本，跟没有脚本一样。 */
  const dead = await p.evaluate(() => /does not exist|404/i.test(document.body.innerText.slice(0, 400)));
  if (dead) throw new Error(`${path} 是一张 404 —— 没有拍`);
  /* 引导气泡关掉 —— 它是给第一次进来的老板看的，不是给官网访客看的。 */
  for (const label of ["Got it, hide this", "知道了"]) {
    const btn = p.getByText(label, { exact: false }).first();
    if (await btn.count().catch(() => 0)) { await btn.click({ timeout: 1500 }).catch(() => {}); break; }
  }
  /* ⚠️ Next 的 dev 徽章（「2 Issues」那颗红点）**绝不能出现在官网上**。
     它只存在于 next dev，客户永远看不到 —— 但它会印在我们的行销图上。
     （check:reachable 也被它骗过一次，见那支脚本。） */
  await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}" });
  await p.waitForTimeout(500);
  /* 只拍第一屏 —— 官网上那一格是一个视窗，不是一整页。 */
  await p.screenshot({ path: `public/shots/${name}.jpg`, type: "jpeg", quality: 78 });
  console.log(`public/shots/${name}.jpg   ← ${path}`);
}
/* 第四张：问卷 —— 「回答几个问题」那一步讲的就是它，而它要点过才看得到。
   ⚠️ 不能拿 portal 首页顶替：那是**答完之后**的画面，用它讲「回答问题」
   等於用结果的图去讲过程。 */
{
  const q = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await q.goto(`${BASE}/en`, { waitUntil: "networkidle", timeout: 60000 });
  /* cookie 提示关掉 —— 它是给第一次来的访客看的，不该印在行销图上。
     （而且它在 390px 会盖住「下一题」，见 waiting-screen 那一轮。） */
  const ok = q.getByRole("button", { name: /got it|知道了/i }).first();
  if (await ok.count().catch(() => 0)) await ok.click({ timeout: 2000 }).catch(() => {});
  await q.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
  const card = q.locator("[aria-pressed]").first();
  if (await card.count()) { await card.click({ timeout: 4000 }).catch(() => {}); await q.waitForTimeout(2200); }
  const asked = await q.evaluate(() => /\?/.test(document.body.innerText));
  if (!asked) console.log("  ⚠️ 问卷没打开 —— 那一张没拍（宁可少一张，不要一张假的）");
  else {
    await q.screenshot({ path: "public/shots/ask.jpg", type: "jpeg", quality: 78 });
    console.log("public/shots/ask.jpg   ← /en 点了行业之后");
  }
  await q.close();
}
await b.close();
