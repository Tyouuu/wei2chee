/**
 * 「这张单我叫了多少、到了多少、付了多少 —— 对得上吗？」用眼睛看。
 *
 * `check:purchase-match` 拿真身分打过那一支了，而它答不了一件事：
 * **他在那一页上看不看得到那三个数字。**
 * `purchase_match` 从 20260906070000 起就在，到 2026-09-07 为止
 * 画面上一个入口都没有。
 *
 * ── 这一支走的顺序，就是一车货真的会走的顺序 ──────────────────────────────
 *
 *   开一张进货单        -> 什么都还没发生，不可以讲成警报
 *   先付了钱            -> 🔴 钱付了货没到（他会赔钱的那一种）
 *   货到了              -> 对得上，而且那一条安静下来
 *
 * ⚠️ 每一步之后都回资料库问一次 —— 画面上那三个数字要跟那一支算的一样。
 * 一个自己在浏览器里算一次的画面，就是同一个问题两个答案。
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
const OUT = ".screenshots/purchase-match";
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const stamp = Date.now();
const EMAIL = `pmatch-${stamp}@formae.test`;
const PASSWORD = `Pmatch-${stamp}-x!`;

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
const must = (what, { error }) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};
/* 🔴 排版照产品自己那一支（`ringgit`：整数不印小数 —— 那是承包商写钱的写法）。
   第一版我在这里自己写了一份 toFixed(2)，於是三条红看起来像那三个数字算错了，
   而画面从头到尾是对的。**把排版反过来，不要再抄一份排版**（任务 203 付过一次）。 */
