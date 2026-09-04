/**
 * 一个**还没付款**的老板，按保存 · 按「交给我们建」—— 真的开浏览器按。
 *
 * ── 这一支在守的三件（任务 159）────────────────────────────────────────
 *
 *  🔴 **按保存不会撞墙。** 20260905410000 拆掉了资料库那道闸，而
 *     浏览器那一端自己也有一支 `if (!paid) setSaveState("paywall")` ——
 *     两边都要拆掉，只拆一边跟没拆一样（这个仓库十九次「说了没做」
 *     全部是这个形状）。
 *
 *  🔴 **「交给我们建」先写库，才开 WhatsApp。**
 *     一则要客户自己按送出的讯息，是一个会漏的漏斗，而它漏的正好是
 *     我们最看不见的那一次：他回家自己按的那一次。
 *
 *  🔴 **号码真的记下来了。** 注册只有 email，而这个市场的管道是 WhatsApp
 *     （任务 48，8-28 记着一直没做）。
 *
 * ⚠️ 跑完把临时帐号删掉，而且看那个 error（scripts/lib/throwaway.mjs）。
 */
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { dropThrowaways } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/handoff";
mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const failed = [];
const say = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const made = [];
let browser;

try {
  const EMAIL = `ho-ui-${Date.now()}@formae.test`;
  const PASSWORD = `Ho-${Date.now()}-x!`;
  const { data: user, error: uErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (uErr) throw new Error(uErr.message);
  made.push(user.user.id);

  const { data: proj } = await admin
    .from("projects")
    .select("id, paid, stage")
    .eq("account_id", user.user.id)
    .single();

  // 控制组：这个帐号真的没付款，不然下面每一条都在量空气（任务 125）。
  say("这个帐号真的还没付款", proj?.paid === false, `paid=${proj?.paid}`);

  // 给他一页可以编的。走的是人按的那一支（重点 23）。
  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await as.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  await as.rpc("add_project_page", { requested_key: "quotations", new_title: "Quotations" });

  /* 🔴 一个用管理钥匙建出来的帐号没有走过问卷，所以 `style` 是空的 ——
     而空的 style 会把每一个模块页重导到「挑一套风格」。
     第一版没做这一步，於是它对着一张挑风格的页找「保存设计」找了 30 秒。
     真实流程里这一栏是分析填的；这里补上它，量的才是编辑器。 */
  await admin.from("projects").update({ style: "swiss" }).eq("id", proj.id);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  // ?design=1 —— 他的系统是正门，编辑器是他按进去的一个模式（任务 162）。
  await page.goto(`${BASE}/en/portal/quotations?design=1`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  const h1 = await page.locator("h1").first().innerText().catch(() => "");
  /* 🔴 「不是登入页」不等於「就是我要的那一页」—— 第一版就是这样对着
     一张挑风格的页打完分。这个仓库被同一个形状骗过四次。 */
  say(
    "编辑器打得开",
    /\/portal\/quotations/.test(page.url()) && !/log in|sign in|something broke/i.test(h1),
    `${page.url()} · h1「${h1}」`,
  );
  await page.screenshot({ path: `${OUT}/1-editor.png`, fullPage: false });

  // ① 按保存 —— 不可以出现那面墙
  const saveBtn = page.getByRole("button", { name: /save design|保存设计/i }).first();
  await saveBtn.click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  const body1 = await page.locator("body").innerText();
  say(
    "🔴 没付款按保存，不会撞墙",
    !/pay to save|付款后即可保存|contact us to pay/i.test(body1),
    body1.replace(/\s+/g, " ").slice(0, 200),
  );
  const { data: rowAfterSave } = await admin
    .from("project_pages")
    .select("layout_json")
    .eq("project_id", proj.id)
    .eq("page_key", "quotations")
    .single();
  say(
    "而且真的存进伺服器了",
    !!rowAfterSave?.layout_json && Object.keys(rowAfterSave.layout_json).length > 0,
  );
  await page.screenshot({ path: `${OUT}/2-saved.png`, fullPage: false });

  // ② 按「交给我们建」—— 出一格对话框
  await page.getByRole("button", { name: /hand off to build|交给我们建/i }).first().click();
  await page.waitForTimeout(2000);
  const dialogText = await page.locator("body").innerText();
  say("交接那一格出来了", /hand it to us|交给我们建/i.test(dialogText));
  say("而且问了号码", /whatsapp number|号码/i.test(dialogText));
  await page.screenshot({ path: `${OUT}/3-handoff.png`, fullPage: false });

  await page.fill('input[type="tel"]', "012-345 6789");
  await page.fill("textarea", "我还要一页记我的车队油钱");

  // window.open 会开新分页 —— 接住它，不然它是个没人看的黑洞
  const popup = page.waitForEvent("popup", { timeout: 20000 }).catch(() => null);
  await page.getByRole("button", { name: /^send it$|^送出$/i }).click();
  const opened = await popup;
  await page.waitForTimeout(2500);

  /* ⚠️ `wa.me` 会 302 到 `api.whatsapp.com/send/` —— 第一版只认前者，
     於是它对着一次完全正确的跳转报红。红的是尺不是产品（第八次）。 */
  say(
    "🔴 真的跳去 WhatsApp",
    !!opened && /(wa\.me|whatsapp\.com)/.test(opened.url()),
    opened?.url()?.slice(0, 80) ?? "没开",
  );
  say(
    "而且那句话带着他写的内容，不用他再打一次",
    !!opened && decodeURIComponent(opened.url()).includes("车队油钱"),
    decodeURIComponent(opened?.url() ?? "").slice(0, 160),
  );

  // ③ 资料库那一行 —— 这才是整件事的重点
  const { data: rows } = await admin
    .from("handoff_requests")
    .select("note")
    .eq("project_id", proj.id);
  say("🔴 资料库里真的多一行", rows?.length === 1, `${rows?.length} 行`);
  say("他要的那个功能写下来了", rows?.[0]?.note === "我还要一页记我的车队油钱", rows?.[0]?.note);

  const { data: p2 } = await admin
    .from("projects")
    .select("contact_phone, stage")
    .eq("id", proj.id)
    .single();
  say("🔴 号码记下来了", p2?.contact_phone === "012-345 6789", `${p2?.contact_phone}`);
  say("交付状态推到了「已报价」", p2?.stage === "quoted", `stage=${p2?.stage}`);

  await page.screenshot({ path: `${OUT}/4-after.png`, fullPage: false });
} finally {
  if (browser) await browser.close();
  const stuck = await dropThrowaways(admin, made);
  console.log(
    stuck.length ? `\n🔴 有 ${stuck.length} 个临时帐号删不掉` : `\n临时帐号 ${made.length} 个，全部删掉了`,
  );
}

console.log(
  failed.length
    ? `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}`
    : `\n判：全部过了。没付款存得了，交接留下一行。`,
);
process.exit(failed.length ? 1 : 0);
