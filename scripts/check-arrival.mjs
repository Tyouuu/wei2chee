/**
 * 她到了，还没轮到她 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 到了不是做完了——按「到了」不碰 status，不扣套票
 *   · 按第二下不会移动那个时刻——一个事实按两次还是同一个事实
 *   · 一旦真的做完 / 没来 / 取消，就不再算「在等」——那是问现在的问题
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
  const email = `arr-${tag}-${stamp}@formae.test`;
  const password = `Arr-${stamp}-x!`;
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
  for (const k of ["bookings", "customers"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const pkg = await say(C, "add_service_package", {
    in_party_id: her.id, in_name: "Facial x10", in_sessions_total: 10,
  });

  const start = new Date(Date.now() - 10 * 60_000).toISOString();
  const end = new Date(Date.now() + 50 * 60_000).toISOString();
  const apptId = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: start, in_ends_at: end,
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Facial",
  });

  console.log("\n① 还没到的时候");
  const before = await say(C, "who_is_waiting", { in_project_id: P });
  check("空的（还没有人在等）", before.length === 0, JSON.stringify(before));

  console.log("\n② 🔴 她到了——status 不变，套票不扣");
  const arrived = await say(C, "mark_appointment_arrived", { in_id: apptId });
  check("记下来了", !!arrived?.arrived_at, "还是空的");
  check("🔴 status 还是 booked（不是 done）", arrived?.status === "booked",
    String(arrived?.status));
  const { data: apptRow } = await admin
    .from("appointments").select("status").eq("id", apptId).single();
  check("资料库里也还是 booked", apptRow?.status === "booked", apptRow?.status);
  const { data: balance1 } = await C.from("package_balance").select("*").eq("party_id", her.id);
  const pkgRow1 = balance1.find((r) => r.package_id === pkg.id);
  check("🔴 套票一次都没有扣（她还没做完，只是到了）",
    Number(pkgRow1?.sessions_left) === 10, String(pkgRow1?.sessions_left));

  console.log("\n③ 🔴 她在等的名单上出现了");
  const waiting = await say(C, "who_is_waiting", { in_project_id: P });
  check("查得到她在等", waiting.some((r) => r.id === apptId), JSON.stringify(waiting));

  console.log("\n④ 🔴 按第二下不会移动那个时刻");
  await new Promise((r) => setTimeout(r, 1100));
  const arrivedAgain = await say(C, "mark_appointment_arrived", { in_id: apptId });
  check("时刻没有被后来那一下改掉",
    arrivedAgain.arrived_at === arrived.arrived_at,
    `${arrivedAgain.arrived_at} vs ${arrived.arrived_at}`);

  console.log("\n⑤ 🔴 拒绝的每一种");
  check("🔴 一笔取消了的预约不给标到了",
    (await refused(C, "mark_appointment_arrived", {
      in_id: await say(C, "add_appointment", {
        in_project_id: P, in_module_key: "bookings",
        in_starts_at: new Date(Date.now() + 36e5).toISOString(),
        in_ends_at: new Date(Date.now() + 2 * 36e5).toISOString(),
        in_party: "Mrs Tan", in_party_id: her.id, in_service: "Facial",
      }).then(async (id) => {
        await say(C, "set_appointment_status", { in_id: id, in_status: "cancelled" });
        return id;
      }),
    })).includes("not waiting to happen"), "居然让它过了");

  console.log("\n⑥ 🔴 做完了之后，就不再算「在等」——问的是现在");
  await say(C, "set_appointment_status", { in_id: apptId, in_status: "done" });
  const afterDone = await say(C, "who_is_waiting", { in_project_id: P });
  check("🔴 做完了就从等的名单上消失", !afterDone.some((r) => r.id === apptId),
    JSON.stringify(afterDone));
  const { data: balance2 } = await C.from("package_balance").select("*").eq("party_id", her.id);
  const pkgRow2 = balance2.find((r) => r.package_id === pkg.id);
  check("🔴 真的做完了，套票才在这一刻扣", Number(pkgRow2?.sessions_left) === 9,
    String(pkgRow2?.sessions_left));

  console.log("\n⑦ 别人家");
  const other = await person("other");
  check("🔴 别人家读不到我在等的名单",
    (await say(other.client, "who_is_waiting", { in_project_id: P })).length === 0,
    "他读到了");
  check("🔴 别人家标不了我的预约到了",
    !!(await refused(other.client, "mark_appointment_arrived", { in_id: apptId })),
    "他标上了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
