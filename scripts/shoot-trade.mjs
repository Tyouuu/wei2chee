/**
 * 一门生意开箱长什么样 —— 沙龙 · medi spa · 补习中心，三个宽度各一张。
 *
 * ── 为什么要新的一支（2026-09-09，[任务 318](../docs/founder-tasks.md)）──
 *
 *   `這個禮拜你就處理Saloon Medispa 補習中心三個行業的後台system的Ui設計`
 *
 * `shoot:pages` 拍的是**十八页全开、装修那一套道具**的帐号 —— 那是
 * 「每一页长什么样」的答案，不是「**一间沙龙老板第一天打开看到什么**」。
 * 两件事差得很远：她只有八页、她的货架上是洗发水、她的预约挂着师傅的名字。
 *
 * 这一支做四件 `shoot:pages` 不做的：
 *   ① **只开那个行业开箱的那几页**（从 `module-catalog.ts` 读出来，不手抄）
 *   ② **道具跟着那一行走**（[重点 22d](../docs/founder-points.md)：
 *      一间摆着水泥的发廊，产品一个字都没错而他看到的是坏的）
 *   ③ **他自己的词** —— 客人不叫「客户」，师傅不叫「员工」
 *   ④ 🔴 **三个宽度**（1400 · 820 · 390）—— 平板那一档 2026-09-09 之前
 *      这个仓库一次都没有量过（[任务 317](../docs/founder-tasks.md)）
 *
 * ⚠️ 它**不判好不好看**（[重点 24](../docs/founder-points.md)）。
 * 它只把台面摆好、把图拍出来；判是眼睛的事。
 *
 *   TRADE=salon npm run shoot:trade        # salon · medispa · tuition
 *   TRADE=tuition ONLY=orders,payments npm run shoot:trade
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { moduleLabels, modulesForIndustry, seedEveryShape } from "./lib/seed-demo.mjs";
import { TRADES } from "./lib/trade-props.mjs";

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

const TRADE = process.env.TRADE ?? "salon";
const T = TRADES[TRADE];
if (!T) {
  console.error(`不认得这一行：${TRADE}（${Object.keys(TRADES).join(" · ")}）`);
  process.exit(2);
}

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = `.screenshots/trade/${TRADE}`;
mkdirSync(OUT, { recursive: true });

/* 820 是 iPad 直立。横放 1180 基本上就是桌面，所以不拍 —— 一个跟桌面
   一样的读数，读的人分不出是「量过了」还是「忘了量」。 */
const WIDTHS = [
  [1400, 1000, "desktop"],
  [820, 1180, "ipad"],
  [390, 844, "phone"],
];

