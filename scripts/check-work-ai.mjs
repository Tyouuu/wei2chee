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
 *   ④ 🔴 「照样再来一张」→ **它记得上一句**（不记得 = 比编辑器那边笨）
 *   ⑤ 🔴 讲一句改样子的话 → **一个字都不改，而且它讲得出为什么**
 *   ⑥ 🔴 问「今天有什么要跟」→ **它念得出系统自己发现的那几件**
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

  /* 🔴 ①b 三个宽度上都够得到 —— 而这一条在 2026-09-09 之前会红两次。
     那一块本来写着 `max-lg:hidden`，理由是「下缘已经有一条分页列，
     两条叠在同一条边上吃掉的永远是最后那一行」。**那句话是对的**，
     而它的结论下错了：不该贴第二条，不等於窄屏上不要入口。
     於是这个产品的招牌承诺在 iPad 跟手机上一个字都没有 ——
     而他 2026-09-09 讲的正是 `桌面手機跟ipad端 這三個都是要調整好的`。
     现在窄屏是一颗离下缘 72px 的圆钮，避得开那条 64px 的分页列。 */
  console.log("");
  console.log("── ①b 🔴 平板跟手机上也够得到 ────────────────────────────");
  for (const [w, h, name] of [[820, 1180, "iPad 820"], [390, 844, "手机 390"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/en/portal/quotations`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForTimeout(1200);
    const seen = page.locator(`[data-work-ai="closed"]:visible, [data-work-ai="closed-narrow"]:visible`);
    const n = await seen.count();
    const box = n ? await seen.first().boundingBox().catch(() => null) : null;
    await page.screenshot({ path: `${OUT}/8-${w}.png` });
    check(
      `🔴 ${name} 上看得到那个入口，而且不用滚`,
      !!box && box.y >= 0 && box.y + box.height <= h + 1,
      box
        ? `它在 ${Math.round(box.y)}–${Math.round(box.y + box.height)}px，而一屏 ${h}px`
        : `找到 ${n} 个`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 950 });

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

  console.log("");
  console.log("── ④ 🔴 它记不记得上一句话 ────────────────────");
  /*
    🔴 「照样再来一张」—— **这一句只有记得上一轮才做得到。**

    接进产品那一边的第一版一个字都没送，而编辑器那一块从写出来那天就送
    最近三轮。同一支 route、同一个模型，在他每天开的那一页上**比在改设计
    那一屏上笨** —— 能力有、线没接，第十八次。

    ⚠️ 这一句里**故意不讲金额也不讲干什么** —— 一句自己就完整的话
    （「再开一张 3,100 给合发」）没有记忆也做得成，那量的就不是记忆。
  */
  const seq = await say(page, "Same again for Hup Seng Trading");
  console.log(`        它讲了：${seq.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);
  const chained = await admin
    .from("pipeline_records")
    .select("id, party", { count: "exact" })
    .eq("project_id", P)
    .eq("module_key", "quotations")
    .ilike("party", "%hup seng%");
  check(
    "🔴 「照样再来一张」开出来了",
    (chained.count ?? 0) >= 1,
    seq.slice(0, 200) || "（它一句话都没讲）",
  );
  await page.screenshot({ path: `${OUT}/5-chained.png` });


  console.log("\n── ⑤ 🔴 讲一句改样子的话，一个字都不准动 ────────────────");
  const design = await say(page, "Make the heading shorter and move the table to the top");
  console.log(`        它讲了：${design.replace(/\n/g, " / ").slice(0, 200)}`);
  /* ⚠️ 基准是**④ 之后**的数字，不是 ② 之后的 —— ④ 自己会开一张单。
     第一版拿 ② 的数字比，红的是一条假的（重点 31：红的时候先问是不是我量错了）。 */
  const beforeDesign = await admin
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .eq("module_key", "quotations");
  await page.screenshot({ path: `${OUT}/3-design-refused.png` });
  const afterDesign = await admin
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .eq("module_key", "quotations");
  check(
    "改样子的那一句没有顺手写进任何东西",
    (afterDesign.count ?? 0) === (beforeDesign.count ?? 0),
    `${beforeDesign.count} → ${afterDesign.count}`,
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
  console.log("── ⑥ 🔴 它看不看得到系统自己发现的那几件 ──────────");
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

  console.log("");
  console.log("── ⑥b 🔴 一打开就讲今天这几件 —— 他一个字都不用打 ──");
  /*
    🔴 上面第 ⑥ 段量的是「**问得到**」。这一段量的是「**它自己开口**」——
    而那两件差得很远：一个要他先想到该问什么。

    [任务 321] 的收尾自己写着「它还不会自己开口 —— 现在是他问才答」，
    [任务 338] 又记了一次。外面那几家（Xero JAX · QuickBooks 的付款代理）
    的差别就在这里：**它们先讲话**。

    ⚠️ 所以这一段**一个字都不打**：重新载入、把面板打开、看那几句在不在。
    量的是那一张快到期的报价（第 ⑥ 段种的 Madam Chong）有没有自己冒出来。
  */
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  const openIt6b = page.locator('[data-work-ai="closed"]');
  if (await openIt6b.count()) await openIt6b.first().click();
  const todayBlock = page.locator("[data-work-ai-today]").first();
  await todayBlock.waitFor({ timeout: 30000 }).catch(() => {});
  const todaySaid = await todayBlock.innerText().catch(() => "");
  console.log(`        它自己讲了：${todaySaid.split(String.fromCharCode(10)).join(" / ").slice(0, 220)}`);
  check(
    "🔴 他一个字都没打，它自己就讲了今天要跟的",
    /chong/i.test(todaySaid),
    todaySaid.slice(0, 220) || "找不到 [data-work-ai-today]",
  );
  /* 🔴 那一句要跟「今天要跟的」那一页**同一份字**（资料库写的 body）——
     在面板里重拼一句，就是同一件事两个讲法，而他会以为那是两件事。 */
  check(
    "🔴 而且念的是那一张单自己的名字，不是一句笼统的提醒",
    /awning|kedai kopi/i.test(todaySaid),
    todaySaid.slice(0, 220),
  );
  await page.screenshot({ path: `${OUT}/4b-today.png` });

  console.log("");
  console.log("── ⑦ 🔴 开单的时候用不用他自己的价钱 ──────────");
  /*
    🔴 [重点 29] 那张表：① 算出来 ② **从他自己以前的东西挑**
    ③ 从别的地方搬 ④ 才轮到他打字。

    `catalog_items.price_cents` 从 20260901070000 建表那天就在，货品那一页
    一直在画它 —— 而助手看不到（`describeLayout` 只印他现在开着那一页，
    而他开报价单那一页的时候货品在另一页）。

    ⚠️ 那个价钱是一个**不好猜的数字**（RM 387.50）—— 一个拿到 380
    或者 400 的回答就是它自己估的，不是读他的。
  */
  const { error: itemErr } = await api.rpc("add_catalog_item", {
    in_project_id: P,
    in_module_key: "inventory",
    in_name: "Ceiling fan install",
    in_unit: "job",
    in_price_cents: 38750,
  });
  if (itemErr) throw new Error(`seed item: ${itemErr.message}`);

  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  const priced = await say(page, "Quote Kedai Aman for one Ceiling fan install");
  console.log(`        它讲了：${priced.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);
  const quoted = await admin
    .from("pipeline_records")
    .select("amount_cents, party")
    .eq("project_id", P)
    .eq("module_key", "quotations")
    .ilike("party", "%kedai aman%");
  const cents = (quoted.data ?? [])[0]?.amount_cents ?? null;
  check(
    "🔴 那一张开出来了",
    (quoted.data ?? []).length >= 1,
    priced.slice(0, 200),
  );
  check(
    "🔴 而且金额是**他自己打的那个**（RM 387.50）",
    Number(cents) === 38750,
    `资料库里是 ${cents} 分 —— 不是 38750，就是它自己估的`,
  );
  await page.screenshot({ path: `${OUT}/6-his-price.png` });


  console.log("");
  console.log("── ⑧ 🔴 一张单摆不摆得下好几行 ────────────");
  /*
    🔴 助手以前只开得出一个**总额**，而写明细那一支
    （`append_record_line`，20260908040000）人按的表单早就在用。

    ⚠️ 这一段量的不只是「多了一行」，是**那张单的总额有没有跟着变**：
    3 × RM 387.50 = **RM 1,162.50**，而那个乘法是**资料库做的**。
    它自己算一次再传进去，就是同一个数字两个答案。
  */
  /* 🔴 **故意不重新载入** —— 上一段刚才用讲的开出一张单，
     这一段就接着在那一张上加明细。量的就是「建完当场接着讲」那条路：
     `router.refresh()` 之后面板手上那棵树要真的带着新那一行，
     不然助手会说「那张单不在这一页上」—— 而他看到它就在表里。
     ⚠️ 第一版这里有一次重新载入，拆了之后照样绿 —— 那一次红的真正原因
     是我在提示里举的例子用了跟这一段同一句话，把模型教去用错的动词。 */
  const line = await say(page, "On the Kedai Aman quote add a line: 3 Ceiling fan install");
  console.log(`        它讲了：${line.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);
  const withLines = await admin
    .from("pipeline_records")
    .select("id, amount_cents")
    .eq("project_id", P)
    .eq("module_key", "quotations")
    .ilike("party", "%kedai aman%")
    .limit(1);
  const recId = (withLines.data ?? [])[0]?.id ?? null;
  const lines = recId
    ? await admin
        .from("record_lines")
        .select("description, qty, unit_price_cents, amount_cents")
        .eq("record_id", recId)
    : { data: [] };
  const got = (lines.data ?? [])[0] ?? null;
  check(
    "🔴 那一行写进去了",
    !!got,
    line.slice(0, 200) || "（它一句话都没讲）",
  );
  check(
    "🔴 数量是 3，单价是他自己那个",
    Number(got?.qty) === 3 && Number(got?.unit_price_cents) === 38750,
    `qty=${got?.qty} 单价=${got?.unit_price_cents}`,
  );
  check(
    "🔴 而那张单的总额是**资料库乘出来**的 RM 1,162.50",
    Number((withLines.data ?? [])[0]?.amount_cents) === 116250,
    `总额是 ${(withLines.data ?? [])[0]?.amount_cents} 分`,
  );
  await page.screenshot({ path: `${OUT}/7-lines.png` });




  console.log("");
  console.log("── ⑨ 🔴 官网上进来的那一句，他回得了吗 ──────");
  /*
    🔴 量出来的：`site_enquiries` **只进不出** —— 一个陌生人在他
    官网上问了一句，而他在这套系统里**回不了**：那一页唯一的动作
    是「变成一张报价单」。而[重点 9c] 那张表里最深的两层，就是
    「钱跟客人从那里进来」。

    🔴 而这一段最贵的一条是最后那一条：**它不能送出去**。
    [重点 32] 老板自己讲过，一个刚认识的人最怕的就是机器人对他的
    客人讲话。一支今天不送、明天「顺手」送了的，是这个产品赔不起的那一种错。
  */
  const { error: enqErr } = await admin.from("site_enquiries").insert({
    project_id: P,
    name: "Encik Rahman",
    contact: "012-345 6789",
    answers: { "What do you need": "Bathroom waterproofing, 2 bathrooms" },
  });
  if (enqErr) throw new Error(`seed enquiry: ${enqErr.message}`);

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  const replied = await say(page, "Reply to Encik Rahman about the waterproofing");
  console.log(`        它讲了：${replied.split(String.fromCharCode(10)).join(" / ").slice(0, 260)}`);
  check(
    "🔴 回了一条字已经填好的连结",
    /wa\.me\/60123456789/.test(replied) && /text=/.test(replied),
    replied.slice(0, 260) || "（它一句话都没讲）",
  );
  const stillOpen = await admin
    .from("site_enquiries")
    .select("status")
    .eq("project_id", P)
    .eq("name", "Encik Rahman")
    .limit(1);
  check(
    "🔴 而那一封**没有被标成处理完** — 他还没按送出",
    ((stillOpen.data ?? [])[0]?.status ?? "new") !== "done",
    `status = ${(stillOpen.data ?? [])[0]?.status}`,
  );
  await page.screenshot({ path: `${OUT}/8-reply.png` });


  console.log("");
  console.log("── ⑩ 🔴 拍一张给它看 —— 在产品那一页上 ──────────");
  /*
    🔴 老板自己点名的用法：`拍照給妳分析啊 上傳invoice啊`。
    而 2026-09-09 量出来那颗回形针**只在「改设计」那一屏上** —— 一个要把
    供应商发票拍进去的五金店老板，得先按进一个改版面的地方。
    他同一天讲：`我只要注重在我的产品罢了`。

    ⚠️ 图上印一个**编出来的字**：模型讲得出它，就只有一种可能 ——
    它真的看到了那张图。`attachedImage` 静静回 null 的时候，助手会
    **照样回答**，只是当作他没有附图，画面上跟成功一模一样。
  */
  const WORD = "SELAYANG";
  const paper = await sharp({
    create: { width: 900, height: 500, channels: 3, background: "#ffffff" },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="900" height="500"><text x="450" y="280" font-family="monospace" font-size="96" font-weight="bold" text-anchor="middle" fill="#111111">${WORD}</text></svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  const openIt = page.locator('[data-work-ai="closed"]');
  if (await openIt.count()) await openIt.first().click();
  const clip = page.locator("[data-work-ai-shot]");
  check(
    "🔴 产品那一页上有那颗回形针",
    (await clip.count()) > 0,
    "找不到 [data-work-ai-shot]",
  );
  await page
    .locator('[data-work-ai="open"] input[type="file"]')
    .first()
    .setInputFiles({ name: "invoice.jpg", mimeType: "image/jpeg", buffer: paper });
  await page.waitForTimeout(2500);
  const seen = await say(page, "What word is printed on that picture?");
  console.log(`        它讲了：${seen.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  check(
    `🔴 模型真的看到了那张图（${WORD}）`,
    seen.toUpperCase().includes(WORD),
    seen.slice(0, 200) || "（它一句话都没讲）",
  );
  await page.screenshot({ path: `${OUT}/9-shot.png` });


  console.log("");
  console.log("── ⑪ 🔴 用讲的，不用打的 ──────────────────────────");
  /*
    🔴 数字：Gartner 说 2026 年 75% 的外勤公司会用语音；ServiceTitan 的
    行业报告说 12% 已经在用、34% 在试。而这个仓库量出来是**零个语音输入**。
    一个戴着手套、手上带油的师傅打不了字（[重点 19]：运营期那一个）。

    ⚠️ 这一段**真的合成一句话出来**（TTS），再拿他自己的登入去打那一支 ——
    不然量的是「我们的程式会不会呼叫」，不是「他讲的话变不变得成字」。

    ⚠️ 那颗麦克风按钮在浏览器里按不动（headless 没有麦克风），所以这里
    分两半量：**按钮在不在**（画面），跟**那一支听不听得懂**（真的声音）。
  */
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  const openMic = page.locator('[data-work-ai="closed"]');
  if (await openMic.count()) await openMic.first().click();
  check(
    "🔴 产品那一页上有那颗麦克风",
    (await page.locator("[data-work-ai-mic]").count()) > 0,
    "找不到 [data-work-ai-mic]",
  );

  /* 他真的会讲的那一句 —— 一个客户名、一个金额、一件工。 */
  const SPOKEN = "Add a quotation for Kedai Selera, two thousand four hundred ringgit, kitchen exhaust cleaning";
  const tts = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "tts-1", voice: "alloy", input: SPOKEN }),
  });
  check("合成得出一段声音（这一步是尺子自己的）", tts.ok, `${tts.status}`);
  const spoken = Buffer.from(await tts.arrayBuffer());

  const heard = await page.request.post(`${BASE}/api/portal/hear`, {
    timeout: 180000,
    multipart: {
      clip: { name: "note.mp3", mimeType: "audio/mpeg", buffer: spoken },
    },
  });
  const heardBody = await heard.json().catch(() => ({}));
  console.log(`        它听成：${String(heardBody.text ?? heardBody.reason ?? "").slice(0, 160)}`);
  check("🔴 那一支认得他的登入", heard.status() === 200, `${heard.status()}`);
  const words = String(heardBody.text ?? "").toLowerCase();
  check(
    "🔴 他讲的那个客户跟那件工，字里都在",
    /selera/.test(words) && /exhaust/.test(words),
    words.slice(0, 160) || "（一个字都没回来）",
  );
  /* 🔴 而这一条是这一段真正在守的：**它转成字，它不写任何东西**。
     一句「三千」被听成「一万三」而直接进他的帐，是他月底才发现的错。 */
  const afterHear = await admin
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .ilike("party", "%selera%");
  check(
    "🔴 而它一个字都没有写进他的帐 —— 转成字而已",
    (afterHear.count ?? 0) === 0,
    `帐上出现了 ${afterHear.count} 笔 Selera`,
  );

  console.log("");
  console.log("── ⑫ 🔴 关掉分页也还记得 ──────────────────────────");
  /*
    🔴 这一段守的不是「它记不记得刚才那三轮」（⑦ 已经在守了），
    是**它记不记得昨天**。

    量出来的：那三轮活在一个分页里。他纠正它一次、讲一次他的规矩，
    关掉分页两句都不在了 —— 而一个每天忘记你纠正过什么的助手，
    是[重点 9c] 那张表里最浅的一层：换一家一样好用的就没了。

    ⚠️ **中间要真的 reload**。同一个分页里接着问，量到的是上面那三轮，
    而那正是这一段要跟它分开的东西 —— 一条量错对象的断言，
    跟一条什么都没守的断言长得一模一样（[任务 322] 付过这个学费）。
  */
  const RULE = "Hup Seng always pays on thirty days";
  const toldIt = await say(page, `Remember this: ${RULE}`);
  console.log(`        它讲了：${toldIt.split(String.fromCharCode(10)).join(" / ").slice(0, 160)}`);
  await page.waitForTimeout(2000);

  const { data: kept } = await admin
    .from("assistant_facts")
    .select("body, landed, page_key")
    .eq("project_id", P);
  check(
    "🔴 那一句真的落在表上了",
    (kept ?? []).some((r) => /thirty days/i.test(String(r.body ?? ""))),
    JSON.stringify(kept),
  );
  check(
    "而且它讲出来它记住了",
    /remember|noted|kept/i.test(toldIt),
    toldIt.slice(0, 160) || "（它一个字都没讲）",
  );

  /* 🔴 换一个分页 —— **另一个 context，另一次登入**，没有任何一轮历史。
     ⚠️ 借上面那个分页的登入状态（`storageState`）而不是重新打一次密码：
     重打一次登入量的是登入，这一条要量的是记性。 */
  const fresh = await browser.newContext({
    storageState: await page.context().storageState(),
    viewport: { width: 1440, height: 950 },
  });
  const page2 = await fresh.newPage();
  await page2.goto(`${BASE}/en/portal/quotations`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  await page2.waitForTimeout(1500);
  const recalled = await say(page2, "What are Hup Seng's payment terms?");
  console.log(`        新分页里它讲了：${recalled.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  check(
    "🔴 新开的分页里，它照样答得出那一句",
    /thirty|30/i.test(recalled),
    recalled.slice(0, 200) || "（它一个字都没讲）",
  );
  await page2.screenshot({ path: `${OUT}/12-remembered.png` });
  await fresh.close();


  console.log("");
  console.log("── ⑬ 🔴 一句话开全班的学费 ──────────────────────");
  /*
    🔴 `bill_class` 从 20260909270000 那一批就在跑，尺子也绿 ——
    而助手**一个都不会用**，因为它看不到他有哪几个班（班在工具页上）。
    [重点 23]：能力有、线没接。这一段量的就是那条线接上了没有。

    ⚠️ 种**三个学生，其中一个不用交钱**（他自己的价钱是 0）——
    一个只会数「开了几张」的尺，量不到那一支最值钱的那一条：
    **少掉的那一张要讲得出来**。
  */
  const { data: grp, error: grpErr } = await api.rpc("add_class_group", {
    in_project_id: P,
    in_module_key: "bookings",
    in_name: "Form 5 Maths",
  });
  if (grpErr) throw new Error(`seed class: ${grpErr.message}`);
  const kids = [];
  for (const name of ["Tan Wei Ming", "Nurul Aina", "Raj Kumar"]) {
    const { data: who } = await api.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "customers",
      in_name: name,
    });
    if (who?.id) {
      kids.push(who.id);
      await api.rpc("enrol_in_class", { in_group_id: grp.id, in_party_id: who.id });
    }
  }
  /* 🔴 第三个不用交 —— 他自己的价钱是 0，不是「没有设」。 */
  if (kids[2]) {
    await api.rpc("set_class_fee", {
      in_group_id: grp.id,
      in_party_id: kids[2],
      in_amount_cents: 0,
    });
  }

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  const billed = await say(page, "Bill the Form 5 Maths class RM 180 each for this month");
  console.log(`        它讲了：${billed.split(String.fromCharCode(10)).join(" / ").slice(0, 220)}`);
  await page.waitForTimeout(2500);
  const madeRows = await admin
    .from("pipeline_records")
    .select("id, amount_cents, party", { count: "exact" })
    .eq("project_id", P)
    .eq("module_key", "quotations")
    .in("party", ["Tan Wei Ming", "Nurul Aina", "Raj Kumar"]);
  check(
    "🔴 一句话开出两张（第三个不用交）",
    (madeRows.count ?? 0) === 2,
    `开出 ${madeRows.count} 张 — ${billed.slice(0, 160)}`,
  );
  check(
    "每一张都是 RM 180",
    (madeRows.data ?? []).every((x) => Number(x.amount_cents) === 18000),
    JSON.stringify((madeRows.data ?? []).map((x) => x.amount_cents)),
  );
  /* 🔴 这一条最值钱：**少掉的那一张要讲得出来**。
     一间十个学生的补习中心开出八张，第九第十去了哪里 ——
     不讲就是静静少了两笔钱。 */
  check(
    "🔴 而它讲得出「一个不用交」",
    /1 pay nothing|1 \u4e2a\u4e0d\u7528\u4ea4/.test(billed),
    billed.slice(0, 220),
  );
  /* 按第二次不会再开一次 —— 那一支自己按月份挡着。 */
  const again = await say(page, "Bill the Form 5 Maths class RM 180 each for this month");
  await page.waitForTimeout(2500);
  const after2 = await admin
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .eq("module_key", "quotations")
    .in("party", ["Tan Wei Ming", "Nurul Aina", "Raj Kumar"]);
  check(
    "🔴 同一个月讲第二次，不会开第二批",
    (after2.count ?? 0) === 2,
    `变成 ${after2.count} 张 — ${again.slice(0, 160)}`,
  );
  await page.screenshot({ path: `${OUT}/10-class.png` });


  console.log("");
  console.log("── ⑭ 🔴 「订金收了一千」要真的进帐 ──────────────");
  /*
    🔴 这一段是 `npm run walk:talk` 走出来的（2026-09-09）。
    十二句里十一句接住，掉的那一句正好是钱：

        他讲   「Took RM 1,000 deposit from Kedai Aman」
        它答   「Marked the Kedai Aman quotation as Build」
        帐上   **一分都没有**

    它去改了那张单的阶段，因为它手上只有 `set_record_status`。
    两次跑、两种讲法、同一个结果 —— 而他以为一千块进帐了。

    ⚠️ 这一段量三件，而第三件是他收完订金的下一个念头：
    钱进了没有 · 挂在那一张单上没有 · **还欠多少讲出来没有**。
  */
  /* 🔴 种一张**金额我自己定的**单（RM 2,500）。收一千之后还欠多少
     是一个算得出来的数字（RM 1,500）—— 而它就是他收完订金的
     下一个念头。拿上面那几段留下来的单，量不到这一件。 */
  const { data: payDoc, error: payDocErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "quotations",
    in_title: "Awning for the back lane",
    in_party: "Restoran Nasi Kandar Deen",
    in_amount_cents: 250000,
  });
  if (payDocErr) throw new Error(`seed payable: ${payDocErr.message}`);
  check("有一张 RM 2,500 的单可以收钱（尺子自己的）", !!payDoc, "开不出来");

  const moneyBefore = await admin
    .from("ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  const paid = await say(page, "Took RM 1,000 deposit from Restoran Nasi Kandar Deen");
  console.log(`        它讲了：${paid.split(String.fromCharCode(10)).join(" / ").slice(0, 220)}`);
  await page.waitForTimeout(2500);
  const moneyAfter = await admin
    .from("ledger_entries")
    .select("id, amount_cents, against_id, direction", { count: "exact" })
    .eq("project_id", P);
  check(
    "🔴 帐上真的多了一笔钱",
    (moneyAfter.count ?? 0) === (moneyBefore.count ?? 0) + 1,
    `${moneyBefore.count} → ${moneyAfter.count} — ${paid.slice(0, 160)}`,
  );
  const entry = (moneyAfter.data ?? []).find(
    (e) => Number(e.amount_cents) === 100000,
  );
  check(
    "🔴 一千块，而且挂在那一张单上",
    !!entry && String(entry.against_id ?? "") === String(payDoc?.id ?? ""),
    entry ? `against=${entry.against_id}` : "找不到那一笔 RM 1,000",
  );
  /* 🔴 他收完订金的下一个念头就是这个数字。 */
  check(
    "🔴 而且它讲的「还欠」是对的（RM 1,500）",
    /1,500/.test(paid),
    paid.slice(0, 220),
  );
  const leftRow = await admin
    .from("pipeline_records")
    .select("amount_cents")
    .eq("id", payDoc.id)
    .maybeSingle();
  const allocRows = await admin
    .from("ledger_allocations")
    .select("amount_cents")
    .eq("record_id", payDoc.id);
  const allocated = (allocRows.data ?? []).reduce((n, a) => n + Number(a.amount_cents ?? 0), 0);
  check(
    "🔴 而资料库那一边也是 1,500",
    Number(leftRow.data?.amount_cents ?? 0) - allocated === 150000,
    `总额 ${leftRow.data?.amount_cents} 分摄 ${allocated}`,
  );
  await page.screenshot({ path: `${OUT}/11-payment.png` });


  console.log("");
  console.log("── ⑮ 🔴 「帮她排明天三点」 ──────────────────────");
  /*
    🔴 一间沙龙每天按最多次的那一件，而助手到 2026-09-10 做不到。
    [任务 268] 2026-09-07 就标红过：一行 `cells` 里没有一格装得下时间，
    所以 `writeRecords` 对 预约 直接拒绝 —— **而那个拒绝是对的**，
    答案是一个具名的动词，不是让那一行变通。

    ⚠️ 这一段量四件，而第三件是这一支真正的价值：
    排进去了 · 时刻对不对（**UTC+8，不是伺服器的 UTC**）·
    **没讲几点结束的时候照她自己上一笔抄** · 抄不到就问一句。
  */
  const bookPage = "bookings";
  /* 她自己上一笔：一个钟半的 Colour touch-up。**这就是待会要被抄的那个长度。** */
  const seedStart = new Date(Date.now() - 7 * 86400000);
  seedStart.setUTCHours(2, 0, 0, 0);
  const { error: seedApptErr } = await api.rpc("add_appointment", {
    in_project_id: P,
    in_module_key: bookPage,
    in_starts_at: seedStart.toISOString(),
    in_ends_at: new Date(seedStart.getTime() + 90 * 60000).toISOString(),
    in_party: "Ms Tan",
    in_service: "Colour touch-up",
  });
  if (seedApptErr) throw new Error(`seed appt: ${seedApptErr.message}`);

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`${BASE}/en/portal/${bookPage}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-work-ai]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const apptBefore = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P);
  const booked = await say(page, "Book Ms Lim tomorrow 3pm for a Colour touch-up");
  console.log(`        它讲了：${booked.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);
  const apptAfter = await admin
    .from("appointments")
    .select("starts_at, ends_at, party, service", { count: "exact" })
    .eq("project_id", P)
    .ilike("party", "%lim%");
  const appt = (apptAfter.data ?? [])[0] ?? null;
  check(
    "🔴 排进去了",
    !!appt,
    booked.slice(0, 200) || "（它一句话都没讲）",
  );
  /* 🔴 三点是**她店里的三点** —— 伺服器跑在 UTC，而马来西亚永远 +8。
     一个照伺服器时区读的实作，会把她的三点排到晚上十一点，
     而画面上那一格看起来完全正常。 */
  const startedHour = appt
    ? new Date(Date.parse(appt.starts_at) + 8 * 3600 * 1000).getUTCHours()
    : -1;
  check(
    "🔴 而且是她店里的三点，不是伺服器的三点",
    startedHour === 15,
    `马来西亚时间 ${startedHour} 点`,
  );
  /* 🔴 她没有讲几点结束 —— 那个长度要从她自己上一笔抄（90 分钟）。 */
  const mins = appt
    ? Math.round((Date.parse(appt.ends_at) - Date.parse(appt.starts_at)) / 60000)
    : 0;
  check(
    "🔴 没讲做到几点，就照她上一次同样的服务（90 分钟）",
    mins === 90,
    `排了 ${mins} 分钟 — 60 就是它自己编的`,
  );
  await page.screenshot({ path: `${OUT}/12-booking.png` });


  console.log("");
  console.log("── ⑯ 🔴 两位师傅，同一个三点 ──────────────────────");
  /*
    🔴 这一段量的不是方便，是**排得对不对**。

    `appointments_no_double_booking` 排他的键是 `coalesce(staff_id, project_id)`
    （20260902030000）—— **没有指师傅的时候，整间店同一个时段只排得下一笔**。
    一间四个发型师的沙龙，第二个三点的客人会被挡掉，而她读到的是
    「那个时间已经有人了」，於是以为自己排满了。

    ⚠️ 2026-09-10 量到：**人按的那张表单也从来没有设过 `staff_id`** ——
    所以今天不管走哪一条路都是这样。这一支是第一条设得了的路。
  */
  const stylists = [];
  for (const name of ["Amy", "Jasmine"]) {
    const { data: who } = await api.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "staff",
      in_name: name,
    });
    if (who?.id) stylists.push([name, who.id]);
  }
  check("\u4e24\u4f4d\u5e08\u5085\u79cd\u8fdb\u53bb\u4e86\uff08\u5c3a\u5b50\u81ea\u5df1\u7684\uff09", stylists.length === 2, `${stylists.length} \u4f4d`);

  await page.goto(`${BASE}/en/portal/${bookPage}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-work-ai]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const one = await say(
    page,
    "Book Ms Wong with Amy tomorrow 4pm to 5pm for a cut",
  );
  console.log(`        \u7b2c\u4e00\u4f4d\uff1a${one.split(String.fromCharCode(10)).join(" / ").slice(0, 150)}`);
  await page.waitForTimeout(2000);
  const two = await say(
    page,
    "Book Ms Foo with Jasmine tomorrow 4pm to 5pm for a cut",
  );
  console.log(`        \u7b2c\u4e8c\u4f4d\uff1a${two.split(String.fromCharCode(10)).join(" / ").slice(0, 150)}`);
  await page.waitForTimeout(2500);

  const both = await admin
    .from("appointments")
    .select("party, staff_id, starts_at", { count: "exact" })
    .eq("project_id", P)
    .in("party", ["Ms Wong", "Ms Foo"]);
  check(
    "🔴 \u540c\u4e00\u4e2a\u56db\u70b9\uff0c\u4e24\u4e2a\u5ba2\u4eba\u90fd\u6392\u5f97\u8fdb\u53bb",
    (both.count ?? 0) === 2,
    `\u53ea\u6392\u8fdb\u53bb ${both.count} \u7b14 \u2014 ${two.slice(0, 140)}`,
  );
  /* 🔴 \u800c\u4e14\u4e24\u7b14\u771f\u7684\u6302\u5728**\u4e0d\u540c\u7684\u4eba**\u8eab\u4e0a \u2014\u2014 \u4e24\u7b14\u90fd\u662f null
     \u4e5f\u4f1a\u649e\uff0c\u6240\u4ee5\u4e0a\u9762\u90a3\u4e00\u6761\u8fc7\u4e86\u5c31\u4ee3\u8868\u5b83\u4eec\u5404\u6709\u4e00\u4e2a\u3002
     \u8fd9\u4e00\u6761\u91cf\u7684\u662f\u201c\u4e0d\u662f\u540c\u4e00\u4e2a\u4eba\u201d\u3002 */
  const ids = new Set((both.data ?? []).map((a) => String(a.staff_id ?? "")));
  check(
    "🔴 \u800c\u4e14\u5404\u81ea\u6302\u5728\u81ea\u5df1\u90a3\u4e00\u4f4d\u8eab\u4e0a",
    ids.size === 2 && !ids.has(""),
    `staff_id: ${[...ids].join(" \u00b7 ")}`,
  );
  await page.screenshot({ path: `${OUT}/13-two-stylists.png` });


  console.log("");
  console.log("── ⑰ 🔴 「陈太太来了」要顺手扣掉一次套票 ────────");
  /*
    🔴 **这一段今天是红的，而那是它存在的理由。**

    根因 2026-09-10 查出来了：`describeLayout` 只认得看板（TaskBoard）
    跟表格（RecordTable），**不认得日程（DaySchedule）** ——
    所以预约那一页上助手看得到那一块，**一笔预约都看不到**：
    开得了新的，动不了任何一笔已经在的。
    跟 2026-09-07 那条注解替看板抓到的**同一个形状**，第三次。
    那一行在另一个 session 手上（layout-ops.ts），已经交代清楚。

    ──────────────────────────────────────────────

    🔴 这一段量的是一件**据说早就做好**的事。

    [任务 225] 让「客人来了」同时扣一次套票，而 `record-ops.ts` 里那一段
    也一直在把它念出来。但量出来：**只有一条把 rpc 假装掉的单元测试**
    （`record-ops.test.ts:592`）—— 也就是说，**没有人用真的帐号看过
    一次套票真的少一次**。

    这个仓库的招牌毛病就是「能力有、线没接」，而它只有走真的那一条才看得见。

    ⚠️ 而且这一段量**两件**，不是一件：
    数字真的少了一次 · **它有没有讲出来**。扣了不讲，就是一次静静少掉的
    套票，而她要到客人下次来才发现。
  */
  const { data: guest } = await api.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "customers",
    in_name: "Ms Chan",
  });
  const { data: pack, error: packErr } = await api.rpc("add_service_package", {
    in_party_id: guest?.id,
    in_name: "Facial x10",
    in_sessions_total: 10,
  });
  if (packErr) throw new Error(`seed package: ${packErr.message}`);

  /* 她今天有一笔预约 —— 「来了」是按在那一笔上的。

     ⚠️ **要是她店里的今天，不是伯器的今天**。第一版拿
     `now + 1h`（UTC）种，而那在马来西亚已经是明天 ——
     预约那一页画的是一天，于是助手说「那一笔不在这一页上」——
     **而它讲得没错。红的是台面，不是产品。** */
  const mytToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const soonStart = new Date(Date.parse(`${mytToday}T20:00:00+08:00`));
  const { error: apptErr } = await api.rpc("add_appointment", {
    in_project_id: P,
    in_module_key: bookPage,
    in_starts_at: soonStart.toISOString(),
    in_ends_at: new Date(soonStart.getTime() + 60 * 60000).toISOString(),
    in_party: "Ms Chan",
    in_party_id: guest?.id,
    in_service: "Facial",
  });
  if (apptErr) throw new Error(`seed appt for package: ${apptErr.message}`);

  await page.goto(`${BASE}/en/portal/${bookPage}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-work-ai]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  /* 🔴 先验那一笔真的在画面上 —— 不然红的是我的台面，
     而一份「产品做不到」的报告跟一份「我种错了地方」的报告
     在画面上长得一模一样。 */
  const onScreen = await page.locator("body").innerText();
  check(
    "她那一笔预约在画面上（尺子自己的）",
    /ms chan/i.test(onScreen),
    "预约那一页上看不到 Ms Chan — 种错日子了",
  );
  /* 🔴 先数一下这一页背后有几笔 —— `describeLayout` 一页只印
     **12 行**（`ROWS_SHOWN`）。超过那个数字，助手就指不到第十三笔，
     而一间忙的沙龙一下午就不止十二个客人。这一行是为了分得出
     「产品的上限」跟「我的台面种错了」。 */
  const howMany = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P);
  console.log(`        这一页背后有 ${howMany.count} 笔预约（助手一次只看得到 12）`);
  const arrived = await say(page, "Ms Chan has arrived");
  console.log(`        它讲了：${arrived.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);

  const uses = await admin
    .from("package_uses")
    .select("id", { count: "exact", head: true })
    .eq("package_id", pack.id);
  check(
    "🔴 套票真的少了一次",
    (uses.count ?? 0) === 1,
    `用掉 ${uses.count} 次 — ${arrived.slice(0, 150)}`,
  );
  /* 🔴 扣了不讲，就是一次静静少掉的套票。 */
  check(
    "🔴 而且它讲出来还剩几次（9）",
    /\b9\b/.test(arrived),
    arrived.slice(0, 200),
  );
  await page.screenshot({ path: `${OUT}/14-package.png` });


  console.log("");
  console.log("── ⑱ 🔴 放飞机 · 取消 —— 而套票不可以跟着掉 ──────");
  /*
    🔴 这两句走的是**跟「客人来了」同一支**（`set_appointment_status`），
    所以第 ⑰ 段一通，它们就通了 —— 而那正是要单独量一次的理由：
    **同一支能做对一件事，不代表它对另外两件也讲实话。**

    ⚠️ 而这一段真正守的是最后一条：**放飞机不可以扣套票**。
    她今天没来，套票要留着；扣了她下次来就少一次，而她要到那一刻才发现。
    「客人来了」扣一次是对的，「她没来」扣一次是一笔看不见的损失。

    ⚠️ **这一条没有办法故意弄红给它看** —— 要弄红得去改资料库
    那一支，而那不在这一边。它的证据是**第 ⑬ 段跟这一段合起来**：
    同一支函式，来了扣一次、没来一次不扣 —— 两条都绿才叫分得清楚。
    一条单独绿的「没有扣」，跟一条什么都没发生的尺长得一模一样。
  */
  const { data: ghost } = await api.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "customers",
    in_name: "Ms Yeoh",
  });
  const { data: pack2, error: pack2Err } = await api.rpc("add_service_package", {
    in_party_id: ghost?.id,
    in_name: "Massage x5",
    in_sessions_total: 5,
  });
  if (pack2Err) throw new Error(`seed package 2: ${pack2Err.message}`);
  const ghostAt = new Date(Date.parse(`${mytToday}T21:00:00+08:00`));
  const { error: ghostErr } = await api.rpc("add_appointment", {
    in_project_id: P,
    in_module_key: bookPage,
    in_starts_at: ghostAt.toISOString(),
    in_ends_at: new Date(ghostAt.getTime() + 60 * 60000).toISOString(),
    in_party: "Ms Yeoh",
    in_party_id: ghost?.id,
    in_service: "Massage",
  });
  if (ghostErr) throw new Error(`seed no-show appt: ${ghostErr.message}`);

  await page.goto(`${BASE}/en/portal/${bookPage}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-work-ai]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const noShow = await say(page, "Ms Yeoh did not turn up");
  console.log(`        它讲了：${noShow.split(String.fromCharCode(10)).join(" / ").slice(0, 180)}`);
  await page.waitForTimeout(2500);

  const ghostRow = await admin
    .from("appointments")
    .select("status")
    .eq("project_id", P)
    .ilike("party", "%yeoh%")
    .limit(1)
    .maybeSingle();
  check(
    "🔴 那一笔真的标成没来了",
    String(ghostRow.data?.status ?? "") === "no_show",
    `status = ${ghostRow.data?.status} — ${noShow.slice(0, 140)}`,
  );
  /* 🔴 这一条是这一段存在的理由：她没来，套票要留着。 */
  const ghostUses = await admin
    .from("package_uses")
    .select("id", { count: "exact", head: true })
    .eq("package_id", pack2.id);
  check(
    "🔴 而套票一次都没有扣掉（她没来）",
    (ghostUses.count ?? 0) === 0,
    `扣了 ${ghostUses.count} 次 — 她没来却少一次，是她下次来才发现的损失`,
  );
  await page.screenshot({ path: `${OUT}/15-no-show.png` });


  console.log("");
  console.log("── ⑲ 🔴 「叫她先付八十」 —— 而「不用订金」不是 0 ──");
  /*
    🔴 一间沙龙叫客人先付订金，靠的是柜台讲一句话，不是一张表单。

    走 `set_appointment_deposit`（20260909320000）—— 人按那颗按钮的同一支，
    而它挡的是 `works_here` 不是 `sees_money`：**叫客人先付订金的是柜台**，
    而柜台在一间沙龙里就是那个美发师自己。

    ⚠️ 这一段量**三件**，而第三件才是它存在的理由：
    数字真的写进去了 · **它讲的是「要收」不是「收到了」** ·
    **「这一单不用订金」写回 null，不是 0**。
    那一支自己的注解写着 null 跟 0 是两件事（0 是「讲好了不收」），
    而助手这一条路很容易把两句话写成同一件事 —— 她要到客人
    站在柜台前面才发现。
  */
  /*
    🔴 **今天**，不是明天 —— 预约那一页画的是今天那一天，
    而这一段要它**指得出一笔已经在的预约**。
    第一版种在明天，它回的是「I can’t identify Ms Rajan’s booking」
    —— **而它讲得没错**，红的是尺子不是产品。

    ⚠️ 而时段要自己找一个空的：没有指师傅的时候，
    **排他的那一把键就是整间店**（coalesce(staff_id, project_id)），
    所以一个写死的钟头撞上第 ⑰ ⑱ 段或者种子资料的时候，
    红的也是尺子自己。
  */
  let depAt = null;
  for (const hhmm of ["18:00", "17:00", "13:30", "11:15", "09:45"]) {
    const at = new Date(Date.parse(`${mytToday}T${hhmm}:00+08:00`));
    const { error: e } = await api.rpc("add_appointment", {
      in_project_id: P,
      in_module_key: bookPage,
      in_starts_at: at.toISOString(),
      in_ends_at: new Date(at.getTime() + 45 * 60000).toISOString(),
      in_party: "Ms Rajan",
      in_service: "Rebonding",
    });
    if (!e) { depAt = at; break; }
    if (!/already taken/i.test(e.message)) {
      throw new Error(`seed deposit appt: ${e.message}`);
    }
  }
  if (!depAt) throw new Error("seed deposit appt: 今天五个时段全部被占了");
  /* 🔴 印出来 —— 红的时候要分得出「它指错了」跟「画面根本没印给它」。 */
  const seeded = await admin
    .from("appointments")
    .select("id, starts_at")
    .eq("project_id", P)
    .ilike("party", "%rajan%")
    .limit(1)
    .maybeSingle();
  console.log(
    `        种下去那一笔：${seeded.data?.id} @ ${seeded.data?.starts_at}`,
  );

  await page.goto(`${BASE}/en/portal/${bookPage}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-work-ai]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  /* 🔴 画面上到底有没有印那一笔的编号给它 —— 靠名字认人是禁的
     （[任务 89]），所以它只能从这一页印出来的清单里抄一个下来。
     抄不到，红的是这一页；抄错了，红的才是模型。 */
  const drawn = await page
    .locator("[data-work-ai]")
    .first()
    .evaluate(() => document.body.innerText)
    .catch(() => "");
  console.log(
    `        这一页印了 Ms Rajan 吗：${/rajan/i.test(drawn) ? "有" : "没有"}`,
  );
  const asked = await say(page, "Ask Ms Rajan for a RM 80 deposit");
  console.log(`        它讲了：${asked.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);

  const depRow = await admin
    .from("appointments")
    .select("id, deposit_cents")
    .eq("project_id", P)
    .ilike("party", "%rajan%")
    .limit(1)
    .maybeSingle();
  check(
    "🔴 那一单要收的订金真的是 RM 80",
    Number(depRow.data?.deposit_cents ?? -1) === 8000,
    `deposit_cents = ${depRow.data?.deposit_cents} — ${asked.slice(0, 140)}`,
  );
  /* 🔴 一句听起来像已经收到的话，会让她以为钱进来了。 */
  check(
    "🔴 而它讲的是「要收」，不是「收到了」",
    !/(received|paid|collected)/i.test(asked) && !/收到|已付|已收/.test(asked),
    asked.slice(0, 220),
  );

  /* 🔴 「不用订金」写回 null。写成 0 的话，那是「讲好了不收」—— 另一句话。 */
  const dropped = await say(page, "Ms Rajan does not need to pay a deposit after all");
  console.log(`        它讲了：${dropped.split(String.fromCharCode(10)).join(" / ").slice(0, 180)}`);
  await page.waitForTimeout(2500);
  const depAfter = await admin
    .from("appointments")
    .select("deposit_cents")
    .eq("id", depRow.data?.id)
    .maybeSingle();
  check(
    "🔴 「不用订金」写回的是 null，不是 0",
    depAfter.data?.deposit_cents === null,
    `deposit_cents = ${JSON.stringify(depAfter.data?.deposit_cents)} — 0 是「讲好了不收」，是另一句话`,
  );
  await page.screenshot({ path: `${OUT}/16-deposit.png` });


  console.log("");
  console.log("── ⑳ 🔴 供应商那张单拍进来 —— 纸上那个数字要落进帐 ──");
  /*
    🔴 老板 2026-09-10 拿一张别人的产品图来问：`我们是不是可以做到这样了`
    —— 那一张图里面是一张**手写的小吃店单**被读成单号 · 日期 ·
    供应商 · 九行明细。

    量出来的是**一半**：第 ⑩ 段已经证了模型真的看得见那张图，
    而那一段话里写的是「这张图是参考，**永远不是他生意的事实来源**」
    —— 那句话是写给「改设计」那一边的，而他在**自己的系统**上
    举起来的那张纸就是事实来源。

    ⚠️ 这一段量四件，而第三件才是它存在的理由：
    帐上真的多一笔 · 金额是**纸上那个**不是一个接近的数字 ·
    **它把那个数字念回给他** · 那家店的名字原样拄下来。
    一笔写进去而没有念出来的钱，他没有任何办法跟手上那张纸对一次。
  */
  const BILL_DAY = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const billSvg = [
    `<svg width="1100" height="820" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="1100" height="820" fill="#ffffff"/>`,
    `<text x="60" y="92" font-family="Helvetica,Arial" font-size="40" font-weight="bold" fill="#111">SRI MURNI BEAUTY SUPPLY SDN BHD</text>`,
    `<text x="60" y="140" font-family="Helvetica,Arial" font-size="26" fill="#333">18 Jalan Pasar, 30300 Ipoh, Perak</text>`,
    `<text x="60" y="215" font-family="Helvetica,Arial" font-size="32" font-weight="bold" fill="#111">INVOICE  SMB-4471</text>`,
    `<text x="60" y="260" font-family="Helvetica,Arial" font-size="26" fill="#333">Date: ${BILL_DAY}</text>`,
    `<line x1="60" y1="300" x2="1040" y2="300" stroke="#111" stroke-width="3"/>`,
    `<text x="60" y="360" font-family="Helvetica,Arial" font-size="28" fill="#111">3 x Shampoo 5L</text>`,
    `<text x="860" y="360" font-family="Helvetica,Arial" font-size="28" fill="#111">285.00</text>`,
    `<text x="60" y="420" font-family="Helvetica,Arial" font-size="28" fill="#111">12 x Colour tube</text>`,
    `<text x="860" y="420" font-family="Helvetica,Arial" font-size="28" fill="#111">216.00</text>`,
    `<line x1="60" y1="470" x2="1040" y2="470" stroke="#111" stroke-width="2"/>`,
    `<text x="60" y="540" font-family="Helvetica,Arial" font-size="34" font-weight="bold" fill="#111">TOTAL</text>`,
    `<text x="800" y="540" font-family="Helvetica,Arial" font-size="34" font-weight="bold" fill="#111">RM 501.00</text>`,
    `<text x="60" y="640" font-family="Helvetica,Arial" font-size="24" fill="#555">Terms: 30 days</text>`,
    `</svg>`,
  ].join("");
  const bill = await sharp(Buffer.from(billSvg)).jpeg({ quality: 92 }).toBuffer();

  await page.goto(`${BASE}/en/portal/expenses`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-work-ai]").first().waitFor({ timeout: 120000 }).catch(() => {});
  const openBill = page.locator('[data-work-ai="closed"]');
  if (await openBill.count()) await openBill.first().click();
  await page
    .locator('[data-work-ai="open"] input[type="file"]')
    .first()
    .setInputFiles({ name: "supplier.jpg", mimeType: "image/jpeg", buffer: bill });
  await page.waitForTimeout(2500);
  const paperSaid = await say(page, "Put this supplier bill in");
  console.log(`        它讲了：${paperSaid.split(String.fromCharCode(10)).join(" / ").slice(0, 220)}`);
  await page.waitForTimeout(2500);

  /*
    🔴 他 2026-09-10 讲的：`需要 然后要可以撤销的那种`。

    所以这一段不再是「讲一句就进帐」，它要走完四步：
    读 -> **停下来** -> 他按进去 -> 他拿得回来。
    而第二步是这一段真正存在的理由：**那一刻帐上要是空的**。
    一个既摄了一张「要不要写」的纸、而早就写进去了的核对，
    比没有那一站更糟 —— 他会以为自己拦得住。
  */
  const stillEmpty = await admin
    .from("ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .ilike("party", "%murni%");
  check(
    "🔴 那一刻帐上一笔都没有 —— 它停下来等他看",
    (stillEmpty.count ?? 0) === 0,
    `已经写进去 ${stillEmpty.count} 笔 — 核对那一站没有拦住`,
  );
  const checkCard = page.locator("[data-work-ai-check]").first();
  const cardText = await checkCard.innerText().catch(() => "");
  console.log(`        纸上摄出来的：${cardText.split(String.fromCharCode(10)).join(" / ").slice(0, 220)}`);
  check(
    "🔴 而那张核对的纸真的在他眼前，而且写着 501",
    /501/.test(cardText),
    cardText.slice(0, 220) || "找不到 [data-work-ai-check]",
  );
  await page.screenshot({ path: `${OUT}/17-check.png` });

  console.log("");
  console.log("── ㉑ 🔴 他按下「记进去」 ──────────────────");
  await page.locator("[data-work-ai-confirm]").first().click({ timeout: 30000 });
  await page
    .locator("[data-work-ai-check]")
    .first()
    .waitFor({ state: "detached", timeout: 120000 })
    .catch(() => {});
  await page.waitForTimeout(3000);

  const spent = await admin
    .from("ledger_entries")
    .select("id, amount_cents, party, note, direction, adjusts_id")
    .eq("project_id", P)
    .eq("module_key", "expenses")
    .order("created_at", { ascending: false })
    .limit(6);
  const fromPaper = (spent.data ?? []).filter((r) =>
    /murni/i.test(`${r.party ?? ""} ${r.note ?? ""}`),
  );
  check(
    "🔴 按完之后，开销那一页上真的多了一笔",
    fromPaper.length > 0,
    `最新几笔：${JSON.stringify(spent.data ?? [])}`,
  );
  /* 🔴 一个接近的数字不算对 —— 那是一笔从来没有花过的钱。 */
  check(
    "🔴 而且是纸上那个 RM 501.00",
    fromPaper.some((r) => Number(r.amount_cents) === 50100),
    `写进去的是 ${JSON.stringify(fromPaper.map((r) => r.amount_cents))}`,
  );
  /* 🔴 写进去而不念出来，他就没有办法跟手上那张纸对一次。 */
  check(
    "🔴 它把那个数字念回给他（501）",
    /501/.test(`${paperSaid} ${cardText}`),
    paperSaid.slice(0, 220),
  );
  /* 店名原样拄下来 —— 不翻译、不改拼法。 */
  check(
    "🔴 那家店的名字原样拄下来（Sri Murni）",
    /sri\s*murni/i.test(`${paperSaid} ${cardText}`),
    paperSaid.slice(0, 220),
  );
  await page.screenshot({ path: `${OUT}/17-supplier-bill.png` });

  console.log("");
  console.log("── ㉒ 🔴 撤销 —— 而钱不是删掉的 ────────────");
  /*
    🔴 这一段量的不是「那一笔不见了」—— **刚好相反**。

    钱不改也不删（vibe-dealer 那一条我们照抄没有争论过）：
    撤销一笔钱是**开一笔相反的**，两笔都留着。
    一个改过而看不出改过的数字，跟一句谎话分不出来。

    ⚠️ 所以尺子要量三件：原来那一笔**还在** · 多了一笔挂在它身上 ·
    两笔加起来是 0。只量「没有了」的尺子，会在有一天真的变成删掉的时候全绿。
  */
  const undoBtn = page.locator("[data-work-ai-undo]").first();
  check(
    "🔴 写进去之后，那颗撤销真的在",
    (await undoBtn.count()) > 0,
    "找不到 [data-work-ai-undo]",
  );
  if (await undoBtn.count()) {
    await undoBtn.click({ timeout: 30000 });
    await page.waitForTimeout(4000);
  }
  const undoneRows = await admin
    .from("ledger_entries")
    .select("id, amount_cents, direction, adjusts_id, party, note")
    .eq("project_id", P)
    .eq("module_key", "expenses");
  const pairRows = (undoneRows.data ?? []).filter((r) =>
    /murni/i.test(`${r.party ?? ""} ${r.note ?? ""}`),
  );
  const firstPaid = fromPaper[0];
  check(
    "🔴 原来那一笔还在 —— 钱不是删掉的",
    pairRows.some((r) => r.id === firstPaid?.id),
    `帐上剩 ${JSON.stringify(pairRows.map((r) => r.id))}`,
  );
  check(
    "🔴 而是多了一笔相反的，挂在它身上",
    pairRows.some((r) => r.adjusts_id === firstPaid?.id),
    JSON.stringify(pairRows.map((r) => ({ a: r.amount_cents, d: r.direction, adj: r.adjusts_id }))),
  );
  check(
    "🔴 两笔加起来是 0",
    pairRows.reduce((n, r) => n + (r.direction === "out" ? -1 : 1) * Number(r.amount_cents ?? 0), 0) === 0,
    JSON.stringify(pairRows.map((r) => ({ a: r.amount_cents, d: r.direction }))),
  );
  await page.screenshot({ path: `${OUT}/18-undone.png` });

  console.log("");
  console.log("── ㉓ 🔴 官网订的、柜台从 WhatsApp 打进来的 —— 一按都变客人 ──");
  /*
    🔴 他问的那一句：`如果没有官网呢 从 WhatsApp/Instagram 进来的客户呢`。

    `claim_booking_party` 不管那一笔预约是怎么来的 —— 它只读那一笔
    自己带着的名字跟号码。所以官网自己订的、跟柜台从 WhatsApp 聊天里
    抄进来的，**是同一颗按钮**。这一段量两条路都通：

    ⚠️ A · 只有名字，没有号码（走进来的客人、柜台只记了名字）——
        认得成客人，而电话栏位留白，不是编一个
    ⚠️ B · 柜台把 WhatsApp 上问来的号码**讲给助手**（`book_appointment`
        新的 `contact` 格）—— 那一笔带着号码进去，认成客人的时候
        那个号码原样落在客户的 WhatsApp 栏上
  */
  const claimDay = mytToday;
  const { error: deviErr } = await api.rpc("add_appointment", {
    in_project_id: P,
    in_module_key: bookPage,
    in_starts_at: new Date(Date.parse(`${claimDay}T07:00:00+08:00`)).toISOString(),
    in_ends_at: new Date(Date.parse(`${claimDay}T08:00:00+08:00`)).toISOString(),
    in_party: "Ms Devi",
    in_service: "Facial",
  });
  if (deviErr) throw new Error(`seed Ms Devi appt: ${deviErr.message}`);

  await page.goto(`${BASE}/en/portal/${bookPage}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-work-ai]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const claimedA = await say(page, "Add Ms Devi to the customer list from her booking");
  console.log(`        它讲了：${claimedA.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);

  const deviRow = await admin
    .from("directory_entries")
    .select("id, name, phone, whatsapp")
    .eq("project_id", P)
    .eq("module_key", "customers")
    .ilike("name", "%devi%")
    .is("archived_at", null)
    .maybeSingle();
  check(
    "🔴 A · 只有名字的那一笔，认成客人了",
    !!deviRow.data,
    claimedA.slice(0, 200) || "（它一句话都没讲）",
  );
  /* ⚠️ 没有号码就留白，不编一个 —— 一个编出来的号码是一条发给别人的讯息。 */
  check(
    "🔴 而电话栏位留白，不是编一个",
    !deviRow.data?.whatsapp,
    `whatsapp = ${JSON.stringify(deviRow.data?.whatsapp)}`,
  );
  const { data: deviAppt } = await admin
    .from("appointments")
    .select("party_id")
    .eq("project_id", P)
    .ilike("party", "%devi%")
    .maybeSingle();
  check(
    "🔴 那一笔预约挂回了刚认出来的那个人",
    deviAppt?.party_id === deviRow.data?.id,
    `party_id=${deviAppt?.party_id} customer=${deviRow.data?.id}`,
  );

  /* 🔴 按第二下 —— 不开出第二个「Ms Devi」。 */
  await say(page, "Add Ms Devi to the customer list from her booking");
  await page.waitForTimeout(2000);
  const deviCount = await admin
    .from("directory_entries")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .eq("module_key", "customers")
    .ilike("name", "%devi%");
  check(
    "🔴 按第二下不会开出第二个客人",
    (deviCount.count ?? 0) === 1,
    `名册上有 ${deviCount.count} 个 Devi`,
  );

  /* ⚠️ B · 从 WhatsApp 上问来的，柜台把号码讲给助手 —— 走 book_appointment 新的 contact 格。 */
  const tayDictated = await say(
    page,
    "Book Madam Tay tomorrow 9am to 9:45am for a manicure, her number is 0123456789",
  );
  console.log(`        它讲了：${tayDictated.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);
  const tayAppt = await admin
    .from("appointments")
    .select("id, extra")
    .eq("project_id", P)
    .ilike("party", "%tay%")
    .maybeSingle();
  check(
    "🔴 B · 那一笔带着柜台讲的号码进去了",
    /0123456789|012.?345.?6789/.test(String(tayAppt.data?.extra?.contact ?? "")),
    `extra=${JSON.stringify(tayAppt.data?.extra)} — ${tayDictated.slice(0, 160)}`,
  );

  /*
    🔴 这一段以前走 `api.rpc` 直接绕过助手——种到第九笔预约的时候，
    `live-rows.ts` 的 DaySchedule 投影把真数字砍到最多 8 笔
    （`.slice(0, 8)`），而且没有「还有 N 笔没列出来」那句话，
    所以 Madam Tay 从模型看得到的名单里静静消失了。那一支已经改成
    `.slice(0, 50)`（对齐上面那支 fetch 自己的 `limit`，见任务 361），
    现在改回原来要量的那一句——**让助手自己找到她，不是替它按**。
  */
  const tayDictatedClaim = await say(page, "Add Madam Tay to the customer list from her booking");
  console.log(`        它讲了：${tayDictatedClaim.split(String.fromCharCode(10)).join(" / ").slice(0, 200)}`);
  await page.waitForTimeout(2500);
  const tayRow = await admin
    .from("directory_entries")
    .select("id, name, phone, whatsapp")
    .eq("project_id", P)
    .eq("module_key", "customers")
    .ilike("name", "%tay%")
    .is("archived_at", null)
    .maybeSingle();
  check(
    "🔴 第九笔预约，助手自己在画面上找到她、认成客人了",
    !!tayRow.data,
    tayDictatedClaim.slice(0, 200) || "（它一句话都没讲）",
  );
  /* 🔴 号码原样落在客户身上 —— 不是重打一次，是那一笔预约自己带着的那个。 */
  check(
    "🔴 而且那个号码原样落在她的 WhatsApp 栏上",
    String(tayRow.data?.whatsapp ?? "").replace(/\D/g, "") === "0123456789",
    `whatsapp = ${JSON.stringify(tayRow.data?.whatsapp)}`,
  );
  await page.screenshot({ path: `${OUT}/19-claimed.png` });


  console.log("");
  console.log("── ㉔ 🔴 叫她签一份同意书 —— 送出去，不是签了 ──");
  /*
    🔴 `request_consent`（20260909130000）已经在跑，画面那一边
    四扇门也在（[任务 322]），缺的是助手接得到它。[任务 326] 量过
    medi spa 走完一趟之后**它才是那一件真正缺的**：同意书发得出去、
    她自己签得了，而没有人主动讲出口。

    ⚠️ 这一段量两件：范本从**闭集**里挑对了 · **送出去不等于签了**——
    这一支回来的那一刻，客人还没看过那条连结，一句「已签」是一个
    他还没发生的事实。
  */
  const { data: farah, error: farahErr } = await api.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "customers",
    in_name: "Ms Farah",
  });
  if (farahErr) throw new Error(`seed Ms Farah: ${farahErr.message}`);
  const { error: formErr } = await api.rpc("add_consent_form", {
    in_project_id: P,
    in_name: "Botox consent",
    in_body: "I understand the risks of botulinum toxin treatment.",
  });
  if (formErr) throw new Error(`seed consent form: ${formErr.message}`);

  await page.goto(`${BASE}/en/portal/customers`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-work-ai]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const consentSaid = await say(page, "Send Ms Farah the Botox consent form to sign");
  console.log(`        它讲了：${consentSaid.split(String.fromCharCode(10)).join(" / ").slice(0, 220)}`);
  await page.waitForTimeout(2500);

  const sent = await admin
    .from("consent_signatures")
    .select("id, party_id, form_name, signed_at")
    .eq("project_id", P)
    .eq("party_id", farah?.id)
    .maybeSingle();
  check(
    "🔴 那份同意书真的发出去了，挂在她身上",
    !!sent.data,
    consentSaid.slice(0, 200) || "（它一句话都没讲）",
  );
  check(
    "🔴 挑对了范本（Botox consent）",
    /botox/i.test(String(sent.data?.form_name ?? "")),
    `form_name = ${sent.data?.form_name}`,
  );
  /* 🔴 送出去那一刻她还没看过那条连结，不可以讲成已经签了。 */
  check(
    "🔴 资料库那一边：还没签（signed_at 是 null）",
    sent.data?.signed_at == null,
    `signed_at = ${sent.data?.signed_at}`,
  );
  check(
    "🔴 而且它讲的是「发出去 / 等她签」，不是「她签了」",
    !/\b(has signed|already signed|签好了|签了)\b/i.test(consentSaid),
    consentSaid.slice(0, 220),
  );
  await page.screenshot({ path: `${OUT}/20-consent.png` });


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
