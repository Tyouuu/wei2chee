/**
 * The four new kinds of page, opened with real rows behind them.
 *
 * ── WHY A PICTURE AND NOT ONLY THE UNIT TESTS ──────────────────────────────
 *
 * The unit tests prove the tree has a board in it. They cannot prove the wire,
 * and the wire is the thing that has failed sixteen times in this repository:
 * a block that renders correctly and never receives the customer's own data.
 * The detail panel is the sharpest case yet, because failure there is not a
 * blank -- it is 陈先生 sitting a column away from the owner's real customers,
 * two things on one screen contradicting each other.
 *
 * So the assertions are: the samples are GONE, and the names this script wrote
 * are on the page, in the new block specifically.
 *
 * ⚠️ THROWAWAY ACCOUNT, NOT THE DEMO. The editor autosaves 2.5s after any
 * change, so a script that opens the demo's pages can freeze whatever it put
 * there into the founder's own live system -- which is how 兴发装修工程's public
 * headline once became 「二十年装修经验」 and stayed.
 *
 * Needs `npm run dev`.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

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
const OUT = fileURLToPath(new URL("../.screenshots/kinds/", import.meta.url));
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

/** The rows every business shares until its own first row exists. */
const SAMPLES = ["陈先生", "李太太", "王老板", "Mr Tan", "Mrs Lee", "Mr Wong"];

const stamp = Date.now();
const cred = { email: `kinds-${stamp}@formae.test`, password: `Kinds-${stamp}-x!` };
let userId = null;
let leadId = null;

const dayIn = (back) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
};

