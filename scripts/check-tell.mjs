/**
 * 他按一下，那句话到他客人的 WhatsApp 上，而这边记了一笔。
 *
 * ── 为什么这一支要存在（2026-09-07）──────────────────────────────────────
 *
 * `messages` 那一条链五支函式，**画面上一扇门都没有**
 * （[任务 243](../docs/founder-tasks.md#243) 量的：整条链 5/5 没门）。
 * 而 `record_message_sent` 从建出来那天起就是为**他自己按的那一次**做的 ——
 * 系统自己发讯息卡在号码跟 Meta 验证，**而这一条不卡**：
 * 号码是他客人的（他自己名册上的），那句话是资料库写好的
 * （`nudges_due.body`，[任务 250](../docs/founder-tasks.md#250)）。
 *
 * 🔴 这一支量的不是「那颗按钮画出来了没有」，是三件真的事：
 *   ① 那条连结是不是真的（wa.me ＋ 国码 ＋ 那句话）
 *   ② 按下去资料库有没有多一行
 *   ③ 号码认不出来的那一行**有没有不画那颗按钮**
 *
 * ⚠️ ③ 是这一支真正的靶。一颗打给空气的 WhatsApp 按钮，
 * 这个仓库在官网上养过十几天（[任务 11](../docs/founder-tasks.md#11)）。
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
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
const EMAIL = `tell-${Date.now()}@formae.test`;
const PASSWORD = `Tell-${Date.now()}-x!`;

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

/* 🔴 服务器没开就不要跑 —— 一份「一颗按钮都没有」的报告，
   跟一份「服务器没开」的报告，在输出里长得一模一样。 */
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

/** 昨天。⚠️ 用**马来西亚**的今天往回数，不是这台机的 UTC ——
 *  这个仓库为那八个钟头付过三次学费（任务 168 · 209 · 250）。 */
async function yesterdayMyt() {
  const { data } = await api.rpc("today_myt");
  const t = new Date(`${data}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

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
  const { opened } = await openAllPages(api, { quiet: true });
  for (const need of ["customers", "quotations"]) {
    if (!opened.includes(need)) throw new Error(`没有 ${need} 那一页 —— 道具没摆好`);
  }

  /* ── 道具：两个客人，一个有号码一个没有 ─────────────────────────────
     ⚠️ 每一句写入都当场看回传的错误 —— 一句不看错误的写入，
     跟一句没有写过的写入，在报告里长得一模一样（任务 227）。 */
  const mk = async (name, whatsapp) => {
    const { data, error } = await api.rpc("add_directory_entry", {
      in_project_id: projectId,
      in_module_key: "customers",
      in_name: name,
      in_whatsapp: whatsapp,
    });
    if (error) throw new Error(`add_directory_entry(${name}): ${error.message}`);
    return Array.isArray(data) ? data[0] : data;
  };
  const withNo = await mk("Mrs Lim", "012-345 6789");
  const noNo = await mk("Mr Tan", "");

  const stale = await yesterdayMyt();
  const quote = async (party, title) => {
    const { data, error } = await api.rpc("add_pipeline_record", {
      in_project_id: projectId,
      in_module_key: "quotations",
      in_title: title,
      in_party: party.name,
      in_party_id: party.id,
      in_amount_cents: 480000,
      in_due_on: stale,
      in_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(`add_pipeline_record(${title}): ${error.message}`);
    return Array.isArray(data) ? data[0] : data;
  };
  await quote(withNo, "Kitchen refit");
  await quote(noNo, "Bathroom refit");

  const { data: nudges, error: nErr } = await api.rpc("nudges_due", {
    in_project_id: projectId,
  });
  if (nErr) throw new Error(`nudges_due: ${nErr.message}`);
  const mine = (nudges ?? []).filter((n) => n.kind === "quote_expiring");
  console.log(`\n摆好了：两张过期的报价单，`
    + `其中一个客人有号码。nudges_due 回了 ${mine.length} 条\n`);
  if (mine.length !== 2) throw new Error("道具没摆好 —— 应该是两条");
  const forLim = mine.find((n) => n.party === "Mrs Lim");
  if (!forLim?.body) throw new Error("那一条没有 body —— 资料库那一边还没写那句话");

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  /* wa.me 是外面的网站 —— 让它开就是让这一支去赌一条外网。挡掉。 */
  await context.route(/wa\.me/, (r) => r.abort());
  const page = await context.newPage();
  await page.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 240000 });

  console.log("① 那颗按钮画出来了，而且只画给有号码的那一个");
  await page.goto(`${BASE}/en/portal/today`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(3000);

  const rowOf = (who) =>
    page.locator("li").filter({ hasText: who }).first();
  const linkIn = (who) =>
    rowOf(who).getByRole("link", { name: /send this|发这一则/i });

  ok("Mrs Lim 那一行有「发这一则」", (await linkIn("Mrs Lim").count()) > 0);
  ok(
    "🔴 Mr Tan 那一行没有 —— 他没有号码，而一颗打给空气的按钮是这个仓库禁的第一条",
    (await linkIn("Mr Tan").count()) === 0,
  );

  const href = await linkIn("Mrs Lim").first().getAttribute("href");
  ok(
    "那条连结带国码（012… → 60…）",
    /^https:\/\/wa\.me\/60123456789\?text=/.test(href ?? ""),
    href ?? "没有 href",
  );
  const sent = decodeURIComponent((href ?? "").split("text=")[1] ?? "");
  ok(
    "带的是资料库写好的那一句，不是画面这边另外写的一句",
    sent === forLim.body,
    `连结上是「${sent.slice(0, 40)}…」`,
  );
  ok("那句话里有他的名字", sent.includes("Mrs Lim"), sent.slice(0, 60));

  console.log("\n② 🔴 按下去，这边真的记了一笔");
  const before = await api
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  await linkIn("Mrs Lim")
    .first()
    .click({ timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(3500);
  const { data: msgs, error: mErr } = await api
    .from("messages")
    .select("kind, audience, body, party_id, status, sent_at")
    .eq("project_id", projectId);
  ok("读得到那张表", !mErr, mErr?.message);
  ok(
    "多了一行（本来 " + (before.count ?? 0) + " 行）",
    (msgs ?? []).length === 1,
    `${(msgs ?? []).length} 行`,
  );
  const m = (msgs ?? [])[0] ?? {};
  ok("记的是这一件事", m.kind === "quote_expiring", m.kind);
  ok("记的是讲给客人听的", m.audience === "customer", m.audience);
  ok("记的是那个人", m.party_id === withNo.id, m.party_id);
  ok("原话一字不差", m.body === forLim.body, (m.body ?? "").slice(0, 40));
  ok("状态是发出去了", m.status === "sent", m.status);
  ok("盖了时间章", !!m.sent_at, String(m.sent_at));

  console.log("\n③ 那一行从此讲得出上一次是几时");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForTimeout(3000);
  const said = await rowOf("Mrs Lim").innerText();
  ok(
    "Mrs Lim 那一行写着「讲过」",
    /told|讲过/i.test(said),
    said.replace(/\s+/g, " ").slice(0, 90),
  );
  const otherRow = await rowOf("Mr Tan").innerText();
  ok(
    "而 Mr Tan 那一行没有 —— 没有人跟他讲过",
    !/told|讲过/i.test(otherRow),
    otherRow.replace(/\s+/g, " ").slice(0, 90),
  );
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass} 过 ${fail} 没过`);
process.exitCode = fail ? 1 : 0;