const MARK = `ZZ${Date.now().toString().slice(-6)}`;
const EMAIL = `trade-${Date.now()}@formae.test`;
const PASSWORD = `Trade-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* 🔴 服务器没开就不要跑 —— 一份「八页全坏」的报告，跟一份「服务器没开」
   的报告，在画面上长得一模一样，而这个仓库被这种尺子骗过至少四次。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let userId = null;
/* 问卷那一行自己不会跟着帐号走 —— 帐号删掉了它还留着（[任务 165] 那条
   「有没有留下临时帐号」的尺量的就是这一类）。所以记住它，收尾的时候一起删。 */
let leadId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;
const rows = [];

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

  /* 🔴 招牌要走那一支 RPC，不要直接写那张表。
     第一版写的是 `from("projects").update(...)` —— **它不报错，而它一行都没改到**
     （权限那一层拦下来，回的是零行）。於是官网那一页印的是 SQL 里那句后备
     「this business」，而那一句在图上跟一个真的毛病长得一模一样。
     ⚠️ 而且写完要**读回来** —— 一句不看结果的写入，跟一句没有写过的写入，
     在报告里长得一模一样（[任务 182](../docs/founder-tasks.md)）。 */
  const { error: nameErr } = await api.rpc("update_business_identity", {
    new_business_name: T.business,
    new_owner_name: T.owner ?? "Owner",
  });
  const { data: back } = await api.from("projects").select("business_name").single();
  if (nameErr || back?.business_name !== T.business) {
    throw new Error(`招牌没写进去（读回来是 ${JSON.stringify(back?.business_name)}）—— 这一支不拍`);
  }
  await api.rpc("set_project_style", { new_style: "ledger" });

  /* 🔴 **行业在问卷上，不在 projects 上。**
     少了这一段，整个帐号落在**通用**那一份示例上 —— 一间沙龙的总览会印
     「Recent orders · Record 001 · Sample content」，而那三行在图上
     **看起来就是产品坏了**。2026-09-09 我就是这样被自己的图骗过一轮：
     三个行业三张总览全部是通用示例，而我差一点去改产品。
     `audit-product.mjs` 早就把这一句写在它自己那一段上
     （**道具的错会被读成产品的错**），我没有先去读它。
     ⚠️ 用 admin 写 —— `leads` 跟 `accounts.lead_id` 不是客户改得动的东西。 */
  const { data: ind } = await admin.from("industries").select("id").eq("slug", T.industry).single();
  if (!ind?.id) throw new Error(`industries 里没有 ${T.industry}`);
  const { data: lead, error: ldErr } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: `shoot-trade:${TRADE}` } })
    .select("id")
    .single();
  if (ldErr) throw new Error(`lead: ${ldErr.message}`);
  leadId = lead.id;
  const { error: linkErr } = await admin.from("accounts").update({ lead_id: lead.id }).eq("id", userId);
  if (linkErr) throw new Error(`accounts.lead_id: ${linkErr.message}`);
  /* 读回来。一句不看结果的写入，跟一句没有写过的写入，在报告里长得一模一样。 */
  const { data: ctxBack } = await api.rpc("get_my_business_context");
  if (ctxBack?.industry?.slug !== T.industry) {
    throw new Error(`行业没挂上去（读回来是 ${JSON.stringify(ctxBack?.industry?.slug)}）—— 这一支不拍`);
  }

  /* ① 这个行业开箱是哪几页 —— **多的要关掉，少的要开**。
     🔴 注册本身给的是 `other` 那一份（总览 · 客户 · 报价单 · 工程 · 收款 ·
     开销 · 官网）。只「加」不「关」，一间沙龙的侧栏上会挂着**报价单跟工程**
     ——她一辈子不会打开的两页，而那正好会让他讲一句「怎么看起来怪怪的」。 */
  const labels = moduleLabels();
  const keys = modulesForIndustry(T.industry);
  const { data: had } = await api.from("project_pages").select("page_key");
  for (const p of had ?? []) {
    if (keys.includes(p.page_key)) continue;
    const { error } = await api.rpc("remove_project_page", { target_page_key: p.page_key });
    if (error) console.log(`  ⚠️ 关不掉 ${p.page_key} — ${error.message.slice(0, 60)}`);
  }
  const opened = [];
  for (const key of keys) {
    if (!(had ?? []).some((p) => p.page_key === key)) {
      const { error } = await api.rpc("add_project_page", { requested_key: key, new_title: null });
      if (error) {
        console.log(`  ⚠️ 开不了 ${key} — ${error.message.slice(0, 70)}`);
        continue;
      }
    }
    opened.push(key);
  }

  /* ② 他自己的词 —— 客人不叫「客户」，师傅不叫「员工」。
     🔴 要走**改名**那一支，不是开页的时候传标题：`built_in_pages_keep_no_title`
     那条触发器（20260829010000）会在 INSERT 的时候把内建页的标题清成 null，
     **而那是故意的**（少了它，provisioning 会替他写一个他没有选过的名字）。
     一个客户自己改名走的是 UPDATE，那一条不管 —— 所以这里走的就是他走的那条路。 */
  for (const [key, word] of Object.entries(T.words ?? {})) {
    if (!opened.includes(key)) continue;
    const { error } = await api.rpc("rename_project_page", { target_key: key, new_title: word });
    if (error) console.log(`  ⚠️ 改不了 ${key} 的名字 — ${error.message.slice(0, 60)}`);
  }

  /* ② 五行、这一行自己的道具 —— 一页一笔记录判不了设计。 */
  const seeded = await seedEveryShape(api, P, MARK, opened, {
    quiet: true,
    rows: 5,
    showroom: true,
    props: T.props,
  });
  /* 🔴 种不进去的要印出来 —— 一个被吞掉的错，跟一个真的画坏了的设计，
     在图上长得一模一样（`seed-demo.mjs` 自己的档头写过这一条）。 */
  for (const f of seeded.failed ?? []) console.log(`  ⚠️ 种不进 ${f}`);
  console.log(`\n${T.business}（${T.industry}）· 开了 ${opened.length} 页 · 种了：${[...seeded].join(" · ")}\n`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  /* 引导卡关掉、dev 红点藏掉 —— 两样客户看不到，图上也不该有。
     ⚠️ 不用先按一次保存：`front-door.ts` 2026-09-07 之后一进来就是他的系统。 */
  await page.goto(`${BASE}/en/portal/customers`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const gotIt = page.getByRole("button", { name: /got it, hide this/i }).first();
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  await page.waitForTimeout(500);

  const only = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const shooting = only.length ? opened.filter((k) => only.includes(k)) : opened;

  const hide = "nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }";

  console.log("  页            桌面    iPad    手机   标题");
  for (const key of shooting) {
    const row = { key, title: T.words?.[key] ?? labels[key] ?? key };
    for (const [w, h, tag] of WIDTHS) {
      try {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "networkidle", timeout: 120000 });
        await page.waitForTimeout(1100);
        await page.addStyleTag({ content: hide });
        /* 🔴 撑高要分两步 —— 直接量是循环的：那一页是 `min-h-screen`，
           所以「内容有多高」永远等於我设的视窗高。先压矮，量到的才是真的。 */
        await page.setViewportSize({ width: w, height: 520 });
        await page.waitForTimeout(400);
        const real = await page.evaluate(() =>
          Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        );
        /* 官网那一页的段是按视窗高算的，撑视窗会越量越高（实测四万像素）。 */
        const growable = real < 2800 && key !== "website";
        const tall = growable ? Math.min(Math.max(Math.ceil(real) + 32, 700), 2800) : h;
        await page.setViewportSize({ width: w, height: tall });
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${OUT}/${key}-${tag}.png`, fullPage: true });
        const m = await page.evaluate(() => ({
          side: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          h1: document.querySelector("h1")?.textContent?.trim() ?? "",
        }));
        row[tag] = { tall, ...m };
      } catch (e) {
        row[tag] = { failed: String(e).slice(0, 50) };
      }
    }
    rows.push(row);
    const d = row.desktop ?? {};
    const i = row.ipad ?? {};
    const p = row.phone ?? {};
    console.log(
      `  ${key.padEnd(12)}${String(d.tall ?? "—").padStart(6)}${String(i.tall ?? "—").padStart(8)}` +
        `${String(p.tall ?? "—").padStart(8)}   ${d.h1 ?? d.failed ?? ""}`,
    );
  }

  /* 一页一张拼图：三个宽度并排，按同一个高度缩，肉眼一次看得完。 */
  const LABEL = 26;
  for (const row of rows) {
    const parts = [];
    for (const [w, , tag] of WIDTHS) {
      const f = `${OUT}/${row.key}-${tag}.png`;
      if (!existsSync(f)) continue;
      const H = 940;
      const meta = await sharp(f).metadata();
      const crop = Math.min(meta.height, 2000);
      const iw = Math.round(meta.width * (H / crop));
      const img = await sharp(f)
        .extract({ left: 0, top: 0, width: meta.width, height: crop })
        .resize({ width: iw })
        .toBuffer();
      const cap = Buffer.from(
        `<svg width="${iw}" height="${LABEL}"><rect width="100%" height="100%" fill="#0b0d13"/>` +
          `<text x="8" y="18" font-family="monospace" font-size="13" fill="#e6e8ee">${tag} · ${w}px</text></svg>`,
      );
      parts.push(
        await sharp({ create: { width: iw, height: H + LABEL, channels: 3, background: "#0b0d13" } })
          .composite([
            { input: cap, top: 0, left: 0 },
            { input: img, top: LABEL, left: 0 },
          ])
          .png()
          .toBuffer(),
      );
    }
    if (!parts.length) continue;
    const metas = await Promise.all(parts.map((b) => sharp(b).metadata()));
    const gap = 14;
    const sheetW = metas.reduce((a, m) => a + m.width, 0) + gap * (metas.length + 1);
    const sheetH = Math.max(...metas.map((m) => m.height)) + gap * 2;
    let x = gap;
    const layers = parts.map((b, n) => {
      const at = { input: b, top: gap, left: x };
      x += metas[n].width + gap;
      return at;
    });
    await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#0b0d13" } })
      .composite(layers)
      .toFile(`${OUT}/${row.key}-sheet.jpg`);
  }
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
}

console.log(`\n${OUT}/  · 一页一张 <名字>-sheet.jpg`);
