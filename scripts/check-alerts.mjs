/**
 * 病史 · 禁忌提醒 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的四条：
 *   · **不挡预约**——研究读遍十家，只有一家会挡，我们跟多数那一派
 *   · 一个客人**最多一条现役**——改了是收起旧的挂新的，不是就地改字
 *   · 空的表示「没什么要提醒」，不是「没有问过她」——两句话不一样
 *   · 治疗师读得到（那正是这张表存在的理由），钱那一层不碰
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
  const email = `alert-${tag}-${stamp}@formae.test`;
  const password = `Alert-${stamp}-x!`;
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
  for (const k of ["bookings", "customers", "staff"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ms Chong",
  });

  console.log("\n① 一开始，一句提醒都没有 —— 这是「没什么」，不是「没问过」");
  const empty = await say(C, "party_alert_of", { in_party_id: her.id });
  check("空阵列，不是报错", Array.isArray(empty) && empty.length === 0,
    JSON.stringify(empty));

  console.log("\n② 挂一条");
  const first = await say(C, "set_party_alert", {
    in_party_id: her.id, in_body: "怀孕，预产期十一月，不做镭射",
  });
  check("记得进去", !!first?.id, "记不进去");
  const read1 = await say(C, "party_alert_of", { in_party_id: her.id });
  check("读得回来，一条", read1.length === 1 && read1[0]?.body === first.body,
    JSON.stringify(read1));

  console.log("\n③ 🔴 一个人最多一条现役 —— 改了是收起旧的挂新的");
  const second = await say(C, "set_party_alert", {
    in_party_id: her.id, in_body: "已生产，无特殊事项",
  });
  const read2 = await say(C, "party_alert_of", { in_party_id: her.id });
  check("🔴 现役只有新那一条", read2.length === 1 && read2[0]?.id === second.id,
    JSON.stringify(read2));
  const { data: history } = await admin
    .from("party_alerts").select("id, body, cleared_on, cleared_reason")
    .eq("party_id", her.id).order("created_at");
  check("🔴 而旧那一条还在表上（收起来不是删掉）",
    history.length === 2 && history[0]?.cleared_on !== null,
    JSON.stringify(history));
  check("🔴 讲得出为什么被收起来", history[0]?.cleared_reason === "replaced",
    String(history[0]?.cleared_reason));

  console.log("\n④ 收起来（她的情况不用再提醒了）");
  const cleared = await say(C, "clear_party_alert", {
    in_id: second.id, in_reason: "已确认无风险",
  });
  check("收起来了", !!cleared?.cleared_on, "还留着");
  const read3 = await say(C, "party_alert_of", { in_party_id: her.id });
  check("🔴 现在又是空的（没什么要提醒，不是出错）", read3.length === 0,
    JSON.stringify(read3));
  check("收第二次讲一句人话",
    (await refused(C, "clear_party_alert", { in_id: second.id }))
      .includes("no active alert"), "居然让它过了");

  console.log("\n⑤ 拒绝的每一种");
  check("空的提醒挡下来",
    (await refused(C, "set_party_alert", { in_party_id: her.id, in_body: "  " }))
      .includes("say what the alert"), "居然让它过了");
  check("太长的挡下来",
    (await refused(C, "set_party_alert", {
      in_party_id: her.id, in_body: "x".repeat(401),
    })).includes("too long"), "居然让它过了");

  console.log("\n⑥ 🔴 这一整张表不挡预约（跟多数那一派同一条）");
  const appt = await refused(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 864e5).toISOString(),
    in_ends_at: new Date(Date.now() + 900e5).toISOString(),
    in_party: "Ms Chong", in_party_id: her.id, in_service: "Laser",
  });
  check("🔴 有一条现役提醒的客人，照样约得到（只提醒，不拦）", appt === "",
    appt || "居然把预约挡下来了");

  console.log("\n⑦ 🔴 治疗师读得到（那正是这张表存在的理由）");
  await say(C, "set_party_alert", { in_party_id: her.id, in_body: "对 lidocaine 过敏" });
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check("🔴 她读得到那句提醒",
    (await say(crew.client, "party_alert_of", { in_party_id: her.id })).length === 1,
    "她读不到");
  check("🔴 她也挂得上（发现新的事情要能马上记）",
    (await refused(crew.client, "set_party_alert", {
      in_party_id: her.id, in_body: "补的一句",
    })) === "", "她被挡下来了");

  console.log("\n⑧ 别人家");
  const other = await person("other");
  /* ⚠️ `party_alert_of` 是 `language sql`，works_here 是 WHERE 里的一个条件，
     不是 `raise exception` ——所以别人家问到的是**空阵列**，不是一句拒绝。
     跟 `class_roster` 那一类同一个形状，跟 `class_fees_due` 不一样。 */
  check("🔴 别人家读不到我的提醒（安静地回空，不是报错）",
    (await say(other.client, "party_alert_of", { in_party_id: her.id })).length === 0,
    "他读到了");
  check("🔴 别人家挂不了我的",
    !!(await refused(other.client, "set_party_alert", {
      in_party_id: her.id, in_body: "偷偷塞一句",
    })), "他挂上了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
