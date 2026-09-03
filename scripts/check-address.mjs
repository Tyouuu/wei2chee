/**
 * Every business gets an address -- checked by signing up and typing, not by
 * reading the migration.
 *
 * ── WHY THIS EXISTS AS A SEPARATE RUNNER ───────────────────────────────────
 *
 * `supabase db push` succeeding proves nothing about plpgsql. Names inside a
 * function body are resolved when it RUNS, so a body that references a column
 * that is not there, or a parameter that collides with one, pushes cleanly and
 * then throws 42702 at the first real customer -- which this repository has
 * shipped twice (20260825050000 and again in 20260831060000).
 *
 * Everything below therefore runs through a real signed-in session against the
 * real database, with RLS deciding. The service-role client is used for exactly
 * two things: creating the throwaway users, and reading rows back to see what
 * the customer's own call actually wrote.
 *
 * ── THE ONE THAT IS ABOUT SAFETY, NOT BEHAVIOUR ────────────────────────────
 *
 * claim_auto_site_slug takes a project id. It has to, because the signup
 * trigger has no auth.uid(). An id parameter plus a grant to `authenticated`
 * is how one customer renames another customer's website, so the last block
 * signs in as a second business and tries exactly that.
 */
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

const made = [];
const leads = [];

/** A signed-up business, optionally one that answered the questionnaire first.
 *  Returns its own anon client -- the whole point is that RLS decides. */
async function business(tag, industrySlug = null) {
  let leadId = null;
  if (industrySlug) {
    const { data: ind, error: iErr } = await admin
      .from("industries")
      .select("id")
      .eq("slug", industrySlug)
      .single();
    if (iErr) throw new Error(`industry ${industrySlug}: ${iErr.message}`);
    const { data: lead, error: lErr } = await admin
      .from("leads")
      .insert({ industry_id: ind.id, language: "en", answers: { note: "address check" } })
      .select("id")
      .single();
    if (lErr) throw new Error(`lead: ${lErr.message}`);
    leadId = lead.id;
    leads.push(leadId);
  }

  const cred = {
    email: `addr-${tag}-${Date.now()}@formae.test`,
    password: `Addr-${Date.now()}-x!`,
  };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
    user_metadata: leadId ? { lead_id: leadId } : {},
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);

  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", user.user.id)
    .single();
  if (!proj?.id) throw new Error(`${tag} was provisioned no project`);

  return { as, projectId: proj.id, userId: user.user.id };
}

/** ⚠️ Read back with the admin client, never from the RPC's return value. A
 *  function that returns the address it MEANT to write, over a row it did not
 *  write, is the exact shape of every 「said it, did not do it」 in this repo. */
const rowOf = async (id) =>
  (
    await admin
      .from("projects")
      .select("site_slug, site_slug_auto, site_published, business_name")
      .eq("id", id)
      .single()
  ).data;

