/**
 * 上下班打卡——真登入、真按、真截图。
 *
 * ── 为什么（2026-09-12，[任务 375/401]）───────────────────────────────────
 *
 * `clock_in` · `clock_out` · `hours_worked_of` 从做出来那天起只有助手
 * 打得到（[任务 387]），画面上一个入口都没有。这一支验证师傅自己那一页
 * 上新加的按钮：打卡上班、打卡下班，两次都真的写进 `staff_shifts`。
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
const OUT = ".screenshots/staff-shift-buttons";
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
  const email = `shiftbtn-${stamp}@formae.test`;
  const password = `Sb-${stamp}-x!`;
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

  await api.rpc("add_project_page", { requested_key: "staff", new_title: "" });
  const zara = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "staff", in_name: "Nurse Zara",
  });
  if (zara.error) throw new Error(`add_directory_entry: ${zara.error.message}`);
  const staffId = zara.data.id;

  // 道具：一节已经关掉的班，让「最近 30 天」有数字可以读。
  const dayAgo = new Date(Date.now() - 20 * 3600e3).toISOString();
  const dayAgoOut = new Date(Date.now() - 16 * 3600e3).toISOString();
  await admin.from("staff_shifts").insert({
    project_id: pid, staff_id: staffId,
    clock_in_at: dayAgo, clock_out_at: dayAgoOut,
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/portal/staff/${staffId}`, {
    waitUntil: "networkidle", timeout: 180000,
  });
  let body = await page.locator("body").innerText();
  if (/Not clocked in right now/.test(body)) ok("一开始：讲得出「现在没有打卡」");
  else no("一开始的字不对", body.slice(0, 300));
  if (/4 hrs across 1 shifts/.test(body)) ok("道具那节 4 小时的班算进最近 30 天了");
  else no("最近 30 天的时数不对", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/1-not-in.png`, fullPage: true });

  await page.getByRole("button", { name: "Clock in" }).click();
  await page.waitForTimeout(2500);

  const { data: openShift } = await admin
    .from("staff_shifts").select("id").eq("staff_id", staffId).is("clock_out_at", null).maybeSingle();
  if (openShift) ok("🔴 打卡上班，资料库里真的开了一节新的班");
  else no("打卡上班没有真的写进资料库", JSON.stringify(openShift));

  body = await page.locator("body").innerText();
  if (/Clocked in since/.test(body) && (await page.getByRole("button", { name: "Clock out" }).count()) > 0)
    ok("画面换成「现在在店里」，按钮也换成「打卡下班」");
  else no("打卡后的画面不对", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/2-clocked-in.png`, fullPage: true });

  await page.getByRole("button", { name: "Clock out" }).click();
  await page.waitForTimeout(2500);

  const { data: afterOut } = await admin
    .from("staff_shifts").select("clock_out_at").eq("id", openShift.id).single();
  if (afterOut?.clock_out_at) ok("🔴 打卡下班，资料库里那一节真的关上了");
  else no("打卡下班没有真的写进资料库", JSON.stringify(afterOut));

  body = await page.locator("body").innerText();
  if (/Not clocked in right now/.test(body)) ok("下班之后画面换回「现在没有打卡」");
  else no("下班后的画面不对", body.slice(0, 300));
  await page.screenshot({ path: `${OUT}/3-clocked-out.png`, fullPage: true });

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
