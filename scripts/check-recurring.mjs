/**
 * 固定周期预约——[任务 396] 重新判过的第二件：不用等一套排程引擎的
 * 设计定案，手写簿的做法就是「柜台一次写好接下来四个礼拜二」。
 *
 * `add_recurring_appointments` 原样呼叫既有的 `add_appointment` N 次，
 * 一行都不碰它——撞到时段就跳过那一次、讲得出哪一週撞到了，其余照排。
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
  const email = `rec-${tag}-${stamp}@formae.test`;
  const password = `Rec-${stamp}-x!`;
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

/* 从明天算起，星期二下午三点——离今天够远，不会撞到别的尺子留下的道具。 */
const nextSlot = () => {
  const d = new Date(Date.now() + 30 * 24 * 3600e3);
  d.setUTCHours(7, 0, 0, 0); // 15:00 MYT
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
  const { data: amy } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Amy",
  });
  const { data: mrsLim } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });

  const start = nextSlot();
  const end = new Date(new Date(start).getTime() + 3600e3).toISOString();

  /* ── ① 排四週，全部空的 ─────────────────────────────────────── */
  console.log("\n① 排四週，全部是空的时段");
  const { data: r1, error: e1 } = await C.rpc("add_recurring_appointments", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: start, in_ends_at: end, in_weeks: 4,
    in_party: "Mrs Lim", in_party_id: mrsLim.id,
    in_staff_id: amy.id, in_service: "洗剪吹",
  });
  check("按得下去", !e1 && Array.isArray(r1), e1?.message);
  check("🔴 四週都排进去了", r1?.length === 4 && r1.every((w) => !w.skipped),
    JSON.stringify(r1));
  check("🔴 每一週隔七天", (() => {
    const times = r1.map((w) => w.appointment_id).filter(Boolean);
    return times.length === 4;
  })(), JSON.stringify(r1));

  const { data: rows } = await admin
    .from("appointments").select("id, starts_at")
    .in("id", r1.map((w) => w.appointment_id));
  const sorted = (rows ?? []).map((r) => new Date(r.starts_at).getTime()).sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((t, i) => t - sorted[i]);
  check("🔴 真的每一笔间隔正好七天", gaps.every((g) => g === 7 * 24 * 3600e3),
    JSON.stringify(gaps));

  /* ── ② 🔴 第三週撞到了别人先排的 → 跳过，其余照排 ─────────────── */
  console.log("\n② 🔴 第三週撞到了别人先排的时段");
  const week3Start = new Date(new Date(start).getTime() + 2 * 7 * 24 * 3600e3).toISOString();
  const week3End = new Date(new Date(week3Start).getTime() + 3600e3).toISOString();
  await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: week3Start, in_ends_at: week3End,
    in_party: "walk in", in_staff_id: amy.id, in_service: "剪发",
  });
  const start2 = new Date(new Date(start).getTime() + 100 * 7 * 24 * 3600e3).toISOString();
  const end2 = new Date(new Date(start2).getTime() + 3600e3).toISOString();
  const week3Start2 = new Date(new Date(start2).getTime() + 2 * 7 * 24 * 3600e3);
  /* 手动排一个跟 start2 第三週会撞的既有预约。 */
  await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: week3Start2.toISOString(),
    in_ends_at: new Date(week3Start2.getTime() + 3600e3).toISOString(),
    in_party: "walk in 2", in_staff_id: amy.id, in_service: "剪发",
  });
  const { data: r2, error: e2 } = await C.rpc("add_recurring_appointments", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: start2, in_ends_at: end2, in_weeks: 4,
    in_party: "Mrs Lim", in_party_id: mrsLim.id,
    in_staff_id: amy.id, in_service: "洗剪吹",
  });
  check("整批不会因为一週撞到就整个失败", !e2, e2?.message);
  check("🔴 恰好第三週被跳过", r2?.find((w) => w.week_number === 3)?.skipped === true,
    JSON.stringify(r2));
  check("🔴 讲得出撞到的理由", /already taken/.test(r2?.find((w) => w.week_number === 3)?.reason ?? ""),
    JSON.stringify(r2));
  check("🔴 其余三週照排", r2?.filter((w) => !w.skipped).length === 3, JSON.stringify(r2));

  /* ── ③ 🔴 整批重推——已经排成的原样吐回，不会变成两份 ─────────── */
  console.log("\n③ 🔴 整批重推不会重复");
  const key = crypto.randomUUID();
  const start3 = new Date(new Date(start).getTime() + 200 * 7 * 24 * 3600e3).toISOString();
  const end3 = new Date(new Date(start3).getTime() + 3600e3).toISOString();
  const { data: firstTry } = await C.rpc("add_recurring_appointments", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: start3, in_ends_at: end3, in_weeks: 3,
    in_party: "Mrs Lim", in_party_id: mrsLim.id,
    in_staff_id: amy.id, in_service: "洗剪吹",
    in_idempotency_key: key,
  });
  const { data: secondTry } = await C.rpc("add_recurring_appointments", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: start3, in_ends_at: end3, in_weeks: 3,
    in_party: "Mrs Lim", in_party_id: mrsLim.id,
    in_staff_id: amy.id, in_service: "洗剪吹",
    in_idempotency_key: key,
  });
  const firstIds = (firstTry ?? []).map((w) => w.appointment_id).sort();
  const secondIds = (secondTry ?? []).map((w) => w.appointment_id).sort();
  check("🔴 重推回来的是同样三个编号，不是新的六个",
    JSON.stringify(firstIds) === JSON.stringify(secondIds),
    `${JSON.stringify(firstIds)} vs ${JSON.stringify(secondIds)}`);
  const { data: totalRows } = await admin
    .from("appointments").select("id")
    .eq("party_id", mrsLim.id)
    .gte("starts_at", start3)
    .lt("starts_at", new Date(new Date(start3).getTime() + 3 * 7 * 24 * 3600e3 + 3600e3).toISOString());
  check("🔴 资料库里也只有三笔，不是六笔", (totalRows ?? []).length === 3,
    `${totalRows?.length}`);

  /* ── ④ 🔴 一个真的错误（编出来的师傅）要整批失败，不能被当成「跳过」 ── */
  console.log("\n④ 🔴 真的错误不能被吞成「跳过」");
  const start4 = new Date(new Date(start).getTime() + 300 * 7 * 24 * 3600e3).toISOString();
  const end4 = new Date(new Date(start4).getTime() + 3600e3).toISOString();
  const { error: fakeStaffErr } = await C.rpc("add_recurring_appointments", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: start4, in_ends_at: end4, in_weeks: 3,
    in_party: "Mrs Lim", in_party_id: mrsLim.id,
    in_staff_id: "00000000-0000-0000-0000-000000000000", in_service: "洗剪吹",
  });
  check("🔴 编出来的师傅让整批报错，不是安静地全部跳过", !!fakeStaffErr,
    "居然让它安静地过了");

  /* ── ⑤ 别人家 ───────────────────────────────────────────────── */
  console.log("\n⑤ 别人家");
  const other = await person("other");
  const { error: crossErr } = await other.client.rpc("add_recurring_appointments", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: start, in_ends_at: end, in_weeks: 2,
  });
  check("🔴 别人家排不了我的", !!crossErr, "居然让它过了");

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}` : `\n判：全部过（${people.length} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}