try {
  console.log("\n注册就有网址（问卷答过的）:");
  const a = await business("trade", "renovation");
  let row = await rowOf(a.projectId);
  check("a fresh signup already has an address", !!row.site_slug, JSON.stringify(row));
  check(
    "and it is built from the trade, because there is no company name yet",
    /^renovation-[0-9a-f]{4}$/.test(row.site_slug ?? ""),
    row.site_slug ?? "null",
  );
  check("marked as ours, so it can still be improved", row.site_slug_auto === true);
  const atSignup = row.site_slug;

  console.log("\n他一填公司名，网址就跟着变:");
  const { error: e1 } = await a.as.rpc("update_business_identity", {
    new_business_name: "Xingfa Renovation Works",
    new_owner_name: "Tan Wei Chee",
  });
  if (e1) throw new Error(`update_business_identity: ${e1.message}`);
  row = await rowOf(a.projectId);
  check("the machine guess gave way to the real name", row.site_slug === "xingfa-renovation-works", row.site_slug ?? "null");
  check("which means it is not the signup one any more", row.site_slug !== atSignup);

  console.log("\n他自己改了，我们就再也不碰:");
  const { data: picked } = await a.as.rpc("set_my_site_slug", { new_slug: "xingfa-reno-kl" });
  check("a person can still pick their own", picked === "ok", String(picked));
  row = await rowOf(a.projectId);
  check("and it stops being ours", row.site_slug_auto === false);

  const { error: e2 } = await a.as.rpc("update_business_identity", {
    new_business_name: "Xingfa Renovation Sdn Bhd",
    new_owner_name: "Tan Wei Chee",
  });
  if (e2) throw new Error(`second identity write: ${e2.message}`);
  row = await rowOf(a.projectId);
  check(
    "renaming the company does NOT move an address a person chose",
    row.site_slug === "xingfa-reno-kl",
    row.site_slug ?? "null",
  );
  check("even though the company name really did change", row.business_name === "Xingfa Renovation Sdn Bhd");

  console.log("\n两家同名，两个网址:");
  const b = await business("twin", "renovation");
  const c = await business("twin2", "renovation");
  for (const who of [b, c]) {
    const { error } = await who.as.rpc("update_business_identity", {
      new_business_name: "Ah Hock Trading",
      new_owner_name: null,
    });
    if (error) throw new Error(`twin identity: ${error.message}`);
  }
  const rb = await rowOf(b.projectId);
  const rc = await rowOf(c.projectId);
  check("the first gets the plain one", rb.site_slug === "ah-hock-trading", rb.site_slug ?? "null");
  check("the second gets a different one", rc.site_slug === "ah-hock-trading-2", rc.site_slug ?? "null");
  check("and they really are two addresses", rb.site_slug !== rc.site_slug);

  console.log("\n上线之后就锁住:");
  /* Publishing needs a saved page, which needs payment. Both are somebody
     else's gate and neither is what this file is about, so the state is set
     directly -- what is being checked is that claim_auto refuses to move a
     published address, not how a page gets published. */
  await admin.from("projects").update({ site_published: true, site_slug_auto: true }).eq("id", b.projectId);
  const { error: e3 } = await b.as.rpc("update_business_identity", {
    new_business_name: "Ah Hock Hardware",
    new_owner_name: null,
  });
  if (e3) throw new Error(`published rename: ${e3.message}`);
  const rb2 = await rowOf(b.projectId);
  check(
    "a published address survives a rename, because it may be printed on something",
    rb2.site_slug === "ah-hock-trading",
    rb2.site_slug ?? "null",
  );

  console.log("\n保留字:");
  const { data: r1 } = await c.as.rpc("set_my_site_slug", { new_slug: "portal" });
  check("a person cannot take a route name", r1 === "reserved", String(r1));
  const { data: r2 } = await c.as.rpc("set_my_site_slug", { new_slug: "ab" });
  check("nor something too short to be an address", r2 === "shape", String(r2));
  const { data: r3 } = await c.as.rpc("set_my_site_slug", { new_slug: "xingfa-reno-kl" });
  check("nor one another business is already on", r3 === "taken", String(r3));

  console.log("\n中文名字的那一家:");
  const d = await business("cjk", "beauty");
  const { error: e4 } = await d.as.rpc("update_business_identity", {
    new_business_name: "美嘉美容中心",
    new_owner_name: "陈小姐",
  });
  if (e4) throw new Error(`cjk identity: ${e4.message}`);
  const rd = await rowOf(d.projectId);
  /* ⚠️ NOT a defect and not a silent one. There is no transliteration table in
     Postgres, so a wholly Chinese name yields nothing and the trade address it
     already had is kept. The honest fix for this business is the panel, which
     now opens with that address in it instead of empty. */
  check(
    "keeps the trade address rather than inventing a Malaysian-looking one",
    /^beauty-[0-9a-f]{4}$/.test(rd.site_slug ?? ""),
    rd.site_slug ?? "null",
  );
  check("and is still marked improvable", rd.site_slug_auto === true);

  console.log("\n没有问卷、没有名字的那一家:");
  const e = await business("blank");
  const re = await rowOf(e.projectId);
  check(
    "gets no address, because nothing about it is known yet",
    re.site_slug === null,
    re.site_slug ?? "null",
  );

  console.log("\n安全 — 别人的网址改不了:");
  const { data: hijack, error: hErr } = await c.as.rpc("claim_auto_site_slug", {
    target_project: a.projectId,
  });
  check(
    "a signed-in customer cannot call the id-taking function at all",
    !!hErr,
    hErr ? `${hErr.code} ${hErr.message}` : `it returned ${hijack}`,
  );
  const after = await rowOf(a.projectId);
  check("and the other business's address is untouched", after.site_slug === "xingfa-reno-kl");

  const { error: aErr } = await c.as
    .from("projects")
    .update({ site_slug: "stolen-name" })
    .eq("id", a.projectId);
  const afterDirect = await rowOf(a.projectId);
  check(
    "nor write the column directly",
    afterDirect.site_slug === "xingfa-reno-kl",
    aErr ? `${aErr.code}` : "the update was accepted",
  );

  console.log("\n判：");
  console.log(`  ${failed.length ? `${failed.length} FAILED` : `all ${failed.length === 0 ? "good" : ""}`}`);
} finally {
  /* Users first -- projects cascade off them -- then the leads, which nothing
     cascades from. A checker that leaves rows behind is one nobody runs twice. */
  for (const id of made) await dropThrowaway(admin, id);
  for (const id of leads) await admin.from("leads").delete().eq("id", id);
}

process.exit(failed.length ? 1 : 0);
