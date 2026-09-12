/**
 * 她说了什么 —— 老板看得到那份清单了。真登入，真按，真截图。
 *
 * ── 为什么（2026-09-12，[任务 371/397]）─────────────────────────────────
 *
 * `reviews_of` 从做出来那天起零个呼叫端。这一支验证新的 `(app)/reviews`
 * 页：清单画得出来 · 找人／筛星等（[重点 36]）· 「允许给别人看」那颗
 * 按钮真的写回资料库。
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
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
const OUT = ".screenshots/reviews-page";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
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
  const stamp = Date.now();
  const email = `reviewpage-${stamp}@formae.test`;
  const password = `Rp-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;

  for (const k of ["customers", "bookings", "staff"]) {
    const { error: pgErr } = await api.rpc("add_project_page", { requested_key: k, new_title: "" });
    if (pgErr && !/already/i.test(pgErr.message)) no(`台面：${k} 那一页开不了`, pgErr.message);
  }

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: "reduce" });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  // ── ① 一句都还没有——整段讲一句话，不是空的清单 ────────────────────────
  await page.goto(`${BASE}/en/portal/reviews`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(1800);
  let body = await page.locator("body").innerText();
  if (/Nobody has left a review yet/i.test(body)) ok("一句都还没有的时候，画的是一句话");
  else no("空的时候画了别的", body.slice(0, 200));
  await page.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });

  // ── ② 种七位客人各留一句，够到「超过六句才画筛选」那一条门槛 ──────────
  const names = [
    ["Ms Gita", "Botox", 5, "Very gentle, will come back."],
    ["Ms Farah", "Facial", 4, "Good but a bit rushed."],
    ["Ms Wong", "Laser", 2, "Waited too long."],
    ["Mr Tan", "Botox", 5, "Excellent, painless."],
    ["Ms Lim", "Facial", 3, ""],
    ["Ms Nur", "Chemical peel", 5, "Loved it."],
    ["Mdm Chong", "Botox", 1, "Won't return."],
  ];
  const ids = [];
  let hourOffset = 0;
  for (const [party, service, rating, text] of names) {
    /* 🔴 没有指师傅的时候，整间店同一个时段只排得下一笔（[任务 339]）——
       七笔各错开一个小时，不然第二笔起全部会被排他约束挡下来。 */
    const start = Date.now() - 3 * 864e5 + hourOffset * 36e5;
    hourOffset += 1;
    const { data: appt, error: aErr } = await api.rpc("add_appointment", {
      in_project_id: pid,
      in_module_key: "bookings",
      in_starts_at: new Date(start).toISOString(),
      in_ends_at: new Date(start + 30 * 60e3).toISOString(),
      in_party: party,
      in_service: service,
    });
    if (aErr) { no(`台面：${party} 那一笔开不了`, aErr.message); continue; }
    const id = appt?.id ?? appt;
    ids.push(id);
    const { error: upErr } = await admin
      .from("appointments")
      .update({
        review_rating: rating,
        review_text: text,
        review_submitted_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (upErr) no(`台面：${party} 的评价写不进去`, upErr.message);
  }

  body = await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 })
    .then(() => page.waitForTimeout(1800))
    .then(() => page.locator("body").innerText());
  if (/Mdm Chong/.test(body) && /Ms Gita/.test(body)) ok("七句评价都出现在清单上");
  else no("清单没有全部出现", body.slice(0, 300));
  if (/Won't return/.test(body)) ok("差评的字原样出现，没有被过滤或美化");
  else no("差评的字不见了", body.slice(0, 300));

  const searchBox = page.getByPlaceholder("Find a customer or service...");
  if ((await searchBox.count()) > 0) ok("🔴 超过六句，找人／筛星等那两格画出来了");
  else no("🔴 超过六句却没有画筛选那两格", body.slice(0, 200));
  await page.screenshot({ path: `${OUT}/2-seven-reviews.png`, fullPage: true });

  // ── ③ 找人 ──────────────────────────────────────────────────────────────
  await searchBox.fill("Gita");
  await page.waitForTimeout(300);
  body = await page.locator("body").innerText();
  if (/Ms Gita/.test(body) && !/Mdm Chong/.test(body)) ok("🔴 按名字找，只剩她一个");
  else no("🔴 找人之后清单不对", body.slice(0, 300));
  await searchBox.fill("");

  // ── ④ 筛星等——只看 5 星 ──────────────────────────────────────────────
  const select = page.locator("select").first();
  await select.selectOption("5");
  await page.waitForTimeout(300);
  body = await page.locator("body").innerText();
  const fiveStarNames = ["Ms Gita", "Mr Tan", "Ms Nur"];
  const gotAll5 = fiveStarNames.every((n) => body.includes(n));
  const noneBelow5 = !/Mdm Chong|Ms Wong|Ms Lim|Ms Farah/.test(body);
  if (gotAll5 && noneBelow5) ok("🔴 只看 5 星，三位都在、其余都不在");
  else no("🔴 筛 5 星不对", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/3-filtered-5-star.png`, fullPage: true });
  await select.selectOption("0");

  // ── ⑤ 默认不给公开，按一下就变成可以给别人看 ────────────────────────────
  if (/Stays in the record/.test(body) || (await page.locator("body").innerText()).includes("Stays in the record"))
    ok("默认不给公开，讲得出来「只留在记录里」");
  else no("默认状态没讲清楚", "");
  const allowBtn = page.getByRole("button", { name: "Allow showing this" }).first();
  if ((await allowBtn.count()) === 0) {
    no("🔴 找不到「允许给别人看」那颗按钮", "");
  } else {
    await allowBtn.click();
    await page.waitForTimeout(2200);
    const { data: shown } = await admin
      .from("appointments")
      .select("id, review_may_show")
      .in("id", ids)
      .eq("review_may_show", true);
    if ((shown ?? []).length === 1) ok("🔴 按了「允许给别人看」，资料库真的改了那一笔");
    else no("🔴 资料库没有改", JSON.stringify(shown));
  }

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
