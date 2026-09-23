/**
 * 沙龙新设计的 Lookbook & Formulas——这一页跟前八页不一样：没有真的
 * lookbook 资料表可以换，六张示范卡片本来就没有真的地基。这一支验的
 * 是「每一颗按钮都做了真的事」这件事，不是资料真不真。真登入、真截图。
 *
 * ── 为什么（2026-09-24，Packages 之后第九页）───────────────────────────────
 *
 * 种一位真客人，验证：真的复制到剪贴簿(Copy)、真的把配方写进她的
 * note(Apply to Ticket, update_directory_entry)、其余没有真地基的按钮
 * 至少给一句诚实的话，不是完全没反应。
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
const OUT = ".screenshots/lookbook-real";
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
  const email = `look-${stamp}@formae.test`;
  const password = `Lk-${stamp}-x!`;
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

  await api.rpc("add_project_page", { requested_key: "customers", new_title: "" });
  const guest = await api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: "Lookbook-Test Guest",
  });
  if (guest.error) throw new Error(`guest: ${guest.error.message}`);
  await admin.from("directory_entries").update({ note: "Allergic to ammonia" }).eq("id", guest.data.id);

  browser = await chromium.launch({ permissions: ["clipboard-read", "clipboard-write"] }).catch(() => chromium.launch());
  const context = await browser.newContext({ viewport: { width: 1700, height: 1300 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/salon-preview/lookbook`, { waitUntil: "networkidle", timeout: 180000 });

  let body = await page.locator("body").innerText();

  if (/Lookbook-Test Guest/.test(body)) ok("🔴 真的客人出现在「Applying formulas to」的选择器里");
  else no("客人选择器不对");

  if (/All Swatches\s*6/.test(body.replace(/\n/g, " "))) ok("🔴 分类数字是真的从 6 个示范卡片算出来的,不是编的 142");
  else no("分类数字不对", body.match(/All Swatches[^\n]*/)?.[0]);

  await page.screenshot({ path: `${OUT}/1-gallery.png`, fullPage: true });

  // 真的复制——点第一张卡的 Copy,验证剪贴簿真的拿到那句配方。
  await page.locator('button:has-text("Copy")').first().click();
  await page.waitForTimeout(300);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  if (clipboard && clipboard.includes("Majirel 6.1")) ok("🔴 Copy 真的把配方写进剪贴簿(navigator.clipboard)");
  else no("剪贴簿没有真的拿到配方", clipboard);

  const afterCopy = await page.locator("body").innerText();
  if (/Copied/.test(afterCopy)) ok("🔴 按钮真的换成「Copied」确认字样");
  else no("按钮没有换字");

  // 真的写进客人资料——Apply to Ticket。
  await page.locator('button:has-text("Apply to Ticket")').first().click();
  await page.waitForTimeout(1200);
  const { data: checkGuest } = await admin.from("directory_entries").select("note").eq("id", guest.data.id).single();
  if (checkGuest?.note?.includes("Smoky Mocha Velvet") && checkGuest?.note?.includes("Allergic to ammonia"))
    ok("🔴 Apply to Ticket 真的把配方接到她原本的 note 后面(update_directory_entry),原本那句话没有被盖掉");
  else no("Apply to Ticket 没有真的写进资料库", checkGuest?.note);

  await page.screenshot({ path: `${OUT}/2-applied.png`, fullPage: true });

  // 没有真地基的按钮——至少给诚实的话,不是完全没反应。
  let sawDialog = false;
  page.once("dialog", (d) => { sawDialog = true; d.accept(); });
  await page.locator('button:has-text("Present Look")').first().click();
  await page.waitForTimeout(300);
  if (sawDialog) ok("🔴 「Present Look」按下去至少讲一句诚实的话,不是完全没反应");
  else no("「Present Look」按下去什么都没发生");

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
