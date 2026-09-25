/**
 * 走单轮位 —— 真的登入、真的按「接这一位」、真的看她排到队尾去。
 *
 *   npm run shoot:walkin
 *
 * 🔴 资料库那一层 `check:walkin` 已经量过（真登入 · 真呼叫）。这一支量的是
 * **另一件**：那四支到不到得了柜台眼前（[重点 7l](../docs/founder-points.md)：
 * 数字全绿而画面是坏的，这个仓库发生过十几次）。[任务 354] 自己的规格写着
 * 「走单轮位画面 —— 规格写好了，画面还没有。」
 *
 * 走的是整条线，不是只按 RPC：
 *   开两位师傅 → 打开走单轮位 → 两个都还没接过，按名字排 →
 *   按「接这一位」→ 排到队尾去，字变成「Last turn」→
 *   按「先下去」→ 掉到「暂时不算」那一段 → 按「回来」→ 回到轮子里
 */
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { dropThrowawayOnExit, dropThrowaway } from "./lib/throwaway.mjs";

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
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/walkin";
mkdirSync(OUT, { recursive: true });

let pass = 0;
const bad = [];
const check = (what, ok, saw) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${what}`);
  } else {
    bad.push(what);
    console.log(`  FAIL  ${what}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

const stamp = Date.now();
let ownerId = null;
let browser = null;
dropThrowawayOnExit(admin, () => ownerId);

async function login(page, email, password) {
  await page
    .goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 })
    .catch(() => page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 90000 }));
  await page.waitForSelector("input[type=email]", { timeout: 60000 });
  for (let go = 0; go < 3; go++) {
    await page.fill("input[type=email]", email);
    await page.fill("input[type=password]", password);
    await page.click("button[type=submit]");
    const landed = await page
      .waitForURL(/\/(portal|salon-preview)/, { timeout: 90000 })
      .then(() => true, () => false);
    if (landed) return;
    const said = await page.locator('[role="alert"]').first().innerText().catch(() => "");
    if (said.trim()) throw new Error(`登入被拒：${said.trim()}`);
    await page.waitForSelector("input[type=email]", { timeout: 60000 });
  }
  throw new Error("登入按了三次都没有走到 /portal");
}

