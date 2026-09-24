/**
 * 员工可以记「客人付给我们的钱」—— 而且只有那一件（任务 411，他拍板
 * `肯定要放宽给员工`，2026-09-24）。
 *
 * ── 这一把尺守的是三条线，不是一条 ───────────────────────────────────────
 *
 *   ① 放宽了：柜台（员工登入）按「结帐」记得下一笔客人付的钱
 *   ② 没有放过头：付出去的钱（开销 · 付供应商 · 佣金）仍然只有老板，
 *      而且员工试了之后**什么都没留下**（那一笔跟着回滚）
 *   ③ 没有跨租户：别家帐号、离职的员工，记不进这一家
 *
 * 🔴 第三条最要紧。「放宽给员工」写错一个字，就是「放宽给任何登入的人」，
 * 而那是一个钱的洞，画面上完全看不出来 —— 所以这里不只测员工，
 * 还测陌生人跟离职员工。
 *
 * ⚠️ 每一条都要**看过它红**才算数（重点 31）：改之前对着旧的只认老板的闸门跑，
 * ① 红了 4 条（②③ 照样绿——旧闸门本来就挡得更严）；20260924040000 故意放宽
 * 放过头，②③ 红了 13 条（① 照样绿）。放回来之后全绿。见任务档 411。
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

const stamp = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `ledst-${tag}-${stamp}@formae.test`;
  const password = `Lst-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  people.push(data.user.id);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  return { id: data.user.id, email, client };
}
dropThrowawayOnExit(admin, () => people);

/** 这一个记号的那几笔，在帐上真的有几行（admin 读，不经过 RLS）。 */
async function rowsWith(P, marker) {
  const { data } = await admin
    .from("ledger_entries")
    .select("id, direction, module_key, recorded_by, amount_cents")
    .eq("project_id", P)
    .eq("note", marker);
  return data ?? [];
}

