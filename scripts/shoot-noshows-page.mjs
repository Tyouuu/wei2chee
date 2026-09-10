/**
 * 谁放过飞机——真的登入、真的看画面。
 *
 *   node scripts/shoot-noshows-page.mjs
 *
 * `no_shows_of`（20260909320000）零个呼叫端——[任务 358] 把「这一单要不要
 * 订金」接上了柜台正在看的那一张预约，「一份名单」这一半没有接。
 * 这一支走一个全新沙龙帐号，一个客人还没放过飞机（不该出现）、
 * 一个放过一次、一个放过两次（排最前面），外加一个空帐号的样子。
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
const OUT = ".screenshots/no-shows";
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
      .waitForURL(/\/portal/, { timeout: 90000 })
      .then(() => true, () => false);
    if (landed) return;
    const said = await page.locator('[role="alert"]').first().innerText().catch(() => "");
    if (said.trim()) throw new Error(`登入被拒：${said.trim()}`);
    await page.waitForSelector("input[type=email]", { timeout: 60000 });
  }
  throw new Error("登入按了三次都没有走到 /portal");
}

try {
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

  const email = `noshowspage-${stamp}@formae.test`;
  const password = `Nsp-${stamp}-x!`;
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
    .update({ business_name: "Lotus Beauty Studio" })
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

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 2,
  });
  await login(page, email, password);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });

  /* ── ① 一个都还没放过飞机 —— 空的样子 ────────────────────────────────── */
  console.log("\n① 一个都还没放过飞机");
  await page.goto(`${BASE}/en/portal/no-shows`, { waitUntil: "domcontentloaded", timeout: 120000 });
  /* 🔴 不能等 `text=Who has missed`——侧栏那一行的连结也写着同一句话，
     而侧栏比这一页的伺服器内容先画出来（中间那一段是 `loading.tsx` 的
     骨架，一片灰盒子，没有字）。等 h1，那才是这一页自己画的抬头。 */
  await page.waitForSelector("h1:has-text('Who has missed')", { timeout: 90000 });
  const body1 = await page.evaluate(() => document.body.innerText);
  check("这一页开得起来", body1.includes("Who has missed"));
  check("空的时候讲一句话，不是一片空白", body1.includes("Nobody has missed an appointment yet."));
  await page.screenshot({ path: `${OUT}/1-empty.jpg`, type: "jpeg", quality: 82, fullPage: true });

  /* ── ② 三个客人：一个没放过、一个放一次、一个放两次 ─────────────────── */
  console.log("\n② 种资料");
  const reliable = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Ong",
  });
  const onceLate = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Tan",
  });
  const twice = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ms Wong",
  });

  const hour = 3600000;
  const past = (h) => new Date(Date.now() - h * hour).toISOString();

  async function booking(partyId, name, startH, status) {
    const id = await say("add_appointment", {
      in_project_id: P,
      in_module_key: "bookings",
      in_starts_at: past(startH),
      in_ends_at: past(startH - 1),
      in_party: name,
      in_party_id: partyId,
      in_service: "Facial",
    });
    await say("set_appointment_status", { in_id: id, in_status: status });
  }

  // Mrs Ong: 全来了，一次都没放过飞机
  await booking(reliable.id, "Mrs Ong", 24, "done");

  // Mr Tan: 来过两次，放过一次 —— 每一笔各自不同的时段，不然撞上排他约束
  await booking(onceLate.id, "Mr Tan", 48, "done");
  await booking(onceLate.id, "Mr Tan", 72, "done");
  await booking(onceLate.id, "Mr Tan", 96, "no_show");

  // Ms Wong: 来过一次，放过两次——最不可靠，该排最前面
  await booking(twice.id, "Ms Wong", 120, "done");
  await booking(twice.id, "Ms Wong", 144, "no_show");
  await booking(twice.id, "Ms Wong", 168, "no_show");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  /* 🔴 不能等 `text=Who has missed`——侧栏那一行的连结也写着同一句话，
     而侧栏比这一页的伺服器内容先画出来（中间那一段是 `loading.tsx` 的
     骨架，一片灰盒子，没有字）。等 h1，那才是这一页自己画的抬头。 */
  await page.waitForSelector("h1:has-text('Who has missed')", { timeout: 90000 });
  const body2 = await page.evaluate(() => document.body.innerText);

  check("🔴 全来了的 Mrs Ong 不出现", !body2.includes("Mrs Ong"), body2.slice(0, 600));
  check("放过一次的 Mr Tan 在，写着 Missed 1 of 3", /Mr Tan[\s\S]{0,60}Missed 1 of 3 visits/.test(body2), body2.slice(0, 600));
  check("放过两次的 Ms Wong 在，写着 Missed 2 of 3", /Ms Wong[\s\S]{0,60}Missed 2 of 3 visits/.test(body2), body2.slice(0, 600));
  check("🔴 放最多次的排最前面（Ms Wong 在 Mr Tan 之前）", /Ms Wong[\s\S]*Mr Tan/.test(body2), body2.slice(0, 600));
  check("讲得出上一次放飞机是几时", body2.includes("Last missed on"));
  check("名字点得进那个客人自己的页", await page.$(`a[href*="/portal/customers/${twice.id}"]`) !== null);

  await page.screenshot({ path: `${OUT}/2-seeded.jpg`, type: "jpeg", quality: 82, fullPage: true });

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
