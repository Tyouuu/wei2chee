/**
 * 「每个礼拜三四点」—— 一个班的课表，用**真的登入身分**打一次。
 *
 * 🔴 `db push` 成功证明不了任何事（[重点 26](../docs/founder-points.md)）——
 *   plpgsql 到**执行**才解析名字，而今天早上那一支
 *   （第十一个讯号）就是推上去回报成功、整支是坏的。
 *
 * 它守的那几件：
 *   · 存的是「每个礼拜三」，接下来那几堂是**算出来的**
 *   · 🔴 他改一次时间，以后每一堂跟着改 —— 那正是不预先生成的理由
 *   · 开一堂课是**幂等**的：柜台按两下，不会长出第二堂
 *   · 那一堂走的是人按的那一支（`add_appointment`）—— 不准撞照旧挡
 *   · 别人家的班排不了、看不到
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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

const people = [];
let pass = 0;
let fail = 0;
const check = (what, ok, detail) => {
  if (ok) { pass += 1; console.log(`  PASS  ${what}`); }
  else { fail += 1; console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ""}`); }
};

async function person(tag) {
  const email = `tt-${tag}-${Date.now()}@formae.test`;
  const password = `Tt-${Date.now()}-x!`;
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
  return { id: data.user.id, client };
}
dropThrowawayOnExit(admin, () => people[people.length - 1]);

/* 马来西亚的今天，跟资料库那一支 `today_myt()` 同一个日子。
   ⚠️ 拿这台机器的 UTC 去数天数，马来西亚半夜到早上八点会差一天 ——
   这个仓库栽过两次（任务 168 · 209）。 */
