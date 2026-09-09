/**
 * 一间补习中心，从开一个班到「今天谁没来」—— 走一次，**数他要动手几次**。
 *
 * 跟 `walk:reno` · `walk:salon` · `walk:workshop` · `walk:hardware`
 * 同一把尺（[任务 231](../docs/founder-tasks.md#231)）：
 *   **每一次老板非自己按不可的呼叫算一次动手**，
 *   系统自己接下去的（触发器 · 顺手做掉的第二件）**不算**。
 *   它不判对错，只印读数 ——「几次算多」是他的判断。
 *
 * 🔴 为什么走这一条：他 2026-09-06 转来的那份逐行业判决，
 *   补习那一格写的是 **「一个老师十个学生那种班 —— 预约今天是一对一的」**。
 *   那一件 [任务 223](../docs/founder-tasks.md#223) 建好了，
 *   而**从来没有被一次真的流程碰过**。
 *
 * ⚠️ 名字全部是编的。
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
const notes = [];
const chain = [];
let acts = 0;

async function person(tag) {
  const email = `tuition-${tag}-${Date.now()}@formae.test`;
  const password = `Tuition-${Date.now()}-x!`;
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

async function act(C, what, fn, args) {
  acts += 1;
  const { data, error } = await C.rpc(fn, args);
  if (error) {
    notes.push(`🔴 ${what}：${error.message}`);
    return null;
  }
  return data;
}
const node = (name, hands, ok, detail) => chain.push({ name, hands, ok, detail });

/* 明天的某一个钟头，用马来西亚的墙上时钟。 */
/* 几天前的某一个钟头。 */
const past_slot = (back, hour) => {
  const d = new Date(Date.now() + 8 * 3600e3);
  d.setUTCDate(d.getUTCDate() - back);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    hour - 8, 0, 0)).toISOString();
};
/* 几天前那一天。 */
const day = (back) => {
  const d = new Date(Date.now() + 8 * 3600e3);
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};
const slot = (hour) => {
  const d = new Date(Date.now() + 8 * 3600e3);
  d.setUTCDate(d.getUTCDate() + 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    hour - 8, 0, 0)).toISOString();
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "blueprint" });
  await admin.from("projects")
    .update({ business_name: "Bright Minds Tuition" }).eq("id", P);
  /* 🔴 开哪几页**不是我写在这里的** —— 是从 `module-catalog.ts` 那一份
     教育的开局读出来的。手抄一份在这里，它明天就跟产品分家，
     而这一支的整个用处就是量**开箱那一份**（这个仓库栽在
     「第二份手写清单」上至少八次）。 */
  const catalogue = readFileSync(
    new URL("../lib/portal/module-catalog.ts", import.meta.url), "utf8");
  const line = catalogue.match(/\n\s*education:\s*\[([^\]]+)\]/);
  if (!line) throw new Error("读不到教育那一组的开局 —— 拒绝拿一份猜的名单去量");
  const defaults = [...line[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const k of defaults) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  /* 老师那一页不在开局里，而一间补习中心一定有老师。 */
  await C.rpc("add_project_page", { requested_key: "staff", new_title: "staff" });
  const started = acts;

  /* ── ① 开一个班 ───────────────────────────────────────────── */
  let n = acts;
  const teacher = await act(C, "建老师", "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Ms Lim",
  });
  const cls = await act(C, "开一个班", "add_class_group", {
    in_project_id: P, in_module_key: "bookings", in_name: "Form 4 Add Maths",
    in_staff_id: teacher?.id, in_capacity: 10,
  });
  node("开一个班（老师 · 上限十个）", acts - n, !!cls?.id,
    `${acts - n} 次；而这两次一辈子只做一次`);

  /* ── ② 收十个学生 ─────────────────────────────────────────── */
  n = acts;
  const kids = [];
  for (const name of ["Wei Jie", "Aisyah", "Kumar", "Mei Ling", "Haziq",
    "Jia Xin", "Ravi", "Nurul", "Zhen Yu", "Farah"]) {
    const kid = await act(C, `建学生 ${name}`, "add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: name,
    });
    await act(C, `收 ${name} 进班`, "enrol_in_class", {
      in_group_id: cls?.id, in_party_id: kid?.id,
    });
    kids.push(kid);
  }
  const roster = await act(C, "看名册", "class_roster", { in_group_id: cls?.id });
  node("收十个学生进班", acts - n, (roster ?? []).length === 10,
    `${acts - n} 次（一个学生两次）；名册上 ${(roster ?? []).length} 个 ——`
    + " **而这也是一辈子只做一次**");

  /* ── ③ 🔴 一堂课是一行，不是十行 ──────────────────────────── */
  n = acts;
  const lesson = await act(C, "排明天那一堂", "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: slot(16), in_ends_at: slot(18),
    in_staff_id: teacher?.id, in_group_id: cls?.id,
    in_service: "Add Maths",
  });
  const { count: lessonRows } = await C.from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P);
  node("🔴 排明天那一堂（一个老师十个学生）", acts - n,
    !!lesson && lessonRows === 1,
    `${acts - n} 次；十个学生**一行**预约（表上 ${lessonRows} 行）——`
    + " 而他一个学生的名字都不用打");

  /* ── ④ 🔴 同一个老师同一个钟头再排一堂 → 挡 ──────────────── */
  n = acts;
  const { error: clash } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: slot(17), in_ends_at: slot(19),
    in_staff_id: teacher?.id, in_service: "Physics",
  });
  acts += 1;
  node("🔴 同一个老师同一个钟头再排一堂 → 挡", acts - n, !!clash,
    clash ? `${acts - n} 次；那条不准撞的规矩一个字都没有动过`
      : "居然让它过了");

  /* ── ⑤ 点名 ───────────────────────────────────────────────── */
  n = acts;
  for (const kid of kids.slice(0, 8)) {
    await act(C, "点名 · 来了", "mark_attendance", {
      in_appointment_id: lesson, in_party_id: kid?.id, in_status: "came",
    });
  }
  await act(C, "点名 · 没来", "mark_attendance", {
    in_appointment_id: lesson, in_party_id: kids[8]?.id, in_status: "no_show",
  });
  const sheet = await act(C, "看点名表", "class_attendance_of", {
    in_appointment_id: lesson,
  });
  const blank = (sheet ?? []).filter((r) => !r.status).length;
  node("点名（八个来了 · 一个没来 · 一个还没点）", acts - n,
    (sheet ?? []).length === 10 && blank === 1,
    `${acts - n} 次；🔴 **还没点的那一个是空的，不是「没来」** —— 两句话不一样`);

  /* ── ⑥ 🔴 开箱就开得了一张学费单 · 而一个班一次开完 ──────────
     2026-09-06 之前开不了：教育那一组的开局是
     总览 · 客户 · 预约 · 收款 · 官网 —— **一页会开单的都没有**，
     而「这个月谁还没交」是从走单那张表减掉分摊算出来的，
     所以它不是难答，是**永远答不出来**。
     这一支走出来之后 `orders` 进了那一组（[任务 239](../docs/founder-tasks.md#239)）。 */
  n = acts;
  const billPage = defaults.find((k) => ["orders", "quotations", "projects", "tasks"]
    .includes(k));
  /* 🔴 **一次开十张**（`bill_class`，20260909170000）。
     ⚠️ 这一节 2026-09-09 之前开的是**一个学生**，读数是「3 次」——
     而那个读数看不见另外九个学生的那九次。
     一张一张开是 **10 次**，而十次里每一次他打的字一模一样
     （[重点 29](../docs/founder-points.md)：那不是十个输入，那是一次抄写）。 */
  const batch = await act(C, "一次开这个月全班的学费", "bill_class", {
    in_group_id: cls?.id,
    in_module_key: billPage ?? "orders",
    in_amount_cents: 18_000,
    in_title: "Sept fees · Add Maths",
  });
  const made = (batch ?? [])[0];
  const due0 = await act(C, "问这个班谁还没交", "class_fees_due", {
    in_group_id: cls?.id,
  });
  const bill = (due0 ?? []).find((r) => r.party_id === kids[0]?.id);
  await act(C, "收其中一个的学费", "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 18_000, in_party: "Wei Jie", in_party_id: kids[0]?.id,
    in_against_id: bill?.record_id,
  });
  const owed = await act(C, "问谁欠学费", "party_debts", { in_project_id: P });
  const stillOwes = (owed ?? []).some((r) => r.party_id === kids[0]?.id);
  node("🔴 一次开全班的学费单 · 收一个 · 谁还没交", acts - n,
    made?.made === 10 && (due0 ?? []).length === 10
      && !!bill?.record_id && !stillOwes,
    `${acts - n} 次（**开单 1 次 = 十个学生** · 问 · 收 · 再问）；`
    + `开在「${billPage}」上，${made?.made ?? 0} 张 · `
    + `RM ${((made?.total_cents ?? 0) / 100).toFixed(0)}，`
    + `${bill?.doc_no ?? "开不了"} 收齐了，这个班还剩 ${(due0 ?? []).length - 1} 个没交。`
    + "🔴 一张一张开是 **10 次**");

  /* ── ⑦ 🔴 系统讲得出补习自己那两句吗 ──────────────────────────
     ⚠️ 这两句都要**真的摆一次道具再问**，不是读代码推的。
     我 2026-09-06 跟他讲「两句都没有人算」—— **那句话错一半**，
     而拿走一趟量出来之前我不知道。 */
  n = acts;
  const late = await act(C, "开一张过了日子的学费单", "add_pipeline_record", {
    in_project_id: P, in_module_key: billPage ?? "orders",
    in_title: "Aug fees · Add Maths", in_party: "Aisyah",
    in_party_id: kids[1]?.id, in_amount_cents: 18_000,
    in_due_on: day(20),
  });
  /* 两堂**已经上过而且点过名**的课，Farah 两堂都没来。
     ⚠️ 上一堂在明天，而讯号只看已经过去的 —— 所以要另外摆两堂。 */
  const past = [];
  for (const back of [14, 7]) {
    const id = await act(C, "补一堂上过的课", "add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: past_slot(back, 16), in_ends_at: past_slot(back, 18),
      in_staff_id: teacher?.id, in_group_id: cls?.id, in_service: "Add Maths",
    });
    past.push(id);
    await act(C, "点名 · 来了", "mark_attendance", {
      in_appointment_id: id, in_party_id: kids[0]?.id, in_status: "came",
    });
    await act(C, "点名 · 没来", "mark_attendance", {
      in_appointment_id: id, in_party_id: kids[9]?.id, in_status: "no_show",
    });
  }
  const sig = await act(C, "问系统有什么要讲", "nudges_due", { in_project_id: P });
  const feeLate = (sig ?? []).find(
    (r) => r.kind === "payment_overdue" && r.record_id === late?.id);
  const drifting = (sig ?? []).find(
    (r) => r.kind === "absent_twice" && r.title === "Form 4 Add Maths");
  node("🔴 系统讲得出「学费还没交」跟「连着两堂没来」", acts - n,
    !!feeLate && !!drifting,
    `${acts - n} 次（全部是摆道具）；`
    + `学费${feeLate ? `：${feeLate.party} 欠 RM ${(feeLate.amount_cents / 100).toFixed(0)}`
      + `、迟了 ${feeLate.days_late} 天` : "**算不出来**"}；`
    + `${drifting ? `连着没来：${drifting.party}（${drifting.title}）` : "**算不出来**"}`);

  /* ── ⑧ 一堂没来不讲 —— 那是生病 ───────────────────────────── */
  await C.rpc("mark_attendance", {
    in_appointment_id: past[1], in_party_id: kids[9]?.id, in_status: "came",
  });
  const { data: sig2 } = await C.rpc("nudges_due", { in_project_id: P });
  const still = (sig2 ?? []).some((r) => r.kind === "absent_twice");
  node("🔴 上一堂改成来了 → 那一句自己不见了", 0, !still,
    still ? "还在讲" : "他不用动手；一堂没来是生病，不是要退学");

  /* ── 读数 ─────────────────────────────────────────────────── */
  console.log("\n一间补习中心，从开一个班到「今天谁没来」\n");
  let broken = 0;
  for (const c of chain) {
    console.log(`  ${c.ok ? "  " : "🔴"} ${String(c.hands).padStart(2)} 次  ${c.name}`);
    console.log(`         ${c.detail}`);
    if (!c.ok) broken += 1;
  }
  const hands = acts - started;
  const median = [...chain.map((c) => c.hands)].sort((a, b) => a - b)[
    Math.floor(chain.length / 2)];
  console.log(`\n  一共动手 ${hands} 次 · ${chain.length} 节 · ${broken} 节断掉`);
  console.log(`  每一节中位数 ${median} 次`);
  if (notes.length) {
    console.log("\n  路上讲过的话：");
    for (const s of notes) console.log(`    ${s}`);
  }
} catch (err) {
  console.error(`\n🔴 走到一半炸了：${err?.message ?? err}`);
  for (const s of notes) console.error(`    ${s}`);
} finally {
  await dropThrowaways(admin, people);
}
