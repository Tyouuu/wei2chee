/**
 * 一个新老板第一次进来，按得动他自己的按钮吗。
 *
 * ── 为什么这一支要存在（2026-09-07）──────────────────────────────────────
 *
 * 老板拍图说「那个说明气泡盖住了 New customer」。把气泡关掉、按钮完全露出来，
 * **按下去还是不动** —— 而这一次不是推论，是浏览器逐字讲的：
 *
 *   找到了：<a href="/en/portal/customers/new">New customer</a>
 *   它的状态：看得见 · 能按 · 位置稳定
 *   然后：那一层「可以拖拉」的包装把点击拦下来了
 *   重试 55 次 · 30 秒 · 一次都没穿过去
 *
 * 挡他的是**画布**，不是气泡。而画布会在那里，是因为一个从来没保存过的
 * 帐号，正门开在编辑器上（`lib/portal/front-door.ts` 那时候的判断）。
 *
 * 🔴 所以这一支量的不是「按钮画出来了没有」，是**按下去有没有走到别的地方**。
 * 一颗画得出来、点得到、而且什么都不会发生的按钮，跟一颗好的按钮，
 * 在截图里长得一模一样 —— 这个仓库禁的第一条就是这个。
 *
 * ⚠️ 它开一个**全新的、一页都没保存过的**帐号 —— 那正是那个洞唯一活着的地方。
 * 拿 demo 帐号跑这一支永远是绿的（它早就保存过了）。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages } from "./lib/seed-demo.mjs";

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
const EMAIL = `door-${Date.now()}@formae.test`;
const PASSWORD = `Door-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* 🔴 服务器没开就不要跑 —— 一份「每一颗都按不动」的报告，跟一份
   「服务器没开」的报告，在输出里长得一模一样。 */
const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
const ok = (name, cond, saw) => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${saw === undefined ? "" : ` — ${saw}`}`); }
};

let userId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  await api.rpc("set_project_style", { new_style: "ledger" });
  const { opened } = await openAllPages(api, { quiet: true });
  if (!opened.includes("customers")) throw new Error("这个帐号没有客户那一页 —— 道具没摆好");

  /* 🔴 一页都不保存。那正是这一支要量的那个状态。 */
  const { data: pages } = await api
    .from("project_pages").select("page_key, layout_json").eq("project_id", proj.id);
  const saved = (pages ?? []).filter(
    (r) => Object.keys((r.layout_json ?? {}))?.length && (r.layout_json?.content?.length ?? 0) > 0,
  );
  console.log(`\n开了 ${opened.length} 页 · 保存过 ${saved.length} 页（要的就是 0）\n`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  console.log("① 一个从来没保存过的新老板，打开客户那一页");
  await page.goto(`${BASE}/en/portal/customers`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(2500);

  const puckChrome = await page.locator("[data-puck-preview]").count();
  ok("打开的是他的系统，不是编辑器", puckChrome === 0, `画布出现 ${puckChrome} 次`);

  const design = page.getByRole("link", { name: /change design|改设计/i }).first();
  ok("「改设计」那一颗在", await design.isVisible().catch(() => false));

  console.log("\n② 🔴 他自己的按钮按得动吗 —— 这一条是这支尺的全部");
  const add = page.getByRole("link", { name: /new customer/i }).first();
  const seen = await add.isVisible().catch(() => false);
  ok("「New customer」画出来了", seen);
  if (seen) {
    const before = page.url();
    await add.click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    ok(
      "🔴 按下去真的走到「加一个客户」那一页",
      /\/customers\/new/.test(page.url()),
      `网址还是 ${page.url() === before ? "原来那一条" : page.url()}`,
    );
  }

  console.log("\n③ 编辑器还进得去，而且回得来");
  await page.goto(`${BASE}/en/portal/customers?design=1`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(3000);
  ok("按了「改设计」才是编辑器", (await page.locator("[data-puck-preview]").count()) > 0);
  const back = page.getByRole("link", { name: /my system|我的系统/i }).first();
  ok("编辑器里那条「← 我的系统」在", await back.isVisible().catch(() => false));

  console.log("\n④ 那张「这是初稿」的黑卡，只在编辑器里出现");
  const noteInEditor = await page.getByText(/starting draft|初稿/i).first().isVisible().catch(() => false);
  ok("编辑器里有（那一屏上真的有一颗 Save design）", noteInEditor);
  await page.goto(`${BASE}/en/portal/customers`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(2000);
  const noteInSystem = await page.getByText(/starting draft|初稿/i).first().isVisible().catch(() => false);
  ok("🔴 他的系统上没有 —— 它叫他按的那颗 Save 不在这一屏上", !noteInSystem);

  /* ── ⑤ 🔴 「改设计」不准压在他的资料上 ─────────────────────────────────
     老板 2026-09-06 拍图：那颗药丸盖住第三行的 `RM 3,400`。
     逐个角量过（`scratchpad/_corner-probe.mjs`，1440×960）：
       payments · 卷到顶 · 右下角 → <TD> In progress · <TD> To do
       customers · 卷到顶 · 左下角 → <A> Reports · <A> Ranking
     **两个角都在盖东西**，盖到哪一样看他卷到哪里 ——
     所以一张截图有时候照得到、有时候照不到，而它因此活了很久。

     ⚠️ 这一条量的不是「它在不在那个位置」，是**它底下有没有东西** ——
     换一个角、换一页、内容长一点，位置那种断言就静静地不再守任何东西。
     两个卷动位置都问，因为这个缺陷只在其中一个出现。 */
  console.log("\n⑤ 🔴 那颗「改设计」有没有压在他的资料上");
  for (const key of ["payments", "customers"]) {
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForTimeout(2500);
    for (const where of ["顶", "底"]) {
      if (where === "底") {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(800);
      }
      const covered = await page.evaluate(() => {
        const pill = [...document.querySelectorAll("a")].find((e) =>
          /change design|改设计/i.test(e.textContent || ""),
        );
        if (!pill) return { none: true };
        const r = pill.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return { hidden: true };
        const hits = new Set();
        for (let fx = 0.1; fx <= 0.9; fx += 0.2)
          for (let fy = 0.25; fy <= 0.75; fy += 0.25)
            for (const el of document.elementsFromPoint(
              r.left + r.width * fx,
              r.top + r.height * fy,
            )) {
              if (el === pill || pill.contains(el) || el.contains(pill)) continue;
              const t = (el.textContent || "").trim();
              if (t && t.length <= 60) hits.add(t);
            }
        return { hits: [...hits].slice(0, 4) };
      });
      if (covered.none || covered.hidden) continue;
      ok(
        `${key} · 卷到${where}：它底下没有别的字`,
        covered.hits.length === 0,
        `盖住 ${JSON.stringify(covered.hits)}`,
      );
    }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass} 过 ${fail} 没过`);
process.exitCode = fail ? 1 : 0;
