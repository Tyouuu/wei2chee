/**
 * 对账 — every function called for real, by a real customer, over RLS.
 *
 * `supabase db push` succeeding proves nothing about plpgsql: names inside a
 * body are resolved when it RUNS, so a function referencing a column that is
 * not there pushes cleanly and throws 42702 at the first customer. This
 * repository has shipped that twice (20260825050000, 20260831060000).
 *
 * ── AND THE ONE THAT IS ABOUT SAFETY ──────────────────────────────────────
 *
 * reconciliation_lines is a VIEW, and a view executes as its OWNER unless
 * `security_invoker` is set. stock_on_hand shipped without it on 2026-09-01
 * and one business could read another business's shelf -- in a file whose own
 * comment asserted the opposite. So a second business signs in here and asks
 * the view directly.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
async function business(tag) {
  const cred = {
    email: `recon-${tag}-${Date.now()}@formae.test`,
    password: `Recon-${Date.now()}-x!`,
  };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
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
  /* The error is READ. A sibling script once passed a column that does not
     exist, PostgREST rejected the whole update, and it reported nine failures
     against correct code. */
  const { error: upErr } = await admin
    .from("projects")
    .update({ style: "ledger", palette: "clean-slate", system_language: "en" })
    .eq("id", proj.id);
  if (upErr) throw new Error(`provision(${tag}): ${upErr.message}`);

  await as.rpc("add_project_page", { requested_key: "reconciliation", new_title: null });
  return { as, id: proj.id };
}

/** The month, in Malaysia -- the same eight hours today_myt() exists over. */
const monthOf = (back = 0) => {
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const [y, m] = now.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return d.toISOString().slice(0, 10);
};

