/**
 * 他按错的时候，救不救得回来 —— **前三把全部走顺利的那条路，这一把不走。**
 *
 *   npm run walk:mistakes
 *   TRADE=salon npm run walk:mistakes
 *
 * 老板 2026-09-07：`再帮我排查其他方向`
 *
 * ── 四支尺各问一个问题（四支都要，不是同一份清单的四份）──────────────────
 *
 *   walk:customer   一天的事**走不走得通**
 *   walk:friction   同一条路**顺不顺**
 *   walk:eyesight   他的**眼睛跟手指**过不过得去
 *   **这一支**       🔴 **他做错的时候会怎样**
 *
 * 一个老板一天里按错、断网、按上一页、开两个分页 —— 那是常态不是意外。
 * 而前三把从来没有走过那几条路。
 *
 * ── 🔴 而这一支要问的不是「挡不挡得住」，是「画面讲不讲得出话」──────────
 *
 * 资料库那一层守得很紧：26 条隔离检查 · 幂等 · 约束 · 触发器。
 * **所以「别人的记录打不开」几乎一定是真的。**
 * 而这一支问的是下一句：**打不开的时候他看到什么？**
 * 一个白屏、一句资料库的原话、跟一句「这一单不是你的」，
 * 在资料库那一层长得一模一样，而在他眼前差很远。
 *
 * ⚠️ 它开**两个**用完就删的帐号（要一个「别人」），跑完两个都删。
 * ⚠️ 它只印读数跟明显的红，不打分数。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const STAMP = Date.now();
const MINE = { email: `mis-a-${STAMP}@formae.test`, pass: `MisA!${STAMP}` };
const THEIRS = { email: `mis-b-${STAMP}@formae.test`, pass: `MisB!${STAMP}` };

const TRADES = {
  reno: { pages: ["customers", "quotations", "payments"], who: "Hin Fatt Renovation", job: "quotations" },
  salon: { pages: ["customers", "bookings", "payments"], who: "Wei Hair Studio", job: "bookings" },
  hardware: { pages: ["customers", "inventory", "orders"], who: "Seng Huat Hardware", job: "orders" },
};
const TRADE = process.env.TRADE || "reno";
const T = TRADES[TRADE];
if (!T) throw new Error(`不认得这一行：${TRADE}`);
const OUT = `.screenshots/walk-mistakes/${TRADE}`;
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const mk = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
const apiA = mk();
const apiB = mk();
const ids = [];
dropThrowawayOnExit?.(admin, () => ids);

const found = [];
const BAD = "红";
const ODD = "黄";
const flag = (level, where, what, ev = "") => {
  found.push({ level, where, what });
  console.log(`  ${level === BAD ? "🔴" : "⚠️ "} ${where.padEnd(18)} ${what}${ev ? "\n       " + ev : ""}`);
};
const ok = (where, what) => console.log(`  ✓  ${where.padEnd(18)} ${what}`);
const head = (t) => console.log(`\n${t}`);
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` }).catch(() => {});
const seen = async (page) => ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ");

/* 那张表单第一个可以打字的框 */
const firstField = (page) =>
  page.locator('input[type="text"]:visible, input:not([type]):visible, textarea:visible').first();
const saveBtn = (page) =>
  page.locator('button:visible, [role=button]:visible').filter({ hasText: /^\s*(Save|保存)\s*$/i }).first();

let browser;

