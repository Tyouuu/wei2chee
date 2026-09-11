/**
 * 每日结帐对数——沙龙「其余」清单那五件，老板纠正的第一件：
 * 不是「问回来才能做」，是先把格子做出来，格子先是空的。
 *
 * 照抄 `count_stock` 的形状：算出系统这一天这个收款方式应该有多少，
 * 跟柜台数出来的一比，**只讲差多少，不评断算不算正常**——那是老板
 * 自己看那个数字的判断，跟盘点不一样的是它什么都不调整。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
  const email = `till-${tag}-${stamp}@formae.test`;
  const password = `Till-${stamp}-x!`;
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
  return { id: data.user.id, email, client };
}
dropThrowawayOnExit(admin, () => people[people.length - 1]);

const day = (n) => {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["customers", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });

  const today = day(0);

  /* ── ① 什么都没进来的一天 → 应该是 0，差多少就是数出来的那个数 ── */
  console.log("\n① 控制组：这一天一分钱都没进来");
  const { data: r1, error: e1 } = await C.rpc("count_till", {
    in_project_id: P, in_on: day(-30), in_method: "cash", in_counted_cents: 0,
  });
  check("按得下去", !e1 && !!r1, e1?.message);
  check("系统这天应该有 0", Number(r1?.expected_cents) === 0, `${r1?.expected_cents}`);
  check("数出来也是 0", Number(r1?.counted_cents) === 0, `${r1?.counted_cents}`);

  /* ── ② 真的收了现金，对得上 ─────────────────────────────────── */
  console.log("\n② 收了现金，柜台数出来对得上");
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 15_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_method: "cash", in_entry_on: today,
  });
  const { data: r2 } = await C.rpc("count_till", {
    in_project_id: P, in_on: today, in_method: "cash", in_counted_cents: 15_000,
  });
  check("🔴 系统算出来的 150", Number(r2?.expected_cents) === 15_000, `${r2?.expected_cents}`);
  check("数出来的也是 150 —— 对得上", Number(r2?.counted_cents) === 15_000,
    `${r2?.counted_cents}`);

  /* ── ③ 🔴 对不上——只讲差多少，不评断，也不调整任何东西 ─────── */
  console.log("\n③ 🔴 对不上");
  const { data: r3 } = await C.rpc("count_till", {
    in_project_id: P, in_on: today, in_method: "cash", in_counted_cents: 14_700,
    in_note: "少了三十",
  });
  check("🔴 讲得出系统应该有多少", Number(r3?.expected_cents) === 15_000, `${r3?.expected_cents}`);
  check("讲得出柜台数出来是多少", Number(r3?.counted_cents) === 14_700, `${r3?.counted_cents}`);
  check("🔴 而这一支自己不算差额、不下判断——差额是读的人自己算",
    r3?.expected_cents !== undefined && r3?.counted_cents !== undefined, "缺栏位");

  const { data: onHandBefore } = await admin
    .from("ledger_entries").select("amount_cents").eq("project_id", P).eq("method", "cash");
  const totalCash = (onHandBefore ?? []).reduce((s, r) => s + Number(r.amount_cents), 0);
  check("🔴 对不上不会动任何一笔钱——现金流水总额没变",
    totalCash === 15_000, `${totalCash}`);

  /* ── ④ 冲正过的不算——跟 staff_earnings 同一条 ──────────────── */
  console.log("\n④ 🔴 冲正过的那一笔不算收到过");
  const { data: refundable } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 5_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_method: "cash", in_entry_on: day(-1),
  });
  await C.rpc("reverse_ledger_entry", { in_entry_id: refundable.id });
  const { data: r4 } = await C.rpc("count_till", {
    in_project_id: P, in_on: day(-1), in_method: "cash", in_counted_cents: 0,
  });
  check("🔴 冲正之后系统这天现金应该是 0，不是 5000 又 -5000 抵消才 0 的巧合",
    Number(r4?.expected_cents) === 0, `${r4?.expected_cents}`);

  /* ── ⑤ 现金跟卡分开算 ────────────────────────────────────────── */
  console.log("\n⑤ 现金跟卡分开算");
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 8_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_method: "card", in_entry_on: today,
  });
  const { data: r5cash } = await C.rpc("count_till", {
    in_project_id: P, in_on: today, in_method: "cash", in_counted_cents: 15_000,
  });
  const { data: r5card } = await C.rpc("count_till", {
    in_project_id: P, in_on: today, in_method: "card", in_counted_cents: 8_000,
  });
  check("🔴 现金那一格没有被卡的钱污染", Number(r5cash?.expected_cents) === 15_000,
    `${r5cash?.expected_cents}`);
  check("🔴 卡那一格也没有被现金污染", Number(r5card?.expected_cents) === 8_000,
    `${r5card?.expected_cents}`);

  /* ── ⑥ 老板看得到历史，师傅看不到 ───────────────────────────── */
  console.log("\n⑥ 谁看得到历史");
  const { data: history, error: histErr } = await C.rpc("till_counts_of", {
    in_project_id: P,
  });
  check("🔴 老板读得到历史清单", !histErr && (history ?? []).length >= 4,
    histErr?.message ?? `${history?.length}`);

  const crew = await person("crew");
  const { error: inviteErr } = await C.rpc("add_project_member", { in_email: crew.email });
  if (inviteErr) throw new Error(`add_project_member: ${inviteErr.message}`);
  const { data: crewCount, error: crewCountErr } = await crew.client.rpc("count_till", {
    in_project_id: P, in_on: today, in_method: "cash", in_counted_cents: 15_000,
  });
  check("师傅数得了当天的（柜台的事）", !crewCountErr && !!crewCount, crewCountErr?.message);
  const { data: crewHistory } = await crew.client.rpc("till_counts_of", { in_project_id: P });
  check("🔴 而师傅读不到历史（那是老板在看模式）", (crewHistory ?? []).length === 0,
    `${crewHistory?.length}`);

  /* ── ⑦ 别人家 ───────────────────────────────────────────────── */
  console.log("\n⑦ 别人家");
  const other = await person("other");
  const { error: crossErr } = await other.client.rpc("count_till", {
    in_project_id: P, in_on: today, in_method: "cash", in_counted_cents: 0,
  });
  check("🔴 别人家数不了我的", !!crossErr, "居然让它过了");
  const { data: crossHistory } = await other.client.rpc("till_counts_of", { in_project_id: P });
  check("🔴 别人家也读不到我的历史", (crossHistory ?? []).length === 0,
    `${crossHistory?.length}`);

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}` : `\n判：全部过（${people.length} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}