try {
  const a = await business("a");

  console.log("\n写一笔他们给的总数:");
  const { data: id1, error: e1 } = await a.as.rpc("add_reconciliation", {
    in_project_id: a.id,
    in_module_key: "reconciliation",
    in_period: monthOf(0),
    in_source: "Celcom",
    in_their_cents: 24680000,
    in_reference: "STM-2026-08",
  });
  check("a customer can write one", !!id1 && !e1, e1?.message ?? "");

  const { data: rows } = await a.as
    .from("reconciliation_lines")
    .select("*")
    .eq("id", id1)
    .maybeSingle();
  check("the view answers for the row that was just written", !!rows, "nothing came back");
  check("their figure is what was typed", rows?.their_cents === 24680000, String(rows?.their_cents));
  /* No ledger yet, so our side is zero -- and zero rather than null, because
     「we have none」 is an answer and null is not one anybody can act on. */
  check("our side starts at zero, not null", rows?.ours_cents === 0, String(rows?.ours_cents));
  check("and it counted no entries", Number(rows?.entries) === 0, String(rows?.entries));

  console.log("\n我们自己的账进去了:");
  for (const cents of [10000000, 14680000]) {
    const { error } = await a.as.rpc("add_ledger_entry", {
      in_project_id: a.id,
      in_module_key: "payments",
      in_direction: "in",
      in_amount_cents: cents,
      in_party: "Dealer",
      in_entry_on: monthOf(0),
    });
    if (error) throw new Error(`add_ledger_entry: ${error.message}`);
  }
  const { data: after } = await a.as
    .from("reconciliation_lines")
    .select("*")
    .eq("id", id1)
    .maybeSingle();
  check("our side is summed, never stored", after?.ours_cents === 24680000, String(after?.ours_cents));
  check("and it says how many entries it added up", Number(after?.entries) === 2, String(after?.entries));
  check(
    "so this month agrees",
    Number(after?.their_cents) - Number(after?.ours_cents) === 0,
    `${after?.their_cents} vs ${after?.ours_cents}`,
  );

  console.log("\n写错了一笔，差额自己出现:");
  const { error: eExtra } = await a.as.rpc("add_ledger_entry", {
    in_project_id: a.id,
    in_module_key: "payments",
    in_direction: "in",
    in_amount_cents: 30000,
    in_party: "Dealer",
    in_entry_on: monthOf(0),
  });
  if (eExtra) throw new Error(eExtra.message);
  const { data: off } = await a.as
    .from("reconciliation_lines")
    .select("their_cents, ours_cents")
    .eq("id", id1)
    .maybeSingle();
  check(
    "a new entry moves the difference without anybody touching the reconciliation",
    Number(off.ours_cents) - Number(off.their_cents) === 30000,
    `${off.their_cents} vs ${off.ours_cents}`,
  );

  console.log("\n这个月以外的不算进去:");
  const { error: eOld } = await a.as.rpc("add_ledger_entry", {
    in_project_id: a.id,
    in_module_key: "payments",
    in_direction: "in",
    in_amount_cents: 99999900,
    in_party: "Dealer",
    in_entry_on: monthOf(2),
  });
  if (eOld) throw new Error(eOld.message);
  const { data: still } = await a.as
    .from("reconciliation_lines")
    .select("ours_cents")
    .eq("id", id1)
    .maybeSingle();
  check("a payment two months ago stays out of this month", Number(still.ours_cents) === 24710000,
    String(still.ours_cents));

  console.log("\n方向:");
  const { data: outId } = await a.as.rpc("add_reconciliation", {
    in_project_id: a.id,
    in_module_key: "reconciliation",
    in_period: monthOf(0),
    in_source: "Supplier",
    in_their_cents: 500000,
    in_direction: "out",
  });
  const { error: eOut } = await a.as.rpc("add_ledger_entry", {
    in_project_id: a.id,
    in_module_key: "expenses",
    in_direction: "out",
    in_amount_cents: 500000,
    in_party: "Supplier",
    in_entry_on: monthOf(0),
  });
  if (eOut) throw new Error(eOut.message);
  const { data: outRow } = await a.as
    .from("reconciliation_lines")
    .select("ours_cents, direction")
    .eq("id", outId)
    .maybeSingle();
  /* 🔴 THE ONE THIS COLUMN EXISTS FOR. A supplier's statement is money OUT.
     Without `direction` this row would compare RM 5,000 of purchases against
     RM 247,100 of takings and report a difference that is not one. */
  check("a supplier's figure is compared against money OUT, not money in",
    Number(outRow.ours_cents) === 500000, `${outRow.direction} → ${outRow.ours_cents}`);

  console.log("\n一个月只能有一笔:");
  const { data: again } = await a.as.rpc("add_reconciliation", {
    in_project_id: a.id,
    in_module_key: "reconciliation",
    in_period: monthOf(0),
    in_source: "celcom",
    in_their_cents: 111,
  });
  check("the same month and source comes back as the row that exists", again === id1,
    `${again} vs ${id1}`);
  const { data: unchanged } = await a.as
    .from("reconciliations")
    .select("their_cents")
    .eq("id", id1)
    .maybeSingle();
  check("and pressing twice did not overwrite the figure",
    Number(unchanged.their_cents) === 24680000, String(unchanged.their_cents));

  console.log("\n月份要归到月初:");
  const { data: midId } = await a.as.rpc("add_reconciliation", {
    in_project_id: a.id,
    in_module_key: "reconciliation",
    in_period: monthOf(1).replace(/-01$/, "-17"),
    in_source: "Maybank",
    in_their_cents: 1,
    in_direction: "net",
  });
  const { data: mid } = await a.as
    .from("reconciliations")
    .select("period")
    .eq("id", midId)
    .maybeSingle();
  check("a date in the middle of a month becomes that month", mid.period === monthOf(1),
    `${mid.period} vs ${monthOf(1)}`);

  console.log("\n结了 跟 收起来 是两件事:");
  await a.as.rpc("set_reconciliation_settled", { in_id: id1, in_settled: true });
  const { data: settled } = await a.as
    .from("reconciliation_lines")
    .select("settled_at, archived_at")
    .eq("id", id1)
    .maybeSingle();
  check("settling does not remove it from the page", !!settled.settled_at && !settled.archived_at);
  await a.as.rpc("set_reconciliation_archived", { in_id: id1, in_archived: true });
  const { data: archived } = await a.as
    .from("reconciliations")
    .select("archived_at")
    .eq("id", id1)
    .maybeSingle();
  check("archiving keeps the row and only takes it off the shelf", !!archived.archived_at);
  const { data: reopen } = await a.as.rpc("add_reconciliation", {
    in_project_id: a.id,
    in_module_key: "reconciliation",
    in_period: monthOf(0),
    in_source: "Celcom",
    in_their_cents: 24680000,
  });
  check("an archived month can be entered again", !!reopen && reopen !== id1);

  console.log("\n不得乱写:");
  const { error: eWrong } = await a.as.rpc("add_reconciliation", {
    in_project_id: a.id,
    in_module_key: "payments",
    in_period: monthOf(0),
    in_source: "X",
    in_their_cents: 1,
  });
  check("a page that is not this shape is refused", !!eWrong, "it was accepted");
  const { error: eBlank } = await a.as.rpc("add_reconciliation", {
    in_project_id: a.id,
    in_module_key: "reconciliation",
    in_period: monthOf(0),
    in_source: "   ",
    in_their_cents: 1,
  });
  check("a figure with nobody behind it is refused", !!eBlank, "it was accepted");

  console.log("\n单号:");
  const { error: eDoc } = await a.as.rpc("next_doc_no", {
    in_project_id: a.id,
    in_module_key: "reconciliation",
  });
  /* A reconciliation is named by its month and its source. A second identity
     from the counter table would be a number nobody would ever say aloud --
     the same call 20260831070000 made for a person. */
  check("a reconciliation is never given a document number", !!eDoc, "it issued one");

  console.log("\n安全 — 别人看不到:");
  console.log("");
  console.log("页面真的读得到:");
  /* The projection's own query. A shape marked live whose page still draws
     samples is the defect this repository has shipped sixteen times: the RPCs
     above prove the table, this proves the wire. */
  const { data: pageRows, error: pErr } = await a.as
    .from("reconciliation_lines")
    .select("id, period, source, their_cents, ours_cents, entries, settled_at")
    .eq("project_id", a.id)
    .eq("module_key", "reconciliation")
    .is("archived_at", null)
    .order("period", { ascending: false });
  check("the page's own query comes back", !pErr && Array.isArray(pageRows), pErr ? pErr.message : "");
  check("newest month first",
    (pageRows || []).length >= 2 && pageRows[0].period >= pageRows[1].period,
    (pageRows || []).map((r) => r.period).join(" "));
  check("an archived month is off the page but still in the book",
    !(pageRows || []).some((r) => r.id === id1));

  const b = await business("b");
  const { data: theirs } = await b.as.from("reconciliations").select("id");
  check("another business sees none of the rows", (theirs ?? []).length === 0,
    `${(theirs ?? []).length} rows`);
  /* 🔴 THE VIEW. This is the assertion stock_on_hand failed. */
  const { data: viaView } = await b.as.from("reconciliation_lines").select("id");
  check("nor any of them through the view", (viaView ?? []).length === 0,
    `${(viaView ?? []).length} rows — the view is reading past RLS`);
  const { error: eSteal } = await b.as.rpc("update_reconciliation", {
    in_id: id1,
    in_period: monthOf(0),
    in_source: "stolen",
    in_their_cents: 0,
  });
  check("nor change one", !!eSteal, "the update was accepted");

  console.log("\n判：");
  console.log(`  ${failed.length ? `${failed.length} FAILED` : "all good"}`);
} finally {
  for (const id of made) await admin.auth.admin.deleteUser(id);
}

process.exit(failed.length ? 1 : 0);
