/**
 * 把旧的 Excel 贴进来 —— 真的贴一次，用眼睛看。
 *
 * 重点 7l。而这一支要验的那一件，单元测试永远验不到：
 * **五行里第三行坏掉，要进去四行、然后告诉他第三行怎么了。**
 * 不是整批失败（他要重来），也不是默默跳过（他不知道少了一行）。
 *
 * ⚠️ 跑完把汇进去的那几行删掉。
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
const OUT = ".screenshots/import";
mkdirSync(OUT, { recursive: true });

const EMAIL = "tianyou.demo@formae.test";
const PASSWORD = "FormaeDemo2026!";
const TAG = `IMP-${Date.now()}`;

const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const shots = [];

/* 从 Excel 复製出来是 tab 分隔的。
   ⚠️ 表头用**那一页自己的字**。第一版打的是中文（工程 · 客户 · 报价），
   而 demo 那个系统的语言是英文，所以它一栏都认不出来、按钮正确地变灰了 ——
   **红的是我的道具，不是产品**（重点 22d：一个英文系统里的中文道具）。

   第三行故意造一个**资料库会拒绝**的：一个太长的名字。 */
const paste = [
  "Work quoted\tClient\tQuoted",
  `${TAG} 厨房翻新\t陈大文\tRM 48,500`,
  `${TAG} 浴室\t李太太\t8000`,
  `${"很长的名字".repeat(60)}\t张先生\t1200`,
  `${TAG} 阳台\t黄先生\tRM 3,200.50`,
  "",
].join("\n");

let browser;
try {
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);

  browser = await chromium.launch();
  const wide = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await wide.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.fill('input[type="email"]', EMAIL);
  await wide.fill('input[type="password"]', PASSWORD);
  await wide.click('button[type="submit"]');
  await wide.waitForURL(/portal/, { timeout: 180000 });

  await wide.goto(`${BASE}/en/portal/quotations/import`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.waitForTimeout(1000);
  await wide.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const h1 = await wide.locator("h1").first().innerText().catch(() => "");
  const stuck = /log in|sign in/i.test(h1) || /something broke|does not exist/i.test(h1);
  shots.push({ name: "0-open", stuck });
  await wide.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });
  console.log(`${stuck ? "🔴 卡住" : "拍到"}  1-empty · h1「${h1}」`);

  /* 真的贴一次。 */
  await wide.locator("textarea").fill(paste);
  await wide.waitForTimeout(700);
  await wide.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await wide.screenshot({ path: `${OUT}/2-preview.png`, fullPage: true });
  const preview = (await wide.locator("main").innerText()).replace(/\s+/g, " ");
  console.log("拍到  2-preview");

  await wide.getByRole("button", { name: /Bring them in/i }).click();
  await wide.waitForTimeout(6000);
  await wide.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await wide.screenshot({ path: `${OUT}/3-result.png`, fullPage: true });
  const result = (await wide.locator("main").innerText()).replace(/\s+/g, " ");
  console.log("拍到  3-result");

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await phone.goto(`${BASE}/en/portal/quotations/import`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForTimeout(900);
  await phone.locator("textarea").fill(paste);
  await phone.waitForTimeout(600);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/4-phone-390.png`, fullPage: true });
  console.log("拍到  4-phone-390");
  const scrolls = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  const say = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
    if (!ok) shots.push({ name, stuck: true });
  };

  say("贴上去之后，讲得出读到几行", /Read 4 rows/i.test(preview), preview.slice(0, 400));
  say("三栏都认得（没有一栏被划掉）", !/not recognised/i.test(preview), preview.slice(0, 400));
  /* 🔴 这一支真正要验的那一件。 */
  /* ⚠️ 四行**全部**进去，而那是对的：一个三百字的名字，
     `add_pipeline_record` 是 `left(…, 200)` **截短**，不是拒绝。
     我第一版拿它当「会失败的那一行」，然后报产品有问题 ——
     **第五次拿错道具**。「一行坏掉、其余照进」那一件在
     `check:records` ⑰ 用一个资料库真的会拒绝的值验，那才是它住的地方。 */
  say("四行都进去了", /4 rows are in/i.test(result), result.slice(0, 500));
  say("而且没有骗他说有失败的", !/did not go in/i.test(result), result.slice(0, 700));

  const { data: landed } = await api
    .from("pipeline_records").select("id, title, amount_cents, doc_no")
    .like("title", `${TAG}%`);
  say("资料库里真的有那三行", (landed ?? []).length === 3, `${(landed ?? []).length} 行`);
  /* 🔴 走的是人按的那一支，所以单号是发出来的，不是空的。 */
  say("每一行都拿到了自己的单号",
    (landed ?? []).every((r) => (r.doc_no ?? "").length > 3),
    JSON.stringify((landed ?? []).map((r) => r.doc_no)));
  say("RM 48,500 读成了 4850000 sen",
    (landed ?? []).some((r) => r.amount_cents === 4_850_000),
    JSON.stringify((landed ?? []).map((r) => r.amount_cents)));
  say("RM 3,200.50 的几分钱没有掉",
    (landed ?? []).some((r) => r.amount_cents === 320_050),
    JSON.stringify((landed ?? []).map((r) => r.amount_cents)));
  say("手机上不用左右滑", !scrolls, "会横滑");

  /* 🔴 再按一次「汇入」，一行都不可以重复 —— 手机上网路慢他会按两次。 */
  await wide.getByRole("button", { name: /Bring them in/i }).click();
  await wide.waitForTimeout(6000);
  const { data: twice } = await api
    .from("pipeline_records").select("id").like("title", `${TAG}%`);
  say("再按一次不会多出三行", (twice ?? []).length === 3, `${(twice ?? []).length} 行`);
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  shots.push({ name: err.message, stuck: true });
} finally {
  const { data: mine } = await api
    .from("pipeline_records").select("id").like("title", `${TAG}%`);
  for (const r of mine ?? []) await api.from("pipeline_records").delete().eq("id", r.id);
  console.log("\n(道具清掉了)");
  if (browser) await browser.close();
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${bad.length} 项没过`);
if (bad.length) for (const b of bad) console.log(`  · ${b.name}`);
process.exit(bad.length ? 1 : 0);
