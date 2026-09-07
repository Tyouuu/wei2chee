/**
 * 一个陌生人在已上线的官网上，真的订一个时段。
 *
 * ── 为什么这一支非有不可（2026-09-05）──────────────────────────────────
 *
 * `submit_site_booking` 那一支 2026-09-05 就写好了，34 条真身分的检查
 * 全过 —— 而它自己的档头写着「今天还没有任何地方呼叫它们」，
 * 而那句话到今天为止都是真的。
 *
 * **一支通过了每一条检查、而画面上没有人按得到的函式，就是这个仓库
 * 犯过二十次的那件事。** 所以这一支不打 RPC，它**开真的浏览器，
 * 在真的官网上按**，走完五段：
 *
 *   ① 挑一天 → ② 看得到哪几格空着 → ③ 挑一格 → ④ 填名字电话 → ⑤ 送出
 *   → 回资料库看那一行在不在，而且 `source` 是 `website`
 *
 * ⚠️ 而它同时验**两个方向**：
 *   · 一间沙龙（有预约那一页）→ 官网上有那一块，而且订得了
 *   · 一间装修公司（没有）→ 官网上**一块都没有**
 *   一条只验一半的检查，会让「每一家都画」跟「只有对的那一家画」
 *   看起来一模一样。
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
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
const OUT = ".screenshots/booking";

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let salonId = null;
let renoId = null;
/** 一起建出来的那几笔问卷。**帐号删掉不会带走它们**（`accounts.lead_id`
 *  指的是 leads，不是反过来），所以要自己收。 */
const leadIds = [];
dropThrowawayOnExit(admin, () => salonId);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };

/** 开一个用完就删的帐号，给它几页跟一个网址名，然后上线。 */
async function makeSite(kind, pages, slug, tradeSlug) {
  const email = `book-${kind}-${Date.now()}@formae.test`;
  const password = `Book-${Date.now()}-x!`;
  const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  /* 🔴 行业不在 `projects` 上，在**问卷**上：
     `accounts.lead_id → leads.industry_id → industries`
     （`get_my_business_context`）。
     我第一版去更新 `projects.trade_slug` —— **那一栏根本不存在**，
     而 PostgREST 静静地什么都没做，於是两个官网都落在预设那一套模版上，
     报出来是「沙龙的官网上没有挑时段那一块」。
     **道具没摆好跟产品坏了，在报告里长得一模一样。** */
  const { data: ind } = await admin.from("industries").select("id").eq("slug", tradeSlug).single();
  if (!ind?.id) throw new Error(`industries 里没有 ${tradeSlug}`);
  const { data: lead, error: ldErr } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "booking check" } })
    .select("id")
    .single();
  if (ldErr) throw new Error(`lead: ${ldErr.message}`);
  leadIds.push(lead.id);

  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { lead_id: lead.id },
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");

  /* 🔴 风格不是随便挑的 —— 有几套的官网**故意没有询价表**
     （`site-composition` 的 `dropBlocks`，任务 129 量过：満図 就是其中一套）。
     我第一版两边都用 満図，於是装修那一边报「询价表也不见了」，
     而那是**那一套风格的设计，不是一个 bug**。第十八次红的是我的道具。

     沙龙留在 満図 —— 那是它真正会拿到的那一套，而它正好证明了
     **挑时段那一块不会被 `dropBlocks` 丢掉**：一个订位页没有订的地方
     不是一个设计选择，是一张坏掉的页。 */
  await api.rpc("set_project_style", { new_style: kind === "salon" ? "hearth" : "blueprint" });
  for (const key of pages) {
    await api.rpc("add_project_page", { new_page_key: key });
  }
  await api.rpc("set_my_site_slug", { new_slug: slug });
  return { id: made.user.id, projectId: proj.id, api, slug, email, password };
}

