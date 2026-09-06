/**
 * 他自己那张后台 —— 用真的登入身分打一次。
 *
 * 🔴 写这一支的时候才发现：**console 那七八支从来没有被任何一把尺打过。**
 *   而它是[老板拿来决定下一件做什么的那一张](../docs/founder-tasks.md#43) ——
 *   一个读错的仪器比没有仪器糟（[任务 129](../docs/founder-tasks.md#129)
 *   那次它回报他有 45 个客户，而他有 0 个）。
 *
 * 这一轮加的两栏要答的是[任务 133](../docs/founder-tasks.md#133) 那一句:
 *   「续约率不是一个指标，它就是这盘生意本身」——
 *   而续约那一天太晚了，能提早看的是**他还在不在开**。
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
async function person(tag, { signIn = true } = {}) {
  const email = `con-${tag}-${stamp}@formae.test`;
  const password = `Con-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  people.push(data.user.id);
  if (!signIn) return { id: data.user.id, email, client: null };
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  return { id: data.user.id, email, client };
}
dropThrowawayOnExit(admin, () => people[people.length - 1]);

const projectOf = async (id) => {
  const { data } = await admin
    .from("projects").select("id").eq("account_id", id).single();
  return data?.id;
};

try {
  /* 一个他自己（founder），一个真的客户，一个从来没有登入过的客户。 */
  const founder = await person("founder");
  const { error: roleErr } = await admin
    .from("accounts").update({ role: "founder" }).eq("id", founder.id);
  if (roleErr) throw new Error(`role: ${roleErr.message}`);
  const F = founder.client;

  const live = await person("live");
  const P = await projectOf(live.id);
  await live.client.rpc("set_project_style", { new_style: "ledger" });
  await admin.from("projects")
    .update({ business_name: `Hup Seng ${stamp}` }).eq("id", P);

  /* 🔴 一个从来没有开过的客户 —— 那正是这两栏要照出来的那一个。
     它不登入，所以 auth 那一栏是空的，而函式退回「从开户到今天」。 */
  const quiet = await person("quiet", { signIn: false });
  const Q = await projectOf(quiet.id);
  const long_ago = new Date(Date.now() - 60 * 86400e3).toISOString();
  await admin.from("projects").update({ created_at: long_ago }).eq("id", Q);

  /* ── ① 只有他自己打得到 ─────────────────────────────────────── */
  console.log("\n① 只有他自己打得到");
  const { data: mine, error: fe } = await F.rpc("console_customers");
  check("控制组：他自己打得到", !fe && (mine ?? []).length > 0,
    fe?.message ?? `${mine?.length} 行`);
  const { error: custErr } = await live.client.rpc("console_customers");
  check("🔴 客户打不到那张后台", !!custErr, "居然让它过了");
  const { error: quietErr } = await F.rpc("console_quiet_customers", {
    in_days: 400,
  });
  check("天数超出范围 → 挡", !!quietErr, "居然让它过了");

  /* ── ② 🔴 新的两栏 ──────────────────────────────────────────── */
  console.log("\n② 🔴 新的两栏");
  const row = (mine ?? []).find((r) => r.project_id === P);
  check("找得到那一家", !!row, `${mine?.length} 行里没有 ${P}`);
  check("🔴 他刚登入过 → 最后一次登入有值", !!row?.last_seen_at,
    `${row?.last_seen_at}`);
  check("这个月的询价先是 0", Number(row?.enquiries_this_month) === 0,
    `${row?.enquiries_this_month}`);

  /* 原本那十七栏一栏都没有动 —— 只加不改。 */
  for (const col of ["email", "business_name", "paid", "stage", "page_count",
                     "created_at", "updated_at"]) {
    check(`原本的「${col}」还在`, col in (row ?? {}), Object.keys(row ?? {}).join(","));
  }

  /* 官网来一笔询价 —— 那是最深那根柱子上唯一看得到的讯号。 */
  const { error: enqErr } = await admin.from("site_enquiries").insert({
    project_id: P, name: "Someone", contact: "017-000 0000",
    answers: { message: "How much for a bathroom?" },
  });
  check("道具：那一笔询价真的进去了", !enqErr, enqErr?.message);
  const { data: mine2 } = await F.rpc("console_customers");
  const row2 = (mine2 ?? []).find((r) => r.project_id === P);
  check("🔴 这个月进来一笔，那一栏就变 1",
    Number(row2?.enquiries_this_month) === 1, `${row2?.enquiries_this_month}`);

  /* 上个月那一笔不算这个月的。 */
  const { error: oldErr } = await admin.from("site_enquiries").insert({
    project_id: P, name: "Last month", contact: "017-111 1111",
    answers: { message: "old" },
    created_at: new Date(Date.now() - 45 * 86400e3).toISOString(),
  });
  check("道具：上个月那一笔也进去了", !oldErr, oldErr?.message);
  const { data: mine3 } = await F.rpc("console_customers");
  const row3 = (mine3 ?? []).find((r) => r.project_id === P);
  check("🔴 上个月那一笔不算进这个月", Number(row3?.enquiries_this_month) === 1,
    `${row3?.enquiries_this_month}`);

  /* ── ③ 🔴 谁超过三十天没有开过 ─────────────────────────────── */
  console.log("\n③ 🔴 谁超过三十天没有开过");
  const { data: quietList, error: qe } = await F.rpc("console_quiet_customers", {
    in_days: 30,
  });
  check("问得到", !qe && Array.isArray(quietList), qe?.message);
  const q = (quietList ?? []).find((r) => r.project_id === Q);
  check("🔴 从来没有开过的那一个在名单上", !!q,
    `${quietList?.length} 行里没有 ${Q}`);
  check("🔴 而且算得出他多久没开（六十天）",
    Number(q?.days_quiet) >= 59 && Number(q?.days_quiet) <= 61,
    `${q?.days_quiet}`);
  check("🔴 刚登入过的那一个不在名单上",
    !(quietList ?? []).some((r) => r.project_id === P),
    "他居然在名单上");

  const { data: strict } = await F.rpc("console_quiet_customers", { in_days: 90 });
  check("门槛拉到九十天，六十天那一个就不在了",
    !(strict ?? []).some((r) => r.project_id === Q), "他居然还在");

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
