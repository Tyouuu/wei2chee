/**
 * 报表 and 排名, opened in a browser with real rows behind them.
 *
 * ── WHY A PICTURE AND NOT ONLY THE 31 UNIT TESTS ─────────────────────────
 *
 * The unit tests prove the arithmetic. They cannot prove the WIRE, and the
 * wire is what was missing for these two pages all along -- the projection did
 * not exist, so nothing ever asked the ledger anything on their behalf. This
 * repository has shipped that defect sixteen times and every single one of
 * them was green in the unit tests at the moment it shipped: the assistant
 * that reported 「改了 1 处」 over an unchanged canvas, the register preferences
 * that reached nothing, the ledger whose only writer was a chatbot.
 *
 * So the assertion here is the one a ruler cannot fake: 陈先生 and 李太太 are
 * GONE from the page, and the names this script actually wrote are on it.
 *
 * ⚠️ ON A THROWAWAY ACCOUNT, NOT THE DEMO. The editor autosaves 2.5 seconds
 * after any change, so a script that opens the demo's pages can freeze
 * whatever it put there into the founder's own system -- which is exactly how
 * 兴发装修工程's public headline once became 「二十年装修经验」 and stayed. A
 * fresh signup costs one row and cannot damage anything.
 *
 * Needs `npm run dev` running.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
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

const BASE = "http://localhost:3000";
/* fileURLToPath, NOT url.pathname -- this repository lives in a folder with a
   space in its name and a URL percent-encodes it into a directory that exists,
   is writable, and is not where anybody would look. */
const OUT = fileURLToPath(new URL("../.screenshots/months/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

/** The sample rows every business shares until its own first row exists. If any
 *  of these is still on the page, the projection did not reach it. */
const SAMPLES = ["陈先生", "李太太", "王老板", "Client A", "客户 A", "RM 71,300", "RM 48,500"];

const stamp = Date.now();
const owner = { email: `months-${stamp}@formae.test`, password: `Months-${stamp}-x!` };
let userId = null;

/** Backdated by whole days so the months land where they are meant to, read in
 *  Malaysia -- the same reason today_myt() exists in the database. */
const dayIn = (daysBack) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(
    new Date(),
  );
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - daysBack)).toISOString().slice(0, 10);
};

