/**
 * 「星期三下午谁有空」—— 用真的登入身分打一次每一支。
 *
 * 🔴 这一支要守的第一件，是它**没有推翻 20260902030000 那个决定**:
 *   那一支明写不拿 easyappointments 的整套上班时间引擎，理由是
 *   「每一样都是第一笔预约之前要先填完的设定」。
 *   所以 ① 第一条量的就是那一句: **一行班都没排的时候，行为一个字都不变。**
 *
 * ⚠️ 而它**不挡任何一次预约** —— 老板真的会替熟客排晚上七点的一单。
 *   ③ 最后一条在量这一句还成立。
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
  const email = `rota-${tag}-${stamp}@formae.test`;
  const password = `Rota-${stamp}-x!`;
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

/* 🔴 用**马来西亚的墙上时钟**造时间 —— 这台机器不一定在那个时区，
   而排班存的是墙上时钟。第十六次红的是我的道具，那几次全部是日期。
   下一个星期三（同一个礼拜里往后找），本地几点。 */
function nextWednesday(hour) {
  const now = new Date();
  const myt = new Date(now.getTime() + 8 * 3600e3);
  const add = (3 - myt.getUTCDay() + 7) % 7 || 7;
  const d = new Date(Date.UTC(
    myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate() + add,
    hour - 8, 0, 0,
  ));
  return d.toISOString();
}
const wed = (h) => nextWednesday(h);

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

  const girls = [];
  for (const n of ["Ah Girl", "Ah Mei", "Ah Lan"]) {
    const { data } = await C.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "staff", in_name: n,
    });
    girls.push(data);
  }

  /* ── ① 🔴 一行班都没排 → 今天的行为一个字都不变 ──────────── */
  console.log("\n① 🔴 一行都没排的时候");
  const { data: before, error: be } = await C.rpc("who_is_free", {
    in_project_id: P, in_starts_at: wed(14), in_ends_at: wed(15),
  });
  check("答得出来", !be && (before ?? []).length === 3, be?.message ?? `${before?.length}`);
  check("🔴 每一个人都算有空（20260902030000 那个决定没有被推翻）",
    (before ?? []).every((r) => r.on_duty === true && r.busy === false),
    JSON.stringify(before?.map((r) => [r.name, r.on_duty, r.busy])));

  /* ── ② 排一个礼拜 ─────────────────────────────────────────── */
  console.log("\n② 排一个礼拜");
  const { data: hours, error: he } = await C.rpc("set_staff_hours", {
    in_staff_id: girls[0].id,
    in_hours: [
      { weekday: 2, starts_at: "10:00", ends_at: "19:00" },
      { weekday: 3, starts_at: "10:00", ends_at: "19:00" },
      { weekday: 4, starts_at: "10:00", ends_at: "19:00" },
      { weekday: 5, starts_at: "10:00", ends_at: "19:00" },
      { weekday: 6, starts_at: "10:00", ends_at: "19:00" },
      { weekday: 0, starts_at: "10:00", ends_at: "17:00" },
    ],
  });
  check("排得进去（六行，打一次）", !he && (hours ?? []).length === 6,
    he?.message ?? `${hours?.length}`);

  const { error: backwards } = await C.rpc("set_staff_hours", {
    in_staff_id: girls[1].id,
    in_hours: [{ weekday: 3, starts_at: "19:00", ends_at: "10:00" }],
  });
  check("一个班要在开始之后结束", !!backwards, "居然让它过了");
  const { data: nothingLeft } = await C.rpc("staff_hours_of", { in_project_id: P });
  check("🔴 被挡下来之后，她一行都没有留下",
    (nothingLeft ?? []).filter((r) => r.staff_id === girls[1].id).length === 0,
    JSON.stringify(nothingLeft?.map((r) => r.name)));

  await C.rpc("set_staff_hours", {
    in_staff_id: girls[1].id,
    in_hours: [{ weekday: 3, starts_at: "13:00", ends_at: "18:00" }],
  });

  /* 整批换掉 —— 一个礼拜是一句完整的话。 */
  const { data: redone } = await C.rpc("set_staff_hours", {
    in_staff_id: girls[0].id,
    in_hours: [{ weekday: 3, starts_at: "10:00", ends_at: "19:00" }],
  });
  check("整批换掉，不是加上去", (redone ?? []).length === 1, `${redone?.length}`);

  /* ── ③ 🔴 星期三下午谁有空 ────────────────────────────────── */
  console.log("\n③ 🔴 星期三下午谁有空");
  const { data: wedPm } = await C.rpc("who_is_free", {
    in_project_id: P, in_starts_at: wed(14), in_ends_at: wed(15),
  });
  const byName = Object.fromEntries((wedPm ?? []).map((r) => [r.name, r]));
  check("Ah Girl 星期三下午上班", byName["Ah Girl"]?.on_duty === true,
    JSON.stringify(byName["Ah Girl"]));
  check("Ah Mei 也上（一点到六点）", byName["Ah Mei"]?.on_duty === true,
    JSON.stringify(byName["Ah Mei"]));
  check("🔴 Ah Lan 没排班 → 那个时段她不上班",
    byName["Ah Lan"]?.on_duty === false, JSON.stringify(byName["Ah Lan"]));

  const { data: wedAm } = await C.rpc("who_is_free", {
    in_project_id: P, in_starts_at: wed(11), in_ends_at: wed(12),
  });
  const am = Object.fromEntries((wedAm ?? []).map((r) => [r.name, r]));
  check("🔴 Ah Mei 一点才上班，所以十一点她不在",
    am["Ah Mei"]?.on_duty === false, JSON.stringify(am["Ah Mei"]));
  check("而 Ah Girl 十点就在", am["Ah Girl"]?.on_duty === true,
    JSON.stringify(am["Ah Girl"]));

  /* 那个钟头 Ah Girl 有客人。 */
  const { error: bookErr } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: wed(14), in_ends_at: wed(15),
    in_party: "Mrs Lim", in_staff_id: girls[0].id, in_service: "染发",
  });
  check("排得了那一单", !bookErr, bookErr?.message);
  const { data: taken } = await C.rpc("who_is_free", {
    in_project_id: P, in_starts_at: wed(14), in_ends_at: wed(15),
  });
  const t = Object.fromEntries((taken ?? []).map((r) => [r.name, r]));
  check("🔴 「上班」跟「有空」是两句话 —— 她上班，而那个钟头有人",
    t["Ah Girl"]?.on_duty === true && t["Ah Girl"]?.busy === true,
    JSON.stringify(t["Ah Girl"]));
  check("🔴 而且讲得出是谁（老板下一句要讲的话不一样）",
    t["Ah Girl"]?.busy_with === "Mrs Lim", `${t["Ah Girl"]?.busy_with}`);
  check("Ah Mei 照旧有空", t["Ah Mei"]?.busy === false, JSON.stringify(t["Ah Mei"]));

  /* 请假 —— 走本来就有的「挡起来的时段」，不是第二张表。 */
  await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: wed(15), in_ends_at: wed(17),
    in_kind: "block", in_staff_id: girls[1].id, in_note: "看医生",
  });
  const { data: off } = await C.rpc("who_is_free", {
    in_project_id: P, in_starts_at: wed(15), in_ends_at: wed(16),
  });
  const o = Object.fromEntries((off ?? []).map((r) => [r.name, r]));
  check("🔴 请假走本来就有的挡起来的时段，不是第二张表",
    o["Ah Mei"]?.busy === true && o["Ah Mei"]?.busy_with === "看医生",
    JSON.stringify(o["Ah Mei"]));

  /* 🔴 它不挡任何一次预约。 */
  const { error: lateOne } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: wed(20), in_ends_at: wed(21),
    in_party: "熟客", in_staff_id: girls[0].id,
  });
  check("🔴 排在班表外面照样排得进去（讲事实，判断留给他）",
    !lateOne, lateOne?.message);

  const { error: badRange } = await C.rpc("who_is_free", {
    in_project_id: P, in_starts_at: wed(15), in_ends_at: wed(14),
  });
  check("倒着的时段问不了", !!badRange, "居然让它过了");

  /* ── ④ 发型师自己看得到 ───────────────────────────────────── */
  console.log("\n④ 发型师自己看得到（那是她的工作，不是钱）");
  const crew = await person("crew");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: crew.email });
  check("控制组：她真的进了这一家", !memErr, memErr?.message);
  const W = crew.client;
  const { data: crewSees } = await W.rpc("staff_hours_of", { in_project_id: P });
  check("🔴 她看得到班表", (crewSees ?? []).length === 2, `${crewSees?.length}`);
  const { data: crewFree } = await W.rpc("who_is_free", {
    in_project_id: P, in_starts_at: wed(14), in_ends_at: wed(15),
  });
  check("🔴 她也问得了谁有空", (crewFree ?? []).length === 3, `${crewFree?.length}`);

  /* ── ⑤ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑤ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "ledger" });
  const { data: theirs } = await O.from("staff_hours").select("id");
  check("🔴 另一家一行都读不到", (theirs ?? []).length === 0, `${theirs?.length}`);
  const { error: crossSet } = await O.rpc("set_staff_hours", {
    in_staff_id: girls[0].id, in_hours: [{ weekday: 1, starts_at: "09:00", ends_at: "18:00" }],
  });
  check("🔴 排不了别人家的班", !!crossSet, "居然让它过了");
  const { data: crossRead } = await O.rpc("who_is_free", {
    in_project_id: P, in_starts_at: wed(14), in_ends_at: wed(15),
  });
  check("🔴 也问不了别人家谁有空", (crossRead ?? []).length === 0,
    `${crossRead?.length}`);
  const { data: stillThere } = await C.rpc("staff_hours_of", { in_project_id: P });
  check("控制组：老板自己照旧看得到（不是整支坏了）",
    (stillThere ?? []).length === 2, `${stillThere?.length}`);

  /* ── ⑥ 🔴 她离职，帐号删得掉 ──────────────────────────────── */
  console.log("\n⑥ 🔴 她离职，帐号删得掉");
  const { error: delCrew } = await admin.auth.admin.deleteUser(crew.id);
  check("🔴 删得掉（`created_by` 要清空，那是一次修改）", !delCrew, delCrew?.message);
  if (!delCrew) people.splice(people.indexOf(crew.id), 1);

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
