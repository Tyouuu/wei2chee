/**
 * 学生自己撞堂 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 老师撞堂靠资料库的排他约束，学生撞堂要另外查——学生只透过
 *     class_members 连到一堂课，appointments 上没有他的编号
 *   · 只看还没发生、没有取消的那几堂——过去的撞法查了没有用
 *   · 一撞只报一次，不是两个方向各报一条
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
  const email = `cc-${tag}-${stamp}@formae.test`;
  const password = `Cc-${stamp}-x!`;
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
  for (const k of ["bookings", "customers", "staff"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const teacherA = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Cikgu Aminah",
  });
  const teacherB = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Cikgu Bala",
  });
  const student = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Beng",
  });

  const math = await say(C, "add_class_group", {
    in_project_id: P, in_module_key: "bookings",
    in_name: "Form 4 Math · Wed 4pm", in_staff_id: teacherA.id,
  });
  const english = await say(C, "add_class_group", {
    in_project_id: P, in_module_key: "bookings",
    in_name: "Form 4 English · Wed 4pm", in_staff_id: teacherB.id,
  });
  const science = await say(C, "add_class_group", {
    in_project_id: P, in_module_key: "bookings",
    in_name: "Form 4 Science · Thu 4pm", in_staff_id: teacherB.id,
  });

  await say(C, "enrol_in_class", { in_group_id: math.id, in_party_id: student.id });
  await say(C, "enrol_in_class", { in_group_id: english.id, in_party_id: student.id });
  await say(C, "enrol_in_class", { in_group_id: science.id, in_party_id: student.id });

  const nextWed = new Date();
  nextWed.setUTCDate(nextWed.getUTCDate() + ((3 + 7 - nextWed.getUTCDay()) % 7 || 7));
  const at = (hour, minute = 0) => {
    const d = new Date(nextWed);
    d.setUTCHours(hour - 8, minute, 0, 0);
    return d.toISOString();
  };

  console.log("\n① 数学班星期三四点，英文班同一个时段——真的撞了");
  const mathSession = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(16, 0), in_ends_at: at(17, 0),
    in_staff_id: teacherA.id, in_service: "Form 4 Math", in_group_id: math.id,
  });
  const engSession = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(16, 30), in_ends_at: at(17, 30),
    in_staff_id: teacherB.id, in_service: "Form 4 English", in_group_id: english.id,
  });

  const clashes = await say(C, "class_schedule_clashes", { in_project_id: P });
  check("🔴 查得到 Ah Beng 撞堂了", clashes.some((r) => r.party_id === student.id),
    JSON.stringify(clashes));
  check("讲得出是哪两个班", clashes.some((r) =>
    [r.class_a, r.class_b].includes(math.name) && [r.class_a, r.class_b].includes(english.name)),
    JSON.stringify(clashes.map((r) => [r.class_a, r.class_b])));
  check("🔴 一撞只报一次，不是两个方向各一条", clashes.length === 1, JSON.stringify(clashes));

  console.log("\n② 科学班星期四四点，跟前两个都不撞");
  await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(16 + 24, 0), in_ends_at: at(17 + 24, 0),
    in_staff_id: teacherB.id, in_service: "Form 4 Science", in_group_id: science.id,
  });
  const still = await say(C, "class_schedule_clashes", { in_project_id: P });
  check("🔴 科学班没有多报一条撞堂（时间根本不重叠）", still.length === 1,
    JSON.stringify(still));

  console.log("\n③ 把英文班那一堂取消掉——撞堂自己消失（算出来的，不是存起来的）");
  await say(C, "set_appointment_status", { in_id: engSession, in_status: "cancelled" });
  const afterCancel = await say(C, "class_schedule_clashes", { in_project_id: P });
  check("🔴 取消之后不再报撞堂", afterCancel.length === 0, JSON.stringify(afterCancel));

  console.log("\n④ 别人家");
  const other = await person("other");
  check("🔴 别人家读不到我的撞堂名单",
    (await say(other.client, "class_schedule_clashes", { in_project_id: P })).length === 0,
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
