/**
 * 第二间店 —— 真的开一间，用眼睛看。
 *
 * 重点 7l。234 条真的呼叫全过，而那些答不了：
 * **他有没有地方开那一间店**，而那正好是这个仓库最常犯的那个错
 * （东西建好了、线没接）。
 *
 * ⚠️ 用完就删的帐号。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/branches";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `branch-${stamp}@formae.test`;
const PASSWORD = `Branch-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const shots = [];
let userId = null;
let browser;

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);

  browser = await chromium.launch();
  const say = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
    if (!ok) shots.push({ name, stuck: true });
  };

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  /* ① 一间店都没有的时候，讲得出「只有一间店」不是一片空白。 */
  await page.goto(`${BASE}/en/portal/branches`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: `${OUT}/1-none.png`, fullPage: true });
  const empty = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  1-none");
  say("一间店都没有的时候讲得出来，不是一片空白",
    /Just the one shop/i.test(empty), empty.slice(0, 300));

  /* ② 真的开两间。 */
  for (const name of ["Puchong", "Sri Petaling"]) {
    await page.getByLabel("What you call it (Puchong · Main shop)").fill(name);
    await page.getByRole("button", { name: /^Open a branch$/i }).click();
    await page.waitForTimeout(3000);
  }
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: `${OUT}/2-two.png`, fullPage: true });
  const two = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("拍到  2-two");
  say("开得了两间", /Puchong/.test(two) && /Sri Petaling/.test(two), two.slice(0, 300));

  /* ③ 🔴 开单的时候挑得到，而且**收款也挑得到** ——
     只有报价单挑得了分店，等於月底问不出「Puchong 收了多少」。 */
  for (const [path, tag] of [
    ["/en/portal/quotations/new", "3-on-a-job"],
    ["/en/portal/payments/new", "4-on-a-payment"],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    const has = await page.getByLabel("Which branch").count();
    console.log(`拍到  ${tag}`);
    say(`${tag}：挑得到哪一间店`, has === 1, `${has} 个下拉`);
  }

  /* 真的挑一间、存下去，然后读回来还在。 */
  await page.goto(`${BASE}/en/portal/quotations/new`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.locator("form input").first().fill("Puchong job");
  await page.getByLabel("Which branch").selectOption({ label: "Puchong" });
  await page.getByRole("button", { name: /^Save$/i }).first().click();
  await page.waitForTimeout(5000);
  const { data: saved } = await api
    .from("pipeline_records").select("branch_id").eq("title", "Puchong job").maybeSingle();
  const { data: br } = await api.from("branches").select("id, name").eq("name", "Puchong").maybeSingle();
  say("挑了店、存下去，那一栏真的写进去了", saved?.branch_id === br?.id,
    `${saved?.branch_id} vs ${br?.id}`);

  /* ④ 一间店的时候，那个下拉整个不出现 —— 一个只有一个选项的下拉是假的控件。 */
  await api.rpc("set_branch_active", { in_id: br.id, in_active: false });
  await page.goto(`${BASE}/en/portal/quotations/new`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const oneLeft = await page.getByLabel("Which branch").count();
  say("只剩一间店的时候，那个下拉整个不出现", oneLeft === 0, `${oneLeft} 个下拉`);

  /* ⑤ 手机 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await phone.goto(`${BASE}/en/portal/branches`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForTimeout(1000);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/5-phone-390.png`, fullPage: true });
  console.log("拍到  5-phone-390");
  const scrolls = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  say("手机上不用左右滑", !scrolls, "会横滑");
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  shots.push({ name: err.message, stuck: true });
} finally {
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
  if (browser) await browser.close();
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${bad.length} 项没过`);
if (bad.length) for (const b of bad) console.log(`  · ${b.name}`);
process.exit(bad.length ? 1 : 0);
