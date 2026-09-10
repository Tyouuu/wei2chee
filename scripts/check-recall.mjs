/**
 * 哪几个客人碰过 X 批号 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的两条：
 *   · **两边都要查得到** —— 医美的疗程记录，跟沙龙一次来访的一行，
 *     一批出问题不该只答一半
 *   · 只回答「谁碰过」，不发起召回、不发讯息
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
  const email = `rc-${tag}-${stamp}@formae.test`;
  const password = `Rc-${stamp}-x!`;
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
  for (const k of ["bookings", "customers", "staff", "inventory"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: today } = await admin.rpc("today_myt");
  const at = (h) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCHours(h - 8);
    return d.toISOString();
  };

  const nurse = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Sister Lim",
  });
  const patientA = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ms Chong",
  });
  const patientB = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const vial = await say(C, "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Filler A24B", in_unit: "支",
  });
  const badLot = await say(C, "add_stock_batch", {
    in_item_id: vial.id, in_code: "A24B771",
  });
  await say(C, "move_stock", {
    in_item_id: vial.id, in_direction: "in", in_qty: 5,
    in_reason: "supplier", in_batch_id: badLot.id,
  });

  console.log("\n① 一开始，一个人都没碰过");
  const empty = await say(C, "who_got_batch", { in_batch_id: badLot.id });
  check("干净的批号，名单是空的", empty.length === 0, JSON.stringify(empty));

  console.log("\n② medi spa 那一边：一笔疗程记录");
  const apptA = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(10), in_ends_at: at(11),
    in_party: "Ms Chong", in_party_id: patientA.id, in_service: "Filler",
  });
  const noteA = await say(C, "add_treatment_note", {
    in_party_id: patientA.id, in_what: "Filler", in_appointment_id: apptA,
    in_staff_id: nurse.id,
  });
  await say(C, "add_treatment_product", {
    in_note_id: noteA.id, in_item_id: vial.id, in_qty: 1, in_batch_id: badLot.id,
  });

  console.log("\n③ 沙龙那一边：一次来访底下的一行");
  const apptB = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(14), in_ends_at: at(15),
    in_party: "Mrs Tan", in_party_id: patientB.id, in_service: "Touch-up",
  });
  const lineB = await say(C, "add_visit_line", {
    in_appointment_id: apptB, in_service: "Touch-up", in_staff_id: nurse.id,
  });
  await say(C, "add_visit_product", {
    in_line_id: lineB.id, in_item_id: vial.id, in_qty: 1, in_batch_id: badLot.id,
  });

  console.log("\n④ 🔴 两边都查得到");
  const list = await say(C, "who_got_batch", { in_batch_id: badLot.id });
  check("两个人都在名单上", list.length === 2,
    JSON.stringify(list.map((r) => r.party)));
  const gotA = list.find((r) => r.party_id === patientA.id);
  const gotB = list.find((r) => r.party_id === patientB.id);
  check("🔴 医美那一位讲得出是哪一次疗程", gotA?.what === "Filler",
    JSON.stringify(gotA));
  check("🔴 沙龙那一位讲得出是来访的哪一行", gotB?.what === "Touch-up",
    JSON.stringify(gotB));

  console.log("\n⑤ 而没碰过这一批的，另一批不会牵连进来");
  const cleanLot = await say(C, "add_stock_batch", {
    in_item_id: vial.id, in_code: "CLEAN99",
  });
  const cleanList = await say(C, "who_got_batch", { in_batch_id: cleanLot.id });
  check("🔴 另一批干净的，名单是空的", cleanList.length === 0, JSON.stringify(cleanList));

  console.log("\n⑥ 拒绝的每一种");
  check("不存在的批号讲一句人话",
    (await refused(C, "who_got_batch", { in_batch_id: nurse.id }))
      .includes("no such batch"), "居然让它过了");

  console.log("\n⑦ 护理师查得到（她要马上通知病人）");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check("🔴 她读得到那份名单",
    (await say(crew.client, "who_got_batch", { in_batch_id: badLot.id })).length === 2,
    "她读不到");

  console.log("\n⑧ 别人家");
  const other = await person("other");
  check("🔴 别人家问不到我这一批",
    !!(await refused(other.client, "who_got_batch", { in_batch_id: badLot.id })),
    "他问到了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
