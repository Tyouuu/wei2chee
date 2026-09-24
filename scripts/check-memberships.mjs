/**
 * 会员月费——[任务 396] 重新判过的最后一件：地基先搭一半，先记事实，
 * 算法晚一点。真正要等的只有「自动扣款」（要串收款闸道，闸道本身
 * 还没有）；「谁是会员、月费多少、下次该缴哪天」这个格子今天就能建，
 * 柜台每个月手动收一次，日期自己往后推一个月——跟储值卡同一条做法。
 *
 * 🔴 会员月费的钱只有老板碰(2026-09-24 补:任务 411 之后 `add_ledger_entry`
 * 员工也记得了「客人付的钱」,所以挡员工的是这两支自己的 `sees_money`,
 * 不再是 `add_ledger_entry` 更严的旧闸门):
 * 收月费、开会员这两支写钱的都是 `sees_money`。
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
  const email = `mem-${tag}-${stamp}@formae.test`;
  const password = `Mem-${stamp}-x!`;
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

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  await C.rpc("add_project_page", { requested_key: "customers", new_title: "customers" });

  const { data: mrsLim } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });

  /* ── ① 开一个会员计划 ────────────────────────────────────────── */
  console.log("\n① 开一个会员计划");
  const { data: m1, error: e1 } = await C.rpc("add_membership", {
    in_project_id: P, in_party_id: mrsLim.id,
    in_plan_name: "VIP 月卡", in_monthly_fee_cents: 15_000,
  });
  check("按得下去", !e1 && !!m1?.id, e1?.message);
  check("🔴 一开始该缴的那天就是今天", m1?.next_due_on === m1?.started_on,
    `${m1?.next_due_on} vs ${m1?.started_on}`);

  /* ── ② 收第一期，日期自己往后推一个月 ───────────────────────── */
  console.log("\n② 收第一期");
  const before = m1.next_due_on;
  const { data: p1, error: pe1 } = await C.rpc("collect_membership_fee", {
    in_membership_id: m1.id,
  });
  check("收得到", !pe1 && !!p1?.id, pe1?.message);
  check("🔴 金额是月费那个数字", Number(p1?.amount_cents) === 15_000, `${p1?.amount_cents}`);

  const { data: afterList } = await C.rpc("memberships_of", { in_project_id: P });
  const row1 = afterList?.find((r) => r.id === m1.id);
  const expectNext = new Date(before);
  expectNext.setUTCMonth(expectNext.getUTCMonth() + 1);
  check("🔴 下次该缴的日期往后推了正好一个月",
    row1?.next_due_on === expectNext.toISOString().slice(0, 10),
    `${row1?.next_due_on} vs ${expectNext.toISOString().slice(0, 10)}`);

  /* ── ③ 🔴 真的进了他的帐——不是只有一张会员纪录 ─────────────── */
  console.log("\n③ 🔴 真的是一笔收款，不是只记了一个事实");
  const { data: entries } = await admin
    .from("ledger_entries").select("amount_cents, direction, category")
    .eq("id", p1.ledger_entry_id);
  check("🔴 帐上真的多了一笔收款", entries?.[0]?.amount_cents === 15_000 &&
    entries?.[0]?.direction === "in", JSON.stringify(entries));

  /* ── ④ 🔴 按第二次同一把钥匙——不会再收一次、也不会再推一次日期 ── */
  console.log("\n④ 🔴 同一把钥匙按两次不会重复收");
  const key = crypto.randomUUID();
  const { data: r2a } = await C.rpc("collect_membership_fee", {
    in_membership_id: m1.id, in_idempotency_key: key,
  });
  const { data: r2b } = await C.rpc("collect_membership_fee", {
    in_membership_id: m1.id, in_idempotency_key: key,
  });
  check("🔴 两次拿到同一笔记录", r2a?.id === r2b?.id, `${r2a?.id} vs ${r2b?.id}`);
  const { data: listAfter2 } = await C.rpc("memberships_of", { in_project_id: P });
  const row2 = listAfter2?.find((r) => r.id === m1.id);
  const expectNext2 = new Date(expectNext);
  expectNext2.setUTCMonth(expectNext2.getUTCMonth() + 1);
  check("🔴 日期只往后推了一次，不是两次",
    row2?.next_due_on === expectNext2.toISOString().slice(0, 10),
    `${row2?.next_due_on} vs ${expectNext2.toISOString().slice(0, 10)}`);

  /* ── ⑤ 收得出过期没缴的名单 ──────────────────────────────────── */
  console.log("\n⑤ 讲得出谁逾期了");
  check("🔴 才刚收过的这一个不是逾期", row2?.overdue === false, `${row2?.overdue}`);

  /* ── ⑥ 🔴 取消会员——收起来，不是删掉 ──────────────────────────── */
  console.log("\n⑥ 🔴 取消会员是收起来");
  const { data: archived } = await C.rpc("set_membership_archived", {
    in_id: m1.id, in_archived: true,
  });
  check("收起来了", !!archived?.archived_at, "没有设 archived_at");
  const { error: collectAfterCancel } = await C.rpc("collect_membership_fee", {
    in_membership_id: m1.id,
  });
  check("🔴 收起来之后收不了钱", !!collectAfterCancel, "居然让它过了");
  const { data: paymentsStillThere } = await admin
    .from("membership_payments").select("id").eq("membership_id", m1.id);
  check("🔴 但是之前收过的那两笔纪录还在——不是删掉", (paymentsStillThere ?? []).length >= 1,
    `${paymentsStillThere?.length}`);

  /* ── ⑦ 别人家 ───────────────────────────────────────────────── */
  console.log("\n⑦ 别人家");
  const other = await person("other");
  const { error: crossAddErr } = await other.client.rpc("add_membership", {
    in_project_id: P, in_party_id: mrsLim.id,
    in_plan_name: "偷来的", in_monthly_fee_cents: 100,
  });
  check("🔴 别人家开不了我的会员", !!crossAddErr, "居然让它过了");
  const { error: crossCollectErr } = await other.client.rpc("collect_membership_fee", {
    in_membership_id: m1.id,
  });
  check("🔴 别人家收不了我的会员费", !!crossCollectErr, "居然让它过了");
  const { data: crossList } = await other.client.rpc("memberships_of", { in_project_id: P });
  check("🔴 别人家也读不到我的会员名单", (crossList ?? []).length === 0,
    `${crossList?.length}`);

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
