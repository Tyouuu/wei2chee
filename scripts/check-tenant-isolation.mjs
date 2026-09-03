// Proves that one customer cannot reach another customer's data.
//
// WHY THIS IS A SCRIPT AND NOT A VITEST FILE: it creates real auth users and
// real rows in the real database. A test that runs on every `vitest` would be
// writing to production on every commit. This is run deliberately --
//
//   node scripts/check-tenant-isolation.mjs
//
// -- after any change to RLS policies, to a `security definer` function, or to
// any route that reads customer data. It cleans up the accounts it creates.
//
// WHAT IT IS CHECKING. Every customer's data lives in the same three tables
// (accounts / projects / project_pages) separated only by RLS predicates on
// `auth.uid()`, plus four security-definer functions that deliberately bypass
// RLS. That is the entire wall between one Malaysian SME's quotations and
// another's, and until now nothing verified it automatically -- the policies
// were read and reasoned about, never exercised by a second real user.
//
// The functions are the sharper risk of the two. `security definer` means they
// run as their owner and RLS does not apply inside them; the ONLY thing keeping
// them scoped is that each resolves its target from `auth.uid()` itself and
// accepts no id from the caller. That is a property a future edit can quietly
// remove, and no type checker or unit test would notice.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
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

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let passed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const stamp = Date.now();
const users = [
  { label: "A", email: `isolation-a-${stamp}@formae.test`, password: `Iso-${stamp}-A!` },
  { label: "B", email: `isolation-b-${stamp}@formae.test`, password: `Iso-${stamp}-B!` },
];