const browser = await chromium.launch();
try {
  const { data: made, error } = await admin.auth.admin.createUser({
    email: owner.email,
    password: owner.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  userId = made.user.id;

  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", userId)
    .single();
  if (!proj?.id) throw new Error("the signup trigger did not provision a project");
  const P = proj.id;

  /* A provisioned system, so the pages render the way a customer's would --
     WITHOUT a style, /portal redirects to the one-time style gate and every
     page below would have been photographed as the style picker.

     ⚠️ The error is read. The first run passed `company_name`, which is not a
     column (it is `business_name`); PostgREST rejected the WHOLE update, the
     style stayed null, and the script cheerfully screenshotted the gate and
     reported nine failures against code that was fine. A write whose error
     nobody reads is a write that did not happen. */
  const { error: upErr } = await admin
    .from("projects")
    .update({
      style: "ledger",
      palette: "clean-slate",
      system_language: "zh",
      business_name: "旺发通讯",
    })
    .eq("id", P);
  if (upErr) throw new Error(`could not provision the test project: ${upErr.message}`);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const inErr = (await as.auth.signInWithPassword(owner)).error;
  if (inErr) throw new Error(`sign-in: ${inErr.message}`);

  /* Through the same function the rail's 「＋」 calls, never an insert. */
  for (const key of ["reports", "ranking"]) {
    const { error: e } = await as.rpc("add_project_page", {
      requested_key: key,
      new_title: null,
    });
    if (e) throw new Error(`add_project_page(${key}): ${e.message}`);
  }

  /* Real money, written the way a person writes it. Three counterparties, one
     of whom is deliberately falling: 顺发 took RM 4,000 in the earlier half of
     the window and RM 300 in the recent half. */
  /* ⚠️ THE DAYS ARE IN THE PAST, WHICH THE FIRST RUN'S PICTURE TAUGHT ME.
     Day 2 and day 3 of THIS month are in the future on the 1st, so every row's
     「最近一次」 read 「今天」 and the column looked broken. The code was right;
     the props were not. Backdating by days keeps every date behind today
     whatever day of the month this is run on. */
  const money = [
    ["旺来贸易", 96, 3200],
    ["旺来贸易", 61, 5100],
    ["旺来贸易", 34, 4700],
    ["旺来贸易", 0, 6800],
    ["顺发五金", 58, 4000],
    ["顺发五金", 1, 300],
    ["美嘉美容", 25, 1500],
    ["美嘉美容", 2, 900],
  ];
  for (const [party, daysBack, ringgit] of money) {
    const { error: e } = await as.rpc("add_ledger_entry", {
      in_project_id: P,
      in_module_key: "payments",
      in_direction: "in",
      in_amount_cents: ringgit * 100,
      in_party: party,
      in_entry_on: dayIn(daysBack),
    });
    if (e) throw new Error(`add_ledger_entry(${party}): ${e.message}`);
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[type="email"]', owner.email);
  await page.fill('input[type="password"]', owner.password);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(/portal/, { timeout: 60000 });
  } catch {
    /* Say WHERE it stopped. 「Timeout」 on its own sent me looking at the
       selectors when the answer was on the screen. */
    await page.screenshot({ path: `${OUT}/login-stuck.png`, fullPage: true });
    throw new Error(`login did not reach the portal: ${page.url()} — ${(await page.innerText("body")).slice(0, 300)}`);
  }

  /** ⚠️ innerText, never the markup. 「量一个跟画面无关的代理指标，就是一把尺
   *  说谎却印出漂亮数字的方式」 -- three rulers in this repo lied that way. */
  const read = async (url, name, width = 1440) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const text = await page.evaluate(() => document.body.innerText);
    return text;
  };

  console.log("\n报表：");
  const report = await read("/zh/portal/reports", "reports-1440");
  check(
    "本月收到 is on the page in as many words",
    report.includes("本月收到"),
    "the tile that defines what 营业额 means here",
  );
  check("the months are his own", /\d{4} 年 \d{1,2} 月/.test(report));
  check(
    "no sample survived",
    !SAMPLES.some((s) => report.includes(s)),
    SAMPLES.filter((s) => report.includes(s)).join(" "),
  );
  /* DERIVED FROM THE SAME DATES THE ROWS WERE WRITTEN WITH, never hardcoded.
     The first version's 「RM 8,000」 was worked out on paper for a set of dates
     I then changed, and it failed against a page that was correct -- a ruler
     that has to be edited whenever the fixture moves is a ruler that will one
     day be edited to agree with a bug. */
  const thisMonth = dayIn(0).slice(0, 7);
  const mine = money.filter(([, back]) => dayIn(back).startsWith(thisMonth));
  const total = mine.reduce((n, [, , r]) => n + r, 0);
  check(
    `this month adds up to RM ${total.toLocaleString("en-MY")}`,
    report.includes(`RM ${total.toLocaleString("en-MY")}`),
    `${mine.length} of ${money.length} rows are in ${thisMonth}`,
  );
  check(
    `笔数 counts entries, not ringgit (${mine.length})`,
    /* `[^]`, not `[\s\S]`: inside a TEMPLATE LITERAL the backslash is eaten
       before RegExp ever sees it, so the class became [sS] and could not cross
       the newline between the label and its figure. It failed against a page
       that was correct -- the third time in this session that a ruler, not the
       product, was the thing at fault. */
    new RegExp(`笔数[^]{0,40}${mine.length} 笔`).test(report),
  );
  /* 🔴 From the picture: a month whose predecessor was empty was labelled
     「持平」 -- RM 3,200 against nothing is not level pegging -- and the oldest
     row claimed 「第一个月」 about a business whose earlier months had simply
     not been fetched. Seven are counted now and six are shown. */
  check("never claims a first month it did not look for", !report.includes("第一个月"));

  console.log("\n排名：");
  const rank = await read("/zh/portal/ranking", "ranking-1440");
  check("his own counterparties are on it", rank.includes("旺来贸易") && rank.includes("顺发五金"));
  check(
    "no sample survived",
    !SAMPLES.some((s) => rank.includes(s)),
    SAMPLES.filter((s) => rank.includes(s)).join(" "),
  );
  check("the one that is falling is marked 退步中", rank.includes("退步中"));
  check("the biggest is 顶级", rank.includes("顶级"));
  check("it says how long ago, not a raw date", /(今天|\d+ 天前)/.test(rank));
  /* 🔴 Found in the first picture, not by any assertion: every row read 「今天」
     because the script had written tomorrow's dates. The page was right and
     the props were wrong -- which is the harder of the two to see. */
  check("the days ago are actually different", new Set(rank.match(/\d+ 天前/g) ?? []).size >= 2);
  /* 🔴 Also from the picture: the chart was drawn with a caption promising
     「顶级和活跃加起来的人数」 and counts everybody who had a record. A tier is
     worked out over the whole window, so that caption cannot be made true --
     the projection renames its own chart. */
  check("the chart says what it actually counted", rank.includes("每个月有来往的人数"));
  check("and not the caption it was drawn with", !rank.includes("顶级和活跃加起来的人数"));

  console.log("\n手机上（390，他的客人站的地方）：");
  const rank390 = await read("/zh/portal/ranking", "ranking-390", 390);
  check("still his rows at 390", rank390.includes("旺来贸易"));

  console.log("\n判：");
  console.log(`  ${failed.length ? `${failed.length} FAILED` : "all good"} — ${OUT}`);
} finally {
  await browser.close();
  /* The account and everything cascading off it. A ruler that leaves rows
     behind becomes a ruler nobody dares run twice. */
  if (userId) await dropThrowaway(admin, userId);
}

process.exit(failed.length ? 1 : 0);
