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

  console.log("");
  console.log("填表 + 即时预览 — 报价单那一页:");
  const formBoxes = page.locator("form input");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/en/portal/quotations/new`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  /* Typed, not written into React state: what is under test is that the paper
     follows the keystrokes. `fill` dispatches the events React listens for. */
  await formBoxes.nth(0).fill("Sunway Damansara kitchen");
  await formBoxes.nth(1).fill("Ang Chee Keong");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/new-quotation-1440.png`, fullPage: true });

  const aside = await page.evaluate(() => {
    const a = document.querySelector("aside");
    return a ? { text: a.innerText, left: Math.round(a.getBoundingClientRect().left) } : null;
  });
  check("there is a document beside the form", !!aside, "no aside on the page");
  check("it follows what is being typed",
    !!aside && aside.text.includes("Sunway Damansara kitchen"),
    aside ? aside.text.slice(0, 140) : "");
  check("and who it is for", !!aside && aside.text.includes("Ang Chee Keong"));
  /* The number is issued by next_doc_no() INSIDE the write. Anything printed
     before saving is a guess sitting where the real one goes, which is the
     worst place in this system to be wrong. */
  check("it does not invent a document number",
    !!aside && !/(QT|PO|SO|RC)-\d{4}-\d+/.test(aside.text),
    aside ? aside.text.slice(0, 140) : "");
  check("it is beside the form and not under it at 1440",
    !!aside && aside.left > 560, aside ? `left=${aside.left}` : "");

  /* THE ONE THE PICTURE CAUGHT AND SIX ASSERTIONS DID NOT.

     The first version painted the card with --color-paper and wrote on it with
     --color-on-canvas. On 台账 both resolve to #14273d -- `paper` is the INK in
     this system, not the sheet -- so the document rendered as a black rectangle
     with black text, and every assertion above passed, because innerText holds
     the words whether or not a human can see one of them.

     Contrast, measured off what the browser actually computed. Not a token
     name: names are what caused this. */
  const legible = await page.evaluate(() => {
    /* ⚠️ THROUGH A CANVAS, NOT A REGEX. The first version pulled the numbers
       out of the colour string, and these tokens compute to `lab(16.2 -0.47
       -13.2)` -- three values that are not red, green and blue. It read a
       correct page as 1.5:1 and failed it. Painting the colour and reading the
       pixel back is the browser converting it, which is the only conversion
       that cannot be wrong about a colour space it invented. */
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d");
    const lum = (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const f = (v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const card = document.querySelector("aside > div");
    if (!card) return null;
    const heading = [...card.querySelectorAll("p, span")].find(
      (e) => (e.textContent || "").includes("Sunway Damansara kitchen"),
    );
    if (!heading) return null;
    const bg = getComputedStyle(card).backgroundColor;
    const fg = getComputedStyle(heading).color;
    const a = lum(bg);
    const b = lum(fg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return { bg, fg, ratio: Math.round(ratio * 100) / 100 };
  });
  check(
    "the words on the document can actually be read off it",
    !!legible && legible.ratio !== null && legible.ratio >= 4.5,
    legible ? `${legible.fg} on ${legible.bg} = ${legible.ratio}:1` : "no card",
  );

  /* And a page that makes no paper must not grow an empty sheet. */
  await page.goto(`${BASE}/en/portal/customers/new`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(900);
  check("a name list gets no document, because it makes none",
    await page.evaluate(() => !document.querySelector("aside")));

  console.log("");
  console.log("对账 — 他们讲多少 对 我们的账:");
  await as.rpc("add_project_page", { requested_key: "reconciliation", new_title: null });
  const month = dayIn(0).slice(0, 7) + "-01";
  for (const cents of [1200000, 850000]) {
    const { error } = await as.rpc("add_ledger_entry", {
      in_project_id: proj.id,
      in_module_key: "payments",
      in_direction: "in",
      in_amount_cents: cents,
      in_party: "Ang Chee Keong",
      /* TODAY, not three days back. On the 2nd of a month 「three days back」 is
         LAST month, so the reconciliation for this month summed nothing and the
         page read 「RM 0 · 0 entries」 -- correct arithmetic over a fixture that
         had put the money somewhere else. The same mistake the ranking dates
         made, in the other direction. */
      in_entry_on: dayIn(0),
    });
    if (error) throw new Error(`add_ledger_entry: ${error.message}`);
  }
  const { error: recErr } = await as.rpc("add_reconciliation", {
    in_project_id: proj.id,
    in_module_key: "reconciliation",
    in_period: month,
    in_source: "Maybank",
    in_their_cents: 2080000,
    in_reference: "STM-08",
  });
  if (recErr) throw new Error(`add_reconciliation: ${recErr.message}`);

  const recon = await read("/en/portal/reconciliation", "reconciliation-1440");
  check("his own month and source are on it", recon.includes("Maybank"), recon.slice(0, 160));
  check("no sample survived", !recon.includes("Principal"),
    "the three sample months are still there");
  /* Their RM 20,800 against our RM 20,500: the gap is the point of the page,
     and it is computed by the view rather than stored anywhere. */
  check("the gap is worked out and shown", /short RM 300|RM 300/.test(recon),
    recon.slice(0, 200));
  check("our side says how many entries made it", /2 entries/.test(recon),
    recon.slice(0, 200));

  /* 🔴 THE PAGE MUST NOT SAY THREE THINGS AT ONCE, and it did. The first run
     put real rows under a headline reading 「Difference this month RM 0 ·
     System total RM 246,800 · 128 entries」 -- the sample figure every customer
     shares -- and under that a panel asserting 「This month ties out」. Two of
     the three statements were false and they were the two a person reads
     first. A table of samples announces itself; a total does not (任务 80). */
  check("the headline is not the sample figure",
    !recon.includes("246,800"), "RM 246,800 is still on the page");
  check("the headline is this month's real gap", recon.includes("RM 300"),
    recon.slice(0, 200));
  check("and the verdict panel does not claim it ties out",
    !/ties out/i.test(recon), "the panel still asserts agreement");

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
