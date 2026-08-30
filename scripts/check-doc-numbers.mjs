/**
 * Can this business still write a document?
 *
 * Every failure below was real, shipped, and found by DOING rather than
 * reading. They are here so they cannot come back quietly.
 *
 *   ① a deleted receipt jammed the book permanently   (20260831040000)
 *      RC-0001·0002·0003, delete 0002, next -> count(*)=2 -> RC-0003 -> taken.
 *      And never recovers: every later attempt counts the same rows.
 *
 *   ② eight simultaneous presses recorded six payments  (20260831050000)
 *      All eight read max() before any wrote. Not a retry -- eight different
 *      customers paying at one counter, which no idempotency key can help.
 *
 *   ③ a variable named like its column made the fix un-runnable (…060000)
 *      `missing FROM-clause entry for table "next_doc_no"`. plpgsql resolves
 *      names when it RUNS, so `supabase db push` succeeding proves nothing.
 *      This is the second time in this repo -- submit_site_enquiry threw 42702
 *      on the first real form submission for exactly the same reason.
 *
 * Run as a REAL CUSTOMER, never the service role: the service role bypasses
 * RLS, and half of what is asserted here is what RLS lets a front end do.
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
const check = (name, ok, detail = "") => {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

const stamp = Date.now();
let userId = null;

try {
  const email = `docno-${stamp}@formae.test`;
  const password = `Doc-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: inErr } = await c.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);

  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", userId).single();
  if (!proj?.id) throw new Error("the signup trigger did not provision a project");
  const P = proj.id;

  const pay = (over = {}) =>
    c.rpc("add_ledger_entry", {
      in_project_id: P, in_module_key: "payments",
      in_amount_cents: 1000, in_party: "客人", ...over,
    });
  const quote = () =>
    c.rpc("add_pipeline_record", {
      in_project_id: P, in_module_key: "quotations", in_title: "工程",
    });

  console.log("\n① 删掉中间那一张，还开得出下一张");
  const a = await pay(), b = await pay(), d = await pay();
  check("three receipts numbered in order",
    [a, b, d].every((r) => r.data) && a.data.doc_no.endsWith("0001") && d.data.doc_no.endsWith("0003"),
    [a, b, d].map((r) => r.data?.doc_no ?? r.error?.message).join(" · "));

  const { error: delErr } = await c.from("ledger_entries").delete().eq("id", b.data.id);
  check("the owner may delete his own row (this is what RLS allows)", !delErr, delErr?.message);

  const after = await pay();
  check("the next receipt is still issuable",
    !!after.data, after.error?.message?.slice(0, 70));
  /* Not 0003. A spent number stays spent -- that is the rule the original
     comment stated and count(*) contradicted. */
  check("and it does NOT reuse the deleted number",
    after.data?.doc_no?.endsWith("0004"), after.data?.doc_no);

  console.log("\n② 报价单同一条路，同一个洞");
  const q1 = await quote(), q2 = await quote(), q3 = await quote();
  await c.from("pipeline_records").delete().eq("id", q2.data.id);
  const q4 = await quote();
  check("quotations survive a deletion too",
    q4.data?.doc_no?.endsWith("0004"), q4.data?.doc_no ?? q4.error?.message?.slice(0, 70));
  void q1; void q3;

  console.log("\n③ 八个人同时按（八笔不同的钱，不是重试）");
  const N = 8;
  const race = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      c.rpc("add_ledger_entry", {
        in_project_id: P, in_module_key: "expenses",
        in_amount_cents: 100 + i, in_party: `供应商 ${i + 1}`,
      }),
    ),
  );
  const won = race.filter((r) => r.data).map((r) => r.data.doc_no);
  check(`all ${N} were recorded`, won.length === N,
    `${won.length}/${N} — ${race.find((r) => r.error)?.error?.message?.slice(0, 60) ?? ""}`);
  check("every one got a different number", new Set(won).size === won.length);

  console.log("\n④ 前端绕过 RPC 直接写，挡不挡得住");
  const { error: noNo } = await c.from("ledger_entries").insert({
    project_id: P, module_key: "payments", direction: "in", amount_cents: 500,
  });
  check("an insert with no document number is refused", !!noNo);

  /* An authenticated session CAN set one. That is a known limit, asserted so
     it stays known: the counter is built to carry past numbers taken behind
     its back rather than to pretend this cannot happen. */
  const { data: forced } = await c.from("ledger_entries").insert({
    project_id: P, module_key: "payments", doc_no: "RC-2026-0005",
    direction: "in", amount_cents: 500, party: "手动写的",
  }).select().single();
  check("a front end can still supply its own (known, and handled below)", !!forced, forced?.doc_no);

  const past = await pay();
  check("the generator carries past a number taken behind its back",
    !!past.data && past.data.doc_no !== "RC-2026-0005",
    past.data?.doc_no ?? past.error?.message?.slice(0, 70));

  console.log("\n⑤ 表自己挡得住的（不靠 RPC）");
  const rows = [
    ["negative amount", { doc_no: "RC-2026-9001", direction: "in", amount_cents: -1 }],
    ["over-allocation", { doc_no: "RC-2026-9002", direction: "in", amount_cents: 100, allocated_cents: 900 }],
    ["an invented direction", { doc_no: "RC-2026-9003", direction: "sideways", amount_cents: 100 }],
  ];
  for (const [name, over] of rows) {
    const { error } = await c.from("ledger_entries").insert({
      project_id: P, module_key: "payments", ...over,
    });
    check(`${name} is refused by the table itself`, !!error);
  }
  const { error: wrongShape } = await c.from("ledger_entries").insert({
    project_id: P, module_key: "customers", doc_no: "RC-2026-9004",
    direction: "in", amount_cents: 100,
  });
  check("a module of another shape is refused by the table itself", !!wrongShape);
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  failures.push(err.message);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  console.log("\n(test account deleted)");
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
