/**
 * 试算表 · 这一天的位置 —— 用真的身分打。
 *
 * 🔴 这一支要守的第一条不是「算得对」，是 **「它平不平」**：
 *   一份不平的试算表，跟一份平的试算表，在画面上长得一模一样，
 *   而不平的那一份会被他拿去给会计。
 *
 * 🔴 第二条是**存货那一格**：少一件没有成本的货，整个要讲「算不出来」，
 *   不可以把那一件当成 0 —— 一个偷偷少算的存货，就是一份看起来
 *   没问题的资产负债表。
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
/** 🔴 马来西亚的今天，不是伺服器的（check:rentals 学到的那一条）。 */
const day = (n) => {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function person(tag, pages) {
  const cred = {
    email: `acc-${tag}-${Date.now()}@formae.test`,
    password: `Acc-${Date.now()}-x!`,
  };
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
  for (const k of pages) await as.rpc("add_project_page", { requested_key: k, new_title: k });
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

const sum = (rows, f) => (rows ?? []).reduce((a, r) => a + Number(f(r) ?? 0), 0);
const tb = (rows, code) => (rows ?? []).find((r) => r.code === code) ?? {};

try {
  const shop = await person("shop",
    ["orders", "payments", "expenses", "purchases", "inventory", "customers", "quotations"]);
  const other = await person("other", ["payments"]);
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  /* ── ① 八个科目，他自己的话 ──────────────────────────────────────────── */
  console.log("\n① 八个科目");
  const { data: accs, error: accErr } = await c.rpc("ensure_ledger_accounts", { in_project_id: P });
  check("建得起来", !accErr && (accs ?? []).length === 8, accErr?.message ?? `${(accs ?? []).length}`);
  check("而且是英文的（这个系统讲英文）",
    (accs ?? []).find((a) => a.code === "cash")?.name === "Cash and bank",
    (accs ?? []).find((a) => a.code === "cash")?.name);
  const { data: again } = await c.rpc("ensure_ledger_accounts", { in_project_id: P });
  check("再建一次还是八个", (again ?? []).length === 8);

  await c.rpc("set_ledger_account_name", {
    in_project_id: P, in_code: "cash", in_name: "Maybank + petty cash",
  });
  const { data: renamed } = await c.rpc("ensure_ledger_accounts", { in_project_id: P });
  check("🔴 名字改得了，而且再 ensure 一次不会被改回去",
    (renamed ?? []).find((a) => a.code === "cash")?.name === "Maybank + petty cash",
    (renamed ?? []).find((a) => a.code === "cash")?.name);

  /* ── ② 一张空的帐，照样平 ────────────────────────────────────────────── */
  console.log("\n② 🔴 它平不平");
  const { data: empty, error: emptyErr } = await c.rpc("trial_balance", { in_project_id: P });
  check("空的帐也出得来", !emptyErr && (empty ?? []).length === 8, emptyErr?.message);
  check("🔴 而且它平（0 = 0）",
    sum(empty, (r) => r.debit_cents) === sum(empty, (r) => r.credit_cents),
    `${sum(empty, (r) => r.debit_cents)} vs ${sum(empty, (r) => r.credit_cents)}`);

  /* ── ③ 开帐：一个数字，对方那一边自己去权益 ──────────────────────────── */
  console.log("\n③ 开帐：一个科目一个数字");
  const started = day(-30);
  await c.rpc("set_opening_balance", {
    in_project_id: P, in_code: "cash", in_amount_cents: 2000000, in_as_on: started,
  });
  await c.rpc("set_opening_balance", {
    in_project_id: P, in_code: "payable", in_amount_cents: 500000, in_as_on: started,
  });
  const { data: opened } = await c.rpc("trial_balance", { in_project_id: P });
  check("现金那一格是两万", Number(tb(opened, "cash").debit_cents) === 2000000,
    `${tb(opened, "cash").debit_cents}`);
  check("我还欠人家五千在贷方", Number(tb(opened, "payable").credit_cents) === 500000,
    `${tb(opened, "payable").credit_cents}`);
  check("🔴 开帐权益自己配平（20000 − 5000 = 15000）",
    Number(tb(opened, "opening").credit_cents) === 1500000,
    `${tb(opened, "opening").credit_cents}`);
  check("🔴 所以它还是平的",
    sum(opened, (r) => r.debit_cents) === sum(opened, (r) => r.credit_cents),
    `${sum(opened, (r) => r.debit_cents)} vs ${sum(opened, (r) => r.credit_cents)}`);

  /* 改一次，不是多一行。 */
  await c.rpc("set_opening_balance", {
    in_project_id: P, in_code: "cash", in_amount_cents: 2500000, in_as_on: started,
  });
  const { count: opCount } = await admin
    .from("opening_balances").select("id", { count: "exact", head: true })
    .eq("project_id", P).eq("code", "cash");
  check("同一个科目改第二次是改，不是多一行", opCount === 1, `${opCount}`);

  /* ── ④ 收一笔钱 · 分摊一半 ───────────────────────────────────────────── */
  console.log("\n④ 收一笔钱：分摊出去的是收入，剩下的是客人的钱");
  const { data: cust } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Tan",
  });
  const { data: job } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Kitchen", in_party: "Mr Tan", in_party_id: cust.id, in_amount_cents: 300000,
  });
  const { data: paid, error: paidErr } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_direction: "in", in_amount_cents: 500000,
    in_party: "Mr Tan", in_party_id: cust.id,
  });
  check("收得进来", !paidErr && !!paid?.id, paidErr?.message);
  /* ⚠️ 分摊是另一支（`set_payment_allocations`）—— 我第一版把它当成
     `add_ledger_entry` 的一个参数，於是整条线一起红。**红的是我的呼叫。** */
  const { error: allocErr } = await c.rpc("set_payment_allocations", {
    in_entry_id: paid.id,
    in_rows: [{ record_id: job.id, amount_cents: 300000 }],
  });
  check("分摊三千到那张单", !allocErr, allocErr?.message);

  const { data: t2 } = await c.rpc("trial_balance", { in_project_id: P });
  check("收入是分摊出去的那三千", Number(tb(t2, "income").credit_cents) === 300000,
    `${tb(t2, "income").credit_cents}`);
  check("🔴 剩下的两千是「客人先付的钱」，是一笔负债",
    Number(tb(t2, "deposits").credit_cents) === 200000,
    `${tb(t2, "deposits").credit_cents}`);
  check("🔴 而它还是平的",
    sum(t2, (r) => r.debit_cents) === sum(t2, (r) => r.credit_cents),
    `${sum(t2, (r) => r.debit_cents)} vs ${sum(t2, (r) => r.credit_cents)}`);

  /* ── ⑤ 花一笔钱 ──────────────────────────────────────────────────────── */
  console.log("\n⑤ 花一笔钱");
  await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses",
    in_direction: "out", in_amount_cents: 120000,
    in_party: "Hardware shop", in_category: "材料", in_job_id: job.id,
  });
  const { data: t3 } = await c.rpc("trial_balance", { in_project_id: P });
  check("花掉的钱在借方", Number(tb(t3, "expense").debit_cents) === 120000,
    `${tb(t3, "expense").debit_cents}`);
  check("🔴 还是平的",
    sum(t3, (r) => r.debit_cents) === sum(t3, (r) => r.credit_cents),
    `${sum(t3, (r) => r.debit_cents)} vs ${sum(t3, (r) => r.credit_cents)}`);

  /* ── ⑥ 🔴 冲正的两边都不算 ───────────────────────────────────────────── */
  console.log("\n⑥ 🔴 打错一笔，冲正之后两边都不算");
  const { data: oops } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_direction: "in", in_amount_cents: 999900, in_party: "Typo",
  });
  const { data: withTypo } = await c.rpc("trial_balance", { in_project_id: P });
  check("（控制组）打错那一笔真的进去了",
    Number(tb(withTypo, "cash").debit_cents) > Number(tb(t3, "cash").debit_cents));
  await c.rpc("reverse_ledger_entry", { in_entry_id: oops.id });
  const { data: t4 } = await c.rpc("trial_balance", { in_project_id: P });
  check("🔴 冲正之后，现金回到冲正之前那个数",
    Number(tb(t4, "cash").debit_cents) === Number(tb(t3, "cash").debit_cents),
    `${tb(t4, "cash").debit_cents} vs ${tb(t3, "cash").debit_cents}`);
  check("🔴 而且它没有把「其实没收到」算成一笔费用",
    Number(tb(t4, "expense").debit_cents) === 120000,
    `${tb(t4, "expense").debit_cents}`);
  check("🔴 还是平的",
    sum(t4, (r) => r.debit_cents) === sum(t4, (r) => r.credit_cents),
    `${sum(t4, (r) => r.debit_cents)} vs ${sum(t4, (r) => r.credit_cents)}`);

  /* ── ⑦ 这一天的位置 ─────────────────────────────────────────────────── */
  console.log("\n⑦ 这一天的位置");
  const { data: posRows, error: posErr } = await c.rpc("financial_position", { in_project_id: P });
  const pos = (posRows ?? [])[0];
  check("出得来", !posErr && !!pos, posErr?.message);
  check("现金 = 开帐 25000 + 收 5000 − 付 1200",
    Number(pos?.cash_cents) === 2500000 + 500000 - 120000,
    `${pos?.cash_cents}`);
  check("🔴 客人还欠我 0（那三千已经分摊掉了）", Number(pos?.receivable_cents) === 0,
    `${pos?.receivable_cents}`);
  check("客人先付的钱 = 两千", Number(pos?.deposits_cents) === 200000,
    `${pos?.deposits_cents}`);

  /* 一张没收齐的单 —— 应收要长出来。 */
  const { data: job2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Bathroom", in_party: "Mr Tan", in_party_id: cust.id, in_amount_cents: 800000,
  });
  const { data: pos2Rows } = await c.rpc("financial_position", { in_project_id: P });
  check("🔴 开一张没收钱的单，应收长出八千",
    Number((pos2Rows ?? [])[0]?.receivable_cents) === 800000,
    `${(pos2Rows ?? [])[0]?.receivable_cents}`);
  const { data: t5 } = await c.rpc("trial_balance", { in_project_id: P });
  check("🔴 而试算表上的收入一分都没有动（收付实现制）",
    Number(tb(t5, "income").credit_cents) === 300000,
    `${tb(t5, "income").credit_cents}`);

  /* ── ⑧ 🔴 存货：少一件成本就整个讲算不出来 ───────────────────────────── */
  console.log("\n⑧ 🔴 存货：少一件成本，整个讲算不出来");
  const { data: withCost } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Cement 50kg", in_unit: "bags", in_cost_cents: 1500,
  });
  await c.rpc("move_stock", {
    in_item_id: withCost.id, in_direction: "in", in_qty: 100, in_reason: "Opening",
  });
  const { data: pos3Rows } = await c.rpc("financial_position", { in_project_id: P });
  const pos3 = (pos3Rows ?? [])[0];
  check("每一件都有成本，算得出来", pos3?.inventory_known === true, `${pos3?.inventory_known}`);
  check("100 × 15.00 = 1500.00", Number(pos3?.inventory_cents) === 150000,
    `${pos3?.inventory_cents}`);

  const { data: noCost } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "River sand", in_unit: "tonnes",
  });
  await c.rpc("move_stock", {
    in_item_id: noCost.id, in_direction: "in", in_qty: 5, in_reason: "Opening",
  });
  const { data: pos4Rows } = await c.rpc("financial_position", { in_project_id: P });
  const pos4 = (pos4Rows ?? [])[0];
  check("🔴 一件没成本，整个讲算不出来", pos4?.inventory_known === false,
    `${pos4?.inventory_known}`);
  check("而且讲得出差几件", Number(pos4?.items_without_cost) === 1,
    `${pos4?.items_without_cost}`);

  /* ── ⑨ 我还欠人家 ────────────────────────────────────────────────────── */
  console.log("\n⑨ 我还欠人家");
  const { data: po } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases",
    in_title: "Cement order", in_party: "Hardware shop", in_amount_cents: 400000,
  });
  const { data: pos5Rows } = await c.rpc("financial_position", { in_project_id: P });
  check("一张进货单 = 开帐 5000 + 4000",
    Number((pos5Rows ?? [])[0]?.payable_cents) === 500000 + 400000,
    `${(pos5Rows ?? [])[0]?.payable_cents}`);
  const { data: payBill } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses",
    in_direction: "out", in_amount_cents: 150000, in_party: "Hardware shop",
  });
  await c.rpc("set_payment_allocations", {
    in_entry_id: payBill.id,
    in_rows: [{ record_id: po.id, amount_cents: 150000 }],
  });
  const { data: pos6Rows } = await c.rpc("financial_position", { in_project_id: P });
  check("🔴 付了一千五，欠的少一千五",
    Number((pos6Rows ?? [])[0]?.payable_cents) === 500000 + 400000 - 150000,
    `${(pos6Rows ?? [])[0]?.payable_cents}`);

  /* ── ⑩ 期间 ──────────────────────────────────────────────────────────── */
  console.log("\n⑩ 期间");
  const { data: tOld } = await c.rpc("trial_balance", {
    in_project_id: P, in_from: day(-60), in_to: day(-40),
  });
  check("那一段什么都没发生，全是 0",
    sum(tOld, (r) => r.debit_cents) === 0 && sum(tOld, (r) => r.credit_cents) === 0,
    `${sum(tOld, (r) => r.debit_cents)}`);
  check("🔴 而它照样平", sum(tOld, (r) => r.debit_cents) === sum(tOld, (r) => r.credit_cents));

  /* ── ⑪ 挡住的 ────────────────────────────────────────────────────────── */
  console.log("\n⑪ 挡住的");
  const { error: futErr } = await c.rpc("set_opening_balance", {
    in_project_id: P, in_code: "cash", in_amount_cents: 100, in_as_on: day(3),
  });
  check("开帐日不给写未来", !!futErr, "居然让它过了");
  const { error: negErr } = await c.rpc("set_opening_balance", {
    in_project_id: P, in_code: "cash", in_amount_cents: -100, in_as_on: started,
  });
  check("开帐数字不给写负数", !!negErr, "居然让它过了");
  const { error: badCode } = await c.rpc("set_opening_balance", {
    in_project_id: P, in_code: "income", in_amount_cents: 100, in_as_on: started,
  });
  check("收入不给开帐（那是一段期间的事）", !!badCode, "居然让它过了");

  /* ── ⑫ 别人家 · 师傅 ─────────────────────────────────────────────────── */
  console.log("\n⑫ 谁看得到");
  const { error: crossErr } = await other.as.rpc("trial_balance", { in_project_id: P });
  check("别人家的试算表读不到", !!crossErr, "居然让它过了");
  const { data: ownTb } = await other.as.rpc("trial_balance", { in_project_id: other.projectId });
  check("（控制组）他自己那一家读得到", Array.isArray(ownTb), `${JSON.stringify(ownTb)}`);

  const crew = await person("crew", []);
  await c.rpc("add_project_member", { in_email: crew.cred.email });
  const crewClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await crewClient.auth.signInWithPassword(crew.cred);
  const { error: crewTbErr } = await crewClient.rpc("trial_balance", { in_project_id: P });
  check("🔴 师傅读不到试算表（那是钱）", !!crewTbErr, "居然让它过了");
  const { error: crewPosErr } = await crewClient.rpc("financial_position", { in_project_id: P });
  check("🔴 师傅读不到这一天的位置", !!crewPosErr, "居然让它过了");
  const { data: crewAcc } = await crewClient.from("ledger_accounts").select("id").eq("project_id", P);
  check("🔴 师傅连科目表都读不到", (crewAcc ?? []).length === 0, `${(crewAcc ?? []).length}`);
  /* 控制组：老板自己读得到那八行。 */
  const { data: ownerAcc } = await c.from("ledger_accounts").select("id").eq("project_id", P);
  check("（控制组）老板自己读得到那八行", (ownerAcc ?? []).length === 8,
    `${(ownerAcc ?? []).length}`);
} finally {
  await dropThrowaways(admin, made);
}

console.log(
  failed.length === 0
    ? `\n判：全过`
    : `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);
