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

  console.log("\n⑨ 他能不能修自己写错的");
  /* 20260831100000. 「他加得进去，改不了，也删不掉。」 */
  const { data: typo } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "打错的", in_party: "陈大文", in_amount_cents: 999900,
  });
  const { data: fixed, error: fixErr } = await c.rpc("update_pipeline_record", {
    in_id: typo.id, in_title: "改好的", in_amount_cents: 480000,
  });
  check("一张报价单改得了", fixed?.title === "改好的" && fixed?.amount_cents === 480000,
    fixErr?.message ?? `${fixed?.title} ${fixed?.amount_cents}`);
  check("而单号没有跟着变", fixed?.doc_no === typo.doc_no, `${typo.doc_no} -> ${fixed?.doc_no}`);

  /* 没给的栏位不准被清空 —— 一个只改金额的表单会把其余的送成 null。 */
  check("没碰的栏位留着", fixed?.party === "陈大文", fixed?.party);

  const { data: away } = await c.rpc("set_pipeline_archived", { in_id: typo.id, in_archived: true });
  check("收得起来", !!away?.archived_at);
  const { data: shelf } = await c
    .from("pipeline_records").select("id").eq("project_id", P)
    .eq("module_key", "quotations").is("archived_at", null);
  check("收起来之后不在名单上", !shelf?.some((r) => r.id === typo.id));
  const { data: back } = await c.rpc("set_pipeline_archived", { in_id: typo.id, in_archived: false });
  check("也放得回架上", back?.archived_at === null);

  /* 钱不一样：金额、日期、对方都不给改，只有字给改。 */
  const { data: cash } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_amount_cents: 250000, in_party: "陈大文", in_note: "打错的备注",
  });
  const { data: worded, error: wErr } = await c.rpc("update_ledger_words", {
    in_id: cash.id, in_note: "改好的备注", in_method: "转账",
  });
  check("一笔收款的字改得了",
    worded?.note === "改好的备注" && worded?.method === "转账", wErr?.message);
  check("而金额一分都没动", worded?.amount_cents === 250000, `${worded?.amount_cents}`);

  const { data: rev, error: rErr } = await c.rpc("reverse_ledger_entry", { in_entry_id: cash.id });
  check("冲正开得出来", rev?.direction === "out" && rev?.amount_cents === 250000,
    rErr?.message ?? `${rev?.direction} ${rev?.amount_cents}`);
  check("冲正那一笔指着原来那一笔", rev?.adjusts_id === cash.id);
  check("而且它跟着同一个客户", rev?.party_id === cash.party_id, `${rev?.party_id}`);
  const { error: againErr } = await c.rpc("reverse_ledger_entry", { in_entry_id: cash.id });
  check("同一笔不能冲正两次", !!twice);

  /* 别人的记录碰不到 —— RLS 的那一层。 */
  const { error: notOurs } = await c.rpc("update_pipeline_record", {
    in_id: "00000000-0000-0000-0000-000000000009", in_title: "偷改",
  });
  check("改不了不属於这个项目的单", !!notOurs);

  console.log("\n⑩ 表单收的每一格，都要存得进也读得回");
  /* A box that swallows what he types is worse than no box. 地址 · 公司注册号 ·
     税号 were held back until 改这一单 existed to show them again -- this is
     the check that the round trip is real, field by field, against the
     database rather than against the form. */
  const FILLED = {
    in_name: "陈氏建材有限公司",
    in_kind: "company",
    in_contact_person: "陈老板",
    in_phone: "03-7788 1234",
    in_whatsapp: "012-345 6789",
    in_email: "boss@chan.my",
    in_region: "Cheras",
    in_address: "12, Jalan Besar, Taman Desa",
    in_reg_no: "202301012345 (1234567-A)",
    in_tax_id: "C12345678900",
    in_status: "长期供应",
    in_note: "水泥跟砖，账期 30 天",
  };
  const { data: full, error: fullErr } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", ...FILLED,
  });
  check("每一格都存进去了", !!full, fullErr?.message?.slice(0, 80));
  for (const [arg, value] of Object.entries(FILLED)) {
    const col = arg.replace(/^in_/, "");
    check(`  · ${col}`, full?.[col] === value, `${full?.[col]}`);
  }

  const { data: reread } = await c
    .from("directory_entries")
    .select("address, reg_no, tax_id")
    .eq("id", full.id)
    .single();
  check("而且页面读得回来",
    reread?.address === FILLED.in_address &&
      reread?.reg_no === FILLED.in_reg_no &&
      reread?.tax_id === FILLED.in_tax_id,
    JSON.stringify(reread));

  const { data: edited, error: edErr } = await c.rpc("update_directory_entry", {
    in_id: full.id, in_address: "88, Jalan Baru", in_tax_id: "C99999999900",
  });
  check("改也改得动", edited?.address === "88, Jalan Baru" && edited?.tax_id === "C99999999900",
    edErr?.message);
  check("而没碰的那几格留着", edited?.reg_no === FILLED.in_reg_no && edited?.phone === FILLED.in_phone);

  console.log("\n\u246a \u8fdb\u8d27\u5355\uff1a\u4e70\u7684\u90a3\u4e00\u8fb9");
  /* 20260831110000. A purchase order is a pipeline, and the one thing about it
     that is not like its four siblings: its counterparty is a SUPPLIER. */
  const { data: yard } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", in_name: "\u4e91\u77f3\u5382 C",
  });
  const { data: alsoCustomer } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "\u4e91\u77f3\u5382 C",
  });

  const { data: po, error: poErr } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases",
    in_title: "\u4e91\u77f3 \u00b7 \u53a8\u623f\u53f0\u9762", in_party: "\u4e91\u77f3\u5382 C", in_amount_cents: 860000,
  });
  check("\u5f00\u5f97\u51fa\u4e00\u5f20\u8fdb\u8d27\u5355", !!po, poErr?.message?.slice(0, 80));
  check("\u5355\u53f7\u662f PO", po?.doc_no?.startsWith("PO-"), po?.doc_no);

  /* THE ONE THAT MATTERS. The same name exists on both sides -- a stone yard
     that also buys from him. A purchase order must land on the SUPPLIER. */
  check("\u5b83\u8fde\u5230\u4f9b\u5e94\u5546\uff0c\u4e0d\u662f\u540c\u540d\u7684\u5ba2\u6237",
    po?.party_id === yard?.id && po?.party_id !== alsoCustomer?.id,
    `${po?.party_id} | supplier ${yard?.id} | customer ${alsoCustomer?.id}`);

  const { error: wrongSide } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases",
    in_title: "\u6307\u5b9a\u9519\u8fb9", in_party_id: alsoCustomer.id,
  });
  check("\u6307\u5b9a\u4e00\u4e2a\u5ba2\u6237\u5f53\u4f9b\u5e94\u5546\uff0c\u88ab\u62d2", !!wrongSide);

  /* And a quotation still lands on the customer of that name, not the
     supplier -- the sides do not swap. */
  const { data: qt } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "\u5356\u7ed9\u4ed6", in_party: "\u4e91\u77f3\u5382 C",
  });
  check("\u800c\u62a5\u4ef7\u5355\u8fd8\u662f\u8fde\u5230\u5ba2\u6237\u90a3\u4e00\u8fb9",
    qt?.party_id === alsoCustomer?.id, `${qt?.party_id}`);

  /* \u4ed8\u94b1\u7ed9\u4f9b\u5e94\u5546 -- money OUT goes to the supplier side. */
  const { data: paidOut } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses",
    in_amount_cents: 860000, in_party: "\u4e91\u77f3\u5382 C", in_note: "\u4ed8\u4e91\u77f3",
  });
  check("\u4e00\u7b14\u5f00\u9500\u8fde\u5230\u7684\u662f\u4f9b\u5e94\u5546",
    paidOut?.party_id === yard?.id, `${paidOut?.party_id}`);

  /* 买的那一边有自己的流程。 The questionnaire asked how he SELLS, so a purchase
     order with no stage used to start at 「Enquiry」 -- over an order for
     cement. Buying is 开了单 → 到货了 → 付清了 for everybody. */
  const { data: noStage } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "没写阶段",
  });
  check("进货单默认从「开了单」开始，不是销售流程的第一步",
    ["开了单", "Ordered"].includes(noStage?.stage ?? ""), noStage?.stage);

  const { data: sold } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "卖的",
  });
  check("而报价单还是他自己的流程",
    !["开了单", "Ordered"].includes(sold?.stage ?? ""), sold?.stage);

  console.log("\n⑫ 逐项明细");
  /* 20260831150000. LHDN's MyInvois marks Description, Unit Price, Tax Type,
     Tax Amount, Subtotal and Total Excluding Tax [1-1] at LINE level -- a
     product that cannot hold a line cannot issue a legal invoice here. */
  const { data: quoteDoc } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Taman Desa 三房翻新",
  });
  const { data: lines, error: lineErr } = await c.rpc("set_record_lines", {
    in_record_id: quoteDoc.id,
    in_lines: [
      { description: "拆除旧厨房", amount_cents: 300000 },
      { description: "泥水", qty: "1", unit: "项", unit_price_cents: 1200000, amount_cents: 1200000 },
      { description: "油漆", qty: "2.5", unit: "房", unit_price_cents: 200000, amount_cents: 500000 },
    ],
  });
  check("一张单存得下三行", lines?.length === 3, lineErr?.message?.slice(0, 80));
  check("顺序是他写的那个顺序",
    lines?.map((l) => l.description).join("|") === "拆除旧厨房|泥水|油漆",
    lines?.map((l) => l.description).join("|"));
  check("半个数量不会被抹掉", Number(lines?.[2]?.qty) === 2.5, `${lines?.[2]?.qty}`);
  check("一行可以没有数量（一笔包工）", lines?.[0]?.qty === null, `${lines?.[0]?.qty}`);

  const { data: totalled } = await c
    .from("pipeline_records").select("amount_cents").eq("id", quoteDoc.id).single();
  check("总数自己加起来了", totalled?.amount_cents === 2000000, `${totalled?.amount_cents}`);

  /* Change one line: the document's total has to follow, because six things
     already read that column. */
  await c.rpc("set_record_lines", {
    in_record_id: quoteDoc.id,
    in_lines: [{ description: "只剩拆除", amount_cents: 300000 }],
  });
  const { data: after1 } = await c
    .from("pipeline_records").select("amount_cents").eq("id", quoteDoc.id).single();
  check("改了行，总数跟着变", after1?.amount_cents === 300000, `${after1?.amount_cents}`);

  const { data: emptied } = await c.rpc("set_record_lines", { in_record_id: quoteDoc.id, in_lines: [] });
  check("清空之后没有行", (emptied ?? []).length === 0);
  const { data: after2 } = await c
    .from("pipeline_records").select("amount_cents").eq("id", quoteDoc.id).single();
  check("而总数交回给他自己填", after2?.amount_cents === null, `${after2?.amount_cents}`);

  const { error: noDesc } = await c.rpc("set_record_lines", {
    in_record_id: quoteDoc.id, in_lines: [{ amount_cents: 100 }],
  });
  check("没写是什么的一行，拒掉", !!noDesc);

  const { error: otherDoc } = await c.rpc("set_record_lines", {
    in_record_id: "00000000-0000-0000-0000-000000000009", in_lines: [{ description: "x" }],
  });
  check("写不了别人的单", !!otherDoc);

  /* THE DENORMALISED COLUMN. A client naming its own project while pointing at
     somebody else's document would otherwise pass the policy. */
  const { data: rawLine } = await c.from("record_lines").insert({
    record_id: quoteDoc.id, project_id: P, description: "直接写的", amount_cents: 100,
  }).select().single();
  check("直接写的行，项目跟着单走", rawLine?.project_id === P, `${rawLine?.project_id}`);
  await c.from("record_lines").delete().eq("id", rawLine.id);

  /* Deleting the document takes its lines with it -- there is nothing to keep. */
  const { data: doomed } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "要删的",
  });
  await c.rpc("set_record_lines", { in_record_id: doomed.id, in_lines: [{ description: "一行" }] });
  await c.from("pipeline_records").delete().eq("id", doomed.id);
  const { data: orphans } = await c.from("record_lines").select("id").eq("record_id", doomed.id);
  check("删掉单，行也跟着走", (orphans ?? []).length === 0);

  // ⑧ 询价 → 报价单 ────────────────────────────────────
  /* The one arrow the product is sold on: a stranger fills in the form on his
     website and the owner presses once. Every assertion here is a real press
     as the real customer -- see 20260901050000. */
  console.log("\n⑧ 询价 → 报价单");

  const enquiry = async (name, contact, answers, lands = "quotations") => {
    /* Written with the admin key ON PURPOSE: a stranger's submission comes in
       through submit_site_enquiry from a browser with no session, and this
       checker is about what the OWNER can then do with it. */
    const { data, error } = await admin.from("site_enquiries").insert({
      project_id: P, name, contact, answers, lands_in: lands,
    }).select().single();
    if (error) throw new Error(`enquiry: ${error.message}`);
    return data;
  };

  /* ⚠️ 016 AND NOT 012. ⑥ above already put a 陈先生 on file whose
     WhatsApp is 012-345 6789 -- so an enquiry on that number is the SAME MAN
     and must reuse him, which is tested on its own below. This one is a
     stranger, so it has to be a number nobody has. My first version used 012
     and read the reuse as a bug; the checker was right and I was not. */
  const e1 = await enquiry("李先生", "016-222 8888", { "想做什么": "厨房翻新，三房" });
  const { data: conv1, error: convErr } = await c.rpc("convert_enquiry", { in_enquiry_id: e1.id });
  const g1 = (conv1 ?? [])[0];
  check("一按就开出一张单", !!g1?.record_id, convErr?.message);
  check("单号是那一页自己的", /^[A-Z]{2}-\d{4}-\d{4}$/.test(g1?.doc_no ?? ""), g1?.doc_no);
  check("顺手把人变成客户", !!g1?.party_id);

  const { data: fromEnq } = await c.from("pipeline_records").select("*").eq("id", g1.record_id).single();
  /* NOT 「一封询价」 -- what they asked for. The trade's own first question is
     the closest thing to a subject line that exists. */
  check("标题是他问的那件事", fromEnq?.title === "厨房翻新，三房", fromEnq?.title);
  check("单子连到那个客户", fromEnq?.party_id === g1.party_id);
  /* He has not quoted yet. A figure here would be a number nobody agreed to. */
  check("还没有金额", fromEnq?.amount_cents === null, String(fromEnq?.amount_cents));
  check("记得是哪一封询价来的", fromEnq?.extra?.from_enquiry === e1.id);

  const { data: enqParty } = await c.from("directory_entries").select("*").eq("id", g1.party_id).single();
  check("电话认出来是电话，不是 email",
    enqParty?.phone === "016-222 8888" && enqParty?.email === "",
    `${enqParty?.phone}|${enqParty?.email}`);

  const { data: e1After } = await c.from("site_enquiries").select("status, converted_at").eq("id", e1.id).single();
  check("那一封标成处理好了", e1After?.status === "done" && !!e1After?.converted_at);

  /* A double-tap on a phone is the normal case, not a mistake. */
  const { data: conv1b } = await c.rpc("convert_enquiry", { in_enquiry_id: e1.id });
  const g1b = (conv1b ?? [])[0];
  check("再按一次，回同一张单", g1b?.record_id === g1.record_id && g1b?.already === true);

  /* The same person asking twice is normal in this trade; two 李先生 in the
     customer list is not. */
  const e2 = await enquiry("李先生", "016-222 8888", { "想做什么": "厕所也要做" });
  const { data: conv2 } = await c.rpc("convert_enquiry", { in_enquiry_id: e2.id });
  const g2 = (conv2 ?? [])[0];
  check("同一个人再问一次，第二张单", g2?.record_id !== g1.record_id);
  check("而客户只有一个", g2?.party_id === g1.party_id);

  /* ⑥'s 陈先生 has phone 03-7788 1234 and WhatsApp 012-345 6789. An enquiry
     on the WhatsApp number is him -- a contractor's customer gives whichever
     number he happens to be holding. */
  const eSame = await enquiry("陈总", "012-345 6789", { "想做什么": "上次那间房" });
  const { data: convSame } = await c.rpc("convert_enquiry", { in_enquiry_id: eSame.id });
  check("号码对得上，就是那个旧客户（名字写不一样也算）",
    (convSame ?? [])[0]?.party_id === mr?.id, `${(convSame ?? [])[0]?.party_id} vs ${mr?.id}`);

  /* 🔴 THE ONE THIS CHECKER FOUND AND A CLEAN-ROOM SCRIPT COULD NOT.
     Same name as ⑥'s 陈先生, a number he has never had. The first rule matched
     on 「contact OR name」 and handed the new caller somebody else's record --
     so a quotation would have gone to the wrong man's phone. A name match
     whose contact disagrees is evidence of TWO people. See 20260901060000. */
  const eTwin = await enquiry("陈先生", "019-777 1111", { "想做什么": "另一个陈先生" });
  const { data: convTwin } = await c.rpc("convert_enquiry", { in_enquiry_id: eTwin.id });
  const { data: otherTan } = await c.from("directory_entries").select("id, phone")
    .eq("id", (convTwin ?? [])[0]?.party_id).single();
  check("同名但号码不同，是两个人",
    otherTan?.id !== mr?.id && otherTan?.phone === "019-777 1111", `${otherTan?.id} / ${otherTan?.phone}`);

  const e3 = await enquiry("Ms Lim", "lim@example.com", { "想做什么": "办公室装修" });
  const { data: conv3 } = await c.rpc("convert_enquiry", { in_enquiry_id: e3.id });
  const { data: p3 } = await c.from("directory_entries").select("phone, email").eq("id", (conv3 ?? [])[0]?.party_id).single();
  check("email 认出来是 email", p3?.email === "lim@example.com" && p3?.phone === "", `${p3?.phone}|${p3?.email}`);

  /* Deleting the quotation must not delete the evidence that somebody asked. */
  await c.from("pipeline_records").delete().eq("id", g1.record_id);
  const { data: e1c } = await c.from("site_enquiries").select("id, converted_record_id, converted_at").eq("id", e1.id).single();
  check("删掉那张单，那一封询价还在",
    !!e1c?.id && e1c.converted_record_id === null && !!e1c.converted_at);

  // ⑨ 库存 · 进货单收货 ─────────────────────────────────
  console.log("\n⑨ 库存 · 进货单收货");

  /* This project may not have been given a stock page by its industry. Added
     the way the product adds one, so the section runs everywhere. */
  await admin.from("project_pages").upsert(
    { project_id: P, page_key: "inventory", layout_json: {} },
    { onConflict: "project_id,page_key" },
  );

  const { data: cementItem } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "水泥 50kg", in_unit: "包",
    in_reorder_at: 20,
  });
  check("加得了一个货品", !!cementItem?.id);
  await c.rpc("move_stock", {
    in_item_id: cementItem.id, in_direction: "in", in_qty: 10, in_reason: "开帐",
  });

  const { data: onHand0 } = await c
    .from("stock_on_hand").select("on_hand").eq("item_id", cementItem.id).single();
  check("进出加起来就是现在有多少", Number(onHand0?.on_hand) === 10, String(onHand0?.on_hand));

  const { data: goodsPo } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "建材行 A", in_party: "建材行 A",
  });
  await c.rpc("set_record_lines", {
    in_record_id: goodsPo.id,
    in_lines: [
      { description: "水泥 50kg", qty: "100", unit: "包", unit_price_cents: "1850", amount_cents: "185000" },
      { description: "沙 · 幼", qty: "3", unit: "车", unit_price_cents: "12000", amount_cents: "36000" },
      /* A lump-sum line. There is nothing to put on a shelf. */
      { description: "运费", amount_cents: "5000" },
    ],
  });

  const { data: recv, error: recvErr } = await c.rpc("receive_purchase", { in_record_id: goodsPo.id });
  const got = (recv ?? [])[0];
  check("收货：两行进了库存", Number(got?.moved) === 2, `${JSON.stringify(got)} ${recvErr?.message ?? ""}`);
  check("单上没有的货品，自己开一个", Number(got?.created) === 1, String(got?.created));
  check("没有数量的那一行跳过", Number(got?.skipped) === 1, String(got?.skipped));
  /* Not a hardcoded 「到货了」: a fresh account's system speaks English, which
     is what tripped my own first expectation. */
  check("单子走到「到货了」", ["到货了", "Received"].includes(got?.stage ?? ""), got?.stage);

  const { data: shelfNow } = await c
    .from("stock_on_hand").select("name, on_hand").eq("project_id", P);
  const byName = Object.fromEntries((shelfNow ?? []).map((r) => [r.name, Number(r.on_hand)]));
  /* The line said 水泥 50kg and the shelf already had one. A SECOND entry with
     the same name would be the same thing typed twice -- which is why items
     match on name and people deliberately do not (20260901060000). */
  check("10 + 100 = 110，认出来是同一个货品", byName["水泥 50kg"] === 110, JSON.stringify(byName));
  check("新开的那个也进了", byName["沙 · 幼"] === 3, JSON.stringify(byName));

  const { data: moves } = await c
    .from("stock_moves").select("id, doc_no, reason, against_id, line_id, cost_cents")
    .eq("against_id", goodsPo.id);
  check("每一笔记得住是哪一张单 · 哪一行",
    (moves ?? []).length === 2 && (moves ?? []).every((x) => x.against_id === goodsPo.id && !!x.line_id));
  check("单价跟着进来了", (moves ?? []).some((x) => x.cost_cents === 1850));

  const { data: againRecv } = await c.rpc("receive_purchase", { in_record_id: goodsPo.id });
  check("再按一次收货，一行都不会再进", Number((againRecv ?? [])[0]?.moved) === 0, JSON.stringify((againRecv ?? [])[0]));

  /* 🔴 THE ONE THAT WAS REAL, AND ONLY DOING IT FOUND IT.
     He receives, then adds a delivery line, then presses receive again.
     `set_record_lines` replaces every line with a NEW id, so the movements no
     longer recognised them and the whole order came in a second time --
     measured, 100 bags became 200. The lines of a received order are closed
     now, the way a submitted document is in any accounting system. */
  const { error: shutErr } = await c.rpc("set_record_lines", {
    in_record_id: goodsPo.id,
    in_lines: [{ description: "水泥 50kg", qty: "100", unit: "包" }, { description: "运费" }],
  });
  check("收过货的单，行不能再改", !!shutErr, shutErr ? "" : "🔴 lines were replaced after receiving");
  check("而且拒绝的时候讲的是人话",
    /already in your stock|已经进了库存/.test(shutErr?.message ?? ""), shutErr?.message?.slice(0, 60));
  const { data: shelf2 } = await c
    .from("stock_on_hand").select("name, on_hand").eq("project_id", P);
  check("所以总数没有变成两倍",
    Object.fromEntries((shelf2 ?? []).map((r) => [r.name, Number(r.on_hand)]))["水泥 50kg"] === 110);

  /* Editing BEFORE anything has arrived is the ordinary case and must still
     work -- 100 ordered, 60 came, change the line and then receive. */
  const { data: goodsPo2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "另一张",
  });
  await c.rpc("set_record_lines", {
    in_record_id: goodsPo2.id, in_lines: [{ description: "水泥 50kg", qty: "100", unit: "包" }],
  });
  const { error: editErr } = await c.rpc("set_record_lines", {
    in_record_id: goodsPo2.id, in_lines: [{ description: "水泥 50kg", qty: "60", unit: "包" }],
  });
  check("还没收货的单，行照样改得动", !editErr, editErr?.message);

  const { data: notAPo } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "报价",
  });
  const { error: notPo } = await c.rpc("receive_purchase", { in_record_id: notAPo.id });
  check("报价单收不了货", !!notPo);

  /* ── 有效期：一个他填得上、也拿得掉的日子 ────────────────────────────
     `due_on` 从建表那天就在，两支 RPC 都收 in_due_on —— 而到 2026-09-03
     零个 TypeScript 传过它（第十六次「能力有、线没接」）。这一段用真的客户
     身分把那条线打一次，因为 supabase db push 成功证明不了任何事：
     plpgsql 到执行才解析名字。 */
  const { data: dated, error: dateErr } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "有效期测试",
    in_amount_cents: 120000, in_due_on: "2026-10-03",
  });
  check("开单的时候填得上有效期", !dateErr && dated?.due_on === "2026-10-03",
    dateErr?.message ?? `拿回来的是 ${dated?.due_on}`);

  if (dated?.id) {
    const { data: moved } = await c.rpc("update_pipeline_record", {
      in_id: dated.id, in_due_on: "2026-11-30",
    });
    check("改得了那个日子", moved?.due_on === "2026-11-30", `拿回来的是 ${moved?.due_on}`);

    /* 只改别的栏位的时候，日子不可以被顺手抹掉 —— null 的意思是「不要动」。 */
    const { data: kept } = await c.rpc("update_pipeline_record", {
      in_id: dated.id, in_title: "改个名字",
    });
    check("改名字不会把日子弄丢", kept?.due_on === "2026-11-30", `拿回来的是 ${kept?.due_on}`);

    /* 🔴 这一条是 20260903010000 唯一要修的那个洞：在它之前，
       一个日子填进去就永远拿不掉，因为 coalesce(null, due_on) 读成「不要动」。 */
    const { data: cleared, error: clearErr } = await c.rpc("update_pipeline_record", {
      in_id: dated.id, in_clear_due_on: true,
    });
    check("他删得掉那个日子", !clearErr && cleared?.due_on === null,
      clearErr?.message ?? `拿回来的是 ${cleared?.due_on}`);
  }

  /* ── 分期付款表：订金 30% · 动工 40% · 完工 30% ──────────────────────
     20260903020000。用真的客户身分打，因为 plpgsql 到执行才解析名字 ——
     db push 成功证明不了任何事（重点 26）。 */
  const { data: staged } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "分期测试",
    in_amount_cents: 4850000,
  });

  const { data: terms, error: termErr } = await c.rpc("set_record_terms", {
    in_record_id: staged.id,
    in_terms: [
      { description: "订金", portion: 30, due_on: "2026-09-10" },
      { description: "动工", portion: 40 },
      { description: "完工", portion: 30, due_on: null },
    ],
  });
  check("写得进三期", !termErr && terms?.length === 3, termErr?.message ?? `拿回 ${terms?.length}`);
  check("顺序照他写的", terms?.[0]?.description === "订金" && terms?.[2]?.description === "完工");
  check("没有日期的那一期是空的，不是今天",
    terms?.[1]?.due_on === null, `拿回来的是 ${terms?.[1]?.due_on}`);

  /* 🔴 分期表不可以动那张单的总数。它把同一笔钱切开，一分都没有变。
     一支「把分期加起来写回去」的触发器，会让只写了订金的单总数变成三成。 */
  const { data: docAfterTerms } = await c
    .from("pipeline_records").select("amount_cents").eq("id", staged.id).single();
  check("分期表不会改掉单的总数", docAfterTerms?.amount_cents === 4850000,
    `总数变成 ${docAfterTerms?.amount_cents}`);

  const { error: bothErr } = await c.rpc("set_record_terms", {
    in_record_id: staged.id,
    in_terms: [{ description: "两个都给", portion: 30, amount_cents: 100000 }],
  });
  check("一期不可以同时是比例又是金额", !!bothErr && /percentage or an amount/.test(bothErr.message),
    bothErr?.message);

  const { error: neitherErr } = await c.rpc("set_record_terms", {
    in_record_id: staged.id,
    in_terms: [{ description: "什么都没给" }],
  });
  check("一期一定要讲得出自己是多少", !!neitherErr, neitherErr?.message);

  const { error: hugeErr } = await c.rpc("set_record_terms", {
    in_record_id: staged.id,
    in_terms: Array.from({ length: 13 }, (_, i) => ({ description: `第${i}期`, portion: 5 })),
  });
  check("十二期以上挡下来", !!hugeErr, hugeErr?.message);

  /* 上面三次被拒绝之后，原本那三期要还在 —— 一次被拒绝的写入不可以把
     他已经写好的东西删掉一半。整批换是先 delete 再 insert，所以这一条
     真正验的是那一整支跑在同一个交易里。 */
  const { data: still } = await c
    .from("record_terms").select("description").eq("record_id", staged.id);
  check("被拒绝之后，原本那三期还在", still?.length === 3, `剩下 ${still?.length} 期`);

  const { data: cleanedTerms } = await c.rpc("set_record_terms", {
    in_record_id: staged.id, in_terms: [],
  });
  check("清空分期表", Array.isArray(cleanedTerms) && cleanedTerms.length === 0);

  /* 别人的单碰不得。这一条挡的是最贵的那种错。 */
  const { error: termsNotMine } = await c.rpc("set_record_terms", {
    in_record_id: "00000000-0000-0000-0000-000000000000",
    in_terms: [{ description: "订金", portion: 30 }],
  });
  check("别人的单写不进分期", !!termsNotMine);

  /* ── 一笔钱分摊多张单 ──────────────────────────────────────────────
     20260903030000 · 20260903040000。这一整段验的是钱那一层，所以每一条
     都用真的客户身分打，而不是读 SQL（重点 26）。 */
  console.log("\n⑬ 一笔钱分摊多张单");

  const { data: docA } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "A 厨房",
    in_amount_cents: 1_200_000,
  });
  const { data: docB } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "B 浴室",
    in_amount_cents: 800_000,
  });
  const { data: bigPay } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_amount_cents: 2_000_000, in_party: "陈老板",
  });

  const { data: split, error: splitErr } = await c.rpc("set_payment_allocations", {
    in_entry_id: bigPay.id,
    in_rows: [
      { record_id: docA.id, amount_cents: 1_200_000 },
      { record_id: docB.id, amount_cents: 500_000 },
    ],
  });
  check("一笔钱分给两张单", !splitErr && split?.length === 2,
    splitErr?.message ?? `拿回 ${split?.length}`);

  /* 🔴 这一条是整支的重点：allocated_cents 从今天起是加总出来的，
     而剩下那 RM 3,000 就是订金 —— 任务 61 · 67 · 44 三天各要过一次的那个数字。 */
  const { data: afterSplit } = await c
    .from("ledger_entries").select("allocated_cents, amount_cents, against_id")
    .eq("id", bigPay.id).single();
  check("已分摊是加总出来的", afterSplit?.allocated_cents === 1_700_000,
    `${afterSplit?.allocated_cents}`);
  check("剩下的就是订金", (afterSplit?.amount_cents ?? 0) - (afterSplit?.allocated_cents ?? 0) === 300_000);
  /* 分给两张的时候「这笔钱是给哪一张的」没有答案，所以 against_id 是 null。 */
  check("分给两张单，against_id 不再指着任何一张", afterSplit?.against_id === null,
    `${afterSplit?.against_id}`);

  const { data: oneOnly } = await c.rpc("set_payment_allocations", {
    in_entry_id: bigPay.id,
    in_rows: [{ record_id: docA.id, amount_cents: 1_200_000 }],
  });
  const { data: afterOne } = await c
    .from("ledger_entries").select("allocated_cents, against_id").eq("id", bigPay.id).single();
  check("只分给一张的时候 against_id 就是那一张",
    oneOnly?.length === 1 && afterOne?.against_id === docA.id, `${afterOne?.against_id}`);

  /* 分摊不可以超过那笔钱本身。资料库那条 check 是最后一层，这一句是给人看的。 */
  const { error: tooMuch } = await c.rpc("set_payment_allocations", {
    in_entry_id: bigPay.id,
    in_rows: [
      { record_id: docA.id, amount_cents: 1_200_000 },
      { record_id: docB.id, amount_cents: 900_000 },
    ],
  });
  check("分摊超过那笔钱，挡下来", !!tooMuch && /more than the payment/.test(tooMuch.message),
    tooMuch?.message);

  /* 被拒绝之后，原本那一笔分摊要还在 —— 整批换是先删再插，
     这一条真正验的是那一整支跑在同一个交易里。 */
  const { data: stillOne } = await c
    .from("ledger_allocations").select("id").eq("entry_id", bigPay.id);
  check("被拒绝之后，原本那一笔分摊还在", stillOne?.length === 1, `剩下 ${stillOne?.length}`);

  /* 一张单收到的不可以超过它自己。多出来的那一部分不是错，是订金。 */
  const { error: overDoc } = await c.rpc("set_payment_allocations", {
    in_entry_id: bigPay.id,
    in_rows: [{ record_id: docB.id, amount_cents: 900_000 }],
  });
  check("一张单收超过它自己，挡下来，而且讲得出出路",
    !!overDoc && /more than the document is worth/.test(overDoc.message), overDoc?.message);

  /* 同一张单打两行，是他手滑，不是两笔钱。默默加倍是最贵的那一种。 */
  const { error: listedTwice } = await c.rpc("set_payment_allocations", {
    in_entry_id: bigPay.id,
    in_rows: [
      { record_id: docA.id, amount_cents: 100_000 },
      { record_id: docA.id, amount_cents: 100_000 },
    ],
  });
  check("同一张单列两次，挡下来", !!listedTwice && /listed twice/.test(listedTwice.message), listedTwice?.message);

  /* 🔴 别的单上的一期，不可以拿来分摊这一张。
     一个指错地方的连结，画面上看起来完全正常。 */
  const { data: bTerms } = await c.rpc("set_record_terms", {
    in_record_id: docB.id,
    in_terms: [{ description: "订金", portion: 50 }, { description: "完工", portion: 50 }],
  });
  const { error: wrongTerm } = await c.rpc("set_payment_allocations", {
    in_entry_id: bigPay.id,
    in_rows: [{ record_id: docA.id, term_id: bTerms[0].id, amount_cents: 100_000 }],
  });
  check("别的单上的一期，分摊不进来",
    !!wrongTerm && /not on that document/.test(wrongTerm.message), wrongTerm?.message);

  const { data: onTerm, error: onTermErr } = await c.rpc("set_payment_allocations", {
    in_entry_id: bigPay.id,
    in_rows: [{ record_id: docB.id, term_id: bTerms[0].id, amount_cents: 400_000 }],
  });
  check("分摊得到某一期", !onTermErr && onTerm?.[0]?.term_id === bTerms[0].id,
    onTermErr?.message);

  /* 🔴 20260903020000 的档头在这一件发生之前就写下了它：
     收过钱的那一期，不可以被整批换掉 —— 否则那笔钱会静静地忘记它付的是哪一期。 */
  const { error: lockedTerms } = await c.rpc("set_record_terms", {
    in_record_id: docB.id,
    in_terms: [{ description: "改成一次付清", portion: 100 }],
  });
  check("收过钱的分期表锁住，而且讲得出出路",
    !!lockedTerms && /money has already been taken/.test(lockedTerms.message),
    lockedTerms?.message);
  const { data: termsIntact } = await c
    .from("record_terms").select("id").eq("record_id", docB.id);
  check("锁住之后那两期还在", termsIntact?.length === 2, `剩下 ${termsIntact?.length}`);

  /* 冲正那一笔不用再分摊 —— 它是撤销，不是收入。 */
  const { data: reversal, error: revErr } = await c.rpc("reverse_ledger_entry", {
    in_entry_id: bigPay.id,
  });
  check("冲正开得出来", !revErr && !!reversal?.id, revErr?.message);
  /* 🔴 从 20260831020000 起它一直在抄原本那一笔的 allocated_cents。
     今天那个值不再永远是 0，所以这一条现在才验得到。 */
  check("冲正那一笔已分摊是 0，不是原本那一笔的拷贝",
    reversal?.allocated_cents === 0, `${reversal?.allocated_cents}`);
  check("冲正那一笔不指着任何一张单", reversal?.against_id === null, `${reversal?.against_id}`);
  const { error: allocRev } = await c.rpc("set_payment_allocations", {
    in_entry_id: reversal.id,
    in_rows: [{ record_id: docA.id, amount_cents: 100_000 }],
  });
  check("冲正那一笔分摊不进去", !!allocRev && /reversal/.test(allocRev.message), allocRev?.message);

  /* 单没了，这一笔钱就回去当订金 —— 而钱本身一分都不会少。 */
  const { data: goneDoc } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "等下要删的",
    in_amount_cents: 500_000,
  });
  const { data: payC } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_amount_cents: 500_000, in_party: "",
  });
  await c.rpc("set_payment_allocations", {
    in_entry_id: payC.id, in_rows: [{ record_id: goneDoc.id, amount_cents: 500_000 }],
  });
  await c.from("pipeline_records").delete().eq("id", goneDoc.id);
  const { data: afterDelete } = await c
    .from("ledger_entries").select("amount_cents, allocated_cents").eq("id", payC.id).single();
  check("单删掉了，钱还在，而且回去当订金",
    afterDelete?.amount_cents === 500_000 && afterDelete?.allocated_cents === 0,
    `${afterDelete?.amount_cents} / ${afterDelete?.allocated_cents}`);

  /* 别人的钱碰不得。 */
  const { error: allocNotMine } = await c.rpc("set_payment_allocations", {
    in_entry_id: "00000000-0000-0000-0000-000000000000",
    in_rows: [{ record_id: docA.id, amount_cents: 100 }],
  });
  check("别人的钱分摊不了", !!allocNotMine);

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
