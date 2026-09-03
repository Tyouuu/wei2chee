/**
 * 改前改后的轨迹 —— 用眼睛看。
 *
 * 重点 7l。189 条真的呼叫全过，而那些是打 RPC 看资料库；
 * 那一段在画面上长什么样、翻不翻得成人话、他读不读得懂，那些答不了。
 *
 * 拍三张：改过两次的一张单 · 一张没有人改过的 · 390 宽。
 * ⚠️ 跑完把道具删掉。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/change-trail";
mkdirSync(OUT, { recursive: true });

const EMAIL = "tianyou.demo@formae.test";
const PASSWORD = "FormaeDemo2026!";

const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const shots = [];
const made = [];

async function shoot(page, path, name) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const h1 = await page.locator("h1").first().innerText().catch(() => "");
  const stuck =
    /log in|sign in|登入/i.test(h1) || /something broke|does not exist|坏了|不存在/i.test(h1);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const body = await page.locator("main").first().innerText().catch(() => "");
  shots.push({ name, stuck });
  console.log(`${stuck ? "🔴 卡住" : "拍到"}  ${name}  · h1「${h1}」`);
  return body;
}

let browser;
try {
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();

  const { data: job, error: jErr } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id, in_module_key: "quotations",
    in_title: "Kitchen, first quote", in_party: "Mr Tan", in_amount_cents: 4_800_000,
  });
  if (jErr) throw new Error(`job: ${jErr.message}`);
  made.push(job.id);
  /* 两次改动：一次改钱跟名字，一次只改进度。 */
  await api.rpc("update_pipeline_record", {
    in_id: job.id, in_title: "Kitchen, after he cut it down", in_amount_cents: 3_800_000,
  });
  await api.rpc("update_pipeline_record", { in_id: job.id, in_stage: "Confirmed" });

  const { data: clean } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id, in_module_key: "quotations",
    in_title: "Nobody has touched this one", in_amount_cents: 900_000,
  });
  made.push(clean.id);

  browser = await chromium.launch();
  const wide = await browser.newPage({ viewport: { width: 1440, height: 1300 } });
  await wide.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.fill('input[type="email"]', EMAIL);
  await wide.fill('input[type="password"]', PASSWORD);
  await wide.click('button[type="submit"]');
  await wide.waitForURL(/portal/, { timeout: 180000 });

  const changed = await shoot(wide, `/en/portal/quotations/${job.id}`, "1-changed-twice");
  const untouched = await shoot(wide, `/en/portal/quotations/${clean.id}`, "2-untouched");

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await shoot(phone, `/en/portal/quotations/${job.id}`, "3-phone-390");

  const say = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
    if (!ok) shots.push({ name, stuck: true });
  };
  const flat = changed.replace(/\s+/g, " ");
  /* ⚠️ 只看那一段。第一版拿整页去找 `stage`，而它打中的是分期表底下那颗
     「Add a stage」—— 一个跟这一段无关的字。**同一天第四次量错东西。** */
  const trail = flat.slice(flat.indexOf("What was changed")).slice(0, 600);
  say("那一段在画面上", /What was changed/i.test(changed), flat.slice(0, 200));
  /* 🔴 存的是 4800000，而他读的是 RM 48,000。一本印着 sen 的帐没有人读。 */
  say("金额翻成他读得懂的钱（不是 4800000）",
    /RM 48,000/.test(flat) && /RM 38,000/.test(flat) && !/4800000/.test(flat),
    flat.slice(0, 600));
  say("讲得出从什么变成什么", /RM 48,000 → RM 38,000/.test(flat), flat.slice(0, 600));
  /* 栏位名要用那一页自己的词，不是资料库的栏名。 */
  say("栏位讲的是他的词，不是 amount_cents",
    trail.length > 20 && !/amount_cents|\btitle\b/.test(trail) && /Quoted RM/.test(trail),
    trail);
  say("没有人改过的那一张，讲的是「还没有人改过」不是一片空白",
    /Nobody has changed this one yet/i.test(untouched),
    untouched.replace(/\s+/g, " ").slice(0, 300));
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  shots.push({ name: err.message, stuck: true });
} finally {
  for (const id of made) await api.from("pipeline_records").delete().eq("id", id);
  console.log("\n(道具清掉了)");
  if (browser) await browser.close();
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${bad.length} 项没过`);
if (bad.length) for (const b of bad) console.log(`  · ${b.name}`);
process.exit(bad.length ? 1 : 0);
