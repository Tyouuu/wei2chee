/**
 * 小费——真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · null 跟 0 是两句话——没问过、跟问过没给，答案不一样
 *   · 一分钱都不进 ledger_entries——小费不是营业额
 *   · tips_of 只数真的有小费的（> 0），不把「没问过」也当没有
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
  const email = `tp-${tag}-${stamp}@formae.test`;
  const password = `Tp-${stamp}-x!`;
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

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("add_project_page", { requested_key: "bookings", new_title: "bookings" });
  await C.rpc("add_project_page", { requested_key: "customers", new_title: "customers" });
  await C.rpc("add_project_page", { requested_key: "staff", new_title: "staff" });

  const amy = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Amy",
  });
  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const visit = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor - 36e5).toISOString(),
    in_ends_at: new Date(anchor).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour",
  });
  const line = await say(C, "add_visit_line", {
    in_appointment_id: visit, in_service: "染", in_staff_id: amy.id,
    in_price_cents: 18000,
  });

  console.log("\n① 还没问过——tip_cents 是空的");
  const { data: fresh } = await admin
    .from("appointment_lines").select("tip_cents").eq("id", line.id).single();
  check("空的，不是 0", fresh.tip_cents === null, String(fresh.tip_cents));

  console.log("\n② 🔴 她给了 20 块小费");
  const tipped = await say(C, "set_visit_tip", { in_line_id: line.id, in_tip_cents: 2000 });
  check("记下来了", tipped?.tip_cents === 2000, String(tipped?.tip_cents));

  console.log("\n③ 🔴 一分钱都没有进 ledger_entries");
  const { data: entries } = await admin
    .from("ledger_entries").select("id").eq("project_id", P);
  check("这门生意的帐上一笔都没有", (entries ?? []).length === 0, JSON.stringify(entries));

  console.log("\n④ 问过了，这次没给——跟没问过不一样");
  const line2 = await say(C, "add_visit_line", {
    in_appointment_id: visit, in_service: "剪", in_staff_id: amy.id,
    in_price_cents: 5000,
  });
  const zeroed = await say(C, "set_visit_tip", { in_line_id: line2.id, in_tip_cents: 0 });
  check("是 0，不是空的", zeroed?.tip_cents === 0, String(zeroed?.tip_cents));

  console.log("\n⑤ 拒绝的每一种");
  check("负数挡下来", !!(await refused(C, "set_visit_tip", {
    in_line_id: line.id, in_tip_cents: -100,
  })), "居然让它过了");
  check("别人家的行改不了", (await refused(C, "set_visit_tip", {
    in_line_id: "00000000-0000-0000-0000-000000000000", in_tip_cents: 500,
  })).includes("no such line"), "居然让它过了");

  console.log("\n⑥ 🔴 这个月阿珍拿了多少小费");
  const list = await say(C, "tips_of", { in_project_id: P, in_days: 30 });
  const amyRow = list.find((r) => r.staff_id === amy.id);
  check("总额是 20 块（第二行是 0，不算进去）", amyRow?.tip_cents === 2000,
    JSON.stringify(amyRow));
  check("🔴 只数真的有小费的那一次，不是两次", amyRow?.tipped_visits === 1,
    String(amyRow?.tipped_visits));

  console.log("\n⑦ 30 天之外的不算");
  const oldVisit = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor - 40 * 864e5).toISOString(),
    in_ends_at: new Date(anchor - 40 * 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Cut",
  });
  const oldLine = await say(C, "add_visit_line", {
    in_appointment_id: oldVisit, in_service: "剪", in_staff_id: amy.id,
    in_price_cents: 5000,
  });
  await say(C, "set_visit_tip", { in_line_id: oldLine.id, in_tip_cents: 9999 });
  const list2 = await say(C, "tips_of", { in_project_id: P, in_days: 30 });
  const amyRow2 = list2.find((r) => r.staff_id === amy.id);
  check("那 40 天前的 9999 没有被算进来", amyRow2?.tip_cents === 2000,
    JSON.stringify(amyRow2));

  console.log("\n⑧ 别人家");
  const other = await person("other");
  check("🔴 别人家改不了我这一行", !!(await refused(other.client, "set_visit_tip", {
    in_line_id: line.id, in_tip_cents: 500,
  })), "他改了");
  check("🔴 别人家读不到我这份清单",
    (await say(other.client, "tips_of", { in_project_id: P })).length === 0,
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
