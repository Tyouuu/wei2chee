/**
 * 上下班打卡——真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 按两下打卡上班不会开两张班——回同一笔，不是第二笔
 *   · 还在上班的那一节不算进时数（clock_out_at 是空的）
 *   · 别人家的登入打不了我的卡
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
  const email = `ci-${tag}-${stamp}@formae.test`;
  const password = `Ci-${stamp}-x!`;
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
  await C.rpc("add_project_page", { requested_key: "staff", new_title: "staff" });

  const amy = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Amy",
  });

  console.log("\n① 还没打卡——不在名单上");
  const before = await say(C, "who_is_clocked_in", { in_project_id: P });
  check("空的", before.length === 0, JSON.stringify(before));

  console.log("\n② 🔴 打卡上班");
  const shift = await say(C, "clock_in", { in_staff_id: amy.id });
  check("有一笔开着的班", !!shift?.id && shift.clock_out_at === null, JSON.stringify(shift));
  const during = await say(C, "who_is_clocked_in", { in_project_id: P });
  check("她在名单上", during.some((r) => r.staff_id === amy.id), JSON.stringify(during));

  console.log("\n③ 🔴 按两下不会开两张班");
  const again = await say(C, "clock_in", { in_staff_id: amy.id });
  check("还是同一笔", again.id === shift.id, JSON.stringify([again.id, shift.id]));
  const { count } = await admin
    .from("staff_shifts").select("*", { count: "exact", head: true })
    .eq("staff_id", amy.id).is("clock_out_at", null);
  check("资料库里还是只有一笔开着的", count === 1, String(count));

  console.log("\n④ 打卡下班");
  await admin.from("staff_shifts").update({
    clock_in_at: new Date(Date.now() - 3 * 3600e3).toISOString(),
  }).eq("id", shift.id);
  const out = await say(C, "clock_out", { in_staff_id: amy.id });
  check("那一笔关上了", out.id === shift.id && !!out.clock_out_at, JSON.stringify(out));
  const after = await say(C, "who_is_clocked_in", { in_project_id: P });
  check("🔴 下班之后不在名单上了", after.length === 0, JSON.stringify(after));

  console.log("\n⑤ 🔴 再打卡下班一次，讲得出「没有打卡上班」");
  check("回的是那句话，不是资料库的错误讯息",
    (await refused(C, "clock_out", { in_staff_id: amy.id })).includes("has not clocked in"),
    "居然让它过了");

  console.log("\n⑥ 🔴 这个月她上了几个小时——只数关上的那一节");
  const hours = await say(C, "hours_worked_of", { in_project_id: P, in_days: 30 });
  const amyHours = hours.find((r) => r.staff_id === amy.id);
  check("大约 3 小时", Math.abs(Number(amyHours?.hours) - 3) < 0.05, JSON.stringify(amyHours));
  check("一节", amyHours?.shifts_worked === 1, String(amyHours?.shifts_worked));

  console.log("\n⑦ 🔴 还在上班的那一节不算进时数");
  await say(C, "clock_in", { in_staff_id: amy.id });
  const hoursStill = await say(C, "hours_worked_of", { in_project_id: P, in_days: 30 });
  const amyStill = hoursStill.find((r) => r.staff_id === amy.id);
  check("时数没有变", Math.abs(Number(amyStill?.hours) - 3) < 0.05, JSON.stringify(amyStill));
  check("还是只算一节", amyStill?.shifts_worked === 1, String(amyStill?.shifts_worked));
  await say(C, "clock_out", { in_staff_id: amy.id });

  console.log("\n⑧ 拒绝的每一种");
  check("不是他的员工——挡下来", (await refused(C, "clock_in", {
    in_staff_id: "00000000-0000-0000-0000-000000000000",
  })).includes("does not work here"), "居然让它过了");

  console.log("\n⑨ 别人家");
  const other = await person("other");
  check("🔴 别人家打不了我员工的卡", !!(await refused(other.client, "clock_in", {
    in_staff_id: amy.id,
  })), "他打了");
  check("🔴 别人家读不到我这份名单",
    (await say(other.client, "who_is_clocked_in", { in_project_id: P })).length === 0,
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