const browser = await chromium.launch();
try {
  const { data: ind } = await admin.from("industries").select("id").eq("slug", "renovation").single();
  const { data: lead } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "page kinds" } })
    .select("id")
    .single();
  leadId = lead.id;

  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
    user_metadata: { lead_id: leadId },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  userId = user.user.id;

  const { data: proj } = await admin.from("projects").select("id").eq("account_id", userId).single();
  /* ⚠️ The error is READ. A sibling script once passed a column that does not
     exist; PostgREST rejected the whole update, the style stayed null, /portal
     redirected to the style gate and it photographed the picker while reporting
     nine failures against correct code. */
  const { error: upErr } = await admin
    .from("projects")
    .update({ style: "ledger", palette: "clean-slate", system_language: "en", paid: true })
    .eq("id", proj.id);
  if (upErr) throw new Error(`could not provision: ${upErr.message}`);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in: ${sErr.message}`);

  /* Through the same functions the 加一单 button calls, never an insert. */
  for (const key of ["projects", "customers", "suppliers"]) {
    const { error: e } = await as.rpc("add_project_page", { requested_key: key, new_title: null });
    if (e && !String(e.message).includes("exists")) throw new Error(`add_project_page(${key}): ${e.message}`);
  }

  const jobs = [
    ["Sunway Damansara kitchen", "Ang Chee Keong", 4850000],
    ["Puchong shoplot fitout", "Norhaslinda Binti Rahim", 9600000],
    ["Setapak bathroom", "Vimala Devi", 2280000],
  ];
  for (const [title, party, cents] of jobs) {
    const { error: e } = await as.rpc("add_pipeline_record", {
      in_project_id: proj.id,
      in_module_key: "projects",
      in_title: title,
      in_party: party,
      in_amount_cents: cents,
      in_issued_on: dayIn(5),
    });
    if (e) throw new Error(`add_pipeline_record: ${e.message}`);
  }
  for (const [name, phone] of [
    ["Ang Chee Keong", "012-337 8890"],
    ["Norhaslinda Binti Rahim", "017-882 4410"],
  ]) {
    const { error: e } = await as.rpc("add_directory_entry", {
      in_project_id: proj.id,
      in_module_key: "customers",
      in_name: name,
      in_phone: phone,
    });
    if (e) throw new Error(`add_directory_entry: ${e.message}`);
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[type="email"]', cred.email);
  await page.fill('input[type="password"]', cred.password);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(/portal/, { timeout: 60000 });
  } catch {
    await page.screenshot({ path: `${OUT}/login-stuck.png`, fullPage: true });
    throw new Error(`login stopped at ${page.url()}`);
  }

  /** innerText, never markup. Three rulers in this repo have lied by measuring
   *  something the screen does not show. */
  const read = async (path, shot, width = 1440) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
    return page.evaluate(() => document.body.innerText);
  };

  console.log("\n看板 — 工程:");
  const projects = await read("/en/portal/projects", "projects-1440");
  check("his own jobs are on it", projects.includes("Sunway Damansara kitchen"));
  check("no sample survived", !SAMPLES.some((s) => projects.includes(s)),
    SAMPLES.filter((s) => projects.includes(s)).join(" "));
  check("the board's columns are this trade's own steps",
    /Quot|Deposit|Build|Enquiry|Site/i.test(projects), projects.slice(0, 120));

  /* 🔴 THE ONE THE PICTURE CAUGHT AND FOURTEEN ASSERTIONS DID NOT. The first
     run drew six EMPTY columns above a table holding these three jobs: the
     projection filtered out every row whose stage was not already a column, so
     the page told the owner he had no work while the table under it listed it.
     「his own jobs are on it」 passed because it was reading the table.

     Counted inside the board specifically, never in the page text. */
  const onBoard = await page.evaluate(() => {
    const col = [...document.querySelectorAll("*")].find(
      (el) => el.textContent?.trim() === "Enquiry",
    );
    const board = col?.closest("div")?.parentElement?.parentElement;
    return (board?.textContent ?? "").includes("Sunway Damansara kitchen");
  });
  check("his jobs are ON THE BOARD, not only in the table below it", onBoard);

  console.log("\n左清单右详情 — 客户:");
  const customers = await read("/en/portal/customers", "customers-1440");
  check("his own customers are on it", customers.includes("Ang Chee Keong"));
  check("no sample survived", !SAMPLES.some((s) => customers.includes(s)),
    SAMPLES.filter((s) => customers.includes(s)).join(" "));
  /* 🔴 THE ONE THAT MATTERS. Without the projection arm the panel keeps 陈先生
     while the table one column away shows his real customers. */
  check("the detail panel shows HIS row, not the sample",
    customers.includes("012-337 8890"), "the phone number this script wrote");

  /* 🔴 AND THE ONE THE FIRST VERSION GOT WRONG, which no assertion caught and
     the picture did: the projection zipped labels against whichever values
     happened to be non-empty, so a record with no status shifted everything up
     one and the panel read 「Contact / notes: Ang Chee Keong」. A label beside
     the wrong value is worse than a sample, because a sample announces itself. */
  const pairs = await page.evaluate(() => {
    const panel = [...document.querySelectorAll("*")].find(
      (el) => el.textContent?.trim() === "Contact / notes",
    );
    const row = panel?.closest("li, div");
    return (row?.textContent ?? "").replace(/\s+/g, " ").trim();
  });
  check("the label sits beside its own value", /012-337 8890/.test(pairs), `read: ${pairs}`);

  /* The two columns must not sit on top of each other. `Columns` is used on the
     总览 too, but never before with a bordered panel in the second cell, which
     is what makes an overlap visible rather than merely wrong. */
  const boxes = await page.evaluate(() => {
    const el = (t) => [...document.querySelectorAll("table, section, div")]
      .map((n) => ({ n, r: n.getBoundingClientRect() }))
      .filter(({ n, r }) => n.textContent?.includes(t) && r.width > 120 && r.height > 40)
      .sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height)[0]?.r;
    const table = el("012-337 8890");
    const heading = el("Contact / notes");
    return table && heading
      ? { tableRight: Math.round(table.right), panelLeft: Math.round(heading.left) }
      : null;
  });
  check(
    "the list and the panel do not sit on top of each other",
    !!boxes && boxes.tableRight <= boxes.panelLeft + 2,
    JSON.stringify(boxes),
  );

  console.log("\n单据 — 报价单:");
  const quotes = await read("/en/portal/quotations", "quotations-1440");
  check("the document is beside the list", /Terms|Signature/i.test(quotes), quotes.slice(0, 160));
  check("and it is signable", /Signature/i.test(quotes) && /Date/i.test(quotes));

  console.log("\n日历 — 预约:");
  const { error: bErr } = await as.rpc("add_project_page", { requested_key: "bookings", new_title: null });
  if (bErr && !String(bErr.message).includes("exists")) throw new Error(`bookings: ${bErr.message}`);
  const bookings = await read("/en/portal/bookings", "bookings-1440");
  /* ⚠️ THE RULER WAS WRONG HERE FIRST, not the product. It looked for weekday
     names; WeekStrip prints DATES -- 「Sep 2 · Sep 3 · Sep 4」 -- which is what a
     salon owner scans for and is a deliberate choice in that component. */
  check("the week strip is on the page",
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/.test(bookings),
    bookings.slice(0, 160));
  check("and a day with hours in it", /\d{1,2}:\d{2}/.test(bookings));

  console.log("\n手机上（390，他自己站的地方）:");
  const p390 = await read("/en/portal/projects", "projects-390", 390);
  check("the board still carries his jobs at 390", p390.includes("Sunway Damansara kitchen"));
  const c390 = await read("/en/portal/customers", "customers-390", 390);
  check("the split page still carries his customers at 390", c390.includes("Ang Chee Keong"));

  console.log("\n判：");
  console.log(`  ${failed.length ? `${failed.length} FAILED` : "all good"} — ${OUT}`);
} finally {
  await browser.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
}

process.exit(failed.length ? 1 : 0);
