/**
 * 「讲过什么」跟那两个开关 —— 在真的浏览器里按一次。
 *
 * ── 为什么这一支要存在 ────────────────────────────────────────────────────
 *
 * 他 2026-09-06 拍板 `現在就要對客戶開放就是兩個都開放`，而那一条的落地清单
 * 写着 **一个总开关 ＋ 一份「发过什么」**（[任务 219](../docs/founder-tasks.md#219)）。
 * 那张表 20260906380000 建好了、33 条真身分的断言全过（`check:messages`），
 * 而 `set_message_settings` **画面上一个入口都没有**
 * （[任务 252](../docs/founder-tasks.md#252) 那份清单上的一支）。
 *
 * ── 🔴 这一支真正在守的那一件 ─────────────────────────────────────────────
 *
 * 一个**看起来关掉了、而资料库里还开着**的开关，比一个报错的糟得多 ——
 * 他会以为系统不会再替他跟客人讲话了。所以每按一次，
 * **回资料库问一次那一行**，而且重新载入再看一次画面。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages } from "./lib/seed-demo.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = `said-${Date.now()}@formae.test`;
const PASSWORD = `Said-${Date.now()}-x!`;
const BODY =
  "Hi Mrs Lim, your quote QT-2026-0007 is valid until 12 Sep. Shall I hold it?";

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const api = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
const ok = (name, cond, saw) => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

const call = async (fn, args) => {
  const { data, error } = await api.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return Array.isArray(data) ? data[0] : data;
};

/** 那一行设定 —— 一行都还没有的时候回 null（预设是两个都开）。 */
const settings = async (projectId) => {
  const { data, error } = await api
    .from("message_settings")
    .select("to_owner, to_customer")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(`message_settings: ${error.message}`);
  return data;
};

