/**
 * 产品那一边的全面 UI 排查 —— **他每天打开的那几十页，一页都不漏**。
 *
 * ── 它跟已经有的那几把不一样在哪 ────────────────────────────────────────
 *
 *   walk:customer    一天的事**走不走得通**（按了有没有反应）
 *   walk:friction    同一条路**顺不顺**（等多久 · 打几个字）
 *   walk:eyesight    他的**眼睛跟手指**过不过得去 —— 而它只走六页
 *   walk:stranger    **他客人那一边**三条路
 *   check:reachable  点不点得到 —— 走一份写死的清单
 *   🔴 这一支         **产品的每一页**，一次问完上面那几件
 *
 * 页面清单**从档案夹跟目录读出来**，不手抄 —— 手抄的那一份会活得比它描述的
 * 东西久（这个仓库栽在「第二份手写清单」上至少八次）。
 *
 * ⚠️ 平台那几页不在里面（素材库 · 模板库 · 版段库 · 风格 · 需求书 · 帐号）——
 * 他 2026-09-08 讲的是**产品本身**。
 *
 * ⚠️ 它**不判好不好看**。数字只能否决（[重点 24]）；通过要看它拍下来那几张。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { AUDIT } from "./lib/ui-probe.mjs";
import { moduleLabels, openAllPages, seedEveryShape } from "./lib/seed-demo.mjs";
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
const OUT = ".screenshots/product";
mkdirSync(OUT, { recursive: true });

/* 平台那几页 —— 他问的是产品，而这几页是我们卖东西的工具。 */
const PLATFORM = new Set(["library", "templates", "sections", "styles", "spec", "account"]);
const TOOLS = readdirSync("app/[locale]/portal/(app)", { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("__") && !PLATFORM.has(d.name))
  .map((d) => d.name);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* 🔴 服务器没开就不要跑 —— 一份「每一页全坏」的报告，跟一份「服务器没开」
   的报告，在画面上长得一模一样，而这个仓库被这种尺子骗过至少四次。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

/* 高 · 底下留白 · 被切断的句子 · 同一屏重复的标题 —— AUDIT 不管的那几件。 */
const SHAPE = () => {
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width >= 1 && r.height >= 1 && s.visibility !== "hidden" && s.display !== "none";
  };
  /* 主栏，不含侧栏 —— 侧栏比内容高是常态，把它算进去每一页都会报「底下一片空」。 */
  const main = document.querySelector("main") || document.body;
  const kids = [...main.querySelectorAll("*")].filter(seen);
  const bottom = kids.reduce((a, el) => Math.max(a, el.getBoundingClientRect().bottom), 0);
  const gap = Math.round(main.getBoundingClientRect().bottom - bottom);

  /* 一句话被切在中间 —— 一个用省略号收尾的**句子**读起来是坏的
     （一个被切断的名字不是，所以只数四个词以上的）。 */
  const cut = [];
  for (const el of kids) {
    const s = getComputedStyle(el);
    const clamped = /line-clamp/.test(String(el.className || ""));
    if (s.textOverflow !== "ellipsis" && !clamped) continue;
    if (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) continue;
    const t = (el.innerText || "").trim();
    if (t.split(/\s+/).length < 4) continue;
    cut.push(t.slice(0, 44));
  }

  /* 同一屏上同一句标题印两次。 */
  const heads = [...main.querySelectorAll("h1,h2,h3")]
    .filter(seen)
    .map((h) => h.innerText.trim().toLowerCase())
    .filter(Boolean);
  const dup = [...new Set(heads.filter((h, i) => heads.indexOf(h) !== i))];

  return {
    height: Math.round(document.documentElement.scrollHeight),
    gap,
    cut,
    dup,
    h1: [...document.querySelectorAll("h1")].filter(seen).map((h) => h.innerText.trim().slice(0, 40)),
  };
};

let userId = null;
let browser;
dropThrowawayOnExit(admin, () => userId);
const rows = [];

