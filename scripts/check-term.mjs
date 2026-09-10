/**
 * 谁还没确认续读下一期 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的四条：
 *   · **没有「当前学期」这种状态** —— 每一次都明写是哪一期，
 *     跟 `bill_class` 的 `in_period` 同一个写法
 *   · 按第二下不会多一行，也不会覆盖第一次是谁按的
 *   · **确认续班不等于交了钱** —— 两件事分开
 *   · 走了的学生不出现在「还没确认」名单上（他本来就不用问）
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
  const email = `term-${tag}-${stamp}@formae.test`;
  const password = `Term-${stamp}-x!`;
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
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["bookings", "customers"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const teacher = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Miss Tan",
  });
  const kids = {};
  for (const n of ["Ah Meng", "Ah Hui", "Ah Seng"]) {
    kids[n] = await say(C, "add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: n,
    });
  }
  const grp = await say(C, "add_class_group", {
    in_project_id: P, in_module_key: "bookings",
    in_name: "中四数学", in_staff_id: teacher.id,
  });
  for (const n of Object.keys(kids)) {
    await say(C, "enrol_in_class", { in_group_id: grp.id, in_party_id: kids[n].id });
  }

  console.log("\n① 一开始，三个都还没确认");
  const list0 = await say(C, "not_confirmed_for", {
    in_group_id: grp.id, in_period: "2026-T2",
  });
  check("三个都在名单上", list0.length === 3,
    JSON.stringify(list0.map((r) => r.student)));

  console.log("\n② 确认一位");
  const conf = await say(C, "confirm_for_period", {
    in_group_id: grp.id, in_party_id: kids["Ah Meng"].id, in_period: "2026-T2",
  });
  check("记得进去", !!conf?.id, "记不进去");
  const list1 = await say(C, "not_confirmed_for", {
    in_group_id: grp.id, in_period: "2026-T2",
  });
  check("名单剩两个", list1.length === 2 && !list1.some((r) => r.student === "Ah Meng"),
    JSON.stringify(list1.map((r) => r.student)));

  console.log("\n③ 🔴 按第二下");
  const again = await say(C, "confirm_for_period", {
    in_group_id: grp.id, in_party_id: kids["Ah Meng"].id, in_period: "2026-T2",
  });
  check("🔴 拿回原来那一条，不是多一条", again?.id === conf.id, `${again?.id} ⟂ ${conf.id}`);
  const { count } = await C
    .from("class_confirmations").select("id", { count: "exact", head: true })
    .eq("group_id", grp.id).eq("party_id", kids["Ah Meng"].id).eq("period", "2026-T2");
  check("🔴 表上还是一行", count === 1, `${count} 行`);

  console.log("\n④ 🔴 换一期，是另一件事");
  const list2 = await say(C, "not_confirmed_for", {
    in_group_id: grp.id, in_period: "2026-T3",
  });
  check(
    "🔴 换一期，三个都要重新确认（上一期确认过不算数）",
    list2.length === 3,
    JSON.stringify(list2.map((r) => r.student)),
  );

  console.log("\n⑤ 走了的学生不用问");
  await say(C, "leave_class", { in_group_id: grp.id, in_party_id: kids["Ah Seng"].id });
  const list3 = await say(C, "not_confirmed_for", {
    in_group_id: grp.id, in_period: "2026-T2",
  });
  check(
    "🔴 走了的那个不在名单上",
    list3.length === 1 && list3[0]?.student === "Ah Hui",
    JSON.stringify(list3.map((r) => r.student)),
  );

  console.log("\n⑥ 🔴 确认续班不等于交了钱");
  const debts = await say(C, "party_debts", { in_project_id: P });
  check("确认那一下没有碰过帐", debts.length === 0, JSON.stringify(debts));

  console.log("\n⑦ 🔴 一月份升级，不是学期问题 —— 改个名字就好");
  const renamed = await say(C, "update_class_group", {
    in_group_id: grp.id, in_name: "中五数学",
  });
  check("🔴 改名成功，学生跟老师一个都没动", renamed?.name === "中五数学",
    String(renamed?.name));
  const stillHere = await say(C, "class_roster", { in_group_id: grp.id });
  check("名册还是原来那几个", stillHere.some((r) => r.name === "Ah Hui"),
    JSON.stringify(stillHere.map((r) => r.name)));

  console.log("\n⑧ 拒绝的每一种");
  check("空的那一期挡下来",
    (await refused(C, "confirm_for_period", {
      in_group_id: grp.id, in_party_id: kids["Ah Hui"].id, in_period: "  ",
    })).includes("say which period"), "居然让它过了");
  check("已经走了的学生确认不了",
    (await refused(C, "confirm_for_period", {
      in_group_id: grp.id, in_party_id: kids["Ah Seng"].id, in_period: "2026-T2",
    })).includes("not currently in this class"), "居然让它过了");

  console.log("\n⑨ 🔴 老师做得了这两下");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check("🔴 老师确认得了",
    (await refused(crew.client, "confirm_for_period", {
      in_group_id: grp.id, in_party_id: kids["Ah Hui"].id, in_period: "2026-T2",
    })) === "", "它把老师挡下来了");
  check("🔴 老师也读得到名单",
    (await say(crew.client, "not_confirmed_for", {
      in_group_id: grp.id, in_period: "2026-T2",
    })).length === 0, "她读不到");

  console.log("\n⑩ 别人家");
  const other = await person("other");
  check("🔴 别人家确认不了我的学生",
    !!(await refused(other.client, "confirm_for_period", {
      in_group_id: grp.id, in_party_id: kids["Ah Hui"].id, in_period: "2026-T2",
    })), "他确认了");
  /* ⚠️ 跟 `class_fees_due` 同一个做法 —— 别人家的班号，
     这一支讲的是一句拒绝，不是回一份空名单。我第一版拿 `say` 去打，
     炸出来的正是这一支自己讲的那句话。 */
  check("🔴 别人家读不到我的名单",
    (await refused(other.client, "not_confirmed_for", {
      in_group_id: grp.id, in_period: "2026-T2",
    })).includes("no such class"), "他读到了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
