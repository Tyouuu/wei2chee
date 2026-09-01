/* 「找东西」那个面板 —— 真的按一次，不是读代码。
 *
 * ⚠️ 这一支存在的理由就是这个仓库犯了十六次的那个错：能力有、线没接。
 * 所以它最后一步不是拍照，是**问那一页有没有真的筛好** ——
 * 落在一张 21,417px 的页上而没有筛，跟没有这个面板是一样的。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PROJECT = process.env.DEMO_PROJECT_ID || "37f2b188-5899-48ab-8650-11cefa5f98d2";
const { data: proj } = await db.from("projects").select("account_id").eq("id", PROJECT).single();
const { data: acct } = await db.from("accounts").select("email").eq("id", proj.account_id).single();

const OUT = ".screenshots/find";
fs.mkdirSync(OUT, { recursive: true });

const fails = [];
const ok = (name, cond, detail = "") =>
  (cond ? console.log(`  PASS  ${name}`) : (fails.push(name), console.log(`  FAIL  ${name}  ${detail}`)));

const b = await chromium.launch();
for (const W of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 950 } });
  const p = await ctx.newPage();
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: acct.email });
  await p.goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/portal`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await p.goto(`${BASE}/en/portal`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });

  console.log(`\n── ${W}px ──`);

  /* 手机上侧栏是抽屉，那颗按钮住在里面 —— 先把抽屉打开，
     不然「按不到」会被误读成「没有这个按钮」。 */
  if (W < 500) await p.getByRole("button", { name: /open navigation/i }).click().catch(() => {});
  await p.waitForTimeout(400);

  const btn = p.getByRole("button", { name: /find anything/i }).first();
  ok("侧栏有一颗看得见的按钮", await btn.isVisible().catch(() => false));
  await btn.click();
  await p.waitForTimeout(700);

  const dialog = p.getByRole("dialog", { name: /find anything/i });
  ok("按下去面板真的开了", await dialog.isVisible().catch(() => false));
  await p.screenshot({ path: `${OUT}/${W}-1-open.jpg`, type: "jpeg", quality: 82 });

  /* 空的时候只给「你可以去哪里」，不给三百条 */
  const emptyRows = await p.locator("[data-cursor]").count();
  ok("空手打开给的是去处，不是全部", emptyRows > 3 && emptyRows < 40, `${emptyRows} 条`);

  /* 输入框有没有拿到 focus —— 一个要用滑鼠再点一下才能打字的搜索框，
     等於没有快捷键。 */
  const focused = await p.evaluate(() => document.activeElement?.tagName?.toLowerCase());
  ok("打开就可以直接打字", focused === "input", `focus 在 ${focused}`);

  await p.keyboard.type("hero");
  await p.waitForTimeout(900);
  const hits = await p.locator("[data-cursor]").count();
  ok("打三个字有结果", hits > 0, `${hits} 条`);
  await p.screenshot({ path: `${OUT}/${W}-2-typed.jpg`, type: "jpeg", quality: 82 });

  const kinds = await p.evaluate(() =>
    [...document.querySelectorAll("[role=dialog] p")].map((e) => e.textContent?.trim()).filter(Boolean),
  );
  ok("结果有分组", kinds.length >= 1, JSON.stringify(kinds).slice(0, 90));

  /* 🔴 眼睛先抓到的那一条，现在是一道会红的关。
     第一版直接读 `puckConfig` 的名字，而那份是中文的（中文是唯一真相，
     英文是它的投影）—— 於是在 `/en` 上搜 hero，结果里混着「说明大标题」
     「重点数字卡」。[任务 18](../docs/founder-tasks.md) 花一整轮清掉的
     386 条中文，就是同一种。
     ⚠️ 而 `check:en` 抓不到它：那只爬虫只看页面，看不到藏在一次点击后面的面板
     （选图器那一次一模一样，[任务 38](../docs/founder-tasks.md)）。 */
  const cjk = await p.evaluate(() =>
    [...document.querySelectorAll("[role=dialog] [data-cursor]")]
      .map((e) => e.textContent || "")
      .filter((s) => /[一-鿿]/.test(s)),
  );
  ok("英文的面板里一个中文都没有", cjk.length === 0, cjk.join(" · ").slice(0, 80));

  /* 🔴 真正要验的那一条：Enter 之后，落地那一页有没有**已经筛好**。 */
  const firstLabel = (await p.locator("[data-cursor]").first().innerText()).split("\n")[0].trim();
  await p.keyboard.press("Enter");
  await p.waitForURL(/\/portal\//, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2200);
  const landed = p.url();
  ok("Enter 走到了别的地方", /\?q=|\/portal\/[a-z]/.test(landed), landed);

  const seeded = await p.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find((e) => e.value);
    return i ? i.value : "";
  });
  if (/\?q=/.test(landed)) {
    ok("落地那一页已经筛好了", seeded.length > 0, `搜索框里是「${seeded}」`);
    const shown = await p.evaluate(() => document.querySelectorAll("li").length);
    ok("而且只剩配得上的那几个", shown > 0 && shown < 60, `${shown} 个`);
  }
  await p.screenshot({ path: `${OUT}/${W}-3-landed.jpg`, type: "jpeg", quality: 82 });
  console.log(`      找的是「${firstLabel}」→ ${landed.replace(BASE, "")}`);

  /* 快捷键那条门 */
  await p.goto(`${BASE}/en/portal`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(1000);
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(600);
  ok("Ctrl+K 也开得了", await p.getByRole("dialog", { name: /find anything/i }).isVisible().catch(() => false));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  ok("Esc 关得掉", !(await p.getByRole("dialog", { name: /find anything/i }).isVisible().catch(() => false)));

  await ctx.close();
}
await b.close();

console.log(fails.length ? `\n🔴 ${fails.length} 条没过：${fails.join(" · ")}` : "\n全过");
process.exit(fails.length ? 1 : 0);
