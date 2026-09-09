/**
 * 缺一堂 → 欠他一堂 → 补回来划掉 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的四条：
 *   · **用掉那一下一定讲得出补在哪一堂**（说不出补在哪，跟没记一样）
 *   · **不过期跟已经过期，画面上要分得出来**（null vs 负数）
 *   · 过期的用不了，**而它讲得出几时过的**
 *   · 同一张不给用第二次
 *
 * ⚠️ 而**缺席不会自动变成欠一堂** —— 那是那家中心的规矩，我们不发明
 * （[重点 34](../docs/founder-points.md)）。这里量的是「老师按了那一下之后」。
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
  const email = `mk-${tag}-${stamp}@formae.test`;
  const password = `Mk-${stamp}-x!`;
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
  for (const k of ["bookings", "customers", "orders", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: today } = await admin.rpc("today_myt");
  const day = (n) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const at = (n, h) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    d.setUTCHours(h - 8);
    return d.toISOString();
  };

  const teacher = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Miss Tan",
  });
  const kid = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Boy",
  });
  const outsider = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Somebody Else",
  });
  const grp = await say(C, "add_class_group", {
    in_project_id: P, in_module_key: "bookings",
    in_name: "中四数学 · 星期二 5pm", in_staff_id: teacher.id,
  });
  await say(C, "enrol_in_class", { in_group_id: grp.id, in_party_id: kid.id });

  const missed = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(-7, 17), in_ends_at: at(-7, 19),
    in_staff_id: teacher.id, in_group_id: grp.id, in_service: "Add Maths",
  });

  console.log("\n① 一开始一个人都不欠");
  check("干净的班，名单是空的",
    (await say(C, "lessons_owed", { in_project_id: P })).length === 0,
    JSON.stringify(await say(C, "lessons_owed", { in_project_id: P })));

  console.log("\n② 老师按一下「欠他一堂」");
  const owed = await say(C, "owe_lesson", {
    in_group_id: grp.id, in_party_id: kid.id,
    in_reason: "星期二请假", in_from_lesson_id: missed,
  });
  check("记得进去", !!owed?.id, "记不进去");
  const list = await say(C, "lessons_owed", { in_project_id: P });
  check("名单上一个", list.length === 1, String(list.length));
  check("讲得出是谁 · 哪一班 · 为什么",
    list[0]?.student === "Ah Boy" && /中四数学/.test(String(list[0]?.class_name))
      && list[0]?.reason === "星期二请假",
    JSON.stringify(list[0]));
  check("🔴 没讲有效期 → 不过期（days_left 是 null，不是 0）",
    list[0]?.days_left === null && list[0]?.expires_on === null,
    JSON.stringify([list[0]?.expires_on, list[0]?.days_left]));

  console.log("\n③ 🔴 补回来了，而且讲得出补在哪一堂");
  const makeup = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(2, 15), in_ends_at: at(2, 17),
    in_staff_id: teacher.id, in_group_id: grp.id, in_service: "Add Maths（补）",
  });
  const done = await say(C, "use_lesson_credit", {
    in_id: owed.id, in_lesson_id: makeup,
  });
  check("划掉了", !!done?.used_on, String(done?.used_on));
  check("🔴 而且记得住补在哪一堂", done?.used_lesson_id === makeup,
    String(done?.used_lesson_id));
  check("名单上没有了", (await say(C, "lessons_owed", { in_project_id: P })).length === 0,
    "还在");
  check("🔴 同一张不给用第二次",
    (await refused(C, "use_lesson_credit", { in_id: owed.id, in_lesson_id: makeup }))
      .includes("already made up"), "居然让它过了");

  console.log("\n④ 🔴 会过期的那一种");
  const soon = await say(C, "owe_lesson", {
    in_group_id: grp.id, in_party_id: kid.id,
    in_reason: "停电", in_expires_on: day(30),
  });
  const withEnd = await say(C, "lessons_owed", { in_project_id: P });
  check("🔴 讲得出还剩几天（30）", withEnd[0]?.days_left === 30,
    String(withEnd[0]?.days_left));

  /* 一张已经过期的 —— 直接把日子推到昨天，那是唯一造得出来的方法。 */
  const stale = await say(C, "owe_lesson", {
    in_group_id: grp.id, in_party_id: kid.id, in_reason: "旧的",
  });
  await admin.from("lesson_credits")
    .update({ owed_on: day(-40), expires_on: day(-1) }).eq("id", stale.id);
  const now = await say(C, "lessons_owed", { in_project_id: P });
  const gone = now.find((r) => r.id === stale.id);
  check(
    "🔴 已经过期的读回来是**负数**，不是 0 —— 画面上要分得出「快过期」跟「过了」",
    Number(gone?.days_left) < 0,
    String(gone?.days_left),
  );
  const tooLate = await refused(C, "use_lesson_credit", {
    in_id: stale.id, in_lesson_id: makeup,
  });
  check("🔴 过期的用不了", tooLate.includes("expired"), tooLate || "居然让它过了");
  check("🔴 而且它讲得出几时过的（不是光秃秃一句用不了）",
    tooLate.includes(day(-1)), tooLate);

  console.log("\n⑤ 拒绝的每一种");
  check("🔴 不在这个班的学生欠不了",
    (await refused(C, "owe_lesson", { in_group_id: grp.id, in_party_id: outsider.id }))
      .includes("not in this class"), "居然让它过了");
  check("有效期在欠的日子之前 → 挡下来",
    !!(await refused(C, "owe_lesson", {
      in_group_id: grp.id, in_party_id: kid.id, in_expires_on: day(-5),
    })), "居然让它过了");
  check("补在一堂不存在的课上 → 挡下来",
    (await refused(C, "use_lesson_credit", {
      in_id: soon.id, in_lesson_id: grp.id,
    })).includes("no such lesson"), "居然让它过了");

  console.log("\n⑥ 🔴 老师做得了这两下（她点完名当场按）");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check("🔴 老师欠得了一堂",
    (await refused(crew.client, "owe_lesson", {
      in_group_id: grp.id, in_party_id: kid.id, in_reason: "她按的",
    })) === "", "它把老师挡下来了");
  check("🔴 老师也读得到谁还欠着课",
    (await say(crew.client, "lessons_owed", { in_project_id: P })).length > 0,
    "她读不到");

  console.log("\n⑦ 别人家");
  const other = await person("other");
  check("🔴 别人家欠不了我的学生",
    !!(await refused(other.client, "owe_lesson", {
      in_group_id: grp.id, in_party_id: kid.id,
    })), "他欠了");
  check("🔴 别人家读不到我的名单",
    (await say(other.client, "lessons_owed", { in_project_id: P })).length === 0,
    "他读到了");
  check("🔴 别人家划不掉我的",
    !!(await refused(other.client, "use_lesson_credit", {
      in_id: soon.id, in_lesson_id: makeup,
    })), "他划掉了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
