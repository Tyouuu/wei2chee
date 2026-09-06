/**
 * 一个老师十个学生 —— 用真的登入身分打一次每一支。
 *
 * 🔴 这一支要守的第一件，是这个产品今天**主动挡着补习那一行**这件事:
 *   一堂十个学生的课，照旧的做法要开十行预约、同一个老师同一个钟头 ——
 *   而那条「同一个人同一个时间只准一次」的约束会把第二行到第十行全部拒绝。
 *   所以下面 ③ 那一段才是这一整支的靶: **一堂课是一行，而那一行不带任何
 *   一个学生的名字**（是给谁的写在名册上）。
 *
 * ⚠️ 而那条约束一个字都没动 —— 一个老师照旧不能同时教两班，
 *   ③ 最后一条就是在量它还在。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
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
  const email = `cls-${tag}-${stamp}@formae.test`;
  const password = `Cls-${stamp}-x!`;
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
dropThrowawayOnExit(admin, () => people[people.length - 1]);

/* 明天下午四点到六点 —— 一个真的补习时段。 */
const at = (dayOffset, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["bookings", "customers", "staff"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: teacher } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Miss Tan",
  });
  const kids = [];
  for (const n of ["Ah Meng", "Ah Hui", "Ah Seng", "Ah Lim"]) {
    const { data } = await C.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: n,
    });
    kids.push(data);
  }

  /* ── ① 开一个班 ─────────────────────────────────────────────── */
  console.log("\n① 开一个班");
  const { data: grp, error: ge } = await C.rpc("add_class_group", {
    in_project_id: P, in_module_key: "bookings",
    in_name: "中四数学 · 星期三 4pm", in_staff_id: teacher.id, in_capacity: 3,
  });
  check("开得起来", !ge && !!grp?.id, ge?.message);
  check("记得是谁教的", grp?.staff_id === teacher.id, `${grp?.staff_id}`);

  const { error: noName } = await C.rpc("add_class_group", {
    in_project_id: P, in_module_key: "bookings", in_name: "   ",
  });
  check("一个班要有一个他认得的名字", !!noName, "居然让它过了");

  const { error: wrongPage } = await C.rpc("add_class_group", {
    in_project_id: P, in_module_key: "customers", in_name: "X",
  });
  check("班长在预约那一页上，不在别页", !!wrongPage, "居然让它过了");

  /* ── ② 名册 ─────────────────────────────────────────────────── */
  console.log("\n② 名册");
  for (const k of kids.slice(0, 2)) {
    const { error } = await C.rpc("enrol_in_class", {
      in_group_id: grp.id, in_party_id: k.id,
    });
    if (error) check(`收得进 ${k.name}`, false, error.message);
  }
  const { data: roster1 } = await C.rpc("class_roster", { in_group_id: grp.id });
  check("名册上两个人", (roster1 ?? []).length === 2, `${roster1?.length}`);

  const { data: twice } = await C.rpc("enrol_in_class", {
    in_group_id: grp.id, in_party_id: kids[0].id,
  });
  const { data: roster2 } = await C.rpc("class_roster", { in_group_id: grp.id });
  check("同一个人收两次只有一个位子",
    !!twice && (roster2 ?? []).length === 2, `${roster2?.length}`);

  await C.rpc("enrol_in_class", { in_group_id: grp.id, in_party_id: kids[2].id });
  const { error: full } = await C.rpc("enrol_in_class", {
    in_group_id: grp.id, in_party_id: kids[3].id,
  });
  check("🔴 满了就讲出来", !!full, "居然让它过了");
  check("🔴 而且讲得出上限是多少（家长问的就是这一句）",
    /3/.test(full?.message ?? ""), `${full?.message}`);

  const { error: shrink } = await C.rpc("update_class_group", {
    in_group_id: grp.id, in_capacity: 2,
  });
  check("🔴 上限调不到比里面的人还少", !!shrink, "居然让它过了");

  const { data: gone } = await C.rpc("leave_class", {
    in_group_id: grp.id, in_party_id: kids[2].id,
  });
  check("走得了", !!gone?.left_on, `${gone?.left_on}`);
  const { data: roster3 } = await C.rpc("class_roster", { in_group_id: grp.id });
  check("🔴 走了不删 —— 他上过我们的课是真的",
    (roster3 ?? []).length === 3
      && (roster3 ?? []).filter((r) => r.left_on === null).length === 2,
    JSON.stringify(roster3?.map((r) => [r.name, r.left_on])));

  const { data: back } = await C.rpc("enrol_in_class", {
    in_group_id: grp.id, in_party_id: kids[2].id,
  });
  check("回来还是同一个位子", back?.id === gone?.id && back?.left_on === null,
    `${back?.id} vs ${gone?.id}`);
  await C.rpc("leave_class", { in_group_id: grp.id, in_party_id: kids[2].id });

  const { data: counted } = await C.rpc("class_groups_of", { in_project_id: P });
  check("一眼看得到这个班坐了几个",
    counted?.[0]?.seats_taken === 2 && counted?.[0]?.capacity === 3,
    JSON.stringify(counted?.[0]));

  /* ── ③ 🔴 一堂课是一行，十个学生 ──────────────────────────── */
  console.log("\n③ 🔴 一堂课是一行");
  const { data: session, error: se } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(1, 16), in_ends_at: at(1, 18),
    in_service: "数学", in_group_id: grp.id,
  });
  check("🔴 一堂课排得进去，而且不用打任何一个学生的名字",
    !se && !!session, se?.message);

  const { data: row } = await admin
    .from("appointments").select("group_id, staff_id, party, party_id")
    .eq("id", session).single();
  check("那一行指着那个班", row?.group_id === grp.id, `${row?.group_id}`);
  check("🔴 老师是从班上拿的（他已经讲过一次了）",
    row?.staff_id === teacher.id, `${row?.staff_id}`);
  check("🔴 那一行不挂在任何一个学生身上",
    row?.party === "" && row?.party_id === null,
    `${row?.party} / ${row?.party_id}`);

  const { error: stillOne } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(1, 17), in_ends_at: at(1, 19),
    in_party: "Mr Ong", in_staff_id: teacher.id,
  });
  check("🔴 而那条不准撞的规矩一个字都没动（同一个老师同一个钟头）",
    !!stillOne, "居然让它过了");
  check("而且它讲的是人话，不是资料库那一句",
    /already taken/.test(stillOne?.message ?? ""), `${stillOne?.message}`);

  const { error: noSuchClass } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(2, 16), in_ends_at: at(2, 18),
    in_group_id: "00000000-0000-0000-0000-000000000000",
  });
  check("指着一个不存在的班 → 挡", !!noSuchClass, "居然让它过了");

  /* 一般的一对一预约照旧要讲是给谁的。 */
  const { error: stillNeeds } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(3, 10), in_ends_at: at(3, 11),
  });
  check("🔴 而一般的预约照旧要讲是给谁的", !!stillNeeds, "居然让它过了");

  /* ── ④ 点名 ─────────────────────────────────────────────────── */
  console.log("\n④ 点名");
  const { data: sheet1 } = await C.rpc("class_attendance_of", {
    in_appointment_id: session,
  });
  check("还没点的时候，名册上那两个都在", (sheet1 ?? []).length === 2,
    `${sheet1?.length}`);
  check("🔴 还没点 ≠ 没来（那一栏是空的，不是「缺席」）",
    (sheet1 ?? []).every((r) => r.status === null),
    JSON.stringify(sheet1?.map((r) => [r.name, r.status])));

  await C.rpc("mark_attendance", {
    in_appointment_id: session, in_party_id: kids[0].id, in_status: "came",
  });
  await C.rpc("mark_attendance", {
    in_appointment_id: session, in_party_id: kids[1].id, in_status: "no_show",
  });
  const { data: sheet2 } = await C.rpc("class_attendance_of", {
    in_appointment_id: session,
  });
  check("点得下去",
    sheet2?.find((r) => r.party_id === kids[0].id)?.status === "came"
      && sheet2?.find((r) => r.party_id === kids[1].id)?.status === "no_show",
    JSON.stringify(sheet2?.map((r) => [r.name, r.status])));

  await C.rpc("mark_attendance", {
    in_appointment_id: session, in_party_id: kids[1].id, in_status: "excused",
  });
  const { data: sheet3 } = await C.rpc("class_attendance_of", {
    in_appointment_id: session,
  });
  check("改一次不会变成两行",
    (sheet3 ?? []).filter((r) => r.party_id === kids[1].id).length === 1
      && sheet3.find((r) => r.party_id === kids[1].id).status === "excused",
    JSON.stringify(sheet3?.map((r) => [r.name, r.status])));

  /* 🔴 来试听的那一个 —— 不在名册上，照样点得了。 */
  await C.rpc("mark_attendance", {
    in_appointment_id: session, in_party_id: kids[3].id, in_status: "came",
  });
  const { data: sheet4 } = await C.rpc("class_attendance_of", {
    in_appointment_id: session,
  });
  const trial = sheet4?.find((r) => r.party_id === kids[3].id);
  check("🔴 来试听的点得了", !!trial, JSON.stringify(sheet4?.map((r) => r.name)));
  check("🔴 而且看得出他不在名册上", trial?.on_roster === false,
    `${trial?.on_roster}`);

  const { data: blockId } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(4, 12), in_ends_at: at(4, 13), in_kind: "block",
  });
  const { error: blockMark } = await C.rpc("mark_attendance", {
    in_appointment_id: blockId, in_party_id: kids[0].id,
  });
  check("挡起来的时段不是一堂课", !!blockMark, "居然让它过了");

  const { error: badStatus } = await C.rpc("mark_attendance", {
    in_appointment_id: session, in_party_id: kids[0].id, in_status: "maybe",
  });
  check("来没来只有三个答案", !!badStatus, "居然让它过了");

  /* ── ⑤ 老师看得到 ─────────────────────────────────────────── */
  console.log("\n⑤ 老师看得到（这是他一天的工作，不是钱）");
  const crew = await person("crew");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: crew.email });
  check("控制组：那个老师真的进了这一家", !memErr, memErr?.message);
  const W = crew.client;

  const { data: crewRoster } = await W.rpc("class_roster", { in_group_id: grp.id });
  check("🔴 老师看得到自己班的名册", (crewRoster ?? []).length === 3,
    `${crewRoster?.length}`);
  const { error: crewMark } = await W.rpc("mark_attendance", {
    in_appointment_id: session, in_party_id: kids[0].id, in_status: "came",
  });
  check("🔴 老师点得了名", !crewMark, crewMark?.message);
  const { data: crewGroups } = await W.rpc("class_groups_of", { in_project_id: P });
  check("老师看得到有哪几个班", (crewGroups ?? []).length === 1,
    `${crewGroups?.length}`);

  /* ── ⑥ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑥ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "ledger" });
  const { data: theirs } = await O.from("class_groups").select("id");
  check("🔴 另一家一行都读不到", (theirs ?? []).length === 0, `${theirs?.length}`);
  const { error: crossEnrol } = await O.rpc("enrol_in_class", {
    in_group_id: grp.id, in_party_id: kids[0].id,
  });
  check("🔴 收不进别人家的班", !!crossEnrol, "居然让它过了");
  const { error: crossMark } = await O.rpc("mark_attendance", {
    in_appointment_id: session, in_party_id: kids[0].id,
  });
  check("🔴 也点不了别人家的名", !!crossMark, "居然让它过了");

  const { data: theirProj } = await admin
    .from("projects").select("id").eq("account_id", other.id).single();
  const { data: theirKid } = await O.rpc("add_directory_entry", {
    in_project_id: theirProj.id, in_module_key: "customers", in_name: "Someone else",
  });
  const { error: wrongKid } = await C.rpc("enrol_in_class", {
    in_group_id: grp.id, in_party_id: theirKid.id,
  });
  check("🔴 收一个不在这本册子上的人 → 挡", !!wrongKid, "居然让它过了");

  /* ── ⑦ 🔴 那个老师离职，帐号删得掉 ────────────────────────── */
  console.log("\n⑦ 🔴 老师离职，帐号删得掉");
  const { error: delCrew } = await admin.auth.admin.deleteUser(crew.id);
  check("🔴 删得掉（`marked_by` 那一栏要清空，那是一次修改）",
    !delCrew, delCrew?.message);
  if (!delCrew) people.splice(people.indexOf(crew.id), 1);
  const { data: stillMarked } = await admin
    .from("class_attendance").select("id").eq("appointment_id", session);
  check("而他点过的名一行都没有消失", (stillMarked ?? []).length === 3,
    `${stillMarked?.length}`);

  /* ── ⑧ 关班 ───────────────────────────────────────────────── */
  console.log("\n⑧ 关班");
  const { data: closed } = await C.rpc("update_class_group", {
    in_group_id: grp.id, in_archived: true,
  });
  check("关得掉", !!closed?.archived_at, `${closed?.archived_at}`);
  const { error: intoClosed } = await C.rpc("enrol_in_class", {
    in_group_id: grp.id, in_party_id: kids[3].id,
  });
  check("关了就收不进人", !!intoClosed, "居然让它过了");
  const { error: classOver } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(5, 16), in_ends_at: at(5, 18), in_group_id: grp.id,
  });
  check("🔴 关了也排不了新的课", !!classOver, "居然让它过了");
  const { data: pastSessions } = await admin
    .from("appointments").select("id").eq("group_id", grp.id);
  check("而上过的课一堂都没有消失", (pastSessions ?? []).length === 1,
    `${pastSessions?.length}`);

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}`
      : `\n判：全部过（${people.length} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}