try {
  const EMAIL = `audit-${Date.now()}@formae.test`;
  const PASSWORD = `Audit-${Date.now()}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const P = proj?.id;
  if (!P) throw new Error("注册没有开出一个 project");

  /* 🔴 行业在问卷上，不在 projects 上 —— 少了它整个帐号落在通用示例上
     （Record 001 / Sample content），而**道具的错会被读成产品的错**。 */
  const { data: ind } = await admin.from("industries").select("id").eq("slug", "renovation").single();
  if (!ind?.id) throw new Error("industries 里没有 renovation");
  const { data: lead, error: ldErr } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "audit-product" } })
    .select("id")
    .single();
  if (ldErr) throw new Error(`lead: ${ldErr.message}`);
  const { error: linkErr } = await admin.from("accounts").update({ lead_id: lead.id }).eq("id", userId);
  if (linkErr) throw new Error(`accounts.lead_id: ${linkErr.message}`);
  const { error: bnErr } = await admin
    .from("projects")
    .update({ business_name: "Hin Fatt Renovation", system_language: "en" })
    .eq("id", P);
  if (bnErr) throw new Error(`business_name: ${bnErr.message}`);

  /* 🔴 挑过一套风格 —— 少了它，`[pageKey]/page.tsx` 会把十八个模块页
     **全部导去「挑一套风格」**，而尺子会一本正经地量那一页十八次。
     2026-09-08 第一次跑就踩到：三十二张图里十八张是同一张挑风格的页。
     **道具没摆好跟产品坏了，在报告里长得一模一样。** */
  const { error: styErr } = await api.rpc("set_project_style", { new_style: "swiss" });
  if (styErr) throw new Error(`set_project_style: ${styErr.message}`);

  const MARK = `ZZ${Date.now().toString().slice(-6)}`;
  const { opened } = await openAllPages(api, { quiet: true });
  const seeded = await seedEveryShape(api, P, MARK, opened, { quiet: true, rows: 5, showroom: true });
  const labels = moduleLabels();
  console.log(`开了 ${opened.length} 页 · 种了 ${seeded.size} 种零件的真资料`);

  /* 一张真的单，好走记录页。 */
  const { data: recs } = await api.from("pipeline_records").select("id,page_key").limit(1);
  const oneRec = recs?.[0];

  const URLS = [
    ...opened.map((k) => ({ name: labels[k] ?? k, url: `/en/portal/${k}` })),
    ...TOOLS.map((t) => ({ name: t, url: `/en/portal/${t}` })),
    { name: "开一张单", url: `/en/portal/${oneRec?.page_key ?? "quotations"}/new` },
    ...(oneRec ? [{ name: "打开那一单", url: `/en/portal/${oneRec.page_key}/${oneRec.id}` }] : []),
  ];

  browser = await chromium.launch();
  for (const width of [1400, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: width === 1400 ? 2 : 1,
    });
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/portal/, { timeout: 180000 });

    for (const { name, url } of URLS) {
      let res;
      try {
        res = await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 120000 });
      } catch {
        rows.push({ width, name, url, failed: "载不出来" });
        continue;
      }
      if (!res || res.status() >= 400) {
        rows.push({ width, name, url, failed: `回 ${res ? res.status() : "?"}` });
        continue;
      }
      await page.waitForTimeout(1400);
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      /* 🔴 走到的是不是它自己 —— 一次重导，读到的每一个数字都是别一页的。 */
      const landed = page.url();
      if (!landed.includes(url)) {
        rows.push({ width, name, url, failed: `被导去 ${landed.split("/").slice(3).join("/")}` });
        continue;
      }
      const a = await page.evaluate(AUDIT);
      const s = await page.evaluate(SHAPE);
      rows.push({ width, name, url, ...a, ...s });
      if (width === 1400) {
        const slug = url.split("/").filter(Boolean).slice(2).join("-") || "home";
        await page.screenshot({ path: `${OUT}/${slug}.png` });
      }
    }
    await page.close();
  }
} finally {
  await browser?.close();
  if (userId) await dropThrowaway(admin, userId);
}

/* ── 印出来 ──────────────────────────────────────────────────────────── */
const bad = (r) =>
  (r.text?.length ?? 0) +
  (r.boxes?.length ?? 0) +
  (r.dead?.length ?? 0) +
  (r.cjk?.length ?? 0) +
  (r.cut?.length ?? 0) +
  (r.dup?.length ?? 0) +
  (r.taps?.length ?? 0) +
  (r.sideways > 1 ? 1 : 0);

for (const width of [1400, 390]) {
  console.log(`\n== ${width}px ==`);
  console.log("  页                     高  底空 字<4.5 框<3 死链 中文 切断 重标 横滚 拇指");
  for (const r of rows.filter((x) => x.width === width)) {
    if (r.failed) {
      console.log(`  🔴 ${r.name.slice(0, 21).padEnd(22)}${r.failed}`);
      continue;
    }
    const c = (n) => (n ? String(n).padStart(5) : "    ·");
    console.log(
      `  ${r.name.slice(0, 21).padEnd(22)}${String(r.height).padStart(5)}${String(r.gap).padStart(6)}` +
        `${c(r.text.length)}${c(r.boxes.length)}${c(r.dead.length)}${c(r.cjk.length)}` +
        `${c(r.cut.length)}${c(r.dup.length)}${c(r.sideways > 1 ? r.sideways : 0)}${c(r.taps.length)}`,
    );
  }
}

console.log("\n-- 逐项，只印有东西的 --");
for (const r of rows) {
  if (r.failed || !bad(r)) continue;
  console.log(`\n  ${r.name}  ${r.width}px  ${r.url}`);
  for (const t of (r.text ?? []).slice(0, 6)) console.log(`    字 ${t.rt}:1（要 ${t.need}）${t.px}px  「${t.t}」`);
  for (const b of (r.boxes ?? []).slice(0, 6)) console.log(`    框 ${b.rt}:1（要 3）  「${b.label}」`);
  for (const d of (r.dead ?? []).slice(0, 6)) console.log(`    死链 ${d.h}  「${d.t}」`);
  for (const c of (r.cjk ?? []).slice(0, 4)) console.log(`    中文  「${c}」`);
  for (const c of (r.cut ?? []).slice(0, 4)) console.log(`    切断  「${c}」`);
  for (const d of (r.dup ?? []).slice(0, 4)) console.log(`    重标题「${d}」`);
  if (r.sideways > 1) console.log(`    横滚 ${r.sideways}px`);
  for (const t of (r.taps ?? []).slice(0, 6)) console.log(`    拇指 ${t.w}x${t.h}（旁边 ${t.near}）「${t.t}」`);
}

const tot = (k) => rows.reduce((a, r) => a + (r[k]?.length ?? 0), 0);
console.log(`\n判：走了 ${rows.filter((r) => r.width === 1400).length} 页 × 两个宽度`);
console.log(
  `    载不出来 ${rows.filter((r) => r.failed).length} · 字读不到 ${tot("text")} · 框看不见 ${tot("boxes")} · 死链 ${tot("dead")}`,
);
console.log(
  `    中文 ${tot("cjk")} · 切断的句子 ${tot("cut")} · 重复的标题 ${tot("dup")} · 拇指按不稳 ${tot("taps")}`,
);
console.log(
  `    横滚 ${rows.filter((r) => r.sideways > 1).length} 页 · 没有名字的框 ${tot("unnamed")}`,
);
console.log(`\n⚠️ 这一支只能否决。图在 ${OUT}/，好不好看要用眼睛看那几张。`);
