/**
 * 那一页上四支「读」，四支都没有门 —— 用眼睛看一次。
 *
 * ① `set_reconciliation_archived` 20260902020000 起零个呼叫。
 *    🔴 而那不是「少一颗按钮」：那颗「收起来」**画得出来、按得下去、
 *    什么都不会发生** —— 那一串三元把对帐当成走单，而
 *    `set_pipeline_archived` 根本找不到那一行。
 * ② `rentals_of` 20260905540000 起零个呼叫。`/rentals` 那一页只回
 *    **还没还的**，所以它答不了「这一单借过什么、几时还的、迟了几天」。
 * ③ `party_deposit` 20260905140000 起零个呼叫，而客户那一页自己
 *    用 TypeScript 加了一份 —— 同一个问题两份实作（任务 216）。
 * ④ `commission_schemes_of` 20260905650000 起零个呼叫，而那一页
 *    把「同一天只算后存的那一份」在 TypeScript 里重写了一遍，
 *    并且丢掉了它多回的那一样：`used_this_month`。
 *
 * ⚠️ 用完就删的帐号。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/record-doors";
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const stamp = Date.now();
const EMAIL = `doors-${stamp}@formae.test`;
const PASSWORD = `Doors-${stamp}-x!`;

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

const bad = [];
let userId = null;
let browser;
const say = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};
/* 一句不看错误的写入，跟一句没有写过的写入，在报告里长得一模一样。 */
const must = (what, r) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};
const monthOf = (n) => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