let userId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const projectId = proj.id;
  await api.rpc("set_project_style", { new_style: "ledger" });
  await openAllPages(api, { quiet: true });

  const lim = await call("add_directory_entry", {
    in_project_id: projectId,
    in_module_key: "customers",
    in_name: "Mrs Lim",
  });

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 240000 });

  const openToday = async () => {
    await page.goto(`${BASE}/en/portal/today`, {
      waitUntil: "domcontentloaded",
      timeout: 240000,
    });
    await page.waitForTimeout(2500);
  };

  const boxes = () => page.locator('[data-said-list] input[type="checkbox"]');

  console.log("① 一句都还没讲过的时候");
  await openToday();
  ok("那一段在", (await page.locator("[data-said-list]").count()) > 0);
  const first = await page.locator("[data-said-list]").innerText();
  ok(
    "🔴 讲的是「一句都没有替你讲过」，不是一张空清单",
    /Nothing has been sent/i.test(first),
    first.slice(0, 160),
  );
  ok(
    "🔴 而那两个开关照样在 —— 不然他要先让系统讲过一次话才关得掉它",
    (await boxes().count()) === 2,
    String(await boxes().count()),
  );
  ok(
    "两个预设都是开的（他 2026-09-06 拍板「兩個都開放」）",
    (await boxes().nth(0).isChecked()) && (await boxes().nth(1).isChecked()),
  );
  ok(
    "🔴 而画面自己讲了它今天还不是什么",
    /Nothing goes out on its own yet/i.test(first),
    first.slice(0, 400),
  );
  ok(
    "一行都还没写 —— 预设是画面补的，不是资料库里的一行",
    (await settings(projectId)) === null,
  );

  console.log("\n② 关掉「讲给我的客人听」");
  await boxes().nth(1).uncheck();
  await page.waitForTimeout(2500);
  const off = await settings(projectId);
  ok("🔴 资料库那一行真的关了", off?.to_customer === false, JSON.stringify(off));
  ok(
    "⚠️ 而「提醒我」那一个没有被顺手写掉（那一支的 null 是「别碰」）",
    off?.to_owner === true,
    JSON.stringify(off),
  );
  await openToday();
  ok(
    "🔴 重新载入，它还是关的 —— 画面那个预设没有盖掉他的决定",
    (await boxes().nth(1).isChecked()) === false,
  );
  ok("另一个照旧是开的", await boxes().nth(0).isChecked());

  console.log("\n③ 他按了「发这一则」—— 这一份就多一行");
  /* ⚠️ 走的是**那颗按钮真的呼叫的那一支**（`record_message_sent`，
     [任务 265](../docs/founder-tasks.md#265)），不是自己 insert 一行 ——
     一个用别的路摆好的道具，量不到那颗按钮那条路。 */
  await call("record_message_sent", {
    in_project_id: projectId,
    in_audience: "customer",
    in_kind: "quote_expiring",
    in_body: BODY,
    in_party_id: lim.id,
  });
  await openToday();
  const said = await page.locator("[data-said-list]").innerText();
  ok("🔴 原话印出来了", said.includes("QT-2026-0007"), said.slice(0, 200));
  ok("讲给谁 —— 名字从名册上来", /Mrs Lim/.test(said), said.slice(0, 200));
  ok(
    "那一种事用的是讯号那一份同一批词",
    /Quote about to expire/i.test(said),
    said.slice(0, 200),
  );
  ok(
    "🔴 发出去了的那一行**不画药丸** —— 二十颗「已发」是二十颗没有讲话的药丸",
    !/Did not go|Waiting|Called off/i.test(said),
    said.slice(0, 300),
  );

  console.log("\n④ 🔴 关掉那个开关，真的挡得住东西");
  /* 🔴 **这一段是这一支尺最值钱的一条，而它是跑出来的不是想出来的。**
     我在 said-list.tsx 的档头写过「产品代码里零个地方读 message_settings」——
     那一句只对 TypeScript 成立。**资料库自己在读**：`queue_message`
     每一次都先问那一行（20260906380000），关着就拒绝。
     所以那两个框今天就挡得住东西，不是一个还没有人读的偏好。 */
  const blocked = await api.rpc("queue_message", {
    in_project_id: projectId,
    in_audience: "customer",
    in_kind: "payment_overdue",
    in_body: "This one must not be queued.",
    in_party_id: lim.id,
  });
  ok(
    "🔴 关着的时候，排不进去",
    /turned off/i.test(blocked.error?.message ?? ""),
    blocked.error?.message ?? "居然让它过了",
  );
  /* ⚠️ **而他自己按 WhatsApp 发出去的照旧记得下来** —— 20260906380000
     明写的判断：开关挡的是「以后自动去发」，不是「记下他已经发过的」。
     少了这一条，那一句写在画面上的话就没有人在守。 */
  const byHand = await api.rpc("record_message_sent", {
    in_project_id: projectId,
    in_audience: "customer",
    in_kind: "quote_expiring",
    in_body: "Sent by hand while the switch is off.",
    in_party_id: lim.id,
  });
  ok(
    "⚠️ 而他自己按 WhatsApp 发的，照旧记得下来",
    !byHand.error,
    byHand.error?.message,
  );

  console.log("\n⑤ 开回去，排着还没出去的那一行讲得出来");
  await openToday();
  await boxes().nth(1).check();
  await page.waitForTimeout(2500);
  ok("开回去了", (await settings(projectId))?.to_customer === true);
  await call("queue_message", {
    in_project_id: projectId,
    in_audience: "customer",
    in_kind: "payment_overdue",
    in_body: "Hi Mrs Lim, RM 1,520 is still outstanding on QT-2026-0007.",
    in_party_id: lim.id,
  });
  await openToday();
  const both = await page.locator("[data-said-list]").innerText();
  ok("🔴 排着那一行有一颗药丸", /Waiting/i.test(both), both.slice(0, 300));
  ok(
    "而已经出去那一行照旧没有",
    (both.match(/Waiting/gi) ?? []).length === 1,
    String((both.match(/Waiting/gi) ?? []).length),
  );
  ok(
    "🔴 新的排在上面 —— 他打开这一页要看的是最近讲过什么",
    both.indexOf("RM 1,520") < both.indexOf("QT-2026-0007"),
    both.slice(0, 300),
  );
  ok(
    "而手按那一则也在（关着的时候发的）",
    both.includes("Sent by hand"),
    both.slice(0, 300),
  );

  await page
    .locator("[data-said-list]")
    .screenshot({ path: ".screenshots/said/1-said.png" });

  console.log("\n⑥ 390 —— 判这一页的是他，而他多半在手机上");
  const mp = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: await context.storageState(),
    })
  ).newPage();
  await mp.goto(`${BASE}/en/portal/today`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await mp.waitForTimeout(2500);
  ok("那一段在", (await mp.locator("[data-said-list]").count()) > 0);
  const wide = await mp.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  ok("390 上不横滚", !wide);
  /* 🔴 一句真的话是一整段字，而它旁边还有一列时间跟一颗药丸 ——
     那正是会把一页撑破的形状。 */
  const spill = await mp.evaluate(() => {
    const el = document.querySelector("[data-said-list]");
    if (!el) return -1;
    return Math.round(el.scrollWidth - el.clientWidth);
  });
  ok("🔴 那一段自己也不横滚", spill <= 1, String(spill));
  /* 🔴 **那句话是这一行的主角，它要拿得到一整行。**
     第一版在 390 上被挤成 150px 宽、折成四行 —— 左边 80px 的时间
     加右边那颗药丸，把主角挤到只剩一条缝。看图才看到的，所以钉在这里。 */
  const wideEnough = await mp.evaluate(() => {
    const li = document.querySelector("[data-said-list] li");
    if (!li) return -1;
    const ps = li.querySelectorAll("p");
    return ps.length ? Math.round(ps[ps.length - 2].getBoundingClientRect().width) : -1;
  });
  ok("🔴 而那句话拿得到一整行（≥ 260px）", wideEnough >= 260, String(wideEnough));
  await mp.screenshot({
    path: ".screenshots/said/2-phone.png",
    fullPage: false,
  });
} finally {
  if (browser) await browser.close();
}

console.log(`\n判：${pass} 过 ${fail} 没过`);
console.log("→ .screenshots/said/  ⚠️ 现在去用眼睛看那两张图");
process.exitCode = fail ? 1 : 0;
