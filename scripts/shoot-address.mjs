/**
 * The publish panel, opened with my own eyes.
 *
 * The whole point of 20260902010000 is that this box used to be EMPTY -- a
 * contractor was asked to invent a web address with no suggestion, inside a
 * collapsed panel he had to find first. Every assertion in check:address is
 * about the database. None of them can see whether the owner is looking at a
 * filled field, and 「跑完尺子看到数字变好就发给他」 is the mistake this repo has
 * been told about four times.
 *
 * ⚠️ THROWAWAY ACCOUNT, NOT THE DEMO. The editor autosaves 2.5s after any
 * change, so a script that opens the demo's pages can freeze whatever it put
 * there into the founder's own live system.
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
/* fileURLToPath, not url.pathname: this repo lives in a folder with a space in
   its name and a URL percent-encodes it into a directory nobody would look in. */
const OUT = fileURLToPath(new URL("../.screenshots/address/", import.meta.url));
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

const stamp = Date.now();
const cred = { email: `addrshot-${stamp}@formae.test`, password: `Addr-${stamp}-x!` };
let userId = null;
let leadId = null;

const browser = await chromium.launch();
try {
  const { data: ind } = await admin.from("industries").select("id").eq("slug", "renovation").single();
  const { data: lead } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "address shot" } })
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

  const { data: proj } = await admin
    .from("projects")
    .select("id, site_slug")
    .eq("account_id", userId)
    .single();

  console.log(`\n注册当下拿到的网址: ${proj.site_slug}`);
  check("signup produced one at all", !!proj.site_slug);

  /* A style and a name, so the editor renders as a customer's would rather
     than redirecting to the one-time style gate.

     ⚠️ The error is READ. A previous script passed `company_name`, which is
     not a column; PostgREST rejected the whole update, the style stayed null,
     and it happily photographed the style picker and reported nine failures
     against correct code. */
  const { error: upErr } = await admin
    .from("projects")
    .update({ style: "ledger", palette: "clean-slate", system_language: "en", paid: true })
    .eq("id", proj.id);
  if (upErr) throw new Error(`could not provision: ${upErr.message}`);

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
    throw new Error(`login stopped at ${page.url()} — ${(await page.innerText("body")).slice(0, 200)}`);
  }

  await page.goto(`${BASE}/en/portal/website`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);

  /* Open the panel the way an owner does. `<details>` rather than a button
     because Puck re-creates the header override on every canvas change --
     see publish-site.tsx. */
  const summary = page.locator("summary", { hasText: /publish/i }).first();
  if (await summary.count()) {
    await summary.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${OUT}/panel-open.png`, fullPage: false });

  /** innerText and input VALUES -- never markup. A ruler that measures
   *  something the screen does not show is how three rulers here lied. */
  const values = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((i) => i.value).filter(Boolean),
  );
  check(
    "the address box is filled in, not empty",
    values.some((v) => v === proj.site_slug),
    `boxes held: ${JSON.stringify(values)}`,
  );

  /* ⚠️ THE RULER WAS WRONG HERE, NOT THE PRODUCT. This first asserted that the
     URL appears as copyable text. It does not, and it should not: the panel has
     two deliberately different shapes -- not published is one field and one
     button, because there is exactly one thing to do; published leads with the
     URL, because the question an owner comes back with is 「链接是什么」. Asserting
     the published shape over an unpublished site is asking the screen for
     something the design decided not to put there.

     What is actually true of this state is asserted instead. */
  const text = await page.evaluate(() => document.body.innerText);
  check(
    "and the panel is honest that nobody can open it yet",
    /not public yet|还没有公开/.test(text),
    text.slice(0, 160),
  );

  console.log("\n判：");
  console.log(`  ${failed.length ? `${failed.length} FAILED` : "all good"} — ${OUT}`);
} finally {
  await browser.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
}

process.exit(failed.length ? 1 : 0);