const rm = (cents) => {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", {
    minimumFractionDigits: whole % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

/** 资料库自己算的那三个数字 —— 画面上那三个要跟它一样。 */
const askDb = async (recordId) => {
  const { data, error } = await api.rpc("purchase_match", {
    in_record_id: recordId,
  });
  if (error) throw new Error(`purchase_match: ${error.message}`);
  return data[0];
};

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  dropThrowawayOnExit(admin, () => userId);
  must("signIn", await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD }));
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", userId)
    .single();
  const P = proj.id;

  /* 台面。八个行业开局都没有进货单那一页 —— 道具，不是产品的洞。
     ⚠️ 而 `add_project_page` 会把它需要的「供应商」那一页一起开出来
     （20260906640000 · 任务 215），所以这里只要一句。 */
  must(
    "add_project_page(purchases)",
    await api.rpc("add_project_page", {
      requested_key: "purchases",
      new_title: null,
    }),
  );
  /* 🔴 收货要一页货架 —— `receive_purchase` 没有货架就一件都不动
     （`if shelf is not null`，20260905330000）。第一版漏了这一页，
     於是「到齐了」那三条红看起来像收货坏了，而它正确地什么都没做。 */
  must(
    "add_project_page(inventory)",
    await api.rpc("add_project_page", {
      requested_key: "inventory",
      new_title: null,
    }),
  );
  must(
    "add_directory_entry",
    await api.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "suppliers",
      in_name: "Chin Hin Cement",
    }),
  );

  /* ① 开一张进货单 —— 一个动作。 */
  const { data: po, error: poErr } = await api.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "purchases",
    in_title: "Cement and sand",
    in_party: "Chin Hin Cement",
    in_amount_cents: 185000,
  });
  if (poErr) throw new Error(`add_pipeline_record: ${poErr.message}`);
  const rec = po.id;
  must(
    "set_record_lines",
    await api.rpc("set_record_lines", {
      in_record_id: rec,
      in_lines: [
        { description: "Cement 50kg", qty: 100, unit: "bag", unit_price_cents: 1500 },
        { description: "River sand", qty: 2, unit: "load", unit_price_cents: 17500 },
      ],
    }),
  );

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 240000 });
  const hide = () =>
    page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  const url = `${BASE}/en/portal/purchases/${rec}`;
  const open = async (shot) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.waitForSelector("[data-purchase-match]", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await hide();
    await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
    console.log(`拍到  ${shot}`);
    return (await page.locator("[data-purchase-match]").innerText()).replace(/\s+/g, " ");
  };

  console.log("\n① 刚开的一张单");
  let seen = await open("1-fresh");
  say("🔴 那三个数字在这一页上", (await page.locator("[data-purchase-match]").count()) === 1, seen);
  /* 🔴 一张什么都还没发生的新单不是「对不上」—— 那是它大部分时间的样子，
     讲成警报就是天天叫狼。 */
  say(
    "🔴 什么都还没发生的时候不画那条警报带",
    (await page.locator("[data-match-alarm]").count()) === 0,
    seen,
  );
  let db = await askDb(rec);
  say("叫了多少，跟资料库一样", seen.includes(rm(Number(db.ordered_cents))), `${seen} · db=${db.ordered_cents}`);
  say("到了几行，跟资料库一样", seen.includes(`${db.lines_arrived}/${db.lines_total}`), seen);
  say("还欠多少，跟资料库一样", seen.includes(rm(Number(db.unpaid_cents))), `${seen} · db=${db.unpaid_cents}`);

  console.log("\n② 先付了钱，货还没到 —— 他会赔钱的那一种");
  must(
    "add_ledger_entry",
    await api.rpc("add_ledger_entry", {
      in_project_id: P,
      in_module_key: "expenses",
      in_amount_cents: 185000,
      in_party: "Chin Hin Cement",
      in_note: "Cement and sand",
      in_against_id: rec,
    }),
  );
  seen = await open("2-paid-nothing-here");
  db = await askDb(rec);
  say("🔴 那条警报带出来了", (await page.locator("[data-match-alarm]").count()) === 1, seen);
  say("而且讲的是「钱付了，货还没到」", /nothing has arrived/i.test(seen), seen);
  say("付了多少，跟资料库一样", seen.includes(rm(Number(db.paid_cents))), `${seen} · db=${db.paid_cents}`);
  /* ⚠️ 还欠 0 的时候不画那一格 —— 一个永远写着 RM 0 的格子是杂讯。 */
  say("付清了就不再印「还欠」", Number(db.unpaid_cents) === 0 && !/Still owed/i.test(seen), seen);

  console.log("\n③ 货到了 —— 对得上，而那一条安静下来");
  must("receive_purchase", await api.rpc("receive_purchase", { in_record_id: rec }));
  seen = await open("3-settled");
  db = await askDb(rec);
  say("🔴 到齐了，那条警报带收起来", (await page.locator("[data-match-alarm]").count()) === 0, seen);
  say("而且讲得出「对得上」", /adds up/i.test(seen), seen);
  say("到了几行变成到齐（跟资料库一样）", seen.includes(`${db.lines_arrived}/${db.lines_total}`), `${seen} · db=${db.lines_arrived}/${db.lines_total}`);
  say("资料库那一边也说到齐了（控制组）", db.arrived === true, `${db.arrived}`);

  console.log("\n④ 别的页面不画这一条");
  /* 控制组：一张报价单不是进货单，而 `purchase_match` 对它会抛。
     少了这一条，上面每一条量的是「它永远都画」。 */
  must("add_project_page(quotations)", await api.rpc("add_project_page", {
    requested_key: "quotations",
    new_title: null,
  }));
  const { data: q } = await api.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "quotations",
    in_title: "Kitchen refit",
    in_party: "Mrs Lim",
    in_amount_cents: 4850000,
  });
  await page.goto(`${BASE}/en/portal/quotations/${q.id}`, {
    waitUntil: "domcontentloaded",
    timeout: 240000,
  });
  await page.waitForTimeout(1500);
  say(
    "🔴 报价单上一个字都没有（控制组）",
    (await page.locator("[data-purchase-match]").count()) === 0,
  );

  console.log("\n⑤ 390 —— 他在工地上也会看");
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 240000 });
  await phone.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
  await phone.waitForTimeout(2000);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/4-phone-390.png`, fullPage: true });
  console.log("拍到  4-phone-390");
  say("那三个数字在手机上也在", (await phone.locator("[data-purchase-match]").count()) === 1);
  /* 🔴 一个断成两行的金额，读起来是一个错的数字（任务 107u · 141d）。 */
  const split = await phone.evaluate(() => {
    const out = [];
    const box = document.querySelector("[data-purchase-match]");
    for (const dd of box ? box.querySelectorAll("dd") : []) {
      const r = new Range();
      r.selectNodeContents(dd);
      /* 🔴 数的是**行**，不是矩形。`getClientRects()` 一个文字节点回一个矩形，
         而 React 把 {2}/{2} 画成三个文字节点 —— 第一版因此把一个好好的
         「2/2」报成断成两行。**量到的东西不是画面上的东西**（第 N 次）。
         同一行的矩形上缘一样，所以按上缘去重才是「几行」。 */
      const tops = new Set(
        [...r.getClientRects()].map((x) => Math.round(x.top)),
      );
      if (tops.size > 1) out.push(dd.textContent.trim());
    }
    return out;
  });
  say("🔴 手机上没有一个金额断成两行", split.length === 0, split.join(" · "));
  const wide = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
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
