/**
 * 用讲的做事 —— 在**他的系统**那一页上，不是在改设计那一屏上。
 *
 * ── 他 2026-09-09 问的那一句 ──────────────────────────────────────────────
 *
 *     `這個ai 助手是我們產品的還是平台的 如果是產品為什麼不是接在產品裡面呢`
 *
 * 那一支 route 一直做得了 11 个真的动作，而那块面板**只被编辑器两个外壳
 * import** —— 所以他每天开的那一页上够不到它。这一支量的就是那件事补好了没有。
 *
 * ── 🔴 为什么非要开浏览器 ────────────────────────────────────────────────
 *
 * 单元测试证得了「那一支会写」，证不了「他找不找得到它」。而这一整件事
 * 就是「找不找得到」—— [任务 314] 五写着：这个产品的招牌承诺是「用讲的改」，
 * 而它在每一页、对每一个老板，都在一颗按钮后面。
 *
 * 四条，每一条都对应一个真的会犯的错：
 *   ① 他的系统那一页上**有**那个入口          （没接上 = 整件事没发生）
 *   ② 讲一句做事的话 → **他帐上真的多一行**    （route 说做了而没做）
 *   ③ 讲完之后 **画面上看得到那一行**          （refetch 没打开 = 说了没做）
 *   ④ 🔴 讲一句改样子的话 → **一个字都不改，而且它讲得出为什么**
 *      （这一条最贵：那一页没有编辑器，一个改版面的操作在那里做不到，
 *        而做不到又回报成功，正是这个仓库每一次「说了没做」的形状）
 *
 * ⚠️ 用一个开完就删的帐号 —— 他的示范帐号不可以拿来写真资料
 *    （[任务 23e] 那次就是这样把示范官网的大标题改掉并且留在那里的）。
 *
 * 要开着 `npm run dev`。
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
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
const OUT = ".screenshots/work-ai";
mkdirSync(OUT, { recursive: true });
const MARK = `WA${Date.now().toString().slice(-6)}`;
const EMAIL = `workai-${Date.now()}@formae.test`;
const PASSWORD = `Workai-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* 🔴 服务器没开就不要跑 —— 一份「入口不见了」的报告跟一份「服务器没开」的
   报告，在画面上长得一模一样。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

let userId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;

/** 讲一句话，等它讲完。回它印出来的那几行。 */
async function say(page, sentence) {
  const open = page.locator('[data-work-ai="closed"]');
  if (await open.count()) await open.first().click();
  const box = page.locator('[data-work-ai="open"] textarea').first();
  await box.waitFor({ timeout: 30000 });
  await box.fill(sentence);
  /* ⚠️ 照它的字找那颗按钮 —— shoot:ai 学过这一条：那颗按钮故意不在一个
     form 里，所以 `button[type="submit"]` 配不上它。 */
  await page
    .locator('[data-work-ai="open"]')
    .getByRole("button", { name: /change it/i })
    .first()
    .click({ timeout: 30000 });
  /* 🔴 等它**讲出话来**，不是等一个固定的秒数。
     而且等的是 `[data-work-ai-said]` 出现 —— 那一格只有回来之后才存在。 */
  await page
    .locator("[data-work-ai-said]")
    .first()
    .waitFor({ timeout: 180000 })
    .catch(() => {});
  return (
    await page
      .locator("[data-work-ai-said]")
      .first()
      .innerText()
      .catch(() => "")
  ).trim();
}

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
  const { opened } = await openAllPages(api, { quiet: true });
  await seedEveryShape(api, P, MARK, opened, { quiet: true, rows: 3 });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  console.log("\n── ① 他每天打开的那一页上，够不够得到它 ──────────────────");
  await page.goto(`${BASE}/en/portal/quotations`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const there = await page.locator("[data-work-ai]").count();
  check("🔴 他的系统那一页上有那个入口", there > 0, `找到 ${there} 个`);

  /* 🔴 而「有」不等於「看得到」。第一版挂在页尾，这一条数到 1 而
     1440 的实拍里一个像素都看不到 —— 报价单那一页比一屏长。
     [重点 7l]：眼睛看到而尺子量不到的，当场补成尺子的一项。 */
  const vh = page.viewportSize()?.height ?? 0;
  const seat = await page
    .locator("[data-work-ai]")
    .first()
    .boundingBox()
    .catch(() => null);
  await page.screenshot({ path: `${OUT}/1-closed.png` });
  check(
    "🔴 而且不用滚就看得到",
    !!seat && seat.y >= 0 && seat.y < vh,
    seat ? `它的上缘在 ${Math.round(seat.y)}px，而一屏只有 ${vh}px` : "量不到",
  );
  /* 而改设计那一屏本来就有它自己那一块 —— 这一支不碰那一边。 */

  console.log("\n── ② 讲一句做事的话，帐上要真的多一行 ────────────────────");
  const before = await admin
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .eq("module_key", "quotations");
  const said = await say(
    page,
    "Add a quotation for Tan Sri Renovation, RM 4,800, rewiring the shoplot",
  );
  console.log(`        它讲了：${said.replace(/\n/g, " / ").slice(0, 160)}`);
  await page.waitForTimeout(2500);
  const after = await admin
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .eq("module_key", "quotations");
  check(
    "🔴 他帐上真的多了一行",
    (after.count ?? 0) === (before.count ?? 0) + 1,
    `${before.count} → ${after.count}`,
  );

  console.log("\n── ③ 讲完之后，画面上看不看得到那一行 ────────────────────");
  await page.screenshot({ path: `${OUT}/2-said.png` });
  const shown = await page.locator("body").innerText();
  check(
    "🔴 那一行当场出现在他眼前",
    /tan sri/i.test(shown),
    "画面上找不到刚才那一笔（refetch 没打开 = 说了没做）",
  );

  console.log("\n── ④ 🔴 讲一句改样子的话，一个字都不准动 ────────────────");
  const design = await say(page, "Make the heading shorter and move the table to the top");
  console.log(`        它讲了：${design.replace(/\n/g, " / ").slice(0, 200)}`);
  const stillThere = await admin
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .eq("module_key", "quotations");
  await page.screenshot({ path: `${OUT}/3-design-refused.png` });
  check(
    "改样子的那一句没有顺手写进任何东西",
    (stillThere.count ?? 0) === (after.count ?? 0),
    `${after.count} → ${stillThere.count}`,
  );
  check(
    "🔴 而且它讲得出该去哪里做，不是假装做了",
    /design|设计/i.test(design),
    design.slice(0, 200) || "（它一句话都没讲）",
  );
  /* 🔴 而这一条是 2026-09-09 用眼睛看出来、当场变成的一项（重点 24）：
     他用英文问、这套系统的语言是英文，而它回了一整句中文 ——
     「标题和表格顺序要在这页顶部的设计按钮里改」。
     根因是 route 那段新话里混着 风格 / 配色 / 排法 三个中文词，
     而 prompt 自己那一条是「用他讲话的那种语言回」。
     [重点 13]：不准跨语言凑合。 */
  check(
    "🔴 他用英文问，它就要用英文回",
    !/[一-鿿]/.test(design),
    design.slice(0, 200),
  );

  console.log("");
  console.log("── ⑤ 🔴 它看不看得到系统自己发现的那几件 ──────────");
  /*
    🔴 十二种信号 2026-09-06 就算得出来（`nudges_due`），「今天要跟的」
    那一页在读它们，而 `live-answers.ts` 里一个字都没提过 —— 所以他问
    「今天有什么要跟」，助手答「我看不到」，而画面上就写着。
    [任务 316] 读到外面那几家把这一件当留客主力：QuickBooks 的付款代理
    **先开口**。这一段量的就是那条线接上了没有。

    ⚠️ 种一张**两天后到期**的报价单 —— `quote_expiring` 的条件是
    `due_on <= cutoff`（今天＋三天）而且一分钱都还没收。
  */
  const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const { error: seedErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "quotations",
    in_title: "Kedai Kopi awning",
    in_party: "Madam Chong",
    in_amount_cents: 690000,
    in_due_on: soon,
  });
  if (seedErr) throw new Error(`seed quote: ${seedErr.message}`);

  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  /* 🔴 这一句故意用**中文**问 —— 上面三段已经盯住英文那一半，
     而那条规矩是两边的：他用哪一种话问，就用哪一种话回。
     只钉一边的尺子，会在另一边静静地让它变回去。 */
  const chase = await say(page, "今天有什么要跟？");
  console.log(`        它讲了：${chase.split(String.fromCharCode(10)).join(" / ").slice(0, 220)}`);
  check(
    "🔴 助手念得出那一张快到期的报价",
    /chong/i.test(chase),
    chase.slice(0, 220) || "（它一句话都没讲）",
  );
  check(
    "🔴 他用中文问，它就要用中文回",
    /[一-鿿]/.test(chase),
    chase.slice(0, 220),
  );
  await page.screenshot({ path: `${OUT}/4-chase.png` });

} catch (e) {
  failed.push(`threw: ${e.message}`);
  console.error(e);
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
  console.log(
    failed.length
      ? `\n🔴 ${failed.length} 条红:\n${failed.map((f) => `  · ${f}`).join("\n")}\n`
      : "\n全部绿。\n",
  );
  process.exit(failed.length ? 1 : 0);
}
