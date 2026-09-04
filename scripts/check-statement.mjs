/**
 * 月结对帐单 · 账龄 —— 用真的身分打，而且拿他自己的帐去对得上。
 *
 * ── 这一支真正在守的那一条 ──────────────────────────────────────────────
 *
 * 🔴 **一个问题只能有一个答案。**
 * 「他还欠我多少」`party_debts` 已经在答；对帐单的期末余额必须**跟它一模一样**。
 * 两个数字各自都讲得通、而差一块钱，就是他站在客人面前对不上帐的那一天 ——
 * 而这个仓库最贵的缺陷全部是这个形状。
 *
 * 所以这里每一条断言都是**双向的**：算术对得上，而且**跟既有那一支对得上**。
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

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const made = [];
/** 马来西亚的今天，往前推 n 天。 */
const day = (n) =>
  new Date(Date.now() + 8 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);

async function person(tag) {
  const cred = { email: `stm-${tag}-${Date.now()}@formae.test`, password: `Stm-${Date.now()}-x!` };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email, password: cred.password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);
  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", user.user.id).single();
  for (const k of ["quotations", "payments", "purchases", "suppliers"]) {
    await as.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  return { as, userId: user.user.id, projectId: proj?.id };
}

try {
  const boss = await person("boss");
  const c = boss.as;
  const P = boss.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  const { data: cust } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Tan Hardware",
  });

  /* 100 天前一张 RM 10,000，40 天前一张 RM 5,000，今天一张 RM 2,000。 */
  const mk = async (title, cents, ago) =>
    (await c.rpc("add_pipeline_record", {
      in_project_id: P, in_module_key: "quotations",
      in_title: title, in_party: "Tan Hardware", in_party_id: cust.id,
      in_amount_cents: cents, in_issued_on: day(ago),
    })).data;

  const old = await mk("Old job", 1_000_000, 100);
  const mid = await mk("Mid job", 500_000, 40);
  const now = await mk("New job", 200_000, 0);
  check("三张单开得起来", !!old?.id && !!mid?.id && !!now?.id);

  /* 50 天前收了 RM 400,000，扣在最老那一张上。 */
  const { data: pay } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_amount_cents: 400_000, in_party: "Tan Hardware", in_party_id: cust.id,
    in_entry_on: day(50),
  });
  await c.rpc("set_payment_allocations", {
    in_entry_id: pay.id, in_rows: [{ record_id: old.id, amount_cents: 400_000 }],
  });

  /* ── ① 期末余额必须跟既有那一支一模一样 ───────────────────────────── */
  console.log("\n① 一个问题一个答案");
  const { data: stmt, error: stErr } = await c.rpc("party_statement", {
    p_project_id: P, p_party_id: cust.id, p_from: day(120), p_to: day(0),
  });
  check("对帐单跑得出来", !stErr && (stmt ?? []).length > 0, stErr?.message);

  const closing = Number((stmt ?? [])[(stmt ?? []).length - 1]?.running_cents);
  const { data: debts } = await c.rpc("party_debts", { in_project_id: P });
  const owed = Number((debts ?? []).find((d) => d.party_id === cust.id)?.owed_cents);
  check("🔴 期末余额跟「他还欠我多少」一模一样", closing === owed, `${closing} vs ${owed}`);
  /* 三张单 1,000,000 + 500,000 + 200,000 = 1,700,000，扣掉分摊的 400,000。
     ⚠️ 我第一版在这里写 1,700,000 —— **忘了减那一笔**，而产品是对的。
     把作者算错的数字写成正确答案，尺子就不再量产品，开始量作者
     （这个仓库记过三次，这是第四次）。 */
  check("而且算出来就是 1,300,000 分", closing === 1_300_000, `${closing}`);

  /* ── ② 一张纸读得下去 ─────────────────────────────────────────────── */
  console.log("\n② 那张纸上有什么");
  const kinds = (stmt ?? []).map((r) => r.kind);
  check("第一行是期初", kinds[0] === "opening", JSON.stringify(kinds));
  check("三张单跟一笔收款都在", kinds.filter((k) => k === "charge").length === 3 &&
    kinds.filter((k) => k === "payment").length === 1, JSON.stringify(kinds));
  const dates = (stmt ?? []).map((r) => r.on_date);
  check("按日期排", dates.join(",") === [...dates].sort().join(","), dates.join(","));

  /* 期初：从 40 天前起算，最老那张单跟那笔收款都在期外，
     所以期初 = 10,000 − 4,000 = 6,000。 */
  const { data: short } = await c.rpc("party_statement", {
    p_project_id: P, p_party_id: cust.id, p_from: day(41), p_to: day(0),
  });
  check("🔴 期初把期外的单跟期外的收款都算进去了",
    Number((short ?? [])[0]?.running_cents) === 600_000,
    `${(short ?? [])[0]?.running_cents}`);
  check("而且这一段的期末还是同一个数",
    Number((short ?? [])[(short ?? []).length - 1]?.running_cents) === owed,
    `${(short ?? [])[(short ?? []).length - 1]?.running_cents}`);

  /* ── ③ 订金是另一个数字，不混进去 ─────────────────────────────────── */
  console.log("\n③ 订金");
  const { data: dep0 } = await c.rpc("party_deposit", { p_project_id: P, p_party_id: cust.id });
  check("现在没有订金", Number(dep0) === 0, `${dep0}`);

  await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_amount_cents: 300_000, in_party: "Tan Hardware", in_party_id: cust.id,
  });
  const { data: dep1 } = await c.rpc("party_deposit", { p_project_id: P, p_party_id: cust.id });
  check("先给的钱变成订金", Number(dep1) === 300_000, `${dep1}`);

  const { data: stmt2 } = await c.rpc("party_statement", {
    p_project_id: P, p_party_id: cust.id, p_from: day(120), p_to: day(0),
  });
  const closing2 = Number((stmt2 ?? [])[(stmt2 ?? []).length - 1]?.running_cents);
  /* 🔴 没有分摊的订金**不准**混进期末余额 —— 那样就有两个答案了。 */
  check("🔴 订金没有混进期末余额", closing2 === owed, `${closing2} vs ${owed}`);

  /* ── ④ 冲正过的钱不算 ─────────────────────────────────────────────── */
  console.log("\n④ 冲正");
  await c.rpc("reverse_ledger_entry", { in_entry_id: pay.id });
  const { data: stmt3 } = await c.rpc("party_statement", {
    p_project_id: P, p_party_id: cust.id, p_from: day(120), p_to: day(0),
  });
  const closing3 = Number((stmt3 ?? [])[(stmt3 ?? []).length - 1]?.running_cents);
  /* 1,300,000 + 那笔被冲掉的 400,000 = 1,700,000，也就是三张单的全额。 */
  check("🔴 冲正之后，那笔钱从对帐单上消失", closing3 === 1_700_000, `${closing3}`);
  const paidLines = (stmt3 ?? []).filter((r) => r.kind === "payment").length;
  check("而且那一行也不再印出来", paidLines === 0, `${paidLines} 行`);

  /* ── ⑤ 账龄 ───────────────────────────────────────────────────────── */
  console.log("\n⑤ 账龄分段");
  const { data: aged, error: agErr } = await c.rpc("party_aging", { p_project_id: P });
  const a = (aged ?? []).find((x) => x.party_id === cust.id);
  check("账龄跑得出来", !agErr && !!a, agErr?.message ?? JSON.stringify(aged));
  check("今天开的那一张在「本期」", Number(a?.current_cents) === 200_000, `${a?.current_cents}`);
  check("40 天那一张在 31–60", Number(a?.d60_cents) === 500_000, `${a?.d60_cents}`);
  check("100 天那一张在「90 天以上」", Number(a?.older_cents) === 1_000_000, `${a?.older_cents}`);
  check("🔴 分段加起来 = 他还欠我多少", Number(a?.total_cents) === 1_700_000,
    `${a?.total_cents}`);

  /* ── ⑥ 谁看得到 ───────────────────────────────────────────────────── */
  console.log("\n⑥ 谁看得到");
  const other = await person("other");
  const { data: theirs } = await other.as.rpc("party_aging", { p_project_id: P });
  check("别人家看不到账龄", (theirs ?? []).length === 0, `${theirs?.length} 行`);
  const { error: theirStmt } = await other.as.rpc("party_statement", {
    p_project_id: P, p_party_id: cust.id, p_from: day(120), p_to: day(0),
  });
  check("别人家拉不出对帐单", !!theirStmt, theirStmt?.message ?? "居然让它过了");

  const staff = await person("staff");
  const { error: memErr } = await c.rpc("add_project_member", {
    in_email: `stm-staff-x@formae.test`, in_role: "staff",
  });
  /* 那个 email 不存在，所以这一条只是确认它不会静静成功。 */
  check("加一个不存在的人会讲话", !!memErr, "居然让它过了");
  void staff;

  /* ── ⑦ 反过来的期间 ───────────────────────────────────────────────── */
  const { error: backwards } = await c.rpc("party_statement", {
    p_project_id: P, p_party_id: cust.id, p_from: day(0), p_to: day(30),
  });
  check("期间反过来会讲话", !!backwards, backwards?.message ?? "居然让它过了");
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