try {
  /* ── 台面：一间沙龙，两位师傅 ────────────────────────────────────────── */
  const { data: ind } = await admin
    .from("industries")
    .select("id")
    .eq("slug", "beauty")
    .single();
  const { data: lead } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: {} })
    .select("id")
    .single();

  const email = `walkinshot-${stamp}@formae.test`;
  const password = `Ws-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { lead_id: lead.id },
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  ownerId = made.user.id;

  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", ownerId)
    .single();
  const P = proj.id;
  await admin
    .from("projects")
    .update({ business_name: "Bella Hair Studio" })
    .eq("id", P);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  const say = async (fn, args) => {
    const { data, error } = await c.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  await say("add_project_page", { requested_key: "staff", new_title: "Staff" });
  await say("add_project_page", { requested_key: "bookings", new_title: "Bookings" });

  const amy = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Amy",
  });
  const jasmine = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Jasmine",
  });

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 2,
  });
  await login(page, email, password);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });

  /* ── ① 两个都还没接过 —— 按名字排 ────────────────────────────────────── */
  console.log("\n① 两个都还没接过");
  await page.goto(`${BASE}/en/portal/walkin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("text=Walk-in queue", { timeout: 90000 });
  const body1 = await page.evaluate(() => document.body.innerText);
  check("侧栏 · 标题都在", body1.includes("Walk-in queue"));
  check("两位都在，Amy 先（按名字排）", /Amy[\s\S]*Jasmine/.test(body1), body1.slice(0, 300));
  check("两位都写着「还没接过」", (body1.match(/Never yet/g) ?? []).length === 2);
  /* 🔴 `text-transform:uppercase` 是 CSS 画的，`innerText` 照浏览器画出来的
     样子读，所以读到的是「UP NEXT」不是原始字串「Up next」——
     这条不分大小写，量的是「有没有那句话」，不是它的大小写。 */
  check("Amy 那一行标着「Up next」", /Amy[\s\S]{0,80}up next/i.test(body1));
  await page.screenshot({ path: `${OUT}/1-both-never.jpg`, type: "jpeg", quality: 82, fullPage: true });

  /* ── ② 按「接这一位」—— 排到队尾去 ───────────────────────────────────── */
  console.log("\n② 接 Amy 这一位");
  await page.click('li:has-text("Amy") >> button:has-text("Take this turn")');
  await page
    .waitForFunction(
      () => /Jasmine[\s\S]*Amy/.test(document.body.innerText),
      undefined,
      { timeout: 30000 },
    )
    .catch(() => {});
  const body2 = await page.evaluate(() => document.body.innerText);
  check("🔴 接完 Amy 排到队尾，Jasmine 变成 Up next", /Jasmine[\s\S]*Amy/.test(body2), body2.slice(0, 300));
  check("Amy 那一行不再写「还没接过」，写着上一次几点", /Amy[\s\S]{0,40}Last turn \d/.test(body2), body2.slice(0, 300));
  const q = await say("walkin_queue_of", { in_project_id: P });
  check(
    "资料库里也是同一个顺序",
    q[0]?.name === "Jasmine" && q[1]?.name === "Amy",
    JSON.stringify(q.map((r) => r.name)),
  );
  await page.screenshot({ path: `${OUT}/2-after-take.jpg`, type: "jpeg", quality: 82, fullPage: true });

  /* ── ③ 「先下去」—— 掉到「暂时不算」 ──────────────────────────────────── */
  console.log("\n③ Jasmine 先下去");
  await page.click('li:has-text("Jasmine") >> button:has-text("Step out")');
  await page
    .waitForFunction(() => document.body.innerText.includes("Stepped out"), undefined, { timeout: 30000 })
    .catch(() => {});
  const body3 = await page.evaluate(() => document.body.innerText);
  check("🔴 Jasmine 步出轮子，Amy 变成轮子里唯一一个、Up next", /Amy[\s\S]{0,80}up next/i.test(body3), body3.slice(0, 300));
  check("Jasmine 出现在「Stepped out」底下", /Stepped out[\s\S]*Jasmine/.test(body3), body3.slice(0, 400));
  const off = await say("set_walkin_available", { in_staff_id: amy.id, in_available: true });
  check("Amy 还在轮子里（true）", off?.walkin_available === true);
  await page.screenshot({ path: `${OUT}/3-stepped-out.jpg`, type: "jpeg", quality: 82, fullPage: true });

  /* ── ④ 「回来」—— 回到轮子里 ─────────────────────────────────────────── */
  console.log("\n④ Jasmine 回来");
  await page.click('li:has-text("Jasmine") >> button:has-text("Back in")');
  await page
    .waitForFunction(() => !document.body.innerText.includes("Stepped out"), undefined, { timeout: 30000 })
    .catch(() => {});
  const body4 = await page.evaluate(() => document.body.innerText);
  check("🔴 Jasmine 回到轮子里，「Stepped out」那一段整段不见了", !body4.includes("Stepped out"), body4.slice(0, 300));
  await page.screenshot({ path: `${OUT}/4-back-in.jpg`, type: "jpeg", quality: 82, fullPage: true });

  /* ── ⑤ 手机宽 ─────────────────────────────────────────────────────────── */
  console.log("\n⑤ 390");
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await login(phone, email, password);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await phone.goto(`${BASE}/en/portal/walkin`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await phone.waitForSelector("text=Walk-in queue", { timeout: 90000 });
  const noScrollX = await phone.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  check("390 上没有横滚", noScrollX);
  await phone.screenshot({ path: `${OUT}/5-phone-390.jpg`, type: "jpeg", quality: 82, fullPage: true });
  await phone.close();

  await page.close();
} catch (e) {
  bad.push(String(e?.message ?? e));
  console.log(`\n🔴 ${e?.message ?? e}`);
} finally {
  if (browser) await browser.close();
  const cleared = await dropThrowaway(admin, ownerId);
  console.log(cleared ? "\n临时帐号删掉了" : "\n🔴 删不掉");
}

console.log(`\n判：${pass} 过 · ${bad.length} 没过`);
if (bad.length) {
  for (const x of bad) console.log(`  · ${x}`);
  process.exitCode = 1;
}