const myt = () => {
  const d = new Date(Date.now() + 8 * 3600e3);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
const iso = (d) => d.toISOString().slice(0, 10);
/* 从今天起，下一个星期几（今天算数）。 */
const nextDow = (dow, after = 0) => {
  const d = myt();
  d.setUTCDate(d.getUTCDate() + after);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  return d;
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "blueprint" });
  for (const k of ["bookings", "customers", "staff"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const { data: teacher } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Ms Lim",
  });
  const { data: cls, error: clsErr } = await C.rpc("add_class_group", {
    in_project_id: P, in_module_key: "bookings", in_name: "Form 4 Add Maths",
    in_staff_id: teacher?.id,
  });
  check("道具：一个班开得起来", !!cls?.id, clsErr?.message);

  /* ── ① 写课表 ─────────────────────────────────────────────── */
  console.log("\n① 每个礼拜三四点");
  const { data: slots, error: slotErr } = await C.rpc("set_class_slots", {
    in_group_id: cls?.id,
    in_slots: [{ weekday: 3, starts_at: "16:00", ends_at: "18:00" }],
  });
  check("写得进去", !slotErr && (slots ?? []).length === 1, slotErr?.message);
  const { error: backwards } = await C.rpc("set_class_slots", {
    in_group_id: cls?.id,
    in_slots: [{ weekday: 3, starts_at: "18:00", ends_at: "16:00" }],
  });
  check("🔴 六点上到四点 → 挡", !!backwards, "居然让它过了");
  const { data: after } = await C.rpc("class_slots_of_probe", {}).then(
    () => ({ data: null }), () => ({ data: null }));
  const { data: still } = await C.from("class_slots").select("id").eq("group_id", cls.id);
  check("被挡下来之后，原本那一堂还在", (still ?? []).length === 1,
    `${(still ?? []).length}`);
  void after;

  /* ── ② 接下来那几堂是算出来的 ─────────────────────────────── */
  console.log("\n② 接下来那几堂 —— 算出来的");
  const { data: due, error: dueErr } = await C.rpc("lessons_due", {
    in_project_id: P, in_from: iso(myt()), in_until: iso(nextDow(3, 22)),
  });
  const weds = (due ?? []).filter((r) => r.group_id === cls.id);
  check("排得出接下来那几堂", !dueErr && weds.length >= 3,
    dueErr?.message ?? `${weds.length} 堂`);
  check("🔴 每一堂都是星期三",
    weds.every((r) => new Date(`${r.on_date}T00:00:00Z`).getUTCDay() === 3),
    weds.map((r) => r.on_date).join(" "));
  check("🔴 而且一堂都还没开出来（那几行不存在）",
    weds.every((r) => r.lesson_id === null), "居然已经有了");
  check("讲得出那个班有几个人", weds.every((r) => Number(r.seats_taken) === 0),
    `${weds[0]?.seats_taken}`);

  /* ── ③ 🔴 改一次时间，以后每一堂跟着改 ───────────────────── */
  console.log("\n③ 🔴 改一次时间，以后每一堂跟着改");
  await C.rpc("set_class_slots", {
    in_group_id: cls?.id,
    in_slots: [{ weekday: 3, starts_at: "17:00", ends_at: "19:00" }],
  });
  const { data: due2 } = await C.rpc("lessons_due", {
    in_project_id: P, in_from: iso(myt()), in_until: iso(nextDow(3, 22)),
  });
  const weds2 = (due2 ?? []).filter((r) => r.group_id === cls.id);
  const allFive = weds2.every(
    (r) => new Date(r.starts_at).toISOString().slice(11, 16) === "09:00");
  check("🔴 以后每一堂都变成五点（那正是不预先生成的理由）",
    weds2.length === weds.length && allFive,
    weds2.map((r) => new Date(r.starts_at).toISOString().slice(11, 16)).join(" "));

  /* ── ④ 把那一堂开出来 ─────────────────────────────────────── */
  console.log("\n④ 把那一堂开出来");
  const firstWed = weds2[0]?.on_date;
  const { data: made, error: madeErr } = await C.rpc("open_lesson", {
    in_group_id: cls?.id, in_on: firstWed,
  });
  check("开得出来", !madeErr && !!made?.id, madeErr?.message ?? JSON.stringify(made));
  check("🔴 时间是课表上那个时间", !!made
    && new Date(made.starts_at).toISOString().slice(11, 16) === "09:00",
    made ? new Date(made.starts_at).toISOString().slice(11, 16) : "开不了");
  check("挂在那个班上", made?.group_id === cls?.id, `${made?.group_id}`);
  check("老师是那个班的老师", made?.staff_id === teacher?.id, `${made?.staff_id}`);
  const { data: made2 } = await C.rpc("open_lesson", {
    in_group_id: cls?.id, in_on: firstWed,
  });
  check("🔴 按两下还是同一堂",
    !!made?.id && made2?.id === made?.id, `${made2?.id}`);
  const { count: rows } = await C.from("appointments")
    .select("id", { count: "exact", head: true }).eq("project_id", P);
  check("🔴 表上只有一行", rows === 1, `${rows}`);

  const { data: due3 } = await C.rpc("lessons_due", {
    in_project_id: P, in_from: firstWed, in_until: firstWed,
  });
  /* ⚠️ `made?.id` 是空的时候，`null === undefined` 是 false，
     而 `null === null` 是 **true** —— 上一版这一条就是那样假绿的。 */
  check("那一堂现在讲得出「已经开了」",
    !!made?.id && (due3 ?? []).some((r) => r.lesson_id === made.id), "还说没开");
  check("而且讲得出还没点名", (due3 ?? []).every((r) => Number(r.marked) === 0),
    `${due3?.[0]?.marked}`);

  /* ── ④b 🔴 他把这一堂挪到别的时间 ──────────────
     ⚠️ 上面那一条其实**量不到幂等**：同一个时间本来就被
     `20260902030000` 那条不准撞的约束挡着（而它对没写老师的班
     是跟**整间店**比）—— 第二次是报错，不是多一堂。

     🔴 幂等那一句真正在护的是这一种：
     **他把这一星期三那一堂从五点挪到七点**，
     然后某一个人又按了一次「开这一堂」。
     没有那一句，同一天会有两堂，而点名会分成两半。 */
  console.log("\n④b 🔴 他把这一堂挪到别的时间");
  const moved = new Date(new Date(made.starts_at).getTime() + 2 * 3600e3);
  const movedEnd = new Date(new Date(made.ends_at).getTime() + 2 * 3600e3);
  const { error: moveErr } = await C.rpc("update_appointment", {
    in_id: made.id,
    in_starts_at: moved.toISOString(),
    in_ends_at: movedEnd.toISOString(),
    in_staff_id: teacher?.id,
    in_service: "Form 4 Add Maths",
  });
  check("道具：挪得动", !moveErr, moveErr?.message);
  const { data: made3, error: made3e } = await C.rpc("open_lesson", {
    in_group_id: cls?.id, in_on: firstWed,
  });
  const { count: sameDay } = await C.from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("group_id", cls?.id);
  check("🔴 挪过之后再按一次，还是那一堂（不是另开一堂）",
    !made3e && made3?.id === made.id && sameDay === 1,
    `${sameDay} 堂；${made3e?.message ?? made3?.id}`);

  /* ── ⑤ 挡下来的那几种 ─────────────────────────────────────── */
  console.log("\n⑤ 挡下来的那几种");
  const notWed = iso(nextDow(1, 1));
  const { error: wrongDay } = await C.rpc("open_lesson", {
    in_group_id: cls?.id, in_on: notWed,
  });
  check("🔴 那个班那天没有课 → 挡，而且讲得出该怎么做",
    !!wrongDay && /timetable|by hand/.test(wrongDay.message ?? ""),
    wrongDay?.message ?? "居然让它过了");
  const { error: tooWide } = await C.rpc("lessons_due", {
    in_project_id: P, in_from: iso(myt()), in_until: iso(nextDow(3, 200)),
  });
  check("窗口开太宽 → 挡", !!tooWide, "居然让它过了");
  await C.rpc("update_class_group", { in_group_id: cls?.id, in_archived: true });
  const { error: closed } = await C.rpc("open_lesson", {
    in_group_id: cls?.id, in_on: iso(nextDow(3, 8)),
  });
  check("🔴 收起来的班开不了课", !!closed, "居然让它过了");
  await C.rpc("update_class_group", { in_group_id: cls?.id, in_archived: false });

  /* ── ⑥ 学期 ───────────────────────────────────────────────── */
  console.log("\n⑥ 学期");
  const termEnd = iso(nextDow(3, 8));
  await C.rpc("set_class_slots", {
    in_group_id: cls?.id,
    in_slots: [{ weekday: 3, starts_at: "17:00", ends_at: "19:00", until_on: termEnd }],
  });
  const { data: due4 } = await C.rpc("lessons_due", {
    in_project_id: P, in_from: iso(myt()), in_until: iso(nextDow(3, 22)),
  });
  const inTerm = (due4 ?? []).filter((r) => r.group_id === cls.id);
  check("🔴 学期完了就不再排", inTerm.every((r) => r.on_date <= termEnd),
    inTerm.map((r) => r.on_date).join(" "));

  /* ── ⑦ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑦ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "blueprint" });
  const { error: crossSet } = await O.rpc("set_class_slots", {
    in_group_id: cls?.id,
    in_slots: [{ weekday: 1, starts_at: "10:00", ends_at: "11:00" }],
  });
  check("🔴 排不了别人家的课表", !!crossSet, "居然让它过了");
  const { error: crossOpen } = await O.rpc("open_lesson", {
    in_group_id: cls?.id, in_on: iso(nextDow(3, 8)),
  });
  check("🔴 也开不了别人家的课", !!crossOpen, "居然让它过了");
  const { data: theirDue } = await O.rpc("lessons_due", { in_project_id: P });
  check("🔴 也看不到别人家排了什么", (theirDue ?? []).length === 0,
    `${(theirDue ?? []).length}`);
  const { data: theirRows } = await O.from("class_slots").select("id").eq("group_id", cls.id);
  check("🔴 直接读那张表也读不到", (theirRows ?? []).length === 0,
    `${(theirRows ?? []).length}`);

  console.log(
    fail === 0
      ? `\n判：全部过（${people.length} 个用完就删的帐号）`
      : `\n判：${pass} 过 · ${fail} 没过`);
  if (fail > 0) process.exitCode = 1;
} catch (err) {
  console.error(`\n🔴 走到一半炸了：${err?.message ?? err}`);
  process.exitCode = 1;
} finally {
  await dropThrowaways(admin, people);
}
