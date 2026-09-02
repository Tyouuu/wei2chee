/* 表格上那个搜索框，真的会筛吗。
 *
 * ⚠️ 这一支存在的唯一理由：**一个按不动的控件是缺陷，不是装饰。**
 * 任务 15 砍掉过一个搜不到东西的 ⌘K；任务 94 抓到过一条说「已筛选」而画面没筛
 * 的筛选条。所以这个框做出来的当天就要有人真的打字进去看行数变少。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: proj } = await db.from("projects").select("account_id").eq("id", process.env.DEMO_PROJECT_ID || "37f2b188-5899-48ab-8650-11cefa5f98d2").single();
const { data: acct } = await db.from("accounts").select("email").eq("id", proj.account_id).single();

const fails = [];
const ok = (n, c, d = "") => (c ? console.log(`  PASS  ${n}`) : (fails.push(n), console.log(`  FAIL  ${n}  ${d}`)));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', acct.email);
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 60000 });

/* 中台 是两套带搜索框的其中一套，也是 demo 帐号本来穿的那一套。 */
await p.goto("http://localhost:3000/zh/portal/dashboard", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(7000);

const search = p.locator('input[placeholder]').first();
ok("表格上有一个搜索框", await search.isVisible().catch(() => false));

const rowsBefore = await p.locator("table tbody tr").count();
ok("表格本来有行", rowsBefore > 1, `${rowsBefore} 行`);

await search.fill("Taman");
await p.waitForTimeout(900);
const rowsAfter = await p.locator("table tbody tr").count();
ok("打字之后行数变少", rowsAfter < rowsBefore && rowsAfter > 0, `${rowsBefore} → ${rowsAfter}`);

const head = await p.locator("body").innerText();
ok("上面那个条数跟着变", /1\s*(条|record)/.test(head), head.match(/共?\s*\d+\s*(条|records?)/)?.[0] ?? "读不到");

await search.fill("zzzzzz");
await p.waitForTimeout(700);
const empty = await p.locator("table tbody").first().innerText();
console.log("      找不到时 tbody 是：", JSON.stringify(empty.slice(0,120)));
ok("找不到的时候讲一句话，不是空白也不是全部", /没有|no |zzzzzz/i.test(empty), JSON.stringify(empty.slice(0,80)));

await search.fill("");
await p.waitForTimeout(700);
ok("清空之后全部回来", (await p.locator("table tbody tr").count()) === rowsBefore);

await b.close();
console.log(fails.length ? `\n🔴 ${fails.length} 条没过` : "\n全过");
process.exit(fails.length ? 1 : 0);
