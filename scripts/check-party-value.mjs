/**
 * 谁是我最值钱的客人 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 冲正过的钱不算——跟 party_debts 同一条纪律
 *   · 排在最前面的是付得最多钱的那一个，不是打进去的顺序
 *   · 这一支回的是钱——美发师看不到，那是老板留客用的名单
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
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
  const email = `pv-${tag}-${stamp}@formae.test`;
  const password = `Pv-${stamp}-x!`;
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
const say = async (client, fn, args) => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "hearth" });
  for (const k of ["customers", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const tan = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const lee = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lee",
  });
  const wong = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Wong",
  });

  console.log("\n① 一笔钱都还没收过的时候");
  const before = await say(C, "party_value", { in_project_id: P });
  check("空的（没有人排得上）", before.length === 0, JSON.stringify(before));

  console.log("\n② 🔴 Mrs Tan 付了两次，Mrs Lee 付了一次，Wong 一次都没付");
  await say(C, "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 20000, in_party: "Mrs Tan", in_party_id: tan.id,
  });
  await say(C, "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 15000, in_party: "Mrs Tan", in_party_id: tan.id,
  });
  await say(C, "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 50000, in_party: "Mrs Lee", in_party_id: lee.id,
  });

  const ranked = await say(C, "party_value", { in_project_id: P });
  const tanRow = ranked.find((r) => r.party_id === tan.id);
  const leeRow = ranked.find((r) => r.party_id === lee.id);
  check("Mrs Tan 付了两次，共 RM 350",
    Number(tanRow?.times_paid) === 2 && Number(tanRow?.total_cents) === 35000,
    JSON.stringify(tanRow));
  check("Mrs Lee 付了一次，RM 500",
    Number(leeRow?.times_paid) === 1 && Number(leeRow?.total_cents) === 50000,
    JSON.stringify(leeRow));
  check("🔴 Mrs Lee（RM 500）排在 Mrs Tan（RM 350）前面——钱多的在前",
    ranked.findIndex((r) => r.party_id === lee.id)
      < ranked.findIndex((r) => r.party_id === tan.id),
    JSON.stringify(ranked.map((r) => [r.name, r.total_cents])));
  check("🔴 Mr Wong 一次都没付过 → 不在榜上",
    !ranked.some((r) => r.party_id === wong.id),
    JSON.stringify(ranked.map((r) => r.name)));

  console.log("\n③ 🔴 冲正过的那一笔不算——跟 party_debts 同一条纪律");
  const { data: refundable } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 88800, in_party: "Mr Wong", in_party_id: wong.id,
  });
  await say(C, "reverse_ledger_entry", { in_entry_id: refundable.id });
  const afterReverse = await say(C, "party_value", { in_project_id: P });
  check("🔴 冲正之后，Wong 那一笔不算进身价里（还是不在榜上）",
    !afterReverse.some((r) => r.party_id === wong.id),
    JSON.stringify(afterReverse.map((r) => r.name)));
  check("而 Mrs Tan、Mrs Lee 的数字没有被这一笔冲正动到",
    afterReverse.find((r) => r.party_id === tan.id)?.total_cents === tanRow.total_cents
      && afterReverse.find((r) => r.party_id === lee.id)?.total_cents === leeRow.total_cents,
    JSON.stringify(afterReverse));

  console.log("\n④ 🔴 美发师看不到——那是老板留客用的名单");
  const crew = await person("crew");
  await C.rpc("add_project_page", { requested_key: "staff", new_title: "staff" });
  await say(C, "add_project_member", { in_email: crew.email });
  check("🔴 她读到的是空的（那一支回的是钱）",
    (await say(crew.client, "party_value", { in_project_id: P })).length === 0,
    "她读到了");

  console.log("\n⑤ 别人家");
  const other = await person("other");
  check("🔴 别人家读不到我的客人排行",
    (await say(other.client, "party_value", { in_project_id: P })).length === 0,
    "他读到了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