try {
  const made = must(
    "createUser",
    await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    }),
  );
  userId = made.user.id;
  dropThrowawayOnExit(admin, () => userId);
  must(
    "signIn",
    await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD }),
  );
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", userId)
    .single();
  const P = proj.id;

  for (const key of [
    "reconciliation",
    "orders",
    "customers",
    "staff",
    "inventory",
    "payments",
  ]) {
    const r = await api.rpc("add_project_page", {
      requested_key: key,
      new_title: null,
    });
    if (r.error && !String(r.error.message).includes("exists")) {
      throw new Error(`add_project_page(${key}): ${r.error.message}`);
    }
  }

  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 240000 });
  const hide = () =>
    page
      .addStyleTag({ content: "nextjs-portal{display:none!important}" })
      .catch(() => {});
  const open = async (url, shot) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.waitForTimeout(1800);
    await hide();
    if (shot) {
      await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
      console.log(`拍到  ${shot}`);
    }
    return (await page.locator("body").innerText()).replace(/\s+/g, " ");
  };

  /* ── ① 对帐那一页的「收起来」真的收得起来 ──────────────────────── */
  console.log("\n① 收起来一份对帐");
  const recId = must(
    "add_reconciliation",
    await api.rpc("add_reconciliation", {
      in_project_id: P,
      in_module_key: "reconciliation",
      in_period: `${monthOf(-1)}-01`,
      in_source: "Maybank statement",
      in_their_cents: 3800000,
      in_direction: "in",
    }),
  );
  await open(`${BASE}/en/portal/reconciliation/${recId}`, "1-recon");
  const arch = page.getByRole("button", { name: /^Put away$/i });
  say("那颗「收起来」在", (await arch.count()) === 1, `${await arch.count()} 颗`);
  await arch.click();
  await page.waitForTimeout(3500);
  const { data: after } = await api
    .from("reconciliations")
    .select("archived_at")
    .eq("id", recId)
    .maybeSingle();
  /* 🔴 这一条就是那个洞：2026-09-07 之前它打的是走单那一支，
     而那一支根本找不到这一行 —— 按下去什么都不会发生。 */
  say("🔴 按下去，资料库里那一份真的收起来了", !!after?.archived_at, `${after?.archived_at}`);

  /* ── ② 这一单借出去的东西 ────────────────────────────────────── */
  console.log("\n② 这一单借出去的东西");
  const job = must(
    "add_pipeline_record",
    await api.rpc("add_pipeline_record", {
      in_project_id: P,
      in_module_key: "orders",
      in_title: "Wedding at Ipoh Garden",
      in_party: "Mrs Lim",
      in_amount_cents: 480000,
    }),
  );
  const jobUrl = `${BASE}/en/portal/orders/${job.id}`;
  /* 控制组：还没借过东西的时候整段不画 —— 少了这一条，
     下面那一条量的是「它永远都画」（任务 125 学到的）。 */
  let seen = await open(jobUrl, "2-job-before");
  say(
    "🔴 一件都没借过就整段不画（控制组）",
    (await page.locator("[data-rentals-on-job]").count()) === 0,
  );
  const today = new Date();
  const ago = (n) =>
    new Date(today.getTime() - n * 86400e3).toISOString().slice(0, 10);
  must(
    "lend_item(late)",
    await api.rpc("lend_item", {
      in_record_id: job.id,
      in_descr: "Round tables",
      in_qty: 10,
      in_out_on: ago(9),
      in_due_back_on: ago(3),
    }),
  );
  const backOne = must(
    "lend_item(returned)",
    await api.rpc("lend_item", {
      in_record_id: job.id,
      in_descr: "Marquee",
      in_qty: 1,
      in_out_on: ago(9),
      in_due_back_on: ago(5),
    }),
  );
  must(
    "return_rental",
    await api.rpc("return_rental", {
      in_rental_id: backOne.id ?? backOne,
      in_returned_on: ago(2),
    }),
  );
  seen = await open(jobUrl, "3-job-lent");
  const panel = page.locator("[data-rentals-on-job]");
  say("🔴 那一段出来了", (await panel.count()) === 1, seen.slice(0, 200));
  const lentText = (await panel.innerText()).replace(/\s+/g, " ");
  say("还没还的那一件在", /Round tables/.test(lentText), lentText);
  /* 🔴 迟几天由资料库照马来西亚的今天算 —— 画面不再减一次
     （这个仓库为那八个钟头付过三次学费）。 */
  const { data: dbLent } = await api.rpc("rentals_of", {
    in_record_id: job.id,
  });
  const late = (dbLent ?? []).find((r) => r.descr === "Round tables");
  say(
    "迟了几天，跟资料库一样",
    lentText.includes(`${late.days_over} days late`),
    `${lentText} · db=${late.days_over}`,
  );
  /* ⚠️ 已经还回来的那一件也要在 —— `/rentals` 那一页看不到它，
     而那正是这一段存在的理由。 */
  say("🔴 已经还回来的那一件也在（那一页看不到它）", /Marquee/.test(lentText), lentText);
  /* 🔴 同一屏上不可以有两句一样的话指两个不同的动作。
     「Came back」那一段（客人退货）上面就有一颗「Record a return」——
     而这一段底下那一条是**去哪里**，不是一个动作。 */
  const dupes = (seen.match(/Record a return/g) ?? []).length;
  say("🔴 「Record a return」整屏只出现一次", dupes === 1, `${dupes} 处`);
  say("而且讲得出几时还的", /back on \d{4}-\d{2}-\d{2}/.test(lentText), lentText);

  /* ── ③ 他先付了、还没用掉的钱 —— 画面上那个数字问的是资料库 ──── */
  console.log("\n③ 已付、还没用掉");
  const cust = must(
    "add_directory_entry",
    await api.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "customers",
      in_name: "Mrs Lim",
    }),
  );
  const custId = cust.id ?? cust;
  must(
    "add_ledger_entry",
    await api.rpc("add_ledger_entry", {
      in_project_id: P,
      in_module_key: "payments",
      in_amount_cents: 100000,
      in_party: "Mrs Lim",
      in_party_id: custId,
    }),
  );
  const custUrl = `${BASE}/en/portal/customers/${custId}`;
  seen = await open(custUrl, "4-customer");
  const { data: dep } = await api.rpc("party_deposit", {
    p_project_id: P,
    p_party_id: custId,
  });
  say("🔴 资料库那一支答得出来", Number(dep) === 100000, `${dep}`);
  say(
    "🔴 画面上那个数字就是它算的",
    seen.includes("RM 1,000"),
    `${seen.slice(0, 400)} · db=${dep}`,
  );

  /* ── ④ 佣金：哪一份办法是这个月照着算的 ────────────────────── */
  console.log("\n④ 这个月照哪一份办法");
  const staff = must(
    "add_directory_entry(staff)",
    await api.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "staff",
      in_name: "Aida",
    }),
  );
  const staffId = staff.id ?? staff;
  /* 两份世代：上上个月一成，这个月一号一成半。
     🔴 而**同一天存两份**（上上个月），因为「同一天只算后存的那一份」
     正是这一支比 TypeScript 那一份多做的事。 */
  const twoAgo = `${monthOf(-2)}-01`;
  must(
    "set_commission_tiers(old A)",
    await api.rpc("set_commission_tiers", {
      in_party_id: staffId,
      in_tiers: [{ from_cents: 0, percent: 8 }],
      in_effective_from: twoAgo,
    }),
  );
  must(
    "set_commission_tiers(old B, same day)",
    await api.rpc("set_commission_tiers", {
      in_party_id: staffId,
      in_tiers: [{ from_cents: 0, percent: 10 }],
      in_effective_from: twoAgo,
    }),
  );
  must(
    "set_commission_tiers(now)",
    await api.rpc("set_commission_tiers", {
      in_party_id: staffId,
      in_tiers: [{ from_cents: 0, percent: 15 }],
      in_effective_from: `${monthOf(0)}-01`,
    }),
  );
  seen = await open(`${BASE}/en/portal/staff/${staffId}`, "5-staff");
  const { data: schemes } = await api.rpc("commission_schemes_of", {
    in_party_id: staffId,
  });
  const used = (schemes ?? []).filter((s) => s.used_this_month);
  say("🔴 资料库说刚好一份是这个月照着算的", used.length === 1, `${used.length} 份`);
  say(
    "🔴 画面上标出来的也刚好一份",
    (seen.match(/used this month/g) ?? []).length === 1,
    `${(seen.match(/used this month/g) ?? []).length} 处`,
  );
  /* 🔴 同一天存了两份，画面上只可以列一份 —— 两份都列，
     等於画面在讲一份已经作废的办法，而他分不出是哪一份。 */
  say(
    "同一天存两次，只列后存的那一份",
    (seen.match(new RegExp(twoAgo, "g")) ?? []).length === 1,
    `${(seen.match(new RegExp(twoAgo, "g")) ?? []).length} 处`,
  );

  /* ── ⑤ 390 ────────────────────────────────────────────────── */
  console.log("\n⑤ 390");
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 240000 });
  await phone.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 240000 });
  await phone.waitForTimeout(2000);
  await phone
    .addStyleTag({ content: "nextjs-portal{display:none!important}" })
    .catch(() => {});
  await phone.screenshot({ path: `${OUT}/6-phone-390.png`, fullPage: true });
  console.log("拍到  6-phone-390");
  say("那一段在手机上也在", (await phone.locator("[data-rentals-on-job]").count()) === 1);
  const wide = await phone.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  say("手机上不用左右滑", !wide);
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
}

console.log(`\n判：${bad.length} 项没过`);
for (const b of bad) console.log(`  · ${b}`);
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);
process.exitCode = bad.length ? 1 : 0;