try {
  const boss = await person("boss");
  const staff = await person("staff");
  const stranger = await person("stranger");
  const gone = await person("gone");

  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const B = boss.client;

  for (const who of [staff, gone]) {
    const { error } = await B.rpc("add_project_member", { in_email: who.email });
    if (error) throw new Error(`add_project_member(${who.email}): ${error.message}`);
  }
  // 离职：那一行留着，但不在职了 —— works_here 靠的就是这一栏。
  const { error: offErr } = await admin
    .from("project_members").update({ active: false })
    .eq("project_id", P).eq("user_id", gone.id);
  if (offErr) throw new Error(`deactivate: ${offErr.message}`);

  const pay = (client, marker, extra = {}) =>
    client.rpc("add_ledger_entry", {
      in_project_id: P,
      in_module_key: "payments",
      in_direction: "in",
      in_amount_cents: 12_345,
      in_party: "Walk-in",
      in_category: "service",
      in_method: "Cash Drawer",
      in_note: marker,
      ...extra,
    });

  /* ── ① 放宽了 ──────────────────────────────────────────────────────── */
  console.log("\n① 柜台记得下一笔客人付的钱");
  const m0 = `boss-${stamp}`;
  const r0 = await pay(B, m0);
  check("老板本人照旧记得下（基线）", !r0.error, r0.error?.message);

  const m1 = `staff-in-${stamp}`;
  const r1 = await pay(staff.client, m1);
  check("🔴 员工记得下一笔客人付的钱", !r1.error, r1.error?.message);
  const rows1 = await rowsWith(P, m1);
  check("帐上真的多了那一笔，方向是进来", rows1.length === 1 && rows1[0].direction === "in",
    JSON.stringify(rows1));
  check("🔴 那一笔记的是**员工自己**（谁收的钱查得到），不是老板",
    rows1[0]?.recorded_by === staff.id, `${rows1[0]?.recorded_by} vs ${staff.id}`);

  const key = crypto.randomUUID();
  const m1b = `staff-in-key-${stamp}`;
  const a = await pay(staff.client, m1b, { in_idempotency_key: key });
  const b = await pay(staff.client, m1b, { in_idempotency_key: key });
  check("员工按两下同一把钥匙，只记一笔（防重复没有被这次放宽弄丢）",
    !a.error && !b.error && a.data?.id === b.data?.id && (await rowsWith(P, m1b)).length === 1,
    `${a.error?.message ?? ""} ${b.error?.message ?? ""} ${a.data?.id} vs ${b.data?.id}`);

  /* ── ② 没有放过头：付出去的钱仍然只有老板 ─────────────────────────── */
  console.log("\n② 付出去的钱仍然只有老板，而且员工试了什么都没留下");
  const m2 = `staff-out-${stamp}`;
  const r2 = await staff.client.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 5_000, in_party: "Supplier", in_note: m2,
  });
  check("🔴 员工记不了一笔开销（明写方向 out）", !!r2.error, "居然成功了");
  check("🔴 而且那一笔跟着回滚，什么都没留下", (await rowsWith(P, m2)).length === 0,
    JSON.stringify(await rowsWith(P, m2)));

  const m3 = `staff-out-nodir-${stamp}`;
  const r3 = await staff.client.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses",
    in_amount_cents: 5_000, in_party: "Supplier", in_note: m3,
  });
  check("🔴 员工不写方向也没办法从开销那一页绕进去（方向是核心补的 out）", !!r3.error, "居然成功了");
  check("…而且什么都没留下", (await rowsWith(P, m3)).length === 0, "");

  const m4 = `staff-commission-${stamp}`;
  const r4 = await staff.client.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "commission",
    in_amount_cents: 5_000, in_party: "Amy", in_note: m4,
  });
  check("🔴 员工记不了一笔佣金", !!r4.error, "居然成功了");
  check("…而且什么都没留下", (await rowsWith(P, m4)).length === 0, "");

  const m5 = `staff-in-on-expenses-${stamp}`;
  const r5 = await staff.client.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_direction: "in",
    in_amount_cents: 5_000, in_party: "Supplier", in_note: m5,
  });
  check("员工只能记「客人付的钱」（payments 那一页）——别的页就算方向是进来也不行",
    !!r5.error, "居然成功了");
  check("…而且什么都没留下", (await rowsWith(P, m5)).length === 0, "");

  // 老板先记一笔开销带一把钥匙，员工拿同一把钥匙去重播 —— 不能因为「重播」
  // 而把老板那一笔（付出去的钱）原样读回去。
  const kOut = crypto.randomUUID();
  const m6 = `boss-out-${stamp}`;
  const rBossOut = await B.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 7_777, in_party: "Supplier", in_note: m6, in_idempotency_key: kOut,
  });
  check("老板照旧记得下一笔开销（基线）", !rBossOut.error, rBossOut.error?.message);
  const rReplay = await staff.client.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 7_777, in_party: "Supplier", in_note: m6, in_idempotency_key: kOut,
  });
  check("🔴 员工拿老板那笔开销的钥匙去重播，读不回那一笔",
    !!rReplay.error && !rReplay.data, `${JSON.stringify(rReplay.data)}`);

  /* ── ③ 没有跨租户 ──────────────────────────────────────────────────── */
  console.log("\n③ 别家帐号 · 离职员工，记不进这一家");
  const m7 = `stranger-${stamp}`;
  const r7 = await pay(stranger.client, m7);
  check("🔴 陌生人（别家帐号）记不进别人的专案", !!r7.error && /not your project/i.test(r7.error.message),
    r7.error?.message ?? "居然成功了");
  check("…而且什么都没留下", (await rowsWith(P, m7)).length === 0, "");

  const m8 = `gone-${stamp}`;
  const r8 = await pay(gone.client, m8);
  check("🔴 离职的员工（member 那一行在、但不在职）记不进来",
    !!r8.error && /not your project/i.test(r8.error.message), r8.error?.message ?? "居然成功了");
  check("…而且什么都没留下", (await rowsWith(P, m8)).length === 0, "");

  /* ── ④ 撤销一笔钱照旧只有老板（这一支没有碰它） ───────────────────── */
  console.log("\n④ 撤销一笔钱照旧只有老板");
  // 拿老板记的那一笔来测（不依赖员工那一笔存在 —— 放宽之前它不存在）。
  const target = r0.data?.id;
  const rRev = await staff.client.rpc("reverse_ledger_entry", {
    in_entry_id: target, in_note: "staff tries",
  });
  check("员工撤销不了一笔钱（要请老板）", !!target && !!rRev.error, "居然成功了");
  const rRevBoss = await B.rpc("reverse_ledger_entry", {
    in_entry_id: target, in_note: "boss reverses",
  });
  check("老板撤销得了（基线）", !!target && !rRevBoss.error, rRevBoss.error?.message);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号没删掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${bad.length ? `🔴 ${bad.length} 条没过` : "全过"}`);
if (bad.length) {
  console.log("🔴 " + bad.join("\n🔴 "));
  process.exit(1);
}
