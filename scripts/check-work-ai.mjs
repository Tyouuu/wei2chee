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
