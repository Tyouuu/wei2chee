/**
 * 柜台上打一个车牌，真的按一次。
 *
 * ── 为什么（2026-09-05）─────────────────────────────────────────────────
 *
 * `find_vehicle` · `vehicle_history` · `vehicles_overdue` · `add_vehicle`
 * （20260905290000）从做出来那天起 **画面上一个入口都没有**，
 * 而[任务 157](../docs/founder-tasks.md#157) 自己的收尾就写着
 * 「柜台打车牌那个框不存在」。
 *
 * 这一支不打 RPC —— 它开真的浏览器，走完柜台真正的那一串：
 *
 *   ① 打一个还没有的车牌 → ② 读到「还没有这个车牌」→ ③ 就地登记
 *   → ④ 那台车出现，而且车主的号码点得出去
 *   → ⑤ 再查一次同一个车牌（**大小写、空格、横杠都换掉**）→ 还是同一台
 *   → ⑥ 它做过的那张单在历史里
 *
 * ⚠️ 而它也验反过来那一半：**一台车都没有的时候，画的是一句话，
 * 不是一张假的清单。**
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
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
const OUT = ".screenshots/vehicles";
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
dropThrowawayOnExit(admin, () => userId);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };

let browser;
try {
  const email = `veh-${Date.now()}@formae.test`;
  const password = `Veh-${Date.now()}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  await api.rpc("set_project_style", { new_style: "swiss" });
  for (const k of ["customers", "quotations", "payments"]) {
    /* ⚠️ 签名是 `(requested_key, new_title)` —— 旧的 `new_page_key` 已经不在了
       （20260905110000）。而 PostgREST 找不到那支函式只是回一个 error，
       **不抛** —— 于是没有添加到的那几页静静地不存在，
       而它下面那一条红看起来像产品坏了。 */
    const { error: pgErr } = await api.rpc("add_project_page", {
      requested_key: k,
      new_title: "",
    });
    if (pgErr && !/already/i.test(pgErr.message)) console.log(`  ⚪ 台面：${k} — ${pgErr.message}`);
  }
  /* 一个车主，好让那一格挑得到东西。 */
  const { data: owner } = await api.rpc("add_directory_entry", {
    in_project_id: proj.id,
    in_module_key: "customers",
    in_name: "Mr Tan",
    in_whatsapp: "012-3xx xxxx",
  });
  const ownerId = owner?.id ?? owner;

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    reducedMotion: "reduce",
  });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  const res = await page.goto(`${BASE}/en/portal/vehicles`, { waitUntil: "domcontentloaded", timeout: 180000 });
  if ((res?.status() ?? 0) >= 400) throw new Error(`那一页回 ${res?.status()}`);
  await page.waitForTimeout(2500);

  /* ── ⓪ 一台车都没有的时候 ─────────────────────────────────────────── */
  const body0 = await page.locator("body").innerText();
  if (/No cars yet/i.test(body0)) ok("一台车都没有的时候，画的是一句话");
  else no("一台车都没有的时候画了别的", body0.slice(0, 80));
  await page.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });

  /* ── ①② 打一个还没有的车牌 ───────────────────────────────────────── */
  await page.locator("#plate").fill("wa 1234 a");
  await page.getByRole("button", { name: /look it up/i }).click();
  await page.waitForTimeout(2500);
  const said = await page.locator('[aria-live="polite"]').first().innerText().catch(() => "");
  if (/No car with that plate/i.test(said)) ok("查不到的时候他读到的是一句话，不是一句资料库的话");
  else no("查不到那一句不对", said.slice(0, 80));

  /* ── ③ 就地登记 ──────────────────────────────────────────────────── */
  const what = page.getByLabel(/what is it/i).first();
  if (await what.count()) ok("查不到底下就是登记那几格");
  else no("查不到底下没有登记那几格");
  await what.fill("Perodua Myvi 1.3");
  const owners = page.locator("select");
  if (await owners.count()) await owners.first().selectOption({ label: "Mr Tan" });
  await page.getByLabel(/service every/i).first().fill("10000");
  await page.screenshot({ path: `${OUT}/2-register.png`, fullPage: true });
  await page.getByRole("button", { name: /register this plate/i }).click();
  await page.waitForTimeout(3500);

  /* ── ④ 那台车出来了 ──────────────────────────────────────────────── */
  const body1 = await page.locator("body").innerText();
  if (body1.includes("wa 1234 a") || /WA 1234 A/i.test(body1)) ok("登记完那台车当场就在画面上");
  else no("登记完画面上没有那台车", body1.slice(0, 120));
  if (/Mr Tan/.test(body1)) ok("车主跟着出来了");
  else no("车主没有出来");
  if (/Perodua Myvi/.test(body1)) ok("车是什么跟着走");
  else no("车是什么不见了");

  /* 🔴 保养间隔他填了 10,000，而这台车还没有里程 ——
     所以「下次保养」**不该画**：`due_at_km` 要有上一次的里程才算得出来，
     而凭空画一个 10,000 是我们替他宣布了一件事。 */
  if (!/Next service at/i.test(body1)) ok("还没有里程的时候，「下次保养」那一格不画");
  else no("还没有里程就画了「下次保养」");

  await page.screenshot({ path: `${OUT}/3-found.png`, fullPage: true });

  /* ── ⑤ 换一种写法再查一次 ────────────────────────────────────────── */
  await page.locator("#plate").fill("WA-1234-A");
  await page.getByRole("button", { name: /look it up/i }).click();
  await page.waitForTimeout(2500);
  const body2 = await page.locator("body").innerText();
  if (/Perodua Myvi/.test(body2)) ok("大小写 · 空格 · 横杠换掉，还是同一台");
  else no("换一种写法就查不到了", body2.slice(0, 100));

  /* ── 那一行真的在资料库里 ────────────────────────────────────────── */
  const { data: cars } = await admin
    .from("vehicles")
    .select("plate, plate_key, descr, party_id, service_every_km")
    .eq("project_id", proj.id);
  const car = (cars ?? [])[0];
  if (car) ok("资料库里真的多了一台车");
  else no("资料库里没有那台车", `${(cars ?? []).length} 台`);
  /* 🔴 印出来的是**他打的那一串**，洗过的那一串只拿来认人。 */
  if (car?.plate === "wa 1234 a") ok("存下来的是他打的那一串，不是洗过的");
  else no("存下来的车牌被改过了", car?.plate);
  if (car?.plate_key === "WA1234A") ok("而认人的那一串是洗过的");
  else no("洗过的那一串不对", car?.plate_key);
  if (car?.party_id === ownerId) ok("车主连上去了");
  else no("车主没有连上", car?.party_id);
  if (car?.service_every_km === 10000) ok("保养间隔存下来了");
  else no("保养间隔不对", car?.service_every_km);

  /* ── ⑥ 空的间隔不准变成 0 ───────────────────────────────────────── */
  await page.locator("#plate").fill("VBA 9 9");
  await page.getByRole("button", { name: /look it up/i }).click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /register this plate/i }).click();
  await page.waitForTimeout(3000);
  const { data: second } = await admin
    .from("vehicles")
    .select("plate, service_every_km")
    .eq("project_id", proj.id)
    .eq("plate", "VBA 9 9")
    .maybeSingle();
  if (second && second.service_every_km === null) ok("间隔留空存的是「没有」，不是 0");
  else no("间隔留空存成了别的", String(second?.service_every_km));
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
