/**
 * Can this business still write down its own work?
 *
 * Numbering, and the column an owner added for himself. Both are things that
 * only break when somebody DELETES, or presses twice at once, or names a
 * column of their own -- none of which any unit test in this repo does.
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
 *   ④ a directory page's three columns read as a pipeline's four (…07000)
 *      客户 · 联络方式 · 状态 has no `amount`, so 「新客户」 was read as money
 *      and dropped -- the owner's own word for that customer, gone silently.
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

  console.log("\n⑥ 这间店自己多的那一栏");
  /* The tenth of a business that is only that business: a workshop keeps a
     plate number, a salon a colour formula, a wholesaler a container number.
     It rides in `extra`, keyed by the owner's own column key, so a hundred
     shops share one table and none of them needs a schema change.

     Asserted against the real RPC on purpose: a jsonb argument the function
     quietly ignores looks exactly like one it stored, and this column sat in
     both tables for a day with nothing writing it. */
  const { data: withPlate, error: plateErr } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "projects", in_title: "换机油",
    in_party: "陈先生", in_extra: { c1: "WXY 1234" },
  });
  check("the RPC stores a column this business invented",
    withPlate?.extra?.c1 === "WXY 1234", plateErr?.message ?? JSON.stringify(withPlate?.extra));

  const { data: readBack } = await c
    .from("pipeline_records").select("extra").eq("id", withPlate.id).single();
  check("and it is still there when the page reads it back",
    readBack?.extra?.c1 === "WXY 1234", JSON.stringify(readBack?.extra));

  const { data: money, error: moneyErr } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_amount_cents: 5000,
    in_party: "陈先生", in_note: "订金", in_extra: { c1: "Maybank" },
  });
  check("the money table takes one too",
    money?.extra?.c1 === "Maybank", moneyErr?.message ?? JSON.stringify(money?.extra));


  console.log("\n⑦ 第三个形状：名词不是单据");
  /* directory went live 2026-08-31. Everything below is a promise the
     migration header makes, checked against the database rather than against
     the header. */
  const party = (over = {}) =>
    c.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: "陈先生", ...over,
    });

  const { data: mr, error: mrErr } = await party({
    in_phone: "03-7788 1234", in_whatsapp: "012-345 6789", in_region: "Cheras",
  });
  check("a customer can be written down at all", !!mr, mrErr?.message?.slice(0, 80));
  check("and the two numbers stay two numbers",
    mr?.phone === "03-7788 1234" && mr?.whatsapp === "012-345 6789",
    JSON.stringify({ phone: mr?.phone, whatsapp: mr?.whatsapp }));

  /* THE DECISION THIS PROVES: a customer is a noun, not a document. If
     next_doc_no ever learns to number them, a person starts having QT-2026-
     0007 printed beside their name -- and a number, once shown, cannot be
     taken back. So the refusal is asserted, not assumed. */
  const { error: numbered } = await c.rpc("next_doc_no", {
    in_project_id: P, in_module_key: "customers",
  });
  check("a party is never handed a document number", !!numbered,
    "next_doc_no answered for a directory module");

  const { error: blank } = await party({ in_name: "   " });
  check("a party with no name is refused", !!blank, "a nameless row is unfindable");

  const { error: wrongShapeRpc } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "quotations", in_name: "陈先生",
  });
  check("and a module of another shape is refused", !!wrongShapeRpc);

  /* Pressing 保存 twice on 4G. Same key, same row -- not two customers. */
  const twice = crypto.randomUUID();
  const first = await party({ in_name: "李太太", in_idempotency_key: twice });
  const again = await party({ in_name: "李太太", in_idempotency_key: twice });
  check("pressing it twice is one customer",
    !!first.data && first.data.id === again.data?.id,
    `${first.data?.id} vs ${again.data?.id ?? again.error?.message}`);

  const { data: member, error: memberErr } = await party({
    in_name: "王老板", in_extra: { c1: "会员 88" },
  });
  check("this business's own column rides along here too",
    member?.extra?.c1 === "会员 88", memberErr?.message ?? JSON.stringify(member?.extra));

  /* Off the shelf, not gone: last year's supplier is still the answer to
     「上次那家云石厂叫什么」. The projection filters archived rows; the table
     keeps them. */
  await c.from("directory_entries")
    .update({ archived_at: new Date().toISOString() }).eq("id", member.id);
  const onShelf = await c.from("directory_entries")
    .select("id").eq("project_id", P).eq("module_key", "customers").is("archived_at", null);
  const inTable = await c.from("directory_entries")
    .select("id").eq("project_id", P).eq("module_key", "customers");
  check("an archived party leaves the shelf",
    !onShelf.data?.some((r) => r.id === member.id));
  check("and is still in the book",
    !!inTable.data?.some((r) => r.id === member.id));

  const { error: noName } = await c.from("directory_entries").insert({
    project_id: P, module_key: "customers",
  });
  check("the table itself refuses a row with no name", !!noName);

  const { error: badKind } = await c.from("directory_entries").insert({
    project_id: P, module_key: "customers", name: "试", kind: "robot",
  });
  check("and an invented kind", !!badKind);

  const { error: notDirectory } = await c.from("directory_entries").insert({
    project_id: P, module_key: "payments", name: "试",
  });
  check("and a module of another shape", !!notDirectory);

  console.log("\n⑧ 单据连到人身上");
  /* 20260831080000. The promise both earlier shapes wrote down: the text stays
     as what was written at the time, the link says who it is. */
  const { data: tan } = await party({ in_name: "陈大文" });
  const { data: linkedQuote } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "厨房翻新", in_party: "陈大文", in_amount_cents: 480000,
  });
  check("a quotation finds the customer by the name he typed",
    linkedQuote?.party_id === tan?.id,
    `${linkedQuote?.party_id} vs ${tan?.id}`);

  const { data: paidIn } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_amount_cents: 100000, in_against_id: linkedQuote.id, in_party: "",
  });
  /* Money against a document belongs to whoever that document belongs to,
     even when the name box was left empty. */
  check("a payment against that quotation inherits its customer",
    paidIn?.party_id === tan?.id, `${paidIn?.party_id}`);

  /* TWO PEOPLE WITH ONE NAME. Real, and the reason the name is not unique.
     Attaching money to the wrong account silently is worse than a gap. */
  const { data: twin } = await party({ in_name: "陈大文" });
  const { data: ambiguous } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "第二单", in_party: "陈大文",
  });
  check("it refuses to choose between two people with the same name",
    ambiguous?.party_id === null, `${ambiguous?.party_id}`);
  check("and the row still carries what he typed", ambiguous?.party === "陈大文");

  const { data: byId } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "指定的", in_party: "陈大文", in_party_id: twin.id,
  });
  check("a caller that knows which one is believed", byId?.party_id === twin.id);

  const { error: notMine } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "别人的客户",
    in_party_id: "00000000-0000-0000-0000-000000000001",
  });
  check("a party from outside this project is refused", !!notMine);

  /* vibe-dealer 0011: a party with history is not deletable. An onboarding
     mistake with nothing against it still is. */
  const { error: hasHistory } = await c.from("directory_entries").delete().eq("id", tan.id);
  check("a customer with a quotation against him cannot be deleted", !!hasHistory);

  const { data: spare } = await party({ in_name: "删得掉的" });
  const { error: mistake } = await c.from("directory_entries").delete().eq("id", spare.id);
  check("an onboarding mistake with nothing against it still can be", !mistake, mistake?.message);

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
