/**
 * 我欠供应商多少 —— 拿真的登入身分打一次每一支。
 *
 * 重点 26：`db push` 成功证明不了任何事。
 *
 * 这一支同时守两件事，而第一件是 2026-09-06 拿真身分**打出来**的，
 * 不是读代码推的：
 *
 *   ① 他在开销那一页填「这笔钱是付这张进货单的」，那张单要看得到「付了」。
 *      在 20260906010000 之前它写着「一分都没付」—— 而那张单会一直挂在
 *      「对不上」那一份里，**他会再付一次**。
 *   ② 那几张单加起来 = 他欠这一家多少（`party_payables`）。
 *
 * 🔴 而两个反过来的方向要静静地不碰：
 *   · 出去的钱挂在一张**卖**的单上 = 退钱给客人，不是「这一单收到了」
 *   · 进来的钱挂在一张**进货单**上 = 供应商退钱给我们，不是「这张单付了」
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

const stamp = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `pay-${tag}-${stamp}@formae.test`;
  const password = `Pay-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  people.push(data.user.id);
  return { id: data.user.id, email, password, client };
}

/** 那张单自己怎么说。 */
const match = async (C, id) => ((await C.rpc("purchase_match", { in_record_id: id })).data ?? [])[0];
/** 那一家在「我欠谁」上的那一行。 */
const owe = async (C, P, who) => {
  const { data, error } = await C.rpc("party_payables", { in_project_id: P });
  if (error) throw new Error(`party_payables: ${error.message}`);
  return (data ?? []).find((r) => r.party_id === who) ?? null;
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["purchases", "expenses", "suppliers", "customers", "orders", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  /* ── ① 道具：一家供应商，两张进货单 ──────────────────────────────── */
  console.log("\n① 道具");
  const { data: sup } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", in_name: "Seng Huat Hardware",
  });
  /* 一张四十天前开的，一张今天开的 —— 「欠了多久」要读到老的那一张。
     🔴 那个日子要从**资料库自己的今天**往回数，不是从这台机的 UTC。
     产品用的是马来西亚时间（`today_myt()`），而 `new Date()` 是 UTC ——
     两边差八个钟头，所以马来西亚的凌晨到早上八点之间跑，
     每一个天数都会差一天。第一版就是这样红的（40 报成 41），
     **而那条红看起来完全像产品坏了**。同一个坑 [任务 168] 踩过一次。 */
  const { data: mytToday } = await admin.rpc("today_myt");
  const old = new Date(`${mytToday}T00:00:00Z`);
  old.setUTCDate(old.getUTCDate() - 40);
  const fortyDaysAgo = old.toISOString().slice(0, 10);
  const { data: po1 } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Cement load",
    in_party: "Seng Huat Hardware", in_party_id: sup.id,
    in_amount_cents: 185_000, in_issued_on: fortyDaysAgo,
  });
  const { data: po2 } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "River sand",
    in_party: "Seng Huat Hardware", in_party_id: sup.id, in_amount_cents: 60_000,
  });
  check("两张进货单开得出来", !!po1?.id && !!po2?.id, `${po1?.id} ${po2?.id}`);

  let row = await owe(C, P, sup.id);
  check("一共叫了 RM 2,450", Number(row?.ordered_cents) === 245_000, `${row?.ordered_cents}`);
  check("一分都还没付", Number(row?.paid_cents) === 0, `${row?.paid_cents}`);
  check("欠他 RM 2,450", Number(row?.owed_cents) === 245_000, `${row?.owed_cents}`);
  check("两张单还没付清", Number(row?.open_docs) === 2, `${row?.open_docs}`);
  check("最老那一张欠了 40 天", Number(row?.oldest_days) === 40, `${row?.oldest_days}`);

  /* ── ② 🔴 他填「算在这张单上」，那张单要看得到 ────────────────────── */
  console.log("\n② 🔴 一笔挂在进货单上的开销");
  const { data: pay1, error: p1e } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_amount_cents: 100_000,
    in_party: "Seng Huat Hardware", in_party_id: sup.id, in_against_id: po1.id,
  });
  check("记得进去", !p1e, p1e?.message);
  const { data: al1 } = await admin
    .from("ledger_allocations").select("amount_cents").eq("entry_id", pay1.id);
  check("🔴 真的写了一笔分摊（不是只把总数设满）",
    (al1 ?? []).length === 1 && Number(al1[0].amount_cents) === 100_000,
    JSON.stringify(al1));
  let m = await match(C, po1.id);
  check("🔴 那张单说付了 RM 1,000", Number(m?.paid_cents) === 100_000, `${m?.paid_cents}`);
  check("🔴 还欠 RM 850", Number(m?.unpaid_cents) === 85_000, `${m?.unpaid_cents}`);

  row = await owe(C, P, sup.id);
  check("我欠他：RM 2,450 变 RM 1,450", Number(row?.owed_cents) === 145_000, `${row?.owed_cents}`);
  check("而且看得到已经付了 RM 1,000", Number(row?.paid_cents) === 100_000, `${row?.paid_cents}`);
  check("两张单都还没付清", Number(row?.open_docs) === 2, `${row?.open_docs}`);

  /* ── ③ 付超过那张单的，多的不硬塞 ─────────────────────────────────── */
  console.log("\n③ 付多了");
  const { data: pay2 } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_amount_cents: 200_000,
    in_party: "Seng Huat Hardware", in_party_id: sup.id, in_against_id: po1.id,
  });
  const { data: al2 } = await admin
    .from("ledger_allocations").select("amount_cents").eq("entry_id", pay2.id);
  check("🔴 只分摊那张单还欠的 RM 850，多的留着",
    (al2 ?? []).length === 1 && Number(al2[0].amount_cents) === 85_000,
    JSON.stringify(al2));
  m = await match(C, po1.id);
  check("那张单付清了", Number(m?.unpaid_cents) === 0, `${m?.unpaid_cents}`);
  row = await owe(C, P, sup.id);
  check("只剩第二张单的 RM 600", Number(row?.owed_cents) === 60_000, `${row?.owed_cents}`);
  check("🔴 「几张没付清」变成 1", Number(row?.open_docs) === 1, `${row?.open_docs}`);
  check("🔴 「欠了多久」跟着变成今天开的那一张",
    Number(row?.oldest_days) === 0, `${row?.oldest_days}`);

  /* ── ④ 冲正之后，欠款回来 ─────────────────────────────────────────── */
  console.log("\n④ 冲正");
  const { error: revErr } = await C.rpc("reverse_ledger_entry", { in_entry_id: pay1.id });
  check("冲正开得出来", !revErr, revErr?.message);
  row = await owe(C, P, sup.id);
  check("🔴 冲掉的那 RM 1,000 又欠回来", Number(row?.owed_cents) === 160_000,
    `${row?.owed_cents}`);
  check("已经付的跟着掉回 RM 850", Number(row?.paid_cents) === 85_000, `${row?.paid_cents}`);

  /* ── ⑤ 🔴 方向对不上的两种，不准分摊 ──────────────────────────────── */
  console.log("\n⑤ 🔴 方向对不上的两种");
  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });
  const { data: sale } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Kitchen top",
    in_party: "Mrs Lim", in_party_id: cust.id, in_amount_cents: 300_000,
  });
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 100_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_against_id: sale.id,
  });
  const debtOf = async () => Number(
    ((await C.rpc("party_debts", { in_project_id: P })).data ?? [])
      .find((r) => r.party_id === cust.id)?.owed_cents ?? 0,
  );
  const oweBefore = await debtOf();
  check("道具：客人付了 RM 1,000，还欠 RM 2,000", oweBefore === 200_000, `${oweBefore}`);

  /* 退 RM 500 给这个客人，挂在同一张单上。 */
  const { data: refund, error: rfErr } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 50_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_against_id: sale.id,
  });
  check("退钱那一笔记得进去", !rfErr, rfErr?.message);
  const { data: alR } = await admin
    .from("ledger_allocations").select("amount_cents").eq("entry_id", refund.id);
  check("🔴 退给客人的钱一笔分摊都没写", (alR ?? []).length === 0, JSON.stringify(alR));
  check("🔴 所以那个客人的欠款没有因此变少", (await debtOf()) === 200_000, `${await debtOf()}`);
  check("而 against_id 照旧存着（那讲的是这笔钱为了什么）",
    refund.against_id === sale.id, `${refund.against_id}`);

  /* 供应商退钱给我们：进来的钱挂在进货单上。 */
  const { data: backIn } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 20_000, in_party: "Seng Huat Hardware", in_party_id: sup.id,
    in_against_id: po2.id,
  });
  const { data: alB } = await admin
    .from("ledger_allocations").select("amount_cents").eq("entry_id", backIn.id);
  check("🔴 供应商退回来的钱，不算「这张进货单付了」",
    (alB ?? []).length === 0, JSON.stringify(alB));
  m = await match(C, po2.id);
  check("那张进货单还是写着一分没付", Number(m?.paid_cents) === 0, `${m?.paid_cents}`);

  /* ── ⑥ 收起来的单不算 ─────────────────────────────────────────────── */
  console.log("\n⑥ 收起来的单");
  await C.rpc("set_pipeline_archived", { in_id: po2.id, in_archived: true });
  row = await owe(C, P, sup.id);
  check("收起来那一张不再算进去", Number(row?.owed_cents) === 100_000, `${row?.owed_cents}`);
  await C.rpc("set_pipeline_archived", { in_id: po2.id, in_archived: false });

  /* ── ⑦ 付清了就不在名单上 ─────────────────────────────────────────── */
  console.log("\n⑦ 全部付清");
  const left = Number((await owe(C, P, sup.id))?.owed_cents ?? 0) - 60_000;
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_amount_cents: left,
    in_party: "Seng Huat Hardware", in_party_id: sup.id, in_against_id: po1.id,
  });
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_amount_cents: 60_000,
    in_party: "Seng Huat Hardware", in_party_id: sup.id, in_against_id: po2.id,
  });
  const cleared = await owe(C, P, sup.id);
  check("🔴 付清了就整个不在「我欠谁」上", cleared === null, JSON.stringify(cleared));

  /* ── ⑧ 🔴 师傅 ───────────────────────────────────────────────────── */
  console.log("\n⑧ 🔴 师傅看不到老板欠谁多少");
  const { data: po3 } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Steel bar",
    in_party: "Seng Huat Hardware", in_party_id: sup.id, in_amount_cents: 90_000,
  });
  /* 控制组 —— 没有这一条，下面那一条量的是空气（任务 125 的教训）。 */
  check("控制组：老板自己看得到", (await owe(C, P, sup.id)) !== null, "老板也看不到");

  const crew = await person("crew");
  await C.rpc("add_project_member", { in_email: crew.email });
  const { data: wSee, error: wErr } = await crew.client
    .rpc("party_payables", { in_project_id: P });
  check("🔴 师傅问不出老板欠谁多少", !wErr && (wSee ?? []).length === 0,
    wErr?.message ?? `${wSee?.length} 行`);
  /* 而那张单他照旧读得到 —— 一张进货单是他一天的工作。
     两条一起才讲得出界线画在哪。 */
  const { data: wRec } = await crew.client
    .from("pipeline_records").select("id").eq("id", po3.id).maybeSingle();
  check("而那张单他照旧读得到", !!wRec, "他连那张单都读不到");

  /* ── ⑨ 别人家 ─────────────────────────────────────────────────────── */
  console.log("\n⑨ 别人家");
  const other = await person("other");
  const { data: oSee } = await other.client.rpc("party_payables", { in_project_id: P });
  check("🔴 别人家一行都读不到", (oSee ?? []).length === 0, `${oSee?.length}`);
} finally {
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`  ⚠️ 删不掉 ${id}：${error.message}`);
  }
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