let browser;
try {
  const stamp = Date.now().toString().slice(-7);
  const salonSlug = `salon-${stamp}`;
  const renoSlug = `reno-${stamp}`;

  const salon = await makeSite("salon", ["customers", "bookings", "payments", "website"], salonSlug, "beauty");
  salonId = salon.id;
  const reno = await makeSite("reno", ["customers", "quotations", "projects", "payments", "website"], renoSlug, "renovation");
  renoId = reno.id;

  browser = await chromium.launch();
  /* ── 先把两个官网上线 ────────────────────────────────────────────────
     `set_my_site_published` 要求那一页**存过** —— 一个从来没有被保存过的
     官网上线之后是一张空页，所以那道守卫是对的。存的方法只有一个：
     用真的浏览器按一次「保存设计」（跟 `shoot:pages` 同一条）。 */
  const desk = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  for (const site of [salon, reno]) {
    await desk.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await desk.fill('input[type="email"]', site.email);
    await desk.fill('input[type="password"]', site.password);
    await desk.click('button[type="submit"]');
    await desk.waitForURL(/portal/, { timeout: 180000 });
    await desk.goto(`${BASE}/en/portal/website?design=1`, { waitUntil: "networkidle", timeout: 180000 });
    await desk.waitForTimeout(3000);
    const more = desk.locator("summary", { hasText: /^More/ }).first();
    if (await more.count()) { await more.click({ timeout: 30000 }); await desk.waitForTimeout(400); }
    await desk.getByRole("button", { name: /save design/i }).first().click({ timeout: 60000 });
    await desk.waitForTimeout(4000);
    const { data: word } = await site.api.rpc("set_my_site_published", { publish: true });
    if (word === "ok") ok(`${site.slug} 上线了`);
    else no(`${site.slug} 上不了线`, String(word));
    await desk.context().clearCookies();
  }
  await desk.close();

  /* 🔴 `reducedMotion: "reduce"` —— 不然整块拍出来是灰的。
     滚动进场（`reveal.tsx`）在整页截图里会**停在半路**，而那张图
     看起来像我们的对比度坏掉了。任务 28 撞过一次，任务 80 修好过一次。 */
  const page = await browser.newPage({
    viewport: { width: 420, height: 950 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });

  /* ── ① 沙龙的官网上有那一块 ───────────────────────────────────────── */
  const res = await page.goto(`${BASE}/s/${salonSlug}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  if ((res?.status() ?? 0) >= 400) {
    no(`沙龙的官网打不开`, res?.status());
  } else {
    await page.waitForTimeout(2500);
    /* ⚠️ 认的是那一块的 **id**，不是按钮上的字 —— 那个字是模版传的
       （「Request a slot」），而我第一版找的是组件自己的后备字
       （「Book this time」），於是它对着一张完全正确的页面报「没有那一块」。
       **第十六次红的是我的尺不是产品。** */
    if (await page.locator("#website-booking").count()) ok("沙龙的官网上有挑时段那一块");
    else no("沙龙的官网上没有挑时段那一块");
  }

  /* ── ② 哪几格空着 ─────────────────────────────────────────────────── */
  const slotButtons = page.locator('#website-booking button:not([disabled])').filter({ hasText: /^\d{2}:\d{2}$/ });
  const free = await slotButtons.count();
  if (free > 0) ok(`看得到 ${free} 个空的时段`);
  else no("一个空时段都看不到", free);

  /* ── ②b 什么都不填就按下去 —— 他知道少了什么吗 ────────────────────
     2026-09-07 之前这一段是**最安静**的一种：那颗按钮写着 `!chosen`
     就变灰，所以他还没挑时段的时候按钮按不动，而画面上一个字都不讲。
     一颗按不动又不说为什么的按钮，跟少一句话不是同一件事。
     Baymard：错误要**贴着那一格**，讲**要求**不讲**违规**。

     ⚠️ 这一段要排在挑时段前面 —— 挑完再按就送出去了，量不到这一件。 */
  {
    const form = page.locator("#website-booking");
    const btn = form.locator('button[type="submit"]').first();
    /* 🔴 **答案有三种，不是两种。** 那颗按钮可能是**灰的** ——
       挡住一次错的送出是对的，而一颗按不动又不说为什么的按钮，
       他站在那里不知道少了什么。而且拿 click() 去打一颗灰的，
       Playwright 会等满 30 秒然后把整支尺**炸掉** ——
       一支死掉的尺不是一支会报告的尺。 */
    if (await btn.isDisabled().catch(() => false)) {
      no("什么都不填按下去 —— 按钮是灰的，而画面上没有讲少了什么");
      await page.screenshot({ path: `${OUT}/0-empty.png`, fullPage: true });
    } else {
    await btn.click();
    await page.waitForTimeout(600);
    const alerts = form.locator('[role="alert"]');
    const n = await alerts.count();
    if (n > 0) {
      const said = (await alerts.first().innerText()).trim();
      /* 贴着哪一格：那句话跟时段那一片格子之间的缝。
         上缘对上缘量出来是那一片格子的高度，所以量的是缝。 */
      const gap = await page.evaluate(() => {
        const al = document.querySelector('#website-booking [role="alert"]');
        const grid = [...document.querySelectorAll("#website-booking div")].find(
          (d) => d.className.includes("grid-cols-2"),
        );
        if (!al || !grid) return -1;
        const a1 = al.getBoundingClientRect();
        const b1 = grid.getBoundingClientRect();
        return Math.max(0, Math.round(Math.max(a1.top - b1.bottom, b1.top - a1.bottom)));
      });
      if (gap >= 0 && gap <= 24) ok(`什么都不填按下去，它讲了、而且离那一片格子 ${gap}px：${said.slice(0, 40)}`);
      else no("那句话没有贴着时段那一片格子", `${gap}px「${said.slice(0, 40)}」`);
    } else {
      no("什么都不填按下去，画面上一个字都没有 —— 他不知道少了什么");
    }
    await page.screenshot({ path: `${OUT}/0-empty.png`, fullPage: true });
    }
  }

  /* ── ③④⑤ 挑一格、填、送出 ────────────────────────────────────────── */
  let picked = "";
  if (free > 0) {
    const first = slotButtons.first();
    picked = (await first.innerText()).trim();
    await first.click();
    const form = page.locator("#website-booking");
    await form.getByLabel(/your name|怎么称呼/i).first().fill("Mrs Lee");
    await form.getByLabel(/phone|电话/i).first().fill("012-3xx xxxx");
    await form.getByLabel(/what do you need|想做什么/i).first().fill("Colour and cut");
    await page.screenshot({ path: `${OUT}/1-picked.png`, fullPage: true });
    await form.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3500);
    const said = await page.locator('#website-booking [aria-live="polite"]').first().innerText().catch(() => "");
    if (/booked|订好了/i.test(said)) ok(`他读到的是：${said.trim().slice(0, 60)}`);
    else no("送出之后画面上没有讲订好了", said.trim().slice(0, 80) || "(空的)");
    await page.screenshot({ path: `${OUT}/2-booked.png`, fullPage: true });
  }

  /* ── 那一行真的在资料库里吗 ──────────────────────────────────────── */
  const { data: rows } = await admin
    .from("appointments")
    .select("party, service, source, status, starts_at, extra")
    .eq("project_id", salon.projectId);
  const mine = (rows ?? []).find((r) => r.party === "Mrs Lee");
  if (mine) ok("资料库里真的多了一行");
  else no("资料库里没有那一行", `${(rows ?? []).length} 行`);
  if (mine?.source === "website") ok("那一行标着是从官网来的");
  else no("那一行的来源不对", mine?.source);
  if (mine?.extra?.contact) ok("他留的电话看得回来");
  else no("他留的电话没有存下来");
  if (mine?.service === "Colour and cut") ok("他打的那句话跟着走");
  else no("他打的那句话不见了", mine?.service);

  /* ── ⑥ 同一格再订一次 —— 他要读到的是「刚被订走了」 ───────────────── */
  if (free > 0 && mine) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    /* ⚠️ 不要拿「那一颗还在不在」去问 —— 订走之后那一颗多了一行「Taken」，
       所以 `^09:00$` 找不到它，而 `.first()` 打在空的上面回 null，
       报出来是「还按得下去」。**第十七次红的是我的尺。**
       问的是那个格子还在不在**按得动的那一群**里面。 */
    const stillFree = await page
      .locator("#website-booking button:not([disabled])")
      .filter({ hasText: new RegExp(`^${picked}$`) })
      .count();
    if (stillFree === 0) ok(`刚订走的 ${picked} 现在按不下去了`);
    else no(`刚订走的 ${picked} 还按得下去`, `${stillFree} 颗`);
  }

  /* ── ⑦ 反过来那一半：装修公司的官网上一块都没有 ───────────────────── */
  const r2 = await page.goto(`${BASE}/s/${renoSlug}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  if ((r2?.status() ?? 0) >= 400) {
    no("装修公司的官网打不开", r2?.status());
  } else {
    await page.waitForTimeout(2000);
    const has = await page.locator("#website-booking").count();
    if (has === 0) ok("装修公司的官网上一块都没有 —— 他没有一页在收预约");
    else no("装修公司的官网上画了订时段", has);
    /* 而它退回那张询价表，不是留一个洞。 */
    const form = await page.locator("#website-form, #ask").count();
    if (form > 0) ok("而它退回那张询价表");
    else {
      const { data: saved } = await admin
        .from("project_pages")
        .select("layout_json")
        .eq("project_id", reno.projectId)
        .eq("page_key", "website")
        .single();
      const kinds = (saved?.layout_json?.content ?? []).map((n) => n.type).join(" ");
      no("询价表也不见了 —— 那一页现在没有任何入口", kinds.slice(0, 240) || "(存下来的版面是空的)");
    }
    await page.screenshot({ path: `${OUT}/3-contractor.png`, fullPage: true });
  }
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, salonId);
  await dropThrowaway(admin, renoId);
  for (const id of leadIds) await admin.from("leads").delete().eq("id", id);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
