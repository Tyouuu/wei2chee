/**
 * 集点——真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 没填规矩之前，earned 永远是假的——不猜一个门槛
 *   · 换过一次奖之后，集点从那一刻重新算，不是继续往上涨
 *   · 定规矩是老板的事，师傅设不了
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
const anchor = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `lo-${tag}-${stamp}@formae.test`;
  const password = `Lo-${stamp}-x!`;
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
const refused = async (client, fn, args) => {
  const { error } = await client.rpc(fn, args);
  return error?.message ?? "";
};
async function visitOn(client, project, party, when) {
  const doneId = await say(client, "add_appointment", {
    in_project_id: project, in_module_key: "bookings",
    in_starts_at: new Date(when - 36e5).toISOString(),
    in_ends_at: new Date(when).toISOString(),
    in_party: "Mrs Tan", in_party_id: party, in_service: "Cut",
  });
  await say(client, "set_appointment_status", { in_id: doneId, in_status: "done" });
}

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("add_project_page", { requested_key: "bookings", new_title: "bookings" });
  await C.rpc("add_project_page", { requested_key: "customers", new_title: "customers" });

  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });

  console.log("\n① 没填规矩之前——一句话都不讲");
  await visitOn(C, P, her.id, anchor - 3 * 864e5);
  const before = await say(C, "loyalty_status_of", { in_project_id: P, in_party_id: her.id });
  check("讲得出来过几次", before[0]?.stamps === 1, JSON.stringify(before[0]));
  check("🔴 earned 是假的——规矩还没填", before[0]?.earned === false, JSON.stringify(before[0]));
  check("stamps_needed 是空的", before[0]?.stamps_needed === null, String(before[0]?.stamps_needed));

  console.log("\n② 🔴 师傅设不了规矩，老板设得了");
  const staff = await person("staff");
  await say(C, "add_project_member", { in_email: staff.email });
  check("师傅被挡下来", (await refused(staff.client, "set_loyalty_rule", {
    in_project_id: P, in_stamps_needed: 3,
  })).includes("for the owner"), "居然让它过了");
  const rule = await say(C, "set_loyalty_rule", { in_project_id: P, in_stamps_needed: 3 });
  check("老板设成了", rule?.stamps_needed === 3, String(rule?.stamps_needed));

  console.log("\n③ 🔴 集满 3 次——earned 变真的");
  await visitOn(C, P, her.id, anchor - 2 * 864e5);
  await visitOn(C, P, her.id, anchor - 864e5);
  const met = await say(C, "loyalty_status_of", { in_project_id: P, in_party_id: her.id });
  check("3 个章", met[0]?.stamps === 3, String(met[0]?.stamps));
  check("🔴 earned 是真的", met[0]?.earned === true, JSON.stringify(met[0]));

  console.log("\n④ 🔴 柜台帮她换了奖——重新从 0 算");
  await say(C, "mark_loyalty_redeemed", { in_party_id: her.id });
  const { data: redeemedRow } = await admin
    .from("directory_entries").select("loyalty_redeemed_at").eq("id", her.id).single();
  const redeemedAt = new Date(redeemedRow.loyalty_redeemed_at).getTime();
  const reset = await say(C, "loyalty_status_of", { in_project_id: P, in_party_id: her.id });
  check("章数归零", reset[0]?.stamps === 0, String(reset[0]?.stamps));
  check("earned 变回假的", reset[0]?.earned === false, JSON.stringify(reset[0]));

  console.log("\n⑤ 换奖之前那几次不会重新被算");
  const stillZero = await say(C, "loyalty_status_of", { in_project_id: P, in_party_id: her.id });
  check("还是 0，不是 3", stillZero[0]?.stamps === 0, String(stillZero[0]?.stamps));

  console.log("\n⑥ 换奖之后再来一次——从 1 开始数");
  const afterRedemptionId = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(redeemedAt + 200).toISOString(),
    in_ends_at: new Date(redeemedAt + 300).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Cut",
  });
  await say(C, "set_appointment_status", { in_id: afterRedemptionId, in_status: "done" });
  const oneAfter = await say(C, "loyalty_status_of", { in_project_id: P, in_party_id: her.id });
  check("1 个章", oneAfter[0]?.stamps === 1, String(oneAfter[0]?.stamps));

  console.log("\n⑦ 拒绝的每一种");
  check("别人家的客人换不了", (await refused(C, "mark_loyalty_redeemed", {
    in_party_id: "00000000-0000-0000-0000-000000000000",
  })).includes("no such customer"), "居然让它过了");

  console.log("\n⑧ 别人家");
  const other = await person("other");
  check("🔴 别人家读不到我这份名单",
    (await say(other.client, "loyalty_status_of", { in_project_id: P })).length === 0,
    "他读到了");
  check("🔴 别人家换不了我客人的奖", !!(await refused(other.client, "mark_loyalty_redeemed", {
    in_party_id: her.id,
  })), "他换了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