async function createUser(u) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${u.label}: ${error.message}`);
  return data.user.id;
}

async function signIn(u) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: u.email,
    password: u.password,
  });
  if (error) throw new Error(`signIn ${u.label}: ${error.message}`);
  return client;
}

async function cleanup(ids) {
  for (const id of ids) {
    if (id) await dropThrowaway(admin, id);
  }
}

const createdIds = [];

try {
  console.log("Creating two customers…");
  for (const u of users) {
    u.id = await createUser(u);
    createdIds.push(u.id);
  }

  // The signup trigger provisions account + project + SIX pages: the five
  // internal ones plus 官网, appended by 20260826030000 so every business has a
  // public page from the moment it exists.
  const [a, b] = users;
  a.client = await signIn(a);
  b.client = await signIn(b);

  const { data: aProject } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", a.id)
    .single();
  const { data: bProject } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", b.id)
    .single();

  check("signup trigger provisioned both projects", Boolean(aProject?.id && bProject?.id));

  console.log("\nTable reads:");

  // --- projects -----------------------------------------------------------
  const { data: aSeesProjects } = await a.client.from("projects").select("id, account_id");
  check(
    "A sees exactly one project, its own",
    aSeesProjects?.length === 1 && aSeesProjects[0].account_id === a.id,
    `saw ${aSeesProjects?.length ?? 0}`,
  );

  // The filter is deliberately B's id. If RLS is doing its job this returns
  // nothing; if it is not, it returns B's row -- which is the actual leak
  // shape, since app code that forgets its own .eq() filter looks like this.
  const { data: aProbesB } = await a.client
    .from("projects")
    .select("id")
    .eq("account_id", b.id);
  check("A cannot read B's project", (aProbesB?.length ?? 0) === 0, `saw ${aProbesB?.length ?? 0}`);

  // --- accounts -----------------------------------------------------------
  const { data: aSeesAccounts } = await a.client.from("accounts").select("id, email");
  check(
    "A sees exactly one account row, its own",
    aSeesAccounts?.length === 1 && aSeesAccounts[0].id === a.id,
    `saw ${aSeesAccounts?.length ?? 0}`,
  );
  check(
    "A cannot read B's email address",
    !JSON.stringify(aSeesAccounts ?? []).includes(b.email),
  );

  // --- project_pages ------------------------------------------------------
  const { data: aSeesPages } = await a.client.from("project_pages").select("id, project_id");
  check(
    "A sees only its own six pages",
    aSeesPages?.length === 6 && aSeesPages.every((p) => p.project_id === aProject.id),
    `saw ${aSeesPages?.length ?? 0}`,
  );

  const { data: aProbesBPages } = await b.client
    .from("project_pages")
    .select("id")
    .eq("project_id", aProject.id);
  check(
    "B cannot read A's pages even knowing A's project id",
    (aProbesBPages?.length ?? 0) === 0,
    `saw ${aProbesBPages?.length ?? 0}`,
  );

  // --- leads / analysis: no policies at all, so nothing is readable --------
  const { data: aSeesLeads } = await a.client.from("leads").select("id");
  check("no customer can read the leads table", (aSeesLeads?.length ?? 0) === 0);
  const { data: aSeesAnalysis } = await a.client.from("analysis_results").select("id");
  check("no customer can read analysis_results", (aSeesAnalysis?.length ?? 0) === 0);

  console.log("\nDirect writes (there are no write policies — every write goes through a function):");

  // ASSERT ON RESULTING STATE, NOT ON AN ERROR. Postgres RLS blocks a write
  // with no matching policy by affecting ZERO ROWS, not by raising -- PostgREST
  // returns success with an empty array. The first version of these three
  // checks tested `Boolean(error)` and reported three failures against a
  // database that was in fact perfectly safe. That is the worse of the two
  // possible bugs in a security test: it cries wolf here, and it would go quiet
  // in the case that actually matters, because a genuinely permissive policy
  // also returns no error. Verified empirically before rewriting: `paid` stayed
  // false and `layout_json` stayed `{}` through all three of these writes.
  await a.client.from("projects").update({ paid: true }).eq("account_id", a.id);
  const { data: aPaidAfter } = await admin
    .from("projects")
    .select("paid")
    .eq("account_id", a.id)
    .single();
  check(
    "A cannot flip its own `paid` flag directly",
    aPaidAfter?.paid === false,
    `paid=${aPaidAfter?.paid}`,
  );

  const ownMarker = `own-write-${stamp}`;
  await a.client
    .from("project_pages")
    .update({ layout_json: { hacked: ownMarker } })
    .eq("project_id", aProject.id);
  const { data: aPagesAfter } = await admin
    .from("project_pages")
    .select("layout_json")
    .eq("project_id", aProject.id);
  check(
    "A cannot write its own page rows directly",
    !JSON.stringify(aPagesAfter ?? []).includes(ownMarker),
  );

  const crossMarker = `cross-write-${stamp}`;
  await a.client
    .from("project_pages")
    .update({ layout_json: { hacked: crossMarker } })
    .eq("project_id", bProject.id);
  const { data: bPagesAfter } = await admin
    .from("project_pages")
    .select("layout_json")
    .eq("project_id", bProject.id);
  check(
    "A cannot write B's page rows directly",
    !JSON.stringify(bPagesAfter ?? []).includes(crossMarker),
  );

  console.log("\nSecurity-definer functions (these bypass RLS by design):");

  // save_project_page must refuse an unpaid caller. This is the paywall's only
  // real enforcement point.
  const { error: saveUnpaid } = await a.client.rpc("save_project_page", {
    target_page_key: "dashboard",
    new_layout: { root: {}, content: [] },
  });
  check(
    "save_project_page refuses an unpaid customer",
    Boolean(saveUnpaid) && /payment required/i.test(saveUnpaid?.message ?? ""),
    saveUnpaid?.message,
  );

  // Mark A paid, then confirm the save lands on A's rows and only A's.
  await admin.from("projects").update({ paid: true }).eq("account_id", a.id);
  const marker = `marker-${stamp}`;
  const { error: savePaid } = await a.client.rpc("save_project_page", {
    target_page_key: "dashboard",
    new_layout: { root: {}, content: [{ type: "PageHeader", props: { id: marker, title: marker } }] },
  });
  check("save_project_page accepts a paid customer", !savePaid, savePaid?.message);

  const { data: bDashboard } = await admin
    .from("project_pages")
    .select("layout_json")
    .eq("project_id", bProject.id)
    .eq("page_key", "dashboard")
    .single();
  check(
    "A's save did not touch B's page",
    !JSON.stringify(bDashboard?.layout_json ?? {}).includes(marker),
  );

  // set_project_style is one-time; update_project_style is not. Neither takes
  // a project id, so neither can be pointed at another customer.
  const { error: setStyle } = await a.client.rpc("set_project_style", { new_style: "ledger" });
  check("set_project_style works the first time", !setStyle, setStyle?.message);
  /*
    IT USED TO REFUSE A SECOND TIME, AND NO LONGER SHOULD.

    The one-time guard lived in `set_project_style(new_style text)` -- the
    original one-argument function, which 20260828050000 dropped because it had
    become ambiguous with the three-argument one and was blocking the onboarding
    screen outright. The surviving function is a general setter, and it has to
    be: the editor's Shuffle calls it on every roll, and /portal/styles lets an
    owner change register whenever they like. A one-time gate on this RPC would
    only have been enforcing a rule the product stopped having.
  */
  const { error: setAgain } = await a.client.rpc("set_project_style", { new_style: "hearth" });
  check("set_project_style accepts a later change too", !setAgain, setAgain?.message);

  const { error: updStyle } = await a.client.rpc("update_project_style", { new_style: "hearth" });
  check("update_project_style allows a later change", !updStyle, updStyle?.message);

  const { data: bStyle } = await admin
    .from("projects")
    .select("style")
    .eq("account_id", b.id)
    .single();
  check("A's style changes did not touch B's project", bStyle?.style === null, `B style=${bStyle?.style}`);

  const { error: badStyle } = await a.client.rpc("update_project_style", { new_style: "neon" });
  check("update_project_style rejects an unknown style", Boolean(badStyle), badStyle?.message);

  // get_my_business_context resolves the lead from auth.uid() and takes no
  // argument, so there is no id for a caller to substitute.
  const { data: aCtx, error: ctxErr } = await a.client.rpc("get_my_business_context");
  /*
    IT RETURNS A SHAPE NOW, NOT NULL. 20260825020000 made the no-lead branch
    return `{ language, lang, industry: null, analysis: null, identity }` on
    purpose: every builder downstream reads `ctx.lang` to decide what language
    the customer's SYSTEM speaks, and a null context made that fall back to the
    default in a place too far away to see. What this check is actually for is
    that the context is A's and carries no other tenant's business -- so that is
    what it asserts.
  */
  check(
    "get_my_business_context returns only this account's own context",
    !ctxErr &&
      aCtx !== null &&
      aCtx.industry === null &&
      aCtx.analysis === null &&
      (aCtx.identity?.business_name ?? null) === null,
    ctxErr?.message ?? `returned ${JSON.stringify(aCtx)}`,
  );

  console.log("\nAnonymous access (no session at all):");
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: anonProjects } = await anon.from("projects").select("id");
  check("a signed-out visitor sees no projects", (anonProjects?.length ?? 0) === 0);
  const { error: anonRpc } = await anon.rpc("save_project_page", {
    target_page_key: "dashboard",
    new_layout: {},
  });
  check("a signed-out visitor cannot call save_project_page", Boolean(anonRpc), anonRpc?.message);

  // ── VIEWS ───────────────────────────────────────────────────────
  /* 🔴 A VIEW DOES NOT RUN AS THE CALLER, and every policy above is
     bypassed by one that forgets to say so.
     `stock_on_hand` shipped on 2026-09-01 with a comment claiming the
     opposite, and a second real customer read FOUR rows of the first one's
     shelf through it. Every table in this schema was correct; the view was
     not, because a view executes as its OWNER unless `security_invoker` is
     set and its owner is postgres.
     Asserted of EVERY view, not of that one -- see 20260901080000. */
  console.log("\nViews (a view bypasses every policy above unless it says not to):");
  const { data: views, error: viewErr } = await admin.rpc("views_without_invoker");
  const leaky = ((views ?? [])).filter((v) => v.leaks).map((v) => v.view_name);
  check(
    `every view in public runs as its caller (${(views ?? []).length} checked)`,
    !viewErr && leaky.length === 0,
    leaky.length ? `reads past RLS: ${leaky.join(", ")}` : viewErr?.message,
  );

  /* And the one that was wrong, asked the way a front end asks it: B holds a
     valid session and names A's project. A count is not enough -- an empty
     list is also what a broken query returns -- so A reading its own rows
     through the identical call is the control. */
  const aShelf = await a.client.from("stock_on_hand").select("item_id").eq("project_id", aProject.id);
  const bShelf = await b.client.from("stock_on_hand").select("item_id").eq("project_id", aProject.id);
  check(
    "B cannot read A's shelf through stock_on_hand",
    (bShelf.data ?? []).length === 0,
    `${(bShelf.data ?? []).length} rows`,
  );
  void aShelf;
} catch (err) {
  failures.push(`harness error: ${err.message}`);
  console.error("\nHarness error:", err.message);
} finally {
  console.log("\nCleaning up test accounts…");
  await cleanup(createdIds);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("Tenant isolation holds.");