try {
  /* 🔴 开跑之前先探一次 —— 一份「登入没成功」的报告跟一份「服务器不在」的
     报告，在画面上长得一模一样（这个仓库被这个形状骗过五次）。 */
  const alive = await fetch(`${BASE}/en/login`, { redirect: "manual" }).catch(() => null);
  if (!alive) {
    console.error(`\n🔴 ${BASE} 不回话 —— 先开 npm run dev。`);
    process.exit(2);
  }

  /* ── 台面：两个老板，因为这一支要一个「别人」 ───────────────────── */
  for (const [who, api] of [
    [MINE, apiA],
    [THEIRS, apiB],
  ]) {
    const { data: made, error } = await admin.auth.admin.createUser({
      email: who.email,
      password: who.pass,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser ${who.email}: ${error.message}`);
    ids.push(made.user.id);
    const { error: e2 } = await api.auth.signInWithPassword({ email: who.email, password: who.pass });
    if (e2) throw new Error(`signIn ${who.email}: ${e2.message}`);
    const { data: p } = await api.from("projects").select("id").single();
    if (!p?.id) throw new Error("注册没有开出一个 project");
    await admin
      .from("projects")
      .update({ business_name: who === MINE ? T.who : "Somebody Else Sdn Bhd", system_language: "en" })
      .eq("id", p.id);
    await api.rpc("set_project_style", { new_style: "swiss" });
    for (const key of T.pages) await api.rpc("add_project_page", { requested_key: key, new_title: null });
  }

  /* 别人那一笔真的记录 —— 待会拿它的编号打进我的网址 */
  const { data: theirProj } = await apiB.from("projects").select("id").single();
  const { data: theirRow, error: theirErr } = await apiB.rpc("add_pipeline_record", {
    in_project_id: theirProj.id,
    in_module_key: T.job,
    in_title: "Not yours at all",
    in_party: "Their customer",
    in_amount_cents: 999900,
    in_idempotency_key: crypto.randomUUID(),
  });
  if (theirErr) throw new Error(`别人那一笔建不起来：${theirErr.message}`);
  const theirId = Array.isArray(theirRow) ? theirRow[0]?.id : theirRow?.id;
  if (!theirId) throw new Error(`别人那一笔没有回编号：${JSON.stringify(theirRow).slice(0, 120)}`);

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();

  head("① 登入");
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.fill('input[type="email"]', MINE.email);
  await page.fill('input[type="password"]', MINE.pass);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 300000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  if (!page.url().includes("/portal")) {
    await shot(page, "0-stuck-on-login");
    const still = await fetch(`${BASE}/en/login`, { redirect: "manual" }).catch(() => null);
    const said = await seen(page);
    throw new Error(
      `登入没成功（${!still ? "服务器中途死了 —— 不是产品" : /Incorrect|too many|reach/i.test(said) ? "画面上真的有一句话" : "🔴 画面上一个字都没有"}）`,
    );
  }
  ok("登入", `落在 ${new URL(page.url()).pathname}`);

  /* 暖机 —— 把本机第一次编译的时间花掉，不然下面每一条都在量编译 */
  for (const u of [...T.pages, `${T.job}/new`]) {
    await page.goto(`${BASE}/en/portal/${u}`, { waitUntil: "domcontentloaded", timeout: 300000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  ok("暖机", "走过一次");

  const countMine = async () => {
    const { data } = await apiA.from("pipeline_records").select("id,title").eq("module_key", T.job);
    return data ?? [];
  };

  /* ═══ ② 按两下保存 ══════════════════════════════════════════════════
     柜台跟工地上按两下是常态。资料库有防重复的钥匙，**而画面那一边呢**。 */
  head("② 他按了两下保存");
  {
    const before = (await countMine()).length;
    await page.goto(`${BASE}/en/portal/${T.job}/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(1200);
    const f = firstField(page);
    if (await f.count()) await f.fill("Double tap test");
    const b = saveBtn(page);
    if (!(await b.count())) flag(ODD, "按两下", "找不到那颗保存 —— 这一条没量到");
    else {
      await b.click({ timeout: 8000 }).catch(() => {});
      await b.click({ timeout: 1500, force: true }).catch(() => {}); /* 第二下，越快越像真的 */
      await page.waitForTimeout(3500);
      const after = await countMine();
      const dupes = after.filter((r) => r.title === "Double tap test").length;
      if (dupes > 1) flag(BAD, "按两下", `开出 ${dupes} 张单 —— 同一件工作在他帐上出现两次`);
      else ok("按两下", `只开出 ${dupes} 张（改之前 ${before} 张）`);
    }
  }

  /* ═══ ③ 打到一半按上一页 · ④ 重新整理 ═══════════════════════════════
     他打到一半，客人打电话来，他按上一页去查一件事，再回来 —— 那些字还在吗。 */
  for (const [name, act] of [
    ["按上一页再回来", async () => {
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(1200);
      await page.goForward({ waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(1800);
    }],
    ["重新整理", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
    }],
  ]) {
    head(`③ 他${name}`);
    await page.goto(`${BASE}/en/portal/${T.job}/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(1200);
    const f = firstField(page);
    if (!(await f.count())) {
      flag(ODD, name, "找不到可以打字的框 —— 这一条没量到");
      continue;
    }
    const typed = `半路走开 ${name}`;
    await f.fill(typed);
    await page.waitForTimeout(700);
    await act();
    const still = await firstField(page).inputValue().catch(() => "");
    if (still === typed) ok(name, "他打的字还在");
    else flag(ODD, name, `打到一半的字不见了（读回来是「${still || "空的"}」）—— 他要重打一次`);
    await shot(page, `3-${name}`);
  }

  /* ═══ ⑤ 什么都不填就按保存 ═════════════════════════════════════════ */
  head("④ 他什么都不填就按保存");
  {
    await page.goto(`${BASE}/en/portal/${T.job}/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(1200);
    const before = (await countMine()).length;
    const b = saveBtn(page);
    if (!(await b.count())) flag(ODD, "空的送出", "找不到那颗保存");
    else {
      await b.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const after = (await countMine()).length;
      const said = await seen(page);
      /* 画面上有没有一句话，而那句话离出错那一格多远 */
      const msg = await page
        .evaluate(() => {
          const el = [...document.querySelectorAll('[role=alert],[aria-live],.text-destructive,[data-error]')].find(
            (e) => (e.innerText || "").trim(),
          );
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const first = document.querySelector("input:not([type=hidden]),textarea,select");
          const fr = first?.getBoundingClientRect();
          return {
            t: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 90),
            away: fr ? Math.round(Math.abs(r.top - fr.bottom)) : null,
            focused: document.activeElement?.tagName ?? "",
          };
        })
        .catch(() => null);
      if (after > before) flag(BAD, "空的送出", "一张什么都没有的单存进去了");
      else if (!msg) flag(BAD, "空的送出", "挡下来了，而画面上一个字都没有 —— 他不知道为什么按了没反应", said.slice(0, 120));
      else {
        ok("空的送出", `挡下来了，画面写「${msg.t}」`);
        if (msg.away !== null && msg.away > 120)
          flag(ODD, "空的送出", `那句话离出错那一格 ${msg.away}px —— 他要自己找是哪一格`);
        if (msg.focused !== "INPUT" && msg.focused !== "TEXTAREA")
          flag(ODD, "空的送出", `光标没有回到那一格（现在停在 ${msg.focused || "什么都没有"}）`);
      }
      await shot(page, "4-empty-save");
    }
  }

  /* ═══ ⑥ 网址打一个不存在的编号 · ⑦ 打别人的编号 ═════════════════════
     🔴 后面那一条是这一支最值钱的：资料库一定挡得住（26 条隔离检查），
     而**他看到的是什么** —— 白屏 · 一句资料库的原话 · 还是一句人话。 */
  for (const [name, id] of [
    ["乱打一个编号", crypto.randomUUID()],
    ["打别人的编号", theirId],
  ]) {
    head(`⑤ 他在网址上${name}`);
    const res = await page
      .goto(`${BASE}/en/portal/${T.job}/${id}`, { waitUntil: "domcontentloaded", timeout: 120000 })
      .catch(() => null);
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    const code = res?.status() ?? 0;
    const said = await seen(page);
    const words = said.split(" ").filter(Boolean).length;
    const leaked = /Not yours at all|Their customer|9,999/.test(said);
    const raw = /PGRST|violates|permission denied|null value|column .* does not exist|Unhandled|stack/i.test(said);
    console.log(`  回码 ${code} · 画面上 ${words} 个字`);
    if (leaked) flag(BAD, name, "🔴 别人那一单的内容出现在画面上");
    else if (raw) flag(BAD, name, "画面上是一句资料库的原话，不是人话", said.slice(0, 140));
    else if (words < 8) flag(BAD, name, `几乎是一张白纸（${words} 个字）—— 他不知道发生什么事`, said.slice(0, 100));
    else ok(name, `讲了一句话：「${said.slice(0, 90)}」`);
    await shot(page, `5-${name}`);
  }

  /* ═══ ⑧ 两个分页同时改同一笔 ══════════════════════════════════════
     🔴 办公室的电脑开着，手机上那一份也开着 —— 后存的会不会静静盖掉先存的。
     那是一种**没有任何东西会讲**的资料遗失。 */
  head("⑥ 他在两个地方同时改同一笔");
  {
    const { data: mineProj } = await apiA.from("projects").select("id").single();
    const { data: mineRow } = await apiA.rpc("add_pipeline_record", {
      in_project_id: mineProj.id,
      in_module_key: T.job,
      in_title: "Two tabs",
      in_party: "Mrs Tan",
      in_amount_cents: 100000,
      in_idempotency_key: crypto.randomUUID(),
    });
    const rid = Array.isArray(mineRow) ? mineRow[0]?.id : mineRow?.id;
    if (!rid) flag(ODD, "两个分页", "建不出那一笔 —— 这一条没量到");
    else {
      const p2 = await ctx.newPage();
      const url = `${BASE}/en/portal/${T.job}/${rid}`;
      for (const p of [page, p2]) {
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
        await p.waitForTimeout(1200);
      }
      /* A 改标题、存 */
      const fa = firstField(page);
      if (await fa.count()) await fa.fill("A 改过的");
      await saveBtn(page).click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);
      /* B 那一份是**改之前**载入的 —— 它改别的地方，存 */
      const fb = firstField(p2);
      const bHad = await fb.inputValue().catch(() => "");
      if (await fb.count()) await fb.fill("B 改过的");
      await saveBtn(p2).click({ timeout: 8000 }).catch(() => {});
      await p2.waitForTimeout(3000);
      const { data: after } = await apiA.from("pipeline_records").select("title").eq("id", rid).single();
      console.log(`  B 那一份载入的时候看到的是「${bHad}」`);
      if (after?.title === "B 改过的")
        flag(
          BAD,
          "两个分页",
          `后存的把先存的盖掉了，而画面上没有讲 —— 现在是「${after?.title}」`,
          "他在办公室改一次、在手机上改一次，先改的那一次会静静消失",
        );
      else ok("两个分页", `资料库现在是「${after?.title}」`);
      await shot(p2, "6-second-tab");
      await p2.close();
    }
  }

  /* ═══ ⑨ 断网之后按保存 ═════════════════════════════════════════════ */
  head("⑦ 他按保存的时候网路断了（工地上很常见）");
  {
    await page.goto(`${BASE}/en/portal/${T.job}/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(1200);
    const f = firstField(page);
    if (await f.count()) await f.fill("断网的时候打的");
    await ctx.setOffline(true);
    const b = saveBtn(page);
    if (!(await b.count())) flag(ODD, "断网", "找不到那颗保存");
    else {
      await b.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(6000);
      const said = await seen(page);
      const spoke = /offline|network|connect|try again|failed|无法|网路|连不上|再试/i.test(said);
      const stillTyped = (await firstField(page).inputValue().catch(() => "")) === "断网的时候打的";
      const btnState = await b.evaluate((el) => ({ text: (el.innerText || "").trim(), dis: el.disabled })).catch(() => null);
      if (!spoke)
        flag(BAD, "断网", "画面上一个字都没有 —— 他不知道存进去了没有", `那颗按钮现在是「${btnState?.text}」${btnState?.dis ? "（灰的）" : ""}`);
      else ok("断网", "画面讲了一句话");
      if (!stillTyped) flag(BAD, "断网", "而且他打的字不见了");
      else ok("断网", "他打的字还在");
      await shot(page, "7-offline");
    }
    await ctx.setOffline(false);
  }

  head("判");
  const bad = found.filter((f) => f.level === BAD).length;
  console.log(`  ${bad} 件红 · ${found.length - bad} 件黄`);
  console.log(`  图在 ${OUT}/`);
  if (bad) process.exitCode = 1;
} catch (e) {
  console.error("\n🔴 这一趟没走完：", e.message);
  process.exitCode = 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  await dropThrowaways(admin, ids);
}
