/**
 * 预约也进审计日志了——真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 改状态、改期、换人这三栏才记——别的栏位改了不算
 *   · 只有看得到钱的人（老板）读得到这份历史，跟原本三张表同一条守卫
 *   · 加第四张表没有惊动原本三张表——回归要green
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
  const email = `aha-${tag}-${stamp}@formae.test`;
  const password = `Aha-${stamp}-x!`;
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
  const jas = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Jasmine",
  });
  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const apptId = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor + 864e5).toISOString(),
    in_ends_at: new Date(anchor + 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour", in_staff_id: amy.id,
  });

  console.log("\n① 改状态——记得下来");
  await say(C, "set_appointment_status", { in_id: apptId, in_status: "cancelled" });
  const { data: rows1 } = await admin
    .from("record_changes")
    .select("entity, field, was, now_is, label")
    .eq("entity_id", apptId).eq("field", "status");
  check("entity 是 appointment", rows1[0]?.entity === "appointment", JSON.stringify(rows1));
  check("was booked, now_is cancelled",
    rows1[0]?.was === "booked" && rows1[0]?.now_is === "cancelled", JSON.stringify(rows1));
  check("🔴 label 讲得出是谁的哪一次", rows1[0]?.label?.includes("Mrs Tan"), rows1[0]?.label);

  console.log("\n② 🔴 换人——记得下来，别的栏位不受影响");
  await say(C, "update_appointment", {
    in_id: apptId,
    in_starts_at: new Date(anchor + 864e5).toISOString(),
    in_ends_at: new Date(anchor + 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour", in_staff_id: jas.id,
  });
  const { data: rows2 } = await admin
    .from("record_changes")
    .select("field, was, now_is")
    .eq("entity_id", apptId).eq("field", "staff_id");
  check("staff_id 从 Amy 变 Jasmine", rows2[0]?.was === amy.id && rows2[0]?.now_is === jas.id,
    JSON.stringify(rows2));

  console.log("\n③ 改期——starts_at 也记得下来");
  const newStart = new Date(anchor + 2 * 864e5).toISOString();
  await say(C, "update_appointment", {
    in_id: apptId, in_starts_at: newStart,
    in_ends_at: new Date(anchor + 2 * 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour", in_staff_id: jas.id,
  });
  const { data: rows3 } = await admin
    .from("record_changes")
    .select("field").eq("entity_id", apptId).eq("field", "starts_at");
  check("记到了 starts_at 那一条", rows3.length === 1, JSON.stringify(rows3));

  console.log("\n④ 没改的栏位不产生一条记录——同一次 update 没有再动 party");
  const { data: rows4 } = await admin
    .from("record_changes").select("field").eq("entity_id", apptId).eq("field", "party");
  check("party 从来没被记过一次改动", rows4.length === 0, JSON.stringify(rows4));

  console.log("\n⑤ 🔴 只有老板读得到——跟原本三张表同一条守卫");
  const amyStaff = await person("amy-login");
  await say(C, "add_project_member", { in_email: amyStaff.email });
  const { data: asStaff } = await amyStaff.client
    .from("record_changes").select("id").eq("entity_id", apptId);
  check("师傅读不到（policy 是 sees_money）", (asStaff ?? []).length === 0, JSON.stringify(asStaff));
  const { data: asBoss } = await C
    .from("record_changes").select("id").eq("entity_id", apptId);
  check("老板读得到", (asBoss ?? []).length > 0, JSON.stringify(asBoss));

  console.log("\n⑥ 别人家");
  const other = await person("other");
  const { data: asOther } = await other.client
    .from("record_changes").select("id").eq("entity_id", apptId);
  check("🔴 别人家读不到这一笔预约的历史", (asOther ?? []).length === 0, JSON.stringify(asOther));

  console.log("\n⑦ 🔴 那一位要真的是这家的人——add_appointment 现在验了");
  await other.client.rpc("add_project_page", { requested_key: "staff", new_title: "staff" });
  const { data: otherProj } = await admin
    .from("projects").select("id").eq("account_id", other.id).single();
  const foreignStaff = await say(other.client, "add_directory_entry", {
    in_project_id: otherProj.id, in_module_key: "staff", in_name: "Not Amy",
  });
  check("🔴 别人家的师傅编号——挡下来", (await refused(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor + 3 * 864e5).toISOString(),
    in_ends_at: new Date(anchor + 3 * 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour",
    in_staff_id: foreignStaff.id,
  })).includes("does not work here"), "居然让它过了");
  check("🔴 编出来的 uuid——一样挡下来", (await refused(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor + 4 * 864e5).toISOString(),
    in_ends_at: new Date(anchor + 4 * 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour",
    in_staff_id: "00000000-0000-0000-0000-000000000000",
  })).includes("does not work here"), "居然让它过了");
  const ok = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(anchor + 5 * 864e5).toISOString(),
    in_ends_at: new Date(anchor + 5 * 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour", in_staff_id: jas.id,
  });
  check("而这家自己的师傅照旧排得进去", !!ok, JSON.stringify(ok));
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
